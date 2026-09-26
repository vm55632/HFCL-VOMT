import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSIONS, TIER_KEYS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WorkflowsService, type WorkflowInput } from './workflows.service';

const permSchema = z
  .object({
    roleKey: z.string().min(1),
    canView: z.boolean().optional(),
    canEditFields: z.boolean().optional(),
    canApprove: z.boolean().optional(),
    canReject: z.boolean().optional(),
    canSendBack: z.boolean().optional(),
    canReassign: z.boolean().optional(),
  })
  .strict();

const stageSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9_]+$/),
    name: z.string().min(1),
    shortName: z.string().min(1),
    order: z.number().int(),
    ownerRole: z.string().nullable().optional(),
    slaBusinessDays: z.number().int().min(0).optional(),
    terminal: z.boolean().optional(),
    applicableTiers: z.array(z.enum(TIER_KEYS)).optional(),
    evidenceGate: z.boolean().optional(),
    permissions: z.array(permSchema).optional(),
  })
  .strict();

const workflowSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    rejectStageKey: z.string().optional(),
    stages: z.array(stageSchema).min(1),
  })
  .strict();

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'List workflow definitions (all versions)' })
  list() {
    return this.workflows.list();
  }

  @Get('published/:key')
  @ApiOperation({ summary: 'The published workflow for a key' })
  getPublished(@Param('key') key: string) {
    return this.workflows.getPublished(key);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Get a workflow definition' })
  getOne(@Param('id') id: string) {
    return this.workflows.getById(id);
  }

  @Get(':id/preview')
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Route preview per risk tier' })
  preview(@Param('id') id: string) {
    return this.workflows.preview(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Create a draft workflow (new key or next version)' })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(workflowSchema)) body: WorkflowInput,
  ) {
    return this.workflows.createDraft(body, actor.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Edit a draft workflow' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(workflowSchema)) body: WorkflowInput,
  ) {
    return this.workflows.updateDraft(id, body, actor.id);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Publish a draft (archives the prior published version)' })
  publish(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.workflows.publish(id, actor.id);
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.WorkflowManage)
  @ApiOperation({ summary: 'Archive a workflow version' })
  archive(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.workflows.archive(id, actor.id);
  }
}
