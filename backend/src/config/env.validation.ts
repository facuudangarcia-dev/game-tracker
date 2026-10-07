import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { AssetStorageDriver } from '../assets/asset-storage';
import { CatalogProvider } from '../catalog/catalog-provider';

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

  @IsEnum(AssetStorageDriver)
  ASSET_STORAGE_DRIVER: AssetStorageDriver = AssetStorageDriver.Local;

  /** Local driver only. Relative paths are resolved from backend/. */
  @IsString()
  @IsNotEmpty()
  ASSET_STORAGE_LOCAL_DIR: string = 'storage';
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
