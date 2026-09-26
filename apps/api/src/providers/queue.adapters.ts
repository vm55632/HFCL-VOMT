import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import type { AppConfig } from '@vop/config';
import type { QueueProvider } from './contracts';

/**
 * Redis-backed job queue (BullMQ). SLA timers, escalations and notifications enqueue here.
 * A shared connection is reused; queues are created lazily per name.
 */
export class RedisQueueProvider implements QueueProvider {
  private readonly connection: Redis;
  private readonly queues = new Map<string, Queue>();

  constructor(config: AppConfig) {
    // lazyConnect: don't dial Redis until the first job is enqueued (nothing connects at boot).
    this.connection = new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    // Keep connection errors observable but non-fatal (avoids unhandled 'error' events).
    this.connection.on('error', (err) => {
      console.error(`[queue] redis connection error: ${err.message}`);
    });
  }

  private queue(name: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueue(queue: string, name: string, data: Record<string, unknown>): Promise<void> {
    await this.queue(queue).add(name, data, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}

/** Cloud queues (Service Bus / SQS / Pub-Sub) — stubbed until the cloud is chosen. */
export class NotImplementedQueue implements QueueProvider {
  constructor(private readonly name: string) {}
  enqueue(): Promise<void> {
    return Promise.reject(new Error(`${this.name} QueueProvider is not implemented yet (stub).`));
  }
}
