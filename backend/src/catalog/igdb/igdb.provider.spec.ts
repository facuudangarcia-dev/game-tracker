import { CatalogUnavailableError } from '../game-catalog-provider';
import type { FetchFn, IgdbClient } from './igdb-client';
import { escapeSearchTerm, IGDB_IMAGE_URL, IgdbProvider } from './igdb.provider';

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
});
