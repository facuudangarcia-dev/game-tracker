import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Steam games the user removed from the library: syncs never add them again
 * (decision #78), until the user restores them.
 */
@Entity({ name: 'steam_excluded_apps' })
export class SteamExcludedApp {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @PrimaryColumn({ name: 'app_id', type: 'int' })
  appId: number;

  /** Name at the time it was removed, to list it when restoring. */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
