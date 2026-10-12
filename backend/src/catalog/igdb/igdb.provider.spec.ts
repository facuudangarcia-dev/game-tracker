import { CatalogUnavailableError } from '../game-catalog-provider';
import type { FetchFn, IgdbClient } from './igdb-client';
import {
  escapeSearchTerm,
  groupReleases,
  IGDB_IMAGE_URL,
  IgdbProvider,
  pickWideImage,
} from './igdb.provider';

function setup(results: unknown[][] = []) {
  const query = jest.fn<Promise<unknown[]>, [string, string]>(() =>
    Promise.resolve(results.shift() ?? []),
  );
  const client = { query } as unknown as IgdbClient;
  const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>();
  return { provider: new IgdbProvider(client, fetchMock as FetchFn), query, fetchMock };
}

describe('IgdbProvider', () => {
  describe('searchGames', () => {
    it('searches only allowed game types and maps the results', async () => {
      const { provider, query } = setup([
        [
          {
            id: 119133,
            name: 'Elden Ring',
            first_release_date: 1645747200,
            cover: { image_id: 'co4jni' },
            platforms: [6, 167],
            game_type: 0,
          },
          { id: 5, name: 'No extras' },
        ],
      ]);

      const results = await provider.searchGames('elden ring', 20);

      const [endpoint, body] = query.mock.calls[0];
      expect(endpoint).toBe('games');
      expect(body).toContain('search "elden ring";');
      expect(body).toContain('where game_type = (0,4,8,9,10,11);');
      expect(body).toContain('limit 20;');
      expect(results).toEqual([
        {
          externalId: '119133',
          name: 'Elden Ring',
          releaseDate: '2022-02-25',
          coverRef: 'co4jni',
          platformExternalIds: ['6', '167'],
        },
        {
          externalId: '5',
          name: 'No extras',
          releaseDate: null,
          coverRef: null,
          platformExternalIds: [],
        },
      ]);
    });

    it('neutralizes characters that could break the Apicalypse query', () => {
      expect(escapeSearchTerm('zelda"; fields *; where id = 1')).toBe(
        'zelda fields * where id = 1',
      );
      expect(escapeSearchTerm('  back\\slash\n ')).toBe('back slash');
    });
  });

  describe('listHighlights', () => {
    const now = new Date('2026-10-06T00:00:00Z');
    const nowSeconds = now.getTime() / 1000;

    it('queries recent anticipated games without adult content and picks an artwork', async () => {
      const { provider, query } = setup([
        [
          {
            id: 1,
            name: 'With Artwork',
            first_release_date: nowSeconds - 86400,
            cover: { image_id: 'co1' },
            artworks: [{ image_id: 'ar1', width: 1920, height: 1080 }],
            screenshots: [{ image_id: 'sc1' }],
            platforms: [167],
            game_type: 0,
          },
          {
            id: 2,
            name: 'Only Screenshot',
            cover: { image_id: 'co2' },
            screenshots: [{ image_id: 'sc2' }],
            game_type: 8,
          },
          { id: 3, name: 'Bare', cover: { image_id: 'co3' }, game_type: 0 },
          { id: 4, name: 'A DLC', cover: { image_id: 'co4' }, game_type: 1 },
        ],
      ]);

      const games = await provider.listHighlights('recent', 12, now);

      const body = query.mock.calls[0][1];
      expect(body).toContain('themes != (42)');
      expect(body).toContain('cover != null');
      expect(body).toContain(
        `first_release_date >= ${nowSeconds - 180 * 86400} & first_release_date <= ${nowSeconds}`,
      );
      expect(body).toContain('sort hypes desc; limit 12;');
      expect(games.map((g) => [g.name, g.artworkRef])).toEqual([
        ['With Artwork', 'ar1'],
        ['Only Screenshot', 'sc2'],
        ['Bare', null],
      ]);
      expect(games[0]).toMatchObject({ externalId: '1', releaseDate: '2026-10-05' });
    });

    it('queries only unreleased games for upcoming', async () => {
      const { provider, query } = setup([[]]);

      await provider.listHighlights('upcoming', 12, now);

      expect(query.mock.calls[0][1]).toContain(`first_release_date > ${nowSeconds};`);
    });
  });

  describe('pickWideImage', () => {
    it('prefers the largest landscape artwork that is big enough', () => {
      expect(
        pickWideImage({
          artworks: [
            { image_id: 'small', width: 600, height: 300 },
            { image_id: 'big', width: 3840, height: 2160 },
            { image_id: 'mid', width: 1920, height: 1080 },
            { image_id: 'portrait', width: 4000, height: 6000 },
          ],
          screenshots: [{ image_id: 'shot' }],
        }),
      ).toBe('big');
    });

    it('falls back to a screenshot when artworks are small (often logos), then to any artwork', () => {
      const small = [{ image_id: 'logo', width: 800, height: 200 }];

      expect(pickWideImage({ artworks: small, screenshots: [{ image_id: 'shot' }] })).toBe('shot');
      expect(pickWideImage({ artworks: small })).toBe('logo');
      expect(pickWideImage({})).toBeNull();
    });
  });

  describe('getGame', () => {
    it('maps details, splitting developers and publishers', async () => {
      const { provider, query } = setup([
        [
          {
            id: 1942,
            name: 'The Witcher 3: Wild Hunt',
            slug: 'the-witcher-3-wild-hunt',
            summary: '  RPG summary  ',
            first_release_date: 1431993600,
            cover: { image_id: 'co1wyy' },
            platforms: [48, 6],
            game_type: 0,
            genres: [{ id: 12, name: 'Role-playing (RPG)' }],
            involved_companies: [
              { developer: true, publisher: true, company: { name: 'CD Projekt RED' } },
              { developer: false, publisher: true, company: { name: 'Bandai Namco' } },
              { developer: true, publisher: false, company: { name: 'CD Projekt RED' } },
            ],
            screenshots: [{ image_id: 'sc1' }, { image_id: 'sc2' }, { image_id: 'sc1' }],
            similar_games: [
              {
                id: 10,
                name: 'Similar',
                cover: { image_id: 'co10' },
                game_type: 0,
                platforms: [6],
              },
              { id: 11, name: 'A DLC', cover: { image_id: 'co11' }, game_type: 1 },
              { id: 12, name: 'No cover', game_type: 0 },
              { id: 13, name: 'Adult', cover: { image_id: 'co13' }, game_type: 0, themes: [42] },
            ],
          },
        ],
      ]);

      const game = await provider.getGame('1942');

      expect(query.mock.calls[0][1]).toContain('where id = 1942;');
      expect(game).toEqual({
        externalId: '1942',
        name: 'The Witcher 3: Wild Hunt',
        slug: 'the-witcher-3-wild-hunt',
        summary: 'RPG summary',
        releaseDate: '2015-05-19',
        coverRef: 'co1wyy',
        artworkRef: 'sc1',
        screenshotRefs: ['sc1', 'sc2'],
        similarGames: [
          {
            externalId: '10',
            name: 'Similar',
            releaseDate: null,
            coverRef: 'co10',
            platformExternalIds: ['6'],
          },
        ],
        platformExternalIds: ['48', '6'],
        genres: [{ externalId: '12', name: 'Role-playing (RPG)' }],
        developers: ['CD Projekt RED'],
        publishers: ['CD Projekt RED', 'Bandai Namco'],
      });
    });

    it('returns null for DLC and other excluded types', async () => {
      const { provider } = setup([[{ id: 2, name: 'Some DLC', game_type: 1 }]]);

      await expect(provider.getGame('2')).resolves.toBeNull();
    });

    it('returns null for unknown ids and rejects non-numeric ids without querying', async () => {
      const { provider, query } = setup([[]]);

      await expect(provider.getGame('999')).resolves.toBeNull();
      await expect(provider.getGame('1; fields *')).resolves.toBeNull();
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchImage', () => {
    it('downloads the requested size from the IGDB CDN', async () => {
      const { provider, fetchMock } = setup();
      fetchMock.mockResolvedValue(
        new Response(Buffer.from([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }),
      );

      const image = await provider.fetchImage('co4jni', 'cover');

      expect(fetchMock.mock.calls[0][0] as string).toBe(
        `${IGDB_IMAGE_URL}/t_cover_big_2x/co4jni.jpg`,
      );
      expect(image).toEqual({ data: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' });
    });

    it('rejects invalid references and non-image responses', async () => {
      const { provider, fetchMock } = setup();
      fetchMock.mockResolvedValue(
        new Response('<html>', { headers: { 'Content-Type': 'text/html' } }),
      );

      expect(provider.isValidImageRef('../etc/passwd')).toBe(false);
      await expect(provider.fetchImage('../x', 'thumbnail')).rejects.toThrow(/Invalid/);
      await expect(provider.fetchImage('co4jni', 'thumbnail')).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
    });
  });

  it('pages through taxonomy endpoints', async () => {
    const fullPage = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `P${i}`,
      slug: `p${i}`,
    }));
    const { provider, query } = setup([fullPage, [{ id: 500, name: 'Last', slug: 'last' }]]);

    const platforms = await provider.listPlatforms();

    expect(platforms).toHaveLength(501);
    expect(query.mock.calls[1][1]).toContain('offset 500;');
  });

  describe('discoverGames', () => {
    const base = {
      platformExternalIds: [],
      genreExternalIds: [],
      releasedFrom: null,
      releasedTo: null,
      excludeExternalIds: [],
      limit: 25,
      offset: 0,
    };

    it('combines filters, excludes games and sorts by popularity', async () => {
      const { provider, query } = setup([
        [
          { id: 1, name: 'Shown', cover: { image_id: 'c1' }, game_type: 0, platforms: [167] },
          { id: 2, name: 'Adult', cover: { image_id: 'c2' }, game_type: 0, themes: [42] },
          { id: 3, name: 'DLC', cover: { image_id: 'c3' }, game_type: 1 },
        ],
      ]);

      const games = await provider.discoverGames({
        ...base,
        platformExternalIds: ['167', '48'],
        genreExternalIds: ['12', 'x'],
        releasedFrom: '2024-01-01',
        releasedTo: '2024-12-31',
        excludeExternalIds: ['99'],
        sort: 'popular',
        offset: 50,
      });

      const body = query.mock.calls[0][1];
      expect(body).toContain('cover != null');
      expect(body).toContain('themes != (42)');
      expect(body).toContain('platforms = (167,48)');
      // Non-numeric ids never reach the query.
      expect(body).toContain('genres = (12)');
      expect(body).toContain(`first_release_date >= ${Date.parse('2024-01-01') / 1000}`);
      expect(body).toContain(`first_release_date < ${Date.parse('2025-01-01') / 1000}`);
      expect(body).toContain('id != (99)');
      expect(body).toContain('sort total_rating_count desc; limit 25; offset 50;');
      expect(games.map((g) => g.name)).toEqual(['Shown']);
    });

    it('top-rated requires a minimum of ratings; newest only released games', async () => {
      const { provider, query } = setup();
      const now = new Date('2026-10-10T00:00:00Z');
      await provider.discoverGames({ ...base, sort: 'top-rated' }, now);
      await provider.discoverGames({ ...base, sort: 'newest' }, now);
      await provider.discoverGames({ ...base, sort: 'anticipated' }, now);

      expect(query.mock.calls[0][1]).toContain('total_rating_count >= 10');
      expect(query.mock.calls[0][1]).toContain('sort total_rating desc');
      expect(query.mock.calls[1][1]).toContain(`first_release_date <= ${now.getTime() / 1000}`);
      expect(query.mock.calls[1][1]).toContain('sort first_release_date desc');
      expect(query.mock.calls[2][1]).toContain('sort hypes desc');
    });
  });

  describe('listSimilarGames', () => {
    it('ranks games similar to several seeds first, skipping excluded and adult games', async () => {
      const card = (id: number, extra: object = {}) => ({
        id,
        name: `Game ${id}`,
        cover: { image_id: `c${id}` },
        game_type: 0,
        ...extra,
      });
      const { provider, query } = setup([
        [
          { id: 1, similar_games: [card(10), card(11), card(12, { themes: [42] })] },
          { id: 2, similar_games: [card(11), card(13), card(1)] },
        ],
      ]);

      const games = await provider.listSimilarGames(['1', '2'], ['13'], 10);

      expect(query.mock.calls[0][1]).toContain('where id = (1,2);');
      expect(games.map((g) => g.externalId)).toEqual(['11', '10']);
    });

    it('does not query without seeds', async () => {
      const { provider, query } = setup();
      expect(await provider.listSimilarGames([], [], 10)).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('listReleases', () => {
    it('queries notable release dates of the range with the filters', async () => {
      const { provider, query } = setup([[]]);

      await provider.listReleases('2026-10-01', '2026-10-31', {
        platformExternalIds: ['167'],
        genreExternalIds: ['12'],
      });

      const [endpoint, body] = query.mock.calls[0];
      expect(endpoint).toBe('release_dates');
      expect(body).toContain(`date >= ${Date.parse('2026-10-01') / 1000}`);
      expect(body).toContain(`date < ${Date.parse('2026-11-01') / 1000}`);
      expect(body).toContain('date_format != 7');
      expect(body).toContain('game.hypes > 0');
      expect(body).toContain('platform = (167)');
      expect(body).toContain('game.genres = (12)');
      expect(body).toContain('sort date asc; limit 500; offset 0;');
    });

    it('pages through big ranges', async () => {
      const row = { date: 1791763200, date_format: 0, platform: 6 };
      const page = Array.from({ length: 500 }, (_, i) => ({
        ...row,
        game: { id: i, name: `G${i}`, game_type: 0 },
      }));
      const { provider, query } = setup([page, []]);

      const releases = await provider.listReleases('2026-10-01', '2026-10-31', {
        platformExternalIds: [],
        genreExternalIds: [],
      });

      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[1][1]).toContain('offset 500;');
      expect(releases).toHaveLength(500);
    });
  });

  describe('groupReleases', () => {
    const game = (id: number, hypes = 0) => ({
      id,
      name: `Game ${id}`,
      cover: { image_id: `c${id}` },
      game_type: 0,
      platforms: [6, 48, 167],
      hypes,
    });

    it('keeps the earliest date per game, its most precise format and its platforms', () => {
      const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000;
      const releases = groupReleases([
        { date: day('2026-10-20'), date_format: 0, platform: 167, game: game(1, 5) },
        { date: day('2026-10-12'), date_format: 1, platform: 6, game: game(1, 5) },
        { date: day('2026-10-12'), date_format: 0, platform: 48, game: game(1, 5) },
        { date: day('2026-10-12'), date_format: 0, platform: 6, game: game(2, 50) },
        { date: day('2026-12-31'), date_format: 6, platform: 6, game: game(3) },
        { date: day('2026-12-31'), date_format: 7, platform: 6, game: game(4) },
        {
          date: day('2026-11-01'),
          date_format: 0,
          platform: 6,
          game: { ...game(5), themes: [42] },
        },
      ]);

      expect(releases.map((r) => [r.externalId, r.date, r.precision])).toEqual([
        // Same day: the most anticipated first.
        ['2', '2026-10-12', 'day'],
        ['1', '2026-10-12', 'day'],
        ['3', '2026-12-31', 'quarter'],
      ]);
      expect(releases[1].releasePlatformExternalIds).toEqual(['6', '48']);
      expect(releases[1].platformExternalIds).toEqual(['6', '48', '167']);
    });
  });

  describe('getStoreIds', () => {
    it('returns the Steam app id when IGDB knows it', async () => {
      const { provider, query } = setup([
        [
          {
            id: 1942,
            external_games: [
              { uid: 'B00T3SPV36', external_game_source: 20 },
              { uid: '292030', external_game_source: 1 },
            ],
          },
          { id: 7, external_games: [{ uid: 'not-a-number', external_game_source: 1 }] },
        ],
      ]);

      const ids = await provider.getStoreIds(['1942', '7', 'bad']);

      expect(query.mock.calls[0][1]).toContain('where id = (1942,7);');
      expect(ids.get('1942')).toEqual({ steamAppId: '292030' });
      expect(ids.get('7')).toEqual({ steamAppId: null });
    });
  });
});
