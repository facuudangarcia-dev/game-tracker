import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordHasher } from './password-hasher.service';
import { Session } from './session.entity';
import { SessionCookie } from './session-cookie.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    UsersModule,
    EmailModule,
    AssetsModule,
    // Brute-force and spam protection for the public auth routes (per route and IP).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => [
        { ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE', { infer: true }) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordHasher,
    SessionsService,
    SessionCookie,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
