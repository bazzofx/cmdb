# SQLite migration — JSON store → embedded SQLite (node:sqlite)

> **Status:** implemented. The persistence layer and the `server.ts` cutover are done using Node's built-in `node:sqlite` (`DatabaseSync`) — a zero-dependency driver for the same SQLite engine. `better-sqlite3` remains a drop-in alternative if you later prefer it (the SQL/schema is identical).

## 1. Summary

Move the persistence layer from the current in-memory `db.data` + `fs.writeFileSync` of one JSON file, to two embedded **SQLite** files — `data/auth.sqlite` (users + sessions) and `data/cmdb.sqlite` (servers, incidents, patch campaigns, audit log, import history) — accessed through Node's built-in **`node:sqlite`**. The two databases are kept separate as requested, so the user/authentication store can have its own ACLs and backups. The application stays a single Node process (monolith); there is no database server to run.

**Decision: embedded SQLite via `node:sqlite` (built-in, zero-dependency).** `better-sqlite3` is a drop-in alternative. Not Redis (external in-memory server, wrong data model for this workload), not Postgres/MySQL (client-server, unnecessary at 10k hosts / 20 users).

At the target scale — ~10,000 hosts, 20+ users, plus incidents, patch campaigns, audit log, and import history — the JSON store becomes the bottleneck, not the data model:

