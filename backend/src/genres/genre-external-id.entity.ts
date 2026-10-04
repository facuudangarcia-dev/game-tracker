import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import {
  type CatalogProvider,
  EXTERNAL_ID_MAX_LENGTH,
  PROVIDER_MAX_LENGTH,
} from '../catalog/catalog-provider';
import { Genre } from './genre.entity';

/** Maps a provider's genre id to one of our genres. */
@Entity({ name: 'genre_external_ids' })
export class GenreExternalId {
  @PrimaryColumn({ type: 'varchar', length: PROVIDER_MAX_LENGTH })
  provider: CatalogProvider;

  @PrimaryColumn({ name: 'external_id', type: 'varchar', length: EXTERNAL_ID_MAX_LENGTH })
  externalId: string;

  @Index('IDX_genre_external_ids_genre_id')
  @Column({ name: 'genre_id', type: 'uuid' })
  genreId: string;

  @ManyToOne(() => Genre, (genre) => genre.externalIds, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'genre_id' })
  genre: Genre;
}
