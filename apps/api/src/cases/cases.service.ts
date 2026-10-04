import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTION_NEEDS_NOTE,
  assessRisk,
  dueDate,
  dueDiligencePack,
  evaluateTransition,
  getStage,
  maskAccount,
  maskPan,
  newId,
  PERMISSIONS,
  activeReviewStages,
  REVIEW_STAGES,
  SAP_STAGE,
  STAGE_ROLE,
  type ReviewStage,
  type RiskInput,
  type TierKey,
  type WorkflowAction,
} from '@vop/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { BlindIndexService } from '../crypto/blind-index.service';
import { WorkflowsService } from '../workflow/workflows.service';
import { CategoriesService } from '../master-data/categories.service';
import { ErpService } from '../lifecycle/erp.service';
import { NotificationsService } from '../lifecycle/notifications.service';
import {
  VerificationCacheService,
  type VerificationKind,
} from '../verification/verification-cache.service';
import type { AuthUser } from '../auth/auth-user';

/** Workflow stage key -> the Prisma delegate for its per-stage reporting table. */
const STAGE_TABLES = ['draft', 'infosec', 'fcu', 'operation', 'sap', 'legal'] as const;
type StageTable = (typeof STAGE_TABLES)[number];

export interface CaseCreateInput {
  categoryKey: string;
  subCategoryKey?: string;
  legalName: string;
  tradeName?: string;
  businessAddress?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  signatoryName?: string;
  signatoryEmail?: string;
  signatoryMobile?: string;
  signatoryPan?: string;
  pan?: string;
  gstin?: string;
  ifsc?: string;
  bankAccount?: string;
  bankName?: string;
  branch?: string;
  businessUnit?: string;
  costCentre?: string;
  spend?: number;
  contractMonths?: number;
  natureOfService?: string;
  justification?: string;
  coiDeclared?: boolean;
  coiDetails?: string;
  // risk inputs
  dataAccess?: string;
  systemAccess?: string;
  subcontract?: string;
  delivery?: string;
  screening?: string;
  conflict?: string;
  litigation?: string;
  insurance?: string;
  certifications?: string;
  // information-security questionnaire
  isecItHardware?: boolean;
  isecItSoftware?: boolean;
  isecAccessSystem?: boolean;
  isecAccessNetwork?: boolean;
  isecAccessApps?: boolean;
  isecAccessPii?: boolean;
}

