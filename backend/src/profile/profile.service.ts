import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage, type StoredAsset } from '../assets/asset-storage';
import { assetUrl } from '../catalog/catalog-urls';
import { apiError } from '../common/api-error';
import { User } from '../users/user.entity';
import type { AvatarPreset } from './avatar-presets';

export interface PlayerStatsDto {
  /** UserGames ("Mis juegos" entries; one per game and platform). */
  totalGames: number;
  completed: number;
  inProgress: number;
  played: number;
  pending: number;
  platinums: number;
  /** Sum of every playthrough's time (decision: playtime = playthrough times). */
  totalMinutes: number;
  rated: number;
  /** Average personal rating (1 decimal), null when nothing is rated. */
  averageRating: number | null;
  playthroughs: number;
  /** Platform with the most games, if any. */
  topPlatform: { name: string; shortName: string; games: number } | null;
}

/** A game of the player's library, as shown in the profile highlights. */
export interface ProfileGameDto {
  userGameId: string;
  name: string;
  coverUrl: string | null;
  platform: { shortName: string };
}

/** Highlights of the player's library for the profile side column (decision #63). */
export interface PlayerHighlightsDto {
  /** Most total time; null when no game has time. */
  mostPlayed: (ProfileGameDto & { minutes: number }) | null;
  /** Completed playthrough with the least time (> 0); null when there is none. */
  fastest:
    | (ProfileGameDto & {
        minutes: number;
        playthroughNumber: number;
        playthroughName: string | null;
      })
    | null;
  highestRated: (ProfileGameDto & { rating: number }) | null;
  /** Null unless at least two games are rated (otherwise it would repeat the highest). */
  lowestRated: (ProfileGameDto & { rating: number }) | null;
  /** In the order they were marked (at most FAVORITES_MAX). */
  favorites: ProfileGameDto[];
}

interface GameRow {
  user_game_id: string;
  name: string;
  cover_asset_key: string | null;
  short_name: string;
}

/** Columns and joins shared by every highlight query. */
const GAME_COLUMNS = 'ug.id AS user_game_id, g.name, g.cover_asset_key, pl.short_name';
const GAME_JOINS = `FROM user_games ug
       JOIN games g ON g.id = ug.game_id
       JOIN platforms pl ON pl.id = ug.platform_id`;

function toProfileGame(row: GameRow): ProfileGameDto {
  return {
    userGameId: row.user_game_id,
    name: row.name,
    coverUrl: row.cover_asset_key ? assetUrl(row.cover_asset_key) : null,
    platform: { shortName: row.short_name },
  };
}

