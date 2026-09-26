import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSIONS, WORKFLOW_ACTIONS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CasesService, type CaseCreateInput } from './cases.service';

const createSchema = z
  .object({
    categoryKey: z.string().min(1),
    legalName: z.string().min(1),
    tradeName: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    pan: z.string().optional(),
    gstin: z.string().optional(),
    ifsc: z.string().optional(),
    bankAccount: z.string().optional(),
    businessUnit: z.string().optional(),
    costCentre: z.string().optional(),
    spend: z.number().int().min(0).optional(),
    contractMonths: z.number().int().min(0).optional(),
    natureOfService: z.string().optional(),
    justification: z.string().min(10, 'Provide a business justification.'),
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
  })
  .strict();

const actionSchema = z
  .object({ action: z.enum(WORKFLOW_ACTIONS), note: z.string().max(2000).optional() })
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
  ) {
    return this.cases.list(actor, { stage, tier, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a case (masked unless vendor:view_sensitive)' })
  get(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.cases.get(actor, id);
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
