# Archive Incident

> **At a glance:** A read-only historical record of every closed or archived incident, with enough detail to regenerate the remediation report and reopen the case if it refuses to stay closed.

| | |
|---|---|
| View id | `archived-incidents` |
| Sidebar label | `Archive Incident` |
| Core component | `src/components/views/ArchivedIncidentsView.tsx` |
| Primary API | `GET /api/incidents` (client-filtered to `Closed`/`Archived`), `GET /api/incidents/:id/impact`, `PUT /api/incidents/:id` |
| Primary users | Incident responders, service managers, auditors |
| Depends on | Incidents archived from the triage page, stored `host_details`, the inventory records behind `affected_server_ids`, `incidentReportGenerator.ts` |

## 1. What this page is for

The archive is the audit trail for incidents that have been signed off. It fetches the same incident collection as the triage board, keeps only records whose status is `Closed` or `Archived`, and presents the selected one as a closure banner, a remediation gauge, a telemetry summary and a per-host inventory.

Nothing here is editable. The only writes are the report exports (generated in the browser) and `Reopen Incident`, which flips the record back to `Investigating` and hands the operator to the triage board.

The page also exists so a report can be regenerated months later. Because the generator reads stored `host_details`, the numbers match whatever was last saved, not whatever the inventory says now.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Read the closure story | Open the page; the banner shows the reference, close date, closure text, closer and IoC |
| Check final remediation numbers | `Remediated Systems` gauge and the `Archived Incident Telemetry & Posture` panel |
| Find a specific host in a case | The search box in the `Remediated Host Inventory` panel |
| Re-export a past report | `Export Report` → PDF / Word / Markdown |
| Jump to a host's live record | Click any row in `Remediated Host Inventory` |
| Reopen a case | `Reopen Incident` — leaves this page and lands on Incidents |
| Confirm an incident really is archived | The ribbon pill and the `N Archived` badge in the header |
| Find the active case instead | `View Active Incidents` in the empty state |

## 3. Screen walkthrough

**Header bar.** `ARCHIVED INCIDENTS REPOSITORY` with an emerald `N Archived` badge and the subtitle about audit trail and multi-format export. On the right, when an incident is selected: `Export Report` (blue, chevron) and `Reopen Incident` (with a rotate icon that spins while the call is in flight).

**Export menu.** Opens below the button, headed `Select Report Format:`, listing `PDF Document (.pdf)` / `Printable`, `Word Document (.docx)` / `Docx` and `Markdown Report (.md)` / `Raw text`. The button is disabled while a Word or PDF export is running, but its label does not change.

**Incident ribbon.** One pill per archived incident: a green tick, the reference in bold and the title truncated at about 200 px. There is no severity indicator, no date and no sort control; order is whatever `GET /api/incidents` returns, which is newest-created first. With nothing archived the page shows `No Archived Incidents`, an explanatory line and `View Active Incidents`.

**Closure banner.** `ARCHIVED RECORD: <ref>`, `Closed <localised date>` (or `Closed N/A`), the incident description (or `Closed and archived with zero uncontained systems.` when empty), and on the right `Closed By:` (falling back to `SecOps Lead`) and `IoC:` (falling back to `N/A`).

**Remediation row.** Left: the `Remediated Systems` gauge, a percentage badge suffixed `% FINAL`, a centre readout of patched over total, and a footer line that reads `All affected systems successfully patched` when nothing is outstanding, otherwise `N servers granted exception`. Right: `Archived Incident Telemetry & Posture`, a six-row grid — `Total Systems Impacted`, `Stakeholder Outreach`, `Documentation Coverage`, `Containment Isolated`, `Linked Business Units`, `Products & Stakeholders` — with a footer of `Archived incident reports can be regenerated anytime.` and a static `Audit Compliant` label.

**Host inventory.** Panel heading `Remediated Host Inventory (N)`, where N is the filtered count, and a search input (`Filter host, vm, IP, BU...`). The table is `Host / VM` (VM bold, host beneath), `IP Address`, `Business Unit`, `Product`, `Triage Status`, `Patch Status`, `Engineer`, `Ticket`, `Notes`. Patched rows are tinted emerald. The ticket is rendered with a leading `#`. Notes are truncated to roughly 200 px with the full text in a `title` tooltip. Every row is a button to the server drawer. When the search matches nothing the table body is simply blank — there is no "no results" row. There is no pagination, sorting or column chooser.

