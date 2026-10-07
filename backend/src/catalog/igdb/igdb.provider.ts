import { CatalogProvider } from '../catalog-provider';
import {
  type CatalogGameDetails,
  type CatalogGameSummary,
  type CatalogHighlight,
  type CatalogHighlightKind,
  type CatalogImage,
  type CatalogImageVariant,
  type CatalogTaxonomyEntry,
  CatalogUnavailableError,
  type GameCatalogProvider,
} from '../game-catalog-provider';
import { type FetchFn, IgdbClient } from './igdb-client';

export const IGDB_IMAGE_URL = 'https://images.igdb.com/igdb/image/upload';

/**
 * IGDB `game_types` ids allowed by docs/decisions.md #27. Verified against the
 * API on 2026-10-06; re-check with `npm run catalog:verify-igdb`.
 */
export const IGDB_ALLOWED_GAME_TYPES = {
  main_game: 0,
  standalone_expansion: 4,
  remake: 8,
  remaster: 9,
  expanded_game: 10,
  port: 11,
} as const;

const ALLOWED_GAME_TYPE_IDS = Object.values(IGDB_ALLOWED_GAME_TYPES);
const IMAGE_SIZES: Record<CatalogImageVariant, string> = {
  thumbnail: 't_cover_small_2x',
  cover: 't_cover_big_2x',
  artwork: 't_1080p',
};
/** IGDB theme "Erotic": never highlighted. */
const IGDB_EROTIC_THEME_ID = 42;
/** "Recent" = released within this window (docs/decisions.md #53). */
const RECENT_WINDOW_DAYS = 180;
const DAY_SECONDS = 24 * 60 * 60;
const IMAGE_REF_PATTERN = /^[a-z0-9]{1,64}$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 500;
/** Wide images (artworks and screenshots) with their size, to pick a good background. */
const WIDE_IMAGE_FIELDS = 'artworks.image_id,artworks.width,artworks.height,screenshots.image_id';
/** Smaller artworks look pixelated as a full-width background. */
const MIN_WIDE_IMAGE_WIDTH = 1280;

interface IgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  platforms?: number[];
  game_type?: number;
  genres?: { id: number; name: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name?: string } }[];
}

interface IgdbImage {
  image_id?: string;
  width?: number;
  height?: number;
}

interface IgdbNamedEntry {
  id: number;
  name?: string;
  slug?: string;
  type?: string;
}

export class IgdbProvider implements GameCatalogProvider {
  readonly id = CatalogProvider.Igdb;

