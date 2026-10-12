import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivityModule } from './activity/activity.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ROOT_ENV_FILE } from './config/env.paths';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DealsModule } from './deals/deals.module';
import { SocialModule } from './social/social.module';
import { SteamModule } from './steam/steam.module';
import { GamesModule } from './games/games.module';
import { GenresModule } from './genres/genres.module';
import { HealthModule } from './health/health.module';
import { LibraryModule } from './library/library.module';
import { NewsModule } from './news/news.module';
import { PlatformsModule } from './platforms/platforms.module';
import { PlayersModule } from './players/players.module';
import { ProfileModule } from './profile/profile.module';
import { UsersModule } from './users/users.module';
import { WishlistModule } from './wishlist/wishlist.module';

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
    LibraryModule,
    ProfileModule,
    DealsModule,
    SteamModule,
    WishlistModule,
    SocialModule,
    PlayersModule,
    ActivityModule,
    NewsModule,
  ],
})
export class AppModule {}
