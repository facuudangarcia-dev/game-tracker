import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Playthrough } from './playthrough.entity';

/**
 * History of the user's changes to a playthrough's time (decision #78): each
 * change of its previous time, signed (+120, -300...). Their sum is the
 * playthrough's previous time; on Steam games it's added to Steam's time.
 */
@Entity({ name: 'playthrough_time_adjustments' })
export class PlaythroughTimeAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_playthrough_time_adjustments_playthrough_id')
  @Column({ name: 'playthrough_id', type: 'uuid' })
  playthroughId: string;

  @ManyToOne(() => Playthrough, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'playthrough_id' })
  playthrough: Playthrough;

  @Column({ name: 'delta_minutes', type: 'int' })
  deltaMinutes: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
