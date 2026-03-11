import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { participants } from './schema.js';

const DB_PATH = process.env['DB_PATH'] ?? 'miniregie.db';

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: 'server/src/db/migrations' });

// Seed system accounts (idempotent)
const SYSTEM_ACCOUNTS = [
  { id: 'system:admin',    displayName: 'Admin',    role: 'admin' },
  { id: 'system:narrator', displayName: 'Narrateur', role: 'narrator' },
] as const;

const now = Date.now();
for (const account of SYSTEM_ACCOUNTS) {
  const exists = db.select().from(participants).where(eq(participants.id, account.id)).get();
  if (!exists) {
    db.insert(participants).values({
      id:          account.id,
      displayName: account.displayName,
      role:        account.role,
      firstSeenAt: now,
      lastSeenAt:  now,
    }).run();
  }
}
