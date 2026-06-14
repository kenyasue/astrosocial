import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp, type App } from '../../app';
import { config } from '../config/env';
import { makeTestDb } from '../testing/testDb';
import { UserRepository } from '../db/repositories/UserRepository';
import { PostRepository } from '../db/repositories/PostRepository';
import { SettingsRepository } from '../db/repositories/SettingsRepository';
import { SettingsService, applyTags } from './SettingsService';
import { SmtpEmailProvider, type MailTransport } from '../auth/email';
import { ValidationError } from '../types';

describe('applyTags', () => {
  it('substitutes none, one, and repeated tags', () => {
    expect(applyTags('no tags here', { pin: '1', sitename: 'S' })).toBe('no tags here');
    expect(applyTags('PIN: {PIN}', { pin: '424242', sitename: 'S' })).toBe('PIN: 424242');
    expect(applyTags('{PIN}-{sitename}-{PIN}', { pin: '9', sitename: 'Star' })).toBe('9-Star-9');
    expect(applyTags('', { pin: '9', sitename: 'Star' })).toBe('');
  });
});

describe('AdminService authentication', () => {
  let app: App;
  beforeEach(() => {
    app = buildApp({ dbPath: ':memory:' });
  });
  afterEach(() => app.close());

  it('accepts the configured credentials and issues a valid session', () => {
    const token = app.admin.login(config.adminUsername, config.adminPassword);
    expect(token).toBeTruthy();
    expect(app.admin.validate(token)).toBe(true);
  });

  it('rejects wrong credentials', () => {
    expect(app.admin.login(config.adminUsername, 'definitely-wrong')).toBeNull();
    expect(app.admin.login('nope', config.adminPassword)).toBeNull();
    expect(app.admin.validate('not-a-real-token')).toBe(false);
    expect(app.admin.validate(null)).toBe(false);
  });

  it('invalidates a session on logout', () => {
    const token = app.admin.login(config.adminUsername, config.adminPassword)!;
    app.admin.logout(token);
    expect(app.admin.validate(token)).toBe(false);
  });
});

