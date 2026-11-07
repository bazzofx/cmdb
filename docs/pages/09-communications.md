# Communications

> **At a glance:** Turns the managers behind a set of servers into a deduplicated, copy-ready distribution list, with five standard message templates and a live preview of the email body.

| | |
|---|---|
| View id | not routed — `currentView === 'communications'`, no sidebar entry (opened from the Inventory bulk action `Contact List`) |
| Sidebar label | — |
| Core component | `src/components/views/CommunicationsView.tsx` |
| Primary API | `POST /api/communications/preview` |
| Primary users | Incident responders, service managers, ownership and asset-hygiene teams |
| Depends on | Inventory `manager` / `email` / `business_unit` / `support_team` fields; the server-side template library; no contact or mailing tables exist |

## 1. What this page is for

The page converts a technical asset list into a stakeholder list. It sends a set of server ids to the server, which deduplicates the responsible managers by email, counts how many are contactable, and renders one of five message templates with merge fields filled from the first contact.

It is a composition and copy surface, not a mail client. There is no send action, no delivery log and no record written back to the incident. The operator copies addresses and body text into their own mail client, or uses the `mailto:` hand-off.

Because it is not in the sidebar, the practical entry point is a selection in Inventory — select rows, then press `Contact List`. Reaching it any other way shows the whole estate rather than a scoped list.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Message the owners of a set of servers | Inventory → tick rows → `Contact List` in the bulk bar |
| Message the whole estate | There is no explicit control; opening the view without ids falls back to all servers |
| Pick a message type | Template tabs `1. Security Incident` … `5. Ownership Hygiene` |
| Set reference, subject, severity and due date | The four-field variables bar above the preview |
| Copy every valid address | `Copy All` in the `Stakeholder Directory` header |
| Copy only ticked addresses | `Copy Selected (N)` |
| Copy the finished email | `Copy Formatted Email` in the templates panel |
| Open a pre-filled mail client | `Open in Email Client` in the header |
| Export the contact list | `Export CSV` in the header |
| Spot managers with no email | The amber `No email in inventory` cards and the `Missing Email Addresses` metric |

## 3. Screen walkthrough

**Header.** `INCIDENT COMMUNICATIONS & STAKEHOLDER MESSAGING` with a one-line subtitle. Once data has loaded, two buttons appear on the right: `Export CSV` (neutral) and `Open in Email Client` (blue). Both are absent while the first request is in flight.

**Metrics row.** Three cards: `Unique Stakeholders`, `Valid Email Addresses` (emerald) and `Missing Email Addresses` (amber). They only render after the first successful load.

**Stakeholder Directory (left, five of twelve columns).** Heading `Stakeholder Directory (N)` where N is the deduplicated contact count. The header carries `Copy All` and `Copy Selected (N)`, each switching to `Copied!` for two seconds. Cards are scrollable within roughly 500 px and show a checkbox (only when an email exists), the manager name, the business unit in purple, an `N svr` badge, and a bottom line with either the email address or an amber `No email in inventory` warning plus `Team: <support team>`. Selected cards are outlined blue; missing-email cards are amber. An empty directory renders an empty scroll area with `(0)` — there is no empty-state message.

**Operational Message Templates (right, seven of twelve columns).** Heading plus a `Copy Formatted Email` button (copy icon, swapping to a green tick briefly). Below it, five tabs: `1. Security Incident`, `2. Vulnerability Notice`, `3. Patching Request`, `4. Datacenter Maintenance`, `5. Ownership Hygiene`; the active one is solid blue. Next is the variables bar: `Reference`, `Title / Subject`, `Severity` (Critical/High/Medium/Low) and `Target Due Date` (date input). Last is the preview: `Subject Line:` in blue, then `Message Body Preview:` in a monospaced block with the merged body, scrollable to roughly 288 px.

**Loading and empty states.** A `loading` flag exists but is not rendered. Before the first response the directory shows `(0)`, the metrics row and template preview are hidden, and the header actions are absent. A failed request leaves the page in that empty state and only logs to the console.

**Keyboard.** No shortcuts are registered by this view. The application-level `/` and `Ctrl`/`Cmd`+`K` search overlay still applies.

