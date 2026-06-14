/**
 * Seed script: create a demo user and a few sample published posts so a fresh
 * self-hosted instance has content to look at. Run with `npm run seed`.
 * Idempotent: does nothing if the demo user already exists.
 */
import { buildApp } from '../../app';
import { UserRepository } from './repositories/UserRepository';

const SAMPLE_POSTS = [
  {
    title: 'Welcome to AstroSocial',
    body: '# Hello!\n\nAstroSocial is a self-hostable social publishing platform. Write **Markdown**, add cover images, and share.',
    tags: ['welcome', 'meta'],
  },
  {
    title: 'Why self-host?',
    body: 'Own your content and your data. AstroSocial runs from a single Docker Compose file on SQLite.',
    tags: ['self-hosting'],
  },
  {
    title: 'Markdown tips',
    body: 'Use headings, lists, `code`, and > quotes. The editor has a live preview and a media library.',
    tags: ['writing', 'markdown'],
  },
];

function main(): void {
  const app = buildApp();
  try {
    const users = new UserRepository(app.db);
    if (users.findByEmail('demo@example.com')) {
      console.log('Seed: demo user already exists — nothing to do.');
      return;
    }
    const demo = users.create({
      email: 'demo@example.com',
      username: 'demo',
      displayName: 'Demo Author',
    });
    for (const p of SAMPLE_POSTS) {
      app.posts.create(demo.id, {
        title: p.title,
        markdownBody: p.body,
        status: 'published',
        tags: p.tags,
      });
    }
    console.log(`Seed: created demo user and ${SAMPLE_POSTS.length} posts.`);
  } finally {
    app.close();
  }
}

try {
  main();
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
