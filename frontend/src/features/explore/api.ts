import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useLocale } from '../../i18n/locale';
import type { Locale } from '../../i18n/messages';
import { apiFetch } from '../../lib/api/client';
import { usePriceCountry } from './priceCountry';
import type {
  DealsFilters,
  DealsPage,
  DiscoverFilters,
  GamePrices,
  DiscoverPage,
  NewsFilter,
  NewsPage,
  PriceHistory,
  Recommendations,
  RecommendedDeals,
  Releases,
  Shops,
  UndatedGames,
  Wishlist,
  WishlistItem,
} from './types';

/** Query string without empty values. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// Every catalog-based list starts with "catalog": adding a game or changing the
// wishlist invalidates them all (their cards show the user's presence). Prices
// depend on the country and news on the language (decision #68).
export const exploreKeys = {
  discover: (filters: DiscoverFilters) => ['catalog', 'discover', filters] as const,
  recommendations: ['catalog', 'recommendations'] as const,
  releases: (from: string, to: string, platform?: string, genre?: string) =>
    ['catalog', 'releases', from, to, platform ?? '', genre ?? ''] as const,
  undated: (platform?: string, genre?: string) =>
    ['catalog', 'undated', platform ?? '', genre ?? ''] as const,
  deals: (country: Country, filters: DealsFilters) => ['deals', 'list', country, filters] as const,
  shops: (country: Country) => ['deals', 'shops', country] as const,
  recommendedDeals: (country: Country) => ['deals', 'recommended', country] as const,
  gamePrices: (country: Country, provider: string, externalId: string) =>
    ['deals', 'game', country, provider, externalId] as const,
  wishlist: (country: Country) => ['wishlist', 'list', country] as const,
  history: (country: Country, itemId: string) => ['wishlist', 'history', country, itemId] as const,
  news: (lang: Locale, category: NewsFilter | undefined, q: string) =>
    ['news', lang, category ?? '', q] as const,
};

/** Country of prices; undefined = the backend's default. */
type Country = string | undefined;

/** Discover grid, page by page ("Load more"). */
export function useDiscover(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: exploreKeys.discover(filters),
    queryFn: ({ pageParam }) =>
      apiFetch<DiscoverPage>(
        `/catalog/discover${query({ ...filters, page: pageParam === 1 ? undefined : pageParam })}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useRecommendations() {
  return useQuery({
    queryKey: exploreKeys.recommendations,
    queryFn: () => apiFetch<Recommendations>('/catalog/recommendations'),
    staleTime: 5 * 60_000,
  });
}

export function useReleases(from: string, to: string, platform?: string, genre?: string) {
  return useQuery({
    queryKey: exploreKeys.releases(from, to, platform, genre),
    queryFn: () => apiFetch<Releases>(`/catalog/releases${query({ from, to, platform, genre })}`),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });
}

export function useUndatedGames(platform?: string, genre?: string) {
  return useQuery({
    queryKey: exploreKeys.undated(platform, genre),
    queryFn: () => apiFetch<UndatedGames>(`/catalog/releases/undated${query({ platform, genre })}`),
    staleTime: 10 * 60_000,
  });
}

export function useDeals(filters: DealsFilters) {
  const country = usePriceCountry();
  return useInfiniteQuery({
    queryKey: exploreKeys.deals(country, filters),
    queryFn: ({ pageParam }) =>
      apiFetch<DealsPage>(
        `/deals${query({
          country,
          sort: filters.sort,
          shops: filters.shop,
          platform: filters.platform,
          type: filters.type,
          minCut: filters.minCut,
          maxPrice: filters.maxPrice,
          offset: pageParam || undefined,
        })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? (last.nextOffset ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useShops() {
  const country = usePriceCountry();
  return useQuery({
    queryKey: exploreKeys.shops(country),
    queryFn: () => apiFetch<Shops>(`/deals/shops${query({ country })}`),
    staleTime: 60 * 60_000,
  });
}

export function useRecommendedDeals() {
  const country = usePriceCountry();
  return useQuery({
    queryKey: exploreKeys.recommendedDeals(country),
    queryFn: () => apiFetch<RecommendedDeals>(`/deals/recommended${query({ country })}`),
    staleTime: 5 * 60_000,
  });
}

/** PC prices of a catalog game, for its page. */
export function useGamePrices(provider: string, externalId: string) {
  const country = usePriceCountry();
  return useQuery({
    queryKey: exploreKeys.gamePrices(country, provider, externalId),
    queryFn: () =>
      apiFetch<GamePrices>(
        `/deals/games/${encodeURIComponent(provider)}/${encodeURIComponent(externalId)}${query({ country })}`,
      ),
    // While another country loads, the panel keeps this game's prices (never another game's).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === provider && previousQuery.queryKey[4] === externalId
        ? previous
        : undefined,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** News of the interface language's outlets. */
export function useNews(category: NewsFilter | undefined, q: string) {
  const lang = useLocale();
  return useInfiniteQuery({
    queryKey: exploreKeys.news(lang, category, q),
    queryFn: ({ pageParam }) =>
      apiFetch<NewsPage>(
        `/news${query({ lang, category, q, page: pageParam === 1 ? undefined : pageParam })}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useWishlist(enabled = true) {
  const country = usePriceCountry();
  return useQuery({
    queryKey: exploreKeys.wishlist(country),
    queryFn: () => apiFetch<Wishlist>(`/wishlist${query({ country })}`),
    enabled,
  });
}

export function usePriceHistory(itemId: string | null) {
  const country = usePriceCountry();
  return useQuery({
    queryKey: exploreKeys.history(country, itemId ?? ''),
    queryFn: () => apiFetch<PriceHistory>(`/wishlist/${itemId}/history${query({ country })}`),
    enabled: itemId !== null,
    staleTime: 60 * 60_000,
  });
}

/** Refreshes everything that shows wishlist membership or wishlist-based deals. */
function useInvalidateWishlist() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['deals', 'recommended'] }),
    ]);
}

export function useAddToWishlist() {
  const invalidate = useInvalidateWishlist();
  const country = usePriceCountry();
  return useMutation({
    mutationFn: (game: { provider: string; externalId: string }) =>
      apiFetch<WishlistItem>(`/wishlist${query({ country })}`, {
        method: 'POST',
        body: JSON.stringify({ provider: game.provider, externalId: game.externalId }),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveFromWishlist() {
  const invalidate = useInvalidateWishlist();
  return useMutation({
    mutationFn: (itemId: string) => apiFetch<void>(`/wishlist/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

export function useSetTargetPrice() {
  const queryClient = useQueryClient();
  const country = usePriceCountry();
  return useMutation({
    mutationFn: ({ itemId, targetPrice }: { itemId: string; targetPrice: number | null }) =>
      apiFetch<WishlistItem>(`/wishlist/${itemId}${query({ country })}`, {
        method: 'PATCH',
        body: JSON.stringify({ targetPrice }),
      }),
    onSuccess: (item) => {
      queryClient.setQueryData<Wishlist>(exploreKeys.wishlist(country), (wishlist) =>
        wishlist
          ? { ...wishlist, items: wishlist.items.map((i) => (i.id === item.id ? item : i)) }
          : wishlist,
      );
    },
  });
}
