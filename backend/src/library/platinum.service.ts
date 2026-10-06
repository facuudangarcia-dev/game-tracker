import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { isFutureDate } from '../common/dates';
import { DifficultiesService } from './difficulties.service';
import { DifficultyKind } from './difficulty.entity';
import type { PlatinumResponseDto, UpdatePlatinumDto } from './dto/platinum.dto';
import { LibraryErrorCode } from './library.constants';
import { Playthrough } from './playthrough.entity';
import { UserGameAccess } from './user-game-access.service';
import { UserGame } from './user-game.entity';

export function toPlatinumDto(userGame: UserGame): PlatinumResponseDto {
  return {
    achieved: userGame.platinumAchieved,
    date: userGame.platinumDate,
    timeMinutes: userGame.platinumTimeMinutes,
    difficulty: userGame.platinumDifficulty
      ? { id: userGame.platinumDifficulty.id, name: userGame.platinumDifficulty.name }
      : null,
  };
}

/**
 * Platinum of a UserGame: independent of its status, of the playthrough time
 * and of the playthrough difficulties. Its date can't be in the future nor
 * before the game's start date (earliest playthrough start).
 */
@Injectable()
export class PlatinumService {
  constructor(
    @InjectRepository(UserGame) private readonly userGames: Repository<UserGame>,
    @InjectRepository(Playthrough) private readonly playthroughs: Repository<Playthrough>,
    private readonly access: UserGameAccess,
    private readonly difficulties: DifficultiesService,
  ) {}

  async get(userId: string, userGameId: string): Promise<PlatinumResponseDto> {
    await this.access.requireOwned(userId, userGameId);
    const userGame = await this.userGames.findOneOrFail({
      where: { id: userGameId },
      relations: { platinumDifficulty: true },
    });
    return toPlatinumDto(userGame);
  }

  async update(userId: string, userGameId: string, dto: UpdatePlatinumDto): Promise<void> {
    await this.access.requireOwned(userId, userGameId);

    if (!dto.achieved) {
      await this.userGames.update(
        { id: userGameId },
        {
          platinumAchieved: false,
          platinumDate: null,
          platinumTimeMinutes: null,
          platinumDifficultyId: null,
        },
      );
      return;
    }

    if (!dto.date) {
      throw platinumError(LibraryErrorCode.PlatinumDateRequired, 'The platinum date is required');
    }
    if (dto.timeMinutes === undefined || dto.timeMinutes === null) {
      throw platinumError(LibraryErrorCode.PlatinumTimeRequired, 'The platinum time is required');
    }
    if (isFutureDate(dto.date)) {
      throw platinumError(
        LibraryErrorCode.DateInFuture,
        'The platinum date cannot be in the future',
      );
    }
    const earliestStart = await this.earliestStart(userGameId);
    if (earliestStart && dto.date < earliestStart) {
      throw platinumBeforeStart();
    }
    if (dto.difficultyId) {
      await this.difficulties.assertSelectable(
        userGameId,
        dto.difficultyId,
        DifficultyKind.Platinum,
      );
    }

    await this.userGames.update(
      { id: userGameId },
      {
        platinumAchieved: true,
        platinumDate: dto.date,
        platinumTimeMinutes: dto.timeMinutes,
        platinumDifficultyId: dto.difficultyId ?? null,
      },
    );
  }

  /**
   * Keeps "platinum date >= game start" true when playthrough start dates
   * change: rejects a start date that would move the game's start after an
   * achieved platinum.
   * @param playthroughId the playthrough being changed (null when creating one)
   */
  async assertStartDateAllowed(
    userGameId: string,
    playthroughId: string | null,
    startDate: string | null,
  ): Promise<void> {
    const userGame = await this.userGames.findOneByOrFail({ id: userGameId });
    if (!userGame.platinumAchieved || !userGame.platinumDate) {
      return;
    }
    const starts = (await this.playthroughs.findBy({ userGameId }))
      .filter((p) => p.id !== playthroughId)
      .map((p) => p.startDate);
    starts.push(startDate);
    const earliest = starts.filter((s): s is string => s !== null).sort()[0];
    if (earliest && userGame.platinumDate < earliest) {
      throw platinumBeforeStart();
    }
  }

  private async earliestStart(userGameId: string): Promise<string | null> {
    const { earliest } = (await this.playthroughs
      .createQueryBuilder('p')
      .select("to_char(MIN(p.start_date), 'YYYY-MM-DD')", 'earliest')
      .where('p.user_game_id = :userGameId', { userGameId })
      .getRawOne<{ earliest: string | null }>())!;
    return earliest;
  }
}

function platinumError(code: LibraryErrorCode, message: string) {
  return apiError(HttpStatus.BAD_REQUEST, code, message);
}

function platinumBeforeStart() {
  return platinumError(
    LibraryErrorCode.PlatinumBeforeStart,
    'The platinum date cannot be before the game start date',
  );
}
