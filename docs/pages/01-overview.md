# Overview

> **At a glance:** The estate-wide landing dashboard that turns `/api/stats` counters into KPI cards, ownership/security breakdowns and click-through routes into Inventory, Business Units and Products.

| | |
|---|---|
| View id | `overview` |
| Sidebar label | `Overview` |
| Core component | `src/components/views/OverviewView.tsx` |
| Primary API | `GET /api/stats` |
| Primary users | SOC analysts, ownership/infrastructure owners, service managers |
| Depends on | `GET /api/stats`, `GET /api/audit-logs`, `GET /api/incidents` (all fetched by `App`); navigation into `inventory`, `business-units`, `products`, `ownership-explorer`, `infrastructure-map`, `reports`, `settings` |

## 1. What this page is for

Overview answers "what does the estate look like right now?" without asking anyone to build a filter. It is the default view on load and the page the NEXUSINFRA logo returns you to.

It summarises five headline figures (servers, online, products, secure boot, ownership completeness), then breaks them down by business unit, product, power state and security posture. Every KPI card, bar, legend row and telemetry line is a navigation affordance: clicking generally opens Inventory with a matching filter pre-applied, or opens the relevant domain view.

The page is read-only. There are no edit controls, no create buttons and no server-level actions: clicking a server row is not possible here because no server list is rendered.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Confirm fleet size and how much is powered on | "Total Servers" or "Online" KPI card (Online filters Inventory to `power_state=poweredOn`) |
| Check secure boot compliance exposure | "Secure Boot" KPI (filters `secure_boot=TRUE`); "Top Risks" item 2 filters `secure_boot=FALSE` |
| Find unowned or uncontactable servers | "Ownership Complete" KPI (opens Ownership Explorer) or the "Missing Owner" / "Missing Email" telemetry items |
| Review product coverage | "Products" KPI or the "All Products" link on the Product Counts panel |
| Review business unit allocation | Any bar on "Servers by Business Unit" or any slice/legend row in "Business Unit Distribution" (filters `business_unit`), or "All BUs" |
| Open the datacenter view | "Datacenters" telemetry item (opens Infrastructure Map) |
| Start incident triage | "View All" on Top Risks, Top Risks item 1, or the navbar incidents pill |
| Audit recent changes | "View All" on Recent Activity (opens Settings) |

## 3. Screen walkthrough

**Page header.** Title "Infrastructure Overview", subtitle "Real-time visibility of your infrastructure, security posture and ownership". On the right is a calendar dropdown whose label starts as "Last 24 Hours".

**Time range dropdown.** Opening it lists "Last 24 Hours", "Last 7 Days", "Last 30 Days" and "Year to Date"; the active option is highlighted in blue with a dot. Selecting an option updates the button label and closes the menu. As implemented the selection is cosmetic: it triggers no request and changes no figure on the page.

**KPI row (five cards).** "Total Servers", "Online" (value `n / total` plus a percentage), "Products" (badge reads `4_Product`), "Secure Boot" (`n / total` plus percentage) and "Ownership Complete" (`n / total` plus percentage). Each card carries an icon, a sparkline and the hard-coded subtitle "↑ 0% vs previous period". The whole card is clickable.

**Row A — two bar panels.** Left: "Servers by Business Unit" with sub-label "Inventory allocation", an "All BUs" link and up to six horizontal bars showing `count (pct%)`, with axis markers `0 1 2 3 4+` that do not correspond to the plotted percentages. Right: "Product Counts (Top 10)" with sub-label "4_Product server mapping", an "All Products" link and up to ten bars showing percentage plus a `n servers` pill, axis markers `0 2 4 6 8+`.

**Row B — two donuts.** Left: "Power State Distribution" with an `n% ACTIVE` pill, a donut whose centre shows the powered-on percentage, and a legend of "Powered On", "Powered Off" and "Suspended". Right: "Security Posture" with sub-label "EFI Secure Boot & Hardware", a donut showing the secure percentage and a four-row legend: "Secure", "At Risk", "At Risk (High)", "Unknown / Disabled".

**Right column.** "Business Unit Distribution" card: a donut/pie on the left with its legend immediately to the right, matching the "Power State Distribution" layout. It reads `servers_by_business_unit`, shows a coloured legend with count and percentage, a centre readout that switches from total servers to the hovered unit, and a `N BUs` badge. Hovering a slice highlights it and updates the centre count; clicking a slice or legend row opens Inventory with `business_unit=<name>`. The three top-row cards (Servers by Business Unit, Product Counts and Business Unit Distribution) share a 340px height at desktop widths so their tops and bottoms align.

