import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { CreatePlaythroughDto, UpdatePlaythroughDto } from './dto/playthrough.dto';
import type { PlaythroughDto, UserGameDetailsDto } from './dto/user-game-response.dto';
import { LibraryService } from './library.service';
import { PlaythroughsService } from './playthroughs.service';

/**
 * Playthroughs of one of the user's games. Mutations return the updated
 * UserGame, since its derived status, dates and time may change.
 */
@Controller('library/:userGameId/playthroughs')
export class PlaythroughsController {
  constructor(
    private readonly playthroughs: PlaythroughsService,
    private readonly library: LibraryService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<PlaythroughDto[]> {
    return (await this.library.get(user.id, userGameId)).playthroughs;
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: CreatePlaythroughDto,
  ): Promise<UserGameDetailsDto> {
    await this.playthroughs.create(user.id, userGameId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Patch(':playthroughId')
  async update(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('playthroughId', ParseUUIDPipe) playthroughId: string,
    @Body() dto: UpdatePlaythroughDto,
  ): Promise<UserGameDetailsDto> {
    await this.playthroughs.update(user.id, userGameId, playthroughId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Delete(':playthroughId')
  async remove(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('playthroughId', ParseUUIDPipe) playthroughId: string,
  ): Promise<UserGameDetailsDto> {
    await this.playthroughs.remove(user.id, userGameId, playthroughId);
    return this.library.get(user.id, userGameId);
  }
}
