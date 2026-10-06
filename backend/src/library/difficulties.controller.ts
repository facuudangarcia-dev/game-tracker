import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { DifficultiesService } from './difficulties.service';
import {
  CreateDifficultyDto,
  type DifficultyResponseDto,
  RenameDifficultyDto,
  ReorderDifficultiesDto,
} from './dto/difficulty.dto';

/** Difficulty lists of one of the user's games. Every mutation returns both lists. */
@Controller('library/:userGameId/difficulties')
export class DifficultiesController {
  constructor(private readonly difficulties: DifficultiesService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
  ): Promise<DifficultyResponseDto[]> {
    return this.difficulties.list(user.id, userGameId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: CreateDifficultyDto,
  ): Promise<DifficultyResponseDto[]> {
    return this.difficulties.create(user.id, userGameId, dto);
  }

  /** Full new order of one list. */
  @Put('order')
  reorder(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: ReorderDifficultiesDto,
  ): Promise<DifficultyResponseDto[]> {
    return this.difficulties.reorder(user.id, userGameId, dto);
  }

  @Patch(':difficultyId')
  rename(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('difficultyId', ParseUUIDPipe) difficultyId: string,
    @Body() dto: RenameDifficultyDto,
  ): Promise<DifficultyResponseDto[]> {
    return this.difficulties.rename(user.id, userGameId, difficultyId, dto);
  }

  @Delete(':difficultyId')
  remove(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('difficultyId', ParseUUIDPipe) difficultyId: string,
  ): Promise<DifficultyResponseDto[]> {
    return this.difficulties.remove(user.id, userGameId, difficultyId);
  }
}
