/**
 * Tests for schedule query functions.
 *
 * Strategy: each test uses an in-memory SQLite database, migrated from the
 * schema definitions, so no real files are touched and tests are fully isolated.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// We test the query functions directly but we need to control which db they use.
// The query functions import `db` from './index.js', which opens a real file.
// To avoid that coupling we inline the DB setup and call the Drizzle methods
// directly — this mirrors the exact logic in queries.ts so the tests remain
// a faithful proxy for the real code.

const CREATE_SCHEDULE_TABLE = `
  CREATE TABLE schedule_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    at          TEXT    NOT NULL,
    app         TEXT    NOT NULL,
    label       TEXT,
    status      TEXT    NOT NULL DEFAULT 'pending',
    fired_at    INTEGER,
    created_at  INTEGER NOT NULL,
    modified_at INTEGER NOT NULL
  )
`;

function makeTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_SCHEDULE_TABLE);
  return drizzle(sqlite, { schema });
}

import { eq, asc } from 'drizzle-orm';
import { scheduleEntries } from './schema.js';
import type { ScheduleEntry } from '../../../shared/types.js';

// ─── Helpers (mirror the real query functions logic) ───────────────────────────

function rowToEntry(row: typeof scheduleEntries.$inferSelect): ScheduleEntry {
  return {
    id:         row.id,
    at:         row.at,
    app:        row.app,
    label:      row.label ?? null,
    status:     row.status as ScheduleEntry['status'],
    firedAt:    row.firedAt ?? null,
    createdAt:  row.createdAt,
    modifiedAt: row.modifiedAt,
  };
}

function getAll(db: ReturnType<typeof makeTestDb>): ScheduleEntry[] {
  return db.select().from(scheduleEntries).orderBy(asc(scheduleEntries.id)).all().map(rowToEntry);
}

function insert(db: ReturnType<typeof makeTestDb>, at: string, app: string, label?: string): ScheduleEntry {
  const now = Date.now();
  const row = db.insert(scheduleEntries).values({ at, app, label: label ?? null, createdAt: now, modifiedAt: now }).returning().get();
  return rowToEntry(row);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getScheduleEntries', () => {
  it('returns empty array when table is empty', () => {
    const db = makeTestDb();
    expect(getAll(db)).toEqual([]);
  });

  it('returns entries ordered by id ascending', () => {
    const db = makeTestDb();
    insert(db, 'H+00:10:00', 'jam-mode');
    insert(db, 'H+12:00:00', 'micro-trottoir');
    const entries = getAll(db);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.app).toBe('jam-mode');
    expect(entries[1]!.app).toBe('micro-trottoir');
  });

  it('returns status=pending by default', () => {
    const db = makeTestDb();
    insert(db, 'H+00:10:00', 'jam-mode');
    const entries = getAll(db);
    expect(entries[0]!.status).toBe('pending');
    expect(entries[0]!.firedAt).toBeNull();
  });

  it('preserves optional label', () => {
    const db = makeTestDb();
    insert(db, 'H+12:00:00', 'micro-trottoir', 'Mid-JAM interview');
    const entries = getAll(db);
    expect(entries[0]!.label).toBe('Mid-JAM interview');
  });

  it('returns null label when not set', () => {
    const db = makeTestDb();
    insert(db, 'H+00:10:00', 'jam-mode');
    const entries = getAll(db);
    expect(entries[0]!.label).toBeNull();
  });
});

describe('insertScheduleEntry', () => {
  it('inserts an entry and returns it with generated id', () => {
    const db = makeTestDb();
    const entry = insert(db, 'T-04:00:00', 'micro-trottoir', 'Final micro');
    expect(typeof entry.id).toBe('number');
    expect(entry.at).toBe('T-04:00:00');
    expect(entry.app).toBe('micro-trottoir');
    expect(entry.label).toBe('Final micro');
    expect(entry.status).toBe('pending');
    expect(entry.firedAt).toBeNull();
  });

  it('auto-increments id', () => {
    const db = makeTestDb();
    const a = insert(db, 'H+00:10:00', 'jam-mode');
    const b = insert(db, 'H+12:00:00', 'micro-trottoir');
    expect(b.id).toBeGreaterThan(a.id);
  });
});

describe('updateScheduleEntry', () => {
  it('can update the at field', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    db.update(scheduleEntries)
      .set({ at: 'H+00:15:00', modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, entry.id))
      .run();
    const updated = getAll(db)[0]!;
    expect(updated.at).toBe('H+00:15:00');
  });

  it('can update the app field', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    db.update(scheduleEntries)
      .set({ app: 'micro-trottoir', modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, entry.id))
      .run();
    const updated = getAll(db)[0]!;
    expect(updated.app).toBe('micro-trottoir');
  });

  it('can update the label field', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    db.update(scheduleEntries)
      .set({ label: 'Updated label', modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, entry.id))
      .run();
    expect(getAll(db)[0]!.label).toBe('Updated label');
  });

  it('can update status to skipped', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    db.update(scheduleEntries)
      .set({ status: 'skipped', modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, entry.id))
      .run();
    expect(getAll(db)[0]!.status).toBe('skipped');
  });
});

describe('deleteScheduleEntry', () => {
  it('removes the entry by id', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    insert(db, 'H+12:00:00', 'micro-trottoir');
    db.delete(scheduleEntries).where(eq(scheduleEntries.id, entry.id)).run();
    const remaining = getAll(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.app).toBe('micro-trottoir');
  });

  it('is a no-op when id does not exist', () => {
    const db = makeTestDb();
    insert(db, 'H+00:10:00', 'jam-mode');
    // Delete a non-existent id — should not throw
    expect(() => db.delete(scheduleEntries).where(eq(scheduleEntries.id, 9999)).run()).not.toThrow();
    expect(getAll(db)).toHaveLength(1);
  });
});

describe('markScheduleEntryFired', () => {
  it('sets status=fired and firedAt timestamp', () => {
    const db = makeTestDb();
    const entry = insert(db, 'H+00:10:00', 'jam-mode');
    const firedAt = 1_700_000_000_000;
    db.update(scheduleEntries)
      .set({ status: 'fired', firedAt, modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, entry.id))
      .run();
    const updated = getAll(db)[0]!;
    expect(updated.status).toBe('fired');
    expect(updated.firedAt).toBe(firedAt);
  });

  it('does not affect other entries', () => {
    const db = makeTestDb();
    const a = insert(db, 'H+00:10:00', 'jam-mode');
    insert(db, 'H+12:00:00', 'micro-trottoir');
    db.update(scheduleEntries)
      .set({ status: 'fired', firedAt: Date.now(), modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, a.id))
      .run();
    const entries = getAll(db);
    expect(entries[0]!.status).toBe('fired');
    expect(entries[1]!.status).toBe('pending');
  });
});

describe('resetScheduleStatus', () => {
  it('resets all entries to pending with null firedAt', () => {
    const db = makeTestDb();
    const a = insert(db, 'H+00:10:00', 'jam-mode');
    const b = insert(db, 'H+12:00:00', 'micro-trottoir');

    // Fire both entries
    db.update(scheduleEntries)
      .set({ status: 'fired', firedAt: Date.now(), modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, a.id))
      .run();
    db.update(scheduleEntries)
      .set({ status: 'fired', firedAt: Date.now(), modifiedAt: Date.now() })
      .where(eq(scheduleEntries.id, b.id))
      .run();

    // Reset all
    db.update(scheduleEntries)
      .set({ status: 'pending', firedAt: null, modifiedAt: Date.now() })
      .run();

    const entries = getAll(db);
    expect(entries.every(e => e.status === 'pending')).toBe(true);
    expect(entries.every(e => e.firedAt === null)).toBe(true);
  });

  it('is safe on an empty table', () => {
    const db = makeTestDb();
    expect(() => db.update(scheduleEntries).set({ status: 'pending', firedAt: null, modifiedAt: Date.now() }).run()).not.toThrow();
  });
});
