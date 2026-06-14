import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, type DB } from './connection';
import { runMigrations, listMigrationFiles } from './migrate';

const projectMigrations = path.join(process.cwd(), 'migrations');

describe('runMigrations', () => {
  let tmpDir: string;
  let db: DB;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-mig-'));
    db = openDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(name: string, sql: string): void {
    fs.writeFileSync(path.join(tmpDir, name), sql);
  }

  it('runMigrations_appliesInFilenameOrder', () => {
    write('0002_second.sql', 'CREATE TABLE b (id TEXT);');
    write('0001_first.sql', 'CREATE TABLE a (id TEXT);');

    const result = runMigrations(db, tmpDir);
    expect(result.applied).toEqual(['0001_first.sql', '0002_second.sql']);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toContain('migrations');
  });

  it('runMigrations_isIdempotent_secondRunAppliesNothing', () => {
    write('0001_first.sql', 'CREATE TABLE a (id TEXT);');
    runMigrations(db, tmpDir);

    const second = runMigrations(db, tmpDir);
    expect(second.applied).toEqual([]);
  });

  it('runMigrations_appliesOnlyNewFilesOnSubsequentRuns', () => {
    write('0001_first.sql', 'CREATE TABLE a (id TEXT);');
    runMigrations(db, tmpDir);

    write('0002_second.sql', 'CREATE TABLE b (id TEXT);');
    const second = runMigrations(db, tmpDir);
    expect(second.applied).toEqual(['0002_second.sql']);
  });

  it('runMigrations_badMigration_throwsAndDoesNotRecordIt', () => {
    write('0001_first.sql', 'CREATE TABLE a (id TEXT);');
    write('0002_broken.sql', 'CREATE TABLE ;;; invalid sql');

    expect(() => runMigrations(db, tmpDir)).toThrow(/Migration failed: 0002_broken\.sql/);

    const applied = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
    const names = applied.map((r) => r.name);
    expect(names).toContain('0001_first.sql');
    expect(names).not.toContain('0002_broken.sql');
  });

  it('runMigrations_failedMigrationRollsBackItsOwnStatements', () => {
    // A single file whose second statement fails must roll back the first.
    write('0001_partial.sql', 'CREATE TABLE good (id TEXT); CREATE TABLE bad (;');

    expect(() => runMigrations(db, tmpDir)).toThrow();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='good'")
      .all();
    expect(tables).toHaveLength(0);
  });
});

describe('project migrations', () => {
  it('listMigrationFiles_returnsExpectedFiles', () => {
    const files = listMigrationFiles(projectMigrations);
    expect(files[0]).toBe('0001_create_users.sql');
    expect(files).toContain('0007_create_import_tables.sql');
  });

  it('runMigrations_appliesFullSchema_andCreatesCoreTables', () => {
    const db = openDatabase(':memory:');
    try {
      const result = runMigrations(db, projectMigrations);
      expect(result.applied.length).toBeGreaterThanOrEqual(7);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      const names = new Set(tables.map((t) => t.name));
      for (const t of [
        'users',
        'login_pins',
        'sessions',
        'media',
        'posts',
        'comments',
        'dm_messages',
        'import_jobs',
      ]) {
        expect(names.has(t)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('runMigrations_projectSchema_isIdempotent', () => {
    const db = openDatabase(':memory:');
    try {
      runMigrations(db, projectMigrations);
      expect(runMigrations(db, projectMigrations).applied).toEqual([]);
    } finally {
      db.close();
    }
  });
});
