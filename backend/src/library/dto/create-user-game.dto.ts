import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateIf,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CatalogProvider, EXTERNAL_ID_MAX_LENGTH } from '../../catalog/catalog-provider';
import { GAME_NAME_MAX_LENGTH } from '../../games/game.entity';
import { DEFAULT_DIFFICULTY_NAMES, PlayStatus, RATING_MAX, RATING_MIN } from '../library.constants';
import { IsCalendarDate } from './validation';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CatalogGameRefDto {
  @IsEnum(CatalogProvider)
  provider: CatalogProvider;

  @IsString()
  @Length(1, EXTERNAL_ID_MAX_LENGTH)
  externalId: string;
}

export class ManualGameDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(GAME_NAME_MAX_LENGTH)
  name: string;
}

/** Settings of playthrough #1 chosen when adding the game. */
export class InitialPlaythroughDto {
  @ValidateIf((dto: InitialPlaythroughDto) => dto.status !== undefined)
  @IsEnum(PlayStatus)
  status?: PlayStatus;

  @IsOptional()
  @IsCalendarDate()
  startDate?: string | null;

  @IsOptional()
  @IsCalendarDate()
  completionDate?: string | null;

  /** One of the default difficulty names (the list every new game starts with). */
  @IsOptional()
  @IsIn(DEFAULT_DIFFICULTY_NAMES)
  difficulty?: string | null;
}

/**
 * Adds a game to the library on a platform. Exactly one game source:
 * - gameId: a game already in our database (imported catalog game or own manual game);
 * - catalog: a catalog game, imported now if needed;
 * - manualGame: a new private manual game.
 */
export class CreateUserGameDto {
  @IsUUID()
  platformId: string;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogGameRefDto)
  catalog?: CatalogGameRefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualGameDto)
  manualGame?: ManualGameDto;

  /** Optional initial settings: status, dates and difficulty of playthrough #1. */
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPlaythroughDto)
  initialPlaythrough?: InitialPlaythroughDto;

  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating?: number | null;
}
