import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { CatalogGameNotFoundError, CatalogImportService } from '../catalog/catalog-import.service';
import { CatalogUnavailableError } from '../catalog/game-catalog-provider';
import { apiError } from '../common/api-error';
import { escapeLikePattern, isUniqueViolation } from '../database/postgres-errors';
import { isPlatformAllowedForGame } from '../games/game-rules';
import { Game } from '../games/game.entity';
import { SteamExcludedApp } from '../steam/steam-excluded-app.entity';
import { AchievementsService } from './achievements.service';
import { PlaythroughTimeAdjustment } from './playthrough-time-adjustment.entity';
import { GamesService } from '../games/games.service';
import { Platform } from '../platforms/platform.entity';
import type { CreateUserGameDto } from './dto/create-user-game.dto';
import type { ListLibraryQueryDto } from './dto/list-library.dto';
import { sortLibrary } from './library-sort';
import type { UpdateUserGameDto } from './dto/update-user-game.dto';
import {
  toGameDetails,
  type PlayedDifficultyDto,
  toListItem,
  toPlaythroughDto,
  type UserGameDetailsDto,
  type UserGameListItemDto,
} from './dto/user-game-response.dto';
import { FAVORITES_MAX, LibraryErrorCode, PlayStatus } from './library.constants';
import { PlaythroughTime, UserGameSummary } from './library-views.entity';
import { Playthrough } from './playthrough.entity';
import { DifficultiesService } from './difficulties.service';
import { toPlatinumDto } from './platinum.service';
import { PlaytimeService } from './playtime.service';
import { Difficulty, DifficultyKind } from './difficulty.entity';
import { assertValidPlaythroughDates } from './playthrough-rules';
import { UserGameAccess, userGameNotFound } from './user-game-access.service';
import { UserGame } from './user-game.entity';
import { ActivityType } from '../activity/activity.entity';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class LibraryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserGame) private readonly userGames: Repository<UserGame>,
    @InjectRepository(UserGameSummary) private readonly summaries: Repository<UserGameSummary>,
    @InjectRepository(PlaythroughTime)
    private readonly playthroughTimes: Repository<PlaythroughTime>,
    @InjectRepository(Platform) private readonly platforms: Repository<Platform>,
    private readonly games: GamesService,
    private readonly importer: CatalogImportService,
    private readonly access: UserGameAccess,
    private readonly difficulties: DifficultiesService,
    private readonly playtime: PlaytimeService,
    private readonly achievementsService: AchievementsService,
    @InjectRepository(SteamExcludedApp)
    private readonly steamExcluded: Repository<SteamExcludedApp>,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Adds a game on a platform to the user's library, creating playthrough #1.
   * Catalog games are imported here if needed (docs/decisions.md #14).
   */
  async create(userId: string, dto: CreateUserGameDto): Promise<UserGameDetailsDto> {
    const sources = [dto.gameId, dto.catalog, dto.manualGame].filter((s) => s !== undefined);
    if (sources.length !== 1) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        LibraryErrorCode.InvalidGameSource,
        'Exactly one of gameId, catalog or manualGame is required',
      );
    }

    // Initial settings of playthrough #1 are validated before importing anything.
    const initial = {
      status: dto.initialPlaythrough?.status ?? PlayStatus.Pending,
      startDate: dto.initialPlaythrough?.startDate ?? null,
      completionDate: dto.initialPlaythrough?.completionDate ?? null,
    };
    assertValidPlaythroughDates(initial);

    const platform = await this.platforms.findOneBy({ id: dto.platformId });
    if (!platform) {
      throw apiError(HttpStatus.BAD_REQUEST, LibraryErrorCode.PlatformNotFound, 'Unknown platform');
    }

    const existingGame = dto.manualGame ? null : await this.resolveGame(userId, dto);
    if (existingGame && !isPlatformAllowedForGame(existingGame, platform.id)) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        LibraryErrorCode.PlatformNotAvailable,
        'The game is not available on this platform',
      );
    }

    let userGameId: string;
    try {
      userGameId = await this.dataSource.transaction(async (manager) => {
        let gameId = existingGame?.id;
        if (dto.manualGame) {
          const gameRepository = manager.getRepository(Game);
          const manualGame = await gameRepository.save(
            gameRepository.create({
              name: dto.manualGame.name,
              createdByUserId: userId,
              provider: null,
              externalId: null,
            }),
          );
          gameId = manualGame.id;
        }

        const userGame = await manager.getRepository(UserGame).save(
          manager.getRepository(UserGame).create({
            userId,
            gameId,
            platformId: platform.id,
            rating: dto.rating ?? null,
          }),
        );
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Playthrough);
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Platinum);
        const difficultyName = dto.initialPlaythrough?.difficulty;
        const difficulty = difficultyName
          ? await manager.getRepository(Difficulty).findOneByOrFail({
              userGameId: userGame.id,
              kind: DifficultyKind.Playthrough,
              name: difficultyName,
            })
          : null;
        // Every UserGame starts with playthrough #1 (no time yet), with the
        // settings chosen when adding the game (pending by default).
        const previousTimeMinutes = dto.initialPlaythrough?.previousMinutes ?? 0;
        const { identifiers } = await manager.getRepository(Playthrough).insert({
          userGameId: userGame.id,
          number: 1,
          ...initial,
          difficultyId: difficulty?.id ?? null,
          previousTimeMinutes,
        });
        if (previousTimeMinutes !== 0) {
          await manager.getRepository(PlaythroughTimeAdjustment).insert({
            playthroughId: (identifiers[0] as { id: string }).id,
            deltaMinutes: previousTimeMinutes,
          });
        }
        return userGame.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw apiError(
          HttpStatus.CONFLICT,
          LibraryErrorCode.UserGameAlreadyExists,
          'This game is already in the library on this platform',
        );
      }
      throw error;
    }

    await this.activity.record(userId, ActivityType.GameAdded, {
      userGameId,
      data: { status: initial.status },
    });
    return this.get(userId, userGameId);
  }

  /** The user's library, filtered in SQL and sorted with explicit null handling. */
  async list(userId: string, query: ListLibraryQueryDto = {}): Promise<UserGameListItemDto[]> {
    const qb = this.userGames
      .createQueryBuilder('ug')
      .innerJoinAndSelect('ug.game', 'game')
      .innerJoinAndSelect('ug.platform', 'platform')
      .where('ug.user_id = :userId', { userId });

    if (query.search) {
      qb.andWhere('game.name ILIKE :search', { search: `%${escapeLikePattern(query.search)}%` });
    }
    if (query.platformId) {
      qb.andWhere('ug.platform_id = :platformId', { platformId: query.platformId });
    }
    if (query.platinum !== undefined) {
      qb.andWhere('ug.platinum_achieved = :platinum', { platinum: query.platinum });
    }
    if (query.genreId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM game_genres gg WHERE gg.game_id = game.id AND gg.genre_id = :genreId)',
        { genreId: query.genreId },
      );
    }
    if (query.status) {
      // The status is derived from the playthroughs (view), never stored.
      qb.andWhere(
        'EXISTS (SELECT 1 FROM user_game_summaries s WHERE s.user_game_id = ug.id AND s.status = :status)',
        { status: query.status },
      );
    }

    const userGames = await qb.getMany();
    const ids = userGames.map((ug) => ug.id);
    const [summaries, difficulties, achievements] = await Promise.all([
      this.summariesFor(ids),
      this.playedDifficultiesFor(ids),
      this.achievementCountsFor(ids),
    ]);
    const items = userGames.map((userGame) =>
      toListItem(userGame, summaries.get(userGame.id)!, {
        difficulty: difficulties.get(userGame.id) ?? null,
        achievements: achievements.get(userGame.id) ?? null,
      }),
    );
    return sortLibrary(items, query.sort, query.order);
  }

  async get(userId: string, userGameId: string): Promise<UserGameDetailsDto> {
    const userGame = await this.userGames.findOne({
      where: { id: userGameId, userId },
      relations: {
        game: { genres: true },
        platform: true,
        playthroughs: { difficulty: true },
        platinumDifficulty: true,
      },
      order: { playthroughs: { number: 'ASC' } },
    });
    if (!userGame) {
      throw userGameNotFound();
    }

    const [summaries, played, times, difficulties, sessions, achievementList] = await Promise.all([
      this.summariesFor([userGame.id]),
      this.playedDifficultiesFor([userGame.id]),
      this.playthroughTimes.findBy({ userGameId: userGame.id }),
      this.difficulties.listFor(userGame.id),
      this.playtime.listFor(userGame.id),
      this.achievementsService.listFor(userGame.id),
    ]);
    const achieved = achievementList.filter((a) => a.achieved).length;
    const minutesById = new Map(times.map((t) => [t.playthroughId, t.minutes]));

    return {
      ...toListItem(userGame, summaries.get(userGame.id)!, {
        difficulty: played.get(userGame.id) ?? null,
        achievements: achievementList.length ? { achieved, total: achievementList.length } : null,
      }),
      game: toGameDetails(userGame.game),
      notes: userGame.notes,
      platinum: toPlatinumDto(userGame),
      playthroughs: userGame.playthroughs.map((p) =>
        toPlaythroughDto(p, minutesById.get(p.id) ?? 0),
      ),
      sessions,
      difficulties,
      achievementList,
    };
  }

  /** Updates personal data (rating, notes, favorite). Omitted fields stay unchanged. */
  async update(
    userId: string,
    userGameId: string,
    dto: UpdateUserGameDto,
  ): Promise<UserGameDetailsDto> {
    const userGame = await this.access.requireOwned(userId, userGameId);
    const changes: Partial<UserGame> = {};
    if (dto.rating !== undefined) changes.rating = dto.rating;
    if (dto.notes !== undefined) changes.notes = dto.notes;
    // Unmarking always works; marking keeps the date it was first marked.
    if (dto.favorite === false) changes.favoriteAt = null;
    const marking = dto.favorite === true && userGame.favoriteAt === null;

    await this.dataSource.transaction(async (manager) => {
      if (marking) {
        // Serializes concurrent "mark" requests of the same user before counting.
        await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const favorites = await manager.count(UserGame, {
          where: { userId, favoriteAt: Not(IsNull()) },
        });
        if (favorites >= FAVORITES_MAX) {
          throw apiError(
            HttpStatus.CONFLICT,
            LibraryErrorCode.FavoritesLimitReached,
            `At most ${FAVORITES_MAX} favorite games`,
          );
        }
        changes.favoriteAt = new Date();
      }
      if (Object.keys(changes).length > 0) {
        await manager.update(UserGame, { id: userGame.id }, changes);
      }
    });
    if (dto.rating !== undefined && dto.rating !== null && dto.rating !== userGame.rating) {
      await this.activity.record(userId, ActivityType.Rated, {
        userGameId: userGame.id,
        data: { rating: dto.rating },
      });
    }
    if (marking) {
      await this.activity.record(userId, ActivityType.Favorited, { userGameId: userGame.id });
    }
    return this.get(userId, userGame.id);
  }

  /** Deletes the user's record and all its personal data; never the Game or Platform. */
  /**
   * Deletes the game from the library. A Steam game is also excluded from
   * future syncs, so it doesn't come back (decision #78).
   */
  async remove(userId: string, userGameId: string): Promise<void> {
    const userGame = await this.userGames.findOne({
      where: { id: userGameId, userId },
      relations: { game: true },
    });
    if (!userGame) {
      throw userGameNotFound();
    }
    await this.dataSource.transaction(async (manager) => {
      if (userGame.steamAppId !== null) {
        await manager
          .getRepository(SteamExcludedApp)
          .upsert({ userId, appId: userGame.steamAppId, name: userGame.game.name.slice(0, 200) }, [
            'userId',
            'appId',
          ]);
      }
      await manager.getRepository(UserGame).delete({ id: userGameId, userId });
    });
  }

  private async resolveGame(userId: string, dto: CreateUserGameDto): Promise<Game> {
    if (dto.gameId) {
      const game = await this.games.findVisibleById(dto.gameId, userId);
      if (!game) {
        throw gameNotFound();
      }
      return game;
    }

    const { provider, externalId } = dto.catalog!;
    try {
      return await this.importer.importGame(provider, externalId);
    } catch (error) {
      if (error instanceof CatalogGameNotFoundError) {
        throw gameNotFound();
      }
      if (error instanceof CatalogUnavailableError) {
        throw apiError(
          HttpStatus.SERVICE_UNAVAILABLE,
          LibraryErrorCode.CatalogUnavailable,
          'The game catalog is not available right now',
        );
      }
      throw error;
    }
  }

  /**
   * Hardest difficulty among the in-progress, completed or played playthroughs of each
   * game (decision #72), with its place in the game's playthrough list.
   */
  private async playedDifficultiesFor(
    userGameIds: string[],
  ): Promise<Map<string, PlayedDifficultyDto>> {
    if (userGameIds.length === 0) {
      return new Map();
    }
    const rows: { user_game_id: string; name: string; level: number; levels: number }[] =
      await this.dataSource.query(
        `SELECT DISTINCT ON (p.user_game_id) p.user_game_id, d.name, d.level, d.levels
           FROM playthroughs p
           JOIN (SELECT id, name,
                        (row_number() OVER w - 1)::int AS level,
                        (count(*) OVER (PARTITION BY user_game_id))::int AS levels
                   FROM difficulties
                  WHERE kind = 'PLAYTHROUGH' AND user_game_id = ANY($1::uuid[])
                 WINDOW w AS (PARTITION BY user_game_id ORDER BY position, created_at)) d
             ON d.id = p.difficulty_id
          WHERE p.user_game_id = ANY($1::uuid[]) AND p.status IN ('IN_PROGRESS', 'COMPLETED', 'PLAYED')
          ORDER BY p.user_game_id, d.level DESC`,
        [userGameIds],
      );
    return new Map(
      rows.map((row) => [
        row.user_game_id,
        { name: row.name, level: row.level, levels: row.levels },
      ]),
    );
  }

  private async achievementCountsFor(
    userGameIds: string[],
  ): Promise<Map<string, { achieved: number; total: number }>> {
    if (userGameIds.length === 0) {
      return new Map();
    }
    const rows: { user_game_id: string; achieved: number; total: number }[] =
      await this.dataSource.query(
        `SELECT user_game_id,
                count(*) FILTER (WHERE achieved)::int AS achieved,
                count(*)::int AS total
           FROM achievements
          WHERE user_game_id = ANY($1::uuid[])
          GROUP BY user_game_id`,
        [userGameIds],
      );
    return new Map(
      rows.map((row) => [row.user_game_id, { achieved: row.achieved, total: row.total }]),
    );
  }

  private async summariesFor(userGameIds: string[]): Promise<Map<string, UserGameSummary>> {
    if (userGameIds.length === 0) {
      return new Map();
    }
    const rows = await this.summaries.findBy({ userGameId: In(userGameIds) });
    return new Map(rows.map((row) => [row.userGameId, row]));
  }
}

function gameNotFound() {
  return apiError(HttpStatus.NOT_FOUND, LibraryErrorCode.GameNotFound, 'Game not found');
}
