import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_MINUTES, NOTE_MAX_LENGTH, TimeMode } from '../library.constants';
import { BlankToNull } from './validation';

export class CreateSessionDto {
  /** ISO 8601 date-time with offset, e.g. 2026-10-06T21:30:00-03:00. */
  @IsISO8601({ strict: true })
  playedAt: string;

  @IsInt()
  @Min(1)
  @Max(MAX_MINUTES)
  durationMinutes: number;

  @IsOptional()
  @BlankToNull()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  notes?: string | null;
}

export class UpdateSessionDto {
  @ValidateIf((dto: UpdateSessionDto) => dto.playedAt !== undefined)
  @IsISO8601({ strict: true })
  playedAt?: string;

  @ValidateIf((dto: UpdateSessionDto) => dto.durationMinutes !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_MINUTES)
  durationMinutes?: number;

  @IsOptional()
  @BlankToNull()
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  notes?: string | null;
}

/** Explicit action to edit the time of a MANUAL playthrough (integer minutes). */
export class SetManualTimeDto {
  @IsInt()
  @Min(0)
  @Max(MAX_MINUTES)
  minutes: number;
}

export class InitialSessionDto {
  @IsISO8601({ strict: true })
  playedAt: string;
}

export class ChangeTimeModeDto {
  @IsEnum(TimeMode)
  mode: TimeMode;

  /**
   * MANUAL → SESSIONS only: turns the existing manual time into a first session
   * played at this moment, so no time is lost.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialSessionDto)
  initialSession?: InitialSessionDto;
}

export interface SessionResponseDto {
  id: string;
  playthroughId: string;
  playthroughNumber: number;
  playedAt: string;
  durationMinutes: number;
  notes: string | null;
  /** False while its playthrough is in MANUAL mode (kept, but not counted). */
  countsTowardTime: boolean;
}
