import { CatalogProvider } from '../catalog-provider';
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
  type ReleaseDatePrecision,
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
  screenshot: 't_screenshot_big',
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
/** Similar games shown on the game page, with what's needed for a poster. */
const SIMILAR_GAMES_FIELDS =
  'similar_games.name,similar_games.cover.image_id,similar_games.first_release_date,' +
  'similar_games.game_type,similar_games.platforms,similar_games.themes';
const MAX_SCREENSHOTS = 12;
const MAX_SIMILAR_GAMES = 10;
/** Smaller artworks look pixelated as a full-width background. */
const MIN_WIDE_IMAGE_WIDTH = 1280;
/** Fields of a game card (poster + wide image + platforms). */
const CARD_FIELDS = `name,first_release_date,cover.image_id,${WIDE_IMAGE_FIELDS},platforms,game_type,themes`;
/**
 * Release calendar: at most this many release dates per query (IGDB pages are
 * 500 rows); a game has one row per platform and region.
 */
const RELEASES_MAX_PAGES = 4;
/** IGDB `external_game_sources` id of Steam (verified on 2026-10-10). */
const IGDB_STEAM_SOURCE = 1;
/** Top-rated needs a minimum of ratings to be meaningful. */
const TOP_RATED_MIN_COUNT = 10;
const NUMERIC_ID = /^\d{1,18}$/;

/**
 * IGDB `date_format` of a release date: 0 = exact day, 1 = month, 2 = year,
 * 3-6 = quarter, 7 = TBD (verified on 2026-10-10).
 */
const IGDB_DATE_PRECISION: Record<number, ReleaseDatePrecision> = {
  0: 'day',
  1: 'month',
  2: 'year',
  3: 'quarter',
  4: 'quarter',
  5: 'quarter',
  6: 'quarter',
};
const IGDB_DATE_TBD = 7;
const PRECISION_RANK: Record<ReleaseDatePrecision, number> = {
  day: 0,
  month: 1,
  quarter: 2,
  year: 3,
};

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
  themes?: number[];
  similar_games?: IgdbGame[];
  genres?: { id: number; name: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name?: string } }[];
  hypes?: number;
  external_games?: { uid?: string; external_game_source?: number }[];
}

interface IgdbReleaseDate {
  date?: number;
  date_format?: number;
  platform?: number;
  game?: IgdbGame;
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
        `${SIMILAR_GAMES_FIELDS},` +
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
      screenshotRefs: unique((game.screenshots ?? []).map((s) => s.image_id)).slice(
        0,
        MAX_SCREENSHOTS,
      ),
      similarGames: (game.similar_games ?? [])
        .filter(
          (similar) =>
            isAllowedGameType(similar.game_type) &&
            similar.cover?.image_id &&
            !(similar.themes ?? []).includes(IGDB_EROTIC_THEME_ID),
        )
        .slice(0, MAX_SIMILAR_GAMES)
        .map(toSummary),
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

  async discoverGames(
    filter: CatalogDiscoverFilter,
    now = new Date(),
  ): Promise<CatalogHighlight[]> {
    const conditions = [cardConditions(), ...listConditions(filter)];
    if (filter.releasedFrom) {
      conditions.push(`first_release_date >= ${dayStartSeconds(filter.releasedFrom)}`);
    }
    if (filter.releasedTo) {
      conditions.push(`first_release_date < ${dayStartSeconds(filter.releasedTo) + DAY_SECONDS}`);
    }
    const exclude = numericIds(filter.excludeExternalIds);
    if (exclude.length > 0) {
      conditions.push(`id != (${exclude.join(',')})`);
    }
    let sort: string;
    switch (filter.sort) {
      case 'top-rated':
        conditions.push(`total_rating_count >= ${TOP_RATED_MIN_COUNT}`);
        sort = 'total_rating desc';
        break;
      case 'newest':
        conditions.push(`first_release_date <= ${Math.floor(now.getTime() / 1000)}`);
        sort = 'first_release_date desc';
        break;
      case 'anticipated':
        sort = 'hypes desc';
        break;
      default:
        sort = 'total_rating_count desc';
    }
    const games = await this.client.query<IgdbGame>(
      'games',
      `fields ${CARD_FIELDS}; where ${conditions.join(' & ')}; ` +
        `sort ${sort}; limit ${filter.limit}; offset ${filter.offset};`,
    );
    return games.filter(isShowable).map(toHighlight);
  }

