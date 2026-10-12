import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { buildDataSourceOptions } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions({
          POSTGRES_HOST: config.get('POSTGRES_HOST', { infer: true }),
          POSTGRES_PORT: config.get('POSTGRES_PORT', { infer: true }),
          POSTGRES_USER: config.get('POSTGRES_USER', { infer: true }),
          POSTGRES_PASSWORD: config.get('POSTGRES_PASSWORD', { infer: true }),
          POSTGRES_DB: config.get('POSTGRES_DB', { infer: true }),
        }),
        // Entities are registered per feature module via TypeOrmModule.forFeature().
        entities: [],
        autoLoadEntities: true,
        // Locally, migrations are applied with `npm run migration:run`. Deploys
        // set DB_MIGRATIONS_RUN=true: the compiled ones run on start (decision #89).
        ...(config.get('DB_MIGRATIONS_RUN', { infer: true }) === 'true'
          ? { migrationsRun: true, migrations: [join(__dirname, 'migrations', '*.js')] }
          : { migrations: [] }),
      }),
    }),
  ],
})
export class DatabaseModule {}
