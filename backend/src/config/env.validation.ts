import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { AssetStorageDriver } from '../assets/asset-storage';
import { CatalogProvider } from '../catalog/catalog-provider';
import { PriceProviderId } from '../deals/price-provider';
import { NewsProviderId } from '../news/news-provider';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Environment variables required by the backend. The app refuses to start if
 * any of them is missing or invalid, so misconfiguration fails fast.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  BACKEND_PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  POSTGRES_PORT: number;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  @IsString()
  @MinLength(32)
  AUTH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  AUTH_COOKIE_NAME: string = 'gt_session';

  @IsInt()
  @Min(1)
  AUTH_SESSION_TTL_DAYS: number = 30;

  @IsInt()
  @Min(1)
  AUTH_RATE_LIMIT_PER_MINUTE: number = 10;

  @IsEnum(CatalogProvider)
  CATALOG_PROVIDER: CatalogProvider = CatalogProvider.Igdb;

  // Optional: without them the app runs and search falls back to local results.
  @IsOptional()
  @IsString()
  IGDB_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  IGDB_CLIENT_SECRET?: string;

  // Email delivery (Resend). Required to run the app (verification is mandatory);
  // tests replace the email service with a mock and never need them.
  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV !== NodeEnv.Test)
  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY?: string;

  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV !== NodeEnv.Test)
  @IsString()
  @IsNotEmpty()
  EMAIL_FROM?: string;

  // Where user reports are emailed (decision #87). Optional: without it reports
  // are only stored in the database.
  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  // Deals and price tracking (decision #66). Optional: without a key the Deals
  // page explains what's missing and nothing is invented.
  @IsEnum(PriceProviderId)
  PRICE_PROVIDER: PriceProviderId = PriceProviderId.Itad;

  @IsOptional()
  @IsString()
  ITAD_API_KEY?: string;

  /**
   * Steam Web API key (decision #78), free at https://steamcommunity.com/dev/apikey.
   * Optional: without it, Steam linking is off. Secret: never logged.
   */
  @IsOptional()
  @IsString()
  STEAM_API_KEY?: string;

  /**
   * Default country of prices (ISO 3166-1 alpha-2), when the user hasn't chosen
   * one (decision #68). The currency is the source's.
   */
  @Matches(/^[A-Z]{2}$/)
  ITAD_COUNTRY: string = 'AR';

  // News (decisions #67, #68): comma-separated RSS/Atom feed URLs per interface
  // language. Optional: a language without feeds uses the other one's; without
  // any, the News page explains how to configure them.
  @IsEnum(NewsProviderId)
  NEWS_PROVIDER: NewsProviderId = NewsProviderId.Rss;

  @IsOptional()
  @IsString()
  NEWS_RSS_FEEDS_ES?: string;

  @IsOptional()
  @IsString()
  NEWS_RSS_FEEDS_EN?: string;

  /** Replaced by NEWS_RSS_FEEDS_ES / _EN; only read to warn about it. */
  @IsOptional()
  @IsString()
  NEWS_RSS_FEEDS?: string;

  @IsEnum(AssetStorageDriver)
  ASSET_STORAGE_DRIVER: AssetStorageDriver = AssetStorageDriver.Local;

  /** Local driver only. Relative paths are resolved from backend/. */
  @IsString()
  @IsNotEmpty()
  ASSET_STORAGE_LOCAL_DIR: string = 'storage';

  // --- Production (decision #89) ---------------------------------------------
  /** Port assigned by the host (Railway); takes precedence over BACKEND_PORT. */
  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  /**
   * Built frontend (Vite's dist) served by the API itself, so the app is one
   * service and one origin. Unset in development (Vite serves it).
   */
  @IsOptional()
  @IsString()
  FRONTEND_DIST_DIR?: string;

  /** "true": apply pending migrations when the app starts (deploys). */
  @IsIn(['true', 'false'])
  DB_MIGRATIONS_RUN: string = 'false';

  /**
   * Reverse proxies in front of the app, to read the real client IP (rate
   * limits) and the HTTPS scheme: 0 locally, 1 on Railway.
   */
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS: number = 0;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return validated;
}
