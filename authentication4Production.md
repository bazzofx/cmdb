# Authentication for production

> **Status:** local authentication is implemented and enabled by default. LDAP is reserved as a future provider and is intentionally not implemented yet.
>
> **Audience:** whoever deploys and operates this CMDB. This is the pre-production checklist and the recovery runbook.

## 1. What is implemented

- Local accounts stored in `data/csm_database.json` under `users`.
- Passwords hashed with Node's built-in **scrypt** (16 MB salt, 64-byte key, timing-safe comparison). No native modules and no external calls.
- Server-side sessions in `sessions` with an HttpOnly cookie.
- Four roles: `viewer`, `analyst`, `manager`, `admin`.
- First-run administrator bootstrap from environment variables.
- Login rate limiting and a 15-minute lockout after five failures.
- Audit entries for login success, login failure, lockout, logout, access denied, password change, user creation/update and password reset.
- Role-aware navigation and disabled destructive controls in the UI; every write is also enforced server-side.

`AUTH_MODE` values:

| Value | Behaviour |
|---|---|
| `local` | Local accounts (default, air-gapped) |
| `disabled` | Development only. Injects a synthetic local admin. **Refused when `NODE_ENV=production`.** |
| `ldap` | Reserved. The server refuses to start until a directory provider is implemented. |

## 2. Pre-production checklist

Treat every unchecked box as a blocker.

| # | Check | Why |
|---|---|---|
| 1 | `NODE_ENV=production` | Enables secure cookies and disables the dev bypass guard |
| 2 | `AUTH_MODE=local` (or `ldap` once implemented) | `disabled` is refused in production |
| 3 | HTTPS is terminated in front of the app | Passwords and session cookies must not travel in clear text |
| 4 | `COOKIE_SECURE=1` | Marks the session cookie `Secure` |
| 5 | `APP_URL` is the exact public URL | Used by the Origin check; a mismatch blocks sign-in |
| 6 | `TRUST_PROXY=1` when behind a reverse proxy | `req.protocol`/`req.ip` must reflect the client |
| 7 | `BOOTSTRAP_ADMIN_PASSWORD` removed after first start | No shared bootstrap secret remains on disk |
| 8 | The bootstrap admin password has been changed | The first-run password is temporary |
| 9 | Development users and `.env` dev credentials removed | `.env` must never be copied to production |
| 10 | At least two active administrators exist | Prevents a single-account lockout |
| 11 | A user/role review has been completed | Least privilege: viewers should outnumber admins |
| 12 | `data/csm_database.json` is readable only by the service account | It contains password hashes, sessions and manager emails |
| 13 | Backups include `users`, `sessions` and `audit_logs` | Account and evidence recovery |
| 14 | The audit-log cap is raised or shipped to a SIEM | The default cap is 500 events |
| 15 | All fonts/assets are local and no external runtime requests remain; CSP added | Air-gapped browsers must not reach the internet |
| 16 | NTP is configured on the host | Session/audit timestamps and future TOTP |
| 17 | `start-dev.bat` is not used in production | It is a developer convenience only |
| 18 | Login failure/lockout monitoring is in place | Detect credential attacks |

## 3. Environment variables

```text
AUTH_MODE=local
NODE_ENV=production
APP_URL=https://cmdb.example.internal
COOKIE_SECURE=1
TRUST_PROXY=1
SESSION_TTL_HOURS=12

# First start only, while the users table is empty:
BOOTSTRAP_ADMIN_EMAIL=admin@example.internal
BOOTSTRAP_ADMIN_NAME=CMDB Administrator
BOOTSTRAP_ADMIN_PASSWORD=<strong unique password>
```

Remove `BOOTSTRAP_ADMIN_PASSWORD` after the first successful start. The bootstrap block only runs when `users` is empty, so it is inert afterwards, but the secret should still not remain in the environment file.

`APP_URL` must match the browser origin exactly (scheme, host and port). The Origin check also accepts the request's own host, but an exact `APP_URL` avoids surprises behind proxies.

## 4. First-run and handover procedure

1. Stop the service.
2. Back up `data/csm_database.json`.
3. Set the environment above with a strong bootstrap password.
4. Start the service and sign in as the bootstrap admin.
5. Change the password from the user menu (`Change password`).
6. Create the real users under **Settings → Users & Roles**:
   - `viewer` for people who only read the estate and reports. Viewers cannot open Incidents or Archive Incident.
   - `analyst` for incident triage, communications and patch campaigns.
   - `manager` for analysts who also own imports, server/ownership edits and the audit log.
   - `admin` for at most two or three people.
7. Sign in once as each role and confirm the expected navigation and write buttons.
8. Remove `BOOTSTRAP_ADMIN_PASSWORD` from the environment and restart.
9. Confirm `AUTH_MODE=disabled` is not set anywhere.
10. Record the recovery procedure and the second administrator.

New users are created with `must_change_password=true`; they see a banner until they change it. Administrators can reset a password, which forces the same change and invalidates that user's sessions.

### Break-glass recovery

- If an administrator is locked out but another admin exists: sign in as the other admin and reset the password.
- If all admin passwords are lost: restore the most recent database backup, or stop the service, restore a known-good `users` block, and restart. Do not delete `users` to force a re-bootstrap unless you intend to recreate every account.
- Keep at least one offline copy of the database before any credential recovery.

## 5. Roles and permissions

| Capability | Viewer | Analyst | Manager | Admin |
|---|---|---|---|---|
| Read pages, inventory, reports | ✓ | ✓ | ✓ | ✓ |
| Access to Incidents, Archived Incidents | — | ✓ | ✓ | ✓ |
| Export reports / CSV (audited) | ✓ | ✓ | ✓ | ✓ |
| Create/update incidents, host triage, communications preview | — | ✓ | ✓ | ✓ |
| Patch campaigns | — | ✓ | ✓ | ✓ |
| Edit servers, imports, ownership data | — | — | ✓ | ✓ |
| View audit log | — | — | ✓ | ✓ |
| Manage users, SLA settings, seed reset | — | — | — | ✓ |

