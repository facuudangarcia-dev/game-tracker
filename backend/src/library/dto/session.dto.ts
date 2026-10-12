import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_MINUTES, NOTE_MAX_LENGTH } from '../library.constants';
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

export interface SessionResponseDto {
  id: string;
  playthroughId: string;
  playthroughNumber: number;
  playedAt: string;
  durationMinutes: number;
  notes: string | null;
}
