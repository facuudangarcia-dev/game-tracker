import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  MAX_MINUTES,
  NOTE_MAX_LENGTH,
  PlayStatus,
  PLAYTHROUGH_NAME_MAX_LENGTH,
} from '../library.constants';
import { BlankToNull, IsCalendarDate, TrimToNull } from './validation';

/**
 * Playthrough fields editable by the user. Omitted fields keep their value;
 * null clears optional ones. The number is never set here; the time is the
 * previous time plus the sessions (docs/decisions.md #61).
 */
export class PlaythroughFieldsDto {
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(PLAYTHROUGH_NAME_MAX_LENGTH)
  name?: string | null;

  /** Status can be changed but never cleared. */
  @ValidateIf((dto: PlaythroughFieldsDto) => dto.status !== undefined)
  @IsEnum(PlayStatus)
  status?: PlayStatus;

  @IsOptional()
  @IsUUID()
  difficultyId?: string | null;

  @IsOptional()
  @IsCalendarDate()
  startDate?: string | null;

  @IsOptional()
  @IsCalendarDate()
  completionDate?: string | null;

  @IsOptional()
  @BlankToNull()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  notes?: string | null;

  /**
   * Time played before logging sessions (optional, whole minutes). On Steam
   * games it's the user's change on top of Steam's time, so it may be negative
   * (never below Steam's time, checked by the service), decision #78.
   */
  @ValidateIf((dto: PlaythroughFieldsDto) => dto.previousMinutes !== undefined)
  @IsInt()
  @Min(-MAX_MINUTES)
  @Max(MAX_MINUTES)
  previousMinutes?: number;
}

export class CreatePlaythroughDto extends PlaythroughFieldsDto {}

export class UpdatePlaythroughDto extends PlaythroughFieldsDto {}
