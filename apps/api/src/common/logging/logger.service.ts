import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';
import { redact } from '@vop/shared';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../../config/config.module';
import { currentContext } from '../context';

/**
 * Structured JSON logger (pino) with per-request correlation ids and a redaction layer so
 * PII/secrets never reach log output (ADR-0004/0005). Implements Nest's LoggerService so it
 * replaces the default logger app-wide.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.logger = pino({
      level: config.observability.logLevel,
      base: { service: 'vop-api', env: config.env },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
    });
  }

  private enrich(context?: string, meta?: unknown): Record<string, unknown> {
    const ctx = currentContext();
    const base: Record<string, unknown> = {};
    if (context) base.context = context;
    if (ctx) {
      base.correlationId = ctx.correlationId;
      if (ctx.userId) base.userId = ctx.userId;
      if (ctx.role) base.role = ctx.role;
    }
    if (meta !== undefined) base.meta = redact(meta);
    return base;
  }

  log(message: unknown, context?: string, meta?: unknown): void {
    this.logger.info(this.enrich(context, meta), String(message));
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    // Full detail server-side only; never returned to the client.
    this.logger.error({ ...this.enrich(context), stack: stackOrContext }, String(message));
  }

  warn(message: unknown, context?: string, meta?: unknown): void {
    this.logger.warn(this.enrich(context, meta), String(message));
  }

  debug(message: unknown, context?: string, meta?: unknown): void {
    this.logger.debug(this.enrich(context, meta), String(message));
  }

  verbose(message: unknown, context?: string, meta?: unknown): void {
    this.logger.trace(this.enrich(context, meta), String(message));
  }
}
