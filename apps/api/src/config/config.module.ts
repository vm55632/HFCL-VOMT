import { Global, Module } from '@nestjs/common';
import { loadConfig, type AppConfig } from '@vop/config';

/** Injection token for the structured, validated {@link AppConfig}. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Loads and validates the environment exactly once at boot (fail-fast on error — ADR-0004)
 * and provides it application-wide. Nothing else reads process.env.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
