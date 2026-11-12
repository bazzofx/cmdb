# SOC CMDB — Server Ownership & Business Intelligence — Documentation

This folder is the **documentation forwarder**: start here, pick the path that matches what you are doing, and follow the links. Every application page has its own subsection under [`pages/`](./pages), written for the ten operational users first and for internal development second.

The documentation describes the application **as implemented in this repository**, not an aspirational roadmap. Where a control is static, hard-coded or only partially wired, the page says so.

- Application: React 19 + Vite 8 frontend, Express + TypeScript backend, embedded SQLite stores (auth + application)
- Documentation last reviewed: 8 November 2026
- Source of truth: `src/`, `server.ts`, `src/db/store.ts` and `data/*.sqlite`

## Start here

| If you are… | Read, in this order |
|---|---|
| New to the console and need to look after the estate | [Overview](./pages/01-overview.md) → [Inventory](./pages/02-inventory.md) → [Incidents](./pages/07-incident-triage.md) → [Reports](./pages/10-reports.md) |
| The ownership/data manager | [Inventory](./pages/02-inventory.md) → [Business Units](./pages/03-business-units.md) → [Ownership Explorer](./pages/05-ownership-explorer.md) → [Data Sync](./pages/11-data-management.md) → [Reports](./pages/10-reports.md) |
| Responding to a security incident | [Incidents](./pages/07-incident-triage.md) → [Communications](./pages/09-communications.md) → [Archive Incident](./pages/08-archived-incidents.md) → [Reports](./pages/10-reports.md) |
| Running the weekly patch review | [Reports](./pages/10-reports.md) (reports 8, 10, 11, 12) → [Incidents](./pages/07-incident-triage.md) |
| Auditing or evidencing controls | [Reports](./pages/10-reports.md) → [Settings & Audit](./pages/12-settings-and-audit.md) |
| New to the codebase | [Architecture](./architecture.md) → [Operations runbook](./operations-runbook.md) → the **For developers** section of the page you are changing |
| Reporting a bug or asking for a change | The page's **Gotchas and guardrails** section first; it may already be a known limitation |

## Page subsections

| # | Page | View id | What it covers |
|---|---|---|---|
| 1 | [Overview](./pages/01-overview.md) | `overview` | Headline KPIs, distribution charts, security and ownership posture, recent activity |
| 2 | [Inventory](./pages/02-inventory.md) | `inventory` | The server working table: filters, columns, bulk actions, exports, detail drawer |
| 3 | [Business Units](./pages/03-business-units.md) | `business-units` | Department cards, sub-units, managers, attached networks and servers |
| 4 | [Products](./pages/04-products.md) | `products` | Product ownership, fleet availability, per-product hosts |
| 5 | [Ownership Explorer](./pages/05-ownership-explorer.md) | `ownership-explorer` | Relationship graph of BU → product → manager → server → network |
| 6 | [Infrastructure Map](./pages/06-infrastructure-map.md) | `infrastructure-map` | Hypervisors, datacenters, networks and BU infrastructure groupings |
| 7 | [Incidents](./pages/07-incident-triage.md) | `incident-triage` | Incident creation, host triage, impact analysis, patch targets, report export |
| 8 | [Archive Incident](./pages/08-archived-incidents.md) | `archived-incidents` | Closed investigations, reopen, archival reporting |
| 9 | [Communications](./pages/09-communications.md) | not routed | Contact list preview and templated per-stakeholder mail with masked IPs |
| 10 | [Reports](./pages/10-reports.md) | `reports` | The 12 standard reports, summaries, drill-through and exports |
| 11 | [Data Sync](./pages/11-data-management.md) | `data-management` | CSV import wizard, strategies, validation, history and reset |
| 12 | [Settings & Audit](./pages/12-settings-and-audit.md) | `settings` | Environment status, audit log and admin user/role management |

Supporting documents:

- [Architecture](./architecture.md) — stack, data model, API surface, cross-view navigation and known limitations
- [Operations runbook](./operations-runbook.md) — install, run, build, backup, reset, import and verification
- [Authentication for production](../authentication4Production.md) — local auth, roles, secure deployment checklist and LDAP plan
- [Technology stack, fonts and external assets](./technology-and-assets.md) — high-level stack, font sourcing, local copies and external requests

## Colour palettes

The palette picker sits in the top-right of the navbar (paint-palette button) and applies instantly across the shell and every view. The selection is stored per device in `localStorage` under `csm-theme`; an inline script in `index.html` applies it before first paint. New browsers start on **Cyber**.

