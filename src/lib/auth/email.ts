/**
 * Email delivery abstraction for login PINs.
 *
 * Two implementations: a console logger (dev/test, and the fallback when SMTP is
 * not configured) and an SMTP sender (nodemailer) that reads the admin-configured
 * SMTP settings at send time. In test mode the PIN is fixed ("000000") so tests
 * do not read email at all.
 */
import nodemailer from 'nodemailer';
import type { SettingsService } from '../services/SettingsService';

export interface EmailProvider {
  /** Deliver a login PIN to the given email address. */
  sendPin(email: string, pin: string): Promise<void>;
}

/** Logs the PIN to the console instead of sending real email (dev/test). */
export class ConsoleEmailProvider implements EmailProvider {
  async sendPin(email: string, pin: string): Promise<void> {
    console.log(`[email] login PIN for ${email}: ${pin}`);
  }
}

/** Minimal transport surface used to send mail (nodemailer-compatible). */
export interface MailTransport {
  sendMail(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
}

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

/**
 * Sends login PINs over SMTP using the admin-configured settings. When SMTP is
 * not configured, falls back to logging the PIN (so dev works without setup).
 *
 * @param settings - source of the current SMTP configuration
 * @param transportFactory - injectable transport builder (tests pass a fake)
 */
export class SmtpEmailProvider implements EmailProvider {
  constructor(
    private readonly settings: SettingsService,
    private readonly transportFactory: (config: SmtpTransportConfig) => MailTransport = (c) =>
      nodemailer.createTransport(c) as unknown as MailTransport
  ) {}

  async sendPin(email: string, pin: string): Promise<void> {
    const { subject, text } = this.settings.renderLoginEmail(pin);
    if (!this.settings.isSmtpConfigured()) {
      // Not configured: log the rendered message instead of sending.
      console.log(`[email] to ${email} — ${subject}\n${text}`);
      return;
    }
    const smtp = this.settings.getSmtp();
    const transport = this.transportFactory({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    });
    await transport.sendMail({ from: smtp.fromAddress, to: email, subject, text });
  }
}
