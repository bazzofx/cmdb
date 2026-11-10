# Architecture

> **At a glance:** A single Node process serves the Express API and the React SPA, backed by an in-memory database that is persisted to `data/csm_database.json` on every write.

| | |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, lucide-react, cytoscape, docx, jsPDF |
| Backend | Express 4 on Node 22, TypeScript executed with `tsx` |
| Data store | `data/csm_database.json`, loaded into memory at startup and written synchronously on mutation |
| Entry points | `server.ts` (API + static/Vite host), `src/main.tsx` → `src/App.tsx` (UI) |
| Dev command | `npm run dev` (runs `tsx server.ts`) |

## 1. Runtime topology

```text
Browser ── HTTP ──> Express (server.ts, port 3001)
                     ├── /api/*            JSON API (in-memory DB)
                     ├── dev:  Vite middleware (HMR, TS/TSX on the fly)
                     └── prod: dist/ static + SPA fallback
                                   │
                     data/csm_database.json (read once, written on every mutation)
```

There is no separate frontend server, no router library and no database server. The same process serves the UI and the API, which is why `npm run dev` is enough to use the application.

- **Development** (`NODE_ENV` unset): `createViteServer({ middlewareMode: true })` renders and hot-reloads the SPA.
- **Production** (`NODE_ENV=production`): `dist/` is served statically and every unknown path returns `dist/index.html`.
- **Host binding**: `0.0.0.0:${PORT || 3001}`.

## 2. Repository map

| Path | Responsibility |
|---|---|
| `server.ts` | Entire backend: schema, seeding, CSV parsing, all REST routes, static hosting |
| `src/App.tsx` | Global shell, view switch, cross-view state (filters, selected server, incident counts) |
| `src/components/layout/` | `Navbar`, `ThemeSwitcher`, `Sidebar` |
| `src/components/auth/` | `LoginView`, `ChangePasswordModal` |
| `src/components/settings/` | `UsersPanel` (admin role management) |
| `src/components/views/` | One component per page (12 views) |
| `src/components/common/` | `GlobalSearch`, `ServerDetailDrawer`, `CyberAtmosphere` |
| `src/theme/ThemeContext.tsx` | Palette definitions, `data-theme` application and `localStorage` persistence |
| `src/theme/palettes.css` | Palette tokens and Tailwind `--color-*` scale overrides, including the Cyber atmosphere |
| `src/context/AuthContext.tsx` | Session state, login/logout and 401 handling |
| `auth.ts` | scrypt password hashing, sessions, cookies, role policy |
| `src/services/api.ts` | Typed `fetch` wrapper with one shared `request()` helper; the only place URLs are built |
| `src/services/reportEngine.ts` | Report definitions, builders, summaries, CSV/JSON serialisation |
| `src/services/incidentAnalysis.ts` | Canonical incident metrics/breakdowns shared by triage, archive and report export |
| `src/services/incidentReportExport.ts` | One Markdown/Word/PDF export entry point |
| `src/services/incidentReportGenerator.ts` | Incident PDF/DOCX/Markdown document builders |
| `src/services/incidentCharts.ts` | Canvas chart generators for the incident report |
| `src/utils/format.ts` | Shared percentage, list, date and unique-value helpers |
| `src/utils/export.ts` | Shared CSV serialisation and browser download helpers |
| `src/hooks/useDebouncedValue.ts` | Search/input debounce used by Inventory and Communications |
| `src/types/index.ts` | Shared domain types (server, incident, campaign, metrics, audit) |
| `data/csm_database.json` | The database |
| `public/assets/aistudio/` | Seed CSV and mockup assets |
| `scripts/verify-reports.ts` | Semantic checks for all 12 reports (`npm run verify:reports`) |
| `scripts/verify-incident-analysis.ts` | Fixture checks for the shared incident rules (`npm run verify:incidents`) |

## 3. Data model

