import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@vop/shared';
import { RequirePermissions } from '../authz/permissions.decorator';
import { SlaService, type SweepResult } from './sla.service';

@ApiTags('maintenance')
@Controller('maintenance')
export class JobsController {
  constructor(private readonly sla: SlaService) {}

  @Post('sweep')
  @RequirePermissions(PERMISSIONS.SettingsManage)
  @ApiOperation({ summary: 'Run the SLA/escalation sweep now (admin; also runs on a schedule)' })
  sweep(): Promise<SweepResult> {
    return this.sla.sweep();
  }
}
