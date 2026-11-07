# Products (4_Product)

> **At a glance:** A card catalogue of every `4_Product` value in the estate, with per-product server counts, power status, designated owners, business units, customers and workload functions.

| | |
|---|---|
| View id | `products` |
| Sidebar label | `4_Product` |
| Core component | `src/components/views/ProductsView.tsx` |
| Primary API | `GET /api/products` |
| Primary users | Service managers, product owners, SOC analysts scoping a product-wide incident |
| Depends on | `GET /api/products`, `ServerDetailDrawer` (via `onSelectServer`), incident triage and Inventory navigation callbacks |

## 1. What this page is for

Products answers "what software do we run, where, and who owns it?". Each card is one product: how many servers carry it, how many of those are powered on, who the primary owner is (plus co-owners), which business units and customers consume it, and which workload functions it performs.

Unlike the rest of the application, this page is explicitly branded as `4_Product` — the sidebar label, the KPI badge on Overview and the header all use that name. It is read-only apart from navigation: there is no create, edit, delete or reassignment control.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| See how many products exist | "Total Products" metric, or the badge beside the header title |
| Find a product by name, owner, BU, customer or function | "Search product, owner, BU..." |
| Identify the owner of a product | The "Product Owner" block on each card |
| Contact the owner | Click the email address, or the copy icon beside it |
| See co-owners and their server counts | "Co-leads:" chips when a product has more than one owner |
| See which servers run a product | "Quick View Hosts" on the card footer |
| Open one of those servers | Expand, then click a host row |
| Filter Inventory to the whole product | "View Servers" on the card footer |
| Send a product's servers to incident triage | The rose shield icon on the card footer |
| Reload the catalogue after new data lands | The refresh icon beside the search box |

## 3. Screen walkthrough

**Header banner.** A blue package icon, the title "4_Product Catalog", a blue badge showing "<n> Products", and the subtitle "Overview of software products, deployed host counts, and designated product owners." On the right, a search box with placeholder "Search product, owner, BU..." and a circular refresh button (tooltip "Refresh Products") whose icon spins while loading.

**Metric cards (four).** "Total Products" (count of catalogue entries, caption "Catalogued software classifications"), "Deployed Servers" (sum of per-product servers, caption "Across all datacenters"), "Product Owners" (distinct owner names, caption "Accountable managers"), and "Fleet Availability" (percentage in emerald, caption "<online> of <total> online"). These four are global: they do not react to the search box.

**Product cards.** One to three columns; each card is a bordered panel with a package icon and, in order:
- the product name and a pulsing green dot with "<powered on> / <total> Online"; on the right a large server count with a "Server"/"Servers" caption;
- the "Product Owner" block: a blue "Product Owner" label, a "+N co-owner" hint when there are more, an initials avatar, the owner's name, a mailto email link and a copy-email icon that shows a tick for two seconds;
- "Co-leads:" chips with each additional owner and their server count;
- "Business Units & Customers": blue chips with a building icon for BUs, emerald chips for customers;
- "Workload Roles & Functions": purple chips with a CPU icon;
- when expanded, "Assigned Servers (n)" — a scrollable list of host rows showing host, then "vm • ip", and a function pill on the right; clicking a row opens that server's drawer.

**Card footer.** Always visible: a "Quick View Hosts" / "Hide Hosts" toggle with a chevron, then a rose shield icon button (tooltip "Triage all servers of this product") and a solid blue "View Servers" button.

**States.** While loading, the metric cards render zeros, the grid is replaced by a spinner and "Loading product portfolio...", and Fleet Availability shows 100%. If the search matches nothing, a panel with a package icon reads "No products found" plus "No products match your search query "<query>"". The refresh button spins whenever `loading` is true, including the initial load.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Products badge | `products.length` | Count of catalogue entries returned by the API |
| Total Products | `products.length` | Same figure as the badge |
| Deployed Servers | `sum(total_servers)` | Every product bucket, including `Unassigned Product`; equals the estate total |
| Product Owners | distinct `product_owners[].name` | Counted across all products, so an owner of two products counts once |
| Fleet Availability | `sum(powered_on) / sum(total_servers)` | Forced to 100 when there are no products |
| "<n> / <m> Online" | `powered_on`, `total_servers` | Green dot pulses regardless of the ratio |
| Server count on card | `total_servers` | Singular/plural from the same number |
| Product Owner | `product_owners[0]`, else `primary_owner` | `product_owners` is sorted by `server_count` descending server-side |
| "+N co-owner" | `product_owners.length - 1` | Label is always singular, even for several co-owners |
| Co-leads | `product_owners[1..]` with `server_count` | Chips show the count in brackets |
| Business units | `business_units[]` | Distinct non-empty `business_unit` values |
| Customers | `customers[]` | Distinct non-empty `customer` values |
| Functions | `functions[]` | Distinct non-empty `function` values |
| Assigned Servers | `servers[{ id, host, vm, ip, bu, manager, email, function, power_state }]` | Full server list per product |
| Triage button payload | `server_ids[]` | Passed to `onOpenIncidentWithServers` |

`managers[]`, `environments[]` and `datacenters[]` are returned by the API but are not rendered on this page.

## 5. Common workflows

**1. Identify and contact a product owner.**
1. Type the product name into "Search product, owner, BU...".
2. Read the "Product Owner" block for the name and email, and "Co-leads" for others.
3. Click the email to compose in your mail client, or the copy icon to paste the address elsewhere.

