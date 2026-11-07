# Incidents (Triage & Response)

> **At a glance:** The live SOC workbench for one active incident at a time — blast radius, per-host remediation state, stakeholder outreach, and the PDF/Word/Markdown report that proves what was done.

| | |
|---|---|
| View id | `incident-triage` |
| Sidebar label | `Incidents` |
| Core component | `src/components/views/IncidentTriageView.tsx` |
| Primary API | `GET /api/incidents` (plus `GET /api/incidents/:id/impact`, `PUT /api/incidents/:id/hosts/:serverId`) |
| Primary users | SOC analysts, incident responders, service managers |
| Depends on | Inventory records (`server.host`, `vm`, `primary_ip_address`, `business_unit`, `manager`, `email`), the incident record and its `host_details` map, `incidentReportGenerator.ts` (jsPDF + docx) |

## 1. What this page is for

This is the single-incident command centre. It loads every incident but keeps only those not yet `Closed` or `Archived`, and renders one selected incident in one of two modes: a **Metrics Dashboard** or an **Action Table**. There is no incident list page and no per-incident routing — the ribbon of reference pills is the only switcher.

The dashboard aggregates the incident's affected servers into remediation counts (patched, notified, documented, isolated) and splits them by business unit, product and responsible manager. The table is the editing surface: per-host triage status, a one-click "contacted" action, and a notes modal holding engineer, patching status, patching date, ticket number and free text.

Reports are built entirely in the browser from the state already on screen. Nothing is queued server-side, and closing an incident here is what moves it out of this page and into the archive.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Open a new incident from an alert | `New Incident` → fill the form → `Create & Launch Triage` |
| Pull affected hosts from a scanner export | `Upload Hosts` (paste or `.txt`/`.csv`), or the hostnames textarea in the create form → `Upload File` |
| See how much is left | Dashboard → `Patched Systems` gauge and the `Operational Incident Statistics` panel |
| Change one host's triage state | Switch to Action Table (list icon) → the `Triage Status` dropdown on the row |
| Record that a manager was contacted | Phone icon in the `Call / Contact` column |
| Log engineer, patch date and ticket | Document icon in `Notes & Details` → `Save Notes & Update Host` |
| Bulk-notify the whole blast radius | Dashboard → `Notify All` in the `Notes & Communication` panel |
| Find who is behind | Dashboard → `Responsible Managers Investigating & Coordinating Remediation` → click a manager card |
| Prove the work | `Create Report` → PDF / Word / Markdown |
| Retire the incident | `Close & Archive` → `Confirm Close & Archive` |
| Remove a host added in error | Click the hostname → `Remove Host from Incident Triage` → `Confirm Remove` |

## 3. Screen walkthrough

**Header bar.** Title `INCIDENT TRIAGE & REMEDIATION COMMAND CENTER`, a `Metrics & Triage` badge and a one-line subtitle. On the right, two icon-only buttons with tooltips and aria-labels — `Metrics Dashboard` (bar-chart icon) and `Action Table` (list icon). Neither has a text label; the selected one is filled blue.

**Incident ribbon.** One pill per active incident showing a status dot, the `incident_reference` in bold and the title truncated to roughly 170 px. The dot is rose only for `Critical` and amber for everything else, so High, Medium and Low are visually identical. With no active incidents the ribbon reads `All incidents have been archived and closed.`

**Action buttons**, to the right of the ribbon: `Upload Hosts`, `Create Report` (with a chevron; the label becomes `Generating...` during a Word or PDF export), `Close & Archive`, and always-visible `New Incident`. The first three only render when an incident is selected. The `Create Report` menu is headed `Export Incident Report` and lists `PDF Document (.pdf)`, `Word Document (.docx)` and `Markdown Report (.md)` with one-line descriptions.

**Archive banner.** After a successful closure a green banner appears with `Incident <ref> has been resolved, closed, and moved to the Archive Incident section in navigation.`, an `Open Archive Incident →` button and a dismiss `X`.

**Empty state.** With no active incident the page shows `No Active Incidents in Triage` plus `Open Archive Incident` and `Create New Incident`.

**Dashboard mode, in order.** First a full-width row: the `Patched Systems` gauge card (patched count over total, percentage badge, "N pending remediation", and a `Filter table →` / `Show all` affordance that toggles the Patched filter), then the `Operational Incident Statistics` panel with six clickable rows — `Impacted Assets in Scope`, `Stakeholder Outreach`, `Notes & Ticket Tracking`, `Quarantine & Containment`, `Impacted Business Units`, `Products & Stakeholders`. The panel shows a `FILTERED VIEW` badge and `Reset Filters` whenever a filter is active. Below the rows sit `Quick Filter` pills for `Patching`, `To be contacted`, `Contacted`, `Isolated` and `Not Affected`; a pill is hidden when its count is zero, except `To be contacted`.