  /** Similar games of all the given ones; games similar to several of them come first. */
  async listSimilarGames(
    externalIds: string[],
    excludeExternalIds: string[],
    limit: number,
  ): Promise<CatalogHighlight[]> {
    const ids = numericIds(externalIds);
    if (ids.length === 0) {
      return [];
    }
    const prefixed = CARD_FIELDS.split(',')
      .map((field) => `similar_games.${field}`)
      .join(',');
    const games = await this.client.query<IgdbGame>(
      'games',
      `fields ${prefixed}; where id = (${ids.join(',')}); limit ${ids.length};`,
    );
    const excluded = new Set([...excludeExternalIds, ...ids]);
    const ranked = new Map<number, { game: IgdbGame; count: number; order: number }>();
    let order = 0;
    for (const similar of games.flatMap((game) => game.similar_games ?? [])) {
      if (excluded.has(String(similar.id)) || !isShowable(similar) || !similar.cover?.image_id) {
        continue;
      }
      const entry = ranked.get(similar.id);
      if (entry) {
        entry.count++;
      } else {
        ranked.set(similar.id, { game: similar, count: 1, order: order++ });
      }
    }
    return [...ranked.values()]
      .sort((a, b) => b.count - a.count || a.order - b.order)
      .slice(0, limit)
      .map((entry) => toHighlight(entry.game));
  }

  /**
   * Release dates in the range (one row per game, platform and region), grouped
   * by game: its earliest date in the range, with the platforms released that
   * day. Only games with some interest (IGDB "hypes") and a cover: the full
   * list has thousands of unknown releases a month.
   */
  async listReleases(
    from: string,
    to: string,
    filter: CatalogReleaseFilter,
  ): Promise<CatalogRelease[]> {
    const conditions = [
      `date >= ${dayStartSeconds(from)}`,
      `date < ${dayStartSeconds(to) + DAY_SECONDS}`,
      `date_format != ${IGDB_DATE_TBD}`,
      `game.game_type = (${ALLOWED_GAME_TYPE_IDS.join(',')})`,
      'game.cover != null',
      `game.themes != (${IGDB_EROTIC_THEME_ID})`,
      'game.hypes > 0',
    ];
    const platforms = numericIds(filter.platformExternalIds);
    if (platforms.length > 0) {
      conditions.push(`platform = (${platforms.join(',')})`);
    }
    const genres = numericIds(filter.genreExternalIds);
    if (genres.length > 0) {
      conditions.push(`game.genres = (${genres.join(',')})`);
    }
    const gameFields = `${CARD_FIELDS},hypes`
      .split(',')
      .map((field) => `game.${field}`)
      .join(',');

    const rows: IgdbReleaseDate[] = [];
    for (let page = 0; page < RELEASES_MAX_PAGES; page++) {
      const batch = await this.client.query<IgdbReleaseDate>(
        'release_dates',
        `fields date,date_format,platform,${gameFields}; where ${conditions.join(' & ')}; ` +
          `sort date asc; limit ${PAGE_SIZE}; offset ${page * PAGE_SIZE};`,
      );
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) {
        break;
      }
    }
    return groupReleases(rows);
  }

  async listUndatedGames(filter: CatalogReleaseFilter, limit: number): Promise<CatalogHighlight[]> {
    const conditions = [
      cardConditions(),
      'first_release_date = null',
      'hypes > 0',
      ...listConditions(filter),
    ];
    const games = await this.client.query<IgdbGame>(
      'games',
      `fields ${CARD_FIELDS}; where ${conditions.join(' & ')}; sort hypes desc; limit ${limit};`,
    );
    return games.filter(isShowable).map(toHighlight);
  }

  async getStoreIds(externalIds: string[]): Promise<Map<string, CatalogStoreIds>> {
    const ids = numericIds(externalIds);
    const result = new Map<string, CatalogStoreIds>();
    for (let start = 0; start < ids.length; start += PAGE_SIZE) {
      const chunk = ids.slice(start, start + PAGE_SIZE);
      const games = await this.client.query<IgdbGame>(
        'games',
        'fields external_games.uid,external_games.external_game_source; ' +
          `where id = (${chunk.join(',')}); limit ${chunk.length};`,
      );
      for (const game of games) {
        const steam = (game.external_games ?? []).find(
          (external) =>
            external.external_game_source === IGDB_STEAM_SOURCE &&
            /^\d{1,10}$/.test(external.uid ?? ''),
        );
        result.set(String(game.id), { steamAppId: steam?.uid ?? null });
      }
    }
    return result;
  }

  async findBySteamAppIds(appIds: number[]): Promise<Map<number, string>> {
    const ids = [...new Set(appIds.filter((id) => Number.isInteger(id) && id > 0))];
    const result = new Map<number, string>();
    for (let start = 0; start < ids.length; start += PAGE_SIZE) {
      const chunk = ids.slice(start, start + PAGE_SIZE);
      const rows = await this.client.query<{ uid?: string; game?: number }>(
        'external_games',
        'fields uid,game; ' +
          `where external_game_source = ${IGDB_STEAM_SOURCE} & uid = (${chunk.map((id) => `"${id}"`).join(',')}); ` +
          `limit ${PAGE_SIZE};`,
      );
      for (const row of rows) {
        const appId = Number(row.uid);
        // An app may appear for several catalog entries: the first one wins.
        if (typeof row.game === 'number' && chunk.includes(appId) && !result.has(appId)) {
          result.set(appId, String(row.game));
        }
      }
    }
    return result;
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

/** Allowed type and no adult content (checked again on what IGDB returns). */
function isShowable(game: IgdbGame): boolean {
  return isAllowedGameType(game.game_type) && !(game.themes ?? []).includes(IGDB_EROTIC_THEME_ID);
}

/** Conditions every listed game meets: allowed type, a cover, no adult content. */
function cardConditions(): string {
  return (
    `game_type = (${ALLOWED_GAME_TYPE_IDS.join(',')}) & cover != null & ` +
    `themes != (${IGDB_EROTIC_THEME_ID})`
  );
}

function listConditions(filter: CatalogReleaseFilter): string[] {
  const conditions: string[] = [];
  const platforms = numericIds(filter.platformExternalIds);
  if (platforms.length > 0) {
    conditions.push(`platforms = (${platforms.join(',')})`);
  }
  const genres = numericIds(filter.genreExternalIds);
  if (genres.length > 0) {
    conditions.push(`genres = (${genres.join(',')})`);
  }
  return conditions;
}

/** Only numeric ids ever reach a query (they come from our database, but still). */
function numericIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => NUMERIC_ID.test(id)))];
}

