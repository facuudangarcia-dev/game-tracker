import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { SteamExcludedApp } from '../steam/steam-excluded-app.entity';
import { Achievement } from './achievement.entity';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { PlaythroughTimeAdjustment } from './playthrough-time-adjustment.entity';
import { GamesModule } from '../games/games.module';
import { Platform } from '../platforms/platform.entity';
import { DifficultiesController } from './difficulties.controller';
import { DifficultiesService } from './difficulties.service';
import { Difficulty } from './difficulty.entity';
import { GamingSession } from './gaming-session.entity';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { PlaythroughTime, UserGameSummary } from './library-views.entity';
import { Playthrough } from './playthrough.entity';
import { PlaythroughsController } from './playthroughs.controller';
import { PlaythroughsService } from './playthroughs.service';
import { PlatinumController } from './platinum.controller';
import { PlatinumService } from './platinum.service';
import { PlaytimeController } from './playtime.controller';
import { PlaytimeService } from './playtime.service';
import { UserGameAccess } from './user-game-access.service';
import { UserGame } from './user-game.entity';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    ActivityModule,
    TypeOrmModule.forFeature([
      UserGame,
      Playthrough,
      Difficulty,
      GamingSession,
      PlaythroughTime,
      UserGameSummary,
      Platform,
      Achievement,
      PlaythroughTimeAdjustment,
      SteamExcludedApp,
    ]),
    GamesModule,
    CatalogModule,
  ],
  controllers: [
    LibraryController,
    PlaythroughsController,
    PlaytimeController,
    PlatinumController,
    DifficultiesController,
    AchievementsController,
  ],
  providers: [
    LibraryService,
    UserGameAccess,
    PlaythroughsService,
    PlaytimeService,
    PlatinumService,
    DifficultiesService,
    AchievementsService,
  ],
  exports: [LibraryService, UserGameAccess, DifficultiesService, PlatinumService],
})
export class LibraryModule {}
