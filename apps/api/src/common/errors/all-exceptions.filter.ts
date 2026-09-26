import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLoggerService } from '../logging/logger.service';
import { currentContext } from '../context';

/**
 * Global exception filter. Clients receive a generic message + correlation id and never a stack
 * trace or internal detail (ADR-0007 / OWASP A05). Full detail is logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp();
    const res = httpCtx.getResponse<Response>();
    const req = httpCtx.getRequest<Request>();
    const correlationId = currentContext()?.correlationId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let clientMessage = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Only surface safe, framework-provided messages for client (4xx) errors.
      if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
        const resp = exception.getResponse();
        const raw: string | string[] =
          typeof resp === 'string'
            ? resp
            : ((resp as { message?: string | string[] }).message ?? exception.message);
        clientMessage = Array.isArray(raw) ? raw.join('; ') : raw;
      }
    }

    // Server-side: log everything with correlation id.
    const detail = exception instanceof Error ? exception.stack : String(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unhandled error on ${req.method} ${req.url}`, detail, 'ExceptionFilter');
    }

    res.status(status).json({
      statusCode: status,
      error: clientMessage,
      correlationId,
    });
  }
}