Next, three panels side by side: `Linked Business Units` (scrollable, per-unit patched percentage bar, click to filter), `Notes & Communication` (with a `Notify All` link and four clickable rows: `Documented Notes`, `Pending Notes/Log`, `Stakeholder Notified`, `Awaiting Outreach`), and `Products & Roles` (product chips are clickable filters; function chips are static labels). Last is `Responsible Managers Investigating & Coordinating Remediation`, a grid of manager cards showing server count, email, patched ratio and either `Notified` or `Outreach Pending`.

**Action table mode.** Heading `Affected Asset Triage & Remediation Tracking (X of Y)`, a search input (`Filter hosts, IPs, engineers...`), `Clear Filters` when any filter is set, `Upload Hosts`, and `CSV`. Active filters appear as removable-labelled chips. Columns are `Host Identifier`, `VM`, `Primary IP`, `Business Unit`, `Product & Role`, `Manager`, `Triage Status`, `Call / Contact`, `Notes & Details`. Patched rows are tinted emerald with a tick. Rows have no pagination and no sort; the body shows `No affected systems match current criteria.` when empty. Hovering a row reveals a trash icon that opens the removal confirmation.

**Modals.** *Notes* — `Investigation & Remediation Notes: <host>` with assigned engineer, patching status select, patching date, ticket number, a "notified" checkbox and a notes textarea; buttons `Cancel` and `Save Notes & Update Host`. *Close & Archive* — engineer input pre-filled `SecOps Lead`, closure summary textarea, `Confirm Close & Archive`. *Create* — reference pre-filled as `INC-<year>-<4 digits>`, title, severity, IOC/CVE, description, hostnames textarea and `Upload File` (`.txt`, `.csv`), `Create & Launch Triage`. *Upload / Add Data* — paste area, file upload, `Correlate & Add Data`, then a matched/unmatched result block. *Host Management* — read-only host facts plus `View Full Server Profile` and `Remove Host from Incident Triage`. *Remove* — `Confirm Remove`.

**Keyboard.** No shortcuts belong to this view. The application-level `/` and `Ctrl`/`Cmd`+`K` open the global search overlay (`src/App.tsx`).

**Loading.** There is no spinner or skeleton, so a slow `GET /api/incidents` shows the empty state first.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Incident ribbon pill | `incident_reference`, `incident_title`, `severity` | `GET /api/incidents`; dot rose only for `Critical` |
| Patched Systems gauge | `host_details[id].status` or `patching_status` | `Patched`/`Patch` triage status **or** `Patched`/`Validated` patching status (shared rule) |
| Impacted Assets in Scope | `impact.affected_servers.length` | Server-computed from `affected_server_ids` |
| Stakeholder Outreach | `host_details[id].communicated` or `status === 'Contacted'` | Either signal counts as notified |
| Notes & Ticket Tracking | `notes`, `patch_engineer`, `ticket_number` | Any one non-empty counts as documented |
| Quarantine & Containment | `status` counts | Isolated and Patching |
| Linked Business Units | `server.business_unit` | Falls back to `Unassigned` |
| Products & Roles | `server.product`, `server.function` | Fallbacks `Unassigned Product`, `General Server` |
| Manager cards | `server.manager`, `server.email` | Fallback `Unassigned Manager`, `No email recorded` |
| Host / VM / Primary IP | `server.host`, `server.vm`, `server.primary_ip_address` | Read-only in the table |
| Triage Status dropdown | `host_details[id].status` | Defaults to `To be contacted` |
| Call / Contact date | `host_details[id].communication_date` | `YYYY-MM-DD`, set by the phone icon |
| Engineer under status | `host_details[id].patch_engineer` | Truncated to 120 px |
| Ticket under notes icon | `host_details[id].ticket_number` | Amber icon when any notes data exists |
| CSV export | `impact.affected_servers` + `host_details` | 16 columns, current incident only |

## 5. Common workflows

