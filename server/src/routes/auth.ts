import { Router } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  getParticipantByUsername,
  createParticipant,
  getPasswordHash,
} from '../db/queries.js';
import { makeToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const scryptAsync = promisify(scrypt);

// ─── Password helpers ─────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const colonIndex = stored.indexOf(':');
  if (colonIndex === -1) return false;
  const salt       = stored.slice(0, colonIndex);
  const storedHash = stored.slice(colonIndex + 1);
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  try {
    return timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Body: { username: string, password: string }
 * Returns: { token, participant }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: unknown; password?: unknown };

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const participant = getParticipantByUsername(username);
  if (!participant) {
    await scryptAsync('dummy', 'deadbeef0000000000000000000000000000000000000000', 64);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (participant.banned) {
    res.status(403).json({ error: 'Account banned' });
    return;
  }

  const storedHash = getPasswordHash(participant.id);
  if (!storedHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await verifyPassword(password, storedHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = await makeToken(participant.id, participant.displayName, participant.role, participant.avatarUrl);
  res.json({ token, participant });
});

/**
 * POST /auth/register
 * Body: { username: string, displayName: string, team: string, password: string }
 * Returns: { token, participant }
 */
router.post('/register', async (req, res) => {
  const { username, displayName, team, password } = req.body as {
    username?:    unknown;
    displayName?: unknown;
    team?:        unknown;
    password?:    unknown;
  };

  if (
    typeof username    !== 'string' || username.trim().length === 0 ||
    typeof displayName !== 'string' || displayName.trim().length === 0 ||
    typeof team        !== 'string' ||
    typeof password    !== 'string' || password.length < 6
  ) {
    res.status(400).json({ error: 'username, displayName, and password (min 6 chars) are required' });
    return;
  }

  const existing = getParticipantByUsername(username.trim());
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const participant = createParticipant({
    username:     username.trim(),
    passwordHash: passwordHash,
    displayName:  displayName.trim(),
    team:         team.trim(),
  });

  const token = await makeToken(participant.id, participant.displayName, participant.role, participant.avatarUrl);
  res.status(201).json({ token, participant });
});

/**
 * GET /auth/me
 * Returns the currently authenticated participant.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ participant: req.participant });
});

export default router;
