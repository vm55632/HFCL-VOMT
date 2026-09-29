import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@vop/shared';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { RequirePermissions } from '../authz/permissions.decorator';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@Controller('cases/:caseId')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post('verify')
  @ApiOperation({ summary: 'Run statutory verification, cross-checks and red flags; re-tier' })
  verify(@CurrentUser() actor: AuthUser, @Param('caseId') caseId: string) {
    return this.verification.runForCase(actor, caseId);
  }

  @Get('verification')
  @ApiOperation({ summary: 'Latest verification result for a case' })
  get(@CurrentUser() actor: AuthUser, @Param('caseId') caseId: string) {
    return this.verification.get(actor, caseId);
  }
}

@ApiTags('verification')
@Controller('review-queue')
export class ReviewQueueController {
  constructor(private readonly verification: VerificationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VendorReadAll)
  @ApiOperation({ summary: 'Cases flagged for manual review (compliance/risk queue)' })
  queue() {
    return this.verification.reviewQueue();
  }
}
