import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  type CatalogProvider,
  EXTERNAL_ID_MAX_LENGTH,
  PROVIDER_MAX_LENGTH,
} from '../catalog/catalog-provider';
import { Genre } from '../genres/genre.entity';
import { Platform } from '../platforms/platform.entity';
import { User } from '../users/user.entity';

export const GAME_NAME_MAX_LENGTH = 255;

/**
 * Catalog information about a game. Never holds personal data (status, rating,
 * notes...): that belongs to UserGame.
 *
 * A game is either imported from a catalog provider (provider + externalId,
 * visible to everyone) or created manually (createdByUserId, private to its
 * creator — docs/decisions.md #24).
 */
@Entity({ name: 'games' })
@Index('UQ_games_provider_external_id', ['provider', 'externalId'], {
  unique: true,
  where: '"provider" IS NOT NULL',
})
@Check(
  'CHK_games_origin',
  `("provider" IS NOT NULL AND "external_id" IS NOT NULL AND "created_by_user_id" IS NULL)
   OR ("provider" IS NULL AND "external_id" IS NULL AND "created_by_user_id" IS NOT NULL)`,
)
@Check('CHK_games_name_not_blank', `btrim("name") <> ''`)
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: PROVIDER_MAX_LENGTH, nullable: true })
  provider: CatalogProvider | null;

  @Column({ name: 'external_id', type: 'varchar', length: EXTERNAL_ID_MAX_LENGTH, nullable: true })
  externalId: string | null;

  @Index('IDX_games_created_by_user_id')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /** Manual games disappear with their creator; catalog games are independent of users. */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @Column({ type: 'varchar', length: GAME_NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: GAME_NAME_MAX_LENGTH, nullable: true })
  slug: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  developers: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  publishers: string[];

  /**
   * Platforms the catalog reports for this game (the GamePlatform relation).
   * Empty for manual games, which accept any platform.
   */
  @ManyToMany(() => Platform)
  @JoinTable({
    name: 'game_platforms',
    joinColumn: {
      name: 'game_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_game_platforms_game_id',
    },
    inverseJoinColumn: {
      name: 'platform_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_game_platforms_platform_id',
    },
  })
  platforms: Platform[];

  @ManyToMany(() => Genre)
  @JoinTable({
    name: 'game_genres',
    joinColumn: {
      name: 'game_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_game_genres_game_id',
    },
    inverseJoinColumn: {
      name: 'genre_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_game_genres_genre_id',
    },
  })
  genres: Genre[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
