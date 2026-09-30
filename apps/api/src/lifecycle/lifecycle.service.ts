import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from './notifications.service';
import type { AuthUser } from '../auth/auth-user';

/** Post-activation vendor lifecycle: block and reactivate an onboarded vendor, with reason + audit. */
@Injectable()
export class LifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async approvedCase(caseId: string) {
    const c = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found.');
    if (c.stage !== 'approved') {
      throw new BadRequestException(
        'Only an activated (approved) vendor can be blocked/reactivated.',
      );
    }
    return c;
  }

  async block(actor: AuthUser, caseId: string, reason: string) {
    const c = await this.approvedCase(caseId);
    await this.prisma.case.update({
      where: { id: caseId },
      data: { vendorStatus: 'BLOCKED', blockReason: reason },
    });
    await this.audit.append({
      action: 'vendor.block',
      entityType: 'Case',
      entityId: caseId,
      actorId: actor.id,
      detail: { reason },
    });
    await this.notifications.notify(
      c.createdById,
      'vendor.blocked',
      `Vendor ${c.legalName} (${c.ref}) has been blocked.`,
      `/cases/${caseId}`,
    );
    return { vendorStatus: 'BLOCKED' };
  }

  async reactivate(actor: AuthUser, caseId: string, reason: string) {
    const c = await this.approvedCase(caseId);
    await this.prisma.case.update({
      where: { id: caseId },
      data: { vendorStatus: 'ACTIVE', blockReason: null },
    });
    await this.audit.append({
      action: 'vendor.reactivate',
      entityType: 'Case',
      entityId: caseId,
      actorId: actor.id,
      detail: { reason },
    });
    await this.notifications.notify(
      c.createdById,
      'vendor.reactivated',
      `Vendor ${c.legalName} (${c.ref}) has been reactivated.`,
      `/cases/${caseId}`,
    );
    return { vendorStatus: 'ACTIVE' };
  }
}