1. **Create an incident and attach hosts.** Click `New Incident`; the reference is pre-generated (edit it if the SOC numbering differs), enter title, severity, IOC/CVE and description; paste hostnames, IPs or VM IDs into the textarea or load a `.txt`/`.csv`. Submit `Create & Launch Triage`. The client posts `POST /api/incidents` with `status: 'Investigating'`, then reloads incidents, selects the new one and fetches its impact. Unmatched identifiers are silently dropped at creation time — the create path has no unmatched report.
2. **Attach more hosts later.** With an incident selected click `Upload Hosts`, paste or upload identifiers and press `Correlate & Add Data`. The result panel reports `Successfully correlated & added N server(s) (duplicates filtered out).` and lists any `Unmatched Identifiers (N)`. The list is then re-fetched, so the gauge and counts move immediately.
3. **Triage host statuses.** Switch to Action Table. Use the `Triage Status` dropdown per row — the change is applied locally first and then persisted with `PUT /api/incidents/:id/hosts/:serverId`. Use the phone icon to record a contact (sets status `Contacted`, `communicated: true` and today's date in one action). Use the document icon to open the notes modal and save engineer, patching status, date, ticket and free text together.
4. **Run communications.** There is no in-page button that opens the Communications view in this build. Practically: `Notify All` on the dashboard (marks every host notified and promotes `To be contacted` to `Patching`), or the per-row phone icon, then copy the manager list from the dashboard and draft the message in the Communications page (see [Communications](./09-communications.md)).
5. **Close, archive and report.** `Create Report` → choose PDF, Word or Markdown for a point-in-time artefact. Then `Close & Archive`, enter the sign-off lead and closure summary, and confirm. The incident is set to `Archived`, the closure note is appended to `description`, the banner appears, and the next active incident is selected automatically. Reopening is done from the archive page, not here.

## 6. Gotchas and guardrails

- Only `Closed` and `Archived` incidents leave this page. `Open`, `Investigating`, `Contained` and `Remediated` all stay in the ribbon; there is no status filter.
- `Close & Archive` writes `status: 'Archived'` directly — it does not pass through `Closed`. The archive page accepts both.
- Severity only affects the ribbon dot and the report header. It does not gate any action, and `Critical` and `High` render identically.
- Triage status and patching status are independent fields. A host can be `Patched` in the notes modal while its triage status still reads `To be contacted`; both are now accepted as patched, consistently with the archive and reports.
- `Notify All` issues one parallel `PUT` per affected host. On a large incident the UI updates first and failures are only logged, so reload after a bulk action to confirm persistence.
- Status changes are optimistic. If the `PUT` fails the console logs the error but the UI keeps the new value until reload.
- Every call is attributed to `SecOps` server-side. `closed_by` is the only user-identifying field the operator supplies.
- `Add to Incident` in the server drawer does not attach a host to an existing incident. It only stashes the server id in `targetedServerIds`, which is consumed when a *new* incident is created.
- The `targetedServerIds` array is never cleared. It survives navigation, so a later `New Incident` can inherit a stale selection from an unrelated inventory action.
- Removing a host deletes its `host_details` entry; the notes, ticket and engineer recorded for it are lost with no confirmation beyond the modal.
- Documents exported before closure say `Investigating`; exports are snapshots and are not regenerated when the record changes.
- The CSV export ignores the on-screen filters and always writes every affected server.
- No role checks exist anywhere; anyone who can open the app can archive an incident.

## 7. For developers

**Component structure and props.** One default-exported function component (`IncidentTriageView`) plus inline JSX for six modals; no child components, no context, no router. Props:

| Prop | Type | What it does |
|---|---|---|
| `onSelectServer` | `(id: string) => void` | Opens the server drawer. Called from the Host Management modal's `View Full Server Profile`. |
| `initialServerIds` | `string[] \| undefined` | Used only as `affected_server_ids` when creating an incident. It does not pre-select, filter or pre-fill anything else. |
| `onNavigateToArchive` | `() => void` | Renders the `Open Archive Incident` buttons in the banner and empty state. |
| `onRefreshIncidents` | `() => void` | Fired after close/archive so `App` can refresh sidebar counts. |

**State, effects and API triggers.** One `useEffect` runs once and calls `api.getIncidents()`, auto-selecting the first active incident, which in turn calls `api.getIncidentImpact(id)`.

| State | Triggers |
|---|---|
| `incidents`, `selectedIncidentId`, `impact` | `GET /api/incidents`, `GET /api/incidents/:id/impact` |
| `hostDetails` (map keyed by server id) | Seeded from `incident.host_details`; replaced by demo values when that map is empty; every edit writes through `PUT .../hosts/:serverId` |
| `viewMode` (`dashboard` \| `table`) | Client-only, defaults to `dashboard` |
| `editingServer` + six note-form fields | `openNotesModal`, then `PUT` on save |
| `showCreateModal` + form fields | `POST /api/incidents` |
| `showAddServersModal`, `bulkInput`, `addResults` | `POST /api/incidents/:id/servers`, then impact and incident reloads |
| `hostActionModal`, `removingServer`, `isRemoving` | `DELETE /api/incidents/:id/servers/:serverId` |
| `showCloseModal`, `closureNotes`, `closingEngineer` | `PUT /api/incidents/:id` with the archive payload |
| Six filter values + `searchTable` | Client-only; all cleared by `clearAllFilters()` on every incident switch |
| `exportDropdownOpen`, `isExporting`, `archiveNotification` | Client-only |

**API calls and response shapes.**

| Call | Body / params | Response |
|---|---|---|
| `GET /api/incidents` | none — no paging, filtering or search | `Incident[]` including `host_details` |
| `GET /api/incidents/:id/impact` | none | `IncidentImpact`: `affected_servers: ServerRecord[]`, `total_affected_servers`, unique BU/sub-BU/email/team/datacenter/hypervisor/network arrays, `correlation_leads[]` |
| `POST /api/incidents` | `incident_reference`, `incident_title`, `severity`, `ioc_or_vulnerability`, `description`, `status`, `affected_server_ids`, `raw_input` | `201` with the created `Incident`; title is the only required field |
| `PUT /api/incidents/:id` | any `Partial<Incident>`; close sends `status`, `closed_at`, `closed_by`, `description` | Updated `Incident` |
| `POST /api/incidents/:id/servers` | `{ raw_input?: string, server_ids?: string[] }` | `{ incident, total_affected, matched_count, unmatched_count, matched_servers, unmatched_entries }` |
| `PUT /api/incidents/:id/hosts/:serverId` | any subset of `IncidentHostDetail` | The stored detail object |
| `DELETE /api/incidents/:id/servers/:serverId` | none | `{ success, remaining }` |

Matching is case-insensitive equality on `host`, `vm`, `primary_ip_address` and `dns_name` (not substring); tokens are split on whitespace, commas and semicolons. `:id` accepts either the UUID or an `incident_reference` on the incident, servers and host-detail routes, but `GET /api/incidents/:id/impact` resolves the UUID only.

**Cross-view navigation.** `onSelectServer(server.id)` → `App` sets `selectedServerId`, opening `ServerDetailDrawer`. `onNavigateToArchive()` → `setCurrentView('archived-incidents')`. `onRefreshIncidents()` → `loadDashboardData()` in `App`, which re-reads stats, audit logs and incidents and updates the sidebar badges. No URL or query parameter changes; view state is a `useState` string.

**Report export plumbing.** `getReportPayload()` calls `buildIncidentReportData()` in `services/incidentAnalysis.ts`, which wraps the shared `analyseIncident()` result in the `ReportData` shape used by all three generators. `exportIncidentReport(payload, format)` in `services/incidentReportExport.ts` performs the download, so the archive page and this page share one implementation.
- *Markdown* — `generateMarkdownReport()` returns a string synchronously; a `Blob` is downloaded as `incident_<reference>_report.md`. Sections: metadata, executive metrics with ASCII bars, BU, product, managers, per-host inventory.
- *Word* — `generateWordDocx()` renders five chart PNGs (`incidentCharts.ts`) and returns a `Packer.toBlob` promise, downloaded as `incident_<reference>_report.docx`.
- *PDF* — `generatePdfReport()` builds an A4 portrait `jsPDF` document with the same charts embedded; the blob is downloaded as `incident_<reference>_report.pdf`.
- The same `patchedCount`, `communicatedCount` and `hasNotesCount` feed the dashboard and the report, so the gauge and the exported PDF cannot disagree.
- The CSV button writes 16 columns from `impact.affected_servers` through the shared `downloadCsv()` helper, producing `incident_<reference>_triage.csv`.

**Extension points / known rough edges.**
- The incident metrics and breakdowns are centralised in `services/incidentAnalysis.ts`; extend that module rather than recomputing values in a view.
- There is no in-page hand-off to Communications; the page is still reachable only from Inventory's bulk `Contact List` action.
- When `incident.host_details` is empty the component fabricates demo statuses (first host `Patching`/`Patched`/`Sarah Jenkins`, second `Isolated`, rest `To be contacted`). These values are never persisted, so a reload re-seeds or clears them.
- There is no denormalised cache: every host edit triggers a `PUT` and no re-fetch, so two analysts on the same incident will overwrite each other last-write-wins.
- No validation on status transitions, dates or ticket formats; `patching_date` is whatever the date input yields.

## 8. Related pages

- [Archive Incident](./08-archived-incidents.md) — where this page's `Close & Archive` output lands, and the only place to reopen.
- [Communications](./09-communications.md) — the stakeholder message composer that this page's `onOpenCommunications` prop was meant to invoke.
- [Inventory](./02-inventory.md) — the source of the bulk selections that arrive here as `initialServerIds`, and the place to correct the manager and business-unit fields the dashboard aggregates.
