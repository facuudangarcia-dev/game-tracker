import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CatalogGameNotFoundError, CatalogImportService } from '../catalog/catalog-import.service';
import { CatalogUnavailableError } from '../catalog/game-catalog-provider';
import { apiError } from '../common/api-error';
import { isUniqueViolation } from '../database/postgres-errors';
import { isPlatformAllowedForGame } from '../games/game-rules';
import { Game } from '../games/game.entity';
import { GamesService } from '../games/games.service';
import { Platform } from '../platforms/platform.entity';
import type { CreateUserGameDto } from './dto/create-user-game.dto';
import type { UpdateUserGameDto } from './dto/update-user-game.dto';
import {
  toGameDetails,
  toListItem,
  toPlaythroughDto,
  type UserGameDetailsDto,
  type UserGameListItemDto,
} from './dto/user-game-response.dto';
import { LibraryErrorCode, PlayStatus, TimeMode } from './library.constants';
import { PlaythroughTime, UserGameSummary } from './library-views.entity';
import { Playthrough } from './playthrough.entity';
import { DifficultiesService } from './difficulties.service';
import { toPlatinumDto } from './platinum.service';
import { PlaytimeService } from './playtime.service';
import { DifficultyKind } from './difficulty.entity';
import { UserGameAccess, userGameNotFound } from './user-game-access.service';
import { UserGame } from './user-game.entity';

