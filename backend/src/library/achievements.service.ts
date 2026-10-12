import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '../common/api-error';
import { Achievement } from './achievement.entity';
import type {
  AchievementDto,
  CreateAchievementDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';
import { LibraryErrorCode } from './library.constants';
import { UserGameAccess } from './user-game-access.service';
import { ActivityType } from '../activity/activity.entity';
import { ActivityService } from '../activity/activity.service';

export function toAchievementDto(achievement: Achievement): AchievementDto {
  return {
    id: achievement.id,
    source: achievement.steamApiName ? 'STEAM' : 'MANUAL',
    name: achievement.name,
    description: achievement.description,
    nameEs: achievement.nameEs,
    descriptionEs: achievement.descriptionEs,
    iconUrl: achievement.iconUrl,
    iconLockedUrl: achievement.iconLockedUrl,
    hidden: achievement.hidden,
    achieved: achievement.achieved,
    achievedAt: achievement.achievedAt?.toISOString() ?? null,
  };
}

/**
 * Achievements of one of the user's games (decision #78): Steam's (synced) and
 * the user's own. Any of them can be checked; only the user's own can be
 * edited or deleted.
 */
@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement) private readonly achievements: Repository<Achievement>,
    private readonly access: UserGameAccess,
    private readonly activity: ActivityService,
  ) {}

  /** Steam's first (in Steam's order), then the user's own in creation order. */
  async listFor(userGameId: string): Promise<AchievementDto[]> {
    const rows = await this.achievements
      .createQueryBuilder('a')
      .where('a.user_game_id = :userGameId', { userGameId })
      .orderBy('a.steam_api_name IS NULL', 'ASC')
      .addOrderBy('a.position', 'ASC')
      .addOrderBy('a.created_at', 'ASC')
      .getMany();
    return rows.map(toAchievementDto);
  }

  async create(userId: string, userGameId: string, dto: CreateAchievementDto): Promise<void> {
    await this.access.requireOwned(userId, userGameId);
    const { max } = (await this.achievements
      .createQueryBuilder('a')
      .select('COALESCE(MAX(a.position), -1)', 'max')
      .where('a.user_game_id = :userGameId AND a.steam_api_name IS NULL', { userGameId })
      .getRawOne<{ max: number }>())!;
    await this.achievements.insert({
      userGameId,
      name: dto.name,
      description: dto.description ?? null,
      position: Number(max) + 1,
    });
  }

  async update(
    userId: string,
    userGameId: string,
    achievementId: string,
    dto: UpdateAchievementDto,
  ): Promise<void> {
    const achievement = await this.requireAchievement(userId, userGameId, achievementId);
    const editsTexts = dto.name !== undefined || dto.description !== undefined;
    if (editsTexts && achievement.steamApiName) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.SteamAchievementReadOnly,
        "Steam achievements' texts come from Steam",
      );
    }
    await this.achievements.update(
      { id: achievement.id },
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.achieved !== undefined &&
          dto.achieved !== achievement.achieved && {
            achieved: dto.achieved,
            achievedAt: dto.achieved ? new Date() : null,
          }),
      },
    );
    if (dto.achieved === true && !achievement.achieved) {
      await this.activity.record(userId, ActivityType.Achievements, {
        userGameId,
        data: { count: 1 },
      });
    }
  }

  async remove(userId: string, userGameId: string, achievementId: string): Promise<void> {
    const achievement = await this.requireAchievement(userId, userGameId, achievementId);
    if (achievement.steamApiName) {
      throw apiError(
        HttpStatus.CONFLICT,
        LibraryErrorCode.SteamAchievementReadOnly,
        'Steam achievements come back with every sync: they cannot be deleted',
      );
    }
    await this.achievements.delete({ id: achievement.id });
  }

  private async requireAchievement(userId: string, userGameId: string, achievementId: string) {
    await this.access.requireOwned(userId, userGameId);
    const achievement = await this.achievements.findOneBy({ id: achievementId, userGameId });
    if (!achievement) {
      throw apiError(
        HttpStatus.NOT_FOUND,
        LibraryErrorCode.AchievementNotFound,
        'Achievement not found',
      );
    }
    return achievement;
  }
}
