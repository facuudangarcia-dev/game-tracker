import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  MAX_MINUTES,
  NOTE_MAX_LENGTH,
  PlayStatus,
  PLAYTHROUGH_NAME_MAX_LENGTH,
} from './library.constants';
import { Difficulty } from './difficulty.entity';
import { UserGame } from './user-game.entity';

/**
 * One run of a game ("partida"). Every UserGame has at least #1, created
 * automatically and never deletable.
 */
@Entity({ name: 'playthroughs' })
@Unique('UQ_playthroughs_user_game_number', ['userGameId', 'number'])
@Check('CHK_playthroughs_number_positive', `"number" >= 1`)
@Check('CHK_playthroughs_status', `"status" IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PLAYED')`)
// Only COMPLETED playthroughs have a completion date; it's optional (decision #70).
@Check(
  'CHK_playthroughs_completion_only_completed',
  `"completion_date" IS NULL OR "status" = 'COMPLETED'`,
)
@Check(
  'CHK_playthroughs_completion_after_start',
  `"start_date" IS NULL OR "completion_date" IS NULL OR "completion_date" >= "start_date"`,
)
@Check(
  'CHK_playthroughs_previous_time_range',
  `"previous_time_minutes" >= -${MAX_MINUTES} AND "previous_time_minutes" <= ${MAX_MINUTES}`,
)
// The previous time can only be negative on Steam games, discounting Steam's time
// (decision #78): never below zero overall.
@Check('CHK_playthroughs_time_not_negative', `"previous_time_minutes" + "steam_minutes" >= 0`)
@Check('CHK_playthroughs_steam_minutes', `"steam_minutes" >= 0`)
@Check('CHK_playthroughs_name_not_blank', `"name" IS NULL OR btrim("name") <> ''`)
@Check('CHK_playthroughs_notes_length', `char_length("notes") <= ${NOTE_MAX_LENGTH}`)
export class Playthrough {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_game_id', type: 'uuid' })
  userGameId: string;

  @ManyToOne(() => UserGame, (userGame) => userGame.playthroughs, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'user_game_id' })
  userGame: UserGame;

  /** Assigned by the backend: #1, #2, ... */
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: PLAYTHROUGH_NAME_MAX_LENGTH, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 20, default: PlayStatus.Pending })
  status: PlayStatus;

  /** A PLAYTHROUGH-kind difficulty of the same UserGame (checked by the service). */
  @Index('IDX_playthroughs_difficulty_id')
  @Column({ name: 'difficulty_id', type: 'uuid', nullable: true })
  difficultyId: string | null;

  /** NO ACTION: a difficulty in use can't be deleted (also deleted together with the UserGame). */
  @ManyToOne(() => Difficulty, { onDelete: 'NO ACTION', nullable: true })
  @JoinColumn({ name: 'difficulty_id' })
  difficulty: Difficulty | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'completion_date', type: 'date', nullable: true })
  completionDate: string | null;

  /**
   * Time played before logging sessions (or a game played long ago), optional.
   * The playthrough's time is this plus all its sessions (docs/decisions.md #61).
   */
  @Column({ name: 'previous_time_minutes', type: 'int', default: 0 })
  previousTimeMinutes: number;

  /**
   * Time played according to Steam (decision #78), only on playthrough #1 of
   * Steam games; updated by each sync. The user's changes go to the previous
   * time, so they're kept on top of Steam's time.
   */
  @Column({ name: 'steam_minutes', type: 'int', default: 0 })
  steamMinutes: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
