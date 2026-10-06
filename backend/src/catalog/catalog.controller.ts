import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { CatalogSearchService, type CatalogSearchResponseDto } from './catalog-search.service';
import {
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;

export class CatalogSearchQueryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(SEARCH_QUERY_MIN_LENGTH)
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q: string;
}

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly search: CatalogSearchService,
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
  ) {}

  /** Search-as-you-type friendly limit, still protecting the provider's quota. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('search')
  searchGames(
    @Query() { q }: CatalogSearchQueryDto,
    @CurrentUser() user: User,
  ): Promise<CatalogSearchResponseDto> {
    return this.search.search(q, user.id);
  }

  /** Thumbnail proxy for not-yet-imported results (decision #30). Not stored. */
  @Get(':provider/images/:ref')
  async thumbnail(
    @Param('provider') provider: string,
    @Param('ref') ref: string,
    @Res() response: Response,
  ): Promise<void> {
    if (provider !== String(this.catalog.id) || !this.catalog.isValidImageRef(ref)) {
      throw new NotFoundException();
    }
    try {
      const image = await this.catalog.fetchImage(ref, 'thumbnail');
      response
        .status(200)
        .type(image.contentType)
        .set('Cache-Control', 'private, max-age=86400')
        .send(image.data);
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: 'CATALOG_UNAVAILABLE',
          message: 'Catalog image unavailable',
        });
      }
      throw error;
    }
  }
}