Server-side enforcement is a central policy table in `auth.ts` (`requiredRolesFor`). A 403 is itself audited as `ACCESS_DENIED`. Databases created before the role split have any `steward` users migrated to `manager` on startup.

## 6. Sessions and cookies

- Server-side session records, 12-hour absolute lifetime (`SESSION_TTL_HOURS`).
- Cookie: `cmdb_session`, `Path=/`, `HttpOnly`, `SameSite=Lax`, and `Secure` when `COOKIE_SECURE=1` or `NODE_ENV=production`.
- A new random session ID is issued at login. Logout deletes the record and clears the cookie. Disabling a user deletes all of that user's sessions. A password change deletes all other sessions.
- Sessions live in the JSON database, so they survive a restart. Expired records are pruned at startup and on login.
- There is currently no idle timeout separate from the absolute timeout. Shorten `SESSION_TTL_HOURS` if required by policy.

## 7. Password and MFA policy

Implemented:

- Minimum 12 characters, at least three of lowercase/uppercase/number/symbol, and no email address inside the password.
- Scrypt with per-user salt and constant-time verification.
- Five failed attempts trigger a 15-minute lockout per email.
- Generic error message to avoid user enumeration.
- No self-registration and no email-based reset; administrators create accounts and reset passwords out of band.

Not implemented yet:

- TOTP/WebAuthn MFA. Recommended for `admin` and `manager` accounts before production. It can be added with Node crypto and no internet access.
- Password history and expiry. Consider these if the local password policy requires them.
- Central disable via LDAP/AD.

## 8. Audit

Every authentication and authorisation event is written to `audit_logs` with:

- `user` (email), `actor_role`, `outcome` (`success`/`failure`), IP and user agent.
- `action` such as `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_LOCKED`, `LOGOUT`, `ACCESS_DENIED`, `PASSWORD_CHANGED`, `USER_CREATED`, `USER_UPDATED`, `PASSWORD_RESET`, `UPDATE_INCIDENT_HOST`.

The log is currently capped at 500 events and stored in the same JSON file. Before production:

- Raise the cap or export audit events to the SIEM.
- Treat the JSON audit log as operational evidence, not tamper-proof evidence. Anyone with file access can edit it.
- Back it up with the rest of the database.
- Alert on repeated `LOGIN_FAILED`/`LOGIN_LOCKED` and on `ACCESS_DENIED` spikes.

## 9. Air-gap hardening

The application now serves Roboto, Plus Jakarta Sans and JetBrains Mono locally from `public/fonts`, and `index.html` no longer references Google Fonts. Verify the built `dist/index.html` contains no `fonts.googleapis.com` or `fonts.gstatic.com` reference and that the font files are present in the deployed `public/fonts` directory. See [Technology stack, fonts and external assets](docs/technology-and-assets.md).

Also:

- Add a Content-Security-Policy such as `default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`.
- Ship dependencies as a vendored `node_modules` directory or a pre-built container image. `npm install` in an air-gapped host will fail unless a local registry/mirror exists.
- Disable telemetry and external error reporting if any is added later.
- Ensure the internal CA certificate is trusted by the browser and the Node process if the app calls internal HTTPS services.
- Run an internal NTP service.

## 10. LDAP later

The role model, audit actor and UI do not depend on the password store, so LDAP can be added without rewriting them. Planned shape:

```text
AUTH_MODE=ldap
LDAP_URL=ldaps://dc01.example.internal
LDAP_BIND_DN=CN=svc-cmdb,OU=Service Accounts,DC=example,DC=internal
LDAP_BIND_PASSWORD=<secret>
LDAP_BASE_DN=DC=example,DC=internal
LDAP_USER_FILTER=(sAMAccountName={{username}})
LDAP_GROUP_ROLE_MAP={"CN=CMDB-Admins,OU=Groups,DC=example,DC=internal":"admin",...}
```

Until implemented, `AUTH_MODE=ldap` fails fast at startup. Keep a local break-glass admin when LDAP is introduced, and decide whether LDAP users are created on first login or pre-provisioned.

## 11. Deployment and validation

```bash
npm ci --offline          # or restore the vendored node_modules / image
npm run lint
npm run verify
npm run build
NODE_ENV=production AUTH_MODE=local npm start
```

Validation after deployment:

1. `GET /api/stats` without a cookie returns `401`.
2. Sign in as an admin and load the dashboard.
3. Sign in as a viewer and confirm Incidents, Archive Incident, Data Sync and Settings are absent from the sidebar; sign in as an analyst and confirm incident writes work but imports do not.
4. Create an analyst and confirm they can create/update an incident but cannot import or manage users.
5. Confirm the audit log records the logins, a host update and a 403.
6. Restart the service and confirm the session survives until expiry.
7. Sign out and confirm the old cookie returns `401`.
8. Check browser DevTools for any request outside `APP_URL`.

## 12. Known limitations

- Sessions and users are stored in the JSON database. For a larger estate or concurrent editors, move them to SQLite/Postgres with the rest of the CMDB.
- The audit log is capped and editable on disk.
- No MFA, no password history, no email-based reset, no LDAP yet.
- No CSRF token beyond the Origin check and `SameSite=Lax`; add a double-submit token if the threat model requires it.
- Login lockout is per email in process memory; it resets on restart and does not throttle by IP.
- The UI hides pages and disables main write actions by role, but some deep links or stale tabs can still call an API; the server is the enforcement point.
