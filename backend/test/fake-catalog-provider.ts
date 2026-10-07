import { CatalogProvider } from '../src/catalog/catalog-provider';
import {
  type CatalogGameDetails,
  type CatalogGameSummary,
  type CatalogImage,
  type CatalogImageVariant,
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
  calls = { search: 0, getGame: 0, fetchImage: 0 };
  imageVariants: CatalogImageVariant[] = [];

  add(game: Partial<CatalogGameDetails> & { externalId: string; name: string }): void {
    this.games.set(game.externalId, {
      releaseDate: null,
      coverRef: null,
      platformExternalIds: [],
      slug: null,
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
    this.calls = { search: 0, getGame: 0, fetchImage: 0 };
    this.imageVariants = [];
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
