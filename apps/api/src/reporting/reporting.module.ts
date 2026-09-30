import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth-user';
import { StatsService } from './stats.service';

@ApiTags('reporting')
@Controller('stats')
class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard figures (scoped: own for proposers, all for reviewers)' })
  dashboard(@CurrentUser() actor: AuthUser) {
    return this.stats.dashboard(actor);
  }
}

@Module({
  providers: [StatsService],
  controllers: [StatsController],
  exports: [StatsService],
})
export class ReportingModule {}
