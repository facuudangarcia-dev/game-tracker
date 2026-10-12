import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { DifficultiesService } from './difficulties.service';
import { DifficultyKind } from './difficulty.entity';
import type { CreatePlaythroughDto, UpdatePlaythroughDto } from './dto/playthrough.dto';
import { LibraryErrorCode, PlayStatus } from './library.constants';
import { assertValidPlaythroughDates, resolveCompletionDate } from './playthrough-rules';
import { PlatinumService } from './platinum.service';
import { Playthrough } from './playthrough.entity';
import { PlaythroughTimeAdjustment } from './playthrough-time-adjustment.entity';
import { UserGameAccess } from './user-game-access.service';
import { ActivityType } from '../activity/activity.entity';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class PlaythroughsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Playthrough) private readonly playthroughs: Repository<Playthrough>,
    private readonly access: UserGameAccess,
    private readonly difficulties: DifficultiesService,
    private readonly platinum: PlatinumService,
    private readonly activity: ActivityService,
  ) {}

  /** A playthrough became in progress, completed or played (decision #86). */
  private async recordStatus(userId: string, userGameId: string, status: PlayStatus) {
    if (status !== PlayStatus.Pending) {
      await this.activity.record(userId, ActivityType.StatusChanged, {
        userGameId,
        data: { status },
      });
    }
  }

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

    assertTimeNotNegative(dto.previousMinutes ?? 0, 0);
    await this.dataSource.transaction(async (manager) => {
      // Serializes concurrent creations for this UserGame, so numbers never clash.
      await manager.query('SELECT id FROM user_games WHERE id = $1 FOR UPDATE', [userGameId]);
      const { max } = (await manager
        .getRepository(Playthrough)
        .createQueryBuilder('p')
        .select('COALESCE(MAX(p.number), 0)', 'max')
        .where('p.user_game_id = :userGameId', { userGameId })
        .getRawOne<{ max: number }>())!;

      const { identifiers } = await manager.getRepository(Playthrough).insert({
        userGameId,
        number: Number(max) + 1,
        name: dto.name ?? null,
        difficultyId: dto.difficultyId ?? null,
        notes: dto.notes ?? null,
        previousTimeMinutes: dto.previousMinutes ?? 0,
        ...state,
      });
      if (dto.previousMinutes) {
        await manager.getRepository(PlaythroughTimeAdjustment).insert({
          playthroughId: (identifiers[0] as { id: string }).id,
          deltaMinutes: dto.previousMinutes,
        });
      }
    });
    await this.recordStatus(userId, userGameId, state.status);
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

    if (dto.previousMinutes !== undefined) {
      assertTimeNotNegative(dto.previousMinutes, playthrough.steamMinutes);
    }
    const delta =
      dto.previousMinutes !== undefined ? dto.previousMinutes - playthrough.previousTimeMinutes : 0;

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Playthrough).update(
        { id: playthrough.id },
        {
          ...state,
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.difficultyId !== undefined && { difficultyId: dto.difficultyId }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.previousMinutes !== undefined && { previousTimeMinutes: dto.previousMinutes }),
        },
      );
      // History of the user's time changes (decision #78).
      if (delta !== 0) {
        await manager
          .getRepository(PlaythroughTimeAdjustment)
          .insert({ playthroughId: playthrough.id, deltaMinutes: delta });
      }
    });
    if (state.status !== playthrough.status) {
      await this.recordStatus(userId, userGameId, state.status);
    }
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

/** A playthrough's time never goes below zero: on Steam games, never below Steam's time. */
function assertTimeNotNegative(previousMinutes: number, steamMinutes: number): void {
  if (previousMinutes + steamMinutes < 0) {
    throw apiError(
      HttpStatus.BAD_REQUEST,
      LibraryErrorCode.PlaythroughTimeNegative,
      "The playthrough's time cannot be negative",
    );
  }
}
