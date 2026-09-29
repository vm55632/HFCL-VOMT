import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { AuditService, auditRowsToCsv } from './audit.service';

@ApiTags('audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AuditRead)
  @ApiOperation({ summary: 'Search the audit trail (auditor)' })
  query(
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.query({
      actorId,
      entityType,
      entityId,
      action,
      from,
      to,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('verify')
  @RequirePermissions(PERMISSIONS.AuditRead)
  @ApiOperation({ summary: 'Verify the audit hash chain (tamper-evidence)' })
  verify() {
    return this.audit.verify();
  }

  @Get('export.csv')
  @RequirePermissions(PERMISSIONS.AuditExport)
  @ApiOperation({
    summary: 'Export the (filtered) audit trail as CSV — the export is itself audited',
  })
  async export(
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const { rows, total } = await this.audit.query({ action, entityType, from, to, take: 500 });
    await this.audit.append({
      action: 'audit.export',
      actorId: actor.id,
      detail: { rows: rows.length, filters: { action, entityType, from, to } },
    });
    const csv = auditRowsToCsv(rows);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-export.csv"',
      'X-Total-Count': String(total),
    });
    res.end(csv);
  }
}
