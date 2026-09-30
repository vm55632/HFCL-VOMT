import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PERMISSIONS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LifecycleService } from './lifecycle.service';
import { NotificationsService } from './notifications.service';

const reasonSchema = z.object({ reason: z.string().min(3).max(1000) }).strict();

@ApiTags('lifecycle')
@Controller('cases/:caseId')
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}

  @Post('block')
  @RequirePermissions(PERMISSIONS.VendorReadAll)
  @ApiOperation({ summary: 'Block an activated vendor (reviewer)' })
  block(
    @CurrentUser() actor: AuthUser,
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
  ) {
    return this.lifecycle.block(actor, caseId, body.reason);
  }

  @Post('reactivate')
  @RequirePermissions(PERMISSIONS.VendorReadAll)
  @ApiOperation({ summary: 'Reactivate a blocked vendor (reviewer)' })
  reactivate(
    @CurrentUser() actor: AuthUser,
    @Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: { reason: string },
  ) {
    return this.lifecycle.reactivate(actor, caseId, body.reason);
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "The current user's in-app notifications" })
  list(@CurrentUser() actor: AuthUser) {
    return this.notifications.list(actor.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification read' })
  read(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(actor.id, id);
  }
}