**Full-width Operational Telemetry bar.** Below the middle chart grid and above the bottom row, a single compact bar spans the content width. It contains seven single-line items in two rows (four then three): Sub-Business Units, Datacenters, Support Teams, Unique Managers, Missing Owner, Missing Email and Incomplete Metadata. Each item has a small icon, a label and a colour-coded number; the whole item is clickable and navigates to the related view or Inventory filter. The old Environments chip list is no longer rendered on Overview.

**Bottom row — three panels.** "Infrastructure Health" with four fixed gauges (Availability 100%, Performance 99.8%, Patch Level 98%, Compliance 87%). "Top Risks" with a "View All" link and three fixed risk rows. "Recent Activity" with a "View All" link and four fixed activity lines.

**Loading and empty states.** While metrics load, the whole page is replaced by a centred card reading "Loading infrastructure overview intelligence..." with a spinning activity icon. There is no error state: if `/api/stats` fails, `App` logs to the console and the loading panel simply remains.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Total Servers | `total_servers` (`/api/stats`) | Exact value; zero renders as zero |
| Online | `powered_on_servers` / `total_servers` | Missing numerator defaults to 0; percentage is rounded |
| Products | `total_products` | Falls back to the breakdown length when absent |
| Secure Boot | `secure_boot_status[{name:'Enabled'}].count` | Missing array defaults to 0 enabled / 0 disabled |
| Ownership Complete | `ownership_completeness.fully_assigned` | Missing value defaults to 0 |
| Servers by Business Unit | `servers_by_business_unit` | Server sorts descending; the view slices the first six |
| Business Unit Distribution | `servers_by_business_unit` | One donut slice and legend row per BU; hover shows count/percentage; click filters Inventory by `business_unit`; the `Unassigned` slice is not clickable |
| Product Counts (Top 10) | `servers_by_product` | Excludes `Unassigned`, already limited to 10 server-side; static NDM/Housing/Pulse VTM fallback |
| Power State Distribution | `powered_on_servers`, `powered_off_servers` | `powered_off` is `total - powered_on`, so suspended hosts count as powered off |
| Security Posture donut | `secure_boot_status` Enabled/Disabled | Unknown count is not plotted; "At Risk" rows are literal zeros |
| Sub-Business Units | `total_sub_business_units` | Distinct non-empty values |
| Datacenters | `total_datacenters` | Distinct non-empty values |
| Support Teams | `total_support_teams` | Distinct non-empty values |
| Unique Managers | `total_unique_managers` | Distinct non-empty values |
| Missing Owner | `ownership_completeness.missing_manager` | Servers with no manager; the item opens Inventory with `manager=Unassigned` |
| Missing Email | `servers_missing_contact` | Servers with no email |
| Incomplete Metadata | `servers_incomplete_metadata` | Missing product, function, org short code or sub-BU |
| Incomplete Metadata | `servers_incomplete_metadata` | Servers missing product, function, org code or sub-BU |
| Infrastructure Health gauges | none | Hard-coded 100 / 99.8 / 98 / 87 |
| Top Risks | none | Hard-coded three rows |
| Recent Activity | none | Hard-coded four rows; `recentLogs` prop is fetched but never rendered |

## 5. Common workflows

**1. Chase unowned servers.**
1. Read the "Ownership Complete" card to see how many servers have manager, email, business unit and support team set.
2. Click it to open Ownership Explorer for the full breakdown.
3. Alternatively click "Missing Owner" in Operational Telemetry. This now opens Inventory with the **Manager: Unassigned** filter, which the servers endpoint understands.

**2. Check secure boot exposure.**
1. Read "Secure Boot" in the KPI row for the enabled count and percentage.
2. Click the card to open Inventory filtered to `secure_boot=TRUE`; clear the filter chip to see everything.
3. To see the non-compliant hosts, click Top Risks item 2, which opens Inventory filtered to `secure_boot=FALSE`.

**3. Go from a business unit to its servers.**
1. Find the unit in "Servers by Business Unit" (top six only).
2. Click its bar to open Inventory with `business_unit=<name>`.
3. If the unit is not in the top six, use "All BUs" and search there.

**4. Start triage from a risk.**
1. Click "View All" in Top Risks, or any risk row, to open the Incidents view.
2. Use the navbar incidents pill for the same destination.

## 6. Gotchas and guardrails

