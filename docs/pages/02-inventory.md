# Inventory

> **At a glance:** The server-level working table — a filterable, sortable, paginated view of every `ServerRecord` with column filtering, bulk copy/export and hand-offs to incidents and communications.

| | |
|---|---|
| View id | `inventory` |
| Sidebar label | `Inventory` |
| Core component | `src/components/views/InventoryView.tsx` |
| Primary API | `GET /api/servers` |
| Primary users | Infrastructure owners, SOC analysts, service managers doing per-host lookups |
| Depends on | `GET /api/servers` (twice: 1,000-row option load plus the paged table), `ServerDetailDrawer`, `App` inventory filter state |

## 1. What this page is for

Inventory is the authoritative list of hosts. It is where you answer per-host questions — who owns this VM, which business unit and product it belongs to, what its IP is, whether secure boot is on — and where bulk actions start: copy hostnames, copy IPs, export a CSV, raise an incident for the selection, or build a contact list.

Every filter is server-side and every filter is shareable across views: other pages navigate here with a filter dictionary (for example `business_unit=Retail`), and this page renders that dictionary as chips you can remove. Sorting, paging and column visibility are local to the page and are not persisted anywhere.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Find one host by name, IP, owner or DNS | "Filter table..." input (sends `q`) |
| Narrow to one business unit, product or environment | Click that column header → "Filter by …" → pick a value |
| Sort by any visible column | Column header → "Sort Order" → "Asc (A→Z)" or "Desc (Z→A)" |
| Add or hide columns | "Columns" → tick/untick in "Toggle Columns" |
| Remove a filter | The `✕` on its chip, "Clear All", or "Reset Filters (n)" |
| Export a CSV | "Export CSV" |
| Copy hostnames or IPs of a selection | Tick rows → "Copy Hosts" / "Copy IPs" |
| Raise an incident for selected servers | Tick rows → "Incident Impact" |
| Build a contact/communications list | Tick rows → "Contact List" |
| Inspect a single server | Click the row (opens the detail drawer) |

## 3. Screen walkthrough

**Action header.** Left: a server icon, the title "SERVER INFRASTRUCTURE INVENTORY" and the live count "Showing X of Y indexed hosts" (X is the current page size, Y the filtered total). Right, in order: a search box with placeholder "Filter table..."; when filters are active a red "Reset Filters (n)" button; a "Columns" button opening the "Toggle Columns" checklist; and "Export CSV".

**Active filter chips.** A blue strip appears only when filters exist: "Active Filters:" followed by one chip per key, rendered as `capitalised key: value` with a remove `✕`, plus a "Clear All" link. Keys such as `ownership` or `secure_boot` display with underscores replaced by spaces.

**Bulk action bar.** Appears when at least one row is ticked: a pulsing dot, "N servers selected", then "Copy Hosts", "Copy IPs", "Incident Impact" (rose), "Contact List" (purple) and "Deselect". Copy buttons swap their icon for a green tick for two seconds.

**The table.** A header checkbox selects or clears the current page, then one header per visible column: VM Identifier, Env, Business Unit, Sub-BU, Customer, Product, Function, Support Team, Manager, Email, Primary IP, Datacenter, Host, Power State, Secure Boot, DNS Name, Annotation. Twelve are visible by default; Host, Power State, Secure Boot, DNS Name and Annotation start hidden.

**Column header dropdown.** Each header is a button that opens a popover titled "<Label> Controls" with a close `✕`, a "Sort Order" pair (Asc/Desc), and "Filter by <Label>". If the column has more than five distinct values a small "Search <label>..." box appears. The option list starts with "(Show All)" carrying the current filtered total, then up to all distinct values with their counts, sorted by count descending then label. Picking a value closes the popover, applies the filter immediately and resets to page 1. Escape or a click outside also closes it.

**Cells and states.** VMs show `vm` (falling back to `host`). Empty business unit, product and email cells show `—`, `Unassigned` (manager, amber) or `Missing` (email, amber). Power state is a green/rose pill. Secure Boot renders a shield with `TRUE`, `FALSE` or plain `UNKNOWN`. While loading, a single row reads "Loading server infrastructure inventory..."; with no results, "No servers match the selected criteria."

