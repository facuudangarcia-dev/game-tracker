/**
 * Abstraction over news sources (RSS/Atom feeds first, decision #67). Only
 * headline data is kept: title, a short summary, image, date and the link to
 * the original article — never full articles. Each interface language has its
 * own sources (decision #68).
 */

export enum NewsProviderId {
  Rss = 'rss',
}

/** Interface languages; each one has its own outlets. */
export const NEWS_LANGUAGES = ['es', 'en'] as const;
export type NewsLanguage = (typeof NEWS_LANGUAGES)[number];

export const NEWS_CATEGORIES = ['playstation', 'xbox', 'nintendo', 'pc'] as const;
/** Platform families an article is about; none = general gaming news. */
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export interface NewsArticle {
  /** Stable id derived from the article's canonical URL. */
  id: string;
  title: string;
  /** Plain-text excerpt (a couple of sentences at most), if the feed has one. */
  summary: string | null;
  /** The original article. */
  url: string;
  imageUrl: string | null;
  /** Name of the outlet (feed title, else its host). */
  source: string;
  publishedAt: string;
  categories: NewsCategory[];
}

export interface NewsFetchResult {
  articles: NewsArticle[];
  /** Hosts of the feeds that failed this time. */
  failedSources: string[];
}

export interface NewsProvider {
  readonly id: NewsProviderId;
  /** False when no feed is configured. */
  readonly isConfigured: boolean;
  /** Hosts of the configured feeds. */
  readonly sources: string[];
  /** Latest articles of every source, newest first, without duplicates. */
  fetchLatest(): Promise<NewsFetchResult>;
}

/** The news source of each language. */
export type NewsProviders = Record<NewsLanguage, NewsProvider>;

export const NEWS_PROVIDERS = Symbol('NEWS_PROVIDERS');
