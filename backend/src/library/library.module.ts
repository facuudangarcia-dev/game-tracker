import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { GamesModule } from '../games/games.module';
import { Platform } from '../platforms/platform.entity';
import { DifficultiesController } from './difficulties.controller';
import { DifficultiesService } from './difficulties.service';
import { Difficulty } from './difficulty.entity';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { PlaythroughTime, UserGameSummary } from './library-views.entity';
import { Playthrough } from './playthrough.entity';
import { PlaythroughsController } from './playthroughs.controller';
import { PlaythroughsService } from './playthroughs.service';
import { UserGameAccess } from './user-game-access.service';
import { UserGame } from './user-game.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserGame,
      Playthrough,
      Difficulty,
      PlaythroughTime,
      UserGameSummary,
      Platform,
    ]),
    GamesModule,
    CatalogModule,
  ],
  controllers: [LibraryController, PlaythroughsController, DifficultiesController],
  providers: [LibraryService, UserGameAccess, PlaythroughsService, DifficultiesService],
  exports: [LibraryService, UserGameAccess],
})
export class LibraryModule {}
