import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './common/logging/logger.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { CryptoModule } from './crypto/crypto.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';

/**
 * Composition root. Global modules (config, logging, prisma, providers, crypto, audit) are wired
 * once; feature modules (health now; identity/workflow/etc. in later phases) are added here.
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    ProvidersModule,
    CryptoModule,
    AuditModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
