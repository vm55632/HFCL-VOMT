import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PinoLoggerService } from '../common/logging/logger.service';

/**
 * Outbound ERP integration — fired when a vendor is activated. This is an idempotent STUB: the
 * real adapter (SAP / Oracle / Dynamics vendor master) is wired once the client names the ERP and
 * supplies the interface (deferred, see CLAUDE.md). Idempotency is by `erpPushedAt` on the case.
 */
@Injectable()
export class ErpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: PinoLoggerService,
  ) {}

  async activate(caseId: string): Promise<void> {
    const c = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!c || c.erpPushedAt) return; // idempotent — already pushed

    const erpRef = `ERP-${c.vendorCode ?? c.ref}`;
    // TODO(phase-6): call the chosen ERP adapter here with a mapped vendor-master payload.
    this.logger.log(`ERP push (stub): vendor ${c.vendorCode} → ${erpRef}`, 'ErpService');

    await this.prisma.case.update({
      where: { id: caseId },
      data: { erpPushedAt: new Date(), erpRef },
    });
    await this.audit.append({
      action: 'erp.push',
      entityType: 'Case',
      entityId: caseId,
      detail: { vendorCode: c.vendorCode, erpRef },
    });
  }
}