describe('AdminService moderation', () => {
  let app: App;
  let users: UserRepository;
  let posts: PostRepository;

  beforeEach(() => {
    app = buildApp({ dbPath: ':memory:' });
    users = new UserRepository(app.db);
    posts = new PostRepository(app.db);
  });
  afterEach(() => app.close());

  it('edits a user profile', () => {
    const u = users.create({ email: 'u@x.com', username: 'u', displayName: 'U' });
    const updated = app.admin.updateUser(u.id, { displayName: 'Renamed', bio: 'hi' });
    expect(updated.displayName).toBe('Renamed');
    expect(users.findById(u.id)!.bio).toBe('hi');
  });

  it('edits a user email (normalized) and leaves other fields intact', () => {
    const u = users.create({ email: 'old@x.com', username: 'u', displayName: 'U' });
    const updated = app.admin.updateUser(u.id, { email: '  NEW@X.COM ', displayName: 'U' });
    expect(updated.email).toBe('new@x.com');
    expect(users.findById(u.id)!.email).toBe('new@x.com');
    expect(updated.displayName).toBe('U');
  });

  it('accepts re-saving a user with their own unchanged email', () => {
    const u = users.create({ email: 'me@x.com', username: 'me', displayName: 'Me' });
    expect(() => app.admin.updateUser(u.id, { email: 'me@x.com', displayName: 'Me' })).not.toThrow();
    expect(users.findById(u.id)!.email).toBe('me@x.com');
  });

  it('rejects a malformed email and does not persist it', () => {
    const u = users.create({ email: 'good@x.com', username: 'u', displayName: 'U' });
    expect(() => app.admin.updateUser(u.id, { email: 'not-an-email', displayName: 'U' })).toThrow(
      ValidationError
    );
    expect(users.findById(u.id)!.email).toBe('good@x.com');
  });

  it('rejects an email already used by another user', () => {
    const a = users.create({ email: 'a@x.com', username: 'a', displayName: 'A' });
    users.create({ email: 'b@x.com', username: 'b', displayName: 'B' });
    expect(() => app.admin.updateUser(a.id, { email: 'B@X.COM', displayName: 'A' })).toThrow(
      ValidationError
    );
    expect(users.findById(a.id)!.email).toBe('a@x.com');
  });

  it('edits a post title and body', () => {
    const u = users.create({ email: 'u@x.com', username: 'u', displayName: 'U' });
    const post = app.posts.create(u.id, { markdownBody: 'old body', status: 'published' });
    const updated = app.admin.updatePost(post.id, { title: 'New title', markdownBody: 'new body' });
    expect(updated.title).toBe('New title');
    expect(posts.findById(post.id)!.markdownBody).toBe('new body');
  });

  it('deletes a post and its dependents', () => {
    const u = users.create({ email: 'u@x.com', username: 'u', displayName: 'U' });
    const post = app.posts.create(u.id, { markdownBody: 'body', status: 'published' });
    app.social.comment(u.id, post.publicId, 'a comment');
    app.admin.deletePost(post.id);
    expect(posts.findByPublicId(post.publicId)).toBeNull();
  });

  it('deletes (soft) a comment', () => {
    const u = users.create({ email: 'u@x.com', username: 'u', displayName: 'U' });
    const post = app.posts.create(u.id, { markdownBody: 'body', status: 'published' });
    const c = app.social.comment(u.id, post.publicId, 'remove me');
    app.admin.deleteComment(c.id);
    expect(app.social.listComments(post.publicId)).toHaveLength(0);
  });

  it('deletes a user and everything that references them without dangling rows', () => {
    const victim = users.create({ email: 'victim@x.com', username: 'victim', displayName: 'Victim' });
    const other = users.create({ email: 'other@x.com', username: 'other', displayName: 'Other' });
    const post = app.posts.create(victim.id, { markdownBody: 'mine', status: 'published' });
    // Cross-references from another user onto the victim's content + a mutual follow.
    app.social.comment(other.id, post.publicId, 'nice post');
    app.social.like(other.id, post.publicId);
    app.social.follow(victim.id, 'other');
    app.social.follow(other.id, 'victim');

    expect(() => app.admin.deleteUser(victim.id)).not.toThrow();

    expect(users.findById(victim.id)).toBeNull();
    expect(posts.findByPublicId(post.publicId)).toBeNull(); // post + its comment/like gone
    expect(users.findById(other.id)).not.toBeNull(); // the other user survives
    expect(app.social.isFollowing(other.id, 'victim')).toBe(false); // follow removed
    // Foreign-key integrity check: a generic count over a referencing table works.
    const danglingFollows = app.db
      .prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_user_id = ? OR following_user_id = ?')
      .get(victim.id, victim.id) as { c: number };
    expect(danglingFollows.c).toBe(0);
  });

  it('exposes a NotFoundError for missing entities', () => {
    expect(() => app.admin.getUser('nope')).toThrow();
    expect(() => app.admin.deletePost('nope')).toThrow();
  });
});

describe('SettingsService (SMTP)', () => {
  let svc: SettingsService;
  let db: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    db = makeTestDb();
    svc = new SettingsService(new SettingsRepository(db));
  });
  afterEach(() => db.close());

  it('defaults to unconfigured', () => {
    expect(svc.isSmtpConfigured()).toBe(false);
    expect(svc.getSmtp().host).toBe('');
  });

  it('saves and reads back SMTP settings', () => {
    svc.saveSmtp({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      username: 'mailer',
      password: 'pw',
      fromAddress: 'noreply@example.com',
    });
    const s = svc.getSmtp();
    expect(s.host).toBe('smtp.example.com');
    expect(s.port).toBe(587);
    expect(s.secure).toBe(false);
    expect(s.fromAddress).toBe('noreply@example.com');
    expect(svc.isSmtpConfigured()).toBe(true);
  });

  it('rejects an invalid port and an invalid from-address when a host is set', () => {
    const base = { host: 'smtp.x.com', port: 587, secure: false, username: '', password: '', fromAddress: 'a@b.co' };
    expect(() => svc.saveSmtp({ ...base, port: 70_000 })).toThrow(ValidationError);
    expect(() => svc.saveSmtp({ ...base, fromAddress: 'not-an-email' })).toThrow(ValidationError);
  });

  it('allows clearing the config with an empty host', () => {
    expect(() =>
      svc.saveSmtp({ host: '', port: 0, secure: false, username: '', password: '', fromAddress: '' })
    ).not.toThrow();
    expect(svc.isSmtpConfigured()).toBe(false);
  });
});

