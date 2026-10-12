import { CatalogProvider } from '../src/catalog/catalog-provider';
import {
  type CatalogDiscoverFilter,
  type CatalogGameDetails,
  type CatalogGameSummary,
  type CatalogHighlight,
  type CatalogHighlightKind,
  type CatalogImage,
  type CatalogImageVariant,
  type CatalogRelease,
  type CatalogReleaseFilter,
  type CatalogStoreIds,
  type CatalogTaxonomyEntry,
  CatalogUnavailableError,
  type GameCatalogProvider,
} from '../src/catalog/game-catalog-provider';

export const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/** In-memory catalog used by e2e tests instead of the real IGDB API. */
export class FakeCatalogProvider implements GameCatalogProvider {
  readonly id = CatalogProvider.Igdb;
  readonly games = new Map<string, CatalogGameDetails>();
  failing = false;
  failingImages = false;
  calls = { search: 0, getGame: 0, fetchImage: 0, highlights: 0 };
  highlights: Record<CatalogHighlightKind, CatalogHighlight[]> = { recent: [], upcoming: [] };
  imageVariants: CatalogImageVariant[] = [];
  /** Discover: every call returns this list (paged), and the filter is recorded. */
  discoverResults: CatalogHighlight[] = [];
  discoverFilters: CatalogDiscoverFilter[] = [];
  /** Similar games by game external id. */
  similar = new Map<string, CatalogHighlight[]>();
  similarCalls: { externalIds: string[]; exclude: string[] }[] = [];
  releases: CatalogRelease[] = [];
  releaseQueries: { from: string; to: string; filter: CatalogReleaseFilter }[] = [];
  undated: CatalogHighlight[] = [];
  storeIds = new Map<string, CatalogStoreIds>();
  /** Steam app id -> catalog external id. */
  steamApps = new Map<number, string>();

  add(game: Partial<CatalogGameDetails> & { externalId: string; name: string }): void {
    this.games.set(game.externalId, {
      releaseDate: null,
      coverRef: null,
      platformExternalIds: [],
      slug: null,
      artworkRef: null,
      screenshotRefs: [],
      similarGames: [],
      summary: null,
      genres: [],
      developers: [],
      publishers: [],
      ...game,
    });
  }

  reset(): void {
    this.games.clear();
    this.failing = false;
    this.failingImages = false;
    this.calls = { search: 0, getGame: 0, fetchImage: 0, highlights: 0 };
    this.highlights = { recent: [], upcoming: [] };
    this.imageVariants = [];
    this.discoverResults = [];
    this.discoverFilters = [];
    this.similar = new Map();
    this.similarCalls = [];
    this.releases = [];
    this.releaseQueries = [];
    this.undated = [];
    this.storeIds = new Map();
    this.steamApps = new Map();
  }

  discoverGames(filter: CatalogDiscoverFilter): Promise<CatalogHighlight[]> {
    this.discoverFilters.push(filter);
    this.throwIfFailing();
    const excluded = new Set(filter.excludeExternalIds);
    return Promise.resolve(
      this.discoverResults
        .filter((game) => !excluded.has(game.externalId))
        .slice(filter.offset, filter.offset + filter.limit),
    );
  }

  listSimilarGames(
    externalIds: string[],
    excludeExternalIds: string[],
    limit: number,
  ): Promise<CatalogHighlight[]> {
    this.similarCalls.push({ externalIds, exclude: excludeExternalIds });
    this.throwIfFailing();
    const excluded = new Set([...excludeExternalIds, ...externalIds]);
    return Promise.resolve(
      externalIds
        .flatMap((id) => this.similar.get(id) ?? [])
        .filter((game) => !excluded.has(game.externalId))
        .slice(0, limit),
    );
  }

  listReleases(from: string, to: string, filter: CatalogReleaseFilter): Promise<CatalogRelease[]> {
    this.releaseQueries.push({ from, to, filter });
    this.throwIfFailing();
    return Promise.resolve(this.releases.filter((r) => r.date >= from && r.date <= to));
  }

  listUndatedGames(_filter: CatalogReleaseFilter, limit: number): Promise<CatalogHighlight[]> {
    this.throwIfFailing();
    return Promise.resolve(this.undated.slice(0, limit));
  }

  getStoreIds(externalIds: string[]): Promise<Map<string, CatalogStoreIds>> {
    this.throwIfFailing();
    return Promise.resolve(
      new Map(
        externalIds.flatMap((id) => {
          const ids = this.storeIds.get(id);
          return ids ? [[id, ids] as const] : [];
        }),
      ),
    );
  }

  findBySteamAppIds(appIds: number[]): Promise<Map<number, string>> {
    this.throwIfFailing();
    return Promise.resolve(
      new Map(
        appIds.flatMap((appId) => {
          const externalId = this.steamApps.get(appId);
          return externalId ? [[appId, externalId] as const] : [];
        }),
      ),
    );
  }

  searchGames(query: string, limit: number): Promise<CatalogGameSummary[]> {
    this.calls.search++;
    this.throwIfFailing();
    const needle = query.toLowerCase();
    return Promise.resolve(
      [...this.games.values()]
        .filter((game) => game.name.toLowerCase().includes(needle))
        .slice(0, limit)
        .map(({ externalId, name, releaseDate, coverRef, platformExternalIds }) => ({
          externalId,
          name,
          releaseDate,
          coverRef,
          platformExternalIds,
        })),
    );
  }

  listHighlights(kind: CatalogHighlightKind, limit: number): Promise<CatalogHighlight[]> {
    this.calls.highlights++;
    this.throwIfFailing();
    return Promise.resolve(this.highlights[kind].slice(0, limit));
  }

  getGame(externalId: string): Promise<CatalogGameDetails | null> {
    this.calls.getGame++;
    this.throwIfFailing();
    return Promise.resolve(this.games.get(externalId) ?? null);
  }

  isValidImageRef(ref: string): boolean {
    return /^[a-z0-9]+$/.test(ref);
  }

  fetchImage(_ref: string, variant: CatalogImageVariant): Promise<CatalogImage> {
    this.calls.fetchImage++;
    this.imageVariants.push(variant);
    if (this.failing || this.failingImages) {
      return Promise.reject(new CatalogUnavailableError('fake image failure'));
    }
    return Promise.resolve({ data: FAKE_JPEG, contentType: 'image/jpeg' });
  }

  listPlatforms(): Promise<CatalogTaxonomyEntry[]> {
    return Promise.resolve([]);
  }

  listGenres(): Promise<CatalogTaxonomyEntry[]> {
    return Promise.resolve([]);
  }

  private throwIfFailing(): void {
    if (this.failing) {
      throw new CatalogUnavailableError('fake catalog is down');
    }
  }
}
