import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlatformExternalId } from './platform-external-id.entity';

/** Global platform list, preloaded by migrations. Users cannot create platforms. */
@Entity({ name: 'platforms' })
export class Platform {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_platforms_slug', { unique: true })
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 30 })
  shortName: string;

  /** Display order (grouped by family, newest first). */
  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

  @OneToMany(() => PlatformExternalId, (externalId) => externalId.platform)
  externalIds: PlatformExternalId[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