  constructor(
    private readonly client: IgdbClient,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async searchGames(query: string, limit: number): Promise<CatalogGameSummary[]> {
    const games = await this.client.query<IgdbGame>(
      'games',
      `search "${escapeSearchTerm(query)}"; ` +
        'fields name,first_release_date,cover.image_id,platforms,game_type; ' +
        `where game_type = (${ALLOWED_GAME_TYPE_IDS.join(',')}); ` +
        `limit ${limit};`,
    );
    return games.map(toSummary);
  }

  async getGame(externalId: string): Promise<CatalogGameDetails | null> {
    if (!/^\d{1,18}$/.test(externalId)) {
      return null;
    }
    const [game] = await this.client.query<IgdbGame>(
      'games',
      'fields name,slug,summary,first_release_date,cover.image_id,' +
        `${WIDE_IMAGE_FIELDS},platforms,game_type,` +
        'genres.name,involved_companies.developer,involved_companies.publisher,' +
        `involved_companies.company.name; where id = ${externalId};`,
    );
    if (!game || !isAllowedGameType(game.game_type)) {
      return null;
    }

    const companies = game.involved_companies ?? [];
    const companyNames = (role: 'developer' | 'publisher') =>
      unique(companies.filter((c) => c[role]).map((c) => c.company?.name));

    return {
      ...toHighlight(game),
      slug: game.slug ?? null,
      summary: game.summary?.trim() || null,
      genres: (game.genres ?? []).map((g) => ({ externalId: String(g.id), name: g.name })),
      developers: companyNames('developer'),
      publishers: companyNames('publisher'),
    };
  }

  /**
   * Most anticipated games (IGDB "hypes") released in the last 180 days, or not
   * released yet. Only allowed types with a cover; adult content excluded.
   */
  async listHighlights(
    kind: CatalogHighlightKind,
    limit: number,
    now = new Date(),
  ): Promise<CatalogHighlight[]> {
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const window =
      kind === 'recent'
        ? `first_release_date >= ${nowSeconds - RECENT_WINDOW_DAYS * DAY_SECONDS} & first_release_date <= ${nowSeconds}`
        : `first_release_date > ${nowSeconds}`;
    const games = await this.client.query<IgdbGame>(
      'games',
      `fields name,first_release_date,cover.image_id,${WIDE_IMAGE_FIELDS},` +
        'platforms,game_type; ' +
        `where game_type = (${ALLOWED_GAME_TYPE_IDS.join(',')}) & cover != null & ` +
        `themes != (${IGDB_EROTIC_THEME_ID}) & ${window}; ` +
        `sort hypes desc; limit ${limit};`,
    );
    return games.filter((game) => isAllowedGameType(game.game_type)).map(toHighlight);
  }

  isValidImageRef(ref: string): boolean {
    return IMAGE_REF_PATTERN.test(ref);
  }

  /** Downloads an image from IGDB's public CDN (no credentials involved). */
  async fetchImage(ref: string, variant: CatalogImageVariant): Promise<CatalogImage> {
    if (!this.isValidImageRef(ref)) {
      throw new Error(`Invalid IGDB image reference: ${ref}`);
    }
    const url = `${IGDB_IMAGE_URL}/${IMAGE_SIZES[variant]}/${ref}.jpg`;

    let response: Response;
    try {
      response = await this.fetchFn(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    } catch {
      throw new CatalogUnavailableError('IGDB image could not be downloaded');
    }
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!response.ok || !contentType.startsWith('image/')) {
      throw new CatalogUnavailableError(
        `IGDB image download failed with status ${response.status}`,
      );
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
      throw new CatalogUnavailableError('IGDB image has an unexpected size');
    }
    return { data, contentType };
  }

  async listPlatforms(): Promise<CatalogTaxonomyEntry[]> {
    return (await this.listAll('platforms', 'name,slug')).map(toTaxonomyEntry);
  }

  async listGenres(): Promise<CatalogTaxonomyEntry[]> {
    return (await this.listAll('genres', 'name,slug')).map(toTaxonomyEntry);
  }

  /** IGDB-specific: game types, to verify IGDB_ALLOWED_GAME_TYPES. */
  async listGameTypes(): Promise<{ externalId: string; type: string }[]> {
    return (await this.listAll('game_types', 'type')).map((entry) => ({
      externalId: String(entry.id),
      type: entry.type ?? '',
    }));
  }

  private async listAll(endpoint: string, fields: string): Promise<IgdbNamedEntry[]> {
    const entries: IgdbNamedEntry[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await this.client.query<IgdbNamedEntry>(
        endpoint,
        `fields ${fields}; sort id asc; limit ${PAGE_SIZE}; offset ${offset};`,
      );
      entries.push(...page);
      if (page.length < PAGE_SIZE) {
        return entries;
      }
    }
  }
}

function toSummary(game: IgdbGame): CatalogGameSummary {
  return {
    externalId: String(game.id),
    name: game.name,
    releaseDate:
      game.first_release_date === undefined
        ? null
        : new Date(game.first_release_date * 1000).toISOString().slice(0, 10),
    coverRef: game.cover?.image_id ?? null,
    platformExternalIds: (game.platforms ?? []).map(String),
  };
}

/**
 * Best wide image for a background: the largest landscape artwork if it's big enough
 * (IGDB "artworks" are sometimes small logos), else a screenshot, else any artwork.
 */
export function pickWideImage(game: Pick<IgdbGame, 'artworks' | 'screenshots'>): string | null {
  const usable = (images: IgdbImage[] | undefined) => (images ?? []).filter((i) => i.image_id);
  const artworks = usable(game.artworks);
  const keyArt = artworks
    .filter((a) => (a.width ?? 0) >= MIN_WIDE_IMAGE_WIDTH && (a.width ?? 0) > (a.height ?? 0))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return (keyArt ?? usable(game.screenshots)[0] ?? artworks[0])?.image_id ?? null;
}

function toHighlight(game: IgdbGame): CatalogHighlight {
  return { ...toSummary(game), artworkRef: pickWideImage(game) };
}

function toTaxonomyEntry(entry: IgdbNamedEntry): CatalogTaxonomyEntry {
  return { externalId: String(entry.id), name: entry.name ?? '', slug: entry.slug ?? null };
}

function isAllowedGameType(gameType: number | undefined): boolean {
  return gameType !== undefined && (ALLOWED_GAME_TYPE_IDS as readonly number[]).includes(gameType);
}

/** Apicalypse search strings are double-quoted: drop characters that could break out. */
export function escapeSearchTerm(term: string): string {
  return term
    .replace(/["\\;\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))];
}
