import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { NOTE_MAX_LENGTH, PlayStatus, PLAYTHROUGH_NAME_MAX_LENGTH } from '../library.constants';
import { BlankToNull, IsCalendarDate, TrimToNull } from './validation';

/**
 * Playthrough fields editable by the user. Omitted fields keep their value;
 * null clears optional ones. The number and the time are not set here.
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
}

export class CreatePlaythroughDto extends PlaythroughFieldsDto {}

export class UpdatePlaythroughDto extends PlaythroughFieldsDto {}