/** Unix seconds of 00:00 UTC of a YYYY-MM-DD date. */
function dayStartSeconds(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 1000);
}

function isoDay(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** One entry per game: earliest date, most precise format of that date, its platforms. */
export function groupReleases(rows: IgdbReleaseDate[]): CatalogRelease[] {
  const byGame = new Map<
    number,
    { game: IgdbGame; date: number; precision: ReleaseDatePrecision; platforms: Set<string> }
  >();
  for (const row of rows) {
    const precision = IGDB_DATE_PRECISION[row.date_format ?? -1];
    if (!row.game || row.date === undefined || !precision || !isShowable(row.game)) {
      continue;
    }
    const entry = byGame.get(row.game.id);
    if (!entry || row.date < entry.date) {
      byGame.set(row.game.id, {
        game: row.game,
        date: row.date,
        precision,
        platforms: new Set(row.platform === undefined ? [] : [String(row.platform)]),
      });
    } else if (row.date === entry.date) {
      if (PRECISION_RANK[precision] < PRECISION_RANK[entry.precision]) {
        entry.precision = precision;
      }
      if (row.platform !== undefined) {
        entry.platforms.add(String(row.platform));
      }
    }
  }
  return [...byGame.values()]
    .sort((a, b) => a.date - b.date || (b.game.hypes ?? 0) - (a.game.hypes ?? 0))
    .map((entry) => ({
      ...toHighlight(entry.game),
      date: isoDay(entry.date),
      precision: entry.precision,
      releasePlatformExternalIds: [...entry.platforms],
    }));
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
