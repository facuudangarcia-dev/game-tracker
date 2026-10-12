import {
  type DealListItem,
  type DealsPage,
  type DealsQuery,
  type DealsType,
  type GamePrices,
  type Money,
  type PriceDeal,
  type PriceLookup,
  type PricePoint,
  type PriceProvider,
  PriceProviderId,
  type PriceShop,
  PriceUnavailableError,
} from '../price-provider';

export const ITAD_API_URL = 'https://api.isthereanydeal.com';
export const ITAD_SITE_URL = 'https://isthereanydeal.com';
/** ITAD shop id of Steam, used to look games up by Steam app id. */
export const ITAD_STEAM_SHOP_ID = 61;
/** ITAD platform ids (documented: 1 Windows, 2 Mac, 3 Linux). */
const ITAD_PLATFORM_IDS = { windows: 1, mac: 2, linux: 3 } as const;
/** Batch endpoints accept at most 200 ids. */
const BATCH_SIZE = 200;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 300;

export type FetchFn = typeof fetch;

/**
 * The source can't filter by kind: filtered pages are filled by scanning up to
 * TYPE_SCAN_REQUESTS chunks of TYPE_SCAN_CHUNK deals (decision #74).
 */
export const TYPE_SCAN_CHUNK = 200;
export const TYPE_SCAN_REQUESTS = 4;

const ITAD_SORTS: Record<DealsQuery['sort'], string> = {
  relevance: 'rank',
  cut: '-cut',
  price: 'price',
};

/**
 * IsThereAnyDeal API v2 (https://docs.isthereanydeal.com). The key travels in
 * the `ITAD-API-Key` header, never in URLs (they end up in logs), and errors
 * never include it nor response bodies.
 */
export class ItadProvider implements PriceProvider {
  readonly id = PriceProviderId.Itad;
  readonly attribution = { name: 'IsThereAnyDeal', url: ITAD_SITE_URL };