- The time-range dropdown is not wired to any API call. Choosing "Last 30 Days" changes the label only.
- Every "↑ 0% vs previous period" trend and every Infrastructure Health gauge is static decoration; do not quote them as measurements.
- The "Business Unit Distribution" pie reads `/api/stats`; clicking a slice navigates to Inventory with `business_unit=<name>`. The `Unassigned` slice is intentionally not clickable because the Inventory business-unit filter cannot match an empty value.
- "Recent Activity" does not read the audit log, even though `recentLogs` is fetched on load and passed in.
- The "Suspended" legend row is hard-coded to `0 (0%)`; suspended hosts are already inside the powered-off figure.
- "At Risk" and "At Risk (High)" are literal zeros; only Enabled and Disabled secure boot counts are real.
- The "Missing Owner" telemetry item uses `ownership_completeness.missing_manager` and opens Inventory with `manager=Unassigned`; the servers endpoint treats `Unassigned`/`missing`/`none`/`empty` as "no manager". "Missing Email" still sends `email=missing`, which is an equality match and returns no rows.
- Falsy-to-default coercion means a genuinely empty database still shows "Total Servers 9" and "Products 3" (drawn from the static fallback list) while Inventory shows none.
- Clicking a KPI never opens the server drawer; `onSelectServer` is declared on the props interface but not used here.
- Percentages are computed against all servers, including powered-off ones, so the donut and KPI percentages are fleet shares, not availability figures.

## 7. For developers

**Component structure and props.** `OverviewView` is a single exported component plus one local presentational helper, `TopKpiCard`.

- `metrics: DashboardMetrics | null` — everything on the page except navigation and the static blocks. Renders the loading panel when `null`.
- `recentLogs: AuditLogEvent[]` — accepted and destructured but never referenced in the render tree.
- `loading: boolean` — combined with `!metrics` to short-circuit the whole page.
- `onNavigate(view: string, filterParams?: Record<string, string>)` — the only wiring out of the page; mirrors `App.handleNavigate`.
- `onSelectServer: (id: string) => void` — present in the interface, not destructured, therefore dead.

**Local state and side effects.** Two pieces of state only: `timeRange` (string, default `'Last 24 Hours'`) and `isTimeRangeOpen` (boolean). There is no `useEffect`, no fetch and no interval; all data arrives via props from `App`, which loads `/api/stats`, `/api/audit-logs` and `/api/incidents` once on mount and on demand after data-management actions.

**API calls with query parameters and response shape.** The view issues none itself. The data contract is `DashboardMetrics` from `src/types/index.ts`: scalar counters, `servers_by_business_unit[]`, `servers_by_product[]`, `servers_by_environment[]`, `servers_by_datacenter[]`, `servers_by_support_team[]`, `servers_by_power_state[]`, `secure_boot_status[]` and `ownership_completeness{ fully_assigned, missing_manager, missing_email, missing_business_unit, missing_support_team }`. Server side, `/api/stats` computes every breakdown from `db.data.servers` on each request; `servers_by_product` is filtered to drop `Unassigned` and sliced to ten.

**Cross-view navigation it performs.** All via `onNavigate`:

| Control | Destination | Filter keys passed |
|---|---|---|
| Total Servers card | `inventory` | none (existing filters are preserved, not cleared) |
| Online card, Powered On legend | `inventory` | `power_state=poweredOn` |
| Powered Off legend | `inventory` | `power_state=poweredOff` |
| Secure Boot card | `inventory` | `secure_boot=TRUE` |
| Top Risks item 2 | `inventory` | `secure_boot=FALSE` |
| Business unit bar | `inventory` | `business_unit=<name>` |
| Product bar | `inventory` | `product=<name>` |
| Environment chip | `inventory` | `environment=<name>` |
| Missing Owner item | `inventory` | `manager=Unassigned` |
| Missing Email row | `inventory` | `email=missing` (equality match, no rows) |
| Products card, All Products | `products` | none |
| Ownership Complete card | `ownership-explorer` | none |
| All BUs, Sub-Business Units | `business-units` | none |
| Datacenters row | `infrastructure-map` | none |
| Support Teams, Unique Managers | `inventory` | none |
| Top Risks item 1, Top Risks View All | `incident-triage` | none |
| Top Risks item 3, Incomplete Metadata | `reports` | none |
| Recent Activity View All | `settings` | none |

Rows that pass no filter keys leave whatever filters Inventory already had in place, because `App.handleNavigate` only overrides `inventoryFilters` when `filterParams !== undefined`.

**Extension points and known rough edges.** Wire `timeRange` to a real `from`/`to` query so trends become meaningful; replace the `|| 9` style fallbacks with explicit empty states; render `recentLogs` in Recent Activity; drive Infrastructure Health and Top Risks from `/api/incidents` and `/api/stats` rather than literals; use `onSelectServer` to open the drawer from a small "top servers" list if one is added. The static NDM/Housing/Pulse VTM product fallback will surface fictional data if `servers_by_product` ever comes back empty.

## 8. Related pages

- [Inventory](./02-inventory.md) — the destination of most KPI, bar and chip clicks, and where the filters this page sends actually apply.
- [Business Units](./03-business-units.md) — the drill-down behind "All BUs" and the business unit bars.
- [Products](./04-products.md) — the drill-down behind "All Products" and the product bars; shares the `4_Product` vocabulary used in the KPI badge.
