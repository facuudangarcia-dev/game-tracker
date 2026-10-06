import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { DifficultiesService } from './difficulties.service';
import { DifficultyKind } from './difficulty.entity';
import type { CreatePlaythroughDto, UpdatePlaythroughDto } from './dto/playthrough.dto';
import { LibraryErrorCode, PlayStatus, TimeMode } from './library.constants';
import { assertValidPlaythroughDates, resolveCompletionDate } from './playthrough-rules';
import { PlatinumService } from './platinum.service';
import { Playthrough } from './playthrough.entity';
import { UserGameAccess } from './user-game-access.service';

@Injectable()
export class PlaythroughsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Playthrough) private readonly playthroughs: Repository<Playthrough>,
    private readonly access: UserGameAccess,
    private readonly difficulties: DifficultiesService,
    private readonly platinum: PlatinumService,
  ) {}

  /** "+ Nueva partida": numbered by the backend (#2, #3...), manual time by default. */
  async create(userId: string, userGameId: string, dto: CreatePlaythroughDto): Promise<void> {
    await this.access.requireOwned(userId, userGameId);
    const state = {
      status: dto.status ?? PlayStatus.Pending,
      startDate: dto.startDate ?? null,
      completionDate: dto.completionDate ?? null,
    };
    assertValidPlaythroughDates(state);
    if (state.startDate) {
      await this.platinum.assertStartDateAllowed(userGameId, null, state.startDate);
    }
    if (dto.difficultyId) {
      await this.difficulties.assertSelectable(
        userGameId,
        dto.difficultyId,
        DifficultyKind.Playthrough,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Serializes concurrent creations for this UserGame, so numbers never clash.
      await manager.query('SELECT id FROM user_games WHERE id = $1 FOR UPDATE', [userGameId]);
      const { max } = (await manager
        .getRepository(Playthrough)
        .createQueryBuilder('p')
        .select('COALESCE(MAX(p.number), 0)', 'max')
        .where('p.user_game_id = :userGameId', { userGameId })
        .getRawOne<{ max: number }>())!;

      await manager.getRepository(Playthrough).insert({
        userGameId,
        number: Number(max) + 1,
        name: dto.name ?? null,
        difficultyId: dto.difficultyId ?? null,
        notes: dto.notes ?? null,
        timeMode: TimeMode.Manual,
        manualTimeMinutes: 0,
        ...state,
      });
    });
  }

  async update(
    userId: string,
    userGameId: string,
    playthroughId: string,
    dto: UpdatePlaythroughDto,
  ): Promise<void> {
    const playthrough = await this.requirePlaythrough(userId, userGameId, playthroughId);
    const state = {
      status: dto.status ?? playthrough.status,
      startDate: dto.startDate !== undefined ? dto.startDate : playthrough.startDate,
      completionDate: resolveCompletionDate(playthrough, dto),
    };
    assertValidPlaythroughDates(state);
    if (dto.startDate !== undefined) {
      await this.platinum.assertStartDateAllowed(userGameId, playthrough.id, state.startDate);
    }
    if (dto.difficultyId) {
      await this.difficulties.assertSelectable(
        userGameId,
        dto.difficultyId,
        DifficultyKind.Playthrough,
      );
    }

    await this.playthroughs.update(
      { id: playthrough.id },
      {
        ...state,
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.difficultyId !== undefined && { difficultyId: dto.difficultyId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    );
  }

  /** Later playthroughs can be deleted (with their sessions); #1 never. */
  async remove(userId: string, userGameId: string, playthroughId: string): Promise<void> {
    const playthrough = await this.requirePlaythrough(userId, userGameId, playthroughId);
    if (playthrough.number === 1) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.FirstPlaythroughNotDeletable,
        'The first playthrough cannot be deleted',
      );
    }
    await this.playthroughs.delete({ id: playthrough.id });
  }

  /** A playthrough of a UserGame owned by the user (404 otherwise). */
  async requirePlaythrough(
    userId: string,
    userGameId: string,
    playthroughId: string,
  ): Promise<Playthrough> {
    await this.access.requireOwned(userId, userGameId);
    const playthrough = await this.playthroughs.findOneBy({ id: playthroughId, userGameId });
    if (!playthrough) {
      throw apiError(
        HttpStatus.NOT_FOUND,
        LibraryErrorCode.PlaythroughNotFound,
        'Playthrough not found',
      );
    }
    return playthrough;
  }
}
