// Single source of truth for incident metrics and breakdowns.
//
// Both the live triage workbench and the archive previously computed the same
// numbers with four subtly different definitions of "patched" and
// "communicated". That meant the same incident could report different totals on
// two pages. These helpers define the rules once:
//
//   patched      = triage status "Patched"/"Patch"
//                  OR patching status "Patched"/"Validated"
//   communicated = triage status "Contacted" OR the communicated flag
//   documented   = notes, patch engineer or ticket number present
//   isolated     = triage status "Isolated"

import type { Incident, IncidentHostDetail, IncidentImpact, ServerRecord } from '../types/index.js';
import type { ReportData } from './incidentReportGenerator.js';
import { percent } from '../utils/format.js';

export interface BusinessUnitImpact {
  name: string;
  total: number;
  patched: number;
  inProgress: number;
  communicated: number;
  isolated: number;
  managers: string[];
}

export interface ManagerImpact {
  name: string;
  email: string;
  total: number;
  patched: number;
  communicated: boolean;
  businessUnits: string[];
}

export interface IncidentAnalysis {
  totalServers: number;
  patchedCount: number;
  patchedPct: number;
  communicatedCount: number;
  communicatedPct: number;
  pendingCommCount: number;
  hasNotesCount: number;
  hasNotesPct: number;
  missingNotesCount: number;
  isolatedCount: number;
  buBreakdown: BusinessUnitImpact[];
  managerAccountability: ManagerImpact[];
  productBreakdown: Array<[string, number]>;
  functionBreakdown: Array<[string, number]>;
  orgBreakdown: Array<[string, number]>;
  triageCounts: Record<string, number>;
  patchingCounts: Record<string, number>;
}

const TRIAGE_STATUSES = [
  'Isolated',
  'Patching',
  'Patched',
  'Patch',
  'Contacted',
  'To be contacted',
  'Not Affected',
  'Uninstalled',
];

const PATCHING_STATUSES = [
  'Not Started',
  'In progress',
  'Patched',
  'Validation required',
  'Validated',
  'Exception',
];

export const isHostPatched = (detail?: IncidentHostDetail): boolean =>
  detail?.status === 'Patched' ||
  detail?.status === 'Patch' ||
  detail?.patching_status === 'Patched' ||
  detail?.patching_status === 'Validated';

export const isHostCommunicated = (detail?: IncidentHostDetail): boolean =>
  detail?.status === 'Contacted' || detail?.communicated === true;

export const hasHostNotes = (detail?: IncidentHostDetail): boolean =>
  Boolean(
    (detail?.notes && detail.notes.trim().length > 0) ||
      detail?.patch_engineer ||
      detail?.ticket_number
  );

const bump = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const sortedEntries = (counts: Record<string, number>): Array<[string, number]> =>
  Object.entries(counts).sort((a, b) => b[1] - a[1]);

