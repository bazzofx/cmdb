# Operations runbook

> **At a glance:** Install with npm (legacy peer resolution), run with `npm run dev`, persist by backing up `data/auth.sqlite` + `data/cmdb.sqlite`, and verify with `npm run verify`.

| | |
|---|---|
| Runtime | Node.js 22+, npm 10+ |
| Dev server | `npm run dev` → http://localhost:3001 |
| Production | `npm run build` then `NODE_ENV=production npm start` |
| Database | `data/auth.sqlite` (users + sessions) and `data/cmdb.sqlite` (application data) — embedded SQLite, WAL mode |
| Seed data | `public/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv` |

## 1. First install

```bash
git clone https://github.com/bazzofx/cmdb.git
cd cmdb
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required with npm because the project pins `esbuild@^0.25` while Vite 8 declares an optional peer of `esbuild@^0.27 || ^0.28`. The repo also contains `bun.lock`; if Bun is installed, `bun install` works and is faster, but Bun is not required.

Check the toolchain:

```bash
node -v     # v22.x
npm -v      # 10.x
```

## 2. Run locally

```bash
npm run dev
```

- Serves the API and the Vite-powered SPA on **http://localhost:3001**.
- Change the port with `PORT=3010 npm run dev` (macOS/Linux) or `$env:PORT=3010; npm run dev` (PowerShell).
- On first boot the server creates `data/auth.sqlite` and `data/cmdb.sqlite`. It imports any legacy `data/csm_database.json` once; if that file is absent it seeds the demo CSV. The legacy JSON is left untouched and can be deleted after sign-off.
- One-shot import (optional): `npm run migrate:db` re-imports `data/csm_database.json` into the two SQLite files (it first deletes the existing `.sqlite` files).

### Sign in (local authentication)

Authentication is enabled by default (`AUTH_MODE=local`). There are no credentials stored in the repository. The first administrator is created from the OS environment on first run:

```powershell
$env:cmdbUser = "admin@example.internal"
$env:cmdbPass = "<strong unique password>"
```

Change that password from the user menu before sharing the environment; the server forces the change on first sign-in. If `cmdbUser`/`cmdbPass` are missing when the users table is empty, the server refuses to start. Production settings and the full pre-flight checklist are in [authentication4Production.md](../authentication4Production.md).

Health check now needs a session:

```bash
curl -c cookies.txt -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CMDB_USER\",\"password\":\"$CMDB_PASS\"}"
curl -b cookies.txt http://localhost:3001/api/stats
curl -b cookies.txt "http://localhost:3001/api/servers?limit=5"
```

### Windows launcher

Double-click `start-dev.bat`, or run `start-dev.bat 3010` from a terminal at the repo root. The script checks Node.js is on `PATH`, installs dependencies on first run (`npm install --legacy-peer-deps`), starts `npm run dev` on port 3001 (or the port you pass), opens the browser after a few seconds, and keeps the window open when the server stops. Set `NO_BROWSER=1` before running to skip the browser step.

## 3. Build and run in production mode

```bash
npm run build
NODE_ENV=production npm start
```

PowerShell:

```powershell
npm run build
$env:NODE_ENV="production"; npm start
```

In production the Express process serves `dist/` and falls back to `index.html` for client routes. The build output is not committed; rebuild after every frontend change. The build prints a warning about `__dirname` in `vite.config.ts` and about a bundle larger than 500 kB; both are non-fatal.

## 4. Data backup and restore

The estate lives in two embedded SQLite databases, kept separate:

- `data/auth.sqlite` — users and sessions (the user database)
- `data/cmdb.sqlite` — servers, incidents, patch campaigns, audit log, import history

**Online snapshot (safe while the server runs)** — use the SQLite backup API:

```bash
node -e "const { backup, DatabaseSync } = require('node:sqlite'); (async () => { const a = new DatabaseSync('data/auth.sqlite'); const c = new DatabaseSync('data/cmdb.sqlite'); await backup(a, 'data/auth.sqlite.bak'); await backup(c, 'data/cmdb.sqlite.bak'); console.log('backup complete'); })()"
```

**Or stop the server and copy the files** (checkpoint flushes WAL to the main file first):

```bash
# stop the server first
cp data/auth.sqlite  data/auth.sqlite.backup-$(date +%F)
cp data/cmdb.sqlite  data/cmdb.sqlite.backup-$(date +%F)
```

Restore by replacing both files while the server is stopped, then start again. A legacy `data/csm_database.json` is only a pre-migration artifact, not the source of truth. Keep backups outside `data/` (everything under `data/` is git-ignored).

## 5. Demo data

There is no in-app demo reset and no `/api/seed/reset` endpoint. The bundled demo dataset is seeded only on a fresh installation with no servers. A normal data refresh must use the CSV import workflow in section 6.

## 6. Import a server CSV

1. Open **Data Sync**.
2. Drop or choose a CSV; the preview reports detected columns, row count and suggested mappings.
3. Confirm the column mapping, choose a strategy:
   - `insert` — add rows, report duplicates;
   - `update` — match on `host::vm` (lower-cased) and update;
   - `synchronise` — update plus flag records missing from the file.
4. Review the preview (the first 20 rows are validated) and execute.
5. Check **Import History** for the summary and any row errors; the audit log records one `IMPORT_CSV` event per run.

Before a large import: back up the SQLite databases (section 4). There is no undo.

Required columns are matched by header aliases; the canonical source headers are in the seed CSV. `Host` and `VM` form the identity key, so blank values create unpredictable duplicates.

## 7. Verify reports, incidents and types

```bash
npm run verify:reports   # builds all 12 reports and asserts their semantics
npm run verify:incidents # asserts the shared patched/communicated/documentation rules
npm run verify:auth      # hashing, password policy, cookies and the role matrix
npm run verify           # all three suites
npm run lint             # tsc --noEmit
npm run build            # production bundle
```

`verify:reports` and `verify:incidents` read the live application data, so run them after changing data or report logic. They exit non-zero and print each failed assertion. They are read-only. (Note: these two scripts currently load the legacy `data/csm_database.json` directly; re-pointing them at the SQLite store is a pending follow-up.)

Optional UI smoke test (needs the dev server on port 3010 and Chrome started with `--remote-debugging-port=9222`):

```bash
node scripts/ui-smoke.mjs
```

It clears cookies, signs in with `SMOKE_EMAIL`/`SMOKE_PASSWORD` (both are required environment variables), visits every sidebar view, checks all 12 reports, narrows a search and opens a server from a report row. Views hidden by the signed-in role are skipped. It asserts the **seeded demo dataset** (9 servers, 2 incidents, 1 campaign), so update the expectations or reset the data before using it against a live estate.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE :3001` | Another dev server or app is on the port | Stop it, or start with `PORT=3010` |
| `npm error ERESOLVE … esbuild` | Vite 8 optional peer mismatch | `npm install --legacy-peer-deps` |
| App shows demo data after a data loss | SQLite files were empty or deleted; the store imported legacy JSON or seeded demo data | Restore a backup while stopped; do not rely on the store being rebuilt |
| `SQLITE_CORRUPT` / `database disk image is malformed` | Corrupt database file | Stop the server, restore both `.sqlite` backups, restart |
| Data changes disappear on restart | Two processes opened the same SQLite file, or the process was killed mid-transaction | Run one process per database file; stop cleanly; restore the newest backup |
| Reports show fewer servers than expected | The report loader requests `limit=1000` | Expected ceiling; see [Reports](./pages/10-reports.md) |
| Import reports duplicates that look unique | Match key is lower-cased `host::vm`; leading/trailing spaces are trimmed | Normalise both columns in the source CSV |
| `dist/index.html` not found in production | `npm run build` not run, or run in the wrong directory | Rebuild; confirm `dist/` exists relative to `server.ts` |
| Print output includes the sidebar | Browser print captures the whole app shell | Use CSV/JSON/Markdown exports for filing |

