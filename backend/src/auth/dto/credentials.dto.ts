import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { COUNTRY_CODES } from '../../common/countries';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  VERIFICATION_CODE_LENGTH,
} from '../auth.constants';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  /** Keeps its case; uniqueness ignores it (decision #76). */
  @Transform(trim)
  @IsString()
  @Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
  @Matches(USERNAME_PATTERN)
  username: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  /** Both legal documents must be explicitly accepted. */
  @Equals(true)
  acceptTerms: boolean;

  @Equals(true)
  acceptPrivacy: boolean;

  /** Country of prices and deals (decision #75): required, ISO 3166-1 alpha-2. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(COUNTRY_CODES)
  country: string;
}

/** Accepting the current legal documents (decision #88): both, explicitly. */
export class AcceptLegalDto {
  @Equals(true)
  acceptTerms: boolean;

  @Equals(true)
  acceptPrivacy: boolean;
}

/** Deleting the account requires the current password. */
export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

/**
 * Login with the username in any case (decision #76). It doesn't enforce the
 * format nor the minimum lengths, so a future policy change can't lock users out.
 */
export class LoginDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(USERNAME_MAX_LENGTH)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class VerifyEmailDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  @Transform(trim)
  @IsString()
  @Matches(new RegExp(`^[0-9]{${VERIFICATION_CODE_LENGTH}}$`))
  code: string;
}

export class ResendVerificationDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;
}