export function analyseIncident(
  affectedList: ServerRecord[],
  hostDetails: Record<string, IncidentHostDetail>
): IncidentAnalysis {
  const totalServers = affectedList.length;
  const triageCounts = Object.fromEntries(TRIAGE_STATUSES.map(status => [status, 0]));
  const patchingCounts = Object.fromEntries(PATCHING_STATUSES.map(status => [status, 0]));
  const productCounts: Record<string, number> = {};
  const functionCounts: Record<string, number> = {};
  const orgCounts: Record<string, number> = {};

  const buMap = new Map<string, {
    total: number;
    patched: number;
    inProgress: number;
    communicated: number;
    isolated: number;
    managers: Set<string>;
  }>();
  const managerMap = new Map<string, {
    email: string;
    total: number;
    patched: number;
    communicated: boolean;
    businessUnits: Set<string>;
  }>();

  let patchedCount = 0;
  let communicatedCount = 0;
  let hasNotesCount = 0;
  let isolatedCount = 0;

  for (const server of affectedList) {
    const detail = hostDetails[server.id];
    const patched = isHostPatched(detail);
    const communicated = isHostCommunicated(detail);
    const isolated = detail?.status === 'Isolated';
    const inProgress =
      !patched &&
      (detail?.status === 'Patching' || detail?.patching_status === 'In progress');

    if (patched) patchedCount += 1;
    if (communicated) communicatedCount += 1;
    if (hasHostNotes(detail)) hasNotesCount += 1;
    if (isolated) isolatedCount += 1;

    bump(triageCounts, detail?.status || 'To be contacted');
    bump(patchingCounts, detail?.patching_status || 'Not Started');

    const bu = server.business_unit || 'Unassigned';
    const buEntry = buMap.get(bu) ?? {
      total: 0,
      patched: 0,
      inProgress: 0,
      communicated: 0,
      isolated: 0,
      managers: new Set<string>(),
    };
    buEntry.total += 1;
    if (patched) buEntry.patched += 1;
    if (inProgress) buEntry.inProgress += 1;
    if (communicated) buEntry.communicated += 1;
    if (isolated) buEntry.isolated += 1;
    if (server.manager) buEntry.managers.add(server.manager);
    buMap.set(bu, buEntry);

    const manager = server.manager || 'Unassigned';
    const managerEntry = managerMap.get(manager) ?? {
      email: server.email || '',
      total: 0,
      patched: 0,
      communicated: true,
      businessUnits: new Set<string>(),
    };
    managerEntry.total += 1;
    if (patched) managerEntry.patched += 1;
    if (!communicated) managerEntry.communicated = false;
    if (server.business_unit) managerEntry.businessUnits.add(server.business_unit);
    if (!managerEntry.email && server.email) managerEntry.email = server.email;
    managerMap.set(manager, managerEntry);

    const product = server.product || 'Unassigned Product';
    productCounts[product] = (productCounts[product] ?? 0) + 1;
    const fn = server.function || 'General Server';
    functionCounts[fn] = (functionCounts[fn] ?? 0) + 1;
    const org = server.organisation_abbreviated || 'Unassigned';
    orgCounts[org] = (orgCounts[org] ?? 0) + 1;
  }

  return {
    totalServers,
    patchedCount,
    patchedPct: percent(patchedCount, totalServers),
    communicatedCount,
    communicatedPct: percent(communicatedCount, totalServers),
    pendingCommCount: Math.max(0, totalServers - communicatedCount),
    hasNotesCount,
    hasNotesPct: percent(hasNotesCount, totalServers),
    missingNotesCount: Math.max(0, totalServers - hasNotesCount),
    isolatedCount,
    buBreakdown: Array.from(buMap.entries())
      .map(([name, entry]) => ({
        name,
        total: entry.total,
        patched: entry.patched,
        inProgress: entry.inProgress,
        communicated: entry.communicated,
        isolated: entry.isolated,
        managers: Array.from(entry.managers),
      }))
      .sort((a, b) => b.total - a.total),
    managerAccountability: Array.from(managerMap.entries())
      .map(([name, entry]) => ({
        name,
        email: entry.email,
        total: entry.total,
        patched: entry.patched,
        communicated: entry.communicated,
        businessUnits: Array.from(entry.businessUnits),
      }))
      .sort((a, b) => b.total - a.total),
    productBreakdown: sortedEntries(productCounts),
    functionBreakdown: sortedEntries(functionCounts),
    orgBreakdown: sortedEntries(orgCounts),
    triageCounts,
    patchingCounts,
  };
}

/** Assembles the payload consumed by the Markdown/Word/PDF generators. */
export function buildIncidentReportData(
  incident: Incident,
  impact: IncidentImpact | null,
  affectedList: ServerRecord[],
  hostDetails: Record<string, IncidentHostDetail>,
  analysis: IncidentAnalysis = analyseIncident(affectedList, hostDetails)
): ReportData {
  return {
    incident,
    impact,
    affectedList,
    hostDetails,
    metrics: {
      totalServers: analysis.totalServers,
      patchedCount: analysis.patchedCount,
      patchedPct: analysis.patchedPct,
      communicatedCount: analysis.communicatedCount,
      communicatedPct: analysis.communicatedPct,
      hasNotesCount: analysis.hasNotesCount,
      hasNotesPct: analysis.hasNotesPct,
      isolatedCount: analysis.isolatedCount,
    },
    buBreakdown: analysis.buBreakdown.map(({ name, total, patched, communicated }) => ({
      name,
      total,
      patched,
      communicated,
    })),
    productBreakdown: analysis.productBreakdown,
    managerAccountability: analysis.managerAccountability.map(({ name, email, total, patched }) => ({
      name,
      email,
      total,
      patched,
    })),
  };
}
