import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * `blocker` blocked `blocked` (decision #84): no friendship, no requests, no
 * search results and nothing visible between them. The blocked user isn't told.
 */
@Entity({ name: 'user_blocks' })
@Index('IDX_user_blocks_blocked', ['blockedId'])
@Check('CHK_user_blocks_not_self', `"blocker_id" <> "blocked_id"`)
export class UserBlock {
  @PrimaryColumn({ name: 'blocker_id', type: 'uuid' })
  blockerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'blocker_id' })
  blocker: User;

  @PrimaryColumn({ name: 'blocked_id', type: 'uuid' })
  blockedId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'blocked_id' })
  blocked: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
