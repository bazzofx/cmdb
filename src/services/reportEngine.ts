// Reporting engine for the Reports section.
//
// Every report in the UI is defined here: its metadata, its columns, the
// aggregation/filter logic that turns raw CMDB data into rows, and the summary
// cards shown above the table. The view layer (ReportsView.tsx) is deliberately
// dumb: it renders whatever this module returns, so a report cannot drift away
// from its title/description without changing this file.
//
// Design rules:
//  - Rows are plain objects keyed by column key (CSV/JSON friendly).
//  - Internal keys (prefix "_") are stripped from exports: `_serverId` opens the
//    server drawer, `_drill` forwards filters to the Inventory view.
//  - Dates are rendered as ISO `YYYY-MM-DD` (UTC) so exports are deterministic.
//  - Missing values stay as "" in the data and are rendered as "—" by the view.

import type { Incident, PatchCampaign, PatchTarget, ServerRecord } from '../types/index.js';

export type ReportColumnKind = 'text' | 'mono' | 'num' | 'badge';

export interface ReportColumn {
  key: string;
  label: string;
  kind?: ReportColumnKind;
  align?: 'left' | 'right' | 'center';
}

export interface ReportRow {
  [key: string]: string | number | boolean | null | undefined | Record<string, string>;
  _serverId?: string;
  _drill?: Record<string, string>;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

export interface ReportDefinition {
  id: number;
  title: string;
  description: string;
  /** Methodology / guardrail shown under the report title. */
  note: string;
  columns: ReportColumn[];
  emptyMessage: string;
}

export interface BuiltReport {
  definition: ReportDefinition;
  rows: ReportRow[];
  summary: ReportSummaryItem[];
  generatedAt: string;
}

export interface ReportDataset {
  servers: ServerRecord[];
  incidents: Incident[];
  campaigns: PatchCampaign[];
  /** Injectable clock so reports can be tested deterministically. */
  now?: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseInt(text(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const uniq = (values: Array<string | undefined | null>): string[] =>
  Array.from(new Set(values.map(text).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const formatList = (values: Array<string | undefined | null>, max = 3): string => {
  const list = uniq(values);
  if (list.length === 0) return '';
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} +${list.length - max}`;
};

const pct = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const isoDate = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toISOString().slice(0, 10);
};

const daysBetween = (from: string, to: string): number => {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.ceil((end - start) / 86_400_000);
};

const powerLabel = (value: string): string => {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'poweredon') return 'Powered on';
  if (normalized === 'poweredoff') return 'Powered off';
  if (normalized === 'suspended') return 'Suspended';
  return text(value) || 'Unknown';
};

const secureBootLabel = (value: boolean | null): string => {
  if (value === true) return 'Enabled';
  if (value === false) return 'Disabled';
  return 'Unknown';
};

const groupBy = <T,>(items: T[], keyFn: (item: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
};

const byNumberDesc = (key: string, tieKey: string) => (a: ReportRow, b: ReportRow) =>
  num(b[key]) - num(a[key]) || text(a[tieKey]).localeCompare(text(b[tieKey]));

const terminals = new Set<string>(['Patched', 'Validated', 'Exception granted']);

const incidentIsActive = (incident: Incident): boolean =>
  incident.status !== 'Closed' && incident.status !== 'Archived';

const severityRank: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const missingOwnershipFields = (server: ServerRecord): string[] => {
  const fields: string[] = [];
  if (!text(server.manager)) fields.push('Manager');
  if (!text(server.email)) fields.push('Email');
  if (!text(server.business_unit)) fields.push('Business Unit');
  if (!text(server.sub_business_unit)) fields.push('Sub-BU');
  if (!text(server.support_team)) fields.push('Support Team');
  return fields;
};

const serverLabel = (server?: ServerRecord, fallbackId = ''): string => {
  if (!server) return fallbackId ? `Unknown server (${fallbackId})` : 'Unknown server';
  const vm = text(server.vm);
  return vm ? `${server.host} / ${vm}` : server.host;
};

// Recompute a summary string for the report header (record count after search).
export const rowCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'record' : 'records'}`;

// ---------------------------------------------------------------------------
// Report definitions (titles/descriptions mirror the original 12-report set)
// ---------------------------------------------------------------------------

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 1,
    title: '1. Complete Server Inventory',
    description: 'Full export of all hardware, virtual machines, networking, and organizational records.',
    note: 'One row per server with every inventory field used elsewhere in the app: host/VM, environment, ownership, network, datacenter, power and secure-boot state.',
    columns: [
      { key: 'host', label: 'Host', kind: 'mono' },
      { key: 'vm', label: 'VM', kind: 'mono' },
      { key: 'environment', label: 'Env' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'sub_business_unit', label: 'Sub-BU' },
      { key: 'product', label: 'Product' },
      { key: 'function', label: 'Function' },
      { key: 'support_team', label: 'Support Team' },
      { key: 'manager', label: 'Manager' },
      { key: 'email', label: 'Email', kind: 'mono' },
      { key: 'primary_ip_address', label: 'Primary IP', kind: 'mono' },
      { key: 'dns_name', label: 'DNS Name', kind: 'mono' },
      { key: 'datacenter', label: 'Datacenter' },
      { key: 'power_state', label: 'Power', kind: 'badge' },
      { key: 'secure_boot', label: 'Secure Boot', kind: 'badge' },
      { key: 'networks', label: 'Networks' },
      { key: 'customer', label: 'Customer' },
      { key: 'org_code', label: 'Org Code' },
      { key: 'updated_at', label: 'Updated', kind: 'mono' },
    ],
    emptyMessage: 'No servers are present in the CMDB. Import a server CSV from Data Sync.',
  },
  {
    id: 2,
    title: '2. Business Unit Inventory',
    description: 'Grouped breakdown of technical workloads across departments and sub-units.',
    note: 'One row per Business Unit + Sub-BU pair. Click a row to open the Inventory pre-filtered to that slice.',
    columns: [
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'sub_business_unit', label: 'Sub-BU' },
      { key: 'servers', label: 'Servers', kind: 'num' },
      { key: 'powered_on', label: 'Powered On', kind: 'num' },
      { key: 'powered_off', label: 'Powered Off', kind: 'num' },
      { key: 'products', label: 'Products' },
      { key: 'managers', label: 'Managers' },
      { key: 'secure_boot_disabled', label: 'Secure Boot Off', kind: 'num' },
      { key: 'missing_email', label: 'Missing Email', kind: 'num' },
      { key: 'datacenters', label: 'Datacenters' },
    ],
    emptyMessage: 'No servers are present, so there are no business-unit groupings to show.',
  },
  {
    id: 3,
    title: '3. Ownership Completeness Audit',
    description: 'Hygiene audit identifying systems with unassigned managers or missing emails.',
    note: 'Checks five ownership fields (manager, email, business unit, sub-BU, support team). Only servers with at least one gap are listed, worst first.',
    columns: [
      { key: 'host', label: 'Host', kind: 'mono' },
      { key: 'vm', label: 'VM', kind: 'mono' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'sub_business_unit', label: 'Sub-BU' },
      { key: 'manager', label: 'Manager' },
      { key: 'email', label: 'Email', kind: 'mono' },
      { key: 'support_team', label: 'Support Team' },
      { key: 'missing_fields', label: 'Missing Fields' },
      { key: 'completeness', label: 'Completeness', kind: 'num' },
    ],
    emptyMessage: 'Every server has a complete ownership record (manager, email, BU, sub-BU and support team).',
  },
  {
    id: 4,
    title: '4. Servers by Manager Directory',
    description: 'Roster of systems mapped to specific operational and technical leads.',
    note: 'One row per manager. The Unassigned row pools servers without a manager so the gap is visible rather than hidden.',
    columns: [
      { key: 'manager', label: 'Manager' },
      { key: 'email', label: 'Email', kind: 'mono' },
      { key: 'servers', label: 'Servers', kind: 'num' },
      { key: 'powered_on', label: 'Powered On', kind: 'num' },
      { key: 'business_units', label: 'Business Units' },
      { key: 'products', label: 'Products' },
      { key: 'datacenters', label: 'Datacenters' },
      { key: 'secure_boot_disabled', label: 'Secure Boot Off', kind: 'num' },
    ],
    emptyMessage: 'No servers are present, so there is no manager roster to show.',
  },
  {
    id: 5,
    title: '5. Servers by Support Team',
    description: 'Infrastructure breakdown across regional and technical support tiers.',
    note: 'One row per support team, with the estates each team is expected to cover.',
    columns: [
      { key: 'support_team', label: 'Support Team' },
      { key: 'servers', label: 'Servers', kind: 'num' },
      { key: 'powered_on', label: 'Powered On', kind: 'num' },
      { key: 'business_units', label: 'Business Units' },
      { key: 'environments', label: 'Environments' },
      { key: 'datacenters', label: 'Datacenters' },
      { key: 'managers', label: 'Managers' },
      { key: 'missing_email', label: 'Missing Email', kind: 'num' },
    ],
    emptyMessage: 'No servers are present, so there are no support-team workloads to show.',
  },
  {
    id: 6,
    title: '6. Servers by Datacenter',
    description: 'Physical facilities distribution, clusters, and ESXi hosts.',
    note: 'One row per datacenter. Host-level detail (hypervisors) stays one click away in the Infrastructure Map.',
    columns: [
      { key: 'datacenter', label: 'Datacenter' },
      { key: 'servers', label: 'Servers', kind: 'num' },
      { key: 'powered_on', label: 'Powered On', kind: 'num' },
      { key: 'business_units', label: 'Business Units' },
      { key: 'products', label: 'Products' },
      { key: 'support_teams', label: 'Support Teams' },
      { key: 'hosts', label: 'Hypervisor Hosts', kind: 'num' },
      { key: 'network_count', label: 'Networks', kind: 'num' },
      { key: 'secure_boot_disabled', label: 'Secure Boot Off', kind: 'num' },
    ],
    emptyMessage: 'No servers are present, so there are no datacenter totals to show.',
  },
  {
    id: 7,
    title: '7. Servers by Network Segment',
    description: 'Interface connectivity across corporate DMZ, production VLANs, and isolated networks.',
    note: 'Servers are counted once per distinct network. The role mix shows whether the segment is used as a primary, secondary or tertiary interface.',
    columns: [
      { key: 'network', label: 'Network Segment', kind: 'mono' },
      { key: 'role_mix', label: 'Role Mix' },
      { key: 'servers', label: 'Servers', kind: 'num' },
      { key: 'business_units', label: 'Business Units' },
      { key: 'datacenters', label: 'Datacenters' },
      { key: 'support_teams', label: 'Support Teams' },
      { key: 'secure_boot_disabled', label: 'Secure Boot Off', kind: 'num' },
    ],
    emptyMessage: 'No network interfaces are recorded on any server. Populate network_1…network_3 via Data Sync.',
  },
  {
    id: 8,
    title: '8. Servers with Secure Boot Disabled',
    description: 'Critical compliance report for hosts lacking UEFI hardware kernel verification.',
    note: 'Lists only servers where efi_secure_boot is explicitly false. Null means "not reported" and is surfaced separately in the summary.',
    columns: [
      { key: 'host', label: 'Host', kind: 'mono' },
      { key: 'vm', label: 'VM', kind: 'mono' },
      { key: 'primary_ip_address', label: 'Primary IP', kind: 'mono' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'sub_business_unit', label: 'Sub-BU' },
      { key: 'manager', label: 'Manager' },
      { key: 'email', label: 'Email', kind: 'mono' },
      { key: 'support_team', label: 'Support Team' },
      { key: 'environment', label: 'Env' },
      { key: 'datacenter', label: 'Datacenter' },
      { key: 'power_state', label: 'Power', kind: 'badge' },
      { key: 'org_code', label: 'Org Code' },
      { key: 'updated_at', label: 'Updated', kind: 'mono' },
    ],
    emptyMessage: 'No server is reporting Secure Boot as disabled.',
  },
  {
    id: 9,
    title: '9. Missing Ownership Metadata',
    description: 'Orphaned assets lacking business unit or technical owner assignment.',
    note: 'Focused subset of report 3: only manager, email and business unit are required here. Fix these rows to clear the ownership risk.',
    columns: [
      { key: 'host', label: 'Host', kind: 'mono' },
      { key: 'vm', label: 'VM', kind: 'mono' },
      { key: 'missing_fields', label: 'Missing Fields' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'manager', label: 'Manager' },
      { key: 'email', label: 'Email', kind: 'mono' },
      { key: 'support_team', label: 'Support Team' },
      { key: 'datacenter', label: 'Datacenter' },
      { key: 'product', label: 'Product' },
      { key: 'updated_at', label: 'Updated', kind: 'mono' },
    ],
    emptyMessage: 'No orphaned assets: every server has a manager, email and business unit.',
  },
  {
    id: 10,
    title: '10. Incident Impact Summary',
    description: 'Comprehensive damage and stakeholder audit across open security investigations.',
    note: 'Only active incidents (Open, Investigating, Contained, Remediated) are included. Affected servers are resolved live from the server inventory.',
    columns: [
      { key: 'reference', label: 'Incident', kind: 'mono' },
      { key: 'title', label: 'Title' },
      { key: 'severity', label: 'Severity', kind: 'badge' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'detected', label: 'Detected', kind: 'mono' },
      { key: 'affected_servers', label: 'Affected Servers', kind: 'num' },
      { key: 'business_units', label: 'Business Units' },
      { key: 'managers', label: 'Managers' },
      { key: 'emails', label: 'Stakeholder Emails', kind: 'num' },
      { key: 'email_list', label: 'Email Recipients' },
      { key: 'datacenters', label: 'Datacenters' },
      { key: 'support_teams', label: 'Support Teams' },
      { key: 'secure_boot_disabled', label: 'Secure Boot Off', kind: 'num' },
      { key: 'engineer', label: 'Assigned Engineer' },
    ],
    emptyMessage: 'No active incidents. Closed and archived investigations are excluded from this report.',
  },
  {
    id: 11,
    title: '11. Vulnerability Assessment Posture',
    description: 'High-risk assets requiring immediate containment or configuration hardening.',
    note: 'Risk score = incident severity + secure-boot state + ownership gaps + power state. Assets below the risk threshold (20) are omitted.',
    columns: [
      { key: 'host', label: 'Host', kind: 'mono' },
      { key: 'vm', label: 'VM', kind: 'mono' },
      { key: 'primary_ip_address', label: 'Primary IP', kind: 'mono' },
      { key: 'business_unit', label: 'Business Unit' },
      { key: 'manager', label: 'Manager' },
      { key: 'secure_boot', label: 'Secure Boot', kind: 'badge' },
      { key: 'incidents', label: 'Open Incidents' },
      { key: 'max_severity', label: 'Max Severity', kind: 'badge' },
      { key: 'risk_score', label: 'Risk', kind: 'num' },
      { key: 'risk_reasons', label: 'Risk Drivers' },
      { key: 'recommended_action', label: 'Recommended Action' },
    ],
    emptyMessage: 'No assets meet the high-risk threshold: no open incident exposure, secure-boot gaps or ownership failures.',
  },
  {
    id: 12,
    title: '12. Patching Lifecycle Progress',
    description: 'Remediation throughput and outstanding overdue maintenance targets.',
    note: 'One row per patch target. Overdue means the campaign completion date has passed and the target is not Patched, Validated or Exception granted.',
    columns: [
      { key: 'campaign', label: 'Campaign' },
      { key: 'cve', label: 'CVE / Reference', kind: 'mono' },
      { key: 'server', label: 'Server', kind: 'mono' },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'scheduled_date', label: 'Scheduled', kind: 'mono' },
      { key: 'patched_at', label: 'Patched', kind: 'mono' },
      { key: 'validated_at', label: 'Validated', kind: 'mono' },
      { key: 'due_date', label: 'Due', kind: 'mono' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'campaign_progress', label: 'Campaign %', kind: 'num' },
      { key: 'engineer', label: 'Engineer' },
      { key: 'notes', label: 'Notes' },
    ],
    emptyMessage: 'No patch campaigns exist yet. Create one from the incident/patching workflow to track remediation.',
  },
];

export const getReportDefinition = (id: number): ReportDefinition =>
  REPORT_DEFINITIONS.find(definition => definition.id === id) ?? REPORT_DEFINITIONS[0];

// ---------------------------------------------------------------------------
// Individual report builders
// ---------------------------------------------------------------------------

const buildCompleteInventory = (dataset: ReportDataset) => {
  const rows: ReportRow[] = [...dataset.servers]
    .sort((a, b) => a.host.localeCompare(b.host) || a.vm.localeCompare(b.vm))
    .map(server => ({
      host: text(server.host),
      vm: text(server.vm),
      environment: text(server.environment),
      business_unit: text(server.business_unit),
      sub_business_unit: text(server.sub_business_unit),
      product: text(server.product),
      function: text(server.function),
      support_team: text(server.support_team),
      manager: text(server.manager),
      email: text(server.email),
      primary_ip_address: text(server.primary_ip_address),
      dns_name: text(server.dns_name),
      datacenter: text(server.datacenter),
      power_state: powerLabel(server.power_state),
      secure_boot: secureBootLabel(server.efi_secure_boot),
      networks: uniq([server.network_1, server.network_2, server.network_3]).join(', '),
      customer: text(server.customer),
      org_code: text(server.organisation_short_code),
      updated_at: isoDate(server.updated_at),
      _serverId: server.id,
    }));

  const servers = dataset.servers;
  const poweredOn = servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length;
  const networks = uniq(servers.flatMap(s => [s.network_1, s.network_2, s.network_3])).length;

  return {
    rows,
    summary: [
      { label: 'Servers', value: String(servers.length) },
      {
        label: 'Powered on',
        value: `${poweredOn} (${pct(poweredOn, servers.length)}%)`,
        tone: 'good' as const,
      },
      {
        label: 'Powered off / suspended',
        value: String(servers.length - poweredOn),
        tone: servers.length - poweredOn > 0 ? ('warn' as const) : ('neutral' as const),
      },
      { label: 'Business units', value: String(uniq(servers.map(s => s.business_unit)).length) },
      { label: 'Datacenters', value: String(uniq(servers.map(s => s.datacenter)).length) },
      { label: 'Network segments', value: String(networks) },
      {
        label: 'Missing email',
        value: String(servers.filter(s => !text(s.email)).length),
        tone: servers.some(s => !text(s.email)) ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildBusinessUnitInventory = (dataset: ReportDataset) => {
  const groups = groupBy(dataset.servers, s =>
    `${text(s.business_unit)}\u0000${text(s.sub_business_unit)}`
  );

  const rows: ReportRow[] = Array.from(groups.values())
    .map(servers => {
      const first = servers[0];
      const bu = text(first.business_unit);
      const subBu = text(first.sub_business_unit);
      const poweredOn = servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length;
      const drill: Record<string, string> = {};
      if (bu) drill.business_unit = bu;
      if (subBu) drill.sub_business_unit = subBu;

      return {
        business_unit: bu || 'Unassigned',
        sub_business_unit: subBu || 'Unassigned',
        servers: servers.length,
        powered_on: poweredOn,
        powered_off: servers.length - poweredOn,
        products: formatList(servers.map(s => s.product)),
        managers: formatList(servers.map(s => s.manager)),
        secure_boot_disabled: servers.filter(s => s.efi_secure_boot === false).length,
        missing_email: servers.filter(s => !text(s.email)).length,
        datacenters: formatList(servers.map(s => s.datacenter)),
        _drill: Object.keys(drill).length > 0 ? drill : undefined,
      } as ReportRow;
    })
    .sort(byNumberDesc('servers', 'business_unit'));

  const buCount = uniq(dataset.servers.map(s => s.business_unit)).length;
  const subBuCount = uniq(dataset.servers.map(s => s.sub_business_unit)).length;
  const largest = rows[0];

  return {
    rows,
    summary: [
      { label: 'Business units', value: String(buCount) },
      { label: 'Sub-units', value: String(subBuCount) },
      { label: 'Groups', value: String(rows.length) },
      {
        label: 'Largest group',
        value: largest ? `${largest.business_unit} · ${largest.servers}` : '—',
        hint: largest ? 'servers in one BU / sub-BU slice' : undefined,
      },
      {
        label: 'Secure Boot disabled',
        value: String(dataset.servers.filter(s => s.efi_secure_boot === false).length),
        tone: dataset.servers.some(s => s.efi_secure_boot === false) ? ('warn' as const) : ('good' as const),
      },
      {
        label: 'Servers without email',
        value: String(dataset.servers.filter(s => !text(s.email)).length),
        tone: dataset.servers.some(s => !text(s.email)) ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildOwnershipAudit = (dataset: ReportDataset) => {
  const rows: ReportRow[] = dataset.servers
    .map(server => {
      const missing = missingOwnershipFields(server);
      return {
        server,
        missing,
        row: {
          host: text(server.host),
          vm: text(server.vm),
          business_unit: text(server.business_unit),
          sub_business_unit: text(server.sub_business_unit),
          manager: text(server.manager),
          email: text(server.email),
          support_team: text(server.support_team),
          missing_fields: missing.join(', '),
          completeness: Math.round(((5 - missing.length) / 5) * 100),
          _serverId: server.id,
        } as ReportRow,
      };
    })
    .filter(entry => entry.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || a.server.host.localeCompare(b.server.host))
    .map(entry => entry.row);

  const total = dataset.servers.length;
  const fullyAssigned = total - rows.length;
  const missingManager = dataset.servers.filter(s => !text(s.manager)).length;
  const missingEmail = dataset.servers.filter(s => !text(s.email)).length;

  return {
    rows,
    summary: [
      { label: 'Servers audited', value: String(total) },
      {
        label: 'Servers with gaps',
        value: String(rows.length),
        tone: rows.length > 0 ? ('warn' as const) : ('good' as const),
      },
      {
        label: 'Fully assigned',
        value: `${fullyAssigned} (${pct(fullyAssigned, total)}%)`,
        tone: fullyAssigned === total ? ('good' as const) : ('neutral' as const),
      },
      {
        label: 'Missing manager',
        value: String(missingManager),
        tone: missingManager > 0 ? ('bad' as const) : ('good' as const),
      },
      {
        label: 'Missing email',
        value: String(missingEmail),
        tone: missingEmail > 0 ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildManagerDirectory = (dataset: ReportDataset) => {
  const groups = groupBy(dataset.servers, s => text(s.manager) || 'Unassigned');

  const rows: ReportRow[] = Array.from(groups.entries())
    .map(([manager, servers]) => {
      const row: ReportRow = {
        manager,
        email: formatList(servers.map(s => s.email), 2),
        servers: servers.length,
        powered_on: servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length,
        business_units: formatList(servers.map(s => s.business_unit)),
        products: formatList(servers.map(s => s.product)),
        datacenters: formatList(servers.map(s => s.datacenter)),
        secure_boot_disabled: servers.filter(s => s.efi_secure_boot === false).length,
      };
      if (manager !== 'Unassigned') row._drill = { manager };
      return row;
    })
    .sort((a, b) => {
      if (a.manager === 'Unassigned') return 1;
      if (b.manager === 'Unassigned') return -1;
      return num(b.servers) - num(a.servers) || text(a.manager).localeCompare(text(b.manager));
    });

  const realManagers = rows.filter(r => r.manager !== 'Unassigned');
  const unassigned = dataset.servers.filter(s => !text(s.manager)).length;
  const largest = realManagers[0];
  const average = realManagers.length
    ? (realManagers.reduce((sum, r) => sum + num(r.servers), 0) / realManagers.length).toFixed(1)
    : '0';

  return {
    rows,
    summary: [
      { label: 'Managers', value: String(realManagers.length) },
      {
        label: 'Unassigned servers',
        value: String(unassigned),
        tone: unassigned > 0 ? ('bad' as const) : ('good' as const),
      },
      { label: 'Average portfolio', value: `${average} servers`, hint: 'per named manager' },
      {
        label: 'Largest portfolio',
        value: largest ? `${largest.manager} (${largest.servers})` : '—',
      },
    ],
  };
};

const buildSupportTeamReport = (dataset: ReportDataset) => {
  const groups = groupBy(dataset.servers, s => text(s.support_team) || 'Unassigned');

  const rows: ReportRow[] = Array.from(groups.entries())
    .map(([team, servers]) => {
      const row: ReportRow = {
        support_team: team,
        servers: servers.length,
        powered_on: servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length,
        business_units: formatList(servers.map(s => s.business_unit)),
        environments: formatList(servers.map(s => s.environment)),
        datacenters: formatList(servers.map(s => s.datacenter)),
        managers: formatList(servers.map(s => s.manager)),
        missing_email: servers.filter(s => !text(s.email)).length,
      };
      if (team !== 'Unassigned') row._drill = { support_team: team };
      return row;
    })
    .sort((a, b) => {
      if (a.support_team === 'Unassigned') return 1;
      if (b.support_team === 'Unassigned') return -1;
      return byNumberDesc('servers', 'support_team')(a, b);
    });

  const unassigned = dataset.servers.filter(s => !text(s.support_team)).length;
  const largest = rows.find(r => r.support_team !== 'Unassigned');

  return {
    rows,
    summary: [
      { label: 'Support teams', value: String(rows.filter(r => r.support_team !== 'Unassigned').length) },
      {
        label: 'Unassigned servers',
        value: String(unassigned),
        tone: unassigned > 0 ? ('warn' as const) : ('good' as const),
      },
      {
        label: 'Largest team',
        value: largest ? `${largest.support_team} (${largest.servers})` : '—',
      },
      {
        label: 'Servers without email',
        value: String(dataset.servers.filter(s => !text(s.email)).length),
        tone: dataset.servers.some(s => !text(s.email)) ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildDatacenterReport = (dataset: ReportDataset) => {
  const groups = groupBy(dataset.servers, s => text(s.datacenter) || 'Unassigned');

  const rows: ReportRow[] = Array.from(groups.entries())
    .map(([datacenter, servers]) => {
      const row: ReportRow = {
        datacenter,
        servers: servers.length,
        powered_on: servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length,
        business_units: formatList(servers.map(s => s.business_unit)),
        products: formatList(servers.map(s => s.product)),
        support_teams: formatList(servers.map(s => s.support_team)),
        hosts: uniq(servers.map(s => s.host)).length,
        network_count: uniq(servers.flatMap(s => [s.network_1, s.network_2, s.network_3])).length,
        secure_boot_disabled: servers.filter(s => s.efi_secure_boot === false).length,
      };
      if (datacenter !== 'Unassigned') row._drill = { datacenter };
      return row;
    })
    .sort(byNumberDesc('servers', 'datacenter'));

  const largest = rows[0];

  return {
    rows,
    summary: [
      { label: 'Datacenters', value: String(rows.filter(r => r.datacenter !== 'Unassigned').length) },
      {
        label: 'Largest site',
        value: largest ? `${largest.datacenter} (${largest.servers})` : '—',
      },
      {
        label: 'Hypervisor hosts',
        value: String(uniq(dataset.servers.map(s => s.host)).length),
      },
      {
        label: 'Secure Boot disabled',
        value: String(dataset.servers.filter(s => s.efi_secure_boot === false).length),
        tone: dataset.servers.some(s => s.efi_secure_boot === false) ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildNetworkReport = (dataset: ReportDataset) => {
  interface Segment {
    network: string;
    servers: ServerRecord[];
    roles: Record<string, number>;
  }
  const segments = new Map<string, Segment>();

  const addToSegment = (network: string, role: string, server: ServerRecord) => {
    const key = network;
    const existing = segments.get(key) ?? { network, servers: [], roles: {} };
    existing.roles[role] = (existing.roles[role] ?? 0) + 1;
    if (!existing.servers.some(item => item.id === server.id)) existing.servers.push(server);
    segments.set(key, existing);
  };

  for (const server of dataset.servers) {
    const slots: Array<[string, string]> = [
      ['Primary', text(server.network_1)],
      ['Secondary', text(server.network_2)],
      ['Tertiary', text(server.network_3)],
    ];
    for (const [role, network] of slots) {
      if (network) addToSegment(network, role, server);
    }
  }

  const rows: ReportRow[] = Array.from(segments.values())
    .map(segment => ({
      network: segment.network,
      role_mix: ['Primary', 'Secondary', 'Tertiary']
        .filter(role => segment.roles[role])
        .map(role => `${segment.roles[role]} ${role.toLowerCase()}`)
        .join(' · '),
      servers: segment.servers.length,
      business_units: formatList(segment.servers.map(s => s.business_unit)),
      datacenters: formatList(segment.servers.map(s => s.datacenter)),
      support_teams: formatList(segment.servers.map(s => s.support_team)),
      secure_boot_disabled: segment.servers.filter(s => s.efi_secure_boot === false).length,
      _drill: { network: segment.network },
    }))
    .sort(byNumberDesc('servers', 'network'));

  const serversWithNetwork = dataset.servers.filter(server =>
    [server.network_1, server.network_2, server.network_3].some(network => text(network))
  ).length;

  return {
    rows,
    summary: [
      { label: 'Network segments', value: String(rows.length) },
      {
        label: 'Busiest segment',
        value: rows[0] ? `${rows[0].network} (${rows[0].servers})` : '—',
      },
      {
        label: 'Servers with a segment',
        value: `${serversWithNetwork} / ${dataset.servers.length}`,
      },
      {
        label: 'Servers with no network',
        value: String(dataset.servers.length - serversWithNetwork),
        tone: dataset.servers.length - serversWithNetwork > 0 ? ('warn' as const) : ('good' as const),
      },
    ],
  };
};

const buildSecureBootReport = (dataset: ReportDataset) => {
  const disabled = dataset.servers
    .filter(server => server.efi_secure_boot === false)
    .sort((a, b) => a.business_unit.localeCompare(b.business_unit) || a.host.localeCompare(b.host));

  const rows: ReportRow[] = disabled.map(server => ({
    host: text(server.host),
    vm: text(server.vm),
    primary_ip_address: text(server.primary_ip_address),
    business_unit: text(server.business_unit),
    sub_business_unit: text(server.sub_business_unit),
    manager: text(server.manager),
    email: text(server.email),
    support_team: text(server.support_team),
    environment: text(server.environment),
    datacenter: text(server.datacenter),
    power_state: powerLabel(server.power_state),
    org_code: text(server.organisation_short_code),
    updated_at: isoDate(server.updated_at),
    _serverId: server.id,
  }));

  const unknown = dataset.servers.filter(server => server.efi_secure_boot === null).length;

  return {
    rows,
    summary: [
      {
        label: 'Disabled',
        value: String(disabled.length),
        tone: disabled.length > 0 ? ('bad' as const) : ('good' as const),
      },
      {
        label: 'Share of estate',
        value: `${pct(disabled.length, dataset.servers.length)}%`,
        hint: `${dataset.servers.length} servers total`,
      },
      {
        label: 'Business units affected',
        value: String(uniq(disabled.map(s => s.business_unit)).length),
      },
      {
        label: 'Datacenters affected',
        value: String(uniq(disabled.map(s => s.datacenter)).length),
      },
      {
        label: 'Unknown state',
        value: String(unknown),
        tone: unknown > 0 ? ('warn' as const) : ('neutral' as const),
        hint: 'efi_secure_boot is null',
      },
    ],
  };
};

const buildMissingOwnershipReport = (dataset: ReportDataset) => {
  const affected = dataset.servers.filter(
    server => !text(server.manager) || !text(server.email) || !text(server.business_unit)
  );

  const rows: ReportRow[] = affected
    .map(server => {
      const missing: string[] = [];
      if (!text(server.manager)) missing.push('Manager');
      if (!text(server.email)) missing.push('Email');
      if (!text(server.business_unit)) missing.push('Business Unit');
      return {
        host: text(server.host),
        vm: text(server.vm),
        missing_fields: missing.join(', '),
        business_unit: text(server.business_unit),
        manager: text(server.manager),
        email: text(server.email),
        support_team: text(server.support_team),
        datacenter: text(server.datacenter),
        product: text(server.product),
        updated_at: isoDate(server.updated_at),
        _serverId: server.id,
      } as ReportRow;
    })
    .sort((a, b) => text(a.host).localeCompare(text(b.host)));

  return {
    rows,
    summary: [
      {
        label: 'Affected servers',
        value: String(affected.length),
        tone: affected.length > 0 ? ('warn' as const) : ('good' as const),
      },
      {
        label: 'Missing manager',
        value: String(dataset.servers.filter(s => !text(s.manager)).length),
        tone: 'bad' as const,
      },
      { label: 'Missing business unit', value: String(dataset.servers.filter(s => !text(s.business_unit)).length) },
      {
        label: 'Missing email',
        value: String(dataset.servers.filter(s => !text(s.email)).length),
        tone: 'warn' as const,
      },
      {
        label: 'Share of estate',
        value: `${pct(affected.length, dataset.servers.length)}%`,
      },
    ],
  };
};

const buildIncidentImpact = (dataset: ReportDataset) => {
  const active = dataset.incidents.filter(incidentIsActive);
  const serverById = new Map(dataset.servers.map(server => [server.id, server]));

  const rows: ReportRow[] = active
    .map(incident => {
      const affected = incident.affected_server_ids
        .map(id => serverById.get(id))
        .filter((server): server is ServerRecord => Boolean(server));

      return {
        reference: text(incident.incident_reference),
        title: text(incident.incident_title),
        severity: text(incident.severity),
        status: text(incident.status),
        detected: isoDate(incident.date_detected),
        affected_servers: affected.length,
        business_units: formatList(affected.map(s => s.business_unit), 4),
        managers: formatList(affected.map(s => s.manager), 2),
        emails: uniq(affected.map(s => s.email)).length,
        email_list: formatList(affected.map(s => s.email), 3),
        datacenters: formatList(affected.map(s => s.datacenter), 2),
        support_teams: formatList(affected.map(s => s.support_team), 2),
        secure_boot_disabled: affected.filter(s => s.efi_secure_boot === false).length,
        engineer: text(incident.assigned_engineer),
      } as ReportRow;
    })
    .sort(
      (a, b) =>
        (severityRank[text(b.severity)] ?? 0) - (severityRank[text(a.severity)] ?? 0) ||
        text(b.detected).localeCompare(text(a.detected))
    );

  const allAffectedIds = new Set(active.flatMap(incident => incident.affected_server_ids));
  const totalAffected = active.reduce((sum, incident) => sum + incident.affected_server_ids.length, 0);
  const severityCounts = active.reduce<Record<string, number>>((acc, incident) => {
    acc[incident.severity] = (acc[incident.severity] ?? 0) + 1;
    return acc;
  }, {});
  const stakeholders = uniq(
    Array.from(allAffectedIds)
      .map(id => serverById.get(id)?.email)
      .filter((email): email is string => Boolean(email))
  );

  return {
    rows,
    summary: [
      {
        label: 'Active incidents',
        value: String(active.length),
        tone: active.length > 0 ? ('bad' as const) : ('good' as const),
      },
      { label: 'Affected server links', value: String(totalAffected), hint: 'one server in two incidents counts twice' },
      { label: 'Unique affected servers', value: String(allAffectedIds.size) },
      {
        label: 'Critical / High',
        value: String((severityCounts.Critical ?? 0) + (severityCounts.High ?? 0)),
      },
      { label: 'Stakeholder emails', value: String(stakeholders.length) },
      { label: 'Business units involved', value: String(uniq(Array.from(allAffectedIds).map(id => serverById.get(id)?.business_unit)).length) },
    ],
  };
};

const buildVulnerabilityPosture = (dataset: ReportDataset) => {
  const activeIncidents = dataset.incidents.filter(incidentIsActive);
  const incidentsByServer = new Map<string, Incident[]>();

  for (const incident of activeIncidents) {
    for (const serverId of incident.affected_server_ids) {
      const list = incidentsByServer.get(serverId) ?? [];
      list.push(incident);
      incidentsByServer.set(serverId, list);
    }
  }

  const entries = dataset.servers
    .map(server => {
      const incidents = incidentsByServer.get(server.id) ?? [];
      const secureBootDisabled = server.efi_secure_boot === false;
      const missingManager = !text(server.manager);
      const missingEmail = !text(server.email);
      const poweredOn = (server.power_state || '').toLowerCase() === 'poweredon';

      let score = 0;
      const reasons: string[] = [];
      let maxSeverity = '';

      if (incidents.length > 0) {
        maxSeverity = incidents.reduce((max, incident) =>
          (severityRank[incident.severity] ?? 0) > (severityRank[max] ?? 0) ? incident.severity : max,
        'Low');
        score += severityRank[maxSeverity] === 4 ? 55 : severityRank[maxSeverity] === 3 ? 40 : severityRank[maxSeverity] === 2 ? 25 : 20;
        reasons.push(`Affected by ${incidents.length} active incident${incidents.length === 1 ? '' : 's'}`);
        if (incidents.length > 1) score += Math.min(15, (incidents.length - 1) * 10);
      }
      if (secureBootDisabled) {
        score += 25;
        reasons.push('Secure Boot disabled');
      }
      if (missingManager) {
        score += 8;
        reasons.push('No manager assigned');
      }
      if (missingEmail) {
        score += 4;
        reasons.push('No owner email');
      }
      if (poweredOn && (incidents.length > 0 || secureBootDisabled)) {
        score += 3;
        reasons.push('Online attack surface');
      }

      score = Math.min(100, score);

      let recommended = 'Review access and ownership; no immediate containment required.';
      if (incidents.length > 0 && secureBootDisabled) {
        recommended =
          'Contain: isolate the host, enable UEFI Secure Boot, rotate credentials and re-image if compromise is suspected.';
      } else if (incidents.length > 0) {
        recommended = 'Investigate: validate IOC exposure, apply the vendor patch and confirm EDR coverage.';
      } else if (secureBootDisabled) {
        recommended = 'Harden: enable UEFI Secure Boot and validate firmware integrity before the next audit.';
      } else if (missingManager || missingEmail) {
        recommended = 'Assign ownership: nominate a manager and owner email, then re-run the ownership audit.';
      }

      return {
        server,
        score,
        reasons,
        maxSeverity,
        incidents,
        recommended,
        poweredOn,
      };
    })
    .filter(entry => entry.score >= 20)
    .sort((a, b) => b.score - a.score || a.server.host.localeCompare(b.server.host));

  const rows: ReportRow[] = entries.map(entry => ({
    host: text(entry.server.host),
    vm: text(entry.server.vm),
    primary_ip_address: text(entry.server.primary_ip_address),
    business_unit: text(entry.server.business_unit),
    manager: text(entry.server.manager),
    secure_boot: secureBootLabel(entry.server.efi_secure_boot),
    incidents: entry.incidents.map(incident => incident.incident_reference).join(', '),
    max_severity: entry.maxSeverity,
    risk_score: entry.score,
    risk_reasons: entry.reasons.join(' · '),
    recommended_action: entry.recommended,
    _serverId: entry.server.id,
  }));

  return {
    rows,
    summary: [
      {
        label: 'High-risk assets',
        value: String(entries.length),
        tone: entries.length > 0 ? ('bad' as const) : ('good' as const),
        hint: 'risk score ≥ 20',
      },
      {
        label: 'Critical exposure',
        value: String(entries.filter(entry => entry.score >= 70).length),
        hint: 'risk score ≥ 70',
      },
      { label: 'Incident-linked', value: String(entries.filter(entry => entry.incidents.length > 0).length) },
      {
        label: 'Secure Boot disabled',
        value: String(entries.filter(entry => entry.server.efi_secure_boot === false).length),
      },
      {
        label: 'Without a manager',
        value: String(entries.filter(entry => !text(entry.server.manager)).length),
      },
    ],
  };
};

const buildPatchingProgress = (dataset: ReportDataset) => {
  const now = dataset.now ?? new Date().toISOString();
  const serverById = new Map(dataset.servers.map(server => [server.id, server]));
  const rows: ReportRow[] = [];
  const campaignStats: Array<{ name: string; total: number; done: number; overdue: number; due: string }> = [];

  for (const campaign of dataset.campaigns) {
    const targets = Object.entries(campaign.targets ?? {});
    const done = targets.filter(([, target]) => terminals.has(text(target.status))).length;
    const due = text(campaign.target_completion_date);
    let overdueCount = 0;

    for (const [serverId, target] of targets) {
      const status = text((target as PatchTarget).status);
      const isTerminal = terminals.has(status);
      const overdueDays = !isTerminal && due ? Math.max(0, daysBetween(due, now)) : 0;
      if (overdueDays > 0) overdueCount += 1;

      const server = serverById.get(serverId);
      rows.push({
        campaign: text(campaign.campaign_name),
        cve: text(campaign.cve_identifier) || text(campaign.patch_reference),
        server: serverLabel(server, serverId),
        status,
        scheduled_date: isoDate((target as PatchTarget).scheduled_date),
        patched_at: isoDate((target as PatchTarget).patched_at),
        validated_at: isoDate((target as PatchTarget).validated_at),
        due_date: due,
        overdue: overdueDays > 0 ? `${overdueDays} day${overdueDays === 1 ? '' : 's'}` : '',
        campaign_progress: pct(done, targets.length),
        engineer: text(campaign.assigned_engineer),
        notes: text((target as PatchTarget).notes),
        _serverId: server?.id,
      });
    }

    campaignStats.push({ name: text(campaign.campaign_name), total: targets.length, done, overdue: overdueCount, due });
  }

  rows.sort(
    (a, b) =>
      num(text(b.overdue).replace(/[^0-9]/g, '')) - num(text(a.overdue).replace(/[^0-9]/g, '')) ||
      text(a.due_date).localeCompare(text(b.due_date)) ||
      text(a.server).localeCompare(text(b.server))
  );

  const totalTargets = campaignStats.reduce((sum, campaign) => sum + campaign.total, 0);
  const doneTargets = campaignStats.reduce((sum, campaign) => sum + campaign.done, 0);
  const overdueTargets = campaignStats.reduce((sum, campaign) => sum + campaign.overdue, 0);
  const atRisk = campaignStats.filter(campaign => campaign.overdue > 0 || (campaign.due && campaign.due < now.slice(0, 10) && campaign.done < campaign.total)).length;

  return {
    rows,
    summary: [
      { label: 'Campaigns', value: String(dataset.campaigns.length) },
      { label: 'Targets', value: String(totalTargets) },
      {
        label: 'Remediated',
        value: `${doneTargets} (${pct(doneTargets, totalTargets)}%)`,
        tone: totalTargets > 0 && doneTargets === totalTargets ? ('good' as const) : ('neutral' as const),
        hint: 'patched · validated · exception',
      },
      {
        label: 'Overdue targets',
        value: String(overdueTargets),
        tone: overdueTargets > 0 ? ('bad' as const) : ('good' as const),
      },
      {
        label: 'Campaigns at risk',
        value: String(atRisk),
        tone: atRisk > 0 ? ('warn' as const) : ('good' as const),
        hint: 'past due date with open targets',
      },
    ],
  };
};

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export function buildReport(id: number, dataset: ReportDataset): BuiltReport {
  const definition = getReportDefinition(id);
  let result: { rows: ReportRow[]; summary: ReportSummaryItem[] };

  switch (id) {
    case 2:
      result = buildBusinessUnitInventory(dataset);
      break;
    case 3:
      result = buildOwnershipAudit(dataset);
      break;
    case 4:
      result = buildManagerDirectory(dataset);
      break;
    case 5:
      result = buildSupportTeamReport(dataset);
      break;
    case 6:
      result = buildDatacenterReport(dataset);
      break;
    case 7:
      result = buildNetworkReport(dataset);
      break;
    case 8:
      result = buildSecureBootReport(dataset);
      break;
    case 9:
      result = buildMissingOwnershipReport(dataset);
      break;
    case 10:
      result = buildIncidentImpact(dataset);
      break;
    case 11:
      result = buildVulnerabilityPosture(dataset);
      break;
    case 12:
      result = buildPatchingProgress(dataset);
      break;
    case 1:
    default:
      result = buildCompleteInventory(dataset);
      break;
  }

  return {
    definition,
    rows: result.rows,
    summary: result.summary,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Search / sort / export helpers
// ---------------------------------------------------------------------------

export function filterReportRows(rows: ReportRow[], query: string): ReportRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(row =>
    Object.entries(row)
      .filter(([key]) => !key.startsWith('_'))
      .some(([, value]) => text(value).toLowerCase().includes(needle))
  );
}

export function sortReportRows(rows: ReportRow[], column: string | null, direction: 'asc' | 'desc'): ReportRow[] {
  if (!column) return rows;
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    const leftText = text(left);
    const rightText = text(right);
    if (!leftText && rightText) return 1;
    if (leftText && !rightText) return -1;
    return leftText.localeCompare(rightText, undefined, { numeric: true }) * factor;
  });
}

const csvCell = (value: unknown): string => {
  const raw = text(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

export function reportToCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const header = columns.map(column => csvCell(column.label)).join(',');
  const body = rows.map(row => columns.map(column => csvCell(row[column.key])).join(','));
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export function reportToJson(
  built: BuiltReport,
  rows: ReportRow[]
): Record<string, unknown> {
  const cleanRows = rows.map(row =>
    Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_')))
  );
  return {
    report: built.definition.title,
    report_id: built.definition.id,
    description: built.definition.description,
    note: built.definition.note,
    generated_at: built.generatedAt,
    summary: built.summary.map(item => ({ label: item.label, value: item.value })),
    record_count: cleanRows.length,
    columns: built.definition.columns.map(column => column.label),
    rows: cleanRows,
  };
}