- every `db.save()` rewrites the **entire** file synchronously ([server.ts:235](server.ts#L235));
- every audit event, login failure, and mutation does a full-file write;
- the audit-log "cap" is a manual array slice;
- filters/search run over an in-memory array, which is fine at 9 rows but not the long-term plan at 10k.

SQLite fixes the write amplification (it writes changed pages inside a transaction), keeps the synchronous, single-process programming model, and still gives one file per database to back up.

## 2. Current state

| Concern | Today |
|---|---|
| Store | `data/csm_database.json`, seven top-level arrays: `servers`, `incidents`, `patch_campaigns`, `audit_logs`, `import_history`, `users`, `sessions` |
| Load | `db.init()` reads the whole file into `db.data` at startup ([server.ts:165](server.ts#L165)) |
| Write | `db.save()` serialises the whole object and `writeFileSync`-rewrites it ([server.ts:235](server.ts#L235)) |
| In-memory | `db.data.*` arrays are mutated directly by every route handler |
| Access | All routes read/write `db.data` through the exported `db` object ([server.ts:396](server.ts#L396)) |

## 3. Target architecture

- Two SQLite database files, kept separate: `data/auth.sqlite` (user database) and `data/cmdb.sqlite` (application database).
- `PRAGMA journal_mode = WAL` (readers don't block the writer; crash-safe).
- `PRAGMA foreign_keys = ON`.
- One `node:sqlite` connection per database (two connections), opened at startup and kept for the process lifetime.
- A rewritten `Database` class exposes the **same method names and the same `db.*` shapes** the routes already use, so `server.ts` route bodies change as little as possible.
- `node:sqlite` is synchronous — it matches the current code's synchronous style and needs no async/await refactor.

### Dependency

No new npm dependency. The implementation uses Node's built-in `node:sqlite`:

```ts
import { DatabaseSync } from 'node:sqlite';
```

- Ships with the exact runtime already in use (Node 22.23.2), so nothing extra has to be installed or vendored on the air-gapped host.
- Emits an `ExperimentalWarning` but works without any flag on Node 22.23.2.
- If you later want `better-sqlite3`, it is a one-file swap (`src/db/store.ts`); the SQL in `db/auth.sql` / `db/app.sql` is unchanged.

## 4. Data model mapping

Normalise the relations that the endpoints already treat as sets, and keep genuinely flexible data as JSON text columns.

| JSON collection | SQLite table(s) | Notes |
|---|---|---|
| `servers` | `servers` | one column per `ServerRecord` field; `UNIQUE(lower(host), lower(vm))` |
| `users` | `users` | `email` unique; never serialise the hash anywhere else |
| `sessions` | `sessions` | index on `user_id` and `expires_at` |
| `incidents` | `incidents` (scalar fields) + `incident_hosts` | `affected_server_ids` + `host_details` become child rows |
| `patch_campaigns` | `patch_campaigns` (scalar fields) + `campaign_targets` | `targets` object becomes child rows |
| `audit_logs` | `audit_logs` | `previous_value`/`new_value` stay JSON `TEXT`; append-only |
| `import_history` | `import_history` | `errors` stays JSON `TEXT` |

`IncidentHostDetail` and `PatchTarget` fields become real columns on the child tables. `audit_logs.previous_value`/`new_value` and `import_history.errors` remain JSON text because they are polymorphic and only read back, never queried.

The data-access layer reconstructs the existing shapes on read — `affected_server_ids`, `host_details`, and `targets` — so the client contract does not change.

## 5. Schema

The canonical DDL lives in [`db/auth.sql`](../db/auth.sql) (users + sessions) and [`db/app.sql`](../db/app.sql) (everything else). Highlights:

- `servers` has the full `ServerRecord` field set plus expression indexes on `lower(host)`, `lower(vm)`, and the commonly filtered columns (`business_unit`, `manager`, `primary_ip_address`, `datacenter`, `environment`, `product`, `support_team`, `power_state`).
- `UNIQUE(lower(host), lower(vm))` preserves the current `host::vm` composite-key matching.
- `incident_hosts(incident_id, server_id, ...)` with a composite primary key; same for `campaign_targets(campaign_id, server_id, ...)`.
- `audit_logs` is append-only with indexes on `timestamp`, `entity_type`, `entity_id`, and `action`.
- `sessions(expires_at)` indexed for the prune query.

## 6. Migration strategy

A **clean one-shot cutover** is the right shape here: it is a small internal app with no uptime SLA, and the data is small enough to import in seconds.

### Phase 0 — preparation (this repo state)

- No dependency changes (uses built-in `node:sqlite`).
- Add [`db/auth.sql`](../db/auth.sql) and [`db/app.sql`](../db/app.sql).
- Add [`scripts/migrate-to-sqlite.ts`](../scripts/migrate-to-sqlite.ts) (JSON → SQLite importer).
- Keep the JSON store fully working; nothing changes at runtime.

### Phase 1 — import and verify

1. Stop the app (or run the script on a copy).
2. `npx tsx scripts/migrate-to-sqlite.ts` — reads `data/csm_database.json`, creates `data/cmdb.sqlite`, inserts all rows.
3. Verify: table row counts match the JSON array lengths; spot-check users, sessions, and a few incident_hosts/campaign_targets rows.
4. Run a smoke check that the app still boots against JSON (unchanged).

### Phase 2 — cut the `Database` class over (done)

- Rewrite `Database` to open SQLite in `init()` and replace `db.data.*` array access with `SELECT`/`INSERT`/`UPDATE`/`DELETE` through prepared statements.
- Preserve the exported `db` object and every route-facing shape.
- Move the import endpoint into a **single transaction** so `insert`/`update`/`synchronise` is all-or-nothing.
- Keep audit writes as individual committed statements for now (they are already per-event).

### Phase 3 — retire JSON

- After a successful parallel run and backup, stop reading `csm_database.json`; keep it only as a legacy backup.
- Delete `db.save()` full-file writes and the array-slice audit cap; add a real retention job (or ship to SIEM) instead.

### Rollback

SQLite is additive until Phase 3: the JSON file is untouched by the migration script. If Phase 2 misbehaves, revert the `Database` class commit and the app runs on JSON again. The `.sqlite` file can be regenerated from JSON at any time.

## 7. What changes in `server.ts`

These are the main touch points; the route handlers themselves stay mostly unchanged.

1. `db.init()` — open `data/cmdb.sqlite`, apply `schema.sql`, run migrations, seed from CSV only when `servers` is empty.
2. `db.save()` — delete it (SQLite commits are explicit).
3. `db.logAudit()` — `INSERT INTO audit_logs`; drop the `AUDIT_LOG_LIMIT` slice, replace with a retention policy.
4. `findSessionUser` / `createSession` / `pruneSessions` — `SELECT`/`INSERT`/`DELETE` on `sessions` + `users`.
5. Imports — wrap `parseCsvToServers` results in one transaction.
6. Metrics/aggregates (`/api/stats`, `/api/products`, `/api/business-units`, `/api/managers`, `/api/networks`, `/api/datacenters`) — replace in-memory `filter`/`reduce` with indexed SQL `GROUP BY`.
7. Search/filter (`/api/servers`, `/api/servers/search`) — push filtering to SQL `WHERE`/`LIKE`; keep `FTS5` as a later option if needed.

## 8. Search at 10k hosts

10,000 rows is small for SQLite. Plain indexed `LIKE`/`instr` and equality filters will be instant for the autocomplete and table. Introduce SQLite **FTS5** only if profiling shows the global search is slow — it is an optimisation, not part of the initial migration.

## 9. Concurrency, durability, backups

- Single writer process, WAL mode → no write/read contention.
- `foreign_keys = ON` and transactions give referential integrity the JSON store never had.
- Backups stay a single-file operation: use the SQLite backup API or `VACUUM INTO 'backup.sqlite'` for a consistent snapshot (don't just copy a live WAL file mid-write).

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Native module install in air-gapped build | not applicable — `node:sqlite` is built into Node 22.23.2 |
| Date handling | keep ISO-8601 `TEXT` as today; no behaviour change |
| JSON columns (`host_details`, `targets`, audit `prev`/`next`) | store as JSON text, parse on read; validate with `json_valid()` |
| Case-insensitive host matching | `UNIQUE`/index on `lower(host), lower(vm)` |
| Migration drift during Phase 2 | keep JSON as fallback until Phase 3; re-run importer to rebuild `.sqlite` |
| CRLF / file mode on Windows | SQLite file is binary; add it to `.gitignore` (`data/` already ignores it) |

## 11. Testing checklist

- Row counts per table equal JSON array lengths.
- Login, logout, password change, session prune, user create/disable/reset.
- `POST /api/imports/preview` and `/execute` for all three strategies, including a failed row.
- Incident create/update, host-detail update, add/remove affected servers, `/impact`.
- Patch campaign create, target status update, joined target list.
- Audit log write + read; no `AUDIT_LOG_LIMIT` array truncation regression.
- Metrics and all directory endpoints return the same shapes as before.
- Backup/restore: `VACUUM INTO`, then boot against the restored file.

## 12. Open questions for review

1. Decide whether to accept the `node:sqlite` `ExperimentalWarning`, or swap in `better-sqlite3` (one-file change in `src/db/store.ts`).
2. Audit retention: keep a bounded in-DB retention window, or treat SQLite as the write-ahead log and ship to a SIEM?
3. `host_details`/`targets`/`errors` as JSON text columns (recommended) vs full normalisation — confirm the read-back shapes are stable enough.
