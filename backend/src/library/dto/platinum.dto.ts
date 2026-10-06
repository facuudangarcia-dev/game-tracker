import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_MINUTES } from '../library.constants';
import { IsCalendarDate } from './validation';

/**
 * Full platinum state. When `achieved` is false the other fields are cleared;
 * when true, date and time are required and the difficulty is optional.
 */
export class UpdatePlatinumDto {
  @IsBoolean()
  achieved: boolean;

  @IsOptional()
  @IsCalendarDate()
  date?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MINUTES)
  timeMinutes?: number | null;

  @IsOptional()
  @IsUUID()
  difficultyId?: string | null;
}

export interface PlatinumResponseDto {
  achieved: boolean;
  date: string | null;
  timeMinutes: number | null;
  difficulty: { id: string; name: string } | null;
}