```text
ServerRecord ──< incident.affected_server_ids >── Incident
     │                                               │
     │                                         host_details{serverId}
     │
     └──< patchCampaign.targets{serverId} >── PatchCampaign

BusinessUnit ──< SubBusinessUnit        (derived by name, not foreign key)
Product ──> BusinessUnit (optional)      (derived by name)
AuditLogEvent, ImportHistoryItem         (append-only operational records)
```

Key relationships are **name-based, not ID-based**, except where the app stores explicit arrays:

- `ServerRecord.business_unit`, `sub_business_unit`, `product`, `support_team`, `datacenter` are strings. Deleting or renaming a business unit does not cascade; it creates a new bucket.
- `Incident.affected_server_ids` is a real ID array. `Incident.host_details` is keyed by server ID and holds per-host triage state, patch engineer, notes and communication flags.
- `PatchCampaign.targets` is keyed by server ID; each `PatchTarget` has a status, notes and optional scheduled/patched/validated dates.
- Derived views (BU cards, manager directories, product summaries, report groups) are computed from the server list on request; nothing is denormalised into storage.

### Server record fields that matter most

| Field | Role |
|---|---|
| `id` | UUID; used by incidents, patch targets, the drawer and reports |
| `host` / `vm` | Hypervisor host and VM name; the import match key is `host::vm` (lower-cased) |
| `business_unit` / `sub_business_unit` | Ownership and reporting hierarchy |
| `product` / `function` / `environment` | Workload classification |
| `manager` / `email` | Named owner and the address used for communications |
| `support_team` / `support_team_lookup_csm` | Operational coverage and CSM lookup name |
| `team` / `service` / `initials` | Supporting ownership and patch-planning metadata |
| `total_servers_to_patch` | Numeric patch-planning count; `null` when unknown |
| `engineer_notes` / `status` / `swg_check` / `source` | Patching-mapper notes, SWG/XDR status check and source label |
| `datacenter` / `network_1..3` | Physical and network placement |
| `power_state` | `poweredOn`, `poweredOff`, `suspended` |
| `efi_secure_boot` | `true`, `false` or `null` (not reported) |
| `is_missing_from_source` | Set by synchronise imports when a record disappears upstream |

## 4. Request and data flow

### Read path

1. A view calls `api.*` (`src/services/api.ts`).
2. Express filters/aggregates the in-memory arrays.
3. JSON returns to the component; derived values (counts, percentages, charts) are computed in the component or in `reportEngine.ts`.

Most list endpoints return a paginated envelope (`items`, `total`, `page`, `limit`, `total_pages`). Aggregation endpoints (`/stats`, `/business-units`, `/products`, `/managers`, `/networks`, `/datacenters`, `/incidents/:id/impact`) return computed objects directly.

### Write path

1. A view POSTs/PUTs JSON.
2. The route validates and normalises via `cleanString` / `sanitizeServerRecord`.
3. The in-memory array is mutated, `db.save()` rewrites the whole JSON file synchronously, and `logAudit()` appends an event (capped at 500).
4. The updated entity (or a summary object) is returned.

There is no transaction log and no write queue. A crash between mutation and save loses that write; concurrent writers are not coordinated beyond Node's single thread.

### Import path

`POST /api/imports/preview` parses the uploaded CSV, auto-maps columns, validates the first 20 rows and reports duplicates. `POST /api/imports/execute` applies one of three strategies:

| Strategy | Behaviour |
|---|---|
| `insert` | Adds rows; duplicates are reported, not merged |
| `update` | Matches on lower-cased `host::vm` and updates existing records |
| `synchronise` | Update plus mark records missing from the file with `is_missing_from_source = true` |

Every run writes one `IMPORT_CSV` audit event and one `ImportHistoryItem`.

## 5. API surface

Every API route requires a valid session. Authentication is local by default (`AUTH_MODE=local`); `disabled` is development-only and refused in production, and `ldap` is reserved for the future directory integration.

