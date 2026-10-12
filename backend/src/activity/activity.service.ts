import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { assetUrl } from '../catalog/catalog-urls';
import { apiError } from '../common/api-error';
import { SocialService } from '../social/social.service';
import { type PublicUserDto, toPublicUser } from '../users/user-response.dto';
import type { User } from '../users/user.entity';
import { Activity, type ActivityData, ActivityType } from './activity.entity';

/** Events of the same kind and game within this window are grouped into one. */
const MERGE_WINDOW_MS = 60 * 60 * 1000;
export const ACTIVITY_PAGE_SIZE = 30;

export interface ActivityGameDto {
  name: string;
  coverUrl: string | null;
  /** The owner's library entry (null if it was removed). */
  userGameId: string | null;
  /** Catalog reference, to open the game's page (null for manual games). */
  provider: string | null;
  externalId: string | null;
}

export interface ActivityItemDto {
  id: string;
  type: ActivityType;
  createdAt: string;
  user: PublicUserDto;
  /** Done by the viewer. */
  self: boolean;
  game: ActivityGameDto | null;
  data: ActivityData;
}

export interface ActivityPageDto {
  items: ActivityItemDto[];
  /** Cursor of the next (older) page, null at the end. */
  next: string | null;
}

export interface RecordInput {
  /** The library entry it's about (its game is looked up). */
  userGameId?: string;
  /** A game outside the library (e.g. the wishlist). */
  gameId?: string;
  data?: ActivityData;
}

interface ActivityRow {
  id: string;
  type: ActivityType;
  created_at: Date;
  user_id: string;
  username: string;
  avatar_asset_key: string | null;
  avatar_preset: string | null;
  user_game_id: string | null;
  game_name: string | null;
  current_name: string | null;
  cover_asset_key: string | null;
  provider: string | null;
  external_id: string | null;
  data: ActivityData;
}

/**
 * Activity of the users (decision #86): recording what they do and reading the
 * feed (the viewer's own plus visible friends') or one player's activity.
 * Recording never breaks the action that triggered it.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    private readonly social: SocialService,
  ) {}

  async record(userId: string, type: ActivityType, input: RecordInput = {}): Promise<void> {
    try {
      await this.save(userId, type, input);
    } catch (error) {
      this.logger.warn(`Activity ${type} not recorded: ${(error as Error).message}`);
    }
  }

  /** The viewer's activity and their visible friends', newest first. */
  async feed(viewer: User, cursor?: string): Promise<ActivityPageDto> {
    const friendIds = await this.social.visibleFriendIds(viewer.id);
    return this.page(viewer, [viewer.id, ...friendIds], cursor);
  }

  /** One player's activity (themselves or a visible friend). */
  async ofPlayer(viewer: User, username: string, cursor?: string): Promise<ActivityPageDto> {
    const { user } = await this.social.visibleOwner(viewer, username);
    return this.page(viewer, [user.id], cursor);
  }

  private async save(userId: string, type: ActivityType, input: RecordInput): Promise<void> {
    let gameId = input.gameId ?? null;
    let gameName: string | null = null;
    if (input.userGameId) {
      const [row]: { game_id: string; name: string }[] = await this.dataSource.query(
        `SELECT g.id AS game_id, g.name FROM user_games ug JOIN games g ON g.id = ug.game_id
         WHERE ug.id = $1`,
        [input.userGameId],
      );
      gameId = row?.game_id ?? null;
      gameName = row?.name ?? null;
    } else if (gameId) {
      const [row]: { name: string }[] = await this.dataSource.query(
        'SELECT name FROM games WHERE id = $1',
        [gameId],
      );
      gameName = row?.name ?? null;
    }
    const data = input.data ?? {};

    // Repeated events on the same game are grouped: more achievements add up,
    // a new rating or status replaces the previous one.
    if (MERGEABLE.has(type) && input.userGameId) {
      const recent = await this.activities.findOne({
        where: {
          userId,
          type,
          userGameId: input.userGameId,
          createdAt: MoreThan(new Date(Date.now() - MERGE_WINDOW_MS)),
        },
        order: { createdAt: 'DESC' },
      });
      if (recent) {
        const merged =
          type === ActivityType.Achievements
            ? { count: (recent.data.count ?? 0) + (data.count ?? 0) }
            : data;
        await this.activities.update({ id: recent.id }, { data: merged, createdAt: new Date() });
        return;
      }
    }
    await this.activities.insert({
      userId,
      type,
      userGameId: input.userGameId ?? null,
      gameId,
      gameName: gameName?.slice(0, 200) ?? null,
      data,
      // Set here (millisecond precision) so page cursors compare exactly.
      createdAt: new Date(),
    });
  }

  private async page(viewer: User, userIds: string[], cursor?: string): Promise<ActivityPageDto> {
    const after = parseCursor(cursor);
    const rows: ActivityRow[] = await this.dataSource.query(
      `SELECT a.id, a.type, a.created_at, a.user_id, u.username,
              u.avatar_asset_key, u.avatar_preset, a.user_game_id, a.game_name,
              g.name AS current_name, g.cover_asset_key, g.provider, g.external_id, a.data
       FROM activities a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN games g ON g.id = a.game_id
       WHERE a.user_id = ANY($1::uuid[])
         ${after ? 'AND (a.created_at, a.id) < ($2::timestamptz, $3::uuid)' : ''}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ${ACTIVITY_PAGE_SIZE + 1}`,
      after ? [userIds, after.createdAt, after.id] : [userIds],
    );
    const items = rows.slice(0, ACTIVITY_PAGE_SIZE).map((row) => this.toDto(viewer, row));
    const last = rows.length > ACTIVITY_PAGE_SIZE ? rows[ACTIVITY_PAGE_SIZE - 1] : null;
    return { items, next: last ? `${last.created_at.toISOString()}_${last.id}` : null };
  }

  private toDto(viewer: User, row: ActivityRow): ActivityItemDto {
    const name = row.current_name ?? row.game_name;
    return {
      id: row.id,
      type: row.type,
      createdAt: row.created_at.toISOString(),
      user: toPublicUser({
        username: row.username,
        avatarAssetKey: row.avatar_asset_key,
        avatarPreset: row.avatar_preset,
      }),
      self: row.user_id === viewer.id,
      game: name
        ? {
            name,
            coverUrl: row.cover_asset_key ? assetUrl(row.cover_asset_key) : null,
            userGameId: row.user_game_id,
            provider: row.provider,
            externalId: row.external_id,
          }
        : null,
      data: row.data,
    };
  }
}

const MERGEABLE = new Set([
  ActivityType.Achievements,
  ActivityType.Rated,
  ActivityType.StatusChanged,
]);

const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function parseCursor(cursor?: string): { createdAt: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  const match = CURSOR_PATTERN.exec(cursor);
  if (!match) {
    throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_CURSOR', 'Invalid cursor');
  }
  return { createdAt: match[1], id: match[2] };
}
