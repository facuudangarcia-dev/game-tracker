import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp, serveFrontend } from './app.setup';
import type { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  // Behind the host's proxy: the real client IP (rate limits) and HTTPS (decision #89).
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  const frontendDir = config.get('FRONTEND_DIST_DIR', { infer: true });
  if (frontendDir) {
    serveFrontend(app, frontendDir);
  }
  const port = config.get('PORT', { infer: true }) ?? config.get('BACKEND_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
