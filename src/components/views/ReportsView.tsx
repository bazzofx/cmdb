import React, { useEffect, useMemo, useState } from 'react';
import {
  FileBarChart2,
  Download,
  Printer,
  Search,
  ExternalLink,
  Server,
  AlertTriangle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileJson,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  REPORT_DEFINITIONS,
  buildReport,
  filterReportRows,
  reportToCsv,
  reportToJson,
  rowCountLabel,
  sortReportRows,
} from '../../services/reportEngine.js';
import type { ReportColumn, ReportRow } from '../../services/reportEngine.js';
import { downloadText } from '../../utils/export.js';
import type { Incident, PatchCampaign, ServerRecord } from '../../types/index.js';

interface ReportsViewProps {
  onSelectServer: (id: string) => void;
  onFilterInventory?: (filters: Record<string, string>) => void;
}

const toneClass: Record<string, string> = {
  neutral: 'text-slate-100',
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
};

const badgeClass = (value: string): string => {
  const normalized = value.toLowerCase();
  if (['critical', 'open', 'disabled', 'failed'].includes(normalized)) {
    return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
  }
  if (['high'].includes(normalized)) {
    return 'border-orange-500/40 bg-orange-500/10 text-orange-300';
  }
  if (['medium', 'investigating', 'scheduled', 'pending', 'suspended'].includes(normalized)) {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }
  if (['low'].includes(normalized)) {
    return 'border-sky-500/40 bg-sky-500/10 text-sky-300';
  }
  if (['enabled', 'patched', 'validated', 'powered on', 'remediated', 'completed', 'contained'].includes(normalized)) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  }
  if (['in progress', 'active', 'under review'].includes(normalized)) {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-300';
  }
  if (['exception granted'].includes(normalized)) {
    return 'border-violet-500/40 bg-violet-500/10 text-violet-300';
  }
  return 'border-white/10 bg-white/5 text-slate-300';
};

