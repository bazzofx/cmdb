// Verification harness for the reporting engine.
//
// Run with:  npm run verify:reports
//
// It loads the seeded database, builds all 12 reports, and asserts that each
// report's rows actually match its title/description (filters, groupings and
// totals), that exports are well formed, and that no cell leaks undefined/NaN.
// This is deliberately data-driven: it compares against the raw dataset rather
// than hard-coded demo numbers, so it keeps working after an import/reset.

import fs from 'fs';
import path from 'path';
import {
  REPORT_DEFINITIONS,
  buildReport,
  filterReportRows,
  reportToCsv,
  reportToJson,
  sortReportRows,
} from '../src/services/reportEngine.js';
import type { ReportDataset } from '../src/services/reportEngine.js';
import type { Incident, PatchCampaign, ServerRecord } from '../src/types/index.js';

const dbPath = path.resolve(process.cwd(), 'data/csm_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
  servers: ServerRecord[];
  incidents: Incident[];
  patch_campaigns: PatchCampaign[];
};

const now = new Date().toISOString();
const dataset: ReportDataset = {
  servers: db.servers,
  incidents: db.incidents,
  campaigns: db.patch_campaigns,
  now,
};

const failures: string[] = [];
const notes: string[] = [];

const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isTerminal = (status: string) =>
  ['Patched', 'Validated', 'Exception granted'].includes(status);

// ---------------------------------------------------------------------------
// Generic structural checks
// ---------------------------------------------------------------------------
const reportIds = REPORT_DEFINITIONS.map(definition => definition.id);
check(
  JSON.stringify(reportIds) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  'REPORT_DEFINITIONS must contain ids 1..12 in order'
);

check(new Set(REPORT_DEFINITIONS.map(d => d.title)).size === 12, 'Report titles must be unique');

