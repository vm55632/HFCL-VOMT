import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Liveness and readiness probes (12-factor / K8s). `live` says the process is up; `ready` says it
 * can serve — i.e. its critical dependencies (the database) are reachable.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (checks dependencies)' })
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    const healthy = Object.values(checks).every((v) => v === 'up');
    if (!healthy) {
      throw new ServiceUnavailableException({ status: 'not_ready', checks });
    }
    return { status: 'ready', checks };
  }
}
