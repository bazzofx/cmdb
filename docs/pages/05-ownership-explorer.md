# Ownership Explorer

> **At a glance:** A force-directed-by-hand relationship graph that shows how each server is owned — business unit, sub-business unit, product, server and manager — and lets you drill from any node into the underlying record.

| | |
|---|---|
| View id | `ownership-explorer` |
| Sidebar label | `Ownership` |
| Core component | `src/components/views/OwnershipExplorerView.tsx` |
| Primary API | `GET /api/servers?limit=500` |
| Primary users | Ownership and service managers confirming accountability; infrastructure owners reviewing product/BU spread; SOC analysts checking who owns a host |
| Depends on | Server records with `business_unit`, `sub_business_unit`, `product`, `manager` and `email` populated; cytoscape 3.34; the global Server Detail Drawer |

## 1. What this page is for

The page answers one question repeatedly: *who owns this, and what else do they own?* It draws the chain Business Unit → Sub-Business Unit → Product → Server (VM) → Manager as a connected graph, so a gap in the chain is visible as a missing link rather than as a blank cell in a table.

Everything is derived at read time from the server list. The graph does not read a separate ownership model: if `manager` is empty on a server, no manager node exists for it, and the server sits unowned in the picture.

## 2. Who uses it, and for what

| Task | Where to click |
|---|---|
| See the full ownership shape for all inventory | Open **Ownership**; the default **Orbit** layout loads automatically |
| Narrow to one business unit | **BU:** dropdown in the toolbar → pick a unit (or leave **All**) |
| Check who manages a specific VM | Click the server node → read **Manager** and **Email** in the right-hand drawer |
| Open the full server record | Click the server node → **More Details (Server Profile)** |
| Review everything linked to a node | Click the node → **Linked Entities (n)** list, then click any entry to walk the graph |
| Hide relationships to see nodes in isolation | **Connections** toggle (shows `ON` / `OFF`) |
| Switch to a left-to-right governance view | **Linear** in the Orbit/Linear switch |
| Give a picture to someone who has no access | **Export PNG** (download icon) |
| Remove one layer, e.g. products | Uncheck **Prod** in the node pills |

## 3. Screen walkthrough

The page fills the viewport and is laid out as a single-line toolbar above a full-height canvas.

**Toolbar (left to right).**

- A fork icon and the title **Ownership Graph**.
- **BU:** — a compact dropdown containing **All** plus every distinct `business_unit` found in the loaded data.
- **Connections** — a toggle that reads `ON` or `OFF`; when `OFF`, all edges are removed and only nodes are positioned.
- **Orbit / Linear** — a two-button switch. **Orbit** (default) places servers on a central ring, with products, sub-business units and business units on concentric arcs to the left and managers on an arc to the right. **Linear** arranges five columns left to right: Business Unit, Sub-BU, Product, Server, Manager.
- Five checkbox pills: **BU**, **Sub-BU**, **Prod**, **Server**, **Mgr**. All start checked.
- Five icon buttons with tooltips: **Zoom In**, **Zoom Out**, **Fit to Screen**, **Reset Layout**, **Export PNG**.

**Canvas.**

- Nodes are rounded rectangles containing only a label — no icons or badges are drawn inside the canvas. Colour encodes type: purple business unit, indigo sub-BU, blue product, cyan server, amber manager.
- Edges are curved grey arrows. Edge labels are not rendered; only the arrowhead direction shows the relationship.
- Hovering a node dims everything else and highlights that node's edges and immediate neighbours, and raises a tooltip showing **Category**, **Primary IP**, **Host**, **Product**, **Manager**, **Email** and **Business Unit** when present.
- Clicking a node opens a right-hand drawer headed **Node Details (<type>)**. Server nodes show VM, Host, IP, Product, Sub-BU, Business Unit, Manager plus **More Details (Server Profile)**. Manager nodes show **Contact Email** and "Directly overseeing N server entities". Product, sub-BU and business unit nodes show their parent/org attributes. Every type ends with **Linked Entities (n)**.
- Bottom-right sits the **Ownership Legend**, a colour key for the five node types.
- Clicking empty canvas closes the drawer and clears the highlight.

**States.** There is no loading spinner: while the request is in flight the canvas is simply empty. If every node type is unchecked, an overlay reads **All Node Types Currently Hidden** with a **Show All Unit Types** button. A graph build failure surfaces a small banner reading **Topology adjusted for active selection.** with a **Reset** button. A React error boundary wraps the whole view; if it trips, the page is replaced by **Relationship Graph Recovered** and a **Reload Graph Explorer** button.

## 4. Data shown

| UI label | Source field / API | Notes |
|---|---|---|
| Business Unit node | `servers[].business_unit` | Blank becomes the literal node "Unassigned BU" |
| Sub-BU node | `servers[].sub_business_unit` | Omitted entirely when blank |
| Product node | `servers[].product` | Omitted when blank |
| Server node label | `servers[].vm`, falling back to `host` | One node per server record |
| Manager node label | `servers[].manager` | Node identity is the name string only |
| Manager email | `servers[].email` | The last server encountered for that manager wins, so it can be blank |
| Primary IP (tooltip/drawer) | `servers[].primary_ip_address` | |
| Host (tooltip/drawer) | `servers[].host` | |
| Org Code / Customer | `organisation_short_code`, `customer` | Shown on business unit nodes |
| Linked Entities | Graph neighbourhood | Counts connected nodes, not database rows |

## 5. Common workflows

**Confirm ownership for a host named in a ticket.**

