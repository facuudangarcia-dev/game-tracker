import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { isUniqueViolation } from '../database/postgres-errors';
import { type PublicUserDto, toPublicUser } from '../users/user-response.dto';
import { ProfileVisibility, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Friendship, FriendshipStatus } from './friendship.entity';
import { SocialErrorCode, USER_SEARCH_LIMIT, USER_SEARCH_MIN_LENGTH } from './social.constants';
import { UserBlock } from './user-block.entity';

/** How the current user relates to another one. */
export type Relation = 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

export interface UserSearchResultDto extends PublicUserDto {
  relation: Relation;
}

export interface FriendDto extends PublicUserDto {
  /** When the friendship (or the request) started. */
  since: string;
}

export interface FriendsDto {
  friends: FriendDto[];
  /** Requests other users sent me. */
  incoming: FriendDto[];
  /** Requests I sent. */
  outgoing: FriendDto[];
}

/** Result of reading another user's profile: who they are and how we relate. */
export interface VisibleOwner {
  user: User;
  /** The viewer is the owner. */
  self: boolean;
}

/**
 * Friends, requests, blocks and visibility (decision #84). Other users are
 * always referred to by username. A block hides each user from the other: for
 * the blocked one the blocker simply "doesn't exist" (404 USER_NOT_FOUND).
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    @InjectRepository(Friendship) private readonly friendships: Repository<Friendship>,
    @InjectRepository(UserBlock) private readonly blocks: Repository<UserBlock>,
  ) {}

  /** Users whose username contains `query` (3+ characters), except blocked ones. */
  async search(viewer: User, query: string): Promise<UserSearchResultDto[]> {
    const text = query.trim();
    if (text.length < USER_SEARCH_MIN_LENGTH) {
      return [];
    }
    const pattern = `%${text.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows: (Pick<User, 'id' | 'username' | 'avatarAssetKey' | 'avatarPreset'> & {
      starts: boolean;
    })[] = await this.dataSource.query(
      `SELECT u.id, u.username, u.avatar_asset_key AS "avatarAssetKey",
              u.avatar_preset AS "avatarPreset",
              lower(u.username) LIKE $3 AS starts
       FROM users u
       WHERE u.id <> $1 AND u.email_verified
         AND lower(u.username) LIKE $2
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1))
       ORDER BY starts DESC, lower(u.username)
       LIMIT ${USER_SEARCH_LIMIT}`,
      [viewer.id, pattern, `${pattern.slice(1)}`],
    );
    const relations = await this.relations(
      viewer.id,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...toPublicUser(row),
      relation: relations.get(row.id) ?? 'NONE',
    }));
  }

  async friends(viewer: User): Promise<FriendsDto> {
    const rows = await this.friendships.find({
      where: [{ requesterId: viewer.id }, { addresseeId: viewer.id }],
      relations: { requester: true, addressee: true },
    });
    const result: FriendsDto = { friends: [], incoming: [], outgoing: [] };
    for (const row of rows) {
      const other = row.requesterId === viewer.id ? row.addressee : row.requester;
      const item = {
        ...toPublicUser(other),
        since: (row.acceptedAt ?? row.createdAt).toISOString(),
      };
      if (row.status === FriendshipStatus.Accepted) {
        result.friends.push(item);
      } else if (row.addresseeId === viewer.id) {
        result.incoming.push(item);
      } else {
        result.outgoing.push(item);
      }
    }
    const byName = (a: FriendDto, b: FriendDto) =>
      a.username.toLowerCase().localeCompare(b.username.toLowerCase());
    result.friends.sort(byName);
    result.incoming.sort((a, b) => b.since.localeCompare(a.since));
    result.outgoing.sort((a, b) => b.since.localeCompare(a.since));
    return result;
  }

  /**
   * Sends a friend request. If the other user had already sent me one, this
   * accepts it instead (both want to be friends).
   */
  async sendRequest(viewer: User, username: string): Promise<Relation> {
    const other = await this.findReachable(viewer, username);
    if (other.id === viewer.id) {
      throw apiError(HttpStatus.BAD_REQUEST, SocialErrorCode.CannotAddSelf, 'Cannot add yourself');
    }
    const existing = await this.pairOf(viewer.id, other.id);
    if (existing?.status === FriendshipStatus.Accepted) {
      return 'FRIEND';
    }
    if (existing) {
      if (existing.addresseeId === viewer.id) {
        await this.accept(existing);
        return 'FRIEND';
      }
      return 'REQUEST_SENT';
    }
    try {
      await this.friendships.insert({
        requesterId: viewer.id,
        addresseeId: other.id,
        status: FriendshipStatus.Pending,
      });
    } catch (error) {
      // The other user sent one at the same moment: the pair already exists.
      if (isUniqueViolation(error)) {
        return this.sendRequest(viewer, username);
      }
      throw error;
    }
    return 'REQUEST_SENT';
  }

  /** Accepts a request the other user sent me. */
  async acceptRequest(viewer: User, username: string): Promise<void> {
    const other = await this.findReachable(viewer, username);
    const existing = await this.pairOf(viewer.id, other.id);
    if (
      !existing ||
      existing.status !== FriendshipStatus.Pending ||
      existing.addresseeId !== viewer.id
    ) {
      throw requestNotFound();
    }
    await this.accept(existing);
  }

  /** Declines a request I received or cancels one I sent. */
  async removeRequest(viewer: User, username: string): Promise<void> {
    const other = await this.findReachable(viewer, username);
    const existing = await this.pairOf(viewer.id, other.id);
    if (!existing || existing.status !== FriendshipStatus.Pending) {
      throw requestNotFound();
    }
    await this.friendships.delete({ id: existing.id });
  }

  async unfriend(viewer: User, username: string): Promise<void> {
    const other = await this.findReachable(viewer, username);
    const existing = await this.pairOf(viewer.id, other.id);
    if (existing?.status !== FriendshipStatus.Accepted) {
      throw apiError(HttpStatus.NOT_FOUND, SocialErrorCode.NotFriends, 'You are not friends');
    }
    await this.friendships.delete({ id: existing.id });
  }

  async blocked(viewer: User): Promise<PublicUserDto[]> {
    const rows = await this.blocks.find({
      where: { blockerId: viewer.id },
      relations: { blocked: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => toPublicUser(row.blocked));
  }

  /** Blocks a user: ends the friendship and any request between both. */
  async block(viewer: User, username: string): Promise<void> {
    const other = await this.users.findByUsername(username);
    if (!other || !other.emailVerified || (await this.blockedBy(viewer.id, other.id))) {
      throw userNotFound();
    }
    if (other.id === viewer.id) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        SocialErrorCode.CannotBlockSelf,
        'Cannot block yourself',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(UserBlock)
        .upsert({ blockerId: viewer.id, blockedId: other.id }, ['blockerId', 'blockedId']);
      await manager
        .createQueryBuilder()
        .delete()
        .from(Friendship)
        .where(
          '(requester_id = :a AND addressee_id = :b) OR (requester_id = :b AND addressee_id = :a)',
          { a: viewer.id, b: other.id },
        )
        .execute();
    });
  }

  async unblock(viewer: User, username: string): Promise<void> {
    const other = await this.users.findByUsername(username);
    const result = other
      ? await this.blocks.delete({ blockerId: viewer.id, blockedId: other.id })
      : null;
    if (!result?.affected) {
      throw apiError(HttpStatus.NOT_FOUND, SocialErrorCode.NotBlocked, 'User not blocked');
    }
  }

  async setVisibility(viewer: User, visibility: ProfileVisibility): Promise<void> {
    await this.dataSource
      .getRepository(User)
      .update({ id: viewer.id }, { profileVisibility: visibility });
  }

  /**
   * The owner of a profile the viewer may see (decision #84): themselves, or a
   * friend whose profile is visible to friends. Otherwise 404 USER_NOT_FOUND
   * (not a friend, blocked, doesn't exist) or 403 PROFILE_PRIVATE (a friend
   * who chose "Solo yo").
   */
  async visibleOwner(viewer: User, username: string): Promise<VisibleOwner> {
    if (viewer.username.toLowerCase() === username.trim().toLowerCase()) {
      return { user: viewer, self: true };
    }
    const other = await this.findReachable(viewer, username);
    const pair = await this.pairOf(viewer.id, other.id);
    if (pair?.status !== FriendshipStatus.Accepted) {
      throw userNotFound();
    }
    if (other.profileVisibility !== ProfileVisibility.Friends) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        SocialErrorCode.ProfilePrivate,
        'This profile is private',
      );
    }
    return { user: other, self: false };
  }

  /** Ids of the friends whose profile and activity the viewer may see. */
  async visibleFriendIds(viewerId: string): Promise<string[]> {
    const rows: { id: string }[] = await this.dataSource.query(
      `SELECT u.id FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1)
         AND f.status = 'ACCEPTED' AND u.profile_visibility = 'FRIENDS'`,
      [viewerId],
    );
    return rows.map((row) => row.id);
  }

  /** Another user whose avatar the viewer may load (anyone who isn't blocked). */
  async avatarOwner(viewer: User, username: string): Promise<User> {
    return this.findReachable(viewer, username);
  }

  /** A verified user that hasn't blocked the viewer nor was blocked by them. */
  private async findReachable(viewer: User, username: string): Promise<User> {
    const other = await this.users.findByUsername(username);
    if (!other || !other.emailVerified) {
      throw userNotFound();
    }
    if (other.id !== viewer.id && (await this.blockedEitherWay(viewer.id, other.id))) {
      throw userNotFound();
    }
    return other;
  }

  private async blockedEitherWay(a: string, b: string): Promise<boolean> {
    return this.blocks.exists({
      where: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
  }

  /** `other` blocked `viewer`. */
  private blockedBy(viewerId: string, otherId: string): Promise<boolean> {
    return this.blocks.existsBy({ blockerId: otherId, blockedId: viewerId });
  }

  private pairOf(a: string, b: string): Promise<Friendship | null> {
    return this.friendships.findOne({
      where: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    });
  }

  private async accept(friendship: Friendship): Promise<void> {
    await this.friendships.update(
      { id: friendship.id },
      { status: FriendshipStatus.Accepted, acceptedAt: new Date() },
    );
  }

  private async relations(viewerId: string, otherIds: string[]): Promise<Map<string, Relation>> {
    if (otherIds.length === 0) {
      return new Map();
    }
    const rows = await this.friendships
      .createQueryBuilder('f')
      .where(
        '(f.requester_id = :me AND f.addressee_id IN (:...ids)) OR (f.addressee_id = :me AND f.requester_id IN (:...ids))',
        { me: viewerId, ids: otherIds },
      )
      .getMany();
    return new Map(
      rows.map((row) => {
        const otherId = row.requesterId === viewerId ? row.addresseeId : row.requesterId;
        const relation: Relation =
          row.status === FriendshipStatus.Accepted
            ? 'FRIEND'
            : row.requesterId === viewerId
              ? 'REQUEST_SENT'
              : 'REQUEST_RECEIVED';
        return [otherId, relation];
      }),
    );
  }
}

function userNotFound() {
  return apiError(HttpStatus.NOT_FOUND, SocialErrorCode.UserNotFound, 'User not found');
}

function requestNotFound() {
  return apiError(
    HttpStatus.NOT_FOUND,
    SocialErrorCode.RequestNotFound,
    'Friend request not found',
  );
}
