import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ReportReason {
  Avatar = 'AVATAR',
  Username = 'USERNAME',
  Other = 'OTHER',
}

export const REPORT_DETAILS_MAX_LENGTH = 500;

/**
 * A user reported another one (offensive avatar or username, decision #87).
 * Stored for review; the administrator is also emailed.
 */
@Entity({ name: 'user_reports' })
@Index('IDX_user_reports_reported', ['reportedId'])
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reported_id', type: 'uuid' })
  reportedId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'reported_id' })
  reported: User;

  @Column({ type: 'enum', enum: ReportReason, enumName: 'report_reason' })
  reason: ReportReason;

  @Column({ type: 'varchar', length: REPORT_DETAILS_MAX_LENGTH, nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
