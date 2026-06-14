/**
 * Settings service: typed access to the admin-configurable application settings,
 * currently the SMTP server used to deliver login email. Values are persisted in
 * the `app_settings` key/value table via {@link SettingsRepository}.
 */
import { ValidationError } from '../types';
import type { SettingsRepository } from '../db/repositories/SettingsRepository';

export interface SmtpSettings {
  host: string;
  port: number;
  /** Use implicit TLS (true → port 465) vs STARTTLS/none. */
  secure: boolean;
  username: string;
  password: string;
  /** The From address used on outgoing login email. */
  fromAddress: string;
}

/** Public site identity, shown on the login page and used in login email. */
export interface SiteSettings {
  name: string;
  description: string;
}

/** Site name + description + login-email template, edited together by the admin. */
export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  emailTemplate: string;
}

export const DEFAULT_SITE_NAME = 'AstroSocial';
export const DEFAULT_EMAIL_TEMPLATE =
  'Your {sitename} login PIN is {PIN}. It expires shortly. ' +
  'If you did not request this, you can safely ignore this email.';

const KEY = {
  host: 'smtp.host',
  port: 'smtp.port',
  secure: 'smtp.secure',
  username: 'smtp.username',
  password: 'smtp.password',
  from: 'smtp.from',
  siteName: 'site.name',
  siteDescription: 'site.description',
  emailTemplate: 'email.template',
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Substitute the supported template tags ({PIN}, {sitename}) in `template`. */
export function applyTags(template: string, vars: { pin: string; sitename: string }): string {
  return template.replace(/\{PIN\}/g, vars.pin).replace(/\{sitename\}/g, vars.sitename);
}

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  /** Current SMTP settings, with empty/zero defaults when unset. */
  getSmtp(): SmtpSettings {
    const all = this.settings.getMany('smtp.');
    return {
      host: all[KEY.host] ?? '',
      port: Number.parseInt(all[KEY.port] ?? '', 10) || 0,
      secure: all[KEY.secure] === 'true',
      username: all[KEY.username] ?? '',
      password: all[KEY.password] ?? '',
      fromAddress: all[KEY.from] ?? '',
    };
  }

  /** True when enough is configured to attempt sending (host + from address). */
  isSmtpConfigured(): boolean {
    const s = this.getSmtp();
    return s.host.trim() !== '' && s.fromAddress.trim() !== '';
  }

  /**
   * Validate and persist SMTP settings. An empty host clears the configuration
   * (login email falls back to console logging).
   */
  saveSmtp(input: SmtpSettings): void {
    const host = input.host.trim();
    const fromAddress = input.fromAddress.trim();
    const port = input.port;

    if (host !== '') {
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new ValidationError('Port must be between 1 and 65535', 'port');
      }
      if (!EMAIL_RE.test(fromAddress)) {
        throw new ValidationError('A valid From address is required', 'fromAddress');
      }
    }

    this.settings.setMany({
      [KEY.host]: host,
      [KEY.port]: String(port || 0),
      [KEY.secure]: input.secure ? 'true' : 'false',
      [KEY.username]: input.username.trim(),
      [KEY.password]: input.password,
      [KEY.from]: fromAddress,
    });
  }

  // --- site identity + login-email template ---------------------------------

  /** Public site name + description (name falls back to the default when blank). */
  getSite(): SiteSettings {
    return {
      name: (this.settings.get(KEY.siteName) ?? '').trim() || DEFAULT_SITE_NAME,
      description: this.settings.get(KEY.siteDescription) ?? '',
    };
  }

  /** The login-email body template (falls back to the default when blank). */
  getEmailTemplate(): string {
    const t = this.settings.get(KEY.emailTemplate) ?? '';
    return t.trim() ? t : DEFAULT_EMAIL_TEMPLATE;
  }

  /** Persist site name, description, and the login-email template together. */
  saveGeneral(input: GeneralSettings): void {
    this.settings.setMany({
      [KEY.siteName]: input.siteName.trim(),
      [KEY.siteDescription]: input.siteDescription.trim(),
      [KEY.emailTemplate]: input.emailTemplate,
    });
  }

  /** Render the login-PIN email (subject + body) with tags substituted. */
  renderLoginEmail(pin: string): { subject: string; text: string } {
    const sitename = this.getSite().name;
    return {
      subject: `Your ${sitename} login PIN`,
      text: applyTags(this.getEmailTemplate(), { pin, sitename }),
    };
  }
}
