import {
  Check,
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
import { Difficulty } from './difficulty.entity';
import { MAX_MINUTES, NOTE_MAX_LENGTH, RATING_MAX, RATING_MIN } from './library.constants';
import { Playthrough } from './playthrough.entity';

/**
 * A user's personal record of a game on one platform. Status, dates and total
 * time are derived from its playthroughs (see UserGameSummary), never stored.
 */
@Entity({ name: 'user_games' })
@Unique('UQ_user_games_user_game_platform', ['userId', 'gameId', 'platformId'])
// A Steam game is linked to at most one of the user's games (decision #78).
@Index('UQ_user_games_user_steam_app', ['userId', 'steamAppId'], {
  unique: true,
  where: '"steam_app_id" IS NOT NULL',
})
@Check(
  'CHK_user_games_rating_range',
  `"rating" IS NULL OR ("rating" >= ${RATING_MIN} AND "rating" <= ${RATING_MAX})`,
)
@Check('CHK_user_games_notes_length', `char_length("notes") <= ${NOTE_MAX_LENGTH}`)
@Check('CHK_user_games_steam_imported', `NOT "steam_imported" OR "steam_app_id" IS NOT NULL`)
// Platinum data only exists when achieved; then date and time are required.
@Check(
  'CHK_user_games_platinum_fields',
  `(NOT "platinum_achieved" AND "platinum_date" IS NULL AND "platinum_time_minutes" IS NULL AND "platinum_difficulty_id" IS NULL)
   OR ("platinum_achieved" AND "platinum_date" IS NOT NULL AND "platinum_time_minutes" IS NOT NULL)`,
)
@Check(
  'CHK_user_games_platinum_time_range',
  `"platinum_time_minutes" IS NULL OR ("platinum_time_minutes" >= 1 AND "platinum_time_minutes" <= ${MAX_MINUTES})`,
)
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

  /**
   * Steam app this game is synced with (decision #78): its hours and
   * achievements come from Steam. Kept after unlinking Steam.
   */
  @Column({ name: 'steam_app_id', type: 'int', nullable: true })
  steamAppId: number | null;

  /**
   * Added to the library by Steam's import (not a game the user already had on
   * PC and Steam only linked): unlinking Steam can delete these.
   */
  @Column({ name: 'steam_imported', type: 'boolean', default: false })
  steamImported: boolean;

  /**
   * Every Steam achievement was unlocked on Steam at the last check (decision
   * #81): the platinum is added automatically only when this turns true.
   */
  @Column({ name: 'steam_all_achieved', type: 'boolean', default: false })
  steamAllAchieved: boolean;

  /** Personal rating, integer 10-100; null means not rated. */
  @Column({ type: 'smallint', nullable: true })
  rating: number | null;

  /** General note about the game (plain text). */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** When the game was marked as a favorite (null = not a favorite). Orders the favorites. */
  @Column({ name: 'favorite_at', type: 'timestamptz', nullable: true })
  favoriteAt: Date | null;

  /** Platinum is independent of the status (decision #19 of the spec). */
  @Column({ name: 'platinum_achieved', type: 'boolean', default: false })
  platinumAchieved: boolean;

  @Column({ name: 'platinum_date', type: 'date', nullable: true })
  platinumDate: string | null;

  /** Entered manually; never derived from playthrough time or sessions. */
  @Column({ name: 'platinum_time_minutes', type: 'int', nullable: true })
  platinumTimeMinutes: number | null;

  /** A PLATINUM-kind difficulty of this UserGame (independent of playthrough difficulties). */
  @Column({ name: 'platinum_difficulty_id', type: 'uuid', nullable: true })
  platinumDifficultyId: string | null;

  /** NO ACTION: a difficulty in use can't be deleted (both go away with the UserGame). */
  @ManyToOne(() => Difficulty, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'platinum_difficulty_id' })
  platinumDifficulty: Difficulty | null;

  @OneToMany(() => Playthrough, (playthrough) => playthrough.userGame)
  playthroughs: Playthrough[];

  /** "Date added" in the library. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
