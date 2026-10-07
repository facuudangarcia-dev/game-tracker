import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators';
import { apiError } from '../common/api-error';
import { toUserResponse, type UserResponseDto } from '../users/user-response.dto';
import type { User } from '../users/user.entity';
import { AVATAR_MAX_BYTES, AVATAR_PRESETS, type AvatarPreset } from './avatar-presets';
import { type PlayerStatsDto, ProfileService } from './profile.service';

export class AvatarPresetDto {
  @IsIn(AVATAR_PRESETS)
  preset: AvatarPreset;
}

function tooLarge() {
  return apiError(
    HttpStatus.PAYLOAD_TOO_LARGE,
    'AVATAR_TOO_LARGE',
    'The avatar image is too large',
  );
}

/** Oversized uploads are read (and discarded) up to this size so the client gets the 413. */
const MAX_DISCARDED_BYTES = 10 * 1024 * 1024;

/**
 * Reads the raw request body (the image bytes). Over the limit nothing more is
 * kept: the rest is drained and discarded (so the client receives the 413
 * instead of a reset connection), and absurd sizes just cut the connection.
 * JSON parsing doesn't touch image/* requests.
 */
async function readImageBody(request: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_DISCARDED_BYTES) {
      request.destroy();
      break;
    }
    if (size <= AVATAR_MAX_BYTES) {
      chunks.push(chunk);
    }
  }
  if (size > AVATAR_MAX_BYTES) {
    throw tooLarge();
  }
  return Buffer.concat(chunks);
}

/** The player's own profile. Everything here is about the current user only. */
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('stats')
  stats(@CurrentUser() user: User): Promise<PlayerStatsDto> {
    return this.profile.stats(user.id);
  }

  /** Chooses a built-in avatar (replaces an uploaded image). */
  @Put('avatar')
  async setPreset(
    @CurrentUser() user: User,
    @Body() dto: AvatarPresetDto,
  ): Promise<UserResponseDto> {
    return toUserResponse(await this.profile.setPreset(user, dto.preset));
  }

  /** Uploads an image as the avatar: raw JPEG, PNG or WebP body, 2 MB max. */
  @Put('avatar/image')
  async upload(@CurrentUser() user: User, @Req() request: Request): Promise<UserResponseDto> {
    return toUserResponse(await this.profile.setImage(user, await readImageBody(request)));
  }

  @Delete('avatar')
  async remove(@CurrentUser() user: User): Promise<UserResponseDto> {
    return toUserResponse(await this.profile.remove(user));
  }

  /** The current user's uploaded avatar. Private: never served to anyone else. */
  @Get('avatar/image')
  async image(@CurrentUser() user: User, @Res() response: Response): Promise<void> {
    const image = await this.profile.image(user);
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