**Not present.** No send button, no scheduling, no per-contact preview switcher, no template editor, no history, no pagination and no filter of the contact list.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| `Unique Stakeholders` | `total_contacts` | One entry per deduplicated email, plus one per emailless manager |
| `Valid Email Addresses` | `valid_emails` | Contacts where `missing_email` is false |
| `Missing Email Addresses` | `missing_emails` | Contacts with no inventory email |
| Directory card name | `contacts[].manager` | Taken from `server.manager`, fallback `Unassigned` |
| Business unit | `contacts[].business_unit` | All units for that contact, comma-joined, or `N/A` |
| `N svr` badge | `contacts[].server_count` | Number of servers behind that contact in this scope |
| Email line | `contacts[].email` | Lowercased and trimmed server-side |
| `Team:` | `contacts[].support_team` | Comma-joined distinct support teams, or `N/A` |
| `Reference` input | `incident_reference` request field | Hard-coded initial value `INC-2026-0842` |
| `Title / Subject` input | `incident_title` request field | Hard-coded initial value `Critical Infrastructure Kernel Advisory` |
| `Severity` select | `severity` request field | Defaults to `Critical` |
| `Target Due Date` | `target_date` request field | Defaults to `2026-11-15` |
| `Subject Line:` | `preview.subject` | Rendered server-side from the chosen template |
| `Message Body Preview:` | `preview.body` | Merged for the **first** contact only |
| CSV columns | `contacts[]` | Business Unit, Manager, Email (`MISSING` when absent), Affected Servers, Support Team |

## 5. Common workflows

1. **Scope the audience.** In Inventory, filter or search, tick the servers in scope, then press `Contact List` in the blue bulk bar. `App` stores the ids in `targetedServerIds` and switches to this view. The directory now lists only the managers behind those servers.
2. **Choose and fill the template.** Pick one of the five tabs. Edit `Reference`, `Title / Subject`, `Severity` and `Target Due Date`. Every change re-requests the preview, so the body updates as you type (one request per keystroke).
3. **Verify who is excluded.** Check `Missing Email Addresses` and the amber cards. These managers cannot be selected and are not in the default recipient set; chase the data gap in Inventory first.
4. **Copy and send.** Use `Copy All` for every valid address or tick a subset and use `Copy Selected (N)`, then `Copy Formatted Email` for the subject and body. Alternatively press `Open in Email Client`, which opens a `mailto:` link with the selected addresses in **BCC**, plus the encoded subject and body.
5. **Record that it was done.** There is no acknowledgement here. Return to Incidents and mark the hosts contacted — the phone icon per row, or `Notify All` on the dashboard — so the incident's outreach figures reflect reality.

## 6. Gotchas and guardrails

- **This page is not reachable from Incidents or the Archive in the current build.** The triage view declares an `onOpenCommunications` prop and `App` passes a handler, but the button that would call it does not exist. The only caller of the navigation handler is Inventory's `Contact List` button.
- With no `server_ids`, the server substitutes **every** server in the estate. Opening the view cold therefore shows an organisation-wide contact list, not an incident scope.
- The preview is built for the first contact only. All recipients share one subject and body that names one manager (`{{manager_name}}`) and one business unit. Copying the body as-is and sending it to the whole BCC list is a mis-send waiting to happen; there is no per-recipient body generation.
- The preview re-fetches on every keystroke in `Reference` and `Title / Subject`, and on every date/severity/template change. There is no debounce, no cancellation and no request-state guard, so responses can arrive out of order.
- Each response re-selects **all** valid emails by default, discarding any manual ticks from the previous fetch. Tick a subset last, immediately before copying.
- There is no send, queue, delivery log or persistence. Nothing this page produces is stored against the incident, and closing the view loses the selection and the edited variables.
- `targetedServerIds` in `App` is never cleared, so a later visit can silently reuse the previous selection — including one made for a different incident.
- Contacts come only from `server.email`; the `Contact` type (business owner, technical owner, escalation contact) exists but no table or endpoint feeds it. Emails are read-only here; corrections belong in Import/Data Sync.
- Deduplication is by lowercased email, or by manager name when the email is missing. The same manager with two spellings of an address appears twice; two different emailless managers stay separate.
- The `mailto:` hand-off uses BCC only, and long server lists make a very long query string; there is no length handling or fallback other than copying manually.
- Defaults (`INC-2026-0842`, the placeholder title and the 2026-11-15 due date) are demo values, not derived from the selected incident. They must be edited by hand.

## 7. For developers

**Component structure and props.** One function component, `CommunicationsView`, with two panels and no children. It takes a single optional prop:

