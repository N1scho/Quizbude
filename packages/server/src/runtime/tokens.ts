import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Opakes Zufallstoken. Nicht signiert - der Raum haelt den Zustand selbst. */
export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

export function tokenEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
