import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DifficultyKind } from '../difficulty.entity';
import { DIFFICULTY_NAME_MAX_LENGTH } from '../library.constants';
import { TrimToNull } from './validation';

export class CreateDifficultyDto {
  @IsEnum(DifficultyKind)
  kind: DifficultyKind;

  @TrimToNull()
  @IsString()
  @MinLength(1)
  @MaxLength(DIFFICULTY_NAME_MAX_LENGTH)
  name: string;
}

export class RenameDifficultyDto {
  @TrimToNull()
  @IsString()
  @MinLength(1)
  @MaxLength(DIFFICULTY_NAME_MAX_LENGTH)
  name: string;
}

/** The complete list of one kind, in the new order. */
export class ReorderDifficultiesDto {
  @IsEnum(DifficultyKind)
  kind: DifficultyKind;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids: string[];
}

export interface DifficultyResponseDto {
  id: string;
  kind: DifficultyKind;
  name: string;
  position: number;
  /** Used by a playthrough (or the platinum): can be renamed but not deleted. */
  inUse: boolean;
}
