// Offline checks for the local authentication primitives and role policy.
// Run with: npm run verify:auth

import {
  buildSessionCookie,
  clearSessionCookie,
  hashPassword,
  parseCookies,
  requiredRolesFor,
  sanitizeUser,
  validatePassword,
  verifyPassword,
} from '../auth.js';
import type { UserRecord } from '../auth.js';

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

// Password hashing -----------------------------------------------------------
const hash = hashPassword('Correct-Horse-9!');
check(hash.startsWith('scrypt$'), 'hash should use the scrypt format');
check(hash !== hashPassword('Correct-Horse-9!'), 'hash should use a fresh salt');
check(verifyPassword('Correct-Horse-9!', hash), 'correct password should verify');
check(!verifyPassword('wrong-password', hash), 'wrong password must not verify');
check(!verifyPassword('', hash), 'empty password must not verify');
check(!verifyPassword('x', 'not-a-hash'), 'malformed hash must fail closed');

// Password policy ------------------------------------------------------------
check(validatePassword('short') !== null, 'short password should be rejected');
check(validatePassword('alllowercase123') !== null, 'two character classes should be rejected');
check(validatePassword('Alice-Alice-123', 'alice@example.com') !== null, 'email inside password should be rejected');
check(validatePassword('Correct-Horse-9!') === null, 'strong password should pass');

// Role policy ---------------------------------------------------------------
const matrix: Array<[string, string, string[] | null]> = [
  ['GET', '/api/stats', null],
  ['GET', '/api/audit-logs', ['manager', 'admin']],
  ['GET', '/api/imports/history', ['manager', 'admin']],
  ['GET', '/api/incidents', ['analyst', 'manager', 'admin']],
  ['GET', '/api/incidents/123/impact', ['analyst', 'manager', 'admin']],
  ['POST', '/api/me/password', null],
  ['POST', '/api/servers', ['manager', 'admin']],
  ['POST', '/api/imports/execute', ['manager', 'admin']],
  ['POST', '/api/incidents', ['analyst', 'manager', 'admin']],
  ['PUT', '/api/incidents/123', ['analyst', 'manager', 'admin']],
  ['POST', '/api/patching/campaigns', ['analyst', 'manager', 'admin']],
  ['POST', '/api/communications/preview', ['analyst', 'manager', 'admin']],
  ['POST', '/api/users', ['admin']],
  ['PATCH', '/api/users/1', ['admin']],
  ['POST', '/api/seed/reset', ['admin']],
];

for (const [method, path, expected] of matrix) {
  const actual = requiredRolesFor(method, path);
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${method} ${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// Cookies and serialisation -------------------------------------------------
const cookie = buildSessionCookie('abc123', true);
check(cookie.includes('cmdb_session=abc123'), 'cookie should contain the session id');
check(cookie.includes('HttpOnly'), 'cookie must be HttpOnly');
check(cookie.includes('Secure'), 'secure cookie must include Secure');
check(cookie.includes('SameSite=Lax'), 'cookie must be SameSite=Lax');
check(clearSessionCookie(false).includes('Max-Age=0'), 'clear cookie must expire immediately');
check(parseCookies('a=1; cmdb_session=xyz; b=2').cmdb_session === 'xyz', 'cookie parser should read the session');

const user: UserRecord = {
  id: 'u1',
  email: 'Admin@Example.com',
  name: 'Admin',
  role: 'admin',
  password_hash: hash,
  active: true,
  must_change_password: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
const safe = sanitizeUser(user);
check(!('password_hash' in safe), 'sanitized user must not expose the password hash');
check(safe.role === 'admin', 'sanitized user should retain the role');

if (failures.length > 0) {
  console.error(`${failures.length} auth check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('Authentication checks passed');
console.log(`Role policy cases: ${matrix.length}`);
