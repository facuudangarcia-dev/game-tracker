import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import type { CatalogDiscoverSort } from '../game-catalog-provider';
import { DISCOVER_MAX_PAGE, type ReleaseFilter } from '../catalog-discover.service';

/** Platform and genre filters use our slugs (shareable URLs). */
const SLUG = /^[a-z0-9-]{1,100}$/;
/** `upcoming`, `recent` or a year between 1950 and 2099. */
const RELEASE = /^(upcoming|recent|19[5-9]\d|20\d\d)$/;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const DISCOVER_SORTS: readonly CatalogDiscoverSort[] = [
  'popular',
  'top-rated',
  'newest',
  'anticipated',
];

class ExploreFilterDto {
  @IsOptional()
  @Matches(SLUG)
  platform?: string;

  @IsOptional()
  @Matches(SLUG)
  genre?: string;
}

/** Query of GET /api/catalog/discover. */
export class DiscoverQueryDto extends ExploreFilterDto {
  @IsOptional()
  @Matches(RELEASE)
  release?: ReleaseFilter;

  @IsOptional()
  @IsIn(DISCOVER_SORTS)
  sort?: CatalogDiscoverSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DISCOVER_MAX_PAGE)
  page?: number;
}

/** Query of GET /api/catalog/releases (range checked by the controller). */
export class ReleasesQueryDto extends ExploreFilterDto {
  @Matches(ISO_DATE)
  from: string;

  @Matches(ISO_DATE)
  to: string;
}

/** Query of GET /api/catalog/releases/undated. */
export class UndatedQueryDto extends ExploreFilterDto {}
