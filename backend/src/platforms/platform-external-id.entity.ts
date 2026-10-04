import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import {
  type CatalogProvider,
  EXTERNAL_ID_MAX_LENGTH,
  PROVIDER_MAX_LENGTH,
} from '../catalog/catalog-provider';
import { Platform } from './platform.entity';

/**
 * Maps a provider's platform id to one of our platforms. Several external
 * platforms can map to the same one (e.g. IGDB Windows/Mac/Linux → PC).
 */
@Entity({ name: 'platform_external_ids' })
export class PlatformExternalId {
  @PrimaryColumn({ type: 'varchar', length: PROVIDER_MAX_LENGTH })
  provider: CatalogProvider;

  @PrimaryColumn({ name: 'external_id', type: 'varchar', length: EXTERNAL_ID_MAX_LENGTH })
  externalId: string;

  @Index('IDX_platform_external_ids_platform_id')
  @Column({ name: 'platform_id', type: 'uuid' })
  platformId: string;

  @ManyToOne(() => Platform, (platform) => platform.externalIds, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'platform_id' })
  platform: Platform;
}
