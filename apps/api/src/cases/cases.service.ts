import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTION_NEEDS_NOTE,
  applicablePath,
  assessRisk,
  dueDate,
  dueDiligencePack,
  evaluateTransition,
  getStage,
  maskAccount,
  maskPan,
  newId,
  PERMISSIONS,
  type RiskInput,
  type TierKey,
  type WorkflowAction,
} from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { BlindIndexService } from '../crypto/blind-index.service';
import { WorkflowsService } from '../workflow/workflows.service';
import { CategoriesService } from '../master-data/categories.service';
import { ErpService } from '../lifecycle/erp.service';
import { NotificationsService } from '../lifecycle/notifications.service';
import type { AuthUser } from '../auth/auth-user';

export interface CaseCreateInput {
  categoryKey: string;
  legalName: string;
  tradeName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  pan?: string;
  gstin?: string;
  ifsc?: string;
  bankAccount?: string;
  businessUnit?: string;
  costCentre?: string;
  spend?: number;
  contractMonths?: number;
  natureOfService?: string;
  justification: string;
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

  /** Present a case with PAN/bank masked unless the actor may view sensitive data (audited). */
  private async present(
    c: Record<string, unknown>,
    actor: AuthUser,
  ): Promise<Record<string, unknown>> {
    const reveal = actor.permissions.has(PERMISSIONS.VendorViewSensitive);
    const out: Record<string, unknown> = { ...c };
    delete out.panEnc;
    delete out.panBlindIndex;
    delete out.bankAccountEnc;
    delete out.bankBlindIndex;
    delete out.gstinBlindIndex;

    if (reveal && c.panEnc) {
      const pan = await this.crypto.decryptFromString(c.panEnc as string);
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
      out.pan = c.panEnc ? '••••••••••' : null;
    }
    if (reveal && c.bankAccountEnc) {
      out.bankAccount = await this.crypto.decryptFromString(c.bankAccountEnc as string);
    } else {
      out.bankAccount = c.bankAccountEnc ? maskAccount('0000') : null;
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
    const rows = await this.prisma.case.findMany({
      where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: {
        ref: true,
        legalName: true,
        panBlindIndex: true,
        gstinBlindIndex: true,
        bankBlindIndex: true,
        contactEmail: true,
        contactPhone: true,
      },
    });
    const flags: DuplicateFlag[] = [];
    for (const r of rows) {
      if (idx.pan && r.panBlindIndex === idx.pan)
        flags.push({ field: 'PAN', ref: r.ref, legalName: r.legalName });
      else if (idx.gstin && r.gstinBlindIndex === idx.gstin)
        flags.push({ field: 'GSTIN', ref: r.ref, legalName: r.legalName });
      else if (idx.bank && r.bankBlindIndex === idx.bank)
        flags.push({ field: 'bank account', ref: r.ref, legalName: r.legalName });
      else if (idx.email && r.contactEmail === idx.email)
        flags.push({ field: 'email', ref: r.ref, legalName: r.legalName });
      else if (idx.phone && r.contactPhone === idx.phone)
        flags.push({ field: 'phone', ref: r.ref, legalName: r.legalName });
    }
    return flags;
  }

  // ---------- lifecycle ----------

  async create(actor: AuthUser, input: CaseCreateInput) {
    const category = await this.categories.get(input.categoryKey);
    const def = await this.workflows.publishedDefinition(category.workflowKey);
    const published = await this.workflows.getPublished(category.workflowKey);

    const risk = assessRisk(this.riskInputFrom(input, category.enhancedDueDiligence));
    const tier = risk.tier;
    const path = applicablePath(def, tier);
    const firstStage = path[0];
    if (!firstStage) throw new BadRequestException('Workflow has no startable stage.');

    const panIdx = input.pan ? this.blind.index(input.pan) : null;
    const gstIdx = input.gstin ? this.blind.index(input.gstin) : null;
    const bankIdx = input.bankAccount ? this.blind.index(input.bankAccount) : null;

    const id = newId();
    const ref = await this.nextRef();
    const pack = dueDiligencePack(risk, this.riskInputFrom(input, category.enhancedDueDiligence));

    await this.prisma.case.create({
      data: {
        id,
        ref,
        categoryKey: input.categoryKey,
        workflowKey: published.key,
        workflowVersion: published.version,
        stage: firstStage.key,
        tier,
        riskScore: risk.score,
        createdById: actor.id,
        legalName: input.legalName,
        tradeName: input.tradeName ?? null,
        contactName: input.contactName ?? null,
        contactEmail: input.contactEmail ?? null,
        contactPhone: input.contactPhone ?? null,
        panEnc: input.pan ? await this.crypto.encryptToString(input.pan) : null,
        panBlindIndex: panIdx,
        gstin: input.gstin ?? null,
        gstinBlindIndex: gstIdx,
        ifsc: input.ifsc ?? null,
        bankAccountEnc: input.bankAccount
          ? await this.crypto.encryptToString(input.bankAccount)
          : null,
        bankBlindIndex: bankIdx,
        businessUnit: input.businessUnit ?? null,
        costCentre: input.costCentre ?? null,
        spend: input.spend ?? 0,
        contractMonths: input.contractMonths ?? null,
        natureOfService: input.natureOfService ?? null,
        justification: input.justification,
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
        checklist: {
          create: pack.map((it) => ({
            id: newId(),
            itemId: it.id,
            label: it.label,
            role: it.role,
          })),
        },
        activity: {
          create: [{ id: newId(), actorId: actor.id, action: 'created', toStage: firstStage.key }],
        },
      },
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
      detail: { ref, tier, category: input.categoryKey, duplicateFlags: duplicates.length },
    });

    return { id, ref, tier, riskScore: risk.score, drivers: risk.drivers, duplicates };
  }

  async list(actor: AuthUser, filters: { stage?: string; tier?: string; q?: string }) {
    const where: Record<string, unknown> = {};
    if (!this.canSeeAll(actor)) where.OR = [{ createdById: actor.id }, { assigneeId: actor.id }];
    if (filters.stage) where.stage = filters.stage;
    if (filters.tier) where.tier = filters.tier;
    if (filters.q) where.legalName = { contains: filters.q, mode: 'insensitive' };
    return this.prisma.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        ref: true,
        legalName: true,
        categoryKey: true,
        stage: true,
        tier: true,
        onHold: true,
        dueAt: true,
        assigneeId: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async get(actor: AuthUser, id: string) {
    const c = await this.prisma.case.findUnique({
      where: { id },
      include: {
        checklist: { orderBy: { itemId: 'asc' } },
        comments: { orderBy: { at: 'asc' } },
        activity: { orderBy: { at: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Case not found.');
    this.assertCanSee(actor, c);
    return this.present(c as unknown as Record<string, unknown>, actor);
  }

  async action(actor: AuthUser, id: string, action: WorkflowAction, note?: string) {
    const c = await this.prisma.case.findUnique({ where: { id }, include: { checklist: true } });
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
        `Vendor ${c.legalName} (${c.ref}) has been approved and activated.`,
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
