import { Logger } from '@nestjs/common';
import {
  type NewsArticle,
  type NewsFetchResult,
  type NewsProvider,
  NewsProviderId,
} from '../news-provider';
import { mergeArticles, parseFeed } from './rss-parsing';

export const MAX_FEEDS = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 3 * 1024 * 1024;

export type FetchFn = typeof fetch;

/** Feed URLs of NEWS_RSS_FEEDS_<LANG> (comma or whitespace separated); invalid ones are skipped. */
export function parseFeedList(value: string | undefined): { feeds: string[]; invalid: number } {
  const entries = (value ?? '').split(/[\s,]+/).filter(Boolean);
  const feeds: string[] = [];
  let invalid = 0;
  for (const entry of entries) {
    try {
      const url = new URL(entry);
      if (['https:', 'http:'].includes(url.protocol)) {
        if (!feeds.includes(url.toString())) {
          feeds.push(url.toString());
        }
        continue;
      }
    } catch {
      // Counted below.
    }
    invalid++;
  }
  return {
    feeds: feeds.slice(0, MAX_FEEDS),
    invalid: invalid + Math.max(0, feeds.length - MAX_FEEDS),
  };
}

/** Text of a response in the charset it declares (header or XML declaration). */
function decode(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 200));
  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1] ??
    /<\?xml[^>]+encoding=["']([\w-]+)["']/i.exec(head)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/**
 * News from RSS/Atom feeds configured by the operator (decision #67). Each feed
 * is read independently: one failing doesn't hide the others.
 */
export class RssNewsProvider implements NewsProvider {
  readonly id = NewsProviderId.Rss;
  private readonly logger = new Logger(RssNewsProvider.name);

  constructor(
    private readonly feeds: string[],
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  get isConfigured(): boolean {
    return this.feeds.length > 0;
  }

  get sources(): string[] {
    return this.feeds.map((feed) => new URL(feed).hostname.replace(/^www\./, ''));
  }

  async fetchLatest(): Promise<NewsFetchResult> {
    const results = await Promise.all(
      this.feeds.map(async (feed) => {
        try {
          return { feed, articles: await this.fetchFeed(feed) };
        } catch (error) {
          this.logger.warn(
            `News feed ${new URL(feed).hostname} failed: ${(error as Error).message}`,
          );
          return { feed, articles: null };
        }
      }),
    );
    return {
      articles: mergeArticles(
        results.flatMap((result) => (result.articles ? [result.articles] : [])),
      ),
      failedSources: results
        .filter((result) => result.articles === null)
        .map((result) => new URL(result.feed).hostname.replace(/^www\./, '')),
    };
  }

  private async fetchFeed(feed: string): Promise<NewsArticle[]> {
    let response: Response;
    try {
      response = await this.fetchFn(feed, {
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'User-Agent': 'GameTracker/1.0 (+news feed reader)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network error',
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const declared = Number(response.headers.get('Content-Length') ?? 0);
    if (declared > MAX_FEED_BYTES) {
      throw new Error('feed too large');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_FEED_BYTES) {
      throw new Error('feed too large');
    }
    return parseFeed(decode(bytes, response.headers.get('Content-Type')), feed);
  }
}
