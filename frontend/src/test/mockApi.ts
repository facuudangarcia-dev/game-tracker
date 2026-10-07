import { vi } from 'vitest';

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (request: MockRequest) => { status: number; body?: unknown };

/**
 * Stubs global fetch with handlers keyed by "METHOD /path" (path without the
 * /api prefix, query string included). Health and an empty library are answered
 * by default (also empty platforms and genres); unhandled requests fail the test loudly.
 */
/** Stats of a player without games. */
export const emptyStats = {
  totalGames: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  platinums: 0,
  totalMinutes: 0,
  rated: 0,
  averageRating: null,
  playthroughs: 0,
  topPlatform: null,
};

export function mockApi(customHandlers: Record<string, Handler>) {
  const handlers: Record<string, Handler> = {
    'GET /health': healthOk,
    'GET /library': () => ({ status: 200, body: [] }),
    'GET /platforms': () => ({ status: 200, body: [] }),
    'GET /genres': () => ({ status: 200, body: [] }),
    'GET /profile/stats': () => ({ status: 200, body: emptyStats }),
    'GET /catalog/highlights': () => ({
      status: 200,
      body: { recent: [], upcoming: [], catalogAvailable: true },
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
  createdAt: '2026-10-04T12:00:00.000Z',
};

export const healthOk = () => ({ status: 200, body: { status: 'ok', database: 'up' } });
export const unauthenticated = () => ({ status: 401, body: { code: 'UNAUTHENTICATED' } });
