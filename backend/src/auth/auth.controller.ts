import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { toUserResponse, type UserResponseDto } from '../users/user-response.dto';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RegisterDto } from './dto/credentials.dto';
import { SessionCookie } from './session-cookie.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    const { user, session } = await this.auth.register(dto.email, dto.password);
    this.cookie.set(response, session.token, session.expiresAt);
    return toUserResponse(user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    const { user, session } = await this.auth.login(dto.email, dto.password);
    this.cookie.set(response, session.token, session.expiresAt);
    return toUserResponse(user);
  }

  /** Idempotent: always clears the cookie, and revokes the server session if there is one. */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = this.cookie.read(request);
    if (token) {
      await this.auth.logout(token);
    }
    this.cookie.clear(response);
  }

  @Get('me')
  me(@CurrentUser() user: User): UserResponseDto {
    return toUserResponse(user);
  }
}
