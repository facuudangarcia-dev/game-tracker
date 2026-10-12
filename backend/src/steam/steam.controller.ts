import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, OptionalAuth, OptionalUser } from '../auth/decorators';
import type { User } from '../users/user.entity';
import { SteamErrorCode } from './steam.constants';
import { type SteamPendingGameDto, SteamService, type SteamStatusDto } from './steam.service';

export class SteamUnlinkDto {
  /** Also delete the games Steam added (and Steam's hours and achievements). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  deleteGames?: boolean;
}

export class SteamConfirmDto {
  /** Steam app ids of the found games the user chose to add; the rest are removed. */
  @IsArray()
  @ArrayMaxSize(20_000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  appIds: number[];
}

export class SteamSyncDto {
  /** Automatic sync (on opening "Mis juegos"): only if the last one is 6+ hours old. */
  @IsOptional()
  @IsBoolean()
  auto?: boolean;
}

/** Steam linking and sync (decision #78). */
@UseGuards(ThrottlerGuard)
@Controller('steam')
export class SteamController {
  constructor(private readonly steam: SteamService) {}

  @Get()
  status(@CurrentUser() user: User): Promise<SteamStatusDto> {
    return this.steam.status(user.id);
  }

  /** Sends the browser to Steam's login (the user signs in on Steam, never here). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('link')
  link(@CurrentUser() user: User, @Res() response: Response): void {
    if (!this.steam.isConfigured) {
      response.redirect(this.gamesUrl({ steam: 'error', reason: SteamErrorCode.NotConfigured }));
      return;
    }
    response.redirect(this.steam.loginUrl(user.id));
  }

  /**
   * Steam's login comes back here (a browser navigation): the result is shown
   * on "Mis juegos". Without a session there is nothing to link.
   */
  @OptionalAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('callback')
  async callback(
    @OptionalUser() user: User | null,
    @Query() query: Record<string, string>,
    @Res() response: Response,
  ): Promise<void> {
    if (!user) {
      response.redirect(`${this.steam.origin}/login`);
      return;
    }
    const result = await this.steam.completeLogin(user.id, query);
    response.redirect(
      this.gamesUrl(result === 'linked' ? { steam: 'linked' } : { steam: 'error', reason: result }),
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  sync(@CurrentUser() user: User, @Body() dto: SteamSyncDto): Promise<SteamStatusDto> {
    return this.steam.requestSync(user.id, dto.auto ?? false);
  }

  /** Games found by the syncs, waiting for the user's review. */
  @Get('pending')
  pending(@CurrentUser() user: User): Promise<SteamPendingGameDto[]> {
    return this.steam.pending(user.id);
  }

  /** Adds the chosen found games; the rest become removed games. */
  @Post('pending')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() user: User, @Body() dto: SteamConfirmDto): Promise<SteamStatusDto> {
    return this.steam.confirmPending(user.id, dto.appIds);
  }

  /** Unlinks Steam; the imported games stay unless `?deleteGames=true`. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(@CurrentUser() user: User, @Query() query: SteamUnlinkDto): Promise<void> {
    await this.steam.unlink(user.id, query.deleteGames ?? false);
  }

  /** Lets a removed Steam game be imported again. */
  @Delete('excluded/:appId')
  restore(
    @CurrentUser() user: User,
    @Param('appId', ParseIntPipe) appId: number,
  ): Promise<SteamStatusDto> {
    return this.steam.restoreExcluded(user.id, appId);
  }

  private gamesUrl(params: Record<string, string>): string {
    return `${this.steam.origin}/games?${new URLSearchParams(params).toString()}`;
  }
}
