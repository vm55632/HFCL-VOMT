import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '@vop/config';
import type { EmailMessage, EmailProvider } from './contracts';

/**
 * SMTP email via nodemailer — works with Mailpit in dev and any SMTP relay on-prem.
 * Templated bodies are built by the notifications layer (later phase); no sensitive data in emails.
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: AppConfig) {
    const { email } = config;
    this.from = email.from;
    this.transport = nodemailer.createTransport({
      host: email.smtpHost,
      port: email.smtpPort,
      secure: email.smtpSecure,
      auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPassword ?? '' } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/** SendGrid / Azure ACS / AWS SES — stubbed until the provider is chosen. */
export class NotImplementedEmail implements EmailProvider {
  constructor(private readonly name: string) {}
  send(): Promise<void> {
    return Promise.reject(new Error(`${this.name} EmailProvider is not implemented yet (stub).`));
  }
}
