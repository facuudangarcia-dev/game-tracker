import { join } from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { EnvironmentVariables } from './config/env.validation';

export const API_PREFIX = 'api';

/**
 * Global HTTP configuration shared by main.ts and the e2e tests, so tests
 * exercise the same pipeline as the real server.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Covers, screenshots, achievement icons and news images come from
          // other sites (IGDB, Steam, news outlets): any HTTPS image.
          'img-src': ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}

/**
 * Production: the API also serves the built frontend (decision #89), so the
 * app is one service on one origin. Hashed assets are cached for a year;
 * every other non-API GET returns index.html (client-side routes).
 */
export function serveFrontend(app: NestExpressApplication, dir: string): void {
  const index = join(dir, 'index.html');
  app.use(
    '/assets',
    express.static(join(dir, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false }),
  );
  app.use(express.static(dir, { index: false, maxAge: '1h' }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' || request.path.startsWith(`/${API_PREFIX}`)) {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(index);
  });
}
