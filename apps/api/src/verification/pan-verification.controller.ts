import { Body, Controller, ForbiddenException, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSIONS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { PanVerificationService } from './pan-verification.service';

const panSchema = z.object({ pan: z.string().min(10).max(10) }).strict();
type PanBody = z.infer<typeof panSchema>;

const gstSchema = z.object({ gstin: z.string().min(15).max(15) }).strict();
type GstBody = z.infer<typeof gstSchema>;

const bankSchema = z
  .object({
    accountNumber: z.string().min(5).max(20),
    ifsc: z.string().min(11).max(11),
    panName: z.string().max(200).optional(),
    legalName: z.string().max(200).optional(),
    tradeName: z.string().max(200).optional(),
  })
  .strict();
type BankBody = z.infer<typeof bankSchema>;

const tokenSchema = z
  .object({ token: z.string().min(20), expiresAt: z.string().datetime().optional() })
  .strict();
type TokenBody = z.infer<typeof tokenSchema>;

@ApiTags('verification')
@Controller('verification')
export class PanVerificationController {
  constructor(
    private readonly pan: PanVerificationService,
    private readonly audit: AuditService,
  ) {}

  @Post('pan')
  @ApiOperation({ summary: 'Verify a PAN against the registry (EY Nexus CVR-API)' })
  async verify(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(panSchema)) body: PanBody,
  ) {
    // A PAN registry lookup supports onboarding — allow anyone who creates, edits, or oversees
    // vendors (proposers and admins/reviewers), not just vendor:create.
    const allowed =
      actor.permissions.has(PERMISSIONS.VendorCreate) ||
      actor.permissions.has(PERMISSIONS.VendorEdit) ||
      actor.permissions.has(PERMISSIONS.VendorReadAll);
    if (!allowed) {
      throw new ForbiddenException('Not authorized to verify a PAN.');
    }
    const result = await this.pan.verify(body.pan, `user:${actor.id}`);
    await this.audit.append({
      action: 'pan.verify',
      entityType: 'PanVerification',
      entityId: result.pan,
      actorId: actor.id,
      detail: {
        verified: result.verified,
        status: result.status ?? null,
        cached: result.cached ?? false,
      },
    });
    return result;
  }

  @Post('gst')
  @ApiOperation({ summary: 'Verify a GSTIN against the registry (EY Nexus CVR-API)' })
  async verifyGst(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(gstSchema)) body: GstBody,
  ) {
    const allowed =
      actor.permissions.has(PERMISSIONS.VendorCreate) ||
      actor.permissions.has(PERMISSIONS.VendorEdit) ||
      actor.permissions.has(PERMISSIONS.VendorReadAll);
    if (!allowed) {
      throw new ForbiddenException('Not authorized to verify a GSTIN.');
    }
    const result = await this.pan.verifyGstin(body.gstin, `user:${actor.id}`);
    await this.audit.append({
      action: 'gst.verify',
      entityType: 'GstVerification',
      entityId: result.gstin,
      actorId: actor.id,
      detail: {
        verified: result.verified,
        status: result.details?.gstStatus ?? null,
        cached: result.cached ?? false,
      },
    });
    return result;
  }

  @Post('msme')
  @ApiOperation({ summary: 'Fetch MSME / Udyam registration for a PAN (EY Nexus CVR-API)' })
  async verifyMsme(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(panSchema)) body: PanBody,
  ) {
    const allowed =
      actor.permissions.has(PERMISSIONS.VendorCreate) ||
      actor.permissions.has(PERMISSIONS.VendorEdit) ||
      actor.permissions.has(PERMISSIONS.VendorReadAll);
    if (!allowed) {
      throw new ForbiddenException('Not authorized to verify MSME details.');
    }
    const result = await this.pan.verifyMsme(body.pan, `user:${actor.id}`);
    await this.audit.append({
      action: 'msme.verify',
      entityType: 'MsmeVerification',
      entityId: result.pan,
      actorId: actor.id,
      detail: {
        verified: result.verified,
        enterpriseType: result.details?.enterpriseType ?? null,
        cached: result.cached ?? false,
      },
    });
    return result;
  }

  @Post('bank')
  @ApiOperation({ summary: 'Verify a bank account (penny-less) and match the holder name' })
  async verifyBank(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(bankSchema)) body: BankBody,
  ) {
    const allowed =
      actor.permissions.has(PERMISSIONS.VendorCreate) ||
      actor.permissions.has(PERMISSIONS.VendorEdit) ||
      actor.permissions.has(PERMISSIONS.VendorReadAll);
    if (!allowed) {
      throw new ForbiddenException('Not authorized to verify a bank account.');
    }
    const result = await this.pan.verifyBank(
      body.accountNumber,
      body.ifsc,
      { panName: body.panName, legalName: body.legalName, tradeName: body.tradeName },
      `user:${actor.id}`,
    );
    await this.audit.append({
      action: 'bank.verify',
      entityType: 'BankVerification',
      // Audit on the IFSC + last 4 digits only — never the full account number.
      entityId: `${body.ifsc}:****${body.accountNumber.slice(-4)}`,
      actorId: actor.id,
      detail: {
        verified: result.verified,
        active: result.active ?? null,
        nameMatched: result.nameMatch?.matched ?? null,
        nameMatchScore: result.nameMatch?.score ?? null,
        cached: result.cached ?? false,
      },
    });
    return result;
  }

  @Put('pan/token')
  @RequirePermissions(PERMISSIONS.SettingsManage)
  @ApiOperation({ summary: 'Store/refresh the EY Nexus PAN API token (admin)' })
  async setToken(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenBody,
  ) {
    await this.pan.setToken(body.token, body.expiresAt ? new Date(body.expiresAt) : undefined);
    await this.audit.append({
      action: 'pan.token.set',
      entityType: 'IntegrationToken',
      entityId: 'ey-nexus-pan',
      actorId: actor.id,
      detail: { expiresAt: body.expiresAt ?? null },
    });
    return { ok: true };
  }
}
