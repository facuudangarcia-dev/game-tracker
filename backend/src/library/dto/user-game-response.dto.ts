import { assetUrl } from '../../catalog/catalog-urls';
import type { Game } from '../../games/game.entity';
import { type GenreResponseDto, toGenreResponse } from '../../genres/genres.controller';
import { type PlatformResponseDto, toPlatformResponse } from '../../platforms/platforms.controller';
import type { PlayStatus } from '../library.constants';
import type { UserGameSummary } from '../library-views.entity';
import type { AchievementDto } from './achievement.dto';
import type { DifficultyResponseDto } from './difficulty.dto';
import type { PlatinumResponseDto } from './platinum.dto';
import type { SessionResponseDto } from './session.dto';
import type { Playthrough } from '../playthrough.entity';
import type { UserGame } from '../user-game.entity';

export interface GameSummaryDto {
  id: string;
  name: string;
  coverUrl: string | null;
  isManual: boolean;
}

export interface GameDetailsDto extends GameSummaryDto {
  /** Catalog reference (null for manual games): links to the catalog page and its artwork. */
  provider: string | null;
  externalId: string | null;
  slug: string | null;
  summary: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: GenreResponseDto[];
}

export interface PlaythroughDto {
  id: string;
  number: number;
  name: string | null;
  status: PlayStatus;
  startDate: string | null;
  completionDate: string | null;
  difficulty: { id: string; name: string } | null;
  /** Time played before logging sessions; on Steam games, the user's changes (may be negative). */
  previousMinutes: number;
  /** Time according to Steam (playthrough #1 of Steam games), decision #78. */
  steamMinutes: number;
  /** Time of the playthrough: previous time + all its sessions. */
  minutes: number;
  notes: string | null;
  createdAt: string;
}

/**
 * Hardest playthrough difficulty the game was played on (decision #72): level is
 * its 0-based place in the game's list and levels the list's length, so the
 * client can color it from easiest to hardest.
 */
export interface PlayedDifficultyDto {
  name: string;
  level: number;
  levels: number;
}

export interface UserGameListItemDto {
  id: string;
  game: GameSummaryDto;
  platform: PlatformResponseDto;
  status: PlayStatus;
  startDate: string | null;
  completionDate: string | null;
  totalMinutes: number;
  rating: number | null;
  platinumAchieved: boolean;
  favorite: boolean;
  createdAt: string;
  /** Null when no in-progress or completed playthrough has a difficulty. */
  difficulty: PlayedDifficultyDto | null;
  /** Synced with a Steam game (decision #78). */
  steam: boolean;
  /** Achieved / total achievements; null when the game has none. */
  achievements: { achieved: number; total: number } | null;
}

export interface UserGameDetailsDto extends Omit<UserGameListItemDto, 'game'> {
  game: GameDetailsDto;
  notes: string | null;
  platinum: PlatinumResponseDto;
  playthroughs: PlaythroughDto[];
  /** All sessions of the game, most recent first. */
  sessions: SessionResponseDto[];
  difficulties: DifficultyResponseDto[];
  /** Steam's first, then the user's own. */
  achievementList: AchievementDto[];
}

export function toGameSummary(game: Game): GameSummaryDto {
  return {
    id: game.id,
    name: game.name,
    coverUrl: game.coverAssetKey ? assetUrl(game.coverAssetKey) : null,
    isManual: game.createdByUserId !== null,
  };
}

export function toGameDetails(game: Game): GameDetailsDto {
  return {
    ...toGameSummary(game),
    provider: game.provider,
    externalId: game.externalId,
    slug: game.slug,
    summary: game.summary,
    releaseDate: game.releaseDate,
    developers: game.developers,
    publishers: game.publishers,
    genres: [...(game.genres ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toGenreResponse),
  };
}

export function toPlaythroughDto(playthrough: Playthrough, minutes: number): PlaythroughDto {
  return {
    id: playthrough.id,
    number: playthrough.number,
    name: playthrough.name,
    status: playthrough.status,
    startDate: playthrough.startDate,
    completionDate: playthrough.completionDate,
    difficulty: playthrough.difficulty
      ? { id: playthrough.difficulty.id, name: playthrough.difficulty.name }
      : null,
    previousMinutes: playthrough.previousTimeMinutes,
    steamMinutes: playthrough.steamMinutes,
    minutes,
    notes: playthrough.notes,
    createdAt: playthrough.createdAt.toISOString(),
  };
}

export interface ListItemExtras {
  difficulty: PlayedDifficultyDto | null;
  achievements: { achieved: number; total: number } | null;
}

export function toListItem(
  userGame: UserGame,
  summary: UserGameSummary,
  { difficulty, achievements }: ListItemExtras,
): UserGameListItemDto {
  return {
    id: userGame.id,
    game: toGameSummary(userGame.game),
    platform: toPlatformResponse(userGame.platform),
    status: summary.status,
    startDate: summary.startDate,
    completionDate: summary.completionDate,
    totalMinutes: summary.totalMinutes,
    rating: userGame.rating,
    platinumAchieved: userGame.platinumAchieved,
    favorite: userGame.favoriteAt !== null,
    createdAt: userGame.createdAt.toISOString(),
    difficulty,
    steam: userGame.steamAppId !== null,
    achievements,
  };
}
