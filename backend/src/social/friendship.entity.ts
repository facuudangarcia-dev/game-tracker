import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum FriendshipStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
}

/**
 * A friendship between two users (decision #84): mutual, it starts as a
 * request from `requester` to `addressee` and becomes ACCEPTED when the
 * addressee accepts it. At most one row per pair, whatever the direction.
 */
@Entity({ name: 'friendships' })
@Index('UQ_friendships_pair', { synchronize: false })
@Index('IDX_friendships_addressee', ['addresseeId'])
@Check('CHK_friendships_not_self', `"requester_id" <> "addressee_id"`)
@Check('CHK_friendships_accepted_at', `("status" = 'ACCEPTED') = ("accepted_at" IS NOT NULL)`)
export class Friendship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  @Column({ name: 'addressee_id', type: 'uuid' })
  addresseeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'addressee_id' })
  addressee: User;

  @Column({ type: 'enum', enum: FriendshipStatus, enumName: 'friendship_status' })
  status: FriendshipStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
}
