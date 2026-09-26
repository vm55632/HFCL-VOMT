import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Append-only, hash-chained audit trail. Available app-wide for sensitive-action logging. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
