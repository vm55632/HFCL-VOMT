import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  assessRisk,
  crossChecks,
  evaluateRedFlags,
  nameMatchScore,
  nameMatchVerdict,
  newId,
  PERMISSIONS,
  type RedFlag,
  type RiskInput,
} from '@vop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import {
  VERIFICATION_PROVIDER,
  type VerificationProvider,
  type VerificationResult,
} from '../providers/contracts';
import type { AuthUser } from '../auth/auth-user';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class VerificationService {
  constructor(
    @Inject(VERIFICATION_PROVIDER) private readonly provider: VerificationProvider,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  private async assertCanSee(actor: AuthUser, caseId: string) {
    const c = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!c) throw new NotFoundException('Case not found.');
    if (
      !actor.permissions.has(PERMISSIONS.VendorReadAll) &&
      c.createdById !== actor.id &&
      c.assigneeId !== actor.id
    ) {
      throw new ForbiddenException('Not authorized for this case.');
    }
    return c;
  }

  /** Call a provider with exponential-backoff retries; on outage, return a pending result. */
  private async attempt(
    label: string,
    fn: () => Promise<VerificationResult>,
  ): Promise<VerificationResult> {
    for (let i = 0; i < 3; i++) {
      try {
        return await fn();
      } catch {
        await sleep(2 ** i * 50);
      }
    }
    // Provider outage must not block the workflow — mark pending.
    return {
      status: 'pending',
      verifiedAt: new Date().toISOString(),
      providerName: `${label}:unavailable`,
    };
  }

  async runForCase(actor: AuthUser, caseId: string) {
    const c = await this.assertCanSee(actor, caseId);
    const category = await this.prisma.vendorCategory.findUnique({ where: { key: c.categoryKey } });

    const pan = c.panEnc ? await this.crypto.decryptFromString(c.panEnc) : undefined;
    const bankAccount = c.bankAccountEnc
      ? await this.crypto.decryptFromString(c.bankAccountEnc)
      : undefined;

    // Run the (mock) statutory checks. Missing identifiers are skipped.
    const panRes = pan
      ? await this.attempt('pan', () => this.provider.pan({ pan, name: c.legalName }))
      : undefined;
    const gstRes = c.gstin
      ? await this.attempt('gstin', () => this.provider.gstin({ gstin: c.gstin! }))
      : undefined;
    const bankRes =
      bankAccount && c.ifsc
        ? await this.attempt('bank', () =>
            this.provider.bank({ account: bankAccount, ifsc: c.ifsc!, name: c.legalName }),
          )
        : undefined;

    const gstData = (gstRes?.normalisedData ?? {}) as Record<string, unknown>;
    const bankData = (bankRes?.normalisedData ?? {}) as Record<string, unknown>;

    const panStatus = panRes
      ? panRes.status === 'verified'
        ? 'Active'
        : panRes.status === 'pending'
          ? 'Pending'
          : 'Inactive'
      : null;
    const gstStatus =
      (gstData.status as string) ?? (gstRes?.status === 'pending' ? 'Pending' : null);
    const gstLegalName = (gstData.legalName as string) ?? null;
    const taxpayerType = (gstData.taxpayerType as string) ?? null;
    const bankStatus = bankRes
      ? bankRes.status === 'verified'
        ? 'Verified'
        : bankRes.status
      : null;
    const bankNameOnRecord = (bankData.accountNameOnRecord as string) ?? null;

    // Name matching against the registry legal name.
    const registryName =
      gstLegalName ??
      (panRes?.normalisedData as { nameOnRecord?: string } | undefined)?.nameOnRecord;
    const score = registryName ? nameMatchScore(c.legalName, registryName) : undefined;
    const verdict = score !== undefined ? nameMatchVerdict(score) : undefined;

    const checks = crossChecks({
      vendorPan: pan,
      gstin: c.gstin ?? undefined,
      panName: (panRes?.normalisedData as { nameOnRecord?: string } | undefined)?.nameOnRecord,
      gstLegalName: gstLegalName ?? undefined,
      bankHolderName: bankNameOnRecord ?? undefined,
    });

    // Assemble the red-flag context (DB lookups for employee / shared-bank matches).
    const emailMatchesEmployee = c.contactEmail
      ? (await this.prisma.user.count({ where: { email: c.contactEmail } })) > 0
      : false;
    const otherActiveCasesSharingBank = c.bankBlindIndex
      ? await this.prisma.case.count({
          where: {
            bankBlindIndex: c.bankBlindIndex,
            id: { not: caseId },
            stage: { not: 'rejected' },
          },
        })
      : 0;

    const redFlags: RedFlag[] = evaluateRedFlags({
      emailMatchesEmployee,
      otherActiveCasesSharingBank,
      gstStatus,
      spend: c.spend,
      panGstNameMismatch: verdict === 'mismatch',
    });

    const reviewRequired =
      redFlags.length > 0 ||
      (verdict !== undefined && verdict !== 'match') ||
      checks.some((x) => !x.ok) ||
      [panRes, gstRes, bankRes].some((r) => r && r.status !== 'verified');

    // Feed the registry signals back into the risk model and re-tier the case (server authority).
    const riskInput: RiskInput = {
      spend: c.spend,
      dataAccess: c.dataAccess ?? undefined,
      systemAccess: c.systemAccess ?? undefined,
      subcontract: c.subcontract ?? undefined,
      delivery: c.delivery ?? undefined,
      screening: c.screening ?? undefined,
      conflict: c.conflict ?? undefined,
      litigation: c.litigation ?? undefined,
      insurance: c.insurance ?? undefined,
      certifications: c.certifications ?? undefined,
      enhancedDueDiligence: category?.enhancedDueDiligence ?? false,
      gstStatus: gstStatus ?? undefined,
      panStatus: panStatus ?? undefined,
      nameMatch: verdict === 'match' ? 'Yes' : verdict ? 'No' : undefined,
      taxpayerType: taxpayerType ?? undefined,
    };
    const risk = assessRisk(riskInput);

    await this.prisma.case.update({
      where: { id: caseId },
      data: {
        tier: risk.tier,
        riskScore: risk.score,
        panStatus,
        gstStatus,
        nameMatch: verdict === 'match' ? 'Yes' : verdict ? 'No' : null,
        taxpayerType,
        legalNameOnRecord: registryName ?? null,
      },
    });

    const verification = await this.prisma.caseVerification.upsert({
      where: { caseId },
      create: {
        id: newId(),
        caseId,
        panStatus,
        gstStatus,
        bankStatus,
        gstLegalName,
        bankNameOnRecord,
        taxpayerType,
        nameMatchScore: score ?? null,
        nameMatchVerdict: verdict ?? null,
        crossChecks: checks as unknown as Prisma.InputJsonValue,
        redFlags: redFlags as unknown as Prisma.InputJsonValue,
        reviewRequired,
        rawRef: `mock:${caseId}`,
      },
      update: {
        panStatus,
        gstStatus,
        bankStatus,
        gstLegalName,
        bankNameOnRecord,
        taxpayerType,
        nameMatchScore: score ?? null,
        nameMatchVerdict: verdict ?? null,
        crossChecks: checks as unknown as Prisma.InputJsonValue,
        redFlags: redFlags as unknown as Prisma.InputJsonValue,
        reviewRequired,
        verifiedAt: new Date(),
      },
    });

    await this.audit.append({
      action: 'case.verify',
      entityType: 'Case',
      entityId: caseId,
      actorId: actor.id,
      detail: { tier: risk.tier, reviewRequired, redFlags: redFlags.length, nameMatch: verdict },
    });

    return {
      tier: risk.tier,
      riskScore: risk.score,
      reviewRequired,
      nameMatchVerdict: verdict,
      redFlags,
      crossChecks: checks as unknown as Prisma.InputJsonValue,
      verification,
    };
  }

  async get(actor: AuthUser, caseId: string) {
    await this.assertCanSee(actor, caseId);
    return this.prisma.caseVerification.findUnique({ where: { caseId } });
  }

  /** Cases flagged for manual review (compliance/risk queue). */
  async reviewQueue() {
    return this.prisma.caseVerification.findMany({
      where: { reviewRequired: true },
      orderBy: { verifiedAt: 'desc' },
      take: 100,
      include: {
        case: { select: { id: true, ref: true, legalName: true, stage: true, tier: true } },
      },
    });
  }
}
