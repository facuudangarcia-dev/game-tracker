import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ACHIEVEMENT_DESCRIPTION_MAX_LENGTH,
  ACHIEVEMENT_NAME_MAX_LENGTH,
} from './library.constants';
import { UserGame } from './user-game.entity';

/**
 * An achievement of one of the user's games (decision #78): from Steam
 * (`steamApiName` set, synced) or added by the user. Both can be checked and
 * unchecked by the user; a sync only checks the ones newly unlocked on Steam.
 */
@Entity({ name: 'achievements' })
@Index('UQ_achievements_user_game_steam', ['userGameId', 'steamApiName'], {
  unique: true,
  where: '"steam_api_name" IS NOT NULL',
})
@Index('IDX_achievements_user_game_position', ['userGameId', 'position'])
@Check('CHK_achievements_name_not_blank', `btrim("name") <> ''`)
@Check('CHK_achievements_position', `"position" >= 0`)
@Check('CHK_achievements_achieved_at', `"achieved" OR "achieved_at" IS NULL`)
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_game_id', type: 'uuid' })
  userGameId: string;

  @ManyToOne(() => UserGame, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_game_id' })
  userGame: UserGame;

  /** Steam's internal name; null for the user's own achievements. */
  @Column({ name: 'steam_api_name', type: 'varchar', length: 200, nullable: true })
  steamApiName: string | null;

  /** English (Steam) or as written by the user. */
  @Column({ type: 'varchar', length: ACHIEVEMENT_NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: ACHIEVEMENT_DESCRIPTION_MAX_LENGTH, nullable: true })
  description: string | null;

  /** Spanish texts from Steam, when the game has them. */
  @Column({ name: 'name_es', type: 'varchar', length: ACHIEVEMENT_NAME_MAX_LENGTH, nullable: true })
  nameEs: string | null;

  @Column({
    name: 'description_es',
    type: 'varchar',
    length: ACHIEVEMENT_DESCRIPTION_MAX_LENGTH,
    nullable: true,
  })
  descriptionEs: string | null;

  /** Steam icons (https), unlocked and locked. */
  @Column({ name: 'icon_url', type: 'text', nullable: true })
  iconUrl: string | null;

  @Column({ name: 'icon_locked_url', type: 'text', nullable: true })
  iconLockedUrl: string | null;

  /** Steam's hidden achievements: the description is only shown once achieved. */
  @Column({ type: 'boolean', default: false })
  hidden: boolean;

  /** Display order (Steam's order, then the user's own in creation order). */
  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'boolean', default: false })
  achieved: boolean;

  @Column({ name: 'achieved_at', type: 'timestamptz', nullable: true })
  achievedAt: Date | null;

  /** Steam's state at the last sync: only changes from false to true check it. */
  @Column({ name: 'steam_achieved', type: 'boolean', default: false })
  steamAchieved: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