Authentication routes are outside `/api`:

| Route | Purpose |
|---|---|
| `POST /auth/login` | Email + password, creates the session cookie |
| `POST /auth/logout` | Destroys the session |

| Area | Routes |
|---|---|
| Current user | `GET /api/me`, `POST /api/me/password` |
| Users | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password` |
| Metrics | `GET /stats` |
| Servers | `GET /servers` (filters: `business_unit`, `sub_business_unit`, `customer`, `manager`, `support_team`, `support_team_lookup_csm`, `team`, `service`, `initials`, `total_servers_to_patch`, `engineer_notes`, `status`, `swg_check`, `source`, `environment`, `power_state`, `datacenter`, `product`, `function`, `secure_boot`, `network`, `host`, `vm`, `primary_ip_address`, `email`, `dns_name`, `q`, `sort_by`, `sort_order`, `page`, `limit`), `GET /servers/search?q=`, `GET /servers/:id`, `POST /servers`, `PUT /servers/:id`, `DELETE /servers/:id` |
| Business units | `GET /business-units`, `GET /business-units/:name` |
| Products | `GET /products` |
| Managers | `GET /managers`, `GET /managers/:name/servers` |
| Networks | `GET /networks`, `GET /networks/:name/servers` |
| Datacenters | `GET /datacenters` |
| Incidents | `GET /incidents`, `POST /incidents`, `GET /incidents/:id`, `PUT /incidents/:id`, `POST /incidents/:id/servers`, `DELETE /incidents/:id/servers/:serverId`, `PUT /incidents/:id/hosts/:serverId`, `GET /incidents/:id/impact` |
| Patching | `GET /patching/campaigns`, `POST /patching/campaigns`, `GET /patching/campaigns/:id`, `PUT /patching/campaigns/:id`, `PUT /patching/campaigns/:id/servers/:serverId` |
| Communications | `POST /communications/preview` |
| Imports | `POST /imports/preview`, `POST /imports/execute`, `GET /imports/history` |
| Audit | `GET /audit-logs` |

`PUT /incidents/:id/hosts/:serverId` has a single canonical handler which matches an incident by ID or reference and upserts the host detail.

**Browser origins and CORS.** `ALLOWED_ORIGINS` (comma-separated) is the trusted cross-origin allowlist, used by both the CORS middleware and the Origin/CSRF check; `APP_URL` and the request's own host are also accepted. The built-in deployment entries are `http://***.***.151.184:3001`, `http://soc-cmdb.development.local:3001`, `https://soc-cmdb.cybersamurai.co.uk` and `http://***.***.21.180:3001`, plus their direct HTTP/HTTPS variants. `OPTIONS` preflights are answered only for allowed origins, and disallowed origins receive `403`. Vite's separate host check is controlled by `VITE_ALLOWED_HOSTS` in `vite.config.ts`.

## 6. Frontend composition

`App.tsx` is a hand-rolled router:

- `currentView` is a string (`overview`, `inventory`, …, `settings`).
- A `switch`-by-`&&` block renders exactly one view.
- Cross-view state lives in `App`: `inventoryFilters`, `targetedServerIds`, selected server, metrics, incident counts.
- `handleNavigate(view, filterParams?)` changes the view and replaces (never merges) the inventory filter dictionary.
- Global overlays (`GlobalSearch`, `ServerDetailDrawer`) sit outside the view switch so every page can open them.

Views are presentational and receive callbacks; none of them talk to each other directly. The contract is the filter dictionary:

| From | To | Keys passed |
|---|---|---|
| Overview | Inventory | `power_state`, `secure_boot`, `business_unit`, `product`, `environment` |
| Business Units | Inventory | `business_unit`, `manager`, `network` |
| Products | Inventory | `product` |
| Infrastructure Map | Inventory | `business_unit` |
| Reports (aggregate rows) | Inventory | `business_unit`, `sub_business_unit`, `manager`, `support_team`, `datacenter`, `network` |
| Inventory | Incidents / Communications | selected server IDs (`targetedServerIds`) |
| Reports (server rows) | Server drawer | server ID |

