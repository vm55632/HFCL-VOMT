import { maskPhone } from '@vop/shared';
import type { SmsProvider } from './contracts';

/**
 * Mock SMS provider for dev/test. Records the last message (for tests) and logs a masked line;
 * never sends anything. OTP delivery is wired to a real provider in Phase 3.
 */
export class MockSmsProvider implements SmsProvider {
  public readonly sent: Array<{ to: string; message: string }> = [];

  send(to: string, message: string): Promise<void> {
    this.sent.push({ to, message });
    console.warn(`[sms:mock] → ${maskPhone(to)} :: ${message.replace(/\d{4,}/g, '••••')}`);
    return Promise.resolve();
  }
}

/** Real SMS providers (MSG91/Twilio/SNS) — stubbed. */
export class NotImplementedSms implements SmsProvider {
  constructor(private readonly name: string) {}
  send(): Promise<void> {
    return Promise.reject(new Error(`${this.name} SmsProvider is not implemented yet (stub).`));
  }
}
