import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportsService } from './reports.service';
import { REPORT_DETAILS_MAX_LENGTH, ReportReason } from './user-report.entity';
import type { Response } from 'express';
import { ASSET_STORAGE, type AssetStorage } from '../assets/asset-storage';
import { CurrentUser } from '../auth/decorators';
import type { PublicUserDto } from '../users/user-response.dto';
import { ProfileVisibility, type User } from '../users/user.entity';
import { socialRateLimit, USER_SEARCH_MAX_LENGTH } from './social.constants';
import {
  type FriendsDto,
  type Relation,
  SocialService,
  type UserSearchResultDto,
} from './social.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UserSearchDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(USER_SEARCH_MAX_LENGTH)
  q?: string;
}

export class UsernameDto {
  @Transform(trim)
  @IsString()
  @MaxLength(USER_SEARCH_MAX_LENGTH)
  username: string;
}

export class ReportDto extends UsernameDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  /** Blank details are stored as null. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(REPORT_DETAILS_MAX_LENGTH)
  details?: string | null;
}

export class VisibilityDto {
  @IsEnum(ProfileVisibility)
  visibility: ProfileVisibility;
}

/** Other users: search and their avatars (decision #84). */
@UseGuards(ThrottlerGuard)
@Controller('users')
export class UsersSocialController {
  constructor(
    private readonly social: SocialService,
    @Inject(ASSET_STORAGE) private readonly storage: AssetStorage,
  ) {}

  /** Users by part of the username (3+ characters): only username and avatar. */
  @Throttle({ default: { limit: socialRateLimit(60), ttl: 60_000 } })
  @Get('search')
  search(@CurrentUser() user: User, @Query() query: UserSearchDto): Promise<UserSearchResultDto[]> {
    return this.social.search(user, query.q ?? '');
  }

  /** Another user's uploaded avatar: anyone signed in who isn't blocked. */
  @Get(':username/avatar')
  async avatar(
    @CurrentUser() user: User,
    @Param('username') username: string,
    @Res() response: Response,
  ): Promise<void> {
    const owner = await this.social.avatarOwner(user, username);
    const image = owner.avatarAssetKey ? await this.storage.get(owner.avatarAssetKey) : null;
    if (!image) {
      throw new NotFoundException();
    }
    response
      .status(200)
      .type(image.contentType)
      .set('Cache-Control', 'private, max-age=31536000, immutable')
      .send(image.data);
  }
}

/** Friends and friend requests (decision #84). */
@UseGuards(ThrottlerGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly social: SocialService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<FriendsDto> {
    return this.social.friends(user);
  }

  /** Sends a request (or accepts the one the other user already sent). */
  @Throttle({ default: { limit: socialRateLimit(30), ttl: 60_000 } })
  @Post('requests')
  @HttpCode(HttpStatus.OK)
  async request(
    @CurrentUser() user: User,
    @Body() dto: UsernameDto,
  ): Promise<{ relation: Relation }> {
    return { relation: await this.social.sendRequest(user, dto.username) };
  }

  @Post('requests/:username/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(@CurrentUser() user: User, @Param('username') username: string): Promise<void> {
    return this.social.acceptRequest(user, username);
  }

  /** Declines a received request or cancels a sent one. */
  @Delete('requests/:username')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRequest(@CurrentUser() user: User, @Param('username') username: string): Promise<void> {
    return this.social.removeRequest(user, username);
  }

  @Delete(':username')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfriend(@CurrentUser() user: User, @Param('username') username: string): Promise<void> {
    return this.social.unfriend(user, username);
  }
}

/** Blocked users (decision #84). */
@Controller('blocks')
export class BlocksController {
  constructor(private readonly social: SocialService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<PublicUserDto[]> {
    return this.social.blocked(user);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  block(@CurrentUser() user: User, @Body() dto: UsernameDto): Promise<void> {
    return this.social.block(user, dto.username);
  }

  @Delete(':username')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(@CurrentUser() user: User, @Param('username') username: string): Promise<void> {
    return this.social.unblock(user, username);
  }
}

/** Reports of offensive avatars or usernames (decision #87). */
@UseGuards(ThrottlerGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Throttle({ default: { limit: socialRateLimit(10), ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@CurrentUser() user: User, @Body() dto: ReportDto): Promise<void> {
    return this.reports.report(user, dto.username, dto.reason, dto.details ?? null);
  }
}

/** Who sees the current user's profile and activity (decision #84). */
@Controller('profile')
export class VisibilityController {
  constructor(private readonly social: SocialService) {}

  @Put('visibility')
  @HttpCode(HttpStatus.NO_CONTENT)
  setVisibility(@CurrentUser() user: User, @Body() dto: VisibilityDto): Promise<void> {
    return this.social.setVisibility(user, dto.visibility);
  }
}
