import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { CreateUserGameDto } from './dto/create-user-game.dto';
import { ListLibraryQueryDto } from './dto/list-library.dto';
import { UpdateUserGameDto } from './dto/update-user-game.dto';
import type { UserGameDetailsDto, UserGameListItemDto } from './dto/user-game-response.dto';
import { LibraryService } from './library.service';

/** The current user's library. Every route requires a session and checks ownership. */
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query() query: ListLibraryQueryDto,
  ): Promise<UserGameListItemDto[]> {
    return this.library.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateUserGameDto): Promise<UserGameDetailsDto> {
    return this.library.create(user.id, dto);
  }

  @Get(':userGameId')
  get(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<UserGameDetailsDto> {
    return this.library.get(user.id, userGameId);
  }

  @Patch(':userGameId')
  update(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: UpdateUserGameDto,
  ): Promise<UserGameDetailsDto> {
    return this.library.update(user.id, userGameId, dto);
  }

  @Delete(':userGameId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<void> {
    return this.library.remove(user.id, userGameId);
  }
}
