import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { type ActivityPageDto, ActivityService } from './activity.service';

export class ActivityQueryDto {
  /** Cursor of the next page (from the previous response). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;
}

/** Activity feed and players' activity (decision #86). */
@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** The current user's activity and their friends'. */
  @Get('activity')
  feed(@CurrentUser() user: User, @Query() query: ActivityQueryDto): Promise<ActivityPageDto> {
    return this.activity.feed(user, query.cursor);
  }

  /** One player's activity: the current user or a friend who shares it. */
  @Get('users/:username/activity')
  ofPlayer(
    @CurrentUser() user: User,
    @Param('username') username: string,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityPageDto> {
    return this.activity.ofPlayer(user, username, query.cursor);
  }
}
