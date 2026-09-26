import { Inject, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { AppConfig } from '@vop/config';
import { APP_CONFIG } from '../config/config.module';
import { RegistrationModule } from '../registration/registration.module';
import { SlaService } from './sla.service';
import { JobsController } from './jobs.controller';
import { PinoLoggerService } from '../common/logging/logger.service';

const QUEUE = 'vop-maintenance';
const SLA_JOB = 'sla-sweep';

/**
 * Background jobs (BullMQ over Redis): a repeatable SLA sweep for escalations and, in Phase 3,
 * workflow-case SLA reminders. Gated by VOP_JOBS_ENABLED so a dev box without Redis boots clean.
 * The worker and its Redis connection are closed on shutdown.
 */
@Module({
  imports: [RegistrationModule],
  controllers: [JobsController],
  providers: [SlaService],
  exports: [SlaService],
})
export class JobsModule implements OnModuleInit, OnModuleDestroy {
  private connection?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sla: SlaService,
    private readonly logger: PinoLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.jobs.enabled) {
      this.logger.log('Background jobs disabled (VOP_JOBS_ENABLED=false).', 'JobsModule');
      return;
    }
    this.connection = new IORedis(this.config.redis.url, { maxRetriesPerRequest: null });
    this.connection.on('error', (err) =>
      this.logger.warn(`jobs redis error: ${err.message}`, 'JobsModule'),
    );

    this.worker = new Worker(
      QUEUE,
      async (job) => {
        if (job.name === SLA_JOB) return this.sla.sweep();
        return undefined;
      },
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`job ${job?.name ?? '?'} failed: ${err.message}`, undefined, 'JobsModule'),
    );

    this.queue = new Queue(QUEUE, { connection: this.connection });
    // Repeatable sweep on the configured cron; a fixed jobId prevents duplicates on restart.
    await this.queue.add(
      SLA_JOB,
      {},
      {
        repeat: { pattern: this.config.jobs.slaSweepCron },
        jobId: SLA_JOB,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    this.logger.log(`Scheduled SLA sweep (${this.config.jobs.slaSweepCron}).`, 'JobsModule');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit().catch(() => undefined);
  }
}
