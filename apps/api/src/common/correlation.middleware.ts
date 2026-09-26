import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { newId } from '@vop/shared';
import { requestContext, type RequestContext } from './context';

const HEADER = 'x-correlation-id';

/**
 * Assigns/propagates a correlation id per request and opens the AsyncLocalStorage context so
 * every log line and audit entry in the request shares it. Accepts an inbound id (trusted only
 * for tracing) or mints a new one.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers[HEADER];
    const correlationId =
      (typeof inbound === 'string' && inbound.length <= 64 && inbound) || newId();
    res.setHeader(HEADER, correlationId);

    const ctx: RequestContext = {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    requestContext.run(ctx, () => next());
  }
}
