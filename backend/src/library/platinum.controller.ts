import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { type PlatinumResponseDto, UpdatePlatinumDto } from './dto/platinum.dto';
import type { UserGameDetailsDto } from './dto/user-game-response.dto';
import { LibraryService } from './library.service';
import { PlatinumService } from './platinum.service';

/** Platinum of one of the user's games. */
@Controller('library/:userGameId/platinum')
export class PlatinumController {
  constructor(
    private readonly platinum: PlatinumService,
    private readonly library: LibraryService,
  ) {}

  @Get()
  get(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<PlatinumResponseDto> {
    return this.platinum.get(user.id, userGameId);
  }

  @Put()
  async update(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: UpdatePlatinumDto,
  ): Promise<UserGameDetailsDto> {
    await this.platinum.update(user.id, userGameId, dto);
    return this.library.get(user.id, userGameId);
  }
}
