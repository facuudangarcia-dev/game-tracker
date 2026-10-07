import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ASSET_STORAGE, type AssetStorage, type StoredAsset } from '../assets/asset-storage';
import { apiError } from '../common/api-error';
import { User } from '../users/user.entity';
import type { AvatarPreset } from './avatar-presets';

export interface PlayerStatsDto {
  /** UserGames ("Mis juegos" entries; one per game and platform). */
  totalGames: number;
  completed: number;
  inProgress: number;
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
      pending: totals.pending,
      platinums: totals.platinums,
      totalMinutes: totals.total_minutes,
      rated: totals.rated,
      averageRating: totals.average_rating === null ? null : Number(totals.average_rating),
      playthroughs,
      topPlatform: top ? { name: top.name, shortName: top.short_name, games: top.games } : null,
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
