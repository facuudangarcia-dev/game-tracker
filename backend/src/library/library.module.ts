import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { GamesModule } from '../games/games.module';
import { Platform } from '../platforms/platform.entity';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { PlaythroughTime, UserGameSummary } from './library-views.entity';
import { Playthrough } from './playthrough.entity';
import { UserGame } from './user-game.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserGame, Playthrough, PlaythroughTime, UserGameSummary, Platform]),
    GamesModule,
    CatalogModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
