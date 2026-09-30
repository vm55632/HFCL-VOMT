import { Inject, Injectable } from '@nestjs/common';
import { newId } from '@vop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/contracts';
import { PinoLoggerService } from '../common/logging/logger.service';

/**
 * In-app + email notifications. Templated, and deliberately free of sensitive data (no PAN/bank
 * in the body). Email is best-effort via the EmailProvider; a failure never blocks the action.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly logger: PinoLoggerService,
  ) {}

  async notify(userId: string, type: string, message: string, link?: string): Promise<void> {
    await this.prisma.notification.create({
      data: { id: newId(), userId, type, message, link: link ?? null },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email) {
      try {
        await this.email.send({
          to: user.email,
          subject: `VOP notification: ${type}`,
          html: `<p>${message}</p><p>Sign in to the Vendor Onboarding Platform for details.</p>`,
          text: message,
        });
      } catch (err) {
        this.logger.warn(
          `notification email failed: ${(err as Error).message}`,
          'NotificationsService',
        );
      }
    }
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }
}