// Minimum widths keep text-heavy columns readable; the table scrolls horizontally
// instead of squeezing long names into narrow strips.
const MIN_WIDTHS: Record<string, number> = {
  host: 190,
  vm: 130,
  server: 240,
  email: 180,
  email_list: 240,
  primary_ip_address: 130,
  dns_name: 180,
  networks: 200,
  business_units: 170,
  managers: 150,
  products: 150,
  datacenters: 150,
  support_teams: 130,
  missing_fields: 160,
  campaign: 220,
  notes: 200,
  title: 260,
  risk_reasons: 230,
  recommended_action: 290,
  cve: 180,
  engineer: 150,
  incidents: 130,
  network: 180,
  reference: 120,
};

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectServer, onFilterInventory }) => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [campaigns, setCampaigns] = useState<PatchCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number>(1);
  const [reportSearch, setReportSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loadedAt, setLoadedAt] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serverResponse, incidentResponse, campaignResponse] = await Promise.all([
        api.getServers({ limit: 1000 }),
        api.getIncidents().catch(() => [] as Incident[]),
        api.getPatchCampaigns().catch(() => [] as PatchCampaign[]),
      ]);
      setServers(serverResponse.items);
      setIncidents(incidentResponse);
      setCampaigns(campaignResponse);
      setLoadedAt(new Date().toISOString());
    } catch (err) {
      console.error('Failed to load reporting data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setReportSearch('');
    setSortKey(null);
    setSortDirection('asc');
  }, [selectedReportId]);

  const builtReport = useMemo(
    () => buildReport(selectedReportId, { servers, incidents, campaigns }),
    [selectedReportId, servers, incidents, campaigns]
  );

  const visibleRows = useMemo(() => {
    const filtered = filterReportRows(builtReport.rows, reportSearch);
    return sortReportRows(filtered, sortKey, sortDirection);
  }, [builtReport.rows, reportSearch, sortKey, sortDirection]);

  const activeDefinition = builtReport.definition;
  const hasDrillableRows = visibleRows.some(row => row._serverId || row._drill);

  const handleSort = (column: ReportColumn) => {
    if (sortKey === column.key) {
      setSortDirection(previous => (previous === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDirection(column.kind === 'num' ? 'desc' : 'asc');
    }
  };

  const handleRowClick = (row: ReportRow) => {
    if (row._serverId) {
      onSelectServer(row._serverId);
      return;
    }
    if (row._drill && onFilterInventory) {
      onFilterInventory(row._drill);
    }
  };

  const exportCsv = () => {
    const csv = reportToCsv(activeDefinition.columns, visibleRows);
    downloadText(
      `csm_report_${activeDefinition.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  const exportJson = () => {
    const payload = reportToJson(builtReport, visibleRows);
    downloadText(
      `csm_report_${activeDefinition.id}_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const exportMarkdown = () => {
    const header = `| ${activeDefinition.columns.map(column => column.label).join(' | ')} |`;
    const divider = `| ${activeDefinition.columns.map(() => '---').join(' | ')} |`;
    const body = visibleRows
      .map(row => `| ${activeDefinition.columns.map(column => {
        const value = row[column.key];
        return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      }).join(' | ')} |`)
      .join('\n');
    const summary = builtReport.summary.map(item => `- **${item.label}:** ${item.value}`).join('\n');
    const markdown = `# ${activeDefinition.title}\n\n${activeDefinition.description}\n\n_${activeDefinition.note}_\n\nGenerated ${builtReport.generatedAt} · ${visibleRows.length} records\n\n${summary}\n\n${header}\n${divider}\n${body}\n`;
    downloadText(
      `csm_report_${activeDefinition.id}_${new Date().toISOString().slice(0, 10)}.md`,
      markdown,
      'text/markdown;charset=utf-8'
    );
  };

  const renderCell = (row: ReportRow, column: ReportColumn) => {
    const value = row[column.key];
    const display = value === null || value === undefined || value === '' ? '' : String(value);

    if (!display) {
      return <span className="text-slate-500">—</span>;
    }

    if (column.kind === 'badge') {
      return (
        <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-medium ${badgeClass(display)}`}>
          {display}
        </span>
      );
    }

    if (column.kind === 'num') {
      return <span className="tabular-nums">{display}</span>;
    }

    if (column.kind === 'mono') {
      return <span className="font-mono whitespace-nowrap">{display}</span>;
    }

    return <span title={display}>{display}</span>;
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileBarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">OPERATIONAL REPORTING ENGINE</h1>
            <p className="text-xs text-slate-400">
              {REPORT_DEFINITIONS.length} standard reports built from the live server, incident and patching data.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={visibleRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-xs font-mono cursor-pointer disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={exportJson}
            disabled={visibleRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer disabled:opacity-40"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            onClick={exportMarkdown}
            disabled={visibleRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Markdown</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Reporting data could not be loaded</div>
            <div className="text-rose-300/80">{error}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Report catalogue */}
        <div className="md:col-span-4 rounded-xl soc-glass-panel border border-white/10 p-3 space-y-1.5 max-h-[720px] overflow-y-auto">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider px-2 block mb-2">
            12 Standard Operational Reports
          </span>
          {REPORT_DEFINITIONS.map(report => (
            <button
              key={report.id}
              onClick={() => setSelectedReportId(report.id)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                selectedReportId === report.id
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <div className="font-semibold">{report.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{report.description}</div>
            </button>
          ))}
        </div>

        {/* Report output */}
        <div className="md:col-span-8 rounded-xl soc-glass-panel border border-white/10 p-4 space-y-4">
          <div className="flex flex-col gap-1 pb-3 border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-white font-mono">{activeDefinition.title}</h2>
                <p className="text-[11px] text-slate-400 mt-1">{activeDefinition.description}</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
                {rowCountLabel(visibleRows.length)}
                {visibleRows.length !== builtReport.rows.length ? ` of ${builtReport.rows.length}` : ''}
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{activeDefinition.note}</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-xs font-mono text-slate-400">
              <RefreshCw className="w-5 h-5 text-blue-400 animate-spin mr-2" />
              Loading reporting data…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {builtReport.summary.map(item => (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate" title={item.label}>
                      {item.label}
                    </div>
                    <div className={`text-sm font-semibold mt-0.5 truncate ${toneClass[item.tone ?? 'neutral']}`} title={item.value}>
                      {item.value}
                    </div>
                    {item.hint && <div className="text-[10px] text-slate-500 truncate" title={item.hint}>{item.hint}</div>}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={event => setReportSearch(event.target.value)}
                    placeholder="Search this report…"
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  {hasDrillableRows
                    ? 'Click a row to open the server, or the Inventory pre-filtered to that slice.'
                    : 'Sort by clicking a column header.'}
                </span>
              </div>

              {visibleRows.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-xs text-slate-400">
                  <Server className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    {builtReport.rows.length === 0
                      ? activeDefinition.emptyMessage
                      : 'No records match the current search. Clear the search to see the full report.'}
                  </span>
                </div>
              )}

              <div className="overflow-auto max-h-[560px] rounded-lg border border-white/5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0b1120] border-b border-white/10 text-[10px] font-mono text-slate-400 uppercase">
                      {activeDefinition.columns.map(column => (
                        <th
                          key={column.key}
                          onClick={() => handleSort(column)}
                          title={`Sort by ${column.label}`}
                          style={{ minWidth: MIN_WIDTHS[column.key] }}
                          className={`p-2 whitespace-nowrap cursor-pointer select-none hover:text-white ${
                            column.align === 'right' ? 'text-right' : ''
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {column.label}
                            {sortKey === column.key ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-blue-300" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-blue-300" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-30" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {visibleRows.map((row, index) => {
                      const drillable = Boolean(row._serverId || row._drill);
                      const serverCellKey = row._serverId
                        ? activeDefinition.columns.find(candidate => candidate.key === 'server')?.key ??
                          activeDefinition.columns.find(candidate => candidate.key === 'host')?.key ??
                          activeDefinition.columns[0]?.key
                        : null;
                      return (
                        <tr
                          key={`${selectedReportId}-${index}-${row.host ?? row.business_unit ?? row.manager ?? index}`}
                          onClick={() => drillable && handleRowClick(row)}
                          className={`align-top ${drillable ? 'hover:bg-blue-500/[0.06] cursor-pointer' : ''}`}
                        >
                          {activeDefinition.columns.map((column, columnIndex) => (
                            <td
                              key={column.key}
                              style={{ minWidth: MIN_WIDTHS[column.key] }}
                              className={`p-2 max-w-[280px] ${column.align === 'right' ? 'text-right' : ''} ${
                                columnIndex === 0 ? 'text-white font-medium' : 'text-slate-300'
                              }`}
                            >
                              <div className="flex items-start gap-1">
                                <div className="min-w-0 break-words">{renderCell(row, column)}</div>
                                {drillable &&
                                  (row._drill ? columnIndex === 0 : column.key === serverCellKey) && (
                                    <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-blue-400/40" />
                                  )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-500 font-mono border-t border-white/10 pt-2">
                <span>
                  Data: {servers.length} servers · {incidents.length} incidents · {campaigns.length} patch campaigns
                </span>
                <span>{loadedAt ? `Loaded ${new Date(loadedAt).toLocaleString('en-GB')}` : ''}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
