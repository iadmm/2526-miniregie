/**
 * Dev seed CLI — inserts fake participants and media items for local development.
 * Run from project root:
 *   node --experimental-strip-types server/src/db/seed-dev.ts
 *
 * Idempotent: skips insertion if dev-seed participants already exist.
 */

import { db } from './index.js';
import { participants } from './schema.js';
import { eq } from 'drizzle-orm';
import { SEED_MARKER, applyDevSeed } from './dev-seed.js';

const existing = db
  .select()
  .from(participants)
  .where(eq(participants.role, SEED_MARKER))
  .get();

if (existing) {
  console.log('[seed-dev] Dev seed already applied — skipping.');
  process.exit(0);
}

applyDevSeed();
