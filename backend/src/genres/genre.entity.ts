import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GenreExternalId } from './genre-external-id.entity';

/** Game genre with its Spanish display name (docs/decisions.md #25). */
@Entity({ name: 'genres' })
export class Genre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_genres_slug', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @OneToMany(() => GenreExternalId, (externalId) => externalId.genre)
  externalIds: GenreExternalId[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