**Pagination footer.** "Rows per page:" select (10, 25, 50, 100; default 25), then "Page X of Y" and "Prev"/"Next" buttons that disable at the ends. Changing page size resets to page 1.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| VM Identifier | `vm` | Falls back to `host` when empty |
| Env | `environment` | Indigo pill |
| Business Unit | `business_unit` | Purple text |
| Sub-BU | `sub_business_unit` | — when empty |
| Customer | `customer` | — when empty |
| Product | `product` | Blue text |
| Function | `function` | — when empty |
| Support Team | `support_team` | Monospace |
| Manager | `manager` | Amber "Unassigned" when empty |
| Email | `email` | Amber "Missing" when empty |
| Primary IP | `primary_ip_address` | Cyan monospace |
| Datacenter | `datacenter` | — when empty |
| Host | `host` | Hidden by default |
| Power State | `power_state` | `poweredOn` green, anything else rose |
| Secure Boot | `efi_secure_boot` | `true`→TRUE, `false`→FALSE, `null`→UNKNOWN; filter key is `secure_boot` |
| DNS Name | `dns_name` | Hidden by default |
| Annotation | `annotation` | Hidden by default; no matching API filter |
| Showing X of Y | `items.length` and `total` | From the paged response |
| Column option counts | `allServers` from `GET /api/servers?limit=1000` | Counts are of the first 1,000 records, not of the filtered set |
| CSV columns | 16 fixed fields | VM, Env, BU, Sub-BU, Customer, Product, Function, Support Team, Manager, Email, IP, Datacenter, Host, Power State, Secure Boot, DNS |

## 5. Common workflows

**1. Triage one host.**
1. Type part of the hostname, VM name, DNS name or IP into "Filter table...".
2. Confirm the row count in "Showing X of Y indexed hosts".
3. Click the row to open the detail drawer; use its tabs for ownership, infrastructure, security, relationships and audit history.

**2. Build a filtered list and export it.**
1. Open the Business Unit header dropdown and pick a unit.
2. Add a second filter from another header (for example Product); each column holds one value at a time.
3. Optionally hide columns you do not need with "Columns".
4. Tick the rows you want and click "Export CSV". The file is named `csm_server_inventory_YYYY-MM-DD.csv`.

**3. Raise an incident from a selection.**
1. Filter down to the affected population.
2. Tick rows (the header checkbox selects the whole page).
3. Click "Incident Impact" — this hands the selected IDs to the incidents view.
4. Alternatively click "Contact List" to prepare owner communications for the same IDs.

**4. Clear inherited filters.**
1. Look for the blue "Active Filters:" strip; if it is present, filters arrived from another page or from earlier in the session.
2. Remove individual chips with `✕`, or click "Clear All" / "Reset Filters (n)", which also clears the search box and resets paging.

## 6. Gotchas and guardrails

- Viewers can read and export inventory, but the bulk **Incident Impact** and **Contact List** actions are disabled; viewers do not have access to the Incidents pages.
- Filters persist when you leave and return. Clicking the sidebar "Inventory" or the navbar assets pill passes no filter dictionary, and `App` only replaces filters when one is supplied — so the previous chips are still applied.
- A filter dictionary replaces the previous one wholesale; it never merges. Navigating in from Products with `product=X` drops a business unit filter you had set by hand.
- Selecting values is single-select per column even though `/api/servers` accepts comma-separated lists. Multi-value filters can only arrive by URL or by another view.
- The selection set spans pages, but "Copy Hosts", "Copy IPs" and CSV only cover rows on the current page. "Incident Impact" and "Contact List" send all selected IDs, including off-page ones.
- "Export CSV" with nothing selected exports the current page, not the whole filtered set. Annotation and the VM/DNS duplicates are not all carried; the CSV has a fixed 16-column header list regardless of visible columns.
- Column option counts come from a separate 1,000-row fetch and are not affected by active filters, so a count can differ from what the table shows.
- The Secure Boot column is labelled from `efi_secure_boot` but filters with the key `secure_boot`; the chip therefore reads "secure boot". Values are `TRUE`, `FALSE` and `UNKNOWN`.
- The `business_unit` filter also matches `sub_business_unit` values, and the `sub_business_unit` filter also matches `business_unit` values. A filter can therefore return more than its label implies.
- `annotation` has no handler in `/api/servers`, so that column filter is sent and silently ignored; `host` is an exact match, unlike the free-text `q` search.
- Filter keys inherited from Overview — `ownership=missing` and `email=missing` — do not behave usefully: the first is unknown to the API and the second is an equality match that finds nothing.
- Searching is debounced by 350 ms, so typing a hostname sends one request rather than one per keystroke. Responses are not cancelled, so a slow earlier request can still land after a newer one.
- No state is reflected in the URL, so a filtered view cannot be bookmarked or shared as a link.
- Sorting is a lowercase string compare server-side; booleans and `null` secure-boot values sort unpredictably.

