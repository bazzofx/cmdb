# Infrastructure Map

> **At a glance:** A read-only, tabbed view of the estate grouped four ways — by hypervisor, datacenter, network segment and business unit — for co-tenancy and blast-radius conversations.

| | |
|---|---|
| View id | `infrastructure-map` |
| Sidebar label | `Infrastructure Map` |
| Core component | `src/components/views/InfrastructureMapView.tsx` |
| Primary API | `GET /api/servers?limit=500` |
| Primary users | Infrastructure owners, platform engineers and service managers reviewing co-hosting, VLAN sharing and datacenter spread |
| Depends on | Server records with `host`, `vm`, `datacenter`, `network_1..3`, `business_unit` and `power_state`; Inventory filters (for the BU drill-through) |

## 1. What this page is for

Inventory answers "what do we have". This page answers "what sits next to what". It groups the same server records into four physical or organisational containers and highlights the risky overlaps: a hypervisor hosting VMs from more than one business unit, or a network segment shared across tenants.

The grouping is computed in the browser from one page of servers. Nothing on this page writes data, and no grouping is stored server-side; there is no topology table behind it.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| Check whether a host runs other teams' VMs | **Hypervisors** tab → find the host card; an amber border and a **Shared across N BUs** badge mean cross-tenant co-hosting |
| Review everything in a datacenter | **Datacenters** tab |
| Find which systems share a VLAN | **Networks & VLANs** tab → find the segment |
| Jump from a business unit to its filterable server list | **BU Infrastructure** tab → **Filter Table (n) →** |
| Open a specific server | Click any VM name in any tab |
| Confirm whether a VM is powered on | Read the power-state chip on the VM row (**Hypervisors** tab only) |

## 3. Screen walkthrough

**Header.** An icon, the title **INFRASTRUCTURE TOPOLOGY MAP**, and the subtitle "Technical mapping of physical datacenters, ESXi hypervisors, hosted VMs, and shared network segments." On the right is a four-way switcher: **Hypervisors** (default), **Datacenters**, **Networks & VLANs**, **BU Infrastructure**.

**Loading.** While the single fetch is in flight the body shows the centred line "Mapping infrastructure relationships...". There are no per-tab empty states: if the estate is empty or the request fails, the tab renders its count line followed by nothing.

**Hypervisors tab.** A summary line reads "N Physical Hypervisors Hosting M Virtual Machines", with the note "★ Co-hosting highlighted for multi-tenant risk review". Below it is a two-column grid of host cards. Each card shows the host name with a CPU icon, a line reading `DC: <datacenter>` and "N Hosted VM(s)", and a **Shared across N BUs** badge when the host's VMs span more than one business unit; those cards get an amber border and tint. Under "Virtual Machines on this Host:" each VM shows its name, its IP in cyan, `function` (falling back to `product`), the business unit in purple, and a power-state chip.

**Datacenters tab.** One card per datacenter, headed by the datacenter name with "N Hypervisor Clusters • M Provisioned Nodes". Inside, a responsive grid of host tiles, each with a **N VMs** badge and a plain list of `vm — ip` rows.

**Networks & VLANs tab.** A count line reads "N Distinct Network Segments / VLAN Interfaces" above a three-column grid. Each segment card shows the segment name, "N Attached Systems", and a **N BUs** badge when more than one business unit is attached. The attached-systems list is capped in height and scrolls.

**BU Infrastructure tab.** One card per business unit, with the BU name, a **Filter Table (n) →** button on the right, and a grid of server tiles showing host on the first line and `vm • ip` on the second.

Every VM row, tile and server entry is a click target that opens the global Server Detail Drawer. Nothing on this page is editable.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Hypervisor card title | `servers[].host` | Falls back to "Unknown Hypervisor" when blank |
| `DC:` value | `servers[].datacenter` | Falls back to the hard-coded string `UK1-SSE-DC1` |
| Hosted VM name | `servers[].vm` | |
| VM IP | `servers[].primary_ip_address` | |
| VM function line | `servers[].function`, else `servers[].product` | |
| BU label on VM row | `servers[].business_unit` | |
| Power-state chip | `servers[].power_state` | `poweredOn` renders emerald; anything else renders rose |
| Shared across N BUs | Distinct `business_unit` values per host | Cross-tenant warning |
| Networks & VLANs entries | `network_1`, `network_2`, `network_3` | A server is counted once per distinct segment it touches |
| N Attached Systems | Servers per segment, de-duplicated by `id` | |
| N BUs badge | Distinct `business_unit` values per segment | |
| BU Infrastructure grouping | `servers[].business_unit` | Blank becomes "Unassigned" |
| Count lines | Derived lengths of the in-memory maps | Not from `/api/stats` |

## 5. Common workflows

**Check co-tenancy before a maintenance window.**

1. Open **Infrastructure Map**; the **Hypervisors** tab is already active.
2. Scan for amber cards and **Shared across N BUs** badges.
3. Read the VM list to see which teams are affected.
4. Click a VM to open its full record, then use the drawer's relationship tabs to confirm ownership before sending comms.

