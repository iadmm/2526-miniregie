import { parse as parseCookieHeader } from 'cookie';
import type { Request, Response, NextFunction } from 'express';
import { getParticipantById } from '../db/queries.js';
import type { Participant } from '../../../shared/types.js';
import {
  parseCookie,
  signCookie,
  COOKIE_NAME,
  COOKIE_TTL_MS,
} from '../../../shared/session.js';

export type { SessionPayload } from '../../../shared/session.js';
export { parseCookie, signCookie, COOKIE_NAME };

// Extend Express Request to carry the authenticated participant
declare global {
  namespace Express {
    interface Request {
      participant?: Participant;
    }
  }
}

export function makeCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax';
  maxAge:   number;
  path:     string;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   COOKIE_TTL_MS,
    path:     '/',
  };
}

export function makeSessionCookie(participant: Participant): string {
  return signCookie({
    participantId: participant.id,
    role:          participant.role,
    exp:           Date.now() + COOKIE_TTL_MS,
  });
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Reads the `session` cookie, verifies HMAC + expiry, fetches the participant
 * from DB, and attaches it to `req.participant`. Returns 401 if invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookieHeader = req.headers['cookie'] ?? '';
  const cookies      = parseCookieHeader(cookieHeader);
  const raw          = cookies[COOKIE_NAME];
  if (!raw) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = parseCookie(raw);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const participant = getParticipantById(payload.participantId);
  if (!participant) {
    res.status(401).json({ error: 'Participant not found' });
    return;
  }

  if (participant.banned) {
    res.status(403).json({ error: 'Account banned' });
    return;
  }

  req.participant = participant;
  next();
}

/**
 * Factory: returns middleware that allows only the given roles.
 * Must be used after `requireAuth`.
 */
export function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.participant) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.participant.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Blocks access if the authenticated participant has no avatar (onboarding incomplete).
 * Must be used after `requireAuth`.
 */
export function requireOnboarding(req: Request, res: Response, next: NextFunction): void {
  if (!req.participant) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!req.participant.avatarUrl) {
    res.status(403).json({ error: 'Onboarding required', onboarding: true });
    return;
  }
  next();
}