| Prop | Type | What it does |
|---|---|---|
| `initialServerIds` | `string[] \| undefined` | Passed straight through as `server_ids` on every preview request. `undefined` or `[]` makes the server fall back to the entire estate. |

There are no navigation callbacks, no `onSelectServer`, and no way for this view to send the user anywhere.

**State, effects and API triggers.**

| State | Behaviour |
|---|---|
| `data` | `{ total_contacts, valid_emails, missing_emails, contacts, preview }` or `null`; the whole UI is gated on it |
| `loading` | Set around each request and never rendered |
| `selectedTemplate` | `'incident'` by default; changing it re-fires the effect |
| `incidentRef`, `incidentTitle`, `severity`, `targetDate` | Merge-field inputs; all four are effect dependencies |
| `selectedEmails` | `Set<string>`, rebuilt from `valid_emails` on every successful response |
| `copiedAction` | Transient `'all_emails' \| 'selected_emails' \| 'email_text'` for the `Copied!` label |

The single `useEffect` depends on `[selectedTemplate, incidentRef, incidentTitle, severity, targetDate, initialServerIds]` and calls `loadPreview()`. That array is also why typing in either text input triggers a request per character.

**API calls and response shapes.** Only one endpoint:

`POST /api/communications/preview`

| Request field | Type | Server behaviour |
|---|---|---|
| `server_ids` | `string[]?` | Filters inventory by id; empty/absent means all servers |
| `template_type` | `'incident' \| 'vulnerability' \| 'patching' \| 'maintenance' \| 'ownership'` | Selects the template; unknown values fall back to `incident` |
| `incident_reference` | `string?` | Merged into `{{incident_reference}}`, default `INC-2026-0842` |
| `incident_title` | `string?` | Merged into `{{incident_title}}` |
| `severity` | `string?` | Merged into `{{severity}}` |
| `target_date` | `string?` | Merged into `{{target_completion_date}}`, default `2026-11-15` |

The response is `{ total_contacts, valid_emails, missing_emails, contacts, preview: { subject, body } }`. Each contact is `{ manager, email, missing_email, business_unit, sub_business_unit, support_team, server_count, servers[] }`, with the multi-valued fields joined into strings. The server deduplicates by lowercased email (or `no-email-<manager>`), then renders the template against `contactList[0]`, substituting `{{manager_name}}`, `{{business_unit}}`, `{{incident_reference}}`, `{{incident_title}}`, `{{severity}}`, `{{affected_server_count}}`, `{{affected_servers}}` (as `Host | VM | IP` bullet lines) and `{{target_completion_date}}`. The `types/index.ts` typings are not used here — `contacts` is `any[]`.

**Cross-view navigation.** None is performed by the component. Entry is `App.handleOpenCommunicationsWithServers(ids)`, which sets `targetedServerIds` and `currentView = 'communications'`; there is no return path except the sidebar. No params are appended to any URL.

**Report and file plumbing.** `Export CSV` builds the file client-side from `data.contacts` and downloads it as `stakeholder_contacts_<YYYY-MM-DD>.csv`. Card copy actions use `navigator.clipboard.writeText`; the formatted-email copy prefixes `Subject: …` then a blank line and the body. `Open in Email Client` assigns `window.location.href = mailto:?bcc=…&subject=…&body=…`. Nothing here uses the incident report generator.

**Extension points / known rough edges.** Add a debounce or an explicit "Preview" action to stop request-per-keystroke; add a per-contact preview selector so the body is rendered per recipient; wire `onOpenCommunications` in the triage view to make the page reachable from an incident (and pass its reference, title, severity and affected ids); add a send endpoint plus a communications log if delivery needs to be evidenced; persist or clear `targetedServerIds` so scope does not leak between visits. The template library lives only in `server.ts`, so changing wording means a code change and a redeploy.

## 8. Related pages

- [Incidents (Triage & Response)](./07-incident-triage.md) — owns the incident context this page should inherit, and the place where outreach is actually recorded.
- [Archive Incident](./08-archived-incidents.md) — post-closure reporting, for cases where stakeholders need the outcome rather than an alert.
- [Inventory](./02-inventory.md) — the only current entry point (`Contact List`) and the place to inspect which servers a selection covers.
- [Data Sync](./11-data-management.md) — where missing or misspelt manager emails are corrected before a contact list is usable.
