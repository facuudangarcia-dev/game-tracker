import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Game } from '../games/game.entity';
import { User } from '../users/user.entity';

/**
 * Steam games a sync found and the user hasn't reviewed yet (decision #80):
 * they're offered in a dialog, where the user picks the ones to add. The ones
 * left out become removed games.
 */
@Entity({ name: 'steam_pending_apps' })
export class SteamPendingApp {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @PrimaryColumn({ name: 'app_id', type: 'int' })
  appId: number;

  /** Steam's name of the game. */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Steam playtime at the last sync. */
  @Column({ type: 'int' })
  minutes: number;

  /** Catalog game it matches; null when it isn't in the catalog (it'd be a manual game). */
  @Column({ name: 'game_id', type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'game_id' })
  game: Game | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
