import {
  type NewsArticle,
  type NewsFetchResult,
  type NewsProvider,
  NewsProviderId,
} from '../src/news/news-provider';

/** In-memory news source used by e2e tests instead of real feeds. */
export class FakeNewsProvider implements NewsProvider {
  readonly id = NewsProviderId.Rss;
  sources: string[];
  articles: NewsArticle[] = [];
  failing = false;
  calls = 0;

  /** `defaultSources`: the configured outlets after each reset. */
  constructor(private readonly defaultSources: string[]) {
    this.sources = [...defaultSources];
  }

  get isConfigured(): boolean {
    return this.sources.length > 0;
  }

  reset(): void {
    this.sources = [...this.defaultSources];
    this.articles = [];
    this.failing = false;
    this.calls = 0;
  }

  fetchLatest(): Promise<NewsFetchResult> {
    this.calls++;
    return Promise.resolve(
      this.failing
        ? { articles: [], failedSources: this.sources }
        : { articles: this.articles, failedSources: [] },
    );
  }
}