describe('SmtpEmailProvider', () => {
  let db: ReturnType<typeof makeTestDb>;
  let settings: SettingsService;

  beforeEach(() => {
    db = makeTestDb();
    settings = new SettingsService(new SettingsRepository(db));
  });
  afterEach(() => db.close());

  it('sends over SMTP when configured', async () => {
    settings.saveSmtp({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      username: 'u',
      password: 'p',
      fromAddress: 'noreply@example.com',
    });
    const sent: { from: string; to: string; subject: string; text: string }[] = [];
    const transport: MailTransport = {
      async sendMail(m) {
        sent.push(m);
        return {};
      },
    };
    const provider = new SmtpEmailProvider(settings, () => transport);

    await provider.sendPin('user@example.com', '123456');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('user@example.com');
    expect(sent[0].from).toBe('noreply@example.com');
    expect(sent[0].text).toContain('123456');
    // No site name configured → subject uses the default site name.
    expect(sent[0].subject).toBe('Your AstroSocial login PIN');
  });

  it('falls back to no SMTP send when not configured', async () => {
    let built = false;
    const provider = new SmtpEmailProvider(settings, () => {
      built = true;
      return { async sendMail() { return {}; } };
    });
    await provider.sendPin('user@example.com', '000000');
    expect(built).toBe(false); // never built a transport → fell back to console
  });

  it('sends the configured template with {PIN}/{sitename} substituted', async () => {
    settings.saveGeneral({
      siteName: 'Star Club',
      siteDescription: 'astro photos',
      emailTemplate: 'Hello! Your {sitename} code is {PIN}. Enjoy.',
    });
    settings.saveSmtp({
      host: 'smtp.example.com', port: 587, secure: false,
      username: '', password: '', fromAddress: 'noreply@example.com',
    });
    const sent: { subject: string; text: string }[] = [];
    const provider = new SmtpEmailProvider(settings, () => ({
      async sendMail(m) { sent.push(m); return {}; },
    }));
    await provider.sendPin('user@example.com', '424242');
    expect(sent[0].text).toBe('Hello! Your Star Club code is 424242. Enjoy.');
    expect(sent[0].subject).toBe('Your Star Club login PIN');
  });
});

describe('SettingsService (site + login-email template)', () => {
  let db: ReturnType<typeof makeTestDb>;
  let svc: SettingsService;

  beforeEach(() => {
    db = makeTestDb();
    svc = new SettingsService(new SettingsRepository(db));
  });
  afterEach(() => db.close());

  it('defaults site name and email template when unset', () => {
    expect(svc.getSite()).toEqual({ name: 'AstroSocial', description: '' });
    expect(svc.getEmailTemplate()).toContain('{PIN}');
    expect(svc.getEmailTemplate()).toContain('{sitename}');
  });

  it('round-trips site name, description, and template', () => {
    svc.saveGeneral({
      siteName: 'Nebula Net',
      siteDescription: 'Deep-sky community',
      emailTemplate: 'Code: {PIN}',
    });
    expect(svc.getSite()).toEqual({ name: 'Nebula Net', description: 'Deep-sky community' });
    expect(svc.getEmailTemplate()).toBe('Code: {PIN}');
  });

  it('falls back to the default site name when saved blank', () => {
    svc.saveGeneral({ siteName: '   ', siteDescription: '', emailTemplate: '' });
    expect(svc.getSite().name).toBe('AstroSocial');
    expect(svc.getEmailTemplate()).toContain('{sitename}'); // blank → default template
  });

  it('renderLoginEmail substitutes both tags and uses the site name in the subject', () => {
    svc.saveGeneral({
      siteName: 'MySite',
      siteDescription: '',
      emailTemplate: 'Hi {PIN} from {sitename} — {PIN} again',
    });
    const msg = svc.renderLoginEmail('000999');
    expect(msg.text).toBe('Hi 000999 from MySite — 000999 again');
    expect(msg.subject).toBe('Your MySite login PIN');
  });
});
