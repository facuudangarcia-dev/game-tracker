import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Game } from '../games/game.entity';
import { User } from '../users/user.entity';

/**
 * A catalog game a user wants (decision #66), independent of their library. The
 * game is imported like when it's added to the library: the catalog stays the
 * only source of truth for games. The target price is kept with the currency of
 * the prices it was compared against.
 */
@Entity({ name: 'wishlist_items' })
@Unique('UQ_wishlist_items_user_game', ['userId', 'gameId'])
@Check(
  'CHK_wishlist_items_target_price',
  `("target_price" IS NULL AND "target_currency" IS NULL)
   OR ("target_price" > 0 AND "target_currency" ~ '^[A-Z]{3}$')`,
)
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_wishlist_items_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('IDX_wishlist_items_game_id')
  @Column({ name: 'game_id', type: 'uuid' })
  gameId: string;

  /** Only catalog games (never manual ones), which are never deleted. */
  @ManyToOne(() => Game, { onDelete: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'game_id' })
  game: Game;

  /** Price the user waits for; numeric, returned by pg as a string. */
  @Column({ name: 'target_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  targetPrice: string | null;

  /** ISO 4217 currency of the target price (the price source's, never converted). */
  @Column({ name: 'target_currency', type: 'char', length: 3, nullable: true })
  targetCurrency: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
