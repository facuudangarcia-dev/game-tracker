import {
  categorize,
  decodeEntities,
  mergeArticles,
  normalizedTitle,
  parseFeed,
  plainText,
  truncate,
} from './rss-parsing';
import { type FetchFn, parseFeedList, RssNewsProvider } from './rss-news.provider';

const NOW = new Date('2026-10-10T12:00:00Z');

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Revista Gamer</title>
  <link>https://revista.example</link>
  <item>
    <title><![CDATA[Nuevo tráiler de Ghost of Yōtei para PS5]]></title>
    <link>https://revista.example/noticias/ghost-yotei?utm_source=rss</link>
    <pubDate>Fri, 09 Oct 2026 18:00:00 +0200</pubDate>
    <category>Acción</category>
    <media:content medium="image" url="https://cdn.revista.example/ghost.jpg"/>
    <description><![CDATA[<p><img src="https://cdn.revista.example/inline.jpg" /> Sucker&#x20;Punch mostró &amp; más <b>detalles</b>.</p><script>alert(1)</script>]]></description>
  </item>
  <item>
    <title>Análisis de un indie</title>
    <link>https://revista.example/analisis/indie</link>
    <pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate>
    <description>Sin imagen y sin plataforma.</description>
  </item>
  <item>
    <title>Sin enlace</title>
    <pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Fecha rota</title>
    <link>https://revista.example/rota</link>
    <pubDate>ayer</pubDate>
  </item>
  <item>
    <title>Desde el futuro</title>
    <link>https://revista.example/futuro</link>
    <pubDate>Fri, 01 Jan 2027 10:00:00 GMT</pubDate>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog Atom</title>
  <entry>
    <title>Game Pass suma juegos en octubre</title>
    <link rel="alternate" href="/game-pass-octubre"/>
    <link rel="enclosure" href="https://atom.example/archivo.mp3"/>
    <updated>2026-10-07T09:00:00Z</updated>
    <summary>Xbox anunció la lista.</summary>
    <category term="Xbox"/>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('parses RSS items into short, safe articles', () => {
    const articles = parseFeed(RSS, 'https://revista.example/feed', NOW);

    expect(articles).toHaveLength(2);
    expect(articles[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      title: 'Nuevo tráiler de Ghost of Yōtei para PS5',
      summary: 'Sucker Punch mostró & más detalles .',
      url: 'https://revista.example/noticias/ghost-yotei?utm_source=rss',
      imageUrl: 'https://cdn.revista.example/ghost.jpg',
      source: 'Revista Gamer',
      publishedAt: '2026-10-09T16:00:00.000Z',
      categories: ['playstation'],
    });
    expect(articles[1]).toMatchObject({ imageUrl: null, categories: [] });
  });

  it('parses Atom entries, resolving relative links', () => {
    const [article] = parseFeed(ATOM, 'https://atom.example/feed.xml', NOW);
    expect(article).toMatchObject({
      title: 'Game Pass suma juegos en octubre',
      url: 'https://atom.example/game-pass-octubre',
      source: 'Blog Atom',
      categories: ['xbox'],
      summary: 'Xbox anunció la lista.',
    });
  });

  it('rejects documents that are not feeds or declare entities', () => {
    expect(() => parseFeed('<html><body>hi</body></html>', 'https://a.example', NOW)).toThrow();
    expect(() =>
      parseFeed(
        '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "aaaa">]><rss><channel></channel></rss>',
        'https://a.example',
        NOW,
      ),
    ).toThrow('entities');
  });

  it('only keeps https images', () => {
    const xml = RSS.replace(
      'https://cdn.revista.example/ghost.jpg',
      'http://cdn.revista.example/ghost.jpg',
    );
    // Falls back to the https image inside the description.
    expect(parseFeed(xml, 'https://revista.example/feed', NOW)[0].imageUrl).toBe(
      'https://cdn.revista.example/inline.jpg',
    );
  });
});

describe('text helpers', () => {
  it('decodes entities and strips markup', () => {
    expect(decodeEntities('A&#x20;B &amp; C&#233; &hellip;')).toBe('A B & Cé …');
    expect(plainText('<p>Hola <b>mundo</b></p><style>p{}</style>')).toBe('Hola mundo');
  });

  it('truncates at a word boundary', () => {
    expect(truncate('uno dos tres cuatro', 12)).toBe('uno dos…');
    expect(truncate('corto', 12)).toBe('corto');
  });

  it('categorizes by title and feed categories', () => {
    expect(categorize('Rebajas en Steam', [])).toEqual(['pc']);
    expect(categorize('Lo nuevo de Nintendo Switch 2', ['PS5'])).toEqual([
      'playstation',
      'nintendo',
    ]);
    expect(categorize('Entrevista con un desarrollador', ['Opinión'])).toEqual([]);
  });
});

describe('mergeArticles', () => {
  const article = (id: string, url: string, title: string, publishedAt: string) => ({
    id,
    title,
    summary: null,
    url,
    imageUrl: null,
    source: 's',
    publishedAt,
    categories: [],
  });

  it('sorts newest first and drops repeated links and titles', () => {
    const merged = mergeArticles([
      [
        article('a', 'https://www.a.example/x/', 'Noticia Uno', '2026-10-01T00:00:00Z'),
        article('b', 'https://b.example/y', 'Noticia dos', '2026-10-03T00:00:00Z'),
      ],
      [
        article('c', 'https://a.example/x?ref=feed', 'Otro título', '2026-10-02T00:00:00Z'),
        article('d', 'https://c.example/z', 'NOTICIA DOS!', '2026-10-02T00:00:00Z'),
      ],
    ]);
    expect(merged.map((a) => a.id)).toEqual(['b', 'c']);
    expect(normalizedTitle('¡Acción, ya!')).toBe('accion ya');
  });
});

describe('RssNewsProvider', () => {
  it('parses the configured list of feeds', () => {
    expect(
      parseFeedList(' https://a.example/rss, ftp://b.example  nope https://a.example/rss '),
    ).toEqual({
      feeds: ['https://a.example/rss'],
      invalid: 2,
    });
    expect(parseFeedList(undefined)).toEqual({ feeds: [], invalid: 0 });
  });

  it('decodes latin-1 feeds and reports failing sources without hiding the others', async () => {
    const latin1 = Buffer.from(RSS.replace('encoding="utf-8"', 'encoding="iso-8859-1"'), 'latin1');
    const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>((url) =>
      Promise.resolve(
        (url instanceof Request ? url.url : url.toString()).includes('ok.example')
          ? new Response(latin1, { headers: { 'Content-Type': 'text/xml' } })
          : new Response('nope', { status: 500 }),
      ),
    );
    const provider = new RssNewsProvider(
      ['https://ok.example/rss', 'https://www.down.example/rss'],
      fetchMock as FetchFn,
    );

    const result = await provider.fetchLatest();

    expect(result.failedSources).toEqual(['down.example']);
    expect(result.articles.map((a) => a.title)).toContain('Análisis de un indie');
    expect(provider.sources).toEqual(['ok.example', 'down.example']);
  });
});
