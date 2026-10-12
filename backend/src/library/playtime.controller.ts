import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { CreateSessionDto, type SessionResponseDto, UpdateSessionDto } from './dto/session.dto';
import type { UserGameDetailsDto } from './dto/user-game-response.dto';
import { LibraryService } from './library.service';
import { PlaytimeService } from './playtime.service';

/**
 * Sessions of one of the user's games. Mutations return the updated
 * UserGame (times, derived values and sessions change together).
 */
@Controller('library/:userGameId')
export class PlaytimeController {
  constructor(
    private readonly playtime: PlaytimeService,
    private readonly library: LibraryService,
  ) {}

  @Get('sessions')
  listSessions(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<SessionResponseDto[]> {
    return this.playtime.list(user.id, userGameId);
  }

  @Post('playthroughs/:playthroughId/sessions')
  async createSession(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('playthroughId', ParseUUIDPipe) playthroughId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<UserGameDetailsDto> {
    await this.playtime.createSession(user.id, userGameId, playthroughId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Patch('sessions/:sessionId')
  async updateSession(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<UserGameDetailsDto> {
    await this.playtime.updateSession(user.id, userGameId, sessionId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Delete('sessions/:sessionId')
  async removeSession(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<UserGameDetailsDto> {
    await this.playtime.removeSession(user.id, userGameId, sessionId);
    return this.library.get(user.id, userGameId);
  }
}
