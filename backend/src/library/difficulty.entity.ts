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
import { DIFFICULTY_NAME_MAX_LENGTH } from './library.constants';
import { UserGame } from './user-game.entity';

/** Two independent lists per UserGame: playthrough and platinum difficulties. */
export enum DifficultyKind {
  Playthrough = 'PLAYTHROUGH',
  Platinum = 'PLATINUM',
}

/** A user-defined difficulty, private to one UserGame (no numeric scale). */
@Entity({ name: 'difficulties' })
@Index('IDX_difficulties_user_game_kind_position', ['userGameId', 'kind', 'position'])
@Check('CHK_difficulties_kind', `"kind" IN ('PLAYTHROUGH', 'PLATINUM')`)
@Check('CHK_difficulties_name_not_blank', `btrim("name") <> ''`)
@Check('CHK_difficulties_position', `"position" >= 0`)
export class Difficulty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_game_id', type: 'uuid' })
  userGameId: string;

  @ManyToOne(() => UserGame, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_game_id' })
  userGame: UserGame;

  @Column({ type: 'varchar', length: 20 })
  kind: DifficultyKind;

  @Column({ type: 'varchar', length: DIFFICULTY_NAME_MAX_LENGTH })
  name: string;

  /** Display order within its list (0-based). */
  @Column({ type: 'int' })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
