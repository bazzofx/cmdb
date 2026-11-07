import { useState, useEffect, useMemo } from 'react';
import {
  FolderArchive,
  RotateCcw,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Server,
  ChevronDown,
  Search,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { Incident, IncidentImpact, IncidentHostDetail } from '../../types/index.js';
import { analyseIncident, buildIncidentReportData } from '../../services/incidentAnalysis.js';
import { exportIncidentReport } from '../../services/incidentReportExport.js';

interface ArchivedIncidentsViewProps {
  onSelectServer: (id: string) => void;
  onNavigateToActiveIncidents?: () => void;
  onRefreshIncidents?: () => void;
  canWrite?: boolean;
}

export const ArchivedIncidentsView: React.FC<ArchivedIncidentsViewProps> = ({
  onSelectServer,
  onNavigateToActiveIncidents,
  onRefreshIncidents,
  canWrite = true,
}) => {
  const [archivedIncidents, setArchivedIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [impact, setImpact] = useState<IncidentImpact | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    loadArchivedIncidents();
  }, []);

  const loadArchivedIncidents = async () => {
    try {
      const data = await api.getIncidents();
      const closed = data.filter(i => i.status === 'Closed' || i.status === 'Archived');
      setArchivedIncidents(closed);
      if (closed.length > 0 && !selectedIncidentId) {
        handleSelectIncident(closed[0].id, closed[0]);
      }
    } catch (err) {
      console.error('Failed to load archived incidents:', err);
    }
  };

  const handleSelectIncident = async (id: string, incidentObj?: Incident) => {
    setSelectedIncidentId(id);
    try {
      const impactData = await api.getIncidentImpact(id);
      setImpact(impactData);
    } catch (err) {
      console.error('Failed to fetch archived incident impact:', err);
    }
  };

  const selectedIncident = archivedIncidents.find(i => i.id === selectedIncidentId);
  const hostDetails: Record<string, IncidentHostDetail> = selectedIncident?.host_details || {};
  const affectedList = useMemo(() => impact?.affected_servers ?? [], [impact]);
  const totalServers = affectedList.length;

  // One shared definition of patched / communicated / documented for both the
  // active triage page and this archive.
  const analysis = useMemo(
    () => analyseIncident(affectedList, hostDetails),
    [affectedList, hostDetails]
  );
  const {
    buBreakdown,
    productBreakdown,
    managerAccountability,
    patchedCount,
    patchedPct,
    communicatedCount: commCount,
    hasNotesCount: notesCount,
    isolatedCount,
  } = analysis;

  // Reopen handler
  const handleReopen = async () => {
    if (!selectedIncident) return;
    setReopening(true);
    try {
      await api.updateIncident(selectedIncident.id, {
        status: 'Investigating',
        closed_at: undefined,
        closed_by: undefined,
      });
      if (onRefreshIncidents) onRefreshIncidents();
      if (onNavigateToActiveIncidents) {
        onNavigateToActiveIncidents();
      } else {
        await loadArchivedIncidents();
      }
    } catch (err) {
      console.error('Failed to reopen incident:', err);
    } finally {
      setReopening(false);
    }
  };

  // Report export handlers (shared with the active triage page)
  const getReportPayload = () =>
    selectedIncident
      ? buildIncidentReportData(selectedIncident, impact, affectedList, hostDetails, analysis)
      : null;

  const handleExportMarkdown = () => {
    const payload = getReportPayload();
    if (!payload) return;
    exportIncidentReport(payload, 'markdown');
    setExportDropdownOpen(false);
  };

  const handleExportWord = async () => {
    const payload = getReportPayload();
    if (!payload) return;
    setIsExporting(true);
    try {
      await exportIncidentReport(payload, 'word');
    } catch (err) {
      console.error('Word export failed:', err);
    } finally {
      setIsExporting(false);
      setExportDropdownOpen(false);
    }
  };

  const handleExportPdf = () => {
    const payload = getReportPayload();
    if (!payload) return;
    setIsExporting(true);
    try {
      exportIncidentReport(payload, 'pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
      setExportDropdownOpen(false);
    }
  };

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return affectedList;
    const q = searchQuery.toLowerCase();
    return affectedList.filter(s =>
      s.host.toLowerCase().includes(q) ||
      s.vm.toLowerCase().includes(q) ||
      s.primary_ip_address.toLowerCase().includes(q) ||
      (s.business_unit || '').toLowerCase().includes(q) ||
      (s.manager || '').toLowerCase().includes(q)
    );
  }, [affectedList, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#0D1424]/90 border border-slate-800/80 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide font-sans">
                ARCHIVED INCIDENTS REPOSITORY
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase font-semibold">
                {archivedIncidents.length} Archived
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Closed incident audit trail, complete remediation history, and multi-format report export (PDF, Word, Markdown).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {selectedIncident && (
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={isExporting}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-[#0e1629] border border-slate-700/80 shadow-2xl py-1.5 z-50 text-xs font-sans">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-slate-400 border-b border-white/5">
                    Select Report Format:
                  </div>
                  <button
                    onClick={handleExportPdf}
                    className="w-full text-left px-3.5 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      <span>PDF Document (.pdf)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Printable</span>
                  </button>

                  <button
                    onClick={handleExportWord}
                    className="w-full text-left px-3.5 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                      <span>Word Document (.docx)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Docx</span>
                  </button>

                  <button
                    onClick={handleExportMarkdown}
                    className="w-full text-left px-3.5 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Markdown Report (.md)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Raw text</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedIncident && canWrite && (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              title="Reopen incident and return to active triage"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${reopening ? 'animate-spin' : ''}`} />
              <span>Reopen Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Incident Switcher Ribbon */}
      {archivedIncidents.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {archivedIncidents.map(inc => (
            <button
              key={inc.id}
              onClick={() => handleSelectIncident(inc.id, inc)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all shrink-0 cursor-pointer ${
                selectedIncidentId === inc.id
                  ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200 shadow-md'
                  : 'bg-[#0D1424]/70 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-white">{inc.incident_reference}</span>
              <span className="text-[11px] truncate max-w-[200px] text-slate-300">{inc.incident_title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 text-center space-y-3">
          <FolderArchive className="w-10 h-10 text-slate-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Archived Incidents</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              When an incident is remediated, closed, and archived from the active Incidents section, it will appear here in the historical archive.
            </p>
          </div>
          {onNavigateToActiveIncidents && (
            <button
              onClick={onNavigateToActiveIncidents}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
            >
              View Active Incidents
            </button>
          )}
        </div>
      )}

      {selectedIncident && (
        <div className="space-y-5">
          {/* Closure Metadata Banner */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-emerald-300 uppercase tracking-wide font-mono text-[11px]">
                  ARCHIVED RECORD: {selectedIncident.incident_reference}
                </span>
                <span className="text-slate-400 font-mono">
                  Closed {selectedIncident.closed_at ? new Date(selectedIncident.closed_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <p className="text-slate-300 text-xs">
                {selectedIncident.description || 'Closed and archived with zero uncontained systems.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-400">
              <span>Closed By: <strong className="text-white">{selectedIncident.closed_by || 'SecOps Lead'}</strong></span>
              <span>·</span>
              <span>IoC: <strong className="text-white">{selectedIncident.ioc_or_vulnerability || 'N/A'}</strong></span>
            </div>
          </div>

          {/* Remediation Gauge & Operational Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Patched Systems Gauge Card */}
            <div className="lg:col-span-4 p-4 rounded-xl border border-emerald-500/30 bg-[#0d1424]/90 select-none flex flex-col justify-between shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-white tracking-wide font-sans">Remediated Systems</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {patchedPct}% FINAL
                </span>
              </div>

              {/* Gauge Chart SVG */}
              <div className="py-2 flex items-center justify-center">
                <div className="relative w-36 h-28 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 120 75">
                    <path
                      d="M 15 65 A 45 45 0 0 1 105 65"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 15 65 A 45 45 0 0 1 105 65"
                      fill="none"
                      stroke="url(#archive-gauge-grad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={141.37}
                      strokeDashoffset={141.37 - (totalServers > 0 ? (patchedCount / totalServers) * 141.37 : 0)}
                      className="transition-all duration-700 ease-out"
                    />
                    <defs>
                      <linearGradient id="archive-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="50%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#34D399" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 top-3 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black font-mono text-white tracking-tight">
                      {patchedCount}
                      <span className="text-xs text-slate-400 font-normal ml-1">/ {totalServers}</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                      Servers Patched
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono pt-1 border-t border-white/5 text-slate-400 text-center">
                {totalServers - patchedCount === 0 ? 'All affected systems successfully patched' : `${totalServers - patchedCount} servers granted exception`}
              </div>
            </div>

            {/* Simpler Text Statistics Panel */}
            <div className="lg:col-span-8 p-4 rounded-xl bg-[#0d1424]/70 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-slate-200 tracking-wide font-sans">
                  Archived Incident Telemetry & Posture
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Historical Record
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                <div className="flex items-baseline justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Total Systems Impacted:</span>
                  <span className="font-mono font-bold text-white">{totalServers} servers</span>
                </div>

                <div className="flex items-baseline justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Stakeholder Outreach:</span>
                  <span className="font-mono font-bold text-blue-300">
                    {commCount} of {totalServers} ({totalServers > 0 ? Math.round((commCount / totalServers) * 100) : 0}%)
                  </span>
                </div>

                <div className="flex items-baseline justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Documentation Coverage:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {notesCount} of {totalServers} ({totalServers > 0 ? Math.round((notesCount / totalServers) * 100) : 0}%)
                  </span>
                </div>

                <div className="flex items-baseline justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Containment Isolated:</span>
                  <span className="font-mono font-bold text-rose-300">{isolatedCount} hosts</span>
                </div>

                <div className="flex items-baseline justify-between py-1 border-b border-white/5 sm:border-b-0">
                  <span className="text-slate-400">Linked Business Units:</span>
                  <span className="font-mono font-bold text-purple-300">
                    {buBreakdown.length} BUs ({buBreakdown.map(b => b.name).join(', ')})
                  </span>
                </div>

                <div className="flex items-baseline justify-between py-1">
                  <span className="text-slate-400">Products & Stakeholders:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {productBreakdown.length} Products · {managerAccountability.length} Managers
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Archived incident reports can be regenerated anytime.</span>
                <span className="text-emerald-400 font-semibold">Audit Compliant</span>
              </div>
            </div>
          </div>

          {/* Host Remediation Inventory Table */}
          <div className="p-4 rounded-xl bg-[#0D1424]/90 border border-slate-800/80 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-white tracking-wide font-sans">
                  Remediated Host Inventory ({filteredServers.length})
                </h3>
              </div>
              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter host, vm, IP, BU..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 text-[10px] uppercase border-b border-white/10">
                    <th className="py-2 px-3">Host / VM</th>
                    <th className="py-2 px-3">IP Address</th>
                    <th className="py-2 px-3">Business Unit</th>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Triage Status</th>
                    <th className="py-2 px-3">Patch Status</th>
                    <th className="py-2 px-3">Engineer</th>
                    <th className="py-2 px-3">Ticket</th>
                    <th className="py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[11px]">
                  {filteredServers.map(s => {
                    const d = hostDetails[s.id] || {};
                    const isPatched = d.status === 'Patched' || d.status === 'Patch' || d.patching_status === 'Patched';

                    return (
                      <tr
                        key={s.id}
                        onClick={() => onSelectServer(s.id)}
                        className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                          isPatched ? 'bg-emerald-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-semibold text-white">{s.vm}</div>
                          <div className="text-[10px] text-slate-400">{s.host}</div>
                        </td>
                        <td className="py-2 px-3 text-cyan-300">{s.primary_ip_address}</td>
                        <td className="py-2 px-3 text-purple-300">{s.business_unit}</td>
                        <td className="py-2 px-3 text-slate-300">{s.product || '-'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${
                            isPatched
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                              : 'bg-white/5 text-slate-300 border-white/10'
                          }`}>
                            {d.status || 'To be contacted'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">{d.patching_status || 'Not Started'}</td>
                        <td className="py-2 px-3 text-slate-200">{d.patch_engineer || '-'}</td>
                        <td className="py-2 px-3 text-amber-300">{d.ticket_number ? `#${d.ticket_number}` : '-'}</td>
                        <td className="py-2 px-3 text-slate-400 max-w-[200px] truncate" title={d.notes}>
                          {d.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
