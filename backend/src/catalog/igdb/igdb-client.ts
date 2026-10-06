import { CatalogUnavailableError } from '../game-catalog-provider';

export const IGDB_API_URL = 'https://api.igdb.com/v4';
export const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

const REQUEST_TIMEOUT_MS = 10_000;
/** Refresh the token a bit before it really expires. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

export type FetchFn = typeof fetch;

interface CachedToken {
  value: string;
  expiresAt: number;
}

/**
 * Low-level IGDB API client. Handles the Twitch app access token (cached,
 * refreshed on expiry or 401). Errors never include credentials, tokens or
 * response bodies, so they are safe to log.
 */
export class IgdbClient {
  private token: CachedToken | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly credentials: IgdbCredentials | null,
    private readonly fetchFn: FetchFn = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  get isConfigured(): boolean {
    return this.credentials !== null;
  }

  /** Runs an Apicalypse query against an IGDB endpoint (e.g. "games"). */
  async query<T>(endpoint: string, body: string): Promise<T[]> {
    const credentials = this.requireCredentials();

    let response = await this.post(endpoint, body, credentials, await this.getToken());
    if (response.status === 401) {
      // Token revoked or expired early: get a new one and retry once.
      this.token = null;
      response = await this.post(endpoint, body, credentials, await this.getToken());
    }
    if (!response.ok) {
      throw new CatalogUnavailableError(
        `IGDB request to "${endpoint}" failed with status ${response.status}`,
      );
    }
    return (await response.json()) as T[];
  }

  private async post(
    endpoint: string,
    body: string,
    credentials: IgdbCredentials,
    token: string,
  ): Promise<Response> {
    try {
      return await this.fetchFn(`${IGDB_API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': credentials.clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CatalogUnavailableError(`IGDB request to "${endpoint}" could not be completed`, {
        cause: describeNetworkError(error),
      });
    }
  }

  private getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) {
      return Promise.resolve(this.token.value);
    }
    // Concurrent callers share the same token request.
    this.pendingToken ??= this.requestToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async requestToken(): Promise<string> {
    const credentials = this.requireCredentials();
    let response: Response;
    try {
      // Credentials go in the body, never in the URL (URLs end up in logs).
      response = await this.fetchFn(TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CatalogUnavailableError('IGDB authentication could not be completed', {
        cause: describeNetworkError(error),
      });
    }
    if (!response.ok) {
      throw new CatalogUnavailableError(
        `IGDB authentication failed with status ${response.status}`,
      );
    }

    const { access_token: value, expires_in: expiresIn } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = { value, expiresAt: this.now() + expiresIn * 1000 - TOKEN_EXPIRY_MARGIN_MS };
    return value;
  }

  private requireCredentials(): IgdbCredentials {
    if (!this.credentials) {
      throw new CatalogUnavailableError('IGDB is not configured (IGDB_CLIENT_ID/SECRET)');
    }
    return this.credentials;
  }
}

/** Keeps only the error kind/message: never request options, which carry headers. */
function describeNetworkError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'timeout' : `${error.name}: ${error.message}`;
  }
  return 'unknown error';
}
