import type { Request, Response, NextFunction } from 'express';
import { getParticipantById } from '../db/queries.js';
import type { Participant } from '../../../shared/types.js';
import { parseSession, signSession } from '../../../shared/session.js';

export type { SessionPayload } from '../../../shared/session.js';

// Extend Express Request to carry the authenticated participant
declare global {
  namespace Express {
    interface Request {
      participant?: Participant;
    }
  }
}

function secret(): string {
  return process.env['COOKIE_SECRET'] ?? 'dev_secret_change_me';
}

export async function makeToken(participantId: string, displayName: string, role: string, avatarUrl: string | null): Promise<string> {
  return signSession({ participantId, displayName, role, avatarUrl }, secret());
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['authorization'];
  const raw  = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;

  if (!raw) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  parseSession(raw, secret())
    .then((payload) => {
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
    })
    .catch(() => {
      res.status(500).json({ error: 'Authentication error' });
    });
}

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
