import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MAX_MINUTES, NOTE_MAX_LENGTH } from './library.constants';
import { Playthrough } from './playthrough.entity';

/**
 * A play session of a playthrough. Only counts toward the playthrough's time
 * while it is in SESSIONS mode; kept (but not counted) in MANUAL mode.
 */
@Entity({ name: 'gaming_sessions' })
@Index('IDX_gaming_sessions_playthrough_played_at', ['playthroughId', 'playedAt'])
@Check(
  'CHK_gaming_sessions_duration_range',
  `"duration_minutes" >= 1 AND "duration_minutes" <= ${MAX_MINUTES}`,
)
@Check('CHK_gaming_sessions_notes_length', `char_length("notes") <= ${NOTE_MAX_LENGTH}`)
export class GamingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'playthrough_id', type: 'uuid' })
  playthroughId: string;

  @ManyToOne(() => Playthrough, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'playthrough_id' })
  playthrough: Playthrough;

  /** When the session was played (date and time). */
  @Column({ name: 'played_at', type: 'timestamptz' })
  playedAt: Date;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