## 9. Logs and monitoring

- At startup the server logs `[DB] Imported legacy JSON...` (first boot from an existing JSON), `[DB] Seeded N server records.` (fresh seed), and `[CSM Server] Running on http://HOST:PORT` (`HOST` is `127.0.0.1` in dev, `0.0.0.0` in production).
- There is no request log, metrics endpoint or health-check route beyond `/api/stats`.
- Audit events are visible in **Settings → Audit Log** and capped at `AUDIT_LOG_LIMIT` (default 5000).
- For a lightweight uptime check, poll `GET /api/stats` and assert `total_servers > 0`.

## 10. Upgrade procedure

1. Stop the server.
2. Back up `data/auth.sqlite` and `data/cmdb.sqlite` (section 4).
3. Pull the new code and reinstall (`npm install --legacy-peer-deps`).
4. Run `npm run lint`, `npm run verify` and `npm run build`.
5. Start the server and query `/api/stats`; open **Data Sync** to confirm record counts.
6. If the schema changed, review `db/auth.sql` and `db/app.sql`; the store applies `CREATE TABLE IF NOT EXISTS` at startup and imports a legacy `data/csm_database.json` only when the SQLite store is empty.

Related: [Architecture](./architecture.md), [Data Sync](./pages/11-data-management.md), [Reports](./pages/10-reports.md).