**Loading and errors.** There is no spinner: `loading` is tracked but never rendered, so a slow fetch shows the empty state briefly. A failed impact fetch is logged to the console and leaves the page at zero servers while the closure banner still renders. The view mounts only while `currentView === 'archived-incidents'`, so leaving and returning remounts it and re-reads the incident list — a newly archived case appears without a manual refresh.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| `N Archived` badge | `GET /api/incidents` filtered in the client | Count of `Closed` + `Archived` |
| Ribbon pill | `incident_reference`, `incident_title` | No severity or date shown |
| `Closed <date>` | `closed_at` | `toLocaleDateString()`; `N/A` when absent |
| Banner body | `description` | Includes the appended `[RESOLVED & ARCHIVED …]` text written at closure |
| `Closed By:` | `closed_by` | Falls back to `SecOps Lead` |
| `IoC:` | `ioc_or_vulnerability` | Falls back to `N/A` |
| Gauge numerator | `host_details[id].status` / `patching_status` | `Patched`/`Patch` or `patching_status` `Patched`/`Validated` |
| Gauge denominator | `impact.affected_servers.length` | Live inventory join, not a stored count |
| Stakeholder Outreach | `host_details[id].communicated` or status `Contacted` | Broader than the triage page's count |
| Documentation Coverage | `notes`, `patch_engineer`, `ticket_number` | Any one non-empty |
| Containment Isolated | `host_details[id].status === 'Isolated'` | |
| Linked Business Units | `server.business_unit` | Names joined into one line; can overflow on large cases |
| Host row | `server.vm`, `server.host`, `primary_ip_address`, `business_unit`, `product` | Read-only |
| `Triage Status` cell | `host_details[id].status` | Defaults to `To be contacted` |
| `Patch Status` cell | `host_details[id].patching_status` | Defaults to `Not Started` |
| `Engineer`, `Ticket`, `Notes` | `patch_engineer`, `ticket_number`, `notes` | `-` when empty |

## 5. Common workflows

1. **Review a closed incident.** Open `Archive Incident` in the sidebar; the first archived incident in the list (creation order, newest first) is selected automatically. Read the banner for the closure summary, then the gauge and telemetry panel for the final position, then scan the host table. Hover a truncated note to read it in full.
2. **Export a historical report.** With the incident selected, click `Export Report` and pick a format. Files are named `incident_<reference>_report.pdf|docx|md`. The generator re-reads current inventory for host attributes but uses the stored triage details, so a re-export is not a byte-for-byte copy of the original.
3. **Reopen a case.** Click `Reopen Incident`. The client sends `PUT /api/incidents/:id` with `status: 'Investigating'`, refreshes the app-level counts and switches to `incident-triage`, where the incident reappears in the ribbon. The reopened record keeps its original `closed_at`, `closed_by` and appended closure text.
4. **Investigate one host.** Click any row in `Remediated Host Inventory` to open the server drawer on that server id. The drawer is the only route from the archive into current inventory data — the archive itself never re-reads server attributes.
5. **Cross-check coverage.** Use the search box to confirm a host was in scope (`host`, `vm`, `IP`, `BU`, `manager` only). The filtered count in the heading is the only feedback that the filter applied.

## 6. Gotchas and guardrails

- The page shows `Closed` **and** `Archived`. No current UI writes `Closed`; `Close & Archive` on the triage page jumps straight to `Archived`.
- Reopening does not clear the closure metadata. The archive view passes `closed_at: undefined` and `closed_by: undefined`, but `JSON.stringify` drops undefined keys, so the server keeps the old values. Re-archiving overwrites them.
- `servers granted exception` is inferred from "patched count is below total". It does not read `patching_status === 'Exception'`, so genuinely unpatched hosts are labelled as exceptions.
- The gauge is wider than the triage page's: it counts `patching_status` of `Patched`/`Validated` as remediated even when triage status is still `To be contacted`. The same incident can show different percentages on the two pages.
- Host details are read-only here by design. Correcting a ticket number or note requires reopening the incident.
- Search only covers five fields and only the selected incident; there is no estate-wide archive search and no date-range filter.
- Nothing is paginated. Very large incidents render every row.
- The reports are generated live from stored data on every click — no snapshot is kept, so a later data edit changes the "historical" PDF.
- `Reopen Incident` has no confirmation step and no role check. One click moves the case back into active triage.
- An impact fetch failure is silent apart from the console; the page will present a zero-server archive rather than an error.
- The ribbon shows every archived incident at once with no date grouping or pagination; on a mature estate it becomes a long horizontal scroll with no indication that more pills exist off-screen.
- The page never calls `GET /api/incidents/:id`. It relies on the list payload carrying `host_details`, so a trimmed list endpoint would silently break the host table.

