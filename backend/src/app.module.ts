import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ROOT_ENV_FILE } from './config/env.paths';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { GamesModule } from './games/games.module';
import { GenresModule } from './genres/genres.module';
import { HealthModule } from './health/health.module';
import { PlatformsModule } from './platforms/platforms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ROOT_ENV_FILE,
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    PlatformsModule,
    GenresModule,
    GamesModule,
    AssetsModule,
    CatalogModule,
  ],
})
export class AppModule {}
