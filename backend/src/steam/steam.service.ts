import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { CatalogGameNotFoundError, CatalogImportService } from '../catalog/catalog-import.service';
import { CatalogProvider } from '../catalog/catalog-provider';
import { assetUrl } from '../catalog/catalog-urls';
import {
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from '../catalog/game-catalog-provider';
import { TtlCache } from '../catalog/ttl-cache';
import { apiError } from '../common/api-error';
import type { EnvironmentVariables } from '../config/env.validation';
import { isUniqueViolation } from '../database/postgres-errors';
import { Game } from '../games/game.entity';
import { ActivityType } from '../activity/activity.entity';
import { ActivityService } from '../activity/activity.service';
import { Achievement } from '../library/achievement.entity';
import { DifficultiesService } from '../library/difficulties.service';
import { DifficultyKind } from '../library/difficulty.entity';
import { MAX_MINUTES, PlayStatus } from '../library/library.constants';
import { PlatinumService } from '../library/platinum.service';
import { Playthrough } from '../library/playthrough.entity';
import { UserGame } from '../library/user-game.entity';
import { Platform } from '../platforms/platform.entity';
import { SteamAccount, SteamSyncStatus } from './steam-account.entity';
import {
  type SteamAchievementSchema,
  STEAM_API,
  type SteamApi,
  type SteamLanguage,
  type SteamOwnedGame,
  SteamPrivateProfileError,
} from './steam-api';
import { SteamExcludedApp } from './steam-excluded-app.entity';
import { SteamPendingApp } from './steam-pending-app.entity';
import {
  STEAM_AUTO_SYNC_INTERVAL_MS,
  STEAM_MIN_IMPORT_MINUTES,
  STEAM_SYNC_CONCURRENCY,
  STEAM_SYNC_COOLDOWN_MS,
  STEAM_SYNC_STALE_MS,
  SteamErrorCode,
  steamCoverUrl,
} from './steam.constants';

export interface SteamAccountDto {
  personaName: string | null;
  linkedAt: string;
  lastSyncedAt: string | null;
  syncing: boolean;
  /** Error code of the last sync, if it failed (e.g. PRIVATE_PROFILE). */
  syncError: string | null;
  progress: { done: number; total: number };
  /** Games Steam added to the library (unlinking can delete them). */
  importedGames: number;
  /** Games found by the syncs, waiting for the user's review (decision #80). */
  pendingGames: number;
}

/** A Steam game found by a sync, offered to the user. */
export interface SteamPendingGameDto {
  appId: number;
  /** The catalog's name, or Steam's when it isn't in the catalog. */
  name: string;
  minutes: number;
  coverUrl: string | null;
  /** Not in the catalog: it'd be added as a manual game. */
  manual: boolean;
  /** Already in the library on PC: Steam's hours and achievements would be added to it. */
  inLibrary: boolean;
}

export interface SteamStatusDto {
  configured: boolean;
  account: SteamAccountDto | null;
  /** Steam games the user removed: syncs don't add them again. */
  excluded: { appId: number; name: string }[];
}

/** Result of Steam's login callback, shown by the frontend. */
export type SteamLinkResult =
  'linked' | 'INVALID_LOGIN' | SteamErrorCode.AccountInUse | SteamErrorCode.SteamUnavailable;

const LOGIN_STATE_TTL_MS = 10 * 60_000;
const SCHEMA_TTL_MS = 24 * 60 * 60_000;

/**
 * Steam integration (decisions #78 and #80): links a Steam account through
 * Steam's login, offers the played games for the user to pick the ones to add
 * (with their hours) and keeps hours and achievements in sync. Syncs run in the background; their
 * state is stored in the account so the frontend can follow them.
 */
@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);
  /** Pending logins: state -> user id (also protects the callback from CSRF). */
  private readonly loginStates = new TtlCache<string>(LOGIN_STATE_TTL_MS, 10_000);
  /** Achievement texts per game and language, shared by every user. */
  private readonly schemas = new TtlCache<SteamAchievementSchema[]>(SCHEMA_TTL_MS, 5_000);
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @Inject(STEAM_API) private readonly steam: SteamApi,
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly importer: CatalogImportService,
    private readonly difficulties: DifficultiesService,
    private readonly platinum: PlatinumService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly dataSource: DataSource,
    @InjectRepository(SteamAccount) private readonly accounts: Repository<SteamAccount>,
    @InjectRepository(SteamExcludedApp) private readonly excluded: Repository<SteamExcludedApp>,
    @InjectRepository(SteamPendingApp) private readonly pendingApps: Repository<SteamPendingApp>,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    @InjectRepository(UserGame) private readonly userGames: Repository<UserGame>,
    @InjectRepository(Playthrough) private readonly playthroughs: Repository<Playthrough>,
    @InjectRepository(Achievement) private readonly achievements: Repository<Achievement>,
    @InjectRepository(Platform) private readonly platforms: Repository<Platform>,
  ) {}

  get isConfigured(): boolean {
    return this.steam.isConfigured;
  }

  /** Forgets pending logins and cached achievement texts (tests). */
  clearCache(): void {
    this.loginStates.clear();
    this.schemas.clear();
  }

  /** The frontend's origin: Steam's login comes back to it (its /api goes to this backend). */
  get origin(): string {
    return this.config.get('FRONTEND_ORIGIN', { infer: true }).replace(/\/+$/, '');
  }

  async status(userId: string): Promise<SteamStatusDto> {
    const [account, excluded] = await Promise.all([
      this.accounts.findOneBy({ userId }),
      this.excluded.find({ where: { userId }, order: { name: 'ASC' } }),
    ]);
    const [importedGames, pendingGames] = account
      ? await Promise.all([
          this.userGames.countBy({ userId, steamImported: true }),
          this.pendingApps.countBy({ userId }),
        ])
      : [0, 0];
    return {
      configured: this.isConfigured,
      account: account ? this.toAccountDto(account, importedGames, pendingGames) : null,
      excluded: excluded.map(({ appId, name }) => ({ appId, name })),
    };
  }

  /** URL of Steam's login for this user. */
  loginUrl(userId: string): string {
    if (!this.isConfigured) {
      throw apiError(HttpStatus.SERVICE_UNAVAILABLE, SteamErrorCode.NotConfigured, 'Steam is off');
    }
    const state = randomBytes(24).toString('base64url');
    this.loginStates.set(state, userId);
    return this.steam.loginUrl(this.callbackUrl(state), this.origin);
  }

  /** Steam's login callback: verifies it with Steam and links the account. */
  async completeLogin(userId: string, query: Record<string, string>): Promise<SteamLinkResult> {
    const state = query.state;
    if (!state || this.loginStates.get(state) !== userId) {
      return 'INVALID_LOGIN';
    }
    this.loginStates.delete(state);
    let steamId: string | null;
    try {
      steamId = await this.steam.verifyLogin(query, this.callbackUrl(state));
    } catch (error) {
      this.logger.warn(`Steam login could not be verified: ${(error as Error).message}`);
      return SteamErrorCode.SteamUnavailable;
    }
    if (!steamId) {
      return 'INVALID_LOGIN';
    }
    return this.link(userId, steamId);
  }

  /** Links (or replaces) the user's Steam account and starts the first sync. */
  async link(userId: string, steamId: string): Promise<'linked' | SteamErrorCode.AccountInUse> {
    const owner = await this.accounts.findOneBy({ steamId });
    if (owner && owner.userId !== userId) {
      return SteamErrorCode.AccountInUse;
    }
    const personaName = await this.steam.getPersonaName(steamId).catch(() => null);
    try {
      await this.accounts.upsert(
        {
          userId,
          steamId,
          personaName,
          linkedAt: new Date(),
          syncStatus: SteamSyncStatus.Idle,
          syncError: null,
          syncStartedAt: null,
          syncDone: 0,
          syncTotal: 0,
          lastSyncedAt: null,
        },
        ['userId'],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return SteamErrorCode.AccountInUse;
      }
      throw error;
    }
    await this.startSync(userId);
    return 'linked';
  }

  /**
   * Unlinks Steam and forgets the removed games. The imported games, hours and
   * achievements stay, unless `deleteGames`: then the games Steam added are
   * deleted and the ones the user already had on PC lose Steam's hours and
   * achievements (their own time, playthroughs and achievements stay).
   */
  async unlink(userId: string, deleteGames = false): Promise<void> {
    await this.accounts.delete({ userId });
    // A running sync stops once the account is gone; wait so it adds nothing back.
    await this.whenIdle(userId);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(SteamExcludedApp).delete({ userId });
      await manager.getRepository(SteamPendingApp).delete({ userId });
      if (!deleteGames) {
        return;
      }
      await manager.getRepository(UserGame).delete({ userId, steamImported: true });
      const linked = await manager.getRepository(UserGame).find({
        where: { userId, steamAppId: Not(IsNull()) },
        select: { id: true },
      });
      if (linked.length === 0) {
        return;
      }
      const ids = linked.map((ug) => ug.id);
      await manager.getRepository(Achievement).delete({
        userGameId: In(ids),
        steamApiName: Not(IsNull()),
      });
      await manager
        .createQueryBuilder()
        .update(Playthrough)
        .set({ steamMinutes: 0, previousTimeMinutes: () => 'GREATEST(previous_time_minutes, 0)' })
        .where({ userGameId: In(ids) })
        .execute();
      await manager
        .getRepository(UserGame)
        .update({ id: In(ids) }, { steamAppId: null, steamAllAchieved: false });
    });
  }

  /** Adds a removed Steam game again (the user chose it: no review needed). */
  async restoreExcluded(userId: string, appId: number): Promise<SteamStatusDto> {
    await this.excluded.delete({ userId, appId });
    if (await this.accounts.existsBy({ userId })) {
      await this.startSync(userId, new Set([appId]));
    }
    return this.status(userId);
  }

  /**
   * Starts a sync. Automatic ones (on opening "Mis juegos") only run if the last
   * attempt is older than 6 hours; manual ones need 5 minutes between them.
   */
  async requestSync(userId: string, auto: boolean, now = new Date()): Promise<SteamStatusDto> {
    const account = await this.accounts.findOneBy({ userId });
    if (!account) {
      throw apiError(HttpStatus.NOT_FOUND, SteamErrorCode.NotLinked, 'Steam is not linked');
    }
    if (!this.isConfigured || this.isRunning(account, now)) {
      return this.status(userId);
    }
    const lastAttempt = account.syncStartedAt?.getTime() ?? 0;
    const elapsed = now.getTime() - lastAttempt;
    if (auto) {
      if (elapsed < STEAM_AUTO_SYNC_INTERVAL_MS) {
        return this.status(userId);
      }
    } else if (elapsed < STEAM_SYNC_COOLDOWN_MS) {
      throw apiError(
        HttpStatus.TOO_MANY_REQUESTS,
        SteamErrorCode.SyncCooldown,
        'Wait a few minutes between syncs',
      );
    }
    await this.startSync(userId);
    return this.status(userId);
  }

  /**
   * Games found by the syncs that the user hasn't reviewed yet (decision #80),
   * with the most played first.
   */
  async pending(userId: string): Promise<SteamPendingGameDto[]> {
    const rows = await this.pendingApps.find({
      where: { userId },
      relations: { game: true },
      order: { minutes: 'DESC', name: 'ASC' },
    });
    const pc = await this.platforms.findOneByOrFail({ slug: 'pc' });
    const gameIds = rows.flatMap((row) => (row.gameId ? [row.gameId] : []));
    const inLibrary = new Set(
      gameIds.length
        ? (
            await this.userGames.find({
              where: { userId, platformId: pc.id, gameId: In(gameIds) },
              select: { gameId: true },
            })
          ).map((ug) => ug.gameId)
        : [],
    );
    return rows.map((row) => ({
      appId: row.appId,
      name: row.game?.name ?? row.name,
      minutes: row.minutes,
      coverUrl: row.game?.coverAssetKey
        ? assetUrl(row.game.coverAssetKey)
        : steamCoverUrl(row.appId),
      manual: row.game === null,
      inLibrary: row.gameId !== null && inLibrary.has(row.gameId),
    }));
  }

  /**
   * The user's choice among the games found: the selected ones are added (in
   * the background, like a sync) and the rest become removed games.
   */
  async confirmPending(userId: string, appIds: number[]): Promise<SteamStatusDto> {
    const account = await this.accounts.findOneBy({ userId });
    if (!account) {
      throw apiError(HttpStatus.NOT_FOUND, SteamErrorCode.NotLinked, 'Steam is not linked');
    }
    if (this.running.has(userId) || this.isRunning(account, new Date())) {
      throw apiError(HttpStatus.CONFLICT, SteamErrorCode.SyncRunning, 'A sync is running');
    }
    const selected = new Set(appIds);
    const rows = await this.pendingApps.findBy({ userId });
    const chosen = rows.filter((row) => selected.has(row.appId));
    const left = rows.filter((row) => !selected.has(row.appId));
    await this.dataSource.transaction(async (manager) => {
      if (left.length) {
        await manager.getRepository(SteamExcludedApp).upsert(
          left.map(({ appId, name }) => ({ userId, appId, name })),
          ['userId', 'appId'],
        );
      }
      await manager.getRepository(SteamPendingApp).delete({ userId });
    });
    if (chosen.length) {
      await this.startJob(userId, (current) => this.addChosen(current, chosen));
    }
    return this.status(userId);
  }

  /** Waits for the user's running sync, if any (tests and graceful flows). */
  async whenIdle(userId: string): Promise<void> {
    await this.running.get(userId);
  }

  private startSync(userId: string, importNow = new Set<number>()): Promise<void> {
    return this.startJob(userId, (account) => this.sync(account, importNow));
  }

  /** Runs a sync-like job in the background, keeping its state in the account. */
  /**
   * Starts a job in the background. Resolves once the account is marked as
   * syncing, so the response already shows it (and the frontend follows it).
   */
  private startJob(userId: string, job: (account: SteamAccount) => Promise<void>): Promise<void> {
    if (this.running.has(userId)) {
      return Promise.resolve();
    }
    const started = this.accounts.update(
      { userId },
      {
        syncStatus: SteamSyncStatus.Syncing,
        syncStartedAt: new Date(),
        syncError: null,
        syncDone: 0,
        syncTotal: 0,
      },
    );
    const run = started
      .then(() => this.runJob(userId, job))
      .catch((error: unknown) =>
        this.logger.error(`Steam sync crashed: ${(error as Error).message}`),
      )
      .finally(() => this.running.delete(userId));
    this.running.set(userId, run);
    return started.then(
      () => undefined,
      () => undefined,
    );
  }

  private async runJob(
    userId: string,
    job: (account: SteamAccount) => Promise<void>,
  ): Promise<void> {
    const account = await this.accounts.findOneBy({ userId });
    if (!account) {
      return;
    }
    try {
      await job(account);
      await this.accounts.update(
        { userId, steamId: account.steamId },
        { syncStatus: SteamSyncStatus.Idle, lastSyncedAt: new Date() },
      );
    } catch (error) {
      const code =
        error instanceof SteamPrivateProfileError
          ? SteamErrorCode.PrivateProfile
          : error instanceof CatalogUnavailableError
            ? SteamErrorCode.CatalogUnavailable
            : SteamErrorCode.SteamUnavailable;
      if (!(error instanceof SteamPrivateProfileError)) {
        this.logger.warn(`Steam sync failed: ${(error as Error).message}`);
      }
      await this.accounts.update(
        { userId, steamId: account.steamId },
        { syncStatus: SteamSyncStatus.Failed, syncError: code },
      );
    }
  }

  /**
   * Updates the hours and achievements of the linked games and offers the new
   * ones (1 hour or more, not removed) for the user to review (decision #80).
   * `importNow` are added right away (a removed game the user restored).
   */
  private async sync(account: SteamAccount, importNow: Set<number>): Promise<void> {
    const { userId, steamId } = account;
    const owned = await this.steam.getOwnedGames(steamId);
    const personaName = await this.steam.getPersonaName(steamId).catch(() => null);
    if (personaName && personaName !== account.personaName) {
      await this.accounts.update({ userId }, { personaName });
    }

    const linked = await this.userGames.find({
      where: { userId, steamAppId: Not(IsNull()) },
      select: { id: true, steamAppId: true },
    });
    const firsts = linked.length
      ? await this.playthroughs.find({
          where: { userGameId: In(linked.map((ug) => ug.id)), number: 1 },
          select: { id: true, userGameId: true, steamMinutes: true },
        })
      : [];
    const firstByUserGame = new Map(firsts.map((p) => [p.userGameId, p]));
    const linkedByApp = new Map(linked.map((ug) => [ug.steamAppId!, ug.id]));
    const excluded = new Set(
      (await this.excluded.find({ where: { userId }, select: { appId: true } })).map(
        (e) => e.appId,
      ),
    );
    const pendingByApp = new Map(
      (await this.pendingApps.findBy({ userId })).map((row) => [row.appId, row]),
    );

    const candidates = owned.filter(
      (game) =>
        game.minutes >= STEAM_MIN_IMPORT_MINUTES &&
        !linkedByApp.has(game.appId) &&
        !excluded.has(game.appId),
    );
    const toImport = candidates.filter((game) => importNow.has(game.appId));
    const toOffer = candidates.filter((game) => !importNow.has(game.appId));
    const newOffers = toOffer.filter((game) => !pendingByApp.has(game.appId));
    const toUpdate = owned.filter((game) => linkedByApp.has(game.appId));
    let done = 0;
    await this.accounts.update(
      { userId },
      { syncTotal: newOffers.length + toImport.length + toUpdate.length },
    );
    const progress = () => this.accounts.update({ userId }, { syncDone: ++done });

    const toMatch = [...newOffers, ...toImport];
    const catalogIds = toMatch.length
      ? await this.catalog.findBySteamAppIds(toMatch.map((game) => game.appId))
      : new Map<number, string>();
    const stillLinked = () => this.accounts.existsBy({ userId, steamId });

    // Found games wait for the user's review; the ones no longer offered
    // (linked, removed or not owned anymore) are dropped.
    const offered = new Set(toOffer.map((game) => game.appId));
    const stale = [...pendingByApp.keys()].filter((appId) => !offered.has(appId));
    if (stale.length) {
      await this.pendingApps.delete({ userId, appId: In(stale) });
    }
    for (const game of toOffer) {
      const row = pendingByApp.get(game.appId);
      if (row && row.minutes !== game.minutes) {
        await this.pendingApps.update({ userId, appId: game.appId }, { minutes: game.minutes });
      }
    }
    for (const game of newOffers) {
      if (!(await stillLinked())) {
        return;
      }
      const catalogGame = await this.catalogGame(catalogIds.get(game.appId));
      await this.pendingApps.upsert(
        {
          userId,
          appId: game.appId,
          name: game.name.slice(0, 200),
          minutes: game.minutes,
          gameId: catalogGame?.id ?? null,
        },
        ['userId', 'appId'],
      );
      await progress();
    }

    const pc = await this.platforms.findOneByOrFail({ slug: 'pc' });
    const achievementJobs: { userGameId: string; appId: number }[] = [];
    for (const game of toImport) {
      if (!(await stillLinked())) {
        return;
      }
      const catalogGame = await this.catalogGame(catalogIds.get(game.appId));
      const userGameId = await this.importGame(userId, pc.id, game, catalogGame);
      if (userGameId) {
        achievementJobs.push({ userGameId, appId: game.appId });
      }
      await progress();
    }
    await this.recordImport(userId, achievementJobs.length);
    for (const game of toUpdate) {
      const userGameId = linkedByApp.get(game.appId)!;
      const first = firstByUserGame.get(userGameId);
      // Achievements can only change if the game was played since the last sync.
      if (first && first.steamMinutes !== game.minutes) {
        await this.playthroughs.update({ id: first.id }, { steamMinutes: game.minutes });
        achievementJobs.push({ userGameId, appId: game.appId });
      }
      await progress();
    }
    await this.syncAchievementJobs(account, achievementJobs);
  }

  /** Adds the games the user chose among the ones found, with their achievements. */
  private async addChosen(account: SteamAccount, chosen: SteamPendingApp[]): Promise<void> {
    const { userId, steamId } = account;
    await this.accounts.update({ userId }, { syncTotal: chosen.length });
    const pc = await this.platforms.findOneByOrFail({ slug: 'pc' });
    const achievementJobs: { userGameId: string; appId: number }[] = [];
    let done = 0;
    for (const row of chosen) {
      if (!(await this.accounts.existsBy({ userId, steamId }))) {
        return;
      }
      const catalogGame = row.gameId ? await this.games.findOneBy({ id: row.gameId }) : null;
      const userGameId = await this.importGame(
        userId,
        pc.id,
        { appId: row.appId, name: row.name, minutes: row.minutes },
        catalogGame,
      );
      if (userGameId) {
        achievementJobs.push({ userGameId, appId: row.appId });
      }
      await this.accounts.update({ userId }, { syncDone: ++done });
    }
    await this.recordImport(userId, achievementJobs.length);
    await this.syncAchievementJobs(account, achievementJobs);
  }

  /** Games added from Steam at once: a single activity event (decision #86). */
  private async recordImport(userId: string, count: number): Promise<void> {
    if (count > 0) {
      await this.activity.record(userId, ActivityType.SteamImport, { data: { count } });
    }
  }

  private async syncAchievementJobs(
    { userId, steamId }: SteamAccount,
    jobs: { userGameId: string; appId: number }[],
  ): Promise<void> {
    const stillLinked = () => this.accounts.existsBy({ userId, steamId });
    if (!(await stillLinked())) {
      return;
    }
    await runConcurrently(jobs, STEAM_SYNC_CONCURRENCY, async (job) => {
      try {
        if (!(await stillLinked())) {
          return;
        }
        const unlocked = await this.syncAchievements(steamId, job.userGameId, job.appId);
        if (unlocked > 0) {
          await this.activity.record(userId, ActivityType.Achievements, {
            userGameId: job.userGameId,
            data: { count: unlocked },
          });
        }
      } catch (error) {
        // One game failing doesn't stop the rest: it's retried when played again.
        this.logger.warn(
          `Steam achievements of app ${job.appId} failed: ${(error as Error).message}`,
        );
      }
    });
    if (await stillLinked()) {
      await this.awardPlatinums(userId);
    }
  }

  /**
   * Automatic platinum (decision #81): when every Steam achievement of a linked
   * game turns unlocked on Steam, the game gets the platinum (unless it has
   * one), dated on the last unlock and with the game's current total time.
   * Only the change to "all unlocked" counts: a platinum the user removes isn't
   * added again until the game has new achievements and they're completed.
   */
  private async awardPlatinums(userId: string): Promise<void> {
    const rows: {
      id: string;
      platinum: boolean;
      was_complete: boolean;
      complete: boolean;
      last_date: string | null;
      start_date: string | null;
      total_minutes: number;
    }[] = await this.dataSource.query(
      `SELECT ug.id,
              ug.platinum_achieved AS platinum,
              ug.steam_all_achieved AS was_complete,
              (count(a.id) > 0 AND bool_and(a.steam_achieved)) AS complete,
              to_char(max(a.achieved_at) FILTER (WHERE a.steam_achieved) AT TIME ZONE 'UTC',
                      'YYYY-MM-DD') AS last_date,
              s.start_date,
              s.total_minutes
       FROM user_games ug
       JOIN user_game_summaries s ON s.user_game_id = ug.id
       LEFT JOIN achievements a ON a.user_game_id = ug.id AND a.steam_api_name IS NOT NULL
       WHERE ug.user_id = $1 AND ug.steam_app_id IS NOT NULL
       GROUP BY ug.id, s.start_date, s.total_minutes`,
      [userId],
    );
    const today = new Date().toISOString().slice(0, 10);
    for (const row of rows) {
      if (row.complete === row.was_complete) {
        continue;
      }
      await this.userGames.update({ id: row.id }, { steamAllAchieved: row.complete });
      if (!row.complete || row.platinum) {
        continue;
      }
      let date = row.last_date && row.last_date < today ? row.last_date : today;
      // The platinum can't be before the game's start date.
      if (row.start_date && date < row.start_date) {
        date = row.start_date;
      }
      const minutes = Math.min(Math.max(row.total_minutes, 1), MAX_MINUTES);
      await this.platinum.achieve(row.id, date, minutes, null);
    }
  }

  /** The catalog game of a Steam game (imported into the local catalog), if any. */
  private async catalogGame(externalId: string | undefined): Promise<Game | null> {
    if (!externalId) {
      return null;
    }
    try {
      return await this.importer.importGame(CatalogProvider.Igdb, externalId);
    } catch (error) {
      if (error instanceof CatalogGameNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Adds a Steam game to the library (or links the same catalog game already
   * there on PC). Games outside the catalog become manual games with Steam's
   * cover. Returns the UserGame id, or null when it can't be linked.
   */
  private async importGame(
    userId: string,
    pcId: string,
    game: SteamOwnedGame,
    catalogGame: Game | null,
  ): Promise<string | null> {
    if (catalogGame) {
      const existing = await this.userGames.findOneBy({
        userId,
        gameId: catalogGame.id,
        platformId: pcId,
      });
      if (existing) {
        if (existing.steamAppId !== null) {
          // Another Steam app (e.g. another edition) already syncs this game.
          return null;
        }
        // Linked: its playthroughs, notes and rating stay; its time is kept as
        // the user's own on top of Steam's.
        await this.dataSource.transaction(async (manager) => {
          await manager
            .getRepository(UserGame)
            .update({ id: existing.id }, { steamAppId: game.appId });
          await manager
            .getRepository(Playthrough)
            .update({ userGameId: existing.id, number: 1 }, { steamMinutes: game.minutes });
        });
        return existing.id;
      }
    }

    const coverAssetKey = catalogGame ? null : await this.storeSteamCover(game.appId);
    try {
      return await this.dataSource.transaction(async (manager) => {
        let gameId = catalogGame?.id;
        if (!gameId) {
          const games = manager.getRepository(Game);
          gameId = (
            await games.save(
              games.create({
                name: game.name,
                createdByUserId: userId,
                provider: null,
                externalId: null,
                coverAssetKey,
              }),
            )
          ).id;
        }
        const userGames = manager.getRepository(UserGame);
        const userGame = await userGames.save(
          userGames.create({
            userId,
            gameId,
            platformId: pcId,
            steamAppId: game.appId,
            steamImported: true,
          }),
        );
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Playthrough);
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Platinum);
        await manager.getRepository(Playthrough).insert({
          userGameId: userGame.id,
          number: 1,
          status: PlayStatus.Played,
          steamMinutes: game.minutes,
        });
        return userGame.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  private async storeSteamCover(appId: number): Promise<string | null> {
    try {
      const image = await this.steam.fetchCover(appId);
      return image ? await this.importer.storeCoverImage(image, `steam:${appId}`) : null;
    } catch (error) {
      this.logger.warn(`Steam cover of app ${appId} failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Updates a game's Steam achievements: texts, icons and order always; the
   * checkmark only for achievements newly unlocked on Steam, so the user's own
   * changes are never undone.
   */
  private async syncAchievements(
    steamId: string,
    userGameId: string,
    appId: number,
  ): Promise<number> {
    const player = await this.steam.getPlayerAchievements(steamId, appId);
    if (!player || player.length === 0) {
      return 0;
    }
    const [english, spanish] = await Promise.all([
      this.schema(appId, 'english'),
      this.schema(appId, 'latam'),
    ]);
    if (english.length === 0) {
      return 0;
    }
    const playerByName = new Map(player.map((a) => [a.apiName, a]));
    const spanishByName = new Map(spanish.map((a) => [a.apiName, a]));
    const existing = new Map(
      (await this.achievements.find({ where: { userGameId, steamApiName: Not(IsNull()) } })).map(
        (a) => [a.steamApiName!, a],
      ),
    );
    const now = new Date();
    const inserts: Partial<Achievement>[] = [];
    /** Unlocked on Steam since the last sync (and not checked by hand before). */
    let unlockedNow = 0;
    for (const [position, item] of english.entries()) {
      const state = playerByName.get(item.apiName);
      const unlocked = state?.achieved ?? false;
      const es = spanishByName.get(item.apiName);
      const texts = {
        name: item.name,
        description: item.description,
        nameEs: es?.name ?? null,
        descriptionEs: es?.description ?? null,
        iconUrl: item.iconUrl,
        iconLockedUrl: item.iconLockedUrl,
        hidden: item.hidden,
        position,
      };
      const current = existing.get(item.apiName);
      if (!current) {
        inserts.push({
          userGameId,
          steamApiName: item.apiName,
          ...texts,
          achieved: unlocked,
          achievedAt: unlocked ? (state?.unlockedAt ?? now) : null,
          steamAchieved: unlocked,
        });
        continue;
      }
      const newlyUnlocked = unlocked && !current.steamAchieved;
      if (newlyUnlocked && !current.achieved) {
        unlockedNow++;
      }
      await this.achievements.update(
        { id: current.id },
        {
          ...texts,
          steamAchieved: unlocked,
          ...(newlyUnlocked && { achieved: true, achievedAt: state?.unlockedAt ?? now }),
        },
      );
    }
    if (inserts.length) {
      await this.achievements.insert(inserts);
    }
    return unlockedNow;
  }

  private async schema(appId: number, language: SteamLanguage) {
    const key = `${appId}:${language}`;
    let schema = this.schemas.get(key);
    if (!schema) {
      schema = await this.steam.getAchievementSchema(appId, language);
      this.schemas.set(key, schema);
    }
    return schema;
  }

  private callbackUrl(state: string): string {
    return `${this.origin}/api/steam/callback?state=${encodeURIComponent(state)}`;
  }

  private isRunning(account: SteamAccount, now: Date): boolean {
    return (
      account.syncStatus === SteamSyncStatus.Syncing &&
      account.syncStartedAt !== null &&
      now.getTime() - account.syncStartedAt.getTime() < STEAM_SYNC_STALE_MS
    );
  }

  private toAccountDto(
    account: SteamAccount,
    importedGames: number,
    pendingGames: number,
  ): SteamAccountDto {
    return {
      personaName: account.personaName,
      linkedAt: account.linkedAt.toISOString(),
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      syncing: this.isRunning(account, new Date()),
      syncError: account.syncStatus === SteamSyncStatus.Failed ? account.syncError : null,
      progress: { done: account.syncDone, total: account.syncTotal },
      importedGames,
      pendingGames,
    };
  }
}

/** Runs `task` over `items` with at most `limit` at the same time. */
async function runConcurrently<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      await task(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
