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
import { OptionalAuth, OptionalUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { CatalogDetailsService, type CatalogGameDto } from './catalog-details.service';
import { EXTERNAL_ID_MAX_LENGTH } from './catalog-provider';
import { CatalogSearchService, type CatalogSearchResponseDto } from './catalog-search.service';
import {
  CatalogDiscoverService,
  type DiscoverResponseDto,
  type RecommendationsResponseDto,
} from './catalog-discover.service';
import { CatalogHighlightsService, type CatalogHighlightsDto } from './catalog-highlights.service';
import {
  CatalogReleasesService,
  daysBetween,
  RELEASES_MAX_RANGE_DAYS,
  type ReleasesResponseDto,
  type UndatedResponseDto,
} from './catalog-releases.service';
import { DiscoverQueryDto, ReleasesQueryDto, UndatedQueryDto } from './dto/explore-query.dto';
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

/**
 * The catalog is public (decision #62): anonymous visitors can browse it from the
 * Home. With a session, results also include the user's own games and library.
 * Every route is limited per IP to protect the provider's quota.
 */
@OptionalAuth()
@UseGuards(ThrottlerGuard)
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly search: CatalogSearchService,
    @Inject(GAME_CATALOG_PROVIDER) private readonly catalog: GameCatalogProvider,
    private readonly details: CatalogDetailsService,
    private readonly highlights: CatalogHighlightsService,
    private readonly discover: CatalogDiscoverService,
    private readonly releases: CatalogReleasesService,
  ) {}

  /** Search-as-you-type friendly limit, still protecting the provider's quota. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('search')
  searchGames(
    @Query() { q }: CatalogSearchQueryDto,
    @OptionalUser() user: User | null,
  ): Promise<CatalogSearchResponseDto> {
    return this.search.search(q, user?.id ?? null);
  }

  /** Recent and upcoming notable games for the Home. Cached; never imports anything. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('highlights')
  getHighlights(): Promise<CatalogHighlightsDto> {
    return this.highlights.get();
  }

  /** Discover grid: filtered catalog page with the user's presence (decision #64). */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('discover')
  discoverGames(
    @Query() query: DiscoverQueryDto,
    @OptionalUser() user: User | null,
  ): Promise<DiscoverResponseDto> {
    return this.discover.discover(query, user?.id ?? null);
  }

  /** Personalized with a session and enough games; general otherwise. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('recommendations')
  getRecommendations(@OptionalUser() user: User | null): Promise<RecommendationsResponseDto> {
    return this.discover.recommendations(user?.id ?? null);
  }

  /** Releases calendar (decision #65): ranges of up to 93 days. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('releases')
  getReleases(
    @Query() query: ReleasesQueryDto,
    @OptionalUser() user: User | null,
  ): Promise<ReleasesResponseDto> {
    const days = daysBetween(query.from, query.to);
    if (Number.isNaN(days) || days < 0 || days > RELEASES_MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `from/to must be valid dates, from <= to, at most ${RELEASES_MAX_RANGE_DAYS} days apart`,
      );
    }
    return this.releases.releases(query, user?.id ?? null);
  }

  /** Announced games without a release date yet. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('releases/undated')
  getUndated(
    @Query() query: UndatedQueryDto,
    @OptionalUser() user: User | null,
  ): Promise<UndatedResponseDto> {
    return this.releases.undated(query, user?.id ?? null);
  }

  /** Public view of a catalog game ("this game exists"); never a manual game. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('games/:provider/:externalId')
  getGame(
    @OptionalUser() user: User | null,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
  ): Promise<CatalogGameDto> {
    if (externalId.length > EXTERNAL_ID_MAX_LENGTH) {
      throw new NotFoundException();
    }
    return this.details.get(user?.id ?? null, provider, externalId);
  }

  /**
   * Image proxy for not-yet-imported games (decision #30): thumbnail by default,
   * `?size=cover` for the catalog detail page and `?size=artwork` for the Home
   * hero. Never stored.
   */
  // A page shows dozens of images (rails, related games, screenshots).
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
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
