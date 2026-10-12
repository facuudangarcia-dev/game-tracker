import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { NewsArticle } from '../src/news/news-provider';
import type { NewsResponseDto } from '../src/news/news.service';
import { createTestApp } from './create-test-app';
import type { FakeNewsProvider } from './fake-news-provider';

function article(id: string, extra: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    title: `Noticia ${id}`,
    summary: 'Resumen breve.',
    url: `https://revista.example/${id}`,
    imageUrl: null,
    source: 'Revista',
    publishedAt: '2026-10-09T10:00:00.000Z',
    categories: [],
    ...extra,
  };
}

describe('News (e2e)', () => {
  let app: INestApplication<App>;
  let news: FakeNewsProvider;
  let newsEn: FakeNewsProvider;
  let resetDatabase: () => Promise<void>;

  beforeAll(async () => {
    ({ app, news, newsEn, resetDatabase } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (query = '') => request(app.getHttpServer()).get(`/api/news${query}`);

  it('is public and filters by platform family', async () => {
    news.articles = [
      article('1', { categories: ['playstation'] }),
      article('2', { categories: ['nintendo', 'pc'] }),
      article('3'),
    ];

    const all = (await get().expect(200)).body as NewsResponseDto;
    expect(all).toMatchObject({
      configured: true,
      available: true,
      language: 'es',
      total: 3,
      page: 1,
    });
    expect(all.sources).toEqual(['revista.example']);
    expect(
      ((await get('?category=pc').expect(200)).body as NewsResponseDto).items.map((a) => a.id),
    ).toEqual(['2']);
    expect(
      ((await get('?category=general').expect(200)).body as NewsResponseDto).items.map((a) => a.id),
    ).toEqual(['3']);
    // One read of the feeds for all those requests.
    expect(news.calls).toBe(1);
  });

  it('validates the query', async () => {
    await get('?category=sega').expect(400);
    await get('?lang=fr').expect(400);
    await get('?page=0').expect(400);
    await get(`?q=${'a'.repeat(101)}`).expect(400);
  });

  it('serves each language from its own outlets', async () => {
    news.articles = [article('es-1')];
    newsEn.sources = ['magazine.example'];
    newsEn.articles = [article('en-1', { title: 'English news' })];

    const spanish = (await get('?lang=es').expect(200)).body as NewsResponseDto;
    const english = (await get('?lang=en').expect(200)).body as NewsResponseDto;

    expect(spanish).toMatchObject({ language: 'es', sources: ['revista.example'] });
    expect(spanish.items.map((a) => a.id)).toEqual(['es-1']);
    expect(english).toMatchObject({ language: 'en', sources: ['magazine.example'] });
    expect(english.items.map((a) => a.id)).toEqual(['en-1']);
  });

  it('falls back to the other language when one has no feeds', async () => {
    news.articles = [article('es-1')];
    // No English feeds by default.
    const body = (await get('?lang=en').expect(200)).body as NewsResponseDto;
    expect(body).toMatchObject({ configured: true, language: 'es', total: 1 });
    expect(newsEn.calls).toBe(0);
  });

  it('explains when no feed is configured', async () => {
    news.sources = [];
    expect((await get().expect(200)).body).toMatchObject({
      configured: false,
      available: false,
      items: [],
    });
    expect(news.calls).toBe(0);
  });

  it('reports failing feeds without inventing articles', async () => {
    news.failing = true;
    expect((await get().expect(200)).body).toMatchObject({
      configured: true,
      available: false,
      failedSources: ['revista.example'],
      items: [],
    });
  });
});