## 7. For developers

**Component structure and props.** One file, one exported component; the only structural helper is the `renderColumnHeader` render function, which draws a header cell plus its popover.

- `initialFilters?: Record<string, string>` — external filter dictionary; default `{}`.
- `onFiltersChange?: (filters) => void` — called on every add, remove and clear so `App` can retain the filters across navigation.
- `onClearFilters?: () => void` — called by "Clear All" and "Reset Filters".
- `onSelectServer: (id: string) => void` — row click; `App` opens `ServerDetailDrawer`.
- `onOpenCommunicationsWithServers: (ids: string[]) => void` — bulk "Contact List".
- `onOpenIncidentWithServers: (ids: string[]) => void` — bulk "Incident Impact".

**Local state and side effects.** State: `servers`, `total`, `loading`, `page` (1), `pageSize` (25), `searchQuery`, `selectedIds` (a `Set`), `copiedAction`, `filters`, `showColumnPicker`, `sortBy` (default `'vm'`), `sortOrder` (`'asc'`), `activeHeaderDropdown`, `columnSearchQuery`, `allServers`, and `filterOptions` — the last of which is populated but never read, since option counts are derived from `allServers`.

Four effects: (1) on mount, `api.getServers({ limit: 1000 })` fills `allServers`; (2) on `initialFilters`, copy into `filters`, force the Product column visible when `product` is present, reset to page 1; (3) on `[filters, searchQuery, sortBy, sortOrder, page, pageSize]`, refetch the page; (4) document-level `mousedown` and `keydown` listeners that close the header dropdown, the latter on Escape.

**API calls with query parameters and response shape.**

`GET /api/servers` with the filter dictionary spread in, plus `q`, `sort_by`, `sort_order`, `page`, `limit`. Empty strings and `undefined` are dropped by `api.getServers`. Supported keys: `business_unit`, `sub_business_unit`, `customer`, `manager`, `support_team`, `environment`, `power_state`, `datacenter`, `product`, `function`, `secure_boot`, `network`, `host`, `vm`, `primary_ip_address`, `email`, `dns_name`, `q`, `sort_by`, `sort_order`, `page`, `limit`. The attribute filters accept comma-separated lists and match case-insensitively after `cleanString`; `secure_boot` is an enum (`TRUE`/`FALSE`/`UNKNOWN`), `network` is a substring match over `network_1`–`network_3`, and `host` must match exactly. Response: `{ items: ServerRecord[], total, page, limit, total_pages }`.

**Cross-view navigation it performs.** It does not call `onNavigate` itself; it raises callbacks that `App` converts into view changes:

| Trigger | Callback | Result |
|---|---|---|
| Row click | `onSelectServer(id)` | Drawer for that server |
| "Incident Impact" | `onOpenIncidentWithServers([...selectedIds])` | `incident-triage` with `targetedServerIds` |
| "Contact List" | `onOpenCommunicationsWithServers([...selectedIds])` | `communications` with `targetedServerIds` |

Filters it receives from elsewhere, and the exact keys: Overview sends `power_state` (`poweredOn`/`poweredOff`), `secure_boot` (`TRUE`/`FALSE`), `business_unit`, `product`, `environment`, `ownership`, `email`; Business Units sends `business_unit`, `manager`, `network`; Products sends `product`. `App` wires the same `onFilterInventory` callback into Infrastructure Map as well, but the keys that view sends are outside this page's scope.

**Extension points and known rough edges.** Synchronise filter and page state to the URL for shareable links; make CSV export operate on the full filtered set (or say "page" in the UI); reset `selectedIds` when filters change; carry off-page selections into copy and CSV by fetching by ID; either implement an `annotation` filter server-side or remove it from the column list; and add a placeholder when `allServers` is capped at 1,000.

## 8. Related pages

- [Overview](./01-overview.md) — the main source of pre-applied filters (`business_unit`, `product`, `environment`, `power_state`, `secure_boot`) and of the counts this table drills into.
- [Business Units](./03-business-units.md) — sends `business_unit`, `manager` and `network` filters here from its detail panels.
- [Products](./04-products.md) — sends `product` filters here and can send a whole product's server IDs to incident triage.