**Review a network segment for shared exposure.**

1. Select **Networks & VLANs**.
2. Find the segment by name; the count line tells you how many segments exist.
3. Read the **N BUs** badge to judge blast radius.
4. Click an attached system to open it, or note the segment name for use as an Inventory filter.

**Move from a business unit to a working list.**

1. Select **BU Infrastructure**.
2. Locate the BU card and check the server count.
3. Click **Filter Table (n) →**. The app switches to Inventory with `business_unit` pre-applied.
4. Refine with Inventory's own filters and export from there.

## 6. Gotchas and guardrails

- Only the first 500 servers (host order) are loaded. All four tabs, including their count lines, describe that subset — not the database. On a larger estate the numbers under-report.
- The `UK1-SSE-DC1` fallback for a blank `datacenter` makes missing data look like a real datacenter. Treat that name with suspicion during data-quality work; the Inventory page is the place to confirm the true value.
- The **Hypervisors** count line calls hosts "Physical Hypervisors". The field is just `host`; nothing verifies that the value is a hypervisor name.
- No search, no sort and no filter inside the page. Finding a specific host in a large estate means scanning cards or using the browser's find-in-page.
- The page is stateless and refetches on every visit; switching tabs does not refetch, but leaving the view and returning resets the tab to **Hypervisors**.
- The only cross-view action is the BU drill-through. Clicking a VM opens a drawer and keeps you on this page.
- Nothing here is audited, because nothing here mutates data.

## 7. For developers

**Component structure.** A single function component, `InfrastructureMapView`, with no subcomponents, no error boundary and no chart or graph library. Despite the name, this view does not use cytoscape — cytoscape is used only by Ownership Explorer. All rendering is grouped card markup styled with Tailwind utility classes.

**Props.**

| Prop | Type | Purpose |
|---|---|---|
| `onSelectServer` | `(id: string) => void` | Wired to every VM row, datacenter tile, network entry and BU tile; `App` opens `ServerDetailDrawer` |
| `onFilterInventory` | `(filters: Record<string, string>) => void` | Called only by the BU tab's **Filter Table** button, with `{ business_unit: <name> }`; `App.handleNavigate` stores it in `inventoryFilters` and switches view |

**Local state and effects.**

| State | Initial | Notes |
|---|---|---|
| `servers` | `[]` | Populated once from the API |
| `loading` | `true` | Drives the "Mapping infrastructure relationships..." line |
| `activeTab` | `'hypervisor'` | Union of `datacenter \| hypervisor \| network \| business_unit`; set through `as any` casts at the call site |

The mount effect (`[]` deps) calls `loadData()`, which issues `api.getServers({ limit: 500 })` → `GET /api/servers?limit=500`. The response shape is `{ items, total, page, limit, total_pages }`; the view keeps `items` only and ignores `total`, so there is no way to know whether the 500 cap was hit.

**Derived data.** Four `Map`s are rebuilt on every render, outside `useMemo`:

- `hypervisorMap: host → ServerRecord[]`, using `'Unknown Hypervisor'` as the key fallback.
- `datacenterMap: datacenter → (host → ServerRecord[])`, with the `UK1-SSE-DC1` fallback.
- `networkMap: segment → ServerRecord[]`, iterating `[network_1, network_2, network_3].filter(Boolean)` and skipping a server already present for that segment.
- `buMap: business_unit → ServerRecord[]`, using `'Unassigned'` as the fallback.

**Cross-view navigation.** `onFilterInventory({ business_unit: buName })` only. Note the key is `business_unit`, which `GET /api/servers` also accepts, so the same string works server-side and client-side. `buName` comes from the map key, so an unassigned group sends the literal value `Unassigned`.

**Extension points and rough edges.**

- `/api/datacenters` and `/api/networks` already return server-side groupings with hypervisor and host lists, but this view does not call them. Switching to those endpoints would remove the 500-row cap and give accurate totals; the response shapes are documented in the API section of the developer guide.
- The maps are recomputed on each render, including renders caused only by a tab change. `useMemo` on `servers` would be the obvious first optimisation.
- `activeTab` is read as `any` in the switch handler, so a typo in a tab id would fail silently rather than at compile time.
- There is no empty-state branch per tab; add one before exposing the page to users with sparse data.
- Cross-tenant detection compares raw `business_unit` strings, so "BRICK" and "brick" count as two tenants.

## 8. Related pages

- [Inventory](./02-inventory.md) — the full list, with filters and exports; the BU tab hands off here.
- [Ownership Explorer](./05-ownership-explorer.md) — the same estate drawn as an ownership graph rather than physical containment.
- [Business Units](./03-business-units.md) — aggregated BU metrics and drill-downs.
- [Data Sync (Import & Data Management)](./11-data-management.md) — where `host`, `datacenter` and network values are corrected.
- [Settings & Audit](./12-settings-and-audit.md) — the audit trail for any edits made after following a VM into the drawer.
