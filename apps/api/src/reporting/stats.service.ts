import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';

export interface DashboardStats {
  scope: 'all' | 'own';
  total: number;
  active: number;
  overdue: number;
  reviewRequired: number;
  byStage: { stage: string; count: number }[];
  byTier: { tier: string; count: number }[];
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(actor: AuthUser): Promise<DashboardStats> {
    const canAll = actor.permissions.has(PERMISSIONS.VendorReadAll);
    const scope: Prisma.CaseWhereInput = canAll
      ? {}
      : { OR: [{ createdById: actor.id }, { assigneeId: actor.id }] };

    const [total, byStageRaw, byTierRaw, overdue, active, reviewRequired] = await Promise.all([
      this.prisma.case.count({ where: scope }),
      this.prisma.case.groupBy({ by: ['stage'], where: scope, _count: { _all: true } }),
      this.prisma.case.groupBy({ by: ['tier'], where: scope, _count: { _all: true } }),
      this.prisma.case.count({
        where: {
          ...scope,
          onHold: false,
          dueAt: { lt: new Date() },
          stage: { notIn: ['approved', 'rejected'] },
        },
      }),
      this.prisma.case.count({ where: { ...scope, stage: { notIn: ['approved', 'rejected'] } } }),
      this.prisma.caseVerification.count({
        where: { reviewRequired: true, ...(canAll ? {} : { case: scope }) },
      }),
    ]);

    return {
      scope: canAll ? 'all' : 'own',
      total,
      active,
      overdue,
      reviewRequired,
      byStage: byStageRaw
        .map((r) => ({ stage: r.stage, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      byTier: byTierRaw.map((r) => ({ tier: r.tier, count: r._count._all })),
    };
  }
}
