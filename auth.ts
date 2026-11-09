// Local authentication primitives for the CMDB.
//
// The application is expected to run in an air-gapped network, so this module
// uses only Node built-ins: scrypt for password hashing, crypto randomness for
// session ids and timingSafeEqual for comparisons. No external identity
// provider or network call is involved.
//
// AUTH_MODE=ldap is reserved for a future on-prem directory integration; the
// server deliberately refuses to start in that mode until it is implemented.

import crypto from 'crypto';
import type { AuthUser, UserRole } from './src/types/index.js';

export type { AuthUser, UserRole };

export interface UserRecord extends AuthUser {
  password_hash: string;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  ip?: string;
  user_agent?: string;
}

export const SESSION_COOKIE = 'cmdb_session';
export const SESSION_TTL_HOURS = Math.max(1, parseInt(process.env.SESSION_TTL_HOURS || '12', 10));

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export const normalizeEmail = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

export const isRole = (value: unknown): value is UserRole =>
  value === 'viewer' || value === 'analyst' || value === 'manager' || value === 'admin';

/** Hashes a password as `scrypt$N$r$p$salt$hash` using a fresh random salt. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algorithm, n, r, p, saltB64, hashB64] = stored.split('$');
    if (algorithm !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: parseInt(n, 10),
      r: parseInt(r, 10),
      p: parseInt(p, 10),
      maxmem: SCRYPT_MAXMEM,
    });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Minimum policy for local passwords. Returns an error message or null. */
export function validatePassword(password: string, email?: string): string | null {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters.';
  }
  if (password.length > 200) return 'Password is too long.';
  if (email) {
    const normalized = email.toLowerCase();
    const localPart = normalized.split('@')[0];
    if (password.toLowerCase().includes(normalized)) {
      return 'Password must not contain the email address.';
    }
    if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      return 'Password must not contain the email name.';
    }
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(test => test.test(password)).length;
  if (classes < 3) {
    return 'Use at least three of: lowercase, uppercase, numbers, symbols.';
  }
  return null;
}

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');

export const randomPassword = (): string => {
  // 18 bytes -> 24 base64url characters, always mixed.
  return `Cm-${randomToken(12)}-9!`;
};

export function buildSessionCookie(sessionId: string, secure: boolean): string {
  const maxAge = SESSION_TTL_HOURS * 3600;
  return [
    `${SESSION_COOKIE}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Ignore malformed percent-encoding rather than throwing on a bad cookie.
    }
  }
  return cookies;
}

/** Roles allowed to perform a mutating request. `null` means any authenticated role. */
export function requiredRolesFor(method: string, apiPath: string): UserRole[] | null {
  const path = (apiPath.replace(/^\/api/i, '') || '/').toLowerCase();

  if (method === 'GET' || method === 'HEAD') {
    if (path.startsWith('/audit-logs')) return ['manager', 'admin'];
    if (path.startsWith('/imports/history')) return ['manager', 'admin'];
    if (path.startsWith('/users')) return ['analyst', 'manager', 'admin'];
    if (path.startsWith('/incidents')) return ['analyst', 'manager', 'admin'];
    return null;
  }

  if (path.startsWith('/me')) return null;
  if (path.startsWith('/users')) return ['admin'];
  if (path.startsWith('/settings')) return ['admin'];
  if (path.startsWith('/servers')) return ['manager', 'admin'];
  if (path.startsWith('/imports')) return ['manager', 'admin'];
  if (path.startsWith('/incidents')) return ['analyst', 'manager', 'admin'];
  if (path.startsWith('/patching')) return ['analyst', 'manager', 'admin'];
  if (path.startsWith('/communications')) return ['analyst', 'manager', 'admin'];
  return ['admin'];
}

/** Data safe to send to the browser: never includes the hash. */
export function sanitizeUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    must_change_password: user.must_change_password,
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
