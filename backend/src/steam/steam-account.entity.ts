import { Check, Column, Entity, Index, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum SteamSyncStatus {
  Idle = 'IDLE',
  Syncing = 'SYNCING',
  Failed = 'FAILED',
}

/**
 * A user's linked Steam account (decision #78): at most one per user, and a
 * Steam account can only be linked to one user. Unlinking deletes this row; the
 * imported games stay in the library.
 */
@Entity({ name: 'steam_accounts' })
@Check('CHK_steam_accounts_steam_id', `"steam_id" ~ '^[0-9]{17}$'`)
@Check('CHK_steam_accounts_sync_status', `"sync_status" IN ('IDLE', 'SYNCING', 'FAILED')`)
export class SteamAccount {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** SteamID64. */
  @Index('UQ_steam_accounts_steam_id', { unique: true })
  @Column({ name: 'steam_id', type: 'varchar', length: 17 })
  steamId: string;

  /** Steam display name at the last sync (shown as "linked as ..."). */
  @Column({ name: 'persona_name', type: 'varchar', length: 100, nullable: true })
  personaName: string | null;

  @Column({ name: 'linked_at', type: 'timestamptz' })
  linkedAt: Date;

  @Column({ name: 'sync_status', type: 'varchar', length: 20, default: SteamSyncStatus.Idle })
  syncStatus: SteamSyncStatus;

  /** Error code of the last failed sync (e.g. PRIVATE_PROFILE). */
  @Column({ name: 'sync_error', type: 'varchar', length: 40, nullable: true })
  syncError: string | null;

  @Column({ name: 'sync_started_at', type: 'timestamptz', nullable: true })
  syncStartedAt: Date | null;

  /** Progress of the running sync: games processed out of the total. */
  @Column({ name: 'sync_done', type: 'int', default: 0 })
  syncDone: number;

  @Column({ name: 'sync_total', type: 'int', default: 0 })
  syncTotal: number;

  /** End of the last successful sync. */
  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;
}