1. Open **Ownership**.
2. Set **BU:** to the relevant unit to reduce clutter.
3. Work down the chain visually — the graph is drawn to a canvas, so browser find-in-page cannot locate a hostname for you. Find the product, then the server beneath it.
4. Click the server node and read **Manager** and **Email** in the drawer.
5. Click **More Details (Server Profile)** to open the full record, including relationships and history.

**Find every server under one product.**

1. Uncheck **BU**, **Sub-BU** and **Mgr** so only **Prod** and **Server** remain.
2. Click the product node; its linked servers are listed under **Linked Entities**.
3. Click entries in that list to move between servers without hunting on the canvas.

**Export a governance picture.**

1. Choose **Orbit** or **Linear**.
2. Optionally hide **Mgr** to keep the export focused on structure.
3. Click **Export PNG**. The file is named `nexusinfra-ownership-<mode>-<YYYY-MM-DD>.png` and includes the full graph, not just the visible viewport.

## 6. Gotchas and guardrails

- The graph loads at most 500 servers (`limit: 500`) sorted by host. On a larger estate the page silently shows a subset; there is no "showing 500 of N" warning.
- All filtering is client-side. The **BU:** dropdown does not call the API again, and `allBUs` is built once from the first load.
- Deselecting a node type deletes those nodes *and their edges*. Unchecking **Server**, for example, re-attaches managers to the nearest remaining parent, which changes the meaning of the picture.
- Node identity is the label. Two products with the same name under different business units collapse into a single node, as do two managers who share a name.
- **Reset Layout** only recomputes positions; it does not clear filters or the drawer. The full reset (node types, connections, BU, layout, selection) is only reachable from the empty-state or error-banner button.
- **Export PNG** captures the whole graph at current zoom styling on a `#0B1223` background; it is not a vector export and is not suitable for print at large scale.
- The canvas is not keyboard navigable and exposes no accessible table alternative; users who need a filterable list should use Inventory.

## 7. For developers

**Component structure.** `OwnershipExplorerView` is a thin wrapper that renders `OwnershipErrorBoundary` around `OwnershipExplorerInternal`. The boundary is a class component with `getDerivedStateFromError`, logging to console and offering a state reset.

**Props.**

| Prop | Type | Purpose |
|---|---|---|
| `onSelectServer` | `(id: string) => void` | Called from the server drawer's **More Details** button; `App` sets `selectedServerId`, which opens the global `ServerDetailDrawer` |

The view deliberately receives no `onFilterInventory`; unlike the Infrastructure Map it cannot push filters into Inventory.

**Local state.**

| State | Initial | Triggers |
|---|---|---|
| `servers` | `[]` | Set by `loadData()` on mount |
| `loading` | `true` | Set by `loadData()`; used only to suppress the empty-state overlay |
| `selectedNode` | `null` | Node tap/click/select; cleared by background tap or when filtered out |
| `showConnections` | `true` | Rebuilds the cytoscape instance |
| `visualizationMode` | `'radial'` | Runs the animate-to-new-positions effect |
| `visibleTypes` | all `true` | Rebuilds the cytoscape instance |
| `selectedBU` | `'all'` | Recomputes `activeServers`, rebuilds the graph |
| `allBUs`, `nodeCount`, `edgeCount` | `[]`, `0`, `0` | Set after load / after each build |
| `hoverTooltip` | hidden | mouseover/mouseout on nodes |
| `graphError` | `null` | Catch block of the build effect |

**Effects and the calls they make.**

1. Mount effect → `loadData()` → `api.getServers({ limit: 500 })` (`GET /api/servers?limit=500`). Response is `{ items, total, page, limit, total_pages }`; only `items` is used.
2. Build effect, deps `[servers, visibleTypes, selectedBU, showConnections]` → destroys any existing cytoscape instance, constructs elements from `activeServers`, dedupes node and edge IDs, computes positions via `computePositions(nodes, mode)` and instantiates cytoscape with a `preset` layout. Edges are skipped when either endpoint was not added, which is the guard that prevents cytoscape's "edge to missing node" crash. A `ResizeObserver` calls `cy.resize()`.
3. Layout effect, dep `[visualizationMode]` → animates the existing instance to new preset positions (350 ms) rather than rebuilding.

**Edge construction.** `bu → subbu` (`contains`), `subbu → product` (`provides`, falling back to `bu → product`), `product → server` (`hosts`, falling back up the chain), `server → manager` (`managed_by`). When servers are hidden, the manager is attached to the nearest visible parent with `manages`. Edge IDs are `edge_<source>_<target>_<type>`, so duplicate relationships are collapsed.

**Cross-view navigation.** Drawer button → `onSelectServer(id)`. No filter keys are passed to any other view.

**Extension points and rough edges.**

- `loading` never renders UI; wire it to a skeleton before quoting "loading states" to stakeholders.
- Nothing refreshes `allBUs` after the first load, so newly imported business units need a page reload.
- `computePositions` is a hand-tuned layout with magic constants; it scales acceptably to roughly 100 nodes and degrades after that. A real layout (`cose`/`dagre`) would need a dependency change.
- The `handleReset` (layout) and `handleResetFilters` (filters) functions are easy to confuse; only the latter is bound to the empty-state and error buttons.
- `graphError` is set but the banner text is generic and does not include the error message.

## 8. Related pages

- [Inventory](./02-inventory.md) — the flat, searchable table behind every node here; export and bulk review start there.
- [Business Units](./03-business-units.md) — the BU grouping that this graph draws as the outermost ring.
- [4_Product](./04-products.md) — product-level ownership and server lists.
- [Infrastructure Map](./06-infrastructure-map.md) — the same estate grouped by hypervisor, datacenter, network and BU instead of by ownership.
- [Settings & Audit](./12-settings-and-audit.md) — where ownership edits made through the server drawer are recorded.
