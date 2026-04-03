import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'session';
export const COOKIE_TTL_SECS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  participantId: string;
  displayName:   string;
  role:          string;
  avatarUrl:     string | null;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${COOKIE_TTL_SECS}s`)
    .setIssuedAt()
    .sign(key(secret));
}

export async function parseSession(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    if (typeof payload['participantId'] !== 'string') return null;
    if (typeof payload['role']          !== 'string') return null;
    const avatarUrl    = typeof payload['avatarUrl']    === 'string' ? payload['avatarUrl']    : null;
    const displayName  = typeof payload['displayName']  === 'string' ? payload['displayName']  : '';
    return { participantId: payload['participantId'], displayName, role: payload['role'], avatarUrl };
  } catch {
    return null;
  }
}
