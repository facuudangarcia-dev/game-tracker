import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import type { EnvironmentVariables } from '../config/env.validation';
import { Achievement } from '../library/achievement.entity';
import { Game } from '../games/game.entity';
import { LibraryModule } from '../library/library.module';
import { Playthrough } from '../library/playthrough.entity';
import { UserGame } from '../library/user-game.entity';
import { Platform } from '../platforms/platform.entity';
import { SteamAccount } from './steam-account.entity';
import { STEAM_API } from './steam-api';
import { SteamExcludedApp } from './steam-excluded-app.entity';
import { SteamPendingApp } from './steam-pending-app.entity';
import { SteamWebApi } from './steam-web-api';
import { SteamController } from './steam.controller';
import { SteamService } from './steam.service';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SteamAccount,
      SteamExcludedApp,
      SteamPendingApp,
      Game,
      UserGame,
      Playthrough,
      Achievement,
      Platform,
    ]),
    CatalogModule,
    LibraryModule,
    ActivityModule,
  ],
  controllers: [SteamController],
  providers: [
    {
      provide: STEAM_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const apiKey = config.get('STEAM_API_KEY', { infer: true })?.trim() || null;
        if (!apiKey) {
          new Logger('SteamModule').warn('STEAM_API_KEY not configured: Steam linking is off');
        }
        return new SteamWebApi(apiKey);
      },
    },
    SteamService,
  ],
})
export class SteamModule {}
