import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Game } from '../games/game.entity';
import { UserGame } from '../library/user-game.entity';
import { User } from '../users/user.entity';

/** What happened (decision #86). */
export enum ActivityType {
  /** Added a game to the library. data: { status } */
  GameAdded = 'GAME_ADDED',
  /** A playthrough became in progress, completed or played. data: { status } */
  StatusChanged = 'STATUS_CHANGED',
  Platinum = 'PLATINUM',
  /** Unlocked achievements (grouped per game). data: { count } */
  Achievements = 'ACHIEVEMENTS',
  /** data: { rating } */
  Rated = 'RATED',
  Favorited = 'FAVORITED',
  Wishlisted = 'WISHLISTED',
  /** Games added from Steam at once. data: { count } */
  SteamImport = 'STEAM_IMPORT',
}

export interface ActivityData {
  status?: string;
  rating?: number;
  count?: number;
}

/**
 * Something a user did, shown in their activity and their friends' (decision
 * #86). The game's name is kept, so the event still reads well if the game
 * leaves the library.
 */
@Entity({ name: 'activities' })
@Index('IDX_activities_user_created', ['userId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ActivityType, enumName: 'activity_type' })
  type: ActivityType;

  @Column({ name: 'user_game_id', type: 'uuid', nullable: true })
  userGameId: string | null;

  @ManyToOne(() => UserGame, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_game_id' })
  userGame: UserGame | null;

  @Column({ name: 'game_id', type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'game_id' })
  game: Game | null;

  @Column({ name: 'game_name', type: 'varchar', length: 200, nullable: true })
  gameName: string | null;

  @Column({ type: 'jsonb', default: {} })
  data: ActivityData;

  /** When it happened; grouped events move to their last occurrence. */
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
