// Verification for the shared incident analysis rules.
// Run with: npx tsx scripts/verify-incident-analysis.ts

import fs from 'fs';
import path from 'path';
import { analyseIncident, buildIncidentReportData, hasHostNotes, isHostCommunicated, isHostPatched } from '../src/services/incidentAnalysis.js';
import { generateMarkdownReport } from '../src/services/incidentReportGenerator.js';
import type { Incident, IncidentHostDetail, ServerRecord } from '../src/types/index.js';

const failures: string[] = [];
const check = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const detail = (overrides: Partial<IncidentHostDetail>): IncidentHostDetail => ({
  server_id: 's1',
  status: 'To be contacted',
  ...overrides,
});

// Canonical rules -----------------------------------------------------------
check(isHostPatched(detail({ status: 'Patched' })), 'status Patched should count as patched');
check(isHostPatched(detail({ status: 'Patch' })), 'status Patch should count as patched');
check(isHostPatched(detail({ patching_status: 'Validated' })), 'patching_status Validated should count as patched');
check(!isHostPatched(detail({ status: 'Patching' })), 'Patching alone is not patched');
check(isHostCommunicated(detail({ status: 'Contacted' })), 'Contacted status should count as communicated');
check(isHostCommunicated(detail({ communicated: true })), 'communicated flag should count');
check(!isHostCommunicated(detail({ status: 'Patching' })), 'Patching alone is not communicated');
check(!hasHostNotes(detail({ notes: '  ' })), 'whitespace-only notes should not count as documented');
check(hasHostNotes(detail({ patch_engineer: 'Alex' })), 'patch engineer should count as documented');
check(hasHostNotes(detail({ ticket_number: 'INC-1' })), 'ticket should count as documented');
check(!hasHostNotes(detail({ status: 'Patched' })), 'status alone is not documentation');

check(!hasHostNotes(detail({ notes: '' })), 'empty notes should not count');

const servers: ServerRecord[] = ['s1', 's2', 's3'].map((id, index) => ({
  id,
  host: `host-${index}`,
  vm: `vm-${index}`,
  support_team: 'UK',
  environment: 'SSE',
  manager: index === 2 ? '' : 'Manager A',
  email: 'owner@example.com',
  customer: 'Central',
  power_state: 'poweredOn',
  dns_name: '',
  primary_ip_address: `10.0.0.${index}`,
  efi_secure_boot: true,
  annotation: '',
  business_unit: index === 0 ? 'BU-A' : 'BU-B',
  sub_business_unit: 'Sub',
  product: index === 0 ? 'Product X' : 'Product Y',
  function: 'App',
  business_environment: 'SSE',
  organisation_short_code: 'ORG',
  organisation_abbreviated: 'Org',
  datacenter: 'DC1',
  network_1: 'NET',
  network_2: '',
  network_3: '',
  imported_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}));

const hostDetails: Record<string, IncidentHostDetail> = {
  s1: detail({ status: 'Patched', communicated: true, notes: 'fixed', patch_engineer: 'Alex' }),
  s2: detail({ status: 'Patching', patching_status: 'Validated', communicated: true }),
  s3: detail({ status: 'To be contacted', patching_status: 'Not Started' }),
};

const analysis = analyseIncident(servers, hostDetails);
check(analysis.patchedCount === 2, `expected 2 patched, got ${analysis.patchedCount}`);
check(analysis.patchedPct === 67, `expected 67%, got ${analysis.patchedPct}`);
check(analysis.communicatedCount === 2, `expected 2 communicated, got ${analysis.communicatedCount}`);
check(analysis.hasNotesCount === 1, `expected 1 documented, got ${analysis.hasNotesCount}`);
check(analysis.totalServers === 3, 'total servers mismatch');
check(analysis.buBreakdown.reduce((sum, bu) => sum + bu.total, 0) === 3, 'BU breakdown total mismatch');
check(
  analysis.buBreakdown.find(bu => bu.name === 'BU-A')?.patched === 1,
  'BU-A patched count mismatch'
);
check(
  analysis.managerAccountability.find(mgr => mgr.name === 'Unassigned')?.total === 1,
  'Unassigned manager bucket missing'
);
check(
  analysis.productBreakdown.length === 2,
  'product breakdown should have two entries'
);

const incident: Incident = {
  id: 'inc-1',
  incident_reference: 'INC-TEST-1',
  incident_title: 'Test incident',
  description: 'Fixture',
  severity: 'High',
  date_detected: '2026-01-01T00:00:00.000Z',
  detection_source: 'Fixture',
  ioc_or_vulnerability: 'CVE-TEST',
  status: 'Investigating',
  assigned_engineer: 'Tester',
  affected_server_ids: servers.map(server => server.id),
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const report = buildIncidentReportData(incident, null, servers, hostDetails, analysis);
check(report.metrics.patchedCount === analysis.patchedCount, 'report patched count diverges from analysis');
check(report.metrics.hasNotesCount === analysis.hasNotesCount, 'report notes count diverges');
check(report.buBreakdown.length === analysis.buBreakdown.length, 'report BU breakdown diverges');

const markdown = generateMarkdownReport(report);
check(markdown.includes('INC-TEST-1'), 'markdown report missing incident reference');
check(markdown.includes('2 / 3 servers'), 'markdown report missing patched total');
check(markdown.includes('Product X'), 'markdown report missing product breakdown');

// A real seeded incident should also analyse and export without throwing.
const dbPath = path.resolve(process.cwd(), 'data/csm_database.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as { incidents: Incident[]; servers: ServerRecord[] };
  for (const seeded of db.incidents) {
    const affected = db.servers.filter(server => seeded.affected_server_ids.includes(server.id));
    const seededAnalysis = analyseIncident(affected, seeded.host_details || {});
    const data = buildIncidentReportData(seeded, null, affected, seeded.host_details || {}, seededAnalysis);
    const md = generateMarkdownReport(data);
    check(md.length > 100, `seeded incident ${seeded.incident_reference} produced an empty report`);
  }
}

if (failures.length > 0) {
  console.error(`${failures.length} incident-analysis check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('Incident analysis checks passed');
console.log(`Fixture: ${analysis.patchedCount}/${analysis.totalServers} patched, ${analysis.communicatedCount} communicated, ${analysis.hasNotesCount} documented`);
