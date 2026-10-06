import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserGame,
      Playthrough,
      Difficulty,
      GamingSession,
      PlaythroughTime,
      UserGameSummary,
      Platform,
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
  ],
  providers: [
    LibraryService,
    UserGameAccess,
    PlaythroughsService,
    PlaytimeService,
    PlatinumService,
    DifficultiesService,
  ],
  exports: [LibraryService, UserGameAccess],
})
export class LibraryModule {}
