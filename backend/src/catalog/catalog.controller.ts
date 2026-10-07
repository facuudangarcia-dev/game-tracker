import {
  BadRequestException,
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
import { CatalogDetailsService, type CatalogGameDto } from './catalog-details.service';
import { EXTERNAL_ID_MAX_LENGTH } from './catalog-provider';
import { CatalogSearchService, type CatalogSearchResponseDto } from './catalog-search.service';
import { CatalogHighlightsService, type CatalogHighlightsDto } from './catalog-highlights.service';
import {
  type CatalogImageVariant,
  CatalogUnavailableError,
  GAME_CATALOG_PROVIDER,
  type GameCatalogProvider,
} from './game-catalog-provider';

const IMAGE_VARIANTS: readonly CatalogImageVariant[] = [
  'thumbnail',
  'cover',
  'artwork',
  'screenshot',
];

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
    private readonly details: CatalogDetailsService,
    private readonly highlights: CatalogHighlightsService,
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

  /** Recent and upcoming notable games for the Home. Cached; never imports anything. */
  @Get('highlights')
  getHighlights(): Promise<CatalogHighlightsDto> {
    return this.highlights.get();
  }

  /** Public view of a catalog game ("this game exists"); never a manual game. */
  @Get('games/:provider/:externalId')
  getGame(
    @CurrentUser() user: User,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
  ): Promise<CatalogGameDto> {
    if (externalId.length > EXTERNAL_ID_MAX_LENGTH) {
      throw new NotFoundException();
    }
    return this.details.get(user.id, provider, externalId);
  }

  /**
   * Image proxy for not-yet-imported games (decision #30): thumbnail by default,
   * `?size=cover` for the catalog detail page and `?size=artwork` for the Home
   * hero. Never stored.
   */
  @Get(':provider/images/:ref')
  async thumbnail(
    @Param('provider') provider: string,
    @Param('ref') ref: string,
    @Query('size') size: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (size !== undefined && !IMAGE_VARIANTS.includes(size as CatalogImageVariant)) {
      throw new BadRequestException('size must be thumbnail, cover, artwork or screenshot');
    }
    if (provider !== String(this.catalog.id) || !this.catalog.isValidImageRef(ref)) {
      throw new NotFoundException();
    }
    try {
      const image = await this.catalog.fetchImage(
        ref,
        (size as CatalogImageVariant | undefined) ?? 'thumbnail',
      );
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