@Injectable()
export class LibraryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserGame) private readonly userGames: Repository<UserGame>,
    @InjectRepository(UserGameSummary) private readonly summaries: Repository<UserGameSummary>,
    @InjectRepository(PlaythroughTime)
    private readonly playthroughTimes: Repository<PlaythroughTime>,
    @InjectRepository(Platform) private readonly platforms: Repository<Platform>,
    private readonly games: GamesService,
    private readonly importer: CatalogImportService,
    private readonly access: UserGameAccess,
    private readonly difficulties: DifficultiesService,
    private readonly playtime: PlaytimeService,
  ) {}

  /**
   * Adds a game on a platform to the user's library, creating playthrough #1.
   * Catalog games are imported here if needed (docs/decisions.md #14).
   */
  async create(userId: string, dto: CreateUserGameDto): Promise<UserGameDetailsDto> {
    const sources = [dto.gameId, dto.catalog, dto.manualGame].filter((s) => s !== undefined);
    if (sources.length !== 1) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        LibraryErrorCode.InvalidGameSource,
        'Exactly one of gameId, catalog or manualGame is required',
      );
    }

    const platform = await this.platforms.findOneBy({ id: dto.platformId });
    if (!platform) {
      throw apiError(HttpStatus.BAD_REQUEST, LibraryErrorCode.PlatformNotFound, 'Unknown platform');
    }

    const existingGame = dto.manualGame ? null : await this.resolveGame(userId, dto);
    if (existingGame && !isPlatformAllowedForGame(existingGame, platform.id)) {
      throw apiError(
        HttpStatus.BAD_REQUEST,
        LibraryErrorCode.PlatformNotAvailable,
        'The game is not available on this platform',
      );
    }

    let userGameId: string;
    try {
      userGameId = await this.dataSource.transaction(async (manager) => {
        let gameId = existingGame?.id;
        if (dto.manualGame) {
          const gameRepository = manager.getRepository(Game);
          const manualGame = await gameRepository.save(
            gameRepository.create({
              name: dto.manualGame.name,
              createdByUserId: userId,
              provider: null,
              externalId: null,
            }),
          );
          gameId = manualGame.id;
        }

        const userGame = await manager
          .getRepository(UserGame)
          .save(
            manager.getRepository(UserGame).create({ userId, gameId, platformId: platform.id }),
          );
        // Every UserGame starts with playthrough #1 (pending, manual time).
        await manager.getRepository(Playthrough).insert({
          userGameId: userGame.id,
          number: 1,
          status: PlayStatus.Pending,
          timeMode: TimeMode.Manual,
          manualTimeMinutes: 0,
        });
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Playthrough);
        await this.difficulties.createDefaults(manager, userGame.id, DifficultyKind.Platinum);
        return userGame.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw apiError(
          HttpStatus.CONFLICT,
          LibraryErrorCode.UserGameAlreadyExists,
          'This game is already in the library on this platform',
        );
      }
      throw error;
    }

    return this.get(userId, userGameId);
  }

  async list(userId: string): Promise<UserGameListItemDto[]> {
    const userGames = await this.userGames.find({
      where: { userId },
      relations: { game: true, platform: true },
      order: { createdAt: 'DESC' },
    });
    const summaries = await this.summariesFor(userGames.map((ug) => ug.id));
    return userGames.map((userGame) => toListItem(userGame, summaries.get(userGame.id)!));
  }

  async get(userId: string, userGameId: string): Promise<UserGameDetailsDto> {
    const userGame = await this.userGames.findOne({
      where: { id: userGameId, userId },
      relations: {
        game: { genres: true },
        platform: true,
        playthroughs: { difficulty: true },
        platinumDifficulty: true,
      },
      order: { playthroughs: { number: 'ASC' } },
    });
    if (!userGame) {
      throw userGameNotFound();
    }

    const [summaries, times, difficulties, sessions] = await Promise.all([
      this.summariesFor([userGame.id]),
      this.playthroughTimes.findBy({ userGameId: userGame.id }),
      this.difficulties.listFor(userGame.id),
      this.playtime.listFor(userGame.id),
    ]);
    const minutesById = new Map(times.map((t) => [t.playthroughId, t.minutes]));

    return {
      ...toListItem(userGame, summaries.get(userGame.id)!),
      game: toGameDetails(userGame.game),
      notes: userGame.notes,
      platinum: toPlatinumDto(userGame),
      playthroughs: userGame.playthroughs.map((p) =>
        toPlaythroughDto(p, minutesById.get(p.id) ?? 0),
      ),
      sessions,
      difficulties,
    };
  }

  /** Updates personal data (rating, notes). Omitted fields stay unchanged. */
  async update(
    userId: string,
    userGameId: string,
    dto: UpdateUserGameDto,
  ): Promise<UserGameDetailsDto> {
    const userGame = await this.access.requireOwned(userId, userGameId);
    const changes: Partial<UserGame> = {};
    if (dto.rating !== undefined) changes.rating = dto.rating;
    if (dto.notes !== undefined) changes.notes = dto.notes;
    if (Object.keys(changes).length > 0) {
      await this.userGames.update({ id: userGame.id }, changes);
    }
    return this.get(userId, userGame.id);
  }

  /** Deletes the user's record and all its personal data; never the Game or Platform. */
  async remove(userId: string, userGameId: string): Promise<void> {
    const result = await this.userGames.delete({ id: userGameId, userId });
    if (!result.affected) {
      throw userGameNotFound();
    }
  }

  private async resolveGame(userId: string, dto: CreateUserGameDto): Promise<Game> {
    if (dto.gameId) {
      const game = await this.games.findVisibleById(dto.gameId, userId);
      if (!game) {
        throw gameNotFound();
      }
      return game;
    }

    const { provider, externalId } = dto.catalog!;
    try {
      return await this.importer.importGame(provider, externalId);
    } catch (error) {
      if (error instanceof CatalogGameNotFoundError) {
        throw gameNotFound();
      }
      if (error instanceof CatalogUnavailableError) {
        throw apiError(
          HttpStatus.SERVICE_UNAVAILABLE,
          LibraryErrorCode.CatalogUnavailable,
          'The game catalog is not available right now',
        );
      }
      throw error;
    }
  }

  private async summariesFor(userGameIds: string[]): Promise<Map<string, UserGameSummary>> {
    if (userGameIds.length === 0) {
      return new Map();
    }
    const rows = await this.summaries.findBy({ userGameId: In(userGameIds) });
    return new Map(rows.map((row) => [row.userGameId, row]));
  }
}

function gameNotFound() {
  return apiError(HttpStatus.NOT_FOUND, LibraryErrorCode.GameNotFound, 'Game not found');
}