## 7. Persistence and lifecycle

- On startup, `Database.init()` creates `data/` if needed, reads the JSON file, sanitises every server record (trims, strips nulls and zero-width characters, lower-cases emails) and immediately saves.
- If the file is missing or unparsable, the database re-seeds from `public/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv` (with a hard-coded fallback CSV), including one demo incident and one patch campaign.
- `save()` rewrites the entire file synchronously with two-space JSON. There is no debounce, so a burst of edits means a burst of full-file writes.
- The initial demo dataset is seeded only when a fresh database has no servers. There is no manual reset endpoint or in-app reset control.
- Audit logs are capped at the newest 5000 events by default (`AUDIT_LOG_LIMIT`).

## 8. Conventions

- **ESM everywhere**, with explicit `.js` extensions in relative imports even for `.ts`/`.tsx` sources (`allowImportingTsExtensions` is off, `bundler` resolution is on).
- Domain types live in one file; API functions return typed shapes; views avoid `any` except where legacy code already uses it.
- Styling is Tailwind utility classes plus `.soc-glass-panel` and `.soc-glass-panel-hover` from `src/index.css`. Seven colour palettes are selectable from the navbar; `src/theme/palettes.css` remaps the Tailwind `--color-*` scales per `data-theme`, so existing utility classes re-theme without per-view edits. The palette choice is persisted in `localStorage` (`csm-theme`) and applied by an inline script in `index.html` before first paint.
- Icons come from `lucide-react`; charts are hand-built with CSS bars and inline SVG (no charting library).
- Document exports are generated client-side: `docx` for Word, `jsPDF` for PDF, plain strings for Markdown.

## 9. Known limitations and technical debt

These are real constraints, not roadmap promises:

| Limitation | Effect |
|---|---|
| **Local auth only** | Roles are enforced, but LDAP/SSO is not implemented yet; `AUTH_MODE=ldap` fails fast |
| **Sessions in JSON** | Sessions and users share the JSON database; fine for ten users, not for horizontal scaling |
| **Audit is operational, not tamper-proof** | Audit events are capped and stored in an editable JSON file; ship them to a SIEM for evidence |
| Single JSON file, synchronous writes | Not safe for multiple processes or large estates; every write blocks the event loop briefly |
| In-memory arrays | No pagination at the storage layer; endpoints load and filter everything |
| 1,000-row client caps | Inventory option counts and Reports load at most 1,000 servers; larger estates truncate silently |
| Name-based relations | Renaming a BU/product/datacenter splits history instead of migrating it |
| No router / no URL state | Filtered views cannot be bookmarked or shared; refresh returns to Overview |
| No automated UI tests | Verification covers reports and typechecking, not rendering |
| No shared data cache | Each view remounts and refetches its datasets; mutations rely on explicit refreshes |
| Theme is per-device | Palette selection lives in `localStorage`, not the user record; it does not follow the account across browsers |
| No send capability | Communications previews text only; nothing is emailed or persisted |

## 10. Verification

```bash
npm run lint             # tsc --noEmit across app, server and scripts
npm run verify:reports   # builds all 12 reports and asserts their semantics
npm run verify:incidents # asserts the shared patched/communicated/documentation rules
npm run verify:auth      # password hashing, cookie and role-policy checks
npm run verify           # all three suites
npm run build            # production bundle
```

`verify:reports` reads `data/csm_database.json`, so it validates the same data the app will serve. It also exercises synthetic fixtures for ownership gaps, closed incidents, overdue patch targets and an empty database. `verify:incidents` covers the canonical incident rules, breakdown totals and Markdown report generation.

Related reading: [Operations runbook](./operations-runbook.md) and [Reports](./pages/10-reports.md).
