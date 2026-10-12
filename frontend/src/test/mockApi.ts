import { vi } from 'vitest';

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (request: MockRequest) => { status: number; body?: unknown };

/**
 * Stubs global fetch with handlers keyed by "METHOD /path" (path without the
 * /api prefix, query string included). An empty library is answered by default (also empty platforms and genres); unhandled requests fail the test loudly.
 */
/** Stats of a player without games. */
export const emptyStats = {
  totalGames: 0,
  completed: 0,
  inProgress: 0,
  played: 0,
  pending: 0,
  platinums: 0,
  totalMinutes: 0,
  rated: 0,
  averageRating: null,
  playthroughs: 0,
  topPlatform: null,
};

/** Profile highlights of a player without games. */
export const emptyHighlights = {
  mostPlayed: null,
  fastest: null,
  highestRated: null,
  lowestRated: null,
  favorites: [],
};

/** Price source without a key (ITAD_API_KEY). */
export const notConfiguredPrices = {
  configured: false,
  available: false,
  country: 'AR',
  source: { name: 'IsThereAnyDeal', url: 'https://isthereanydeal.com' },
};

/** News without feeds (NEWS_RSS_FEEDS_ES / _EN). */
export const notConfiguredNews = {
  configured: false,
  language: 'es',
  available: false,
  sources: [],
  failedSources: [],
  fetchedAt: null,
  items: [],
  total: 0,
  page: 1,
  hasMore: false,
};

export function mockApi(customHandlers: Record<string, Handler>) {
  const handlers: Record<string, Handler> = {
    'GET /library': () => ({ status: 200, body: [] }),
    'GET /platforms': () => ({ status: 200, body: [] }),
    'GET /genres': () => ({ status: 200, body: [] }),
    // Steam linking (decision #78) not configured.
    'GET /steam': () => ({ status: 200, body: { configured: false, account: null, excluded: [] } }),
    // Social (decision #84): no friends nor requests.
    'GET /friends': () => ({ status: 200, body: { friends: [], incoming: [], outgoing: [] } }),
    'GET /profile/stats': () => ({ status: 200, body: emptyStats }),
    'GET /profile/highlights': () => ({ status: 200, body: emptyHighlights }),
    'GET /catalog/highlights': () => ({
      status: 200,
      body: { recent: [], upcoming: [], catalogAvailable: true },
    }),
    // Home modules (decisions #64-#67): nothing to recommend, sources not configured.
    'GET /catalog/recommendations': () => ({
      status: 200,
      body: { personalized: false, basedOnGenres: [], games: [], catalogAvailable: true },
    }),
    'GET /news?lang=es': () => ({ status: 200, body: notConfiguredNews }),
    'GET /deals/recommended?country=AR': () => ({
      status: 200,
      body: { ...notConfiguredPrices, personalized: false, items: [] },
    }),
    ...customHandlers,
  };
  const calls: MockRequest[] = [];

  const fetchMock = vi.fn((input: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const path = input.replace(/^\/api/, '');
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const request = { method, path, body };
    calls.push(request);

    const handler = handlers[`${method} ${path}`];
    if (!handler) {
      return Promise.reject(new Error(`Unhandled request: ${method} ${path}`));
    }
    const { status, body: responseBody } = handler(request);
    return Promise.resolve(
      responseBody === undefined
        ? new Response(null, { status })
        : new Response(JSON.stringify(responseBody), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}

export const testUser = {
  id: 'user-1',
  username: 'player_one',
  email: 'player@example.com',
  emailVerified: true,
  avatar: null,
  country: null,
  profileVisibility: 'FRIENDS' as const,
  legalAcceptanceRequired: false,
  createdAt: '2026-10-04T12:00:00.000Z',
};
export const unauthenticated = () => ({ status: 401, body: { code: 'UNAUTHENTICATED' } });
