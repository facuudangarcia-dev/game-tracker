import { Inject, Injectable, Logger } from '@nestjs/common';
import { normalizedTitle } from './rss/rss-parsing';
import {
  type NewsArticle,
  type NewsCategory,
  type NewsFetchResult,
  type NewsLanguage,
  NEWS_LANGUAGES,
  NEWS_PROVIDERS,
  type NewsProviders,
} from './news-provider';

export const NEWS_PAGE_SIZE = 12;
export const NEWS_MAX_PAGE = 50;
/** Feeds are re-read at most every 15 minutes. */
const CACHE_TTL_MS = 15 * 60 * 1000;
/** If every feed fails, the last good result is served for a while. */
const STALE_TTL_MS = 6 * 60 * 60 * 1000;

/** A platform family, or `general` (articles about none in particular). */
export type NewsFilter = NewsCategory | 'general';

export interface NewsQuery {
  /** Language of the interface (default: Spanish). */
  language?: NewsLanguage;
  category?: NewsFilter;
  q?: string;
  page?: number;
}

export interface NewsResponseDto {
  /** False when no feed is configured: the UI explains how to configure them. */
  configured: boolean;
  /**
   * Language of the articles: the requested one, or the other one when the
   * requested language has no feeds configured.
   */
  language: NewsLanguage;
  /** False when no feed could be read (and there's nothing recent to show). */
  available: boolean;
  /** Configured outlets (hosts) and those that failed this time. */
  sources: string[];
  failedSources: string[];
  fetchedAt: string | null;
  items: NewsArticle[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface Snapshot {
  result: NewsFetchResult;
  fetchedAt: number;
}

/**
 * Gaming news feed (decision #67): cached, filtered and searched in memory. Each
 * language has its own outlets and cache (decision #68).
 */
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private snapshots = new Map<NewsLanguage, Snapshot>();
  private pending = new Map<NewsLanguage, Promise<Snapshot | null>>();

  /** Clock; replaced in tests. */
  now: () => number = Date.now;

  constructor(@Inject(NEWS_PROVIDERS) private readonly providers: NewsProviders) {}

  /** For tests. */
  clearCache(): void {
    this.snapshots = new Map();
    this.pending = new Map();
  }

  /** The requested language, or another one with feeds when it has none. */
  private languageFor(requested: NewsLanguage): NewsLanguage {
    if (this.providers[requested].isConfigured) {
      return requested;
    }
    return NEWS_LANGUAGES.find((language) => this.providers[language].isConfigured) ?? requested;
  }

  async list(query: NewsQuery): Promise<NewsResponseDto> {
    const page = query.page ?? 1;
    const language = this.languageFor(query.language ?? 'es');
    const news = this.providers[language];
    const base = {
      configured: news.isConfigured,
      language,
      sources: news.sources,
      page,
    };
    if (!news.isConfigured) {
      return {
        ...base,
        available: false,
        failedSources: [],
        fetchedAt: null,
        items: [],
        total: 0,
        hasMore: false,
      };
    }
    const snapshot = await this.latest(language);
    if (!snapshot) {
      return {
        ...base,
        available: false,
        failedSources: news.sources,
        fetchedAt: null,
        items: [],
        total: 0,
        hasMore: false,
      };
    }

    const needle = query.q ? normalizedTitle(query.q) : '';
    const filtered = snapshot.result.articles.filter(
      (article) =>
        matchesCategory(article, query.category) &&
        (!needle || normalizedTitle(`${article.title} ${article.summary ?? ''}`).includes(needle)),
    );
    const start = (page - 1) * NEWS_PAGE_SIZE;
    return {
      ...base,
      available: true,
      failedSources: snapshot.result.failedSources,
      fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
      items: filtered.slice(start, start + NEWS_PAGE_SIZE),
      total: filtered.length,
      hasMore: start + NEWS_PAGE_SIZE < filtered.length && page < NEWS_MAX_PAGE,
    };
  }

  /** Cached result of a language; concurrent requests share one refresh. */
  private async latest(language: NewsLanguage): Promise<Snapshot | null> {
    const snapshot = this.snapshots.get(language);
    if (snapshot && this.now() - snapshot.fetchedAt < CACHE_TTL_MS) {
      return snapshot;
    }
    let pending = this.pending.get(language);
    if (!pending) {
      pending = this.refresh(language).finally(() => this.pending.delete(language));
      this.pending.set(language, pending);
    }
    return pending;
  }

  private async refresh(language: NewsLanguage): Promise<Snapshot | null> {
    const news = this.providers[language];
    const previous = this.snapshots.get(language) ?? null;
    try {
      const result = await news.fetchLatest();
      const allFailed = result.failedSources.length === news.sources.length;
      if (allFailed && previous && this.now() - previous.fetchedAt < STALE_TTL_MS) {
        return previous;
      }
      if (allFailed) {
        return null;
      }
      const snapshot = { result, fetchedAt: this.now() };
      this.snapshots.set(language, snapshot);
      return snapshot;
    } catch (error) {
      this.logger.error('Unexpected news failure', error);
      return previous;
    }
  }
}

function matchesCategory(article: NewsArticle, category: NewsFilter | undefined): boolean {
  if (!category) {
    return true;
  }
  return category === 'general'
    ? article.categories.length === 0
    : article.categories.includes(category);
}
