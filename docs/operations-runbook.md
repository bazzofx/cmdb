# Operations runbook

> **At a glance:** Install with npm (legacy peer resolution), run with `npm run dev`, persist by backing up `data/csm_database.json`, and verify with `npm run verify`.

| | |
|---|---|
| Runtime | Node.js 22+, npm 10+ |
| Dev server | `npm run dev` → http://localhost:3000 |
| Production | `npm run build` then `NODE_ENV=production npm start` |
| Database | `data/csm_database.json` (single file, rewritten on every change) |
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

- Serves the API and the Vite-powered SPA on **http://localhost:3000**.
- Change the port with `PORT=3010 npm run dev` (macOS/Linux) or `$env:PORT=3010; npm run dev` (PowerShell).
- The first start seeds `data/csm_database.json` if it does not exist, then sanitises and rewrites it. This is normal: `updated_at` values change on first boot.

### Windows launcher

Double-click `start-dev.bat`, or run `start-dev.bat 3010` from a terminal at the repo root. The script checks Node.js is on `PATH`, installs dependencies on first run (`npm install --legacy-peer-deps`), starts `npm run dev` on port 3000 (or the port you pass), opens the browser after a few seconds, and keeps the window open when the server stops. Set `NO_BROWSER=1` before running to skip the browser step.

Health check:

```bash
curl http://localhost:3000/api/stats
curl "http://localhost:3000/api/servers?limit=5"
curl http://localhost:3000/api/patching/campaigns
```

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

The entire estate is one JSON file.

```bash
# stop the server first — it writes on every mutation
cp data/csm_database.json data/csm_database.backup-$(date +%F).json
```

Restore by putting the file back while the server is stopped, then start again. A missing or unparsable file is **not** restored automatically: the server seeds demo data and overwrites the file. Keep backups outside `data/` as well.

## 5. Reset to demo data

In the UI: **Data Sync → Reset Demo Data** (destructive; confirm the dialog).

Or via the API:

```bash
curl -X POST http://localhost:3000/api/seed/reset
```

This re-seeds servers, incidents, patch campaigns and clears audit logs and import history. It does not touch files outside `data/csm_database.json`.

## 6. Import a server CSV

1. Open **Data Sync**.
2. Drop or choose a CSV; the preview reports detected columns, row count and suggested mappings.
3. Confirm the column mapping, choose a strategy:
   - `insert` — add rows, report duplicates;
   - `update` — match on `host::vm` (lower-cased) and update;
   - `synchronise` — update plus flag records missing from the file.
4. Review the preview (the first 20 rows are validated) and execute.
5. Check **Import History** for the summary and any row errors; the audit log records one `IMPORT_CSV` event per run.

Before a large import: back up the JSON file (section 4). There is no undo.

Required columns are matched by header aliases; the canonical source headers are in the seed CSV. `Host` and `VM` form the identity key, so blank values create unpredictable duplicates.

## 7. Verify reports, incidents and types

```bash
npm run verify:reports   # builds all 12 reports and asserts their semantics
npm run verify:incidents # asserts the shared patched/communicated/documentation rules
npm run verify           # both suites
npm run lint             # tsc --noEmit
npm run build            # production bundle
```

`verify:reports` and `verify:incidents` read the live `data/csm_database.json`, so run them after changing data or report logic. They exit non-zero and print each failed assertion. They are safe: they only read the file.

Optional UI smoke test (needs the dev server on port 3010 and Chrome started with `--remote-debugging-port=9222`):

```bash
node scripts/ui-smoke.mjs
```

It loads the app, visits every sidebar view, checks all 12 reports (titles/columns/row counts/summary cards), narrows a search, opens a server from a report row, and writes screenshots. It asserts the **seeded demo dataset** (9 servers, 2 incidents, 1 campaign), so update the expectations or reset the data before using it against a live estate.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE :3000` | Another dev server or app is on the port | Stop it, or start with `PORT=3010` |
| `npm error ERESOLVE … esbuild` | Vite 8 optional peer mismatch | `npm install --legacy-peer-deps` |
| App shows demo data after a data loss | JSON file missing or unparsable; server re-seeded | Restore a backup while stopped; do not rely on the file being rebuilt |
| `[DB] Error loading database file, re-seeding...` | Corrupt JSON | Inspect the file for syntax errors, fix or restore backup. A copy of the old file is not kept |
| Data changes disappear on restart | The server was stopped mid-write, or a second process overwrote the file | Use one process per data file; stop cleanly; restore the newest backup |
| Reports show fewer servers than expected | The report loader requests `limit=1000` | Expected ceiling; see [Reports](./pages/10-reports.md) |
| Import reports duplicates that look unique | Match key is lower-cased `host::vm`; leading/trailing spaces are trimmed | Normalise both columns in the source CSV |
| `dist/index.html` not found in production | `npm run build` not run, or run in the wrong directory | Rebuild; confirm `dist/` exists relative to `server.ts` |
| Print output includes the sidebar | Browser print captures the whole app shell | Use CSV/JSON/Markdown exports for filing |

## 9. Logs and monitoring

- The server logs `[DB] Loaded and sanitized N servers` and `[CSM Server] Running on http://0.0.0.0:PORT` at startup.
- There is no request log, metrics endpoint or health-check route beyond `/api/stats`.
- Audit events are visible in **Settings → Audit Log** and capped at the newest 500.
- For a lightweight uptime check, poll `GET /api/stats` and assert `total_servers > 0`.

## 10. Upgrade procedure

1. Stop the server.
2. Back up `data/csm_database.json`.
3. Pull the new code and reinstall (`npm install --legacy-peer-deps`).
4. Run `npm run lint`, `npm run verify` and `npm run build`.
5. Start the server and query `/api/stats`; open **Data Sync** to confirm record counts.
6. If the schema changed, check the release notes; there is no migration framework — new fields are sanitised on load and missing ones default to empty.

Related: [Architecture](./architecture.md), [Data Sync](./pages/11-data-management.md), [Reports](./pages/10-reports.md).