  constructor(
    private readonly apiKey: string | null,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  get isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async listDeals(query: DealsQuery): Promise<DealsPage> {
    if (query.type === null) {
      const page = await this.fetchDeals(query, query.offset, query.limit);
      return { ...page, items: page.items.filter((item) => item !== null) };
    }
    // Scans the source's deals in order, keeping only the asked kind; the next
    // offset points right after the last deal shown.
    const items: DealListItem[] = [];
    let offset = query.offset;
    for (let request = 0; request < TYPE_SCAN_REQUESTS; request++) {
      const page = await this.fetchDeals(query, offset, TYPE_SCAN_CHUNK);
      for (const [index, item] of page.items.entries()) {
        if (item?.kind !== query.type) {
          continue;
        }
        items.push(item);
        if (items.length === query.limit) {
          const hasMore = index < page.items.length - 1 || page.hasMore;
          return { items, hasMore, nextOffset: hasMore ? offset + index + 1 : null };
        }
      }
      if (!page.hasMore) {
        return { items, hasMore: false, nextOffset: null };
      }
      offset = page.nextOffset ?? offset + page.items.length;
    }
    return { items, hasMore: true, nextOffset: offset };
  }

  /** One page of the source; unparseable entries are kept as null to keep offsets right. */
  private async fetchDeals(
    query: DealsQuery,
    offset: number,
    limit: number,
  ): Promise<{ items: (DealListItem | null)[]; hasMore: boolean; nextOffset: number | null }> {
    const params = new URLSearchParams({
      country: query.country,
      offset: String(offset),
      limit: String(limit),
    });
    // Relevance is ITAD's popularity rank: without a sort, ITAD returns the deals in no useful
    // order (mostly DLC, soundtracks and unknown games), decision #73.
    params.set('sort', ITAD_SORTS[query.sort]);
    if (query.shopIds.length > 0) {
      params.set('shops', query.shopIds.join(','));
    }
    const filter: Record<string, unknown> = {};
    if (query.minCut !== null) {
      filter.cut = { min: query.minCut, max: null };
    }
    if (query.minPrice !== null || query.maxPrice !== null) {
      filter.price = { min: query.minPrice, max: query.maxPrice };
    }
    if (query.platform) {
      filter.platform = [ITAD_PLATFORM_IDS[query.platform]];
    }
    if (Object.keys(filter).length > 0) {
      params.set('filter', JSON.stringify(filter));
    }

    const body = await this.request('GET', `/deals/v2?${params}`);
    if (!isObject(body) || !Array.isArray(body.list)) {
      throw new PriceUnavailableError('IsThereAnyDeal deals response has an unexpected shape');
    }
    const items = body.list.map((entry): DealListItem | null => {
      if (!isObject(entry) || typeof entry.id !== 'string' || typeof entry.title !== 'string') {
        return null;
      }
      const deal = parseDeal(entry.deal);
      if (!deal) {
        return null;
      }
      const assets = isObject(entry.assets) ? entry.assets : {};
      return {
        priceGameId: entry.id,
        title: text(entry.title),
        kind: dealKind(entry.type),
        imageUrl: safeUrl(assets.banner400) ?? safeUrl(assets.banner300) ?? safeUrl(assets.boxart),
        deal,
      };
    });
    const hasMore = body.hasMore === true;
    return {
      items,
      hasMore,
      nextOffset: hasMore && isNonNegativeInt(body.nextOffset) ? body.nextOffset : null,
    };
  }

  async listShops(country: string): Promise<PriceShop[]> {
    const body = await this.request('GET', `/service/shops/v1?${new URLSearchParams({ country })}`);
    if (!Array.isArray(body)) {
      throw new PriceUnavailableError('IsThereAnyDeal shops response has an unexpected shape');
    }
    return body
      .flatMap((shop) =>
        isObject(shop) && isNonNegativeInt(shop.id) && typeof shop.title === 'string'
          ? [{ id: shop.id, name: text(shop.title) }]
          : [],
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findGameIds(lookups: PriceLookup[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>(lookups.map((lookup) => [lookup.key, null]));
    const bySteam = lookups.filter((lookup) => lookup.steamAppId);
    const byTitle = lookups.filter((lookup) => !lookup.steamAppId);

    for (const chunk of chunks(bySteam)) {
      const ids = await this.lookupMap(
        `/lookup/id/shop/${ITAD_STEAM_SHOP_ID}/v1`,
        chunk.map((lookup) => `app/${lookup.steamAppId}`),
      );
      for (const lookup of chunk) {
        result.set(lookup.key, ids.get(`app/${lookup.steamAppId}`) ?? null);
      }
    }
    // Without a Steam id: exact title match (the source only matches exact titles).
    for (const chunk of chunks(byTitle)) {
      const ids = await this.lookupMap(
        '/lookup/id/title/v1',
        chunk.map((lookup) => lookup.title),
      );
      for (const lookup of chunk) {
        result.set(lookup.key, ids.get(lookup.title) ?? null);
      }
    }
    return result;
  }

  async getPrices(priceGameIds: string[], country: string): Promise<Map<string, GamePrices>> {
    const result = new Map<string, GamePrices>();
    const params = new URLSearchParams({ country });
    for (const chunk of chunks([...new Set(priceGameIds)])) {
      const body = await this.request('POST', `/games/prices/v3?${params}`, chunk);
      if (!Array.isArray(body)) {
        throw new PriceUnavailableError('IsThereAnyDeal prices response has an unexpected shape');
      }
      for (const entry of body) {
        if (!isObject(entry) || typeof entry.id !== 'string' || !Array.isArray(entry.deals)) {
          continue;
        }
        const historyLow = isObject(entry.historyLow) ? parseMoney(entry.historyLow.all) : null;
        const deals = entry.deals
          .map((deal) => parseDeal(deal))
          .filter((deal): deal is PriceDeal => deal !== null)
          .map((deal) => ({ ...deal, historyLow: deal.historyLow ?? historyLow }))
          .sort((a, b) => a.price.amount - b.price.amount);
        result.set(entry.id, { priceGameId: entry.id, deals, historyLow });
      }
    }
    return result;
  }

  async getHistory(priceGameId: string, since: Date, country: string): Promise<PricePoint[]> {
    const params = new URLSearchParams({
      id: priceGameId,
      country,
      since: since.toISOString(),
    });
    const body = await this.request('GET', `/games/history/v2?${params}`);
    if (!Array.isArray(body)) {
      throw new PriceUnavailableError('IsThereAnyDeal history response has an unexpected shape');
    }
    return body
      .flatMap((entry): PricePoint[] => {
        if (!isObject(entry) || !isObject(entry.deal)) {
          return [];
        }
        const shop = parseShop(entry.shop);
        const price = parseMoney(entry.deal.price);
        const timestamp = isoDate(entry.timestamp);
        return shop && price && timestamp
          ? [{ timestamp, shop, price, regular: parseMoney(entry.deal.regular) }]
          : [];
      })
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async lookupMap(path: string, keys: string[]): Promise<Map<string, string>> {
    const body = await this.request('POST', path, keys);
    if (!isObject(body)) {
      throw new PriceUnavailableError('IsThereAnyDeal lookup response has an unexpected shape');
    }
    return new Map(
      Object.entries(body).filter((entry): entry is [string, string] => isUuid(entry[1])),
    );
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    if (!this.apiKey) {
      throw new PriceUnavailableError('IsThereAnyDeal is not configured (ITAD_API_KEY)');
    }
    const endpoint = path.split('?')[0];
    let response: Response;
    try {
      response = await this.fetchFn(`${ITAD_API_URL}${path}`, {
        method,
        headers: {
          'ITAD-API-Key': this.apiKey,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PriceUnavailableError(`IsThereAnyDeal request to "${endpoint}" failed`, {
        cause: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network',
      });
    }
    if (!response.ok) {
      throw new PriceUnavailableError(
        `IsThereAnyDeal request to "${endpoint}" failed with status ${response.status}`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new PriceUnavailableError(`IsThereAnyDeal response of "${endpoint}" is not JSON`);
    }
  }
}

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    result.push(items.slice(start, start + BATCH_SIZE));
  }
  return result;
}

/** The source's types: game, package (editions, bundles), dlc; anything else is "other". */
function dealKind(type: unknown): DealsType {
  if (type === 'game' || type === 'package') {
    return 'game';
  }
  return type === 'dlc' ? 'dlc' : 'other';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function text(value: string): string {
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

export function parseMoney(value: unknown): Money | null {
  if (
    !isObject(value) ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount < 0 ||
    typeof value.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(value.currency)
  ) {
    return null;
  }
  return { amount: value.amount, currency: value.currency };
}

function parseShop(value: unknown): PriceShop | null {
  return isObject(value) && isNonNegativeInt(value.id) && typeof value.name === 'string'
    ? { id: value.id, name: text(value.name) }
    : null;
}

function names(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        isObject(item) && typeof item.name === 'string' ? [text(item.name)] : [],
      )
    : [];
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Only https links are ever shown (images and offers). */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) {
    return null;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** A deal as the source sends it; null if anything essential is missing or invalid. */
export function parseDeal(value: unknown): PriceDeal | null {
  if (!isObject(value)) {
    return null;
  }
  const shop = parseShop(value.shop);
  const price = parseMoney(value.price);
  const regular = parseMoney(value.regular);
  const url = safeUrl(value.url);
  const timestamp = isoDate(value.timestamp);
  if (!shop || !price || !regular || !url || !timestamp || price.currency !== regular.currency) {
    return null;
  }
  return {
    shop,
    price,
    regular,
    storeLow: parseMoney(value.storeLow),
    historyLow: parseMoney(value.historyLow),
    platforms: names(value.platforms),
    drm: names(value.drm),
    voucher: typeof value.voucher === 'string' ? text(value.voucher) : null,
    timestamp,
    expiry: isoDate(value.expiry),
    url,
  };
}
