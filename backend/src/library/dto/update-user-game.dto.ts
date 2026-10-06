import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { NOTE_MAX_LENGTH, RATING_MAX, RATING_MIN } from '../library.constants';

/** Blank notes are stored as null (no note). */
export const toNullableNote = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Personal data of a UserGame. Omitted fields are left unchanged; null clears
 * them. The game and the platform are not editable: they identify the record.
 */
export class UpdateUserGameDto {
  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  rating?: number | null;

  @IsOptional()
  @Transform(toNullableNote)
  @IsString()
  @MaxLength(NOTE_MAX_LENGTH)
  notes?: string | null;
}
