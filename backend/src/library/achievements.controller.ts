import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto, UpdateAchievementDto } from './dto/achievement.dto';
import type { UserGameDetailsDto } from './dto/user-game-response.dto';
import { LibraryService } from './library.service';

/**
 * Achievements of one of the user's games (decision #78). Mutations return the
 * updated UserGame (its achievements and their progress).
 */
@Controller('library/:userGameId/achievements')
export class AchievementsController {
  constructor(
    private readonly achievements: AchievementsService,
    private readonly library: LibraryService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Body() dto: CreateAchievementDto,
  ): Promise<UserGameDetailsDto> {
    await this.achievements.create(user.id, userGameId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Patch(':achievementId')
  async update(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('achievementId', ParseUUIDPipe) achievementId: string,
    @Body() dto: UpdateAchievementDto,
  ): Promise<UserGameDetailsDto> {
    await this.achievements.update(user.id, userGameId, achievementId, dto);
    return this.library.get(user.id, userGameId);
  }

  @Delete(':achievementId')
  async remove(
    @CurrentUser() user: User,
    @Param('userGameId', ParseUUIDPipe) userGameId: string,
    @Param('achievementId', ParseUUIDPipe) achievementId: string,
  ): Promise<UserGameDetailsDto> {
    await this.achievements.remove(user.id, userGameId, achievementId);
    return this.library.get(user.id, userGameId);
  }
}
