import type { NewsArticle, NewsFetchResult, NewsProvider } from './news-provider';
import { NewsProviderId } from './news-provider';
import { NEWS_PAGE_SIZE, NewsService } from './news.service';

function article(id: number, extra: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: String(id),
    title: `Noticia ${id}`,
    summary: null,
    url: `https://a.example/${id}`,
    imageUrl: null,
    source: 'A',
    publishedAt: new Date(Date.UTC(2026, 9, 1) - id * 60_000).toISOString(),
    categories: [],
    ...extra,
  };
}

function setup(results: (NewsFetchResult | Error)[], sources = ['a.example', 'b.example']) {
  const fetchLatest = jest.fn(() => {
    const next = results.shift();
    return next instanceof Error
      ? Promise.reject(next)
      : Promise.resolve(next ?? { articles: [], failedSources: [] });
  });
  const provider: NewsProvider = {
    id: NewsProviderId.Rss,
    isConfigured: sources.length > 0,
    sources,
    fetchLatest,
  };
  const service = new NewsService({ es: provider, en: { ...provider, isConfigured: false } });
  let now = Date.UTC(2026, 9, 10);
  service.now = () => now;
  return { service, fetchLatest, advance: (ms: number) => (now += ms) };
}

describe('NewsService', () => {
  it('explains that nothing is configured without feeds', async () => {
    const { service, fetchLatest } = setup([], []);
    expect(await service.list({})).toMatchObject({
      configured: false,
      available: false,
      items: [],
    });
    expect(fetchLatest).not.toHaveBeenCalled();
  });

  it('filters by category (general = no platform), searches and pages', async () => {
    const articles = [
      article(1, { categories: ['playstation'], title: 'Acción en PS5' }),
      article(2, { categories: ['pc', 'xbox'] }),
      article(3, { summary: 'Una aventura sin plataforma' }),
      ...Array.from({ length: 20 }, (_, i) => article(10 + i)),
    ];
    const { service } = setup([{ articles, failedSources: ['b.example'] }]);

    expect((await service.list({ category: 'playstation' })).items.map((a) => a.id)).toEqual(['1']);
    expect((await service.list({ category: 'xbox' })).items.map((a) => a.id)).toEqual(['2']);
    const general = await service.list({ category: 'general' });
    expect(general.total).toBe(21);
    expect(general.items).toHaveLength(NEWS_PAGE_SIZE);
    expect(general.hasMore).toBe(true);
    expect((await service.list({ category: 'general', page: 2 })).items).toHaveLength(9);
    // Search ignores accents and case, in titles and summaries.
    expect((await service.list({ q: 'ACCION' })).items.map((a) => a.id)).toEqual(['1']);
    expect((await service.list({ q: 'aventura' })).items.map((a) => a.id)).toEqual(['3']);
    expect((await service.list({})).failedSources).toEqual(['b.example']);
  });

  it('caches for 15 minutes and keeps the last result if every feed fails', async () => {
    const { service, fetchLatest, advance } = setup([
      { articles: [article(1)], failedSources: [] },
      { articles: [], failedSources: ['a.example', 'b.example'] },
    ]);

    await service.list({});
    await service.list({});
    expect(fetchLatest).toHaveBeenCalledTimes(1);

    advance(16 * 60_000);
    const stale = await service.list({});
    expect(fetchLatest).toHaveBeenCalledTimes(2);
    expect(stale).toMatchObject({ available: true, total: 1 });
  });

  it('reads each language from its own feeds, with its own cache', async () => {
    const source = (sources: string[], articles: NewsArticle[]): NewsProvider => ({
      id: NewsProviderId.Rss,
      isConfigured: true,
      sources,
      fetchLatest: jest.fn(() => Promise.resolve({ articles, failedSources: [] })),
    });
    const es = source(['revista.example'], [article(1, { title: 'Noticia' })]);
    const en = source(['magazine.example'], [article(2, { title: 'News' })]);
    const service = new NewsService({ es, en });

    const spanish = await service.list({ language: 'es' });
    const english = await service.list({ language: 'en' });

    expect(spanish).toMatchObject({ language: 'es', sources: ['revista.example'] });
    expect(spanish.items.map((a) => a.title)).toEqual(['Noticia']);
    expect(english).toMatchObject({ language: 'en', sources: ['magazine.example'] });
    expect(english.items.map((a) => a.title)).toEqual(['News']);
    expect(es.fetchLatest).toHaveBeenCalledTimes(1);
    expect(en.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it('uses the other language when the requested one has no feeds', async () => {
    const { service } = setup([{ articles: [article(1)], failedSources: [] }]);
    // English has no feeds in setup(): Spanish news are served, saying so.
    expect(await service.list({ language: 'en' })).toMatchObject({
      configured: true,
      language: 'es',
      total: 1,
    });
  });

  it('is unavailable when every feed fails and there is nothing to fall back on', async () => {
    const { service } = setup([{ articles: [], failedSources: ['a.example', 'b.example'] }]);
    expect(await service.list({})).toMatchObject({
      configured: true,
      available: false,
      failedSources: ['a.example', 'b.example'],
    });
  });
});