## 7. For developers

**Component structure and props.** A single function component, `ArchivedIncidentsView`, with three inline sections and no child components. Props:

| Prop | Type | What it does |
|---|---|---|
| `onSelectServer` | `(id: string) => void` | Row click in the host table; opens `ServerDetailDrawer` via `App`. |
| `onNavigateToActiveIncidents` | `() => void` (optional) | Called after a successful reopen. `App` always supplies it, so the local `loadArchivedIncidents()` fallback is effectively dead. |
| `onRefreshIncidents` | `() => void` (optional) | Calls `loadDashboardData()` so the sidebar badges and navbar count update after a reopen. |

**State, effects and API triggers.**

| State | Behaviour |
|---|---|
| `archivedIncidents` | Filled once on mount by `GET /api/incidents`, then filtered to `Closed`/`Archived` in the client |
| `selectedIncidentId`, `impact` | Auto-selects the first archived incident; each selection fires `GET /api/incidents/:id/impact` |
| `searchQuery` | Client-only filter over `host`, `vm`, `primary_ip_address`, `business_unit`, `manager` |
| `isExporting`, `exportDropdownOpen` | UI only; `isExporting` disables the export button during Word/PDF generation |
| `reopening` | Disables `Reopen Incident` and spins its icon during the `PUT` |
| `loading` | Set but never rendered |

`hostDetails` is not state: it is derived from `selectedIncident.host_details` on every render, so the page cannot drift from the incident record. All breakdowns (`buBreakdown`, `productBreakdown`, `managerAccountability`) are `useMemo` over `affectedList` and `hostDetails`.

**API calls and response shapes.**

| Call | Body | Response |
|---|---|---|
| `GET /api/incidents` | none | `Incident[]`; the client keeps `status === 'Closed' \|\| status === 'Archived'` |
| `GET /api/incidents/:id/impact` | none | `IncidentImpact` — the page uses `affected_servers` only; the correlation leads are ignored |
| `PUT /api/incidents/:id` | `{ status: 'Investigating' }` plus the dropped undefined keys | Updated `Incident` |

There is no archive-specific endpoint: the archive is a client-side view of the shared incident collection, and the server has no retention, purge or date logic.

**Cross-view navigation.** `onSelectServer(server.id)` → drawer. `onNavigateToActiveIncidents()` → `setCurrentView('incident-triage')` with no parameters, so the triage page opens with whichever incident it auto-selects, not the one just reopened. No URL, hash or query string is used anywhere.

**Report export plumbing.** `getReportPayload()` builds the same `ReportData` shape as the triage page but computes its own metrics: `patchedCount` counts triage status `Patched`/`Patch` **or** `patching_status` `Patched`/`Validated`; `communicatedCount` counts `communicated` **or** status `Contacted`; the `buBreakdown` rows carry `{ name, total, patched, communicated }` without the in-progress or isolated fields the triage page computes. Markdown is synchronous, Word awaits `Packer.toBlob` with five embedded chart PNGs, PDF is a `jsPDF` A4 document saved via `doc.save()`. Filenames are `incident_<reference>_report.<ext>`.

**Extension points / known rough edges.** No "export all", no deletion, no date/severity filter and no pagination. The reopen payload's `undefined` fields are a no-op, so closure metadata survives. `loadArchivedIncidents` exists as a post-reopen fallback, but `App` always supplies the navigation callback, so that branch is unreachable. There is no loading skeleton, empty-row message or error banner. `Building2`, `Package`, `Users`, `ShieldAlert`, `Calendar`, `ExternalLink`, `ChevronRight`, `Filter` and `AlertTriangle` are imported but never referenced.

## 8. Related pages

- [Incidents (Triage & Response)](./07-incident-triage.md) — the page that produces archive entries and the destination after `Reopen Incident`.
- [Communications](./09-communications.md) — stakeholder messaging for incidents, reachable from Inventory bulk actions rather than from here.
- [Inventory](./02-inventory.md) — the archive's host table joins live inventory records, so a re-import changes what a reopened archive shows.
- The Reports page in this folder — estate-level reporting, as opposed to this per-incident record.
