import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { COUNTRY_CODES } from '../common/countries';

/** `?country=` of price endpoints: an ISO 3166-1 alpha-2 code (default: ITAD_COUNTRY). */
export class CountryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(COUNTRY_CODES)
  country?: string;
}
