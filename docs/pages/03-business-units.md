# Business Units

> **At a glance:** A two-level explorer that lists every business unit as a card and drills into one unit's managers, sub-units, products, datacenters, networks and allocated servers.

| | |
|---|---|
| View id | `business-units` |
| Sidebar label | `Business Units` |
| Core component | `src/components/views/BusinessUnitsView.tsx` |
| Primary API | `GET /api/business-units` (detail: `GET /api/business-units/:name`) |
| Primary users | Ownership owners, service managers, BU-aligned infrastructure staff |
| Depends on | `GET /api/business-units`, `GET /api/business-units/:name`, `ServerDetailDrawer` |

## 1. What this page is for

Business Units is the ownership map. The first screen groups the whole estate by `business_unit` and shows, per unit, how many servers it has, how many sub-units and managers sit under it, and who the lead managers are. The second screen takes one unit and lays out the correlation tables: every manager with their server count and email, every sub-unit and product, every datacenter and function, every attached network, plus a full server table for that unit.

It is a read-only explorer. Nothing can be edited, renamed or reassigned here; the only write-like actions are navigations that carry a filter into Inventory, and opening a server's detail drawer.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| See all business units at a glance | Default screen — the card grid |
| Find a unit by name, org code or customer | "Search business units or codes..." |
| See a unit's manager list and counts | Click the unit card |
| List every manager in a unit with email | Detail → "Designated Managers" panel |
| Email a manager with selected servers | Detail → tick hosts in "Servers Allocated to…" → **Contact** on the manager row |
| Build a contact list for the unit | Detail → **Contact List** in the header (uses selected servers, or all servers in the unit) |
| See which products and sub-units a unit owns | Detail → "Sub-Units & Products" panel |
| See datacenters and workload functions | Detail → "Datacenters & Roles" panel |
| Find which networks a unit uses | Detail → "Attached Networks" panel |
| Filter Inventory to a whole unit | Detail header → "View in Inventory Table" |
| Filter Inventory to one manager | Detail → click a manager row |
| Filter Inventory to one network | Detail → click a network row |
| Inspect one server | Detail → click a row in the server table |

## 3. Screen walkthrough

**List screen header.** A purple building icon, the title "BUSINESS UNIT INFRASTRUCTURE EXPLORER" and the subtitle "Select a business unit to analyze ownership hierarchies, sub-units, and dedicated infrastructure." On the right, a search input with placeholder "Search business units or codes...".

**Card grid.** One to three columns depending on width. Each card shows the unit name (hover turns purple), an organisation short-code chip when present, "Cust: <customer>" when present, and a right-arrow icon. Below a divider, a three-cell metric row: "Servers", "Sub-BUs" and "Managers". Under that, "Lead Managers:" followed by the manager names joined with commas, or "None assigned".

**List states.** While loading, a full-width line reads "Loading business unit ownership directories...". If the search matches nothing, "No business units match your query." The search matches unit name, organisation short code and customer, case-insensitively, and has no debounce or clear button.