export interface DuplicateFlag {
  field: string;
  ref: string;
  legalName: string;
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: FieldEncryptionService,
    private readonly blind: BlindIndexService,
    private readonly workflows: WorkflowsService,
    private readonly categories: CategoriesService,
    private readonly erp: ErpService,
    private readonly notifications: NotificationsService,
    private readonly verificationCache: VerificationCacheService,
  ) {}

  // ---------- helpers ----------

  private riskInputFrom(c: CaseCreateInput, enhancedDueDiligence: boolean): RiskInput {
    return {
      spend: c.spend,
      dataAccess: c.dataAccess,
      systemAccess: c.systemAccess,
      subcontract: c.subcontract,
      delivery: c.delivery,
      screening: c.screening,
      conflict: c.conflict,
      litigation: c.litigation,
      insurance: c.insurance,
      certifications: c.certifications,
      enhancedDueDiligence,
    };
  }

  private async nextRef(now = new Date()): Promise<string> {
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `VOM-${ym}-`;
    const count = await this.prisma.case.count({ where: { ref: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private canSeeAll(actor: AuthUser): boolean {
    return actor.permissions.has(PERMISSIONS.VendorReadAll);
  }

  private assertCanSee(
    actor: AuthUser,
    c: { createdById: string; assigneeId: string | null },
  ): void {
    if (this.canSeeAll(actor)) return;
    if (c.createdById === actor.id || c.assigneeId === actor.id) return;
    throw new ForbiddenException('Not authorized to view this case.');
  }

  /** Build the vendor master-detail row (case_general) from intake input, encrypting identifiers. */
  private async buildGeneralData(input: CaseCreateInput): Promise<Record<string, unknown>> {
    return {
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      businessAddress: input.businessAddress ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      signatoryName: input.signatoryName ?? null,
      signatoryEmail: input.signatoryEmail ?? null,
      signatoryMobile: input.signatoryMobile ?? null,
      signatoryPanEnc: input.signatoryPan
        ? await this.crypto.encryptToString(input.signatoryPan)
        : null,
      signatoryPanBlindIndex: input.signatoryPan ? this.blind.index(input.signatoryPan) : null,
      panEnc: input.pan ? await this.crypto.encryptToString(input.pan) : null,
      panBlindIndex: input.pan ? this.blind.index(input.pan) : null,
      gstin: input.gstin ?? null,
      gstinBlindIndex: input.gstin ? this.blind.index(input.gstin) : null,
      ifsc: input.ifsc ?? null,
      bankName: input.bankName ?? null,
      branch: input.branch ?? null,
      bankAccountEnc: input.bankAccount
        ? await this.crypto.encryptToString(input.bankAccount)
        : null,
      bankBlindIndex: input.bankAccount ? this.blind.index(input.bankAccount) : null,
      businessUnit: input.businessUnit ?? null,
      costCentre: input.costCentre ?? null,
      spend: input.spend ?? 0,
      contractMonths: input.contractMonths ?? null,
      natureOfService: input.natureOfService ?? null,
      justification: input.justification ?? '',
      coiDeclared: input.coiDeclared ?? false,
      coiDetails: input.coiDetails ?? null,
      dataAccess: input.dataAccess ?? null,
      systemAccess: input.systemAccess ?? null,
      subcontract: input.subcontract ?? null,
      delivery: input.delivery ?? null,
      screening: input.screening ?? null,
      conflict: input.conflict ?? null,
      litigation: input.litigation ?? null,
      insurance: input.insurance ?? null,
      certifications: input.certifications ?? null,
      isecItHardware: input.isecItHardware ?? false,
      isecItSoftware: input.isecItSoftware ?? false,
      isecAccessSystem: input.isecAccessSystem ?? false,
      isecAccessNetwork: input.isecAccessNetwork ?? false,
      isecAccessApps: input.isecAccessApps ?? false,
      isecAccessPii: input.isecAccessPii ?? false,
    };
  }

  /**
   * Upsert the per-stage reporting row for a case. `patch` carries whatever changed — pass
   * `enteredAt`/status:'pending' on entry, or status/decision/remark/completedAt on completion.
   * Stages without a dedicated table (procurement/risk/finance/approval) are a no-op.
   */
  private async writeStage(
    caseId: string,
    stageKey: string,
    patch: {
      status?: string;
      decision?: string | null;
      remark?: string | null;
      actionedById?: string | null;
      enteredAt?: Date;
      completedAt?: Date;
      data?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const args = {
      where: { caseId },
      create: {
        id: newId(),
        caseId,
        status: patch.status ?? 'pending',
        decision: patch.decision ?? null,
        remark: patch.remark ?? null,
        actionedById: patch.actionedById ?? null,
        enteredAt: patch.enteredAt ?? new Date(),
        completedAt: patch.completedAt ?? null,
        ...(patch.data !== undefined ? { data: patch.data } : {}),
      },
      update: patch,
    };
    switch (stageKey as StageTable) {
      case 'draft':
        await this.prisma.caseDraft.upsert(args);
        break;
      case 'infosec':
        await this.prisma.caseInfosec.upsert(args);
        break;
      case 'fcu':
        await this.prisma.caseFcu.upsert(args);
        break;
      case 'operation':
        await this.prisma.caseOperation.upsert(args);
        break;
      case 'sap':
        await this.prisma.caseSap.upsert(args);
        break;
      case 'legal':
        await this.prisma.caseLegal.upsert(args);
        break;
      default:
        break; // no dedicated table for this stage
    }
  }

  /**
   * Persist the PAN/GST/bank/MSME responses that were shown on the form into case_verification_response.
   * Reuses the same-day verification cache (already populated during data entry) so no extra external
   * calls are made. Payloads are envelope-encrypted; the identifier is kept only as a blind index.
   */
  private async captureResponses(
    caseId: string,
    actor: AuthUser,
    ids: {
      pan?: string | null;
      gstin?: string | null;
      bankAccount?: string | null;
      ifsc?: string | null;
    },
  ): Promise<void> {
    const scope = `user:${actor.id}`;
    const save = async (kind: VerificationKind, identifier: string, cacheKey: string) => {
      try {
        const hit = await this.verificationCache.get<Record<string, unknown>>(
          scope,
          kind,
          cacheKey,
        );
        if (!hit) return;
        const verified = kind === 'bank' ? hit.active === true : hit.verified === true;
        const details = (hit.details ?? {}) as Record<string, unknown>;
        const status =
          kind === 'bank'
            ? ((hit.activeStatus as string) ?? null)
            : kind === 'gst'
              ? ((details.gstStatus as string) ?? null)
              : kind === 'pan'
                ? ((hit.status as string) ?? null)
                : verified
                  ? 'registered'
                  : null;
        const payloadEnc = await this.crypto.encryptToString(JSON.stringify(hit));
        const identifierBlindIndex = this.blind.index(identifier);
        await this.prisma.caseVerificationResponse.upsert({
          where: { caseId_kind: { caseId, kind } },
          create: {
            id: newId(),
            caseId,
            kind,
            identifierBlindIndex,
            status,
            verified,
            payloadEnc,
            capturedById: actor.id,
          },
          update: {
            identifierBlindIndex,
            status,
            verified,
            payloadEnc,
            capturedById: actor.id,
            capturedAt: new Date(),
          },
        });
      } catch {
        /* best-effort capture; never blocks case creation */
      }
    };
    if (ids.pan) {
      await save('pan', ids.pan, ids.pan);
      await save('msme', ids.pan, ids.pan);
    }
    if (ids.gstin) await save('gst', ids.gstin, ids.gstin);
    if (ids.bankAccount && ids.ifsc) {
      const acct = ids.bankAccount.replace(/\s+/g, '');
      const ifsc = ids.ifsc.trim().toUpperCase();
      await save('bank', ids.bankAccount, `${acct}|${ifsc}`);
    }
  }

  /**
   * Present a case with PAN/bank masked unless the actor may view sensitive data (audited). The
   * vendor detail lives in the `general` relation; it is flattened onto the top level so the API
   * response shape is unchanged for callers (the web app reads `c.legalName`, `c.pan`, …).
   */
  private async present(
    c: Record<string, unknown>,
    actor: AuthUser,
  ): Promise<Record<string, unknown>> {
    const reveal = actor.permissions.has(PERMISSIONS.VendorViewSensitive);
    const g = (c.general ?? {}) as Record<string, unknown>;
    // Flatten general under the case: case fields (id/createdAt/updatedAt/stage/…) win over
    // general's own id/timestamps.
    const out: Record<string, unknown> = { ...g, ...c };
    delete out.general;
    delete out.caseId;

    // Collapse the per-stage relation rows into a `stages` map + the active review set, so the UI
    // can render each parallel stage's status and the SAP completion indicators.
    const stageRel: Record<string, string> = {
      draft: 'draftStage',
      infosec: 'infosecStage',
      fcu: 'fcuStage',
      operation: 'operationStage',
      legal: 'legalStage',
      sap: 'sapStage',
    };
    const stages: Record<string, Record<string, unknown> | null> = {};
    for (const [key, rel] of Object.entries(stageRel)) {
      stages[key] = (c[rel] as Record<string, unknown> | null) ?? null;
      delete out[rel];
    }
    // Resolve the reviewer name for each actioned stage, so the UI can show "Reviewed by …".
    const actorIds = [
      ...new Set(
        Object.values(stages)
          .map((s) => s?.actionedById as string | undefined)
          .filter((v): v is string => !!v),
      ),
    ];
    if (actorIds.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(users.map((u) => [u.id, u.name]));
      for (const s of Object.values(stages)) {
        if (s?.actionedById) s.actionedByName = nameById.get(s.actionedById as string) ?? null;
      }
    }
    out.stages = stages;
    out.reviewStages = activeReviewStages(Boolean(c.infosecRequired));
    delete out.panEnc;
    delete out.panBlindIndex;
    delete out.bankAccountEnc;
    delete out.bankBlindIndex;
    delete out.gstinBlindIndex;
    delete out.signatoryPanEnc;
    delete out.signatoryPanBlindIndex;

    if (reveal && g.panEnc) {
      const pan = await this.crypto.decryptFromString(g.panEnc as string);
      out.pan = pan;
      out.panMasked = maskPan(pan);
      await this.audit.append({
        action: 'case.view_sensitive',
        entityType: 'Case',
        entityId: c.id as string,
        actorId: actor.id,
        detail: { field: 'pan' },
      });
    } else {
      out.pan = g.panEnc ? '••••••••••' : null;
    }
    if (reveal && g.bankAccountEnc) {
      out.bankAccount = await this.crypto.decryptFromString(g.bankAccountEnc as string);
    } else {
      out.bankAccount = g.bankAccountEnc ? maskAccount('0000') : null;
    }
    if (reveal && g.signatoryPanEnc) {
      const sp = await this.crypto.decryptFromString(g.signatoryPanEnc as string);
      out.signatoryPan = sp;
      out.signatoryPanMasked = maskPan(sp);
    } else {
      out.signatoryPan = g.signatoryPanEnc ? '••••••••••' : null;
    }
    return out;
  }

  /** Find existing cases sharing PAN / GSTIN / bank / email / phone (flag, never block). */
  private async detectDuplicates(
    idx: {
      pan?: string | null;
      gstin?: string | null;
      bank?: string | null;
      email?: string | null;
      phone?: string | null;
    },
    excludeId?: string,
  ): Promise<DuplicateFlag[]> {
    const or: Record<string, unknown>[] = [];
    if (idx.pan) or.push({ panBlindIndex: idx.pan });
    if (idx.gstin) or.push({ gstinBlindIndex: idx.gstin });
    if (idx.bank) or.push({ bankBlindIndex: idx.bank });
    if (idx.email) or.push({ contactEmail: idx.email });
    if (idx.phone) or.push({ contactPhone: idx.phone });
    if (!or.length) return [];
    // Vendor identifiers now live on case_general; join back to the case for its ref.
    const rows = await this.prisma.caseGeneral.findMany({
      where: { OR: or, ...(excludeId ? { caseId: { not: excludeId } } : {}) },
      select: {
        legalName: true,
        panBlindIndex: true,
        gstinBlindIndex: true,
        bankBlindIndex: true,
        contactEmail: true,
        contactPhone: true,
        case: { select: { ref: true } },
      },
    });
    const flags: DuplicateFlag[] = [];
    for (const r of rows) {
      const ref = r.case.ref;
      if (idx.pan && r.panBlindIndex === idx.pan)
        flags.push({ field: 'PAN', ref, legalName: r.legalName });
      else if (idx.gstin && r.gstinBlindIndex === idx.gstin)
        flags.push({ field: 'GSTIN', ref, legalName: r.legalName });
      else if (idx.bank && r.bankBlindIndex === idx.bank)
        flags.push({ field: 'bank account', ref, legalName: r.legalName });
      else if (idx.email && r.contactEmail === idx.email)
        flags.push({ field: 'email', ref, legalName: r.legalName });
      else if (idx.phone && r.contactPhone === idx.phone)
        flags.push({ field: 'phone', ref, legalName: r.legalName });
    }
    return flags;
  }

  // ---------- lifecycle ----------

  async create(actor: AuthUser, input: CaseCreateInput) {
    const category = await this.categories.get(input.categoryKey);
    if (input.subCategoryKey) {
      const sc = await this.prisma.vendorSubCategory.findUnique({
        where: { key: input.subCategoryKey },
      });
      if (!sc || sc.categoryKey !== input.categoryKey) {
        throw new BadRequestException('Invalid sub-category for the selected category.');
      }
    }
    const published = await this.workflows.getPublished(category.workflowKey);

    const risk = assessRisk(this.riskInputFrom(input, category.enhancedDueDiligence));
    const tier = risk.tier;

    const panIdx = input.pan ? this.blind.index(input.pan) : null;
    const gstIdx = input.gstin ? this.blind.index(input.gstin) : null;
    const bankIdx = input.bankAccount ? this.blind.index(input.bankAccount) : null;

    const id = newId();
    const ref = await this.nextRef();
    const pack = dueDiligencePack(risk, this.riskInputFrom(input, category.enhancedDueDiligence));

    // Information-security questionnaire: any "yes" adds InfoSec to the parallel review set.
    const isec = {
      isecItHardware: input.isecItHardware ?? false,
      isecItSoftware: input.isecItSoftware ?? false,
      isecAccessSystem: input.isecAccessSystem ?? false,
      isecAccessNetwork: input.isecAccessNetwork ?? false,
      isecAccessApps: input.isecAccessApps ?? false,
      isecAccessPii: input.isecAccessPii ?? false,
    };
    const infosecRequired = Object.values(isec).some(Boolean);
    // Submitting the case fans it out to the parallel reviewers (FCU/Operation/Legal, + InfoSec
    // when flagged). The case sits in the "review" phase until every active stage is approved.
    const stages = activeReviewStages(infosecRequired);
    const generalData = await this.buildGeneralData(input);

    await this.prisma.case.create({
      data: {
        id,
        ref,
        categoryKey: input.categoryKey,
        subCategoryKey: input.subCategoryKey ?? null,
        workflowKey: published.key,
        workflowVersion: published.version,
        stage: 'review',
        tier,
        riskScore: risk.score,
        createdById: actor.id,
        lastUpdatedById: actor.id,
        infosecRequired,
        general: {
          create: { id: newId(), ...generalData } as Prisma.CaseGeneralCreateWithoutCaseInput,
        },
        checklist: {
          create: pack.map((it) => ({
            id: newId(),
            itemId: it.id,
            label: it.label,
            role: it.role,
          })),
        },
        activity: {
          create: [
            { id: newId(), actorId: actor.id, action: 'created', toStage: 'review' },
            {
              id: newId(),
              actorId: actor.id,
              action: 'submitted_for_review',
              toStage: 'review',
              note: `Parallel review opened: ${stages.join(', ')}.`,
            },
          ],
        },
      },
    });

    // Open each active parallel stage, seed the (gated) SAP confirmation row, and persist the
    // PAN/GST/bank/MSME responses shown on the form.
    for (const s of stages) {
      await this.writeStage(id, s, { status: 'pending', enteredAt: new Date() });
    }
    await this.writeStage(id, SAP_STAGE, { status: 'waiting' });
    await this.captureResponses(id, actor, {
      pan: input.pan,
      gstin: input.gstin,
      bankAccount: input.bankAccount,
      ifsc: input.ifsc,
    });

    const duplicates = await this.detectDuplicates(
      {
        pan: panIdx,
        gstin: gstIdx,
        bank: bankIdx,
        email: input.contactEmail,
        phone: input.contactPhone,
      },
      id,
    );

    await this.audit.append({
      action: 'case.create',
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: {
        ref,
        tier,
        category: input.categoryKey,
        duplicateFlags: duplicates.length,
        infosecRequired,
      },
    });

    return {
      id,
      ref,
      tier,
      riskScore: risk.score,
      drivers: risk.drivers,
      duplicates,
      infosecRequired,
    };
  }

  /** The parallel review stages that are active for a case (InfoSec only when flagged). */
  private activeStagesFor(c: { infosecRequired: boolean }): ReviewStage[] {
    return activeReviewStages(c.infosecRequired);
  }

  /** Read the per-stage status rows for the active review stages of a case. */
  private async stageStatuses(
    caseId: string,
    stages: ReviewStage[],
  ): Promise<Record<string, string>> {
    const rows = await Promise.all(
      stages.map(async (s) => [s, await this.readStage(caseId, s)] as const),
    );
    const out: Record<string, string> = {};
    for (const [s, row] of rows) out[s] = row?.status ?? 'pending';
    return out;
  }

  private async readStage(caseId: string, stageKey: string): Promise<{ status: string } | null> {
    switch (stageKey as ReviewStage | typeof SAP_STAGE) {
      case 'infosec':
        return this.prisma.caseInfosec.findUnique({ where: { caseId } });
      case 'fcu':
        return this.prisma.caseFcu.findUnique({ where: { caseId } });
      case 'operation':
        return this.prisma.caseOperation.findUnique({ where: { caseId } });
      case 'legal':
        return this.prisma.caseLegal.findUnique({ where: { caseId } });
      case 'sap':
        return this.prisma.caseSap.findUnique({ where: { caseId } });
      default:
        return null;
    }
  }

  /**
   * A parallel reviewer (InfoSec/FCU/Operation/Legal) acts on their own stage. Send-back reopens
   * only that stage for the proposer; reject fails the whole case; when every active stage is
   * approved the case advances to the SAP confirmation gate. `extra.agreement` is stored for Legal.
   */
  async stageDecision(
    actor: AuthUser,
    id: string,
    stageKey: ReviewStage,
    decision: 'approve' | 'reject' | 'sendback',
    note?: string,
    extra?: { agreement?: string },
  ) {
    if (!REVIEW_STAGES.includes(stageKey)) throw new BadRequestException('Unknown review stage.');
    const c = await this.prisma.case.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Case not found.');

    const owns =
      actor.roles.includes(STAGE_ROLE[stageKey]) ||
      actor.permissions.has(PERMISSIONS.WorkflowManage);
    if (!owns) throw new ForbiddenException(`Only the ${stageKey} reviewer can act on this stage.`);

    const active = this.activeStagesFor(c);
    if (!active.includes(stageKey)) {
      throw new BadRequestException('This stage is not part of this case’s review.');
    }
    const current = await this.readStage(id, stageKey);
    if (!current || current.status !== 'pending') {
      throw new BadRequestException('This stage is not awaiting your review.');
    }
    if ((decision === 'reject' || decision === 'sendback') && !note?.trim()) {
      throw new BadRequestException('A remark is required to reject or send back a stage.');
    }

    const status =
      decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'sent_back';
    await this.writeStage(id, stageKey, {
      status,
      decision,
      remark: note?.trim() || null,
      actionedById: actor.id,
      completedAt: new Date(),
      ...(extra?.agreement ? { data: { agreement: extra.agreement.trim() } } : {}),
    });

    await this.prisma.caseActivity.create({
      data: {
        id: newId(),
        caseId: id,
        actorId: actor.id,
        action: `${stageKey}_${decision}`,
        fromStage: stageKey,
        toStage: decision === 'sendback' ? 'draft' : 'review',
        note: note?.trim() || null,
      },
    });

    // Recompute the overall phase from the active stages.
    const statuses = await this.stageStatuses(id, active);
    let phase = c.stage;
    if (Object.values(statuses).some((s) => s === 'rejected')) {
      phase = 'rejected';
    } else if (Object.values(statuses).some((s) => s === 'sent_back')) {
      // One or more stages need the proposer; surface the case to them while others hold.
      phase = 'review';
    } else if (active.every((s) => statuses[s] === 'approved')) {
      phase = SAP_STAGE; // all reviews done -> SAP confirmation gate
      await this.writeStage(id, SAP_STAGE, { status: 'pending', enteredAt: new Date() });
    } else {
      phase = 'review';
    }
    await this.prisma.case.update({
      where: { id },
      data: { stage: phase, lastUpdatedById: actor.id },
    });

    await this.audit.append({
      action: `case.stage_${decision}`,
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: { ref: c.ref, stage: stageKey, decision, phase },
    });
    return { ok: true, stage: stageKey, status, phase };
  }

  /** Backwards-compatible alias for the existing InfoSec endpoint. */
  async infosecDecision(
    actor: AuthUser,
    id: string,
    decision: 'approve' | 'reject' | 'sendback',
    note?: string,
  ) {
    return this.stageDecision(actor, id, 'infosec', decision, note);
  }

  /**
   * SAP confirmation — the final stage. Only reachable once every active review stage is approved.
   * Confirming activates the vendor (ERP push + notify); rejecting closes the case.
   */
  async sapDecision(actor: AuthUser, id: string, decision: 'approve' | 'reject', note?: string) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      include: { general: { select: { legalName: true } } },
    });
    if (!c) throw new NotFoundException('Case not found.');
    const owns = actor.roles.includes('sap') || actor.permissions.has(PERMISSIONS.WorkflowManage);
    if (!owns) throw new ForbiddenException('Only the SAP confirmation role can act here.');
    if (c.stage !== SAP_STAGE) {
      throw new BadRequestException('This case has not reached SAP confirmation.');
    }
    if (decision === 'reject' && !note?.trim()) {
      throw new BadRequestException('A remark is required to reject at SAP confirmation.');
    }

    const phase = decision === 'approve' ? 'approved' : 'rejected';
    await this.writeStage(id, SAP_STAGE, {
      status: phase,
      decision,
      remark: note?.trim() || null,
      actionedById: actor.id,
      completedAt: new Date(),
    });
    await this.prisma.case.update({
      where: { id },
      data: {
        stage: phase,
        lastUpdatedById: actor.id,
        ...(phase === 'approved' ? { vendorCode: `V${Date.now().toString().slice(-8)}` } : {}),
        activity: {
          create: {
            id: newId(),
            actorId: actor.id,
            action: `sap_${decision}`,
            fromStage: SAP_STAGE,
            toStage: phase,
            note: note?.trim() || null,
          },
        },
      },
    });

    if (phase === 'approved') {
      await this.erp.activate(id);
      await this.notifications.notify(
        c.createdById,
        'case.approved',
        `Vendor ${c.general?.legalName ?? c.ref} (${c.ref}) has been confirmed in SAP and activated.`,
        `/cases/${id}`,
      );
    }
    await this.audit.append({
      action: `case.sap_${decision}`,
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: { ref: c.ref, decision },
    });
    return { ok: true, phase };
  }

  /**
   * Proposer edits their own case and resubmits. Allowed while it is a fresh draft, or when one or
   * more parallel review stages were sent back to them. On resubmit only the stage(s) that were
   * sent back (plus InfoSec if newly flagged) reopen for review — approved stages keep their sign-off.
   */
  async updateDraft(actor: AuthUser, id: string, input: CaseCreateInput) {
    const c = await this.prisma.case.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Case not found.');
    if (c.createdById !== actor.id) {
      throw new ForbiddenException('Only the proposer who raised this case can edit it.');
    }

    const isec = {
      isecItHardware: input.isecItHardware ?? false,
      isecItSoftware: input.isecItSoftware ?? false,
      isecAccessSystem: input.isecAccessSystem ?? false,
      isecAccessNetwork: input.isecAccessNetwork ?? false,
      isecAccessApps: input.isecAccessApps ?? false,
      isecAccessPii: input.isecAccessPii ?? false,
    };
    const infosecRequired = Object.values(isec).some(Boolean);
    const active = activeReviewStages(infosecRequired);

    // Decide which stages to (re)open. A fresh draft opens the whole active set; otherwise only the
    // stages that were sent back, plus any newly-active stage with no row yet (e.g. InfoSec toggled on).
    const isDraft = c.stage === 'draft';
    const reopen: ReviewStage[] = [];
    if (isDraft) {
      reopen.push(...active);
    } else {
      for (const s of active) {
        const row = await this.readStage(id, s);
        if (!row || row.status === 'sent_back') reopen.push(s);
      }
      if (reopen.length === 0) {
        throw new BadRequestException('This case has no stage awaiting your changes.');
      }
    }

    const category = await this.categories.get(input.categoryKey);
    if (input.subCategoryKey) {
      const sc = await this.prisma.vendorSubCategory.findUnique({
        where: { key: input.subCategoryKey },
      });
      if (!sc || sc.categoryKey !== input.categoryKey) {
        throw new BadRequestException('Invalid sub-category for the selected category.');
      }
    }
    const def = await this.workflows.publishedDefinition(category.workflowKey);
    const risk = assessRisk(this.riskInputFrom(input, category.enhancedDueDiligence));
    const tier = risk.tier;

    // Sensitive identifiers (PAN / bank / signatory PAN) are only rewritten when a fresh, unmasked
    // value is supplied — the detail form shows masked values, so a masked echo is ignored.
    const isMasked = (v?: string) => !v || v.includes('•');

    // The vendor master detail (case_general) is updated; the case row keeps only tracking state.
    const general: Record<string, unknown> = {
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      businessAddress: input.businessAddress ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      signatoryName: input.signatoryName ?? null,
      signatoryEmail: input.signatoryEmail ?? null,
      signatoryMobile: input.signatoryMobile ?? null,
      gstin: input.gstin ?? null,
      gstinBlindIndex: input.gstin ? this.blind.index(input.gstin) : null,
      ifsc: input.ifsc ?? null,
      bankName: input.bankName ?? null,
      branch: input.branch ?? null,
      businessUnit: input.businessUnit ?? null,
      costCentre: input.costCentre ?? null,
      spend: input.spend ?? 0,
      contractMonths: input.contractMonths ?? null,
      natureOfService: input.natureOfService ?? null,
      justification: input.justification ?? '',
      coiDeclared: input.coiDeclared ?? false,
      coiDetails: input.coiDetails ?? null,
      dataAccess: input.dataAccess ?? null,
      systemAccess: input.systemAccess ?? null,
      subcontract: input.subcontract ?? null,
      delivery: input.delivery ?? null,
      screening: input.screening ?? null,
      conflict: input.conflict ?? null,
      litigation: input.litigation ?? null,
      insurance: input.insurance ?? null,
      certifications: input.certifications ?? null,
      ...isec,
    };
    if (!isMasked(input.pan)) {
      general.panEnc = await this.crypto.encryptToString(input.pan as string);
      general.panBlindIndex = this.blind.index(input.pan as string);
    }
    if (!isMasked(input.bankAccount)) {
      general.bankAccountEnc = await this.crypto.encryptToString(input.bankAccount as string);
      general.bankBlindIndex = this.blind.index(input.bankAccount as string);
    }
    if (!isMasked(input.signatoryPan)) {
      general.signatoryPanEnc = await this.crypto.encryptToString(input.signatoryPan as string);
      general.signatoryPanBlindIndex = this.blind.index(input.signatoryPan as string);
    }

    // The case may have been created before case_general existed; upsert to be safe.
    await this.prisma.case.update({
      where: { id },
      data: {
        categoryKey: input.categoryKey,
        subCategoryKey: input.subCategoryKey ?? null,
        workflowKey: def.key,
        workflowVersion: def.version,
        stage: 'review',
        tier,
        riskScore: risk.score,
        infosecRequired,
        lastUpdatedById: actor.id,
        general: {
          upsert: {
            create: { id: newId(), ...general } as Prisma.CaseGeneralCreateWithoutCaseInput,
            update: general as Prisma.CaseGeneralUpdateWithoutCaseInput,
          },
        },
        activity: {
          create: {
            id: newId(),
            actorId: actor.id,
            action: 'resubmitted',
            toStage: 'review',
            note: `Amended and resubmitted; reopened for review: ${reopen.join(', ')}.`,
          },
        },
      },
    });

    // Reopen the chosen stages for review; ensure a (gated) SAP row exists.
    for (const s of reopen) {
      await this.writeStage(id, s, { status: 'pending', enteredAt: new Date() });
    }
    await this.writeStage(id, SAP_STAGE, { status: 'waiting' });
    await this.captureResponses(id, actor, {
      pan: isMasked(input.pan) ? null : input.pan,
      gstin: input.gstin,
      bankAccount: isMasked(input.bankAccount) ? null : input.bankAccount,
      ifsc: input.ifsc,
    });

    await this.audit.append({
      action: 'case.update',
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: { ref: c.ref, tier, reopened: reopen, infosecRequired },
    });
    return { id, ref: c.ref, tier, stage: 'review', infosecRequired, reopened: reopen };
  }

  async list(
    actor: AuthUser,
    filters: { stage?: string; tier?: string; q?: string; queue?: string },
  ) {
    const where: Record<string, unknown> = {};
    if (!this.canSeeAll(actor)) where.OR = [{ createdById: actor.id }, { assigneeId: actor.id }];
    // A stage queue (?queue=fcu|operation|legal|infosec) lists cases awaiting that parallel review;
    // ?queue=sap lists cases at the SAP confirmation gate.
    if (filters.queue) {
      const rel: Record<string, string> = {
        infosec: 'infosecStage',
        fcu: 'fcuStage',
        operation: 'operationStage',
        legal: 'legalStage',
      };
      const relKey = rel[filters.queue];
      if (filters.queue === 'sap') {
        where.stage = SAP_STAGE;
      } else if (relKey) {
        where[relKey] = { status: 'pending' };
        where.stage = 'review';
      }
    } else if (filters.stage) {
      where.stage = filters.stage;
    }
    if (filters.tier) where.tier = filters.tier;
    // The vendor name lives on case_general now.
    if (filters.q) where.general = { legalName: { contains: filters.q, mode: 'insensitive' } };
    const rows = await this.prisma.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        ref: true,
        categoryKey: true,
        stage: true,
        tier: true,
        onHold: true,
        infosecRequired: true,
        dueAt: true,
        assigneeId: true,
        createdById: true,
        createdAt: true,
        general: { select: { legalName: true } },
      },
    });
    // Flatten legalName so the list shape is unchanged for callers.
    return rows.map(({ general, ...r }) => ({ ...r, legalName: general?.legalName ?? '' }));
  }

  async get(actor: AuthUser, id: string) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      include: {
        general: true,
        checklist: { orderBy: { itemId: 'asc' } },
        comments: { orderBy: { at: 'asc' } },
        activity: { orderBy: { at: 'asc' } },
        draftStage: true,
        infosecStage: true,
        fcuStage: true,
        operationStage: true,
        legalStage: true,
        sapStage: true,
      },
    });
    if (!c) throw new NotFoundException('Case not found.');
    this.assertCanSee(actor, c);
    return this.present(c as unknown as Record<string, unknown>, actor);
  }

  async action(actor: AuthUser, id: string, action: WorkflowAction, note?: string) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      include: { checklist: true, general: { select: { legalName: true } } },
    });
    if (!c) throw new NotFoundException('Case not found.');
    this.assertCanSee(actor, c);
    if (ACTION_NEEDS_NOTE[action] && !note?.trim()) {
      throw new BadRequestException('A reason is required for this action.');
    }

    const def = await this.workflows.definitionFor(c.workflowKey, c.workflowVersion);
    const stage = getStage(def, c.stage);
    if (!stage) throw new BadRequestException('Case stage is not in its workflow.');

    const isStageOwner =
      (stage.ownerRole !== null && actor.roles.includes(stage.ownerRole)) ||
      actor.permissions.has(PERMISSIONS.WorkflowManage);
    const outstanding = c.checklist.filter((i) => !i.done).length;

    const result = evaluateTransition(def, c.stage, action, {
      tier: c.tier as TierKey,
      isStageOwner,
      isCaseOwner: c.createdById === actor.id,
      onHold: c.onHold,
      checklistOutstanding: outstanding,
    });
    if (!result.allowed) throw new ForbiddenException(result.reason);

    const data: Record<string, unknown> = {};
    let toStage = c.stage;
    if (action === 'hold') data.onHold = true;
    else if (action === 'resume') data.onHold = false;
    else if (action === 'assign') {
      /* assignee change handled by a dedicated endpoint; no-op transition here */
    } else if (result.toStageKey && result.toStageKey !== c.stage) {
      toStage = result.toStageKey;
      const dest = getStage(def, toStage);
      data.stage = toStage;
      data.onHold = false;
      data.dueAt = dest ? dueDate(dest) : null;
      if (action === 'submit') data.submittedAt = new Date();
      if (toStage === 'approved') data.vendorCode = `V${Date.now().toString().slice(-8)}`;
    }

    data.lastUpdatedById = actor.id;
    await this.prisma.$transaction([
      this.prisma.case.update({ where: { id }, data }),
      this.prisma.caseActivity.create({
        data: {
          id: newId(),
          caseId: id,
          actorId: actor.id,
          action,
          fromStage: c.stage,
          toStage,
          note: note ?? null,
        },
      }),
    ]);

    // Keep the per-stage reporting rows in step with the transition.
    if (toStage !== c.stage) {
      const outStatus =
        action === 'reject' ? 'rejected' : action === 'return' ? 'sent_back' : 'completed';
      await this.writeStage(id, c.stage, {
        status: outStatus,
        decision: action,
        remark: note?.trim() || null,
        actionedById: actor.id,
        completedAt: new Date(),
      });
      await this.writeStage(id, toStage, { status: 'pending', enteredAt: new Date() });
    }

    await this.audit.append({
      action: `case.${action}`,
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: { from: c.stage, to: toStage, note: note ? 'provided' : undefined },
    });

    // On activation: push to ERP (idempotent stub) and notify the proposer.
    if (toStage === 'approved' && c.stage !== 'approved') {
      await this.erp.activate(id);
      await this.notifications.notify(
        c.createdById,
        'case.approved',
        `Vendor ${c.general?.legalName ?? c.ref} (${c.ref}) has been approved and activated.`,
        `/cases/${id}`,
      );
    }
    return { id, stage: toStage, onHold: data.onHold ?? c.onHold };
  }

  async comment(actor: AuthUser, id: string, body: string) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      select: { createdById: true, assigneeId: true },
    });
    if (!c) throw new NotFoundException('Case not found.');
    this.assertCanSee(actor, c);
    const comment = await this.prisma.caseComment.create({
      data: { id: newId(), caseId: id, authorId: actor.id, body },
    });
    await this.audit.append({
      action: 'case.comment',
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
    });
    return comment;
  }

  async tickChecklist(actor: AuthUser, id: string, itemId: string, done: boolean) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      select: { createdById: true, assigneeId: true },
    });
    if (!c) throw new NotFoundException('Case not found.');
    this.assertCanSee(actor, c);
    await this.prisma.caseChecklistItem.update({
      where: { caseId_itemId: { caseId: id, itemId } },
      data: { done, doneById: done ? actor.id : null, doneAt: done ? new Date() : null },
    });
    await this.audit.append({
      action: 'case.checklist',
      entityType: 'Case',
      entityId: id,
      actorId: actor.id,
      detail: { itemId, done },
    });
    return { itemId, done };
  }
}
