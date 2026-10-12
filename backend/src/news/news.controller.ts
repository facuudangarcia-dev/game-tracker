import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Public } from '../auth/decorators';
import { NEWS_CATEGORIES, NEWS_LANGUAGES, type NewsLanguage } from './news-provider';
import { NEWS_MAX_PAGE, type NewsFilter, type NewsResponseDto, NewsService } from './news.service';

export const NEWS_FILTERS: readonly NewsFilter[] = [...NEWS_CATEGORIES, 'general'];

/** Query of GET /api/news. */
export class NewsQueryDto {
  /** Interface language; each one has its own outlets (default: es). */
  @IsOptional()
  @IsIn(NEWS_LANGUAGES)
  lang?: NewsLanguage;

  @IsOptional()
  @IsIn(NEWS_FILTERS)
  category?: NewsFilter;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_PAGE)
  page?: number;
}

/** Public news feed (decision #67), limited per IP. */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  list(@Query() query: NewsQueryDto): Promise<NewsResponseDto> {
    return this.news.list({
      language: query.lang,
      category: query.category,
      q: query.q || undefined,
      page: query.page,
    });
  }
}
