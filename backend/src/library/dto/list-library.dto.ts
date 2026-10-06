import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PlayStatus } from '../library.constants';

export const LIBRARY_SORT_FIELDS = [
  'name',
  'createdAt',
  'totalMinutes',
  'rating',
  'startDate',
  'completionDate',
] as const;
export type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

/** Query of GET /api/library: search, filters and sort. All optional. */
export class ListLibraryQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(PlayStatus)
  status?: PlayStatus;

  @IsOptional()
  @IsUUID()
  platformId?: string;

  @IsOptional()
  @IsUUID()
  genreId?: string;

  /** "true" / "false". */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  platinum?: boolean;

  @IsOptional()
  @IsIn(LIBRARY_SORT_FIELDS)
  sort?: LibrarySortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: SortOrder;
}
