# Settings & Audit

> **At a glance:** An administrative audit trail with search, plus three read-only status cards describing storage, session security and log retention.

| | |
|---|---|
| View id | `settings` |
| Sidebar label | `Settings` |
| Core component | `src/components/views/SettingsAuditView.tsx` |
| Primary API | `GET /api/audit-logs` |
| Primary users | SOC analysts and the CMDB administrator reconstructing who changed what; service managers verifying an import or incident declaration |
| Depends on | The `audit_logs` array in `data/csm_database.json`; `GET /api/stats` for the indexed-server count |

## 1. What this page is for

The page is two things in one: a searchable log of every administrative mutation the server records, and a small status board describing where data lives. The log is the only user-facing route into `audit_logs`; the cards are static text with two live numbers pulled in.

There are no editable settings. Despite the heading "SECURITY, ROLE-BASED ACCESS & AUDIT LOGS", the page exposes no user management, no role assignment, no retention configuration and no persistence controls. It is a viewer.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| See recent activity | Open **Settings**; the table loads newest first |
| Find who changed a server record | Type `SERVER` or `UPDATE_SERVER` into **Search audit actions...** |
| Confirm an import was recorded | Search `IMPORT_CSV` |
| Check the record count behind the dashboard | Read **Connected • N indexed servers** on the Database Engine card |
| Re-read the log after an action elsewhere | **Refresh Logs** |
| Check how many events are retained | Read **N Logged Events** on the Audit Integrity card |

## 3. Screen walkthrough

**Header.** A cog icon, the title **SECURITY, ROLE-BASED ACCESS & AUDIT LOGS**, the subtitle "Audit trail of all administrative mutations, user roles, and database persistence status.", and one action on the right: **Refresh Logs**.

**Status cards.** A three-column grid of small panels, each with a label, an icon and a headline value:

- **Database Engine** — headline **Relational JSON Storage**, body text naming `data/csm_database.json` as the on-disk location, and a green line "Connected • N indexed servers" where N is `total_servers`.
- **Session Security** — headline **RBAC Enforced**, body "Current session: **SecOps Lead**. Full inventory write, incident triage, and campaign permissions.", and the note "Future provider: Microsoft Entra ID / OIDC".
- **Audit Integrity** — headline **N Logged Events**, body describing an immutable log of imports, incident declarations and patch status changes, and the note "Retention: Active In-Memory & Disk".

All three are plain markup. Only the server count and the event count are variable; the rest of the wording is hard-coded.

**Audit table.** A panel headed **Administrative Audit Trail (n)**, where n is the number of rows *after* search filtering, with a search box on the right (placeholder **Search audit actions...**). Columns: **Timestamp**, **User**, **Action**, **Entity**, **Details**. Timestamps are rendered with the browser's locale formatting. Actions appear as small blue pills, entity types in purple, and a row with no `details` shows the fallback text "Mutation performed". The table body scrolls within a fixed maximum height.

**States.** There is no spinner — the table is simply empty while the request is in flight. There is no empty-state message and no error message: a failed request is caught and logged to the browser console only, so an empty table can mean "no matching events" or "the request failed". There is no pagination; the table shows every event returned.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Timestamp | `audit_logs[].timestamp` | ISO string from the server, formatted client-side |
| User | `audit_logs[].user` | Falls back to `SecOps Admin` server-side when omitted |
| Action | `audit_logs[].action` | e.g. `UPDATE_SERVER`, `IMPORT_CSV`, `CREATE_INCIDENT` |
| Entity | `audit_logs[].entity_type` | `SERVER`, `INCIDENT`, `CAMPAIGN`, `INVENTORY` |
| Details | `audit_logs[].details` | Falls back to "Mutation performed" in the UI |
| Administrative Audit Trail (n) | `filteredLogs.length` | Filtered count, not total |
| N Logged Events | `logs.length` | Unfiltered count |
| Connected • N indexed servers | `GET /api/stats` → `total_servers` | |
| Everything else on the cards | Static strings | Not wired to configuration |

Not displayed: `entity_id`, `previous_value` and `new_value`. The last two are stored on the event but never surfaced, so field-level diffs are invisible in the UI.

## 5. Common workflows

**Reconstruct a disputed server change.**

1. Open **Settings**.
2. Search `SERVER` to narrow to server-level events.
3. Scan the **Details** column for the hostname — the detail string includes it, for example "Updated attributes for br1-sse-esx-23.prd.local".
4. Note the user and timestamp. If you need the actual before/after values, query `GET /api/audit-logs` directly: the page does not render `previous_value` or `new_value`.

**Confirm an import was logged.**

1. Search `IMPORT_CSV`.
2. Check the timestamp matches the run and the **User** column shows `SecOps Administrator`.
3. Cross-check the counts in the detail string against the Data Sync page's history table.