**2. Scope a product to inspect its hosts.**
1. Click "Quick View Hosts" on the card to expand "Assigned Servers (n)".
2. Click any host row to open the server drawer (ownership, security, relationships, audit history).
3. Collapse with "Hide Hosts" before working on another card — only one card expands at a time.

**3. Hand a whole product to incident triage.**
1. Locate the product card and confirm its server count.
2. Click the rose shield icon. This sends `server_ids` for that product into the incident triage view; it does not create an incident on its own.
3. Alternatively click "View Servers" to review the population in Inventory first, then select rows there.

**4. Audit the catalogue for unassigned work.**
1. Search for `Unassigned Product` to find servers with no `product` value.
2. Check a product with no owner: the block falls back to the `primary_owner` string, which is `Unassigned` when no manager exists.
3. Use "View Servers" to reach Inventory, then filter by Manager to fix ownership at source (edits happen in Data Sync, not here).

## 6. Gotchas and guardrails

- Every server with an empty `product` is bucketed as `Unassigned Product`; it appears as a normal card and inflates "Total Products" and "Deployed Servers" like any other product.
- `powered_off` (and therefore "N / M Online") treats everything that is not `poweredOn` as off, so suspended hosts count as offline.
- The green "Online" dot pulses even when zero of the product's servers are powered on; it is decorative, not a health indicator.
- "Fleet Availability" shows 100% while the page is still loading and when the catalogue is empty, because the ratio is guarded rather than rendered as "no data".
- Product owner is derived, not stored: it is whichever manager has the most servers in that product. A product spanning several managers will show one primary and the rest as co-leads, and ties resolve by map insertion order.
- The "+N co-owner" label never pluralises.
- The search is client-side only and runs over name, primary owner, owner names and emails, business units, functions and customers. It never queries the API, so it cannot find a product whose only match is a datacenter or environment.
- The four metric cards ignore the search; filtering the grid does not change the totals.
- "Triage all servers" is a navigation, not an action. It cannot be undone from this page and does not record anything against the product.
- There is no paging: every product card renders, including its expanded server list when opened.
- The card list order is the API's order (server count descending), and search preserves that order rather than ranking by relevance.
- Copying an email depends on the browser clipboard API; there is no fallback if permission is denied.

## 7. For developers

**Component structure and props.** One exported `ProductsView`, one `useMemo` filter, no child components; card markup is inlined in the `map`.

- `onSelectServer?: (id: string) => void` — expanded server-row click; optional, so the rows are inert when the prop is omitted.
- `onFilterInventory?: (filters: Record<string, string>) => void` — "View Servers"; `App` maps it to `handleNavigate('inventory', { product: name })`.
- `onOpenIncidentWithServers?: (serverIds: string[]) => void` — rose shield button; buttons are only rendered when this prop is supplied. `App` always supplies it.

**Local state and side effects.** State: `products` (`ProductSummary[]`), `loading` (initial `true`), `searchQuery`, `expandedProduct` (`string | null`, so one card open at a time), `copiedEmail` (`string | null`, cleared by a 2-second timeout). A single `useEffect` on mount calls `loadProducts()`; the same function powers the refresh button. No polling, no refetch on window focus, and no dependency on props.

**API calls with query parameters and response shape.**

`GET /api/products` — no query parameters. Returns `ProductSummary[]`, one entry per distinct `product` value (empty becomes `Unassigned Product`), sorted by `total_servers` descending. Each entry: `{ name, total_servers, powered_on, powered_off, primary_owner, product_owners[{ name, email, server_count }], managers[], business_units[], customers[], functions[], environments[], datacenters[], server_ids[], servers[{ id, host, vm, ip, bu, manager, email, function, power_state }] }`. Owner lists are sorted by `server_count` descending; `primary_owner` is `Unassigned` when no manager exists. The endpoint aggregates in memory from `db.data.servers` on every call.

**Cross-view navigation it performs.**

| Control | Callback | Destination and payload |
|---|---|---|
| "View Servers" | `onFilterInventory({ product: <name> })` | `inventory` with `product` filter |
| Expanded host row | `onSelectServer(id)` | `ServerDetailDrawer` for that host |
| Rose shield icon | `onOpenIncidentWithServers(product.server_ids)` | `incident-triage` with `targetedServerIds` set to every server of the product |

Because `App.handleNavigate` replaces the dictionary, arriving in Inventory from here discards any filters the user had already set there.

**Extension points and known rough edges.** Use `product.managers`, `environments` and `datacenters` to enrich the cards or add filter chips; make product name, BU chips and customer chips clickable (`{ product }`, `{ business_unit }`, `{ customer }` are all valid `/api/servers` keys); pluralise "+N co-owners"; replace the always-green dot with a real health ratio; show a neutral Fleet Availability state when there are no products; sort or group the catalogue and add a filter by business unit; and consider server-side search if the catalogue grows.

## 8. Related pages

- [Inventory](./02-inventory.md) — receives the `product` filter from "View Servers" and is where per-host selection, CSV export and bulk triage happen.
- [Business Units](./03-business-units.md) — the owning-organisation view of the same servers; its product chips are informational, so this page is the product drill-through.
- [Overview](./01-overview.md) — its "Products" KPI, "Product Counts (Top 10)" panel and `4_Product` badge all summarise the catalogue documented here.
