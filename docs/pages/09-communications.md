# Communications

> **At a glance:** Turns the managers behind a set of servers into a deduplicated, copy-ready distribution list, with five standard message templates and a live preview of the email body for the selected stakeholder.

| | |
|---|---|
| View id | not routed — `currentView === 'communications'`, no sidebar entry (opened from the Inventory bulk action `Contact List`) |
| Sidebar label | — |
| Core component | `src/components/views/CommunicationsView.tsx` |
| Primary API | `POST /api/communications/preview` |
| Primary users | Incident responders, service managers, ownership and asset-hygiene teams |
| Depends on | Inventory `manager` / `email` / `business_unit` / `support_team` fields; the server-side template library; no contact or mailing tables exist |

## 1. What this page is for

The page converts a technical asset list into a stakeholder list. It sends a set of server ids to the server, which deduplicates the responsible managers by email, counts how many are contactable, and renders one of five message templates with merge fields filled from the stakeholder currently selected in the directory.

The directory is **single-select**: one owner is previewed and emailed at a time, so the merged body can name that owner and list only their linked servers. IPv4 addresses inside the rendered body are partially masked (`152.114.2.55` becomes `***.***.2.55`) before the text reaches the clipboard or the mail client.

It is a composition and copy surface, not a mail client. There is no send action, no delivery log and no record written back to the incident. The operator copies addresses and body text into their own mail client, or uses the `mailto:` hand-off.

Because it is not in the sidebar, the practical entry point is a selection in Inventory — select rows, then press `Contact List`. Reaching it any other way shows the whole estate rather than a scoped list.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Message the owners of a set of servers | Inventory → tick rows → `Contact List` in the bulk bar |
| Message the whole estate | There is no explicit control; opening the view without ids falls back to all servers |
| Pick a message type | Template tabs `1. Security Incident` … `4. Ownership Hygiene` |
| Set reference, subject, severity and due date | The four-field variables bar above the preview |
| Copy every valid address | `Copy All` in the `Stakeholder Directory` header |
| Copy only the selected owner's address | `Copy Selected` in the `Stakeholder Directory` header |
| Preview a different owner | Click that owner's card (or radio) in the directory |
| Copy the finished email | `Copy Formatted Email` in the templates panel |
| Open a pre-filled mail client for the selected owner | `Open in Email Client` in the header |
| Export the contact list | `Export CSV` in the header |
| Spot managers with no email | The amber `No email in inventory` cards and the `Missing Email Addresses` metric |

## 3. Screen walkthrough

**Header.** `INCIDENT COMMUNICATIONS & STAKEHOLDER MESSAGING` with a one-line subtitle. Once data has loaded, two buttons appear on the right: `Export CSV` (neutral) and `Open in Email Client` (blue). `Open in Email Client` is disabled when the selected owner has no email address. Both are absent while the first request is in flight.

**Metrics row.** Three cards: `Unique Stakeholders`, `Valid Email Addresses` (emerald) and `Missing Email Addresses` (amber). They only render after the first successful load.