**Verify activity during an incident call.**

1. Leave the page open on a second screen.
2. After each triage action, click **Refresh Logs** — the page does not poll.
3. Search the incident reference, which appears in the detail strings for incident creation and server additions.

## 6. Gotchas and guardrails

- **"RBAC Enforced" is not enforced.** `server.ts` registers every `/api` route without authentication or authorisation middleware. The "SecOps Lead" session is a hard-coded string; the OIDC provider is described as future work. Treat any permission claim on this page as aspirational.
- The log is capped at 500 events. `logAudit` unshifts and then slices to the newest 500, so the oldest events disappear silently. "Retention: Active In-Memory & Disk" understates this.
- Several mutations are not audited at all: **Reset to Demo Seed**, incident host-detail updates (triage status, notes, ticket number), and communications previews. Absence of an event is therefore not evidence that nothing happened.
- A call to `DELETE /api/servers/:id` writes a `DELETE_SERVER` event, but the record is gone; the audit entry is the only trace.
- A failed `/api/audit-logs` or `/api/stats` call leaves the page looking empty rather than erroring. If the table is blank when you expect activity, reload before drawing conclusions.
- Search is a case-insensitive substring match across action, user, entity type and details only. It does not search `entity_id` or timestamps, so searching an incident UUID will not match unless the string happens to appear in the details text.
- There is no export, no date-range filter and no pagination. Long investigations mean scrolling a 500-row table.

## 7. For developers

**Component structure.** A single function component, `SettingsAuditView`, declared as `React.FC` with **no props**; `App` renders `<SettingsAuditView />` with no arguments. There are no child components, no error boundary and no chart or graph library — the cards are plain `div` markup with Tailwind classes.

**Props.** None. Everything the page needs is fetched directly by the component.

**Local state.**

| State | Initial | Notes |
|---|---|---|
| `logs` | `[]` | Full event list from the server |
| `loading` | `true` | Set around the fetch but never rendered; there is no spinner or skeleton |
| `search` | `''` | Bound to the search input |
| `serverCount` | `0` | From `/api/stats` |

**Effects and calls.**

- Mount effect (`[]` deps) calls `loadAuditLogs()`.
- `loadAuditLogs` is also bound directly to the **Refresh Logs** button.
- It awaits `api.getAuditLogs()` (`GET /api/audit-logs`, response `AuditLogEvent[]`) and then, sequentially rather than in parallel, `api.getStats()` (`GET /api/stats`, response `DashboardMetrics`) for `total_servers`. A failure in either throws into the shared `catch`, which only calls `console.error`, so `logs` may be populated while `serverCount` stays `0`.
- Filtering is derived on every render: `logs.filter(l => l.action || l.user || l.entity_type || l.details contains search, case-insensitive)`. No memoisation, no debounce.

**Audit events written elsewhere in the app** (so you know what to expect in the table): `CREATE_SERVER`, `UPDATE_SERVER`, `DELETE_SERVER` (`SERVER`); `CREATE_INCIDENT`, `UPDATE_INCIDENT`, `ADD_INCIDENT_SERVERS`, `REMOVE_INCIDENT_SERVER` (`INCIDENT`); `CREATE_CAMPAIGN`, `UPDATE_PATCH_STATUS` (`CAMPAIGN`); `IMPORT_CSV` (`INVENTORY`); plus the seeded `INITIAL_IMPORT`. Each is produced by `db.logAudit(user, action, entity_type, entity_id, prev, next, details)`, which unshifts, trims to 500 and saves the whole database file synchronously.

**Cross-view navigation.** None. The page performs no navigation and passes no filter keys.

**Extension points and rough edges.**

- Render `entity_id`, or add a column for it, so two same-action rows can be told apart without reading prose.
- Surface `previous_value` / `new_value` in an expandable row — the data is already returned by the API.
- Add an error banner and a real empty state; currently a network failure is indistinguishable from a healthy empty log.
- Add a date-range filter and pagination before the log approaches the 500-event cap.
- If role management is ever built, it needs server-side middleware first; this page cannot provide enforcement on its own.
- `loading` is dead state as far as rendering is concerned, and the sequential awaits add a round trip; `Promise.all` would halve the load time.

## 8. Related pages

- [Data Sync (Import & Data Management)](./11-data-management.md) — source of the `IMPORT_CSV` events and of the reset action that is *not* logged.
- [Inventory](./02-inventory.md) — where the audited create/update/delete mutations originate.
- [Incident Triage](./07-incident-triage.md) — writes incident events; host-detail changes are not audited.
- [Overview](./01-overview.md) — surfaces the same recent events as a compact dashboard feed.
- [Ownership Explorer](./05-ownership-explorer.md) — the visual counterpart to the ownership edits recorded here.
