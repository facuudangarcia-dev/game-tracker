import {
  type DealListItem,
  type DealsPage,
  type DealsQuery,
  type GamePrices,
  type PriceDeal,
  type PriceLookup,
  type PricePoint,
  type PriceProvider,
  PriceProviderId,
  type PriceShop,
  PriceUnavailableError,
} from '../src/deals/price-provider';

/** A deal in USD at Steam unless overridden. */
export function fakeDeal(
  price: number,
  regular: number,
  extra: Partial<PriceDeal> = {},
): PriceDeal {
  return {
    shop: { id: 61, name: 'Steam' },
    price: { amount: price, currency: 'USD' },
    regular: { amount: regular, currency: 'USD' },
    storeLow: null,
    historyLow: null,
    platforms: ['Windows'],
    drm: ['Steam'],
    voucher: null,
    timestamp: '2026-10-09T08:00:00.000Z',
    expiry: null,
    url: 'https://itad.link/fake/',
    ...extra,
  };
}

/** In-memory price source used by e2e tests instead of IsThereAnyDeal. */
export class FakePriceProvider implements PriceProvider {
  readonly id = PriceProviderId.Itad;
  readonly attribution = { name: 'IsThereAnyDeal', url: 'https://isthereanydeal.com' };
  configured = true;
  failing = false;
  deals: DealListItem[] = [];
  shops: PriceShop[] = [];
  /** Source ids by Steam app id and by exact title. */
  steamIds = new Map<string, string>();
  titleIds = new Map<string, string>();
  prices = new Map<string, GamePrices>();
  history = new Map<string, PricePoint[]>();
  queries: DealsQuery[] = [];
  /** Countries asked for by each method, in order. */
  priceCountries: string[] = [];
  shopCountries: string[] = [];
  historyCountries: string[] = [];
  calls = { listDeals: 0, findGameIds: 0, getPrices: 0, getHistory: 0 };

  get isConfigured(): boolean {
    return this.configured;
  }

  reset(): void {
    this.configured = true;
    this.failing = false;
    this.deals = [];
    this.shops = [];
    this.steamIds = new Map();
    this.titleIds = new Map();
    this.prices = new Map();
    this.history = new Map();
    this.queries = [];
    this.priceCountries = [];
    this.shopCountries = [];
    this.historyCountries = [];
    this.calls = { listDeals: 0, findGameIds: 0, getPrices: 0, getHistory: 0 };
  }

  /** Registers a game found by title with its current deals. */
  addGame(id: string, title: string, deals: PriceDeal[], historyLow: number | null = null): void {
    this.titleIds.set(title, id);
    this.prices.set(id, {
      priceGameId: id,
      deals: [...deals].sort((a, b) => a.price.amount - b.price.amount),
      historyLow: historyLow === null ? null : { amount: historyLow, currency: 'USD' },
    });
  }

  listDeals(query: DealsQuery): Promise<DealsPage> {
    this.calls.listDeals++;
    this.queries.push(query);
    this.throwIfFailing();
    const deals = query.type ? this.deals.filter((deal) => deal.kind === query.type) : this.deals;
    const items = deals.slice(query.offset, query.offset + query.limit);
    const hasMore = query.offset + query.limit < deals.length;
    return Promise.resolve({
      items,
      hasMore,
      nextOffset: hasMore ? query.offset + query.limit : null,
    });
  }

  listShops(country: string): Promise<PriceShop[]> {
    this.shopCountries.push(country);
    this.throwIfFailing();
    return Promise.resolve(this.shops);
  }

  findGameIds(lookups: PriceLookup[]): Promise<Map<string, string | null>> {
    this.calls.findGameIds++;
    this.throwIfFailing();
    return Promise.resolve(
      new Map(
        lookups.map((lookup) => [
          lookup.key,
          (lookup.steamAppId
            ? this.steamIds.get(lookup.steamAppId)
            : this.titleIds.get(lookup.title)) ?? null,
        ]),
      ),
    );
  }

  getPrices(priceGameIds: string[], country: string): Promise<Map<string, GamePrices>> {
    this.calls.getPrices++;
    this.priceCountries.push(country);
    this.throwIfFailing();
    return Promise.resolve(
      new Map(
        priceGameIds.flatMap((id) => {
          const prices = this.prices.get(id);
          return prices ? [[id, prices] as const] : [];
        }),
      ),
    );
  }

  getHistory(priceGameId: string, _since: Date, country: string): Promise<PricePoint[]> {
    this.calls.getHistory++;
    this.historyCountries.push(country);
    this.throwIfFailing();
    return Promise.resolve(this.history.get(priceGameId) ?? []);
  }

  private throwIfFailing(): void {
    if (!this.configured || this.failing) {
      throw new PriceUnavailableError('fake price source is down');
    }
  }
}
