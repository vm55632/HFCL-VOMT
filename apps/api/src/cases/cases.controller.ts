import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  PERMISSIONS,
  WORKFLOW_ACTIONS,
  REVIEW_STAGES,
  type ReviewStage,
  validatePan,
  validateGstin,
  validateIfsc,
} from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CasesService, type CaseCreateInput } from './cases.service';

const createSchema = z
  .object({
    categoryKey: z.string().min(1),
    subCategoryKey: z.string().optional(),
    legalName: z.string().min(1),
    tradeName: z.string().optional(),
    businessAddress: z.string().max(500).optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    signatoryName: z.string().max(200).optional(),
    signatoryEmail: z.string().email('Enter a valid email address.').optional(),
    signatoryMobile: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Mobile must be a 10-digit Indian number.')
      .optional(),
    signatoryPan: z.string().optional(),
    pan: z.string().optional(),
    gstin: z.string().optional(),
    ifsc: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
    branch: z.string().optional(),
    businessUnit: z.string().optional(),
    costCentre: z.string().optional(),
    spend: z.number().int().min(0).optional(),
    contractMonths: z.number().int().min(0).optional(),
    natureOfService: z.string().optional(),
    justification: z.string().max(4000).optional(),
    coiDeclared: z.boolean().optional(),
    coiDetails: z.string().optional(),
    dataAccess: z.string().optional(),
    systemAccess: z.string().optional(),
    subcontract: z.string().optional(),
    delivery: z.string().optional(),
    screening: z.string().optional(),
    conflict: z.string().optional(),
    litigation: z.string().optional(),
    insurance: z.string().optional(),
    certifications: z.string().optional(),
    // information-security questionnaire — all required; any true routes to InfoSec review
    isecItHardware: z.boolean(),
    isecItSoftware: z.boolean(),
    isecAccessSystem: z.boolean(),
    isecAccessNetwork: z.boolean(),
    isecAccessApps: z.boolean(),
    isecAccessPii: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    // Server-side format validation for statutory identifiers (defence in depth; the UI also checks).
    if (v.pan && !validatePan(v.pan).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pan'],
        message: 'PAN must be five letters, four digits, then one letter (e.g. ABCDE1234F).',
      });
    }
    if (v.gstin) {
      const g = validateGstin(v.gstin, v.pan);
      if (!g.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gstin'], message: g.errors[0] });
      }
    }
    if (v.ifsc && !validateIfsc(v.ifsc).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ifsc'],
        message: 'IFSC must be four letters, a zero, then six characters (e.g. HDFC0001234).',
      });
    }
    if (v.signatoryPan && !validatePan(v.signatoryPan).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['signatoryPan'],
        message: 'PAN must be five letters, four digits, then one letter (e.g. ABCDE1234F).',
      });
    }
  });

const actionSchema = z
  .object({ action: z.enum(WORKFLOW_ACTIONS), note: z.string().max(2000).optional() })
  .strict();
const infosecDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'sendback']),
    note: z.string().max(2000).optional(),
  })
  .strict();
const stageDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject', 'sendback']),
    note: z.string().max(2000).optional(),
    agreement: z.string().max(20000).optional(),
  })
  .strict();
const sapDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().max(2000).optional(),
  })
  .strict();
const commentSchema = z.object({ body: z.string().min(1).max(4000) }).strict();
const checklistSchema = z.object({ itemId: z.string().min(1), done: z.boolean() }).strict();

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VendorCreate)
  @ApiOperation({ summary: 'Raise a vendor onboarding case (proposer)' })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(createSchema)) body: CaseCreateInput,
  ) {
    return this.cases.create(actor, body);
  }

  @Get()
  @ApiOperation({ summary: 'List cases (own for proposers, all for reviewers)' })
  list(
    @CurrentUser() actor: AuthUser,
    @Query('stage') stage?: string,
    @Query('tier') tier?: string,
    @Query('q') q?: string,
    @Query('queue') queue?: string,
  ) {
    return this.cases.list(actor, { stage, tier, q, queue });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a case (masked unless vendor:view_sensitive)' })
  get(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.cases.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VendorEdit)
  @ApiOperation({ summary: 'Edit and resubmit an own draft case (proposer)' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createSchema)) body: CaseCreateInput,
  ) {
    return this.cases.updateDraft(actor, id, body);
  }

  @Post(':id/action')
  @ApiOperation({ summary: 'Workflow action: submit/advance/return/reject/hold/resume/reopen' })
  action(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actionSchema)) body: z.infer<typeof actionSchema>,
  ) {
    return this.cases.action(actor, id, body.action, body.note);
  }

  @Post(':id/infosec-decision')
  @RequirePermissions(PERMISSIONS.WorkflowStageApprove)
  @ApiOperation({ summary: 'InfoSec review decision: approve / reject / send back (with remark)' })
  infosecDecision(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(infosecDecisionSchema)) body: z.infer<typeof infosecDecisionSchema>,
  ) {
    return this.cases.infosecDecision(actor, id, body.decision, body.note);
  }

  @Post(':id/stage/:stage/decision')
  @RequirePermissions(PERMISSIONS.WorkflowStageApprove)
  @ApiOperation({
    summary: 'Parallel stage decision (InfoSec/FCU/Operation/Legal): approve/reject/sendback',
  })
  stageDecision(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Param('stage') stage: string,
    @Body(new ZodValidationPipe(stageDecisionSchema)) body: z.infer<typeof stageDecisionSchema>,
  ) {
    if (!REVIEW_STAGES.includes(stage as ReviewStage)) {
      throw new BadRequestException('Unknown review stage.');
    }
    return this.cases.stageDecision(actor, id, stage as ReviewStage, body.decision, body.note, {
      agreement: body.agreement,
    });
  }

  @Post(':id/sap-decision')
  @RequirePermissions(PERMISSIONS.WorkflowStageApprove)
  @ApiOperation({
    summary: 'SAP confirmation (final stage): approve activates the vendor / reject',
  })
  sapDecision(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sapDecisionSchema)) body: z.infer<typeof sapDecisionSchema>,
  ) {
    return this.cases.sapDecision(actor, id, body.decision, body.note);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a case' })
  comment(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(commentSchema)) body: z.infer<typeof commentSchema>,
  ) {
    return this.cases.comment(actor, id, body.body);
  }

  @Post(':id/checklist')
  @ApiOperation({ summary: 'Sign off / clear a due-diligence checklist item' })
  checklist(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checklistSchema)) body: z.infer<typeof checklistSchema>,
  ) {
    return this.cases.tickChecklist(actor, id, body.itemId, body.done);
  }
}