for (const definition of REPORT_DEFINITIONS) {
  const built = buildReport(definition.id, dataset);
  const keys = definition.columns.map(column => column.key);

  check(keys.length > 0, `Report ${definition.id}: has no columns`);
  check(new Set(keys).size === keys.length, `Report ${definition.id}: duplicate column keys`);
  check(definition.description.length > 10, `Report ${definition.id}: missing description`);
  check(definition.note.length > 10, `Report ${definition.id}: missing methodology note`);
  check(definition.emptyMessage.length > 10, `Report ${definition.id}: missing empty message`);
  check(built.generatedAt.length > 10, `Report ${definition.id}: missing generated timestamp`);
  check(built.summary.length >= 3, `Report ${definition.id}: expected at least 3 summary cards`);
  check(
    built.summary.every(item => item.label && String(item.value).length >= 0),
    `Report ${definition.id}: malformed summary item`
  );

  for (const row of built.rows) {
    for (const column of definition.columns) {
      const value = row[column.key];
      check(
        value === undefined || value === null || typeof value !== 'object',
        `Report ${definition.id}: object/undefined value in column "${column.key}"`
      );
      const rendered = String(value ?? '');
      check(
        !rendered.includes('undefined') && !rendered.includes('NaN') && rendered !== '[object Object]',
        `Report ${definition.id}: bad cell "${column.key}" = "${rendered}"`
      );
    }
    const internalKeys = Object.keys(row).filter(key => key.startsWith('_'));
    check(
      internalKeys.every(key => key === '_serverId' || key === '_drill'),
      `Report ${definition.id}: unexpected internal keys ${internalKeys.join(', ')}`
    );
  }

  // Search helper must never throw and must narrow (or keep) the row count.
  const sample = built.rows[0];
  if (sample) {
    const nameKey = keys[0];
    const sampleValue = String(sample[nameKey] ?? '');
    if (sampleValue) {
      const filtered = filterReportRows(built.rows, sampleValue);
      check(filtered.length >= 1, `Report ${definition.id}: search for "${sampleValue}" lost all rows`);
    }
  }

  // Sorting must not mutate the input array.
  const before = built.rows.slice();
  sortReportRows(built.rows, keys[0], 'asc');
  check(
    built.rows.every((row, index) => row === before[index]),
    `Report ${definition.id}: sortReportRows mutated its input`
  );

  if (built.rows.length > 0) {
    const csv = reportToCsv(definition.columns, built.rows);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    check(lines.length === built.rows.length + 1, `Report ${definition.id}: CSV row count mismatch`);
    check(
      lines[0].split(',').length === definition.columns.length,
      `Report ${definition.id}: CSV header column count mismatch`
    );
    check((csv.match(/"/g) ?? []).length % 2 === 0, `Report ${definition.id}: unbalanced CSV quotes`);

    const json = reportToJson(built, built.rows);
    check(json.record_count === built.rows.length, `Report ${definition.id}: JSON record count mismatch`);
    check(
      (json.rows as Record<string, unknown>[]).every(row => !Object.keys(row).some(key => key.startsWith('_'))),
      `Report ${definition.id}: JSON leaked internal keys`
    );
  }
}

// ---------------------------------------------------------------------------
// Per-report semantic checks
// ---------------------------------------------------------------------------
const servers = dataset.servers;
const total = servers.length;
const bootDisabled = servers.filter(server => server.efi_secure_boot === false);
const activeIncidents = dataset.incidents.filter(
  incident => incident.status !== 'Closed' && incident.status !== 'Archived'
);

// 1 · Complete Server Inventory
{
  const report = buildReport(1, dataset);
  check(report.rows.length === total, 'Report 1: must list every server');
  check(
    report.definition.columns.some(column => column.key === 'networks') &&
      report.definition.columns.some(column => column.key === 'datacenter') &&
      report.definition.columns.some(column => column.key === 'business_unit'),
    'Report 1: must expose hardware, network and organisational columns'
  );
  const poweredOn = servers.filter(server => (server.power_state || '').toLowerCase() === 'poweredon').length;
  const poweredRow = report.summary.find(item => item.label === 'Powered on');
  check(
    poweredRow !== undefined && String(poweredRow.value).startsWith(String(poweredOn)),
    'Report 1: powered-on summary does not match the inventory'
  );
}

// 2 · Business Unit Inventory
{
  const report = buildReport(2, dataset);
  const sum = report.rows.reduce((acc, row) => acc + num(row.servers), 0);
  check(sum === total, `Report 2: grouped rows sum to ${sum}, expected ${total}`);
  check(
    report.rows.every(row => num(row.powered_on) + num(row.powered_off) === num(row.servers)),
    'Report 2: powered on/off does not add up per group'
  );
  check(
    report.rows.every(row => String(row.business_unit).length > 0),
    'Report 2: every row must name a business unit'
  );
  const buCount = new Set(servers.map(server => server.business_unit).filter(Boolean)).size;
  const buSummary = report.summary.find(item => item.label === 'Business units');
  check(buSummary?.value === String(buCount), 'Report 2: business unit count mismatch');
}

// 3 · Ownership Completeness Audit
{
  const report = buildReport(3, dataset);
  const expected = servers.filter(
    server =>
      !server.manager || !server.email || !server.business_unit || !server.sub_business_unit || !server.support_team
  ).length;
  check(report.rows.length === expected, `Report 3: expected ${expected} gap rows, got ${report.rows.length}`);
  check(
    report.rows.every(row => String(row.missing_fields).length > 0),
    'Report 3: every audit row must list at least one missing field'
  );
  check(
    report.rows.every(row => num(row.completeness) < 100),
    'Report 3: fully complete servers must not appear in the gap audit'
  );
}

// 4 · Servers by Manager Directory
{
  const report = buildReport(4, dataset);
  const sum = report.rows.reduce((acc, row) => acc + num(row.servers), 0);
  check(sum === total, `Report 4: manager rows sum to ${sum}, expected ${total}`);
  check(
    report.definition.columns.some(column => column.key === 'manager'),
    'Report 4: manager column missing'
  );
  check(
    report.rows.some(row => row.manager === 'Unassigned') === servers.some(server => !server.manager),
    'Report 4: Unassigned bucket missing or spurious'
  );
}

// 5 · Servers by Support Team
{
  const report = buildReport(5, dataset);
  const sum = report.rows.reduce((acc, row) => acc + num(row.servers), 0);
  check(sum === total, `Report 5: support-team rows sum to ${sum}, expected ${total}`);
  check(
    report.definition.columns.some(column => column.key === 'support_team'),
    'Report 5: support team column missing'
  );
}

// 6 · Servers by Datacenter
{
  const report = buildReport(6, dataset);
  const sum = report.rows.reduce((acc, row) => acc + num(row.servers), 0);
  check(sum === total, `Report 6: datacenter rows sum to ${sum}, expected ${total}`);
  check(
    report.definition.columns.some(column => column.key === 'datacenter'),
    'Report 6: datacenter column missing'
  );
}

// 7 · Servers by Network Segment
{
  const report = buildReport(7, dataset);
  const networks = new Set(
    servers.flatMap(server => [server.network_1, server.network_2, server.network_3]).filter(Boolean)
  );
  check(report.rows.length === networks.size, `Report 7: expected ${networks.size} segments, got ${report.rows.length}`);
  check(
    report.rows.every(row => num(row.servers) >= 1),
    'Report 7: every network row must contain at least one server'
  );
  check(
    report.definition.columns.some(column => column.key === 'role_mix'),
    'Report 7: role mix column missing'
  );
}

// 8 · Secure Boot Disabled
{
  const report = buildReport(8, dataset);
  check(report.rows.length === bootDisabled.length, `Report 8: expected ${bootDisabled.length} rows, got ${report.rows.length}`);
  const byHost = new Map(report.rows.map(row => [row.host, row]));
  for (const server of bootDisabled) {
    check(byHost.has(server.host), `Report 8: missing insecure host ${server.host}`);
  }
  const reportedIds = new Set(report.rows.map(row => row._serverId));
  check(
    servers.filter(server => server.efi_secure_boot !== false).every(server => !reportedIds.has(server.id)),
    'Report 8: a compliant/unknown server leaked into the report'
  );
}

// 9 · Missing Ownership Metadata
{
  const report = buildReport(9, dataset);
  const expected = servers.filter(server => !server.manager || !server.email || !server.business_unit).length;
  check(report.rows.length === expected, `Report 9: expected ${expected} orphan rows, got ${report.rows.length}`);
  check(
    report.rows.every(row => String(row.missing_fields).length > 0),
    'Report 9: rows must state what ownership metadata is missing'
  );
  const byHost = new Map(report.rows.map(row => [row.host, row]));
  for (const server of servers.filter(s => !s.manager || !s.email || !s.business_unit)) {
    check(byHost.has(server.host), `Report 9: missing orphan ${server.host}`);
  }
}

// 10 · Incident Impact Summary
{
  const report = buildReport(10, dataset);
  check(
    report.rows.length === activeIncidents.length,
    `Report 10: expected ${activeIncidents.length} active incidents, got ${report.rows.length}`
  );
  for (const incident of activeIncidents) {
    const row = report.rows.find(entry => entry.reference === incident.incident_reference);
    check(row !== undefined, `Report 10: missing incident ${incident.incident_reference}`);
    if (row) {
      check(
        num(row.affected_servers) === incident.affected_server_ids.length,
        `Report 10: ${incident.incident_reference} affected count mismatch`
      );
      check(String(row.status) === incident.status, `Report 10: ${incident.incident_reference} status mismatch`);
    }
  }
  check(
    report.rows.every(row => String(row.detected).match(/^\d{4}-\d{2}-\d{2}$/)),
    'Report 10: detection dates must be ISO dates'
  );
}

// 11 · Vulnerability Assessment Posture
{
  const report = buildReport(11, dataset);
  check(
    report.rows.every(row => num(row.risk_score) >= 20),
    'Report 11: rows below the risk threshold leaked into the report'
  );
  check(
    report.rows.every(row => String(row.risk_reasons).length > 0),
    'Report 11: every asset must explain its risk drivers'
  );
  check(
    report.rows.every(row => String(row.recommended_action).length > 10),
    'Report 11: every asset must carry a recommended action'
  );

  const incidentLinked = new Set(activeIncidents.flatMap(incident => incident.affected_server_ids));
  const reportIds = new Set(report.rows.map(row => row._serverId).filter(Boolean));
  for (const serverId of incidentLinked) {
    check(reportIds.has(serverId), `Report 11: incident-linked server ${serverId} is missing`);
  }
  for (const server of bootDisabled) {
    check(reportIds.has(server.id), `Report 11: Secure Boot disabled server ${server.host} is missing`);
  }
}

// 12 · Patching Lifecycle Progress
{
  const report = buildReport(12, dataset);
  const targetCount = dataset.campaigns.reduce(
    (acc, campaign) => acc + Object.keys(campaign.targets ?? {}).length,
    0
  );
  check(report.rows.length === targetCount, `Report 12: expected ${targetCount} targets, got ${report.rows.length}`);
  const due = new Map(dataset.campaigns.map(campaign => [campaign.campaign_name, campaign.target_completion_date]));
  let overdue = 0;
  for (const row of report.rows) {
    const dueDate = due.get(String(row.campaign)) ?? '';
    const isOverdue =
      !isTerminal(String(row.status)) && dueDate !== '' && Date.parse(dueDate) < Date.parse(now);
    if (isOverdue) overdue += 1;
    if (isOverdue) {
      check(String(row.overdue).length > 0, `Report 12: overdue target for ${row.server} not flagged`);
    }
    check(
      num(row.campaign_progress) >= 0 && num(row.campaign_progress) <= 100,
      'Report 12: campaign progress out of range'
    );
  }
  const overdueSummary = report.summary.find(item => item.label === 'Overdue targets');
  check(overdueSummary?.value === String(overdue), 'Report 12: overdue summary mismatch');
}

// ---------------------------------------------------------------------------
// Synthetic edge cases (independent of the seeded demo data)
// ---------------------------------------------------------------------------
const base = servers[0];
const gapServer: ServerRecord = {
  ...base,
  id: 'fixture-gap-server',
  host: 'fixture-gap.local',
  vm: 'fixture-gap-vm',
  manager: '',
  email: '',
  business_unit: 'Fixture BU',
  sub_business_unit: '',
  support_team: '',
  efi_secure_boot: false,
};
const fixtureServers = [...servers, gapServer];
const fixtureDataset: ReportDataset = { ...dataset, servers: fixtureServers };

{
  const report3 = buildReport(3, { ...fixtureDataset, now });
  const row = report3.rows.find(entry => entry.host === gapServer.host);
  check(row !== undefined, 'Fixture: report 3 must include a server with ownership gaps');
  check(num(row?.completeness) === 20, 'Fixture: report 3 completeness should be 20% for one of five fields');
  for (const field of ['Manager', 'Email', 'Sub-BU', 'Support Team']) {
    check(String(row?.missing_fields).includes(field), `Fixture: report 3 missing field "${field}"`);
  }

  const report9 = buildReport(9, { ...fixtureDataset, now });
  const orphan = report9.rows.find(entry => entry.host === gapServer.host);
  check(orphan !== undefined, 'Fixture: report 9 must include a server without manager/email');
  check(String(orphan?.missing_fields).includes('Business Unit') === false, 'Fixture: report 9 should not claim a present BU is missing');

  const report2 = buildReport(2, { ...fixtureDataset, now });
  const group = report2.rows.find(entry => entry.business_unit === 'Fixture BU');
  check(group !== undefined, 'Fixture: report 2 must group a new business unit');
  check(group?.sub_business_unit === 'Unassigned', 'Fixture: report 2 must bucket an empty sub-BU as Unassigned');

  const report8 = buildReport(8, { ...fixtureDataset, now });
  check(report8.rows.some(entry => entry.host === gapServer.host), 'Fixture: report 8 must include the insecure host');

  const report11 = buildReport(11, { ...fixtureDataset, now });
  check(report11.rows.some(entry => entry.host === gapServer.host), 'Fixture: report 11 must include the insecure, unowned host');
}

{
  const closedIncident: Incident = {
    ...(dataset.incidents[0] ?? {
      id: 'fixture-seed',
      incident_reference: 'INC-FIXTURE',
      incident_title: 'Fixture',
      description: '',
      severity: 'Low',
      date_detected: now,
      detection_source: 'Fixture',
      ioc_or_vulnerability: '',
      status: 'Open',
      assigned_engineer: 'Fixture',
      affected_server_ids: [],
      created_at: now,
      updated_at: now,
    }),
    id: 'fixture-closed-incident',
    incident_reference: 'INC-FIXTURE-CLOSED',
    status: 'Closed',
    affected_server_ids: [gapServer.id],
  };
  const report = buildReport(10, { ...dataset, incidents: [...dataset.incidents, closedIncident], now });
  check(
    !report.rows.some(entry => entry.reference === 'INC-FIXTURE-CLOSED'),
    'Fixture: report 10 must exclude Closed incidents'
  );

  const lowIncident: Incident = {
    ...closedIncident,
    id: 'fixture-low-incident',
    incident_reference: 'INC-FIXTURE-LOW',
    status: 'Open',
    severity: 'Low',
    affected_server_ids: [gapServer.id],
  };
  const posture = buildReport(11, { ...fixtureDataset, incidents: [lowIncident], now });
  const riskRow = posture.rows.find(entry => entry.host === gapServer.host);
  check(riskRow !== undefined, 'Fixture: report 11 must keep Low-severity incident exposure above the threshold');
}

{
  const campaign: PatchCampaign = {
    id: 'fixture-campaign',
    campaign_name: 'Fixture overdue campaign',
    cve_identifier: 'CVE-FIXTURE-0001',
    patch_reference: '',
    description: '',
    severity: 'High',
    start_date: '2020-01-01',
    target_completion_date: '2020-01-10',
    status: 'Active',
    assigned_engineer: 'Fixture Engineer',
    targets: {
      [gapServer.id]: { server_id: gapServer.id, status: 'Not assessed', notes: '' },
      [base.id]: { server_id: base.id, status: 'Patched', notes: '' },
    },
    created_at: now,
    updated_at: now,
  };
  const report = buildReport(12, {
    servers: fixtureServers,
    incidents: [],
    campaigns: [campaign],
    now: '2026-01-01T00:00:00.000Z',
  });
  check(report.rows.length === 2, 'Fixture: report 12 must list one row per patch target');
  const openRow = report.rows.find(entry => String(entry.server).includes(gapServer.host));
  const doneRow = report.rows.find(entry => String(entry.server).includes(base.host));
  check(String(openRow?.overdue).length > 0, 'Fixture: report 12 must flag an overdue open target');
  check(String(doneRow?.overdue).length === 0, 'Fixture: report 12 must not flag a patched target as overdue');
  check(num(openRow?.campaign_progress) === 50, 'Fixture: report 12 campaign progress should be 50%');
}

{
  const empty = buildReport(1, { servers: [], incidents: [], campaigns: [], now });
  check(empty.rows.length === 0, 'Fixture: report 1 must handle an empty database');
  check(empty.summary[0]?.value === '0', 'Fixture: report 1 empty summary should show zero servers');
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log('Reporting engine verification');
console.log(`Dataset: ${total} servers · ${dataset.incidents.length} incidents · ${dataset.campaigns.length} campaigns\n`);

console.log('ID  Report                                     Rows  Columns');
console.log('--  -----------------------------------------  ----  -------');
for (const definition of REPORT_DEFINITIONS) {
  const built = buildReport(definition.id, dataset);
  console.log(
    `${String(definition.id).padEnd(3)} ${definition.title.slice(0, 41).padEnd(41)} ${String(built.rows.length).padStart(5)} ${String(definition.columns.length).padStart(8)}`
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

if (notes.length > 0) {
  console.log('\nNotes:');
  for (const note of notes) console.log(`  • ${note}`);
}

console.log('\nAll report checks passed.');