/** Image formats accepted as avatars, recognized by their magic bytes (not the name). */
const SIGNATURES: { type: string; extension: string; matches: (data: Buffer) => boolean }[] = [
  {
    type: 'image/jpeg',
    extension: 'jpg',
    matches: (d) => d.length > 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff,
  },
  {
    type: 'image/png',
    extension: 'png',
    matches: (d) =>
      d.length > 8 &&
      d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: 'image/webp',
    extension: 'webp',
    matches: (d) =>
      d.length > 12 &&
      d.subarray(0, 4).toString('ascii') === 'RIFF' &&
      d.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/** The player's own profile: avatar and statistics (docs/decisions.md #56, #57). */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStorage,
  ) {}

  async setCountry(user: User, country: string | null): Promise<User> {
    const repository = this.dataSource.getRepository(User);
    await repository.update({ id: user.id }, { country });
    return repository.findOneByOrFail({ id: user.id });
  }

  async setPreset(user: User, preset: AvatarPreset): Promise<User> {
    return this.replaceAvatar(user, { avatarPreset: preset, avatarAssetKey: null });
  }

  /** Stores an uploaded image (JPEG, PNG or WebP, checked by content) as the avatar. */
  async setImage(user: User, data: Buffer): Promise<User> {
    const format = SIGNATURES.find((signature) => signature.matches(data));
    if (!format) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        'AVATAR_INVALID_IMAGE',
        'The avatar must be a JPEG, PNG or WebP image',
      );
    }
    // Content-addressed, like covers: identical uploads share one file.
    const key = `avatars/${createHash('sha256').update(data).digest('hex')}.${format.extension}`;
    await this.storage.put(key, data, format.type);
    return this.replaceAvatar(user, { avatarPreset: null, avatarAssetKey: key });
  }

  async remove(user: User): Promise<User> {
    return this.replaceAvatar(user, { avatarPreset: null, avatarAssetKey: null });
  }

  /** The user's uploaded avatar, or null when they have none. */
  async image(user: User): Promise<StoredAsset | null> {
    return user.avatarAssetKey ? this.storage.get(user.avatarAssetKey) : null;
  }

  async stats(userId: string): Promise<PlayerStatsDto> {
    const [totals] = await this.dataSource.query<
      {
        total: number;
        completed: number;
        in_progress: number;
        played: number;
        pending: number;
        platinums: number;
        total_minutes: number;
        rated: number;
        average_rating: string | null;
      }[]
    >(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE s.status = 'COMPLETED')::int AS completed,
              count(*) FILTER (WHERE s.status = 'IN_PROGRESS')::int AS in_progress,
              count(*) FILTER (WHERE s.status = 'PLAYED')::int AS played,
              count(*) FILTER (WHERE s.status = 'PENDING')::int AS pending,
              count(*) FILTER (WHERE ug.platinum_achieved)::int AS platinums,
              COALESCE(sum(s.total_minutes), 0)::int AS total_minutes,
              count(ug.rating)::int AS rated,
              round(avg(ug.rating), 1)::text AS average_rating
       FROM user_games ug
       JOIN user_game_summaries s ON s.user_game_id = ug.id
       WHERE ug.user_id = $1`,
      [userId],
    );
    const [{ playthroughs }] = await this.dataSource.query<{ playthroughs: number }[]>(
      `SELECT count(*)::int AS playthroughs
       FROM playthroughs p JOIN user_games ug ON ug.id = p.user_game_id
       WHERE ug.user_id = $1`,
      [userId],
    );
    const [top] = await this.dataSource.query<
      { name: string; short_name: string; games: number }[]
    >(
      `SELECT pl.name, pl.short_name, count(*)::int AS games
       FROM user_games ug JOIN platforms pl ON pl.id = ug.platform_id
       WHERE ug.user_id = $1
       GROUP BY pl.id, pl.name, pl.short_name, pl.sort_order
       ORDER BY games DESC, pl.sort_order ASC
       LIMIT 1`,
      [userId],
    );

    return {
      totalGames: totals.total,
      completed: totals.completed,
      inProgress: totals.in_progress,
      played: totals.played,
      pending: totals.pending,
      platinums: totals.platinums,
      totalMinutes: totals.total_minutes,
      rated: totals.rated,
      averageRating: totals.average_rating === null ? null : Number(totals.average_rating),
      playthroughs,
      topPlatform: top ? { name: top.name, shortName: top.short_name, games: top.games } : null,
    };
  }

  async highlights(userId: string): Promise<PlayerHighlightsDto> {
    const one = async <T extends GameRow>(sql: string): Promise<T | null> =>
      (await this.dataSource.query<T[]>(sql, [userId]))[0] ?? null;

    // Ties are broken by name so the result is stable.
    const [mostPlayed, fastest, highest, lowest, favorites] = await Promise.all([
      one<GameRow & { minutes: number }>(
        `SELECT ${GAME_COLUMNS}, s.total_minutes::int AS minutes ${GAME_JOINS}
         JOIN user_game_summaries s ON s.user_game_id = ug.id
         WHERE ug.user_id = $1 AND s.total_minutes > 0
         ORDER BY s.total_minutes DESC, g.name ASC LIMIT 1`,
      ),
      one<GameRow & { minutes: number; number: number; playthrough_name: string | null }>(
        `SELECT ${GAME_COLUMNS}, t.minutes::int AS minutes, p.number, p.name AS playthrough_name
         ${GAME_JOINS}
         JOIN playthroughs p ON p.user_game_id = ug.id
         JOIN playthrough_times t ON t.playthrough_id = p.id
         WHERE ug.user_id = $1 AND p.status = 'COMPLETED' AND t.minutes > 0
         ORDER BY t.minutes ASC, g.name ASC, p.number ASC LIMIT 1`,
      ),
      one<GameRow & { rating: number }>(
        `SELECT ${GAME_COLUMNS}, ug.rating ${GAME_JOINS}
         WHERE ug.user_id = $1 AND ug.rating IS NOT NULL
         ORDER BY ug.rating DESC, g.name ASC LIMIT 1`,
      ),
      one<GameRow & { rating: number }>(
        `SELECT ${GAME_COLUMNS}, ug.rating ${GAME_JOINS}
         WHERE ug.user_id = $1 AND ug.rating IS NOT NULL
         ORDER BY ug.rating ASC, g.name ASC LIMIT 1`,
      ),
      this.dataSource.query<GameRow[]>(
        `SELECT ${GAME_COLUMNS} ${GAME_JOINS}
         WHERE ug.user_id = $1 AND ug.favorite_at IS NOT NULL
         ORDER BY ug.favorite_at ASC`,
        [userId],
      ),
    ]);

    return {
      mostPlayed: mostPlayed && { ...toProfileGame(mostPlayed), minutes: mostPlayed.minutes },
      fastest: fastest && {
        ...toProfileGame(fastest),
        minutes: fastest.minutes,
        playthroughNumber: fastest.number,
        playthroughName: fastest.playthrough_name,
      },
      highestRated: highest && { ...toProfileGame(highest), rating: highest.rating },
      lowestRated:
        lowest && highest && lowest.user_game_id !== highest.user_game_id
          ? { ...toProfileGame(lowest), rating: lowest.rating }
          : null,
      favorites: favorites.map(toProfileGame),
    };
  }

  /** Saves the new avatar and deletes the previous image if nobody uses it anymore. */
  private async replaceAvatar(
    user: User,
    avatar: Pick<User, 'avatarPreset' | 'avatarAssetKey'>,
  ): Promise<User> {
    const previousKey = user.avatarAssetKey;
    const repository = this.dataSource.getRepository(User);
    await repository.update({ id: user.id }, avatar);
    if (previousKey && previousKey !== avatar.avatarAssetKey) {
      const stillUsed = await repository.existsBy({ avatarAssetKey: previousKey });
      if (!stillUsed) {
        await this.storage.delete(previousKey).catch(() => {
          this.logger.warn('Previous avatar image could not be deleted');
        });
      }
    }
    return repository.findOneByOrFail({ id: user.id });
  }
}