**Detail screen header.** A back arrow (tooltip "Back to all business units"), the unit name with a "Business Unit Detail" badge, and the line "<N> Total Assets • <M> Powered On". On the right, a purple **Contact List** button (same action as Inventory's Contact List) and a blue "View in Inventory Table" button with an external-link icon. Contact List uses the ticked servers, or every server in the unit when nothing is selected.

**Detail panels (four columns).**
1. "Designated Managers (n)" — one clickable row per manager showing the name, an amber `n svr` pill, a **Contact** button and the email in monospace when known. Clicking the row filters Inventory by that manager; clicking **Contact** opens Communications with that manager preselected. If servers are ticked in the table, only those servers form the email scope; otherwise all of that manager's servers in the unit are used.
2. "Sub-Units & Products" — two chip lists, "Sub-Business Units:" in indigo and "Products:" in blue. These chips are not clickable.
3. "Datacenters & Roles" — "Hosting Datacenters:" chips in cyan and "Workload Functions:" chips in grey. Not clickable.
4. "Attached Networks (n)" — one clickable monospace row per network name; clicking filters Inventory by that network.

**Detail server table.** Titled "Servers Allocated to <unit> (<n>)", with a "Search within this BU..." input and selection controls on the right. Each row has a checkbox; the header checkbox selects or clears all currently filtered rows, and a "N selected / Clear" chip appears when a selection exists. Headings: a selection column, Host, VM, Manager, IP Address, Datacenter, Product, Function, Power, Secure Boot. Rows are clickable and open the detail drawer; power is a green/rose pill and secure boot reads `TRUE`, `FALSE` or `UNK`. The in-table search is client-side over host, VM, manager, primary IP, product and function only. The selection resets when switching units.

**Detail loading and failure.** There is no spinner in detail mode. `selectedBuDetail` is kept from the previous selection, so the shell can briefly show the previous unit's name and figures while the new request is in flight. A failed detail request only logs to the console and leaves the previous content on screen.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Unit name (card) | `name` from `GET /api/business-units` | Servers with no business unit are grouped as `Unassigned` |
| Org short-code chip | `organisation_short_code` | First non-empty value seen across the unit's servers |
| Cust | `customer` | First non-empty value across the unit's servers, not a distinct list |
| Servers | `total_servers` | Count of servers whose `business_unit` matches |
| Sub-BUs | `sub_business_units_count` | Distinct non-empty `sub_business_unit` values |
| Managers | `managers_count` | Distinct non-empty `manager` values |
| Lead Managers | `managers[]` | Plain string array; order follows server iteration, not relevance |
| Unit name (detail) | `name` from `GET /api/business-units/:name` | Echoes the requested name |
| Total Assets / Powered On | `total_servers`, `powered_on_servers` | Powered on means `power_state` equals `poweredOn` (case-insensitive) |
| Designated Managers | `managers[{ name, email, server_count }]` | Server-side list, unsorted; email is the first email seen for that manager |
| Sub-Business Units | `sub_business_units[]` | Distinct values |
| Products | `products[]` | Distinct `product` values |
| Hosting Datacenters | `datacenters[]` | Distinct values |
| Workload Functions | `functions[]` | Distinct values |
| Attached Networks | `networks[]` | Union of `network_1`, `network_2`, `network_3` |
| Server table columns | `servers[]` (`ServerRecord`) | Host, VM, Manager, Primary IP, Datacenter, Product, Function, Power State, EFI Secure Boot |

## 5. Common workflows

**1. Find out who owns a business unit.**
1. Use "Search business units or codes..." to narrow the grid.
2. Open the unit card.
3. Read "Designated Managers" for names, emails and how many servers each holds.
4. Click a manager to see their servers in Inventory, or use "View in Inventory Table" for the whole unit.

**2. Map a unit's technical footprint.**
1. Open the unit.
2. Read "Sub-Units & Products" for the product portfolio, "Datacenters & Roles" for hosting locations and workload functions, and "Attached Networks" for connectivity.
3. Click a network chip to see every server on that segment in Inventory.

**3. Find a specific host inside a unit.**
1. Open the unit and scroll to "Servers Allocated to …".
2. Type part of the host, VM, manager, IP, product or function into "Search within this BU...".
3. Click the row to open the drawer and switch to its Relationships or Audit History tab.

**4. Check whether a unit's servers are healthy.**
1. Use the detail header line for total versus powered-on assets.
2. Scan the secure boot column for `FALSE` (rose) and `UNK` (grey).

## 6. Gotchas and guardrails

- The card metrics are per-unit counts, but "Cust" and the org short code are single values sampled from the unit's servers. If a unit spans several customers, only the first non-empty one is displayed.
- "Lead Managers" is not ranked. It is the insertion order of a `Set` built while iterating servers, so it does not mean "primary owner".
- The detail screen has no loading indicator and does not clear stale detail when the request starts. Large units can show the previous unit's data for a moment.
- Only managers and networks are clickable in the detail panels. Sub-units, products, datacenters and functions are informational chips with no drill-through, even though Inventory supports `product`, `datacenter` and `function` filters.
- The in-BU table search does not cover datacenter, customer, support team or DNS name, and it does not survive a change of unit (`detailFilter` is not reset).
- The BU table is unpaginated and unsorted beyond the order the API returned; a unit with hundreds of servers renders every row.
- Empty values in the BU table render as blank cells rather than `—`, unlike Inventory.
- `Unassigned` is a synthetic unit for servers with no business unit. Its detail request only succeeds while such servers exist.
- Clicking "View in Inventory Table" replaces any filters already set in Inventory with `business_unit=<name>`.
- The page fetches all business units in one request with no paging; the whole grid is client-filtered.

## 7. For developers

**Component structure and props.** A single exported `BusinessUnitsView` with two render branches (list and detail) and no child components.

- `onSelectServer: (id: string) => void` — server-table row click; opens `ServerDetailDrawer` in `App`.
- `onFilterInventory: (filters: Record<string, string>) => void` — wired in `App` to `handleNavigate('inventory', filters)` for "View in Inventory Table", manager rows and network rows.
- `onOpenCommunicationsWithServers: (serverIds: string[], contactId?: string) => void` — opens Communications with the selected server scope and, when provided, the manager contact preselected.

**Local state and side effects.** State: `buList` (`any[]`), `selectedBuName` (`string | null`, the mode switch), `selectedBuDetail` (`any | null`), `loading` (initial `true`), `search`, `detailFilter`, `selectedServerIds` (`Set<string>`). One effect on mount calls `loadBusinessUnits()`. The two loaders are plain `async` functions with `try/catch/finally`; errors are `console.error` only, with no user-visible error state.

**API calls with query parameters and response shape.**

`GET /api/business-units` — no parameters. Returns an array of `{ name, organisation_short_code, organisation_abbreviated, customer, total_servers, powered_on_servers, sub_business_units_count, sub_business_units[], managers_count, managers[], support_teams_count, support_teams[], datacenters_count, datacenters[] }`. Despite the plural name it is a flat per-unit summary; `support_teams` is returned but not rendered here.

`GET /api/business-units/:name` — the path segment is `encodeURIComponent(name)` and decoded server-side. Returns `{ name, total_servers, powered_on_servers, sub_business_units[], products[], functions[], environments[], datacenters[], support_teams[], networks[], managers[{ name, email, server_count }], servers[] }`. A 404 is returned when no server carries that business unit, unless the name is `unassigned`.

**Cross-view navigation it performs.** All through the `onFilterInventory` prop, which `App` turns into `handleNavigate('inventory', filters)`:

| Control | Filter keys passed |
|---|---|
| "View in Inventory Table" | `{ business_unit: <unit name> }` |
| Manager row | `{ manager: <manager name> }` |
| Network row | `{ network: <network name> }` |
| Manager **Contact** | `onOpenCommunicationsWithServers(selected IDs or manager's server IDs, manager email key)` |
| Header **Contact List** | `onOpenCommunicationsWithServers(selected IDs or all unit server IDs)` |

Server rows call `onSelectServer(id)` and stay in place. Note that the list endpoint also returns `sub_business_units`, `managers` (as strings), `support_teams` and `datacenters`, which would allow more drill-throughs than are currently wired.

**Extension points and known rough edges.** Add `loading` handling and `selectedBuDetail = null` at the start of `handleSelectBu`; reset `detailFilter` when the unit changes; make product, datacenter, function and sub-unit chips clickable with `{ product }`, `{ datacenter }`, `{ function }` and `{ sub_business_unit }` (all valid `/api/servers` keys); sort managers by `server_count` and label the first one as primary; paginate or virtualise the server table; surface fetch errors instead of only logging them; and consider using `support_teams` in the detail panels, since it is already returned.

## 8. Related pages

- [Inventory](./02-inventory.md) — receives `business_unit`, `manager` and `network` filters from every drill-through on this page.
- [Overview](./01-overview.md) — its business unit bars and "All BUs" link lead here, and its Sub-Business Units counter reflects the same data.
- [Products](./04-products.md) — the product dimension of the same estate; product chips here are informational, while Products offers the drill-through.
