import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { AppConfig } from '@vop/config';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.module';
import { PinoLoggerService } from './common/logging/logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  // Structured logger replaces the default Nest logger.
  app.useLogger(app.get(PinoLoggerService));

  // Security headers (OWASP A05 / ASVS 14.4). API returns JSON; CSP locks it down regardless.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.disable('x-powered-by');
  app.use(cookieParser());

  // CORS allow-list from config — never a wildcard (validated in @vop/config).
  app.enableCors({
    origin: config.api.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // OpenAPI (dev/non-prod only — never expose the schema surface in production).
  if (!config.isProduction) {
    const doc = new DocumentBuilder()
      .setTitle('VOP API')
      .setDescription('Enterprise Vendor Onboarding Platform — API (Phase 0).')
      .setVersion('0.1.0')
      .addCookieAuth(config.session.cookieName)
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.api.port);
}

void bootstrap();
