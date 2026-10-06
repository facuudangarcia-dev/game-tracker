import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
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
}
