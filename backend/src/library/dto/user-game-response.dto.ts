import { assetUrl } from '../../catalog/catalog-urls';
import type { Game } from '../../games/game.entity';
import { type GenreResponseDto, toGenreResponse } from '../../genres/genres.controller';
import { type PlatformResponseDto, toPlatformResponse } from '../../platforms/platforms.controller';
import type { PlayStatus, TimeMode } from '../library.constants';
import type { UserGameSummary } from '../library-views.entity';
import type { Playthrough } from '../playthrough.entity';
import type { UserGame } from '../user-game.entity';

export interface GameSummaryDto {
  id: string;
  name: string;
  coverUrl: string | null;
  isManual: boolean;
}

export interface GameDetailsDto extends GameSummaryDto {
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
  timeMode: TimeMode;
  manualTimeMinutes: number;
  /** Effective time of the playthrough according to its mode. */
  minutes: number;
  notes: string | null;
  createdAt: string;
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
  createdAt: string;
}

export interface UserGameDetailsDto extends Omit<UserGameListItemDto, 'game'> {
  game: GameDetailsDto;
  notes: string | null;
  playthroughs: PlaythroughDto[];
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
    timeMode: playthrough.timeMode,
    manualTimeMinutes: playthrough.manualTimeMinutes,
    minutes,
    notes: playthrough.notes,
    createdAt: playthrough.createdAt.toISOString(),
  };
}

export function toListItem(userGame: UserGame, summary: UserGameSummary): UserGameListItemDto {
  return {
    id: userGame.id,
    game: toGameSummary(userGame.game),
    platform: toPlatformResponse(userGame.platform),
    status: summary.status,
    startDate: summary.startDate,
    completionDate: summary.completionDate,
    totalMinutes: summary.totalMinutes,
    rating: userGame.rating,
    createdAt: userGame.createdAt.toISOString(),
  };
}
