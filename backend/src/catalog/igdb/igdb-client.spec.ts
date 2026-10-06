import { CatalogUnavailableError } from '../game-catalog-provider';
import { type FetchFn, IGDB_API_URL, IgdbClient, TWITCH_TOKEN_URL } from './igdb-client';

const credentials = { clientId: 'test-client-id', clientSecret: 'test-client-secret' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokenResponse(token: string, expiresIn = 3600): Response {
  return json({ access_token: token, expires_in: expiresIn, token_type: 'bearer' });
}

function setup(responses: ((url: string, init?: RequestInit) => Response)[], now = () => 0) {
  const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>((input, init) => {
    const next = responses.shift();
    if (!next) {
      throw new Error('Unexpected request');
    }
    return Promise.resolve(next(input as string, init));
  });
  return { client: new IgdbClient(credentials, fetchMock as FetchFn, now), fetchMock };
}

const urlOf = (call: Parameters<FetchFn>) => call[0] as string;
const headersOf = (call: Parameters<FetchFn>) => call[1]?.headers as Record<string, string>;

describe('IgdbClient', () => {
  it('gets a token with credentials in the body (not the URL) and queries the API', async () => {
    const { client, fetchMock } = setup([() => tokenResponse('token-1'), () => json([{ id: 1 }])]);

    await expect(client.query('games', 'fields name;')).resolves.toEqual([{ id: 1 }]);

    const [tokenCall, queryCall] = fetchMock.mock.calls;
    expect(urlOf(tokenCall)).toBe(TWITCH_TOKEN_URL);
    expect(urlOf(tokenCall)).not.toContain(credentials.clientSecret);
    expect((tokenCall[1]?.body as URLSearchParams).toString()).toContain(
      'client_secret=test-client-secret',
    );
    expect(urlOf(queryCall)).toBe(`${IGDB_API_URL}/games`);
    expect(headersOf(queryCall)).toMatchObject({
      'Client-ID': credentials.clientId,
      Authorization: 'Bearer token-1',
    });
    expect(queryCall[1]?.body).toBe('fields name;');
  });

  it('reuses the token until it is about to expire', async () => {
    let now = 0;
    const { client, fetchMock } = setup(
      [
        () => tokenResponse('token-1', 3600),
        () => json([]),
        () => json([]),
        () => tokenResponse('token-2', 3600),
        () => json([]),
      ],
      () => now,
    );

    await client.query('games', 'q');
    now = 30 * 60 * 1000;
    await client.query('games', 'q');
    now = 3600 * 1000 - 30_000; // inside the safety margin
    await client.query('games', 'q');

    const tokenCalls = fetchMock.mock.calls.filter((c) => urlOf(c) === TWITCH_TOKEN_URL);
    expect(tokenCalls).toHaveLength(2);
    expect(headersOf(fetchMock.mock.calls[4]).Authorization).toBe('Bearer token-2');
  });

  it('refreshes the token and retries once on 401', async () => {
    const { client, fetchMock } = setup([
      () => tokenResponse('stale'),
      () => json({ message: 'Unauthorized' }, 401),
      () => tokenResponse('fresh'),
      () => json([{ id: 7 }]),
    ]);

    await expect(client.query('games', 'q')).resolves.toEqual([{ id: 7 }]);
    expect(headersOf(fetchMock.mock.calls[3]).Authorization).toBe('Bearer fresh');
  });

  it('shares a single token request between concurrent queries', async () => {
    const { client, fetchMock } = setup([
      () => tokenResponse('token'),
      () => json([]),
      () => json([]),
    ]);

    await Promise.all([client.query('games', 'a'), client.query('games', 'b')]);

    expect(fetchMock.mock.calls.filter((c) => urlOf(c) === TWITCH_TOKEN_URL)).toHaveLength(1);
  });

  it('fails with CatalogUnavailableError when not configured, without calling the network', async () => {
    const fetchMock = jest.fn<Promise<Response>, Parameters<FetchFn>>();
    const client = new IgdbClient(null, fetchMock);

    expect(client.isConfigured).toBe(false);
    await expect(client.query('games', 'q')).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never leaks credentials or response bodies in errors', async () => {
    const { client } = setup([
      () => json({ message: `bad secret ${credentials.clientSecret}` }, 400),
    ]);

    const error = (await client.query('games', 'q').catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(CatalogUnavailableError);
    expect(error.message).toBe('IGDB authentication failed with status 400');
    expect(JSON.stringify(error)).not.toContain(credentials.clientSecret);
  });

  it('maps API failures and network errors to CatalogUnavailableError', async () => {
    const { client } = setup([
      () => tokenResponse('token'),
      () => json({}, 503),
      () => {
        throw new TypeError('fetch failed');
      },
    ]);

    await expect(client.query('games', 'q')).rejects.toThrow(
      'IGDB request to "games" failed with status 503',
    );
    await expect(client.query('games', 'q')).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});
