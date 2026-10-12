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
import { LegalExempt } from './legal';
import {
  AcceptLegalDto,
  DeleteAccountDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/credentials.dto';
import { SessionCookie } from './session-cookie.service';

/**
 * Public auth routes are rate limited per IP (ThrottlerGuard). A CAPTCHA (e.g.
 * Cloudflare Turnstile) can be added later as another guard on register and
 * resend-verification without touching the services.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
  ) {}

  /** Creates an unverified account and emails the code. Never opens a session. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return toUserResponse(await this.auth.register(dto));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponseDto> {
    const { user, session } = await this.auth.login(dto.username, dto.password);
    this.cookie.set(response, session.token, session.expiresAt);
    return toUserResponse(user);
  }

  /** Marks the email as verified. Doesn't log the user in: they go back to the login. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(dto.email, dto.code);
  }

  /** Same response whether the account exists or not (no enumeration). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    await this.auth.resendVerification(dto.email);
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

  @LegalExempt()
  @Get('me')
  me(@CurrentUser() user: User): UserResponseDto {
    return toUserResponse(user);
  }

  /** Accepts the current Terms and Privacy policy (decision #88). */
  @LegalExempt()
  @Post('accept-legal')
  @HttpCode(HttpStatus.OK)
  async acceptLegal(
    @CurrentUser() user: User,
    @Body() _dto: AcceptLegalDto,
  ): Promise<UserResponseDto> {
    return toUserResponse(await this.auth.acceptLegal(user));
  }

  /**
   * Deletes the account and all its data (decision #82). Rate limited: it
   * checks the password. POST because it carries the password in the body.
   */
  @LegalExempt()
  @UseGuards(ThrottlerGuard)
  @Post('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user, dto.password);
    this.cookie.clear(response);
  }
}
