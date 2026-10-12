import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  ACHIEVEMENT_DESCRIPTION_MAX_LENGTH,
  ACHIEVEMENT_NAME_MAX_LENGTH,
} from '../library.constants';
import { BlankToNull } from './validation';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** An achievement added by the user (decision #78). */
export class CreateAchievementDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(ACHIEVEMENT_NAME_MAX_LENGTH)
  name: string;

  @IsOptional()
  @BlankToNull()
  @IsString()
  @MaxLength(ACHIEVEMENT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}

/**
 * Checks or unchecks any achievement; name and description can only be changed
 * on the user's own (Steam's come from Steam).
 */
export class UpdateAchievementDto {
  @IsOptional()
  @IsBoolean()
  achieved?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(ACHIEVEMENT_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @BlankToNull()
  @IsString()
  @MaxLength(ACHIEVEMENT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;
}

export interface AchievementDto {
  id: string;
  /** STEAM: synced with Steam; MANUAL: added by the user. */
  source: 'STEAM' | 'MANUAL';
  name: string;
  description: string | null;
  /** Spanish texts from Steam, if the game has them. */
  nameEs: string | null;
  descriptionEs: string | null;
  iconUrl: string | null;
  iconLockedUrl: string | null;
  /** Hidden on Steam: the description is only meant to be shown once achieved. */
  hidden: boolean;
  achieved: boolean;
  achievedAt: string | null;
}
