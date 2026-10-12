import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { OptionalAuth, OptionalUser } from '../auth/decorators';
import { CatalogDetailsService } from '../catalog/catalog-details.service';
import { EXTERNAL_ID_MAX_LENGTH } from '../catalog/catalog-provider';
import type { User } from '../users/user.entity';
import { CountryQueryDto } from './country-query.dto';
import {
  DEALS_PAGE_SIZE,
  type DealsResponseDto,
  DealsService,
  type GamePricesResponseDto,
  type RecommendedDealsResponseDto,
  type ShopsResponseDto,
} from './deals.service';
import type { DealsPlatform, DealsSort, DealsType } from './price-provider';

export const DEALS_SORTS: readonly DealsSort[] = ['relevance', 'cut', 'price'];
export const DEALS_PLATFORMS: readonly DealsPlatform[] = ['windows', 'mac', 'linux'];
export const DEALS_TYPES: readonly DealsType[] = ['game', 'dlc', 'other'];
// Filtering by kind skips deals of the source, so its offsets grow faster (decision #74).
export const DEALS_MAX_OFFSET = 10_000;
export const DEALS_MAX_PRICE = 100_000;

/** Query of GET /api/deals. `shops` is a comma-separated list of shop ids. */
export class DealsQueryDto extends CountryQueryDto {
  @IsOptional()
  @IsIn(DEALS_SORTS)
  sort?: DealsSort;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.split(',').map((id) => (/^\d{1,6}$/.test(id.trim()) ? Number(id) : Number.NaN))
      : value,
  )
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  shops?: number[];

  @IsOptional()
  @IsIn(DEALS_PLATFORMS)
  platform?: DealsPlatform;

  @IsOptional()
  @IsIn(DEALS_TYPES)
  type?: DealsType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minCut?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(DEALS_MAX_PRICE)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(DEALS_MAX_PRICE)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(DEALS_MAX_OFFSET)
  offset?: number;
}

/**
 * Deals are public (decision #66); with a session the Home's recommendations
 * also use the user's wishlist and pending games. Limited per IP to protect the
 * source's quota.
 */
@OptionalAuth()
@UseGuards(ThrottlerGuard)
@Controller('deals')
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly catalogDetails: CatalogDetailsService,
  ) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  list(@Query() query: DealsQueryDto): Promise<DealsResponseDto> {
    return this.deals.list({
      country: this.deals.country(query.country),
      sort: query.sort ?? 'relevance',
      shopIds: [...new Set(query.shops ?? [])].sort((a, b) => a - b),
      platform: query.platform ?? null,
      type: query.type ?? null,
      minCut: query.minCut ?? null,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
      offset: query.offset ?? 0,
      limit: DEALS_PAGE_SIZE,
    });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('shops')
  shops(@Query() query: CountryQueryDto): Promise<ShopsResponseDto> {
    return this.deals.shops(this.deals.country(query.country));
  }

  /** PC prices of a catalog game, for its page (decision #69). */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('games/:provider/:externalId')
  async gamePrices(
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
    @Query() query: CountryQueryDto,
  ): Promise<GamePricesResponseDto> {
    if (externalId.length > EXTERNAL_ID_MAX_LENGTH) {
      throw new NotFoundException();
    }
    const country = this.deals.country(query.country);
    if (!this.deals.isConfigured) {
      return this.deals.gamePrices(externalId, '', country);
    }
    const name = await this.catalogDetails.nameOf(provider, externalId);
    return this.deals.gamePrices(externalId, name, country);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('recommended')
  recommended(
    @OptionalUser() user: User | null,
    @Query() query: CountryQueryDto,
  ): Promise<RecommendedDealsResponseDto> {
    return this.deals.recommended(user?.id ?? null, this.deals.country(query.country));
  }
}
