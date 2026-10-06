import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull, Not, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { Difficulty, DifficultyKind } from './difficulty.entity';
import type {
  CreateDifficultyDto,
  DifficultyResponseDto,
  RenameDifficultyDto,
  ReorderDifficultiesDto,
} from './dto/difficulty.dto';
import { DEFAULT_DIFFICULTY_NAMES, LibraryErrorCode } from './library.constants';
import { Playthrough } from './playthrough.entity';
import { UserGameAccess } from './user-game-access.service';
import { UserGame } from './user-game.entity';

/**
 * Difficulty lists of a UserGame (decision #3, #4): private to it, created with
 * defaults, fully editable; a difficulty in use can be renamed but not deleted.
 */
@Injectable()
export class DifficultiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Difficulty) private readonly difficulties: Repository<Difficulty>,
    private readonly access: UserGameAccess,
  ) {}

  /** Creates the default list of a kind inside the caller's transaction. */
  async createDefaults(manager: EntityManager, userGameId: string, kind: DifficultyKind) {
    await manager
      .getRepository(Difficulty)
      .insert(
        DEFAULT_DIFFICULTY_NAMES.map((name, position) => ({ userGameId, kind, name, position })),
      );
  }

  /** Both lists, each in display order, with their "in use" flag. */
  async listFor(userGameId: string): Promise<DifficultyResponseDto[]> {
    const rows = await this.difficulties.find({
      where: { userGameId },
      order: { kind: 'ASC', position: 'ASC', createdAt: 'ASC' },
    });
    const used = await this.usedIds(userGameId);
    return rows.map((d) => ({
      id: d.id,
      kind: d.kind,
      name: d.name,
      position: d.position,
      inUse: used.has(d.id),
    }));
  }

  async list(userId: string, userGameId: string): Promise<DifficultyResponseDto[]> {
    await this.access.requireOwned(userId, userGameId);
    return this.listFor(userGameId);
  }

  async create(userId: string, userGameId: string, dto: CreateDifficultyDto) {
    await this.access.requireOwned(userId, userGameId);
    await this.assertNameAvailable(userGameId, dto.kind, dto.name);
    const last = await this.difficulties.findOne({
      where: { userGameId, kind: dto.kind },
      order: { position: 'DESC' },
    });
    await this.difficulties.insert({
      userGameId,
      kind: dto.kind,
      name: dto.name,
      position: last ? last.position + 1 : 0,
    });
    return this.listFor(userGameId);
  }

  async rename(userId: string, userGameId: string, difficultyId: string, dto: RenameDifficultyDto) {
    await this.access.requireOwned(userId, userGameId);
    const difficulty = await this.requireDifficulty(userGameId, difficultyId);
    await this.assertNameAvailable(userGameId, difficulty.kind, dto.name, difficulty.id);
    await this.difficulties.update({ id: difficulty.id }, { name: dto.name });
    return this.listFor(userGameId);
  }

  async remove(userId: string, userGameId: string, difficultyId: string) {
    await this.access.requireOwned(userId, userGameId);
    const difficulty = await this.requireDifficulty(userGameId, difficultyId);
    if ((await this.usedIds(userGameId)).has(difficulty.id)) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.DifficultyInUse,
        'The difficulty is in use and cannot be deleted',
      );
    }
    await this.difficulties.delete({ id: difficulty.id });
    return this.listFor(userGameId);
  }

  async reorder(userId: string, userGameId: string, dto: ReorderDifficultiesDto) {
    await this.access.requireOwned(userId, userGameId);
    const current = await this.difficulties.findBy({ userGameId, kind: dto.kind });
    const currentIds = new Set(current.map((d) => d.id));
    if (dto.ids.length !== currentIds.size || !dto.ids.every((id) => currentIds.has(id))) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        LibraryErrorCode.InvalidDifficultyOrder,
        'The order must list every difficulty of that kind exactly once',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      for (const [position, id] of dto.ids.entries()) {
        await manager.getRepository(Difficulty).update({ id }, { position });
      }
    });
    return this.listFor(userGameId);
  }

  /**
   * Ensures a difficulty can be assigned: it must belong to the same UserGame
   * and to the expected list.
   */
  async assertSelectable(userGameId: string, difficultyId: string, kind: DifficultyKind) {
    const difficulty = await this.difficulties.findOneBy({ id: difficultyId, userGameId, kind });
    if (!difficulty) {
      throw difficultyNotFound(HttpStatus.BAD_REQUEST);
    }
  }

  private async requireDifficulty(userGameId: string, difficultyId: string) {
    const difficulty = await this.difficulties.findOneBy({ id: difficultyId, userGameId });
    if (!difficulty) {
      throw difficultyNotFound(HttpStatus.NOT_FOUND);
    }
    return difficulty;
  }

  /** Names are unique within a list (case-insensitive) so choices are unambiguous. */
  private async assertNameAvailable(
    userGameId: string,
    kind: DifficultyKind,
    name: string,
    exceptId?: string,
  ) {
    const clash = await this.difficulties
      .createQueryBuilder('d')
      .where('d.user_game_id = :userGameId AND d.kind = :kind', { userGameId, kind })
      .andWhere('lower(d.name) = lower(:name)', { name })
      .andWhere(exceptId ? 'd.id <> :exceptId' : 'TRUE', { exceptId })
      .getExists();
    if (clash) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.DifficultyNameTaken,
        'A difficulty with that name already exists in this list',
      );
    }
  }

  /** Ids of difficulties in use by this UserGame's playthroughs or its platinum. */
  private async usedIds(userGameId: string): Promise<Set<string>> {
    const rows = await this.dataSource.getRepository(Playthrough).find({
      select: { difficultyId: true },
      where: { userGameId, difficultyId: Not(IsNull()) },
    });
    const userGame = await this.dataSource
      .getRepository(UserGame)
      .findOne({ select: { platinumDifficultyId: true }, where: { id: userGameId } });
    const used = new Set(rows.map((r) => r.difficultyId!));
    if (userGame?.platinumDifficultyId) {
      used.add(userGame.platinumDifficultyId);
    }
    return used;
  }
}

function difficultyNotFound(status: HttpStatus) {
  return apiError(status, LibraryErrorCode.DifficultyNotFound, 'Difficulty not found');
}
