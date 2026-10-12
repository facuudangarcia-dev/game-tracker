import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import { CountryQueryDto } from '../deals/country-query.dto';
import { DealsService } from '../deals/deals.service';
import { CatalogGameRefDto } from '../library/dto/create-user-game.dto';
import type { User } from '../users/user.entity';
import {
  type PriceHistoryResponseDto,
  type WishlistItemDto,
  type WishlistResponseDto,
  WishlistService,
} from './wishlist.service';

export const TARGET_PRICE_MAX = 100_000;

/** PATCH body: a target price (> 0, two decimals at most) or null to clear it. */
export class UpdateWishlistItemDto {
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(TARGET_PRICE_MAX)
  targetPrice: number | null;
}

/**
 * The current user's wishlist. Every route requires a session and checks
 * ownership. Prices are those of `?country=` (decision #68).
 */
@Controller('wishlist')
export class WishlistController {
  constructor(
    private readonly wishlist: WishlistService,
    private readonly deals: DealsService,
  ) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: CountryQueryDto): Promise<WishlistResponseDto> {
    return this.wishlist.list(user.id, this.deals.country(query.country));
  }

  @Post()
  add(
    @CurrentUser() user: User,
    @Body() dto: CatalogGameRefDto,
    @Query() query: CountryQueryDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.add(
      user.id,
      dto.provider,
      dto.externalId,
      this.deals.country(query.country),
    );
  }

  @Patch(':itemId')
  update(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateWishlistItemDto,
    @Query() query: CountryQueryDto,
  ): Promise<WishlistItemDto> {
    return this.wishlist.setTarget(
      user.id,
      itemId,
      dto.targetPrice,
      this.deals.country(query.country),
    );
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param('itemId', ParseUUIDPipe) itemId: string): Promise<void> {
    return this.wishlist.remove(user.id, itemId);
  }

  @Get(':itemId/history')
  history(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() query: CountryQueryDto,
  ): Promise<PriceHistoryResponseDto> {
    return this.wishlist.history(user.id, itemId, this.deals.country(query.country));
  }
}