| Palette | Character |
|---|---|
| **Default** | The original navy, blue and cyan SOC scheme |
| **Onyx** | Brushed tungsten, graphite and layered metallic greys |
| **X3000** | Titanium black and light grey with shock-pink highlights |
| **Midnight** | Midnight black with neon green |
| **Morning** | Light mode: paper white, beige and dark grey with orange and blue accents |
| **Coffee** | Dark brown, soft pastel yellow and cream |
| **Cyber** | Neon violet/cyan palette with a particle canvas, drifting grid, panel glow and page-enter motion (default) |

Cyber respects `prefers-reduced-motion`: the particles render as a static field and the motion animations are disabled. The login screen renders the richer version of the same field for every palette — more particles, curved nearest-neighbour links, travelling light pulses, short motion trails and gold sparks — while the signed-in ambient canvas is only shown for Cyber. The logo, favicon (`/assets/favourites.ico`) and page title are shared by every palette. Palette mechanics live in [`src/theme/palettes.css`](../src/theme/palettes.css) and [`src/theme/ThemeContext.tsx`](../src/theme/ThemeContext.tsx).

## The reports at a glance

The Reports page is the export surface of everything else. Each report has its own grain, so numbers line up with the page they came from.

| Report | Grain | Use it to… |
|---|---|---|
| 1. Complete Server Inventory | Server | Produce the full asset extract |
| 2. Business Unit Inventory | BU + Sub-BU | Show workload distribution |
| 3. Ownership Completeness Audit | Server | Evidence ownership hygiene across five fields |
| 4. Servers by Manager Directory | Manager | Hand a manager their portfolio |
| 5. Servers by Support Team | Support team | Hand a team its estate |
| 6. Servers by Datacenter | Datacenter | Review a site, its hosts and networks |
| 7. Servers by Network Segment | Network | Check segment exposure and role mix |
| 8. Servers with Secure Boot Disabled | Server | Evidence a compliance gap |
| 9. Missing Ownership Metadata | Server | Find orphaned assets |
| 10. Incident Impact Summary | Incident | Brief stakeholders during an investigation |
| 11. Vulnerability Assessment Posture | Server | Prioritise containment and hardening |
| 12. Patching Lifecycle Progress | Patch target | Run the remediation stand-up |

Full detail, including export formats and the drilling rules, is in [Reports](./pages/10-reports.md).

## Documentation conventions

- **"As implemented"** means the behaviour was read from the source. If a control is cosmetic (for example a dropdown that does not filter), the page says so in *Gotchas*.
- UI labels appear in "quotes" exactly as rendered; view ids and API routes appear in `code`.
- **Sections 1–6** of every page are for operational users. **Section 7 — For developers** covers props, state, API calls and extension points.
- Line numbers are avoided in prose because they rot; file names are not. Search the named file for the label.
- Links are relative so the docs work in the repo, in a pull request and on a static host.

## Maintaining these docs

1. Change behaviour → change the page in the same pull request. If you add a report, update the tables in [Reports](./pages/10-reports.md) and the report check in `scripts/verify-reports.ts`.
2. Run `npm run lint` and `npm run verify:reports`; both must pass before the docs claim anything about reports.
3. When a page's **Gotchas** entry is fixed, delete the entry rather than leaving stale warnings. Stale documentation is worse than none.

## Glossary

| Term | Meaning in this application |
|---|---|
| **Server record** | One row in the inventory: a VM plus its hypervisor host, IPs, ownership and classification |
| **Business Unit (BU)** | Top-level organisational grouping; **Sub-BU** is the department below it |
| **Product** | The service or system a server supports; a product can span BUs |
| **Manager / owner** | Named person responsible for the server, with the email used for communications |
| **Support team** | Operational team that covers the server (for example `UK`) |
| **Secure Boot** | `efi_secure_boot`: `true` (enabled), `false` (disabled), `null` (not reported) |
| **Incident** | A security investigation with severity, status, affected servers and per-host triage detail |
| **Triage status** | Per-host state inside an incident (for example "To be contacted", "Patched", "Isolated") |
| **Patch campaign** | A remediation effort with a CVE, due date and per-server patch targets |
| **Impact** | Aggregated stakeholders and correlation leads for one incident (BUs, managers, emails, shared hosts/networks) |
| **Audit log** | Append-only (capped at 500) record of changes and imports, visible in Settings |
