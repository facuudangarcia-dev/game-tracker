import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Game } from '../games/game.entity';
import { Platform } from '../platforms/platform.entity';
import { User } from '../users/user.entity';
import { Playthrough } from './playthrough.entity';

/**
 * A user's personal record of a game on one platform. Status, dates and total
 * time are derived from its playthroughs (see UserGameSummary), never stored.
 */
@Entity({ name: 'user_games' })
@Unique('UQ_user_games_user_game_platform', ['userId', 'gameId', 'platformId'])
export class UserGame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_user_games_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('IDX_user_games_game_id')
  @Column({ name: 'game_id', type: 'uuid' })
  gameId: string;

  /**
   * NO ACTION (checked at statement end) rather than RESTRICT: when a user is
   * deleted, their manual games and user games go away in the same statement.
   */
  @ManyToOne(() => Game, { onDelete: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  @Index('IDX_user_games_platform_id')
  @Column({ name: 'platform_id', type: 'uuid' })
  platformId: string;

  @ManyToOne(() => Platform, { onDelete: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'platform_id' })
  platform: Platform;

  @OneToMany(() => Playthrough, (playthrough) => playthrough.userGame)
  playthroughs: Playthrough[];

  /** "Date added" in the library. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