**Stakeholder Directory (left, five of twelve columns).** Heading `Stakeholder Directory (N)` where N is the deduplicated contact count. The header carries `Copy All` (every valid address) and `Copy Selected` (just the selected owner's address), each switching to `Copied!` for two seconds; `Copy Selected` is disabled when the selected owner has no email. Cards are scrollable within roughly 500 px and show a radio button, the manager name, the business unit in purple, an `N svr` badge, and a bottom line with either the email address or an amber `No email in inventory` warning plus `Team: <support team>`. Clicking anywhere on a card selects that owner and immediately reloads the preview; selecting another card replaces the previous choice, so at most one radio is ever checked. Selected cards are outlined blue; missing-email cards are amber but remain selectable for previewing. On the first successful load the first contact is selected automatically. An empty directory renders an empty scroll area with `(0)` — there is no empty-state message.

**Operational Message Templates (right, seven of twelve columns).** Heading plus a `Copy Formatted Email` button (copy icon, swapping to a green tick briefly). A blue `Previewing <manager> · <email>` banner below the heading names the owner the body is rendered for and shows how many linked servers they have. Below it, four tabs: `1. Security Incident`, `2. Vulnerability Notice`, `3. Patching Request` and `4. Ownership Hygiene`; the active one is solid blue. Next is the variables bar: `Reference`, `Title / Subject`, `Severity` (Critical/High/Medium/Low) and `Target Due Date` (date input). Last is the preview: `Subject Line:` in blue, then `Message Body Preview:` in a monospaced block with the merged body, scrollable to roughly 288 px. The body's `Affected Systems` / `Hosts` section lists only the selected owner's servers, each line as `VM: <vm> | IP: ***.***.<third>.<fourth>` (the host name is not included); a small `IPs masked as ***.***.x.x` note sits beside the body label.

**Loading and empty states.** There is no loading flag or spinner. Before the first response the directory shows `(0)`, the metrics row and template preview are hidden, and the header actions are absent. A failed first request leaves the page in that empty state and only logs to the console; later failures leave the last successful data on screen.

**Keyboard.** No shortcuts are registered by this view. The application-level `/` and `Ctrl`/`Cmd`+`K` search overlay still applies.

**Not present.** No send button, no scheduling, no template editor, no history, no pagination and no filter of the contact list. The directory is single-select only; there is no multi-select mode and no combined preview or per-owner bulk body generation.

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
| `Subject Line:` | `preview.subject` | Rendered server-side from the chosen template for the selected contact |
| `Previewing` banner | `preview_contact_id` plus the matching `contacts[]` entry | Names the owner and email the preview belongs to, and that owner's `server_count` |
| `Message Body Preview:` | `preview.body` | Merged for the **selected** contact, including that contact's linked servers |
| IP lines in the body | `contacts[].servers[].ip` | Every IPv4 is masked server-side to `***.***.<third>.<fourth>` before rendering |
| CSV columns | `contacts[]` | Business Unit, Manager, Email (`MISSING` when absent), Affected Servers, Support Team |

## 5. Common workflows

1. **Scope the audience.** In Inventory, filter or search, tick the servers in scope, then press `Contact List` in the blue bulk bar. `App` stores the ids in `targetedServerIds` and switches to this view. The directory now lists only the managers behind those servers.
2. **Choose and fill the template.** Pick one of the four tabs. Edit `Reference`, `Title / Subject`, `Severity` and `Target Due Date`. Free-text edits are debounced by 400 ms, so the body updates as you pause rather than on every keystroke.
3. **Pick the recipient.** Click an owner card in the directory; exactly one stays selected (radio style). The `Previewing` banner and the body update to that owner, and the `Hosts` section lists only their linked servers with IPs masked. Use the search/filter in Inventory first if the list is long — there is no filter inside this view.
4. **Verify who is excluded.** Check `Missing Email Addresses` and the amber cards. Those managers can still be selected to inspect their preview, but `Copy Selected` and `Open in Email Client` are disabled for them; chase the data gap in Inventory first.
5. **Copy and send.** Use `Copy All` for every valid address, or select one owner and use `Copy Selected`, then `Copy Formatted Email` for the subject and body. Alternatively press `Open in Email Client`, which opens a `mailto:` link addressed **To** the selected owner (single recipient), plus the encoded subject and masked body. Repeat selection-and-copy per owner when several people need the message.
6. **Record that it was done.** There is no acknowledgement here. Return to Incidents and mark the hosts contacted — the phone icon per row, or `Notify All` on the dashboard — so the incident's outreach figures reflect reality.

## 6. Gotchas and guardrails

- **This page is not reachable from Incidents or the Archive in the current build.** No triage or archive button navigates here; the only caller of the navigation handler is Inventory's `Contact List` button.
- With no `server_ids`, the server substitutes **every** server in the estate. Opening the view cold therefore shows an organisation-wide contact list, not an incident scope.
- The preview is built for exactly one selected stakeholder, so the merged body is correct for that recipient. There is no multi-recipient preview or bulk per-owner body generation: `Copy All` collects addresses only, and sending the same body to every address would attribute one owner's servers to another. Switch selection and copy per owner.
- Free-text edits are debounced by 400 ms, and each preview request is guarded by a sequence number, so an older response cannot overwrite a newer one. Selecting a stakeholder is not debounced: each click sends an immediate preview request.
- The selected stakeholder is preserved across template and variable reloads while that contact is still in the response. If the scope changes and the contact disappears, the server's default contact (the first in the deduplicated list) is selected automatically.
- There is no send, queue, delivery log or persistence. Nothing this page produces is stored against the incident, and closing the view loses the selection and the edited variables.
- `targetedServerIds` in `App` is never cleared, so a later visit can silently reuse the previous selection — including one made for a different incident.
- Contacts come only from `server.email`; the `Contact` type (business owner, technical owner, escalation contact) exists but no table or endpoint feeds it. Emails are read-only here; corrections belong in Import/Data Sync.
- Deduplication is by lowercased email, or by manager name when the email is missing. The same manager with two spellings of an address appears twice; two different emailless managers stay separate.
- The `mailto:` hand-off addresses only the selected owner in `To`, not the whole directory. Long server lists still make a long query string, and URL-length handling differs by mail client; copying the text remains the fallback.
- IP masking is server-side and limited to plain IPv4 addresses in the rendered template body. Hostnames, IPv6 addresses and IPs shown outside the email body (for example the Inventory table) are not masked.
- Defaults (`INC-2026-0842`, the placeholder title and the 2026-11-15 due date) are demo values, not derived from the selected incident. They must be edited by hand.

## 7. For developers

**Component structure and props.** One function component, `CommunicationsView`, with two panels and no children. It takes two optional props:

| Prop | Type | What it does |
|---|---|---|
| `initialServerIds` | `string[] \| undefined` | Passed straight through as `server_ids` on every preview request. `undefined` or `[]` makes the server fall back to the entire estate. |
| `initialContactId` | `string \| undefined` | Preselects one stakeholder by contact key, used when arriving from a Business Unit manager's **Contact** button. Falls back to the server's `preview_contact_id` if the key is not present. |

There are no navigation callbacks, no `onSelectServer`, and no way for this view to send the user anywhere.

**State, effects and API triggers.**

| State | Behaviour |
|---|---|
| `data` | `CommunicationsPreview \| null` — `{ total_contacts, valid_emails, missing_emails, contacts, preview_contact_id, preview }`; the whole UI is gated on it |
| `selectedTemplate` | `'incident'` by default; changing it re-fires the effect |
| `incidentRef`, `incidentTitle`, `severity`, `targetDate` | Merge-field inputs; debounced copies are effect dependencies |
| `selectedContactId` | `string \| null`; the single selected stakeholder. Preserved across reloads when still present, otherwise replaced by the server's `preview_contact_id` or the first contact |
| `copiedAction` | Transient `'all_emails' \| 'selected_email' \| 'email_text'` for the `Copied!` label |
| `previewRequestRef` | `useRef` sequence counter; responses whose id is stale are ignored |

The single `useEffect` depends on `[selectedTemplate, debouncedIncidentRef, debouncedIncidentTitle, severity, debouncedTargetDate, initialServerIds, selectedContactId]` and calls `loadPreview()`. Text inputs use `useDebouncedValue(…, 400)`, so the body updates 400 ms after typing pauses; selecting a stakeholder triggers an immediate request.

Stakeholder cards are keyed by `contact.id`, falling back to the email address (or `no-email-<manager>`) if a response omits `id`. That fallback keeps the radio group stable against a server process that predates the `id`/`contact_id` fields instead of letting every card compare against `undefined`.

**API calls and response shapes.** Only one endpoint:

`POST /api/communications/preview`

| Request field | Type | Server behaviour |
|---|---|---|
| `server_ids` | `string[]?` | Filters inventory by id; empty/absent means all servers |
| `template_type` | `'incident' \| 'vulnerability' \| 'patching' \| 'ownership'` | Selects the template; unknown values fall back to `incident` |
| `contact_id` | `string?` | Selects the stakeholder whose preview is rendered; stale or unknown values fall back to the first contact |
| `incident_reference` | `string?` | Merged into `{{incident_reference}}`, default `INC-2026-0842` |
| `incident_title` | `string?` | Merged into `{{incident_title}}` |
| `severity` | `string?` | Merged into `{{severity}}` |
| `target_date` | `string?` | Merged into `{{target_completion_date}}`, default `2026-11-15` |

The response is `{ total_contacts, valid_emails, missing_emails, contacts, preview_contact_id, preview: { subject, body } }`. Each contact is `{ id, manager, email, missing_email, business_unit, sub_business_unit, support_team, server_count, servers[] }`, with the multi-valued fields joined into strings. `id` is the lowercased email, or `no-email-<manager>` when absent. The server deduplicates by that key, resolves the requested `contact_id` (falling back to `contactList[0]`), then renders the template against that contact, substituting `{{manager_name}}`, `{{business_unit}}`, `{{incident_reference}}`, `{{incident_title}}`, `{{severity}}`, `{{affected_server_count}}`, `{{affected_servers}}` (as `Host | VM | IP` bullet lines with the IP masked) and `{{target_completion_date}}`. The client types this with `CommunicationsPreview` from `src/services/api.ts`.

**Cross-view navigation.** None is performed by the component. Entry is `App.handleOpenCommunicationsWithServers(ids)`, which sets `targetedServerIds` and `currentView = 'communications'`; there is no return path except the sidebar. No params are appended to any URL.

**Report and file plumbing.** `Export CSV` builds the file client-side from `data.contacts` through the shared `downloadCsv()` helper (quoted cells, UTF-8 BOM) and downloads it as `stakeholder_contacts_<YYYY-MM-DD>.csv`. Copy actions use `navigator.clipboard.writeText`; `Copy All` writes every valid address, `Copy Selected` writes the one selected address, and the formatted-email copy prefixes `Subject: …` then a blank line and the masked body. `Open in Email Client` assigns `window.location.href = mailto:<selected email>?subject=…&body=…`, so the selected owner is the sole `To` recipient. Nothing here uses the incident report generator.

**Extension points / known rough edges.** Add multi-select only if per-owner rendering can be preserved (the current design deliberately trades bulk selection for a correct per-recipient body); add an entry point in the triage/archive views so the page is reachable with the incident reference, title, severity and affected ids; add a send endpoint plus a communications log if delivery needs to be evidenced; persist or clear `targetedServerIds` so scope does not leak between visits. The template library and the IPv4 masking helper (`maskIpForMessage`) live only in `server.ts`, so changing wording or masking means a code change and a redeploy.

## 8. Related pages

- [Incidents (Triage & Response)](./07-incident-triage.md) — owns the incident context this page should inherit, and the place where outreach is actually recorded.
- [Archive Incident](./08-archived-incidents.md) — post-closure reporting, for cases where stakeholders need the outcome rather than an alert.
- [Inventory](./02-inventory.md) — the only current entry point (`Contact List`) and the place to inspect which servers a selection covers.
- [Data Sync](./11-data-management.md) — where missing or misspelt manager emails are corrected before a contact list is usable.
