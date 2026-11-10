import { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Plus,
  Users,
  Building2,
  Server,
  Mail,
  Download,
  AlertTriangle,
  Check,
  Search,
  ExternalLink,
  FileText,
  StickyNote,
  Calendar,
  Ticket,
  UserCheck,
  CheckCircle2,
  X,
  Clock,
  BarChart3,
  ListFilter,
  Package,
  RefreshCw,
  PhoneCall,
  FolderArchive,
  ChevronDown,
  Upload,
  FileUp,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type {
  Incident,
  IncidentImpact,
  ServerRecord,
  TriageHostStatus,
  ServerPatchingStatus,
  IncidentHostDetail,
} from '../../types/index.js';
import { analyseIncident, buildIncidentReportData, hasHostNotes, isHostCommunicated } from '../../services/incidentAnalysis.js';
import { exportIncidentReport } from '../../services/incidentReportExport.js';
import { downloadCsv } from '../../utils/export.js';

interface IncidentTriageViewProps {
  onSelectServer: (id: string) => void;
  initialServerIds?: string[];
  onNavigateToArchive?: () => void;
  onRefreshIncidents?: () => void;
  onIncidentCreated?: () => void;
  canWrite?: boolean;
}

export const IncidentTriageView: React.FC<IncidentTriageViewProps> = ({
  onSelectServer,
  initialServerIds,
  onNavigateToArchive,
  onRefreshIncidents,
  onIncidentCreated,
  canWrite = true,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [impact, setImpact] = useState<IncidentImpact | null>(null);

  // View Display Mode: 'dashboard' (Metrics Dashboard) or 'table' (Action Table)
  const [viewMode, setViewMode] = useState<'dashboard' | 'table'>('dashboard');

  // Per-host triage details map
  const [hostDetails, setHostDetails] = useState<Record<string, IncidentHostDetail>>({});

  // Notes Modal state
  const [editingServer, setEditingServer] = useState<ServerRecord | null>(null);
  const [noteFormNotes, setNoteFormNotes] = useState('');
  const [noteFormEngineer, setNoteFormEngineer] = useState('');
  const [noteFormPatchingStatus, setNoteFormPatchingStatus] = useState<ServerPatchingStatus>('Not Started');
  const [noteFormDate, setNoteFormDate] = useState('');
  const [noteFormTicket, setNoteFormTicket] = useState('');
  const [noteFormCommunicated, setNoteFormCommunicated] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // New incident modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRef, setNewRef] = useState(`INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newSeverity, setNewSeverity] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [newIoc, setNewIoc] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newHostnamesInput, setNewHostnamesInput] = useState('');

  // Bulk add servers modal
  const [showAddServersModal, setShowAddServersModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [addResults, setAddResults] = useState<{
    matched: number;
    unmatched: string[];
  } | null>(null);

  // Host click management & removal states
  const [hostActionModal, setHostActionModal] = useState<ServerRecord | null>(null);
  const [removingServer, setRemovingServer] = useState<ServerRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Close & Archive incident modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingIncident, setClosingIncident] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [closingEngineer, setClosingEngineer] = useState('SecOps Lead');

  // Report export states
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [archiveNotification, setArchiveNotification] = useState<string | null>(null);

  // Interactive filters
  const [filterBu, setFilterBu] = useState<string | null>(null);
  const [filterMgr, setFilterMgr] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterNotes, setFilterNotes] = useState<'has_notes' | 'no_notes' | null>(null);
  const [filterCommunication, setFilterCommunication] = useState<'communicated' | 'pending' | null>(null);
  const [filterProduct, setFilterProduct] = useState<string | null>(null);
  const [searchTable, setSearchTable] = useState('');

  // Active Incidents only (Closed & Archived are removed and moved to Archive view)
  const activeIncidents = useMemo(() => {
    return incidents.filter(i => i.status !== 'Closed' && i.status !== 'Archived');
  }, [incidents]);

  const triageStatuses: TriageHostStatus[] = [
    'To be contacted',
    'Contacted',
    'Patching',
    'Patched',
    'Not Affected',
    'Uninstalled',
    'Isolated',
  ];

  const patchingStatuses: ServerPatchingStatus[] = [
    'Not Started',
    'In progress',
    'Patched',
    'Validation required',
    'Validated',
    'Exception',
  ];

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await api.getIncidents();
      setIncidents(data);
      const active = data.filter(i => i.status !== 'Closed' && i.status !== 'Archived');
      if (active.length > 0 && !selectedIncidentId) {
        handleSelectIncident(active[0].id, active[0]);
      }
    } catch (err) {
      console.error('Failed to load incidents:', err);
    }
  };

  const handleSelectIncident = async (id: string, incidentObj?: Incident) => {
    setSelectedIncidentId(id);
    clearAllFilters();
    setAddResults(null);
    setSearchTable('');

    const inc = incidentObj || incidents.find(i => i.id === id);
    if (inc?.host_details) {
      setHostDetails(inc.host_details);
    } else {
      setHostDetails({});
    }

    try {
      const imp = await api.getIncidentImpact(id);
      setImpact(imp);
    } catch (err) {
      console.error('Failed to load incident impact:', err);
    }
  };

  const clearAllFilters = () => {
    setFilterBu(null);
    setFilterMgr(null);
    setFilterStatus(null);
    setFilterNotes(null);
    setFilterCommunication(null);
    setFilterProduct(null);
  };

  const handleStatusChange = async (serverId: string, newStatus: TriageHostStatus) => {
    if (!selectedIncidentId || !canWrite) return;

    const current = hostDetails[serverId] || { server_id: serverId, status: 'To be contacted' };
    const updated: IncidentHostDetail = {
      ...current,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    setHostDetails(prev => ({
      ...prev,
      [serverId]: updated,
    }));

    try {
      await api.updateIncidentHostDetail(selectedIncidentId, serverId, updated);
    } catch (err) {
      console.error('Failed to persist status change:', err);
    }
  };

  // When clicking the calls icon: triage status is changed to Contacted
  const handleCallHost = async (serverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIncidentId || !canWrite) return;

    const current = hostDetails[serverId] || { server_id: serverId, status: 'To be contacted' };
    const updated: IncidentHostDetail = {
      ...current,
      status: 'Contacted',
      communicated: true,
      communication_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    };

    setHostDetails(prev => ({
      ...prev,
      [serverId]: updated,
    }));

    try {
      await api.updateIncidentHostDetail(selectedIncidentId, serverId, updated);
    } catch (err) {
      console.error('Failed to change status to contacted on call:', err);
    }
  };

  const handleMarkAllCommunicated = async () => {
    if (!selectedIncidentId || !impact || !canWrite) return;
    const now = new Date().toISOString().split('T')[0];
    const updatedMap = { ...hostDetails };
    const updates: Array<[string, IncidentHostDetail]> = [];

    for (const s of impact.affected_servers) {
      const current = updatedMap[s.id] || { server_id: s.id, status: 'To be contacted' };
      const detail: IncidentHostDetail = {
        ...current,
        communicated: true,
        communication_date: now,
        status: current.status === 'To be contacted' ? 'Patching' : current.status,
        updated_at: new Date().toISOString(),
      };
      updatedMap[s.id] = detail;
      updates.push([s.id, detail]);
    }

    setHostDetails(updatedMap);
    await Promise.all(
      updates.map(([serverId, detail]) =>
        api
          .updateIncidentHostDetail(selectedIncidentId, serverId, detail)
          .catch(err => console.error('Failed to mark host communicated:', err))
      )
    );
  };

  // Open Notes Modal
  const openNotesModal = (server: ServerRecord) => {
    if (!canWrite) return;
    setEditingServer(server);
    const detail = hostDetails[server.id] || {
      server_id: server.id,
      status: 'To be contacted',
      notes: '',
      patch_engineer: '',
      patching_status: 'Not Started',
      patching_date: '',
      ticket_number: '',
      communicated: false,
    };

    setNoteFormNotes(detail.notes || '');
    setNoteFormEngineer(detail.patch_engineer || '');
    setNoteFormPatchingStatus(detail.patching_status || 'Not Started');
    setNoteFormDate(detail.patching_date || '');
    setNoteFormTicket(detail.ticket_number || '');
    setNoteFormCommunicated(Boolean(detail.communicated));
  };

  const handleSaveNotes = async () => {
    if (!selectedIncidentId || !editingServer || !canWrite) return;
    setSavingNote(true);

    const current = hostDetails[editingServer.id] || {
      server_id: editingServer.id,
      status: 'To be contacted',
    };

    const updated: IncidentHostDetail = {
      ...current,
      notes: noteFormNotes,
      patch_engineer: noteFormEngineer,
      patching_status: noteFormPatchingStatus,
      patching_date: noteFormDate,
      ticket_number: noteFormTicket,
      communicated: noteFormCommunicated,
      updated_at: new Date().toISOString(),
    };

    setHostDetails(prev => ({
      ...prev,
      [editingServer.id]: updated,
    }));

    try {
      await api.updateIncidentHostDetail(selectedIncidentId, editingServer.id, updated);
      setEditingServer(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'create' | 'bulk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = String(event.target?.result || '');
      if (target === 'create') {
        setNewHostnamesInput(prev => (prev ? prev + '\n' + content : content));
      } else {
        setBulkInput(prev => (prev ? prev + '\n' + content : content));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const created = await api.createIncident({
        incident_reference: newRef,
        incident_title: newTitle,
        severity: newSeverity,
        ioc_or_vulnerability: newIoc,
        description: newDesc,
        status: 'Investigating',
        affected_server_ids: initialServerIds || [],
        raw_input: newHostnamesInput.trim() || undefined,
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewIoc('');
      setNewHostnamesInput('');
      await loadIncidents();
      handleSelectIncident(created.id, created);
      onIncidentCreated?.();
    } catch (err) {
      console.error('Failed to create incident:', err);
    }
  };

  const handleBulkAddServers = async () => {
    if (!selectedIncidentId || !bulkInput.trim()) return;

    try {
      const res = await api.addIncidentServers(selectedIncidentId, {
        raw_input: bulkInput,
      });

      setAddResults({
        matched: res.matched_count,
        unmatched: res.unmatched_entries,
      });

      const updatedImpact = await api.getIncidentImpact(selectedIncidentId);
      setImpact(updatedImpact);
      setBulkInput('');
      await loadIncidents();
    } catch (err) {
      console.error('Failed to add servers:', err);
    }
  };

  const handleRemoveServerFromIncident = async (serverId: string) => {
    if (!selectedIncidentId) return;
    setIsRemoving(true);
    try {
      await api.removeIncidentServer(selectedIncidentId, serverId);
      setImpact(prev => {
        if (!prev) return null;
        return {
          ...prev,
          total_affected_servers: Math.max(0, prev.total_affected_servers - 1),
          affected_servers: prev.affected_servers.filter(s => s.id !== serverId),
        };
      });
      setHostDetails(prev => {
        const copy = { ...prev };
        delete copy[serverId];
        return copy;
      });
      const updatedImpact = await api.getIncidentImpact(selectedIncidentId);
      setImpact(updatedImpact);
      await loadIncidents();
      setHostActionModal(null);
      setRemovingServer(null);
    } catch (err) {
      console.error('Failed to remove server from incident:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  // Close & Archive active incident handler
  const handleCloseAndArchive = async () => {
    if (!selectedIncident) return;
    setClosingIncident(true);
    try {
      const now = new Date().toISOString();
      const archivedRef = selectedIncident.incident_reference;
      await api.updateIncident(selectedIncident.id, {
        status: 'Archived',
        closed_at: now,
        closed_by: closingEngineer || 'SecOps Lead',
        description: closureNotes
          ? `${selectedIncident.description}\n\n[RESOLVED & ARCHIVED on ${new Date().toLocaleDateString()} by ${closingEngineer || 'SecOps Lead'}]: ${closureNotes}`
          : selectedIncident.description,
      });

      const updatedList = incidents.map(i =>
        i.id === selectedIncident.id
          ? {
              ...i,
              status: 'Archived' as const,
              closed_at: now,
              closed_by: closingEngineer || 'SecOps Lead',
            }
          : i
      );
      setIncidents(updatedList);
      setShowCloseModal(false);
      setClosureNotes('');
      setArchiveNotification(`Incident ${archivedRef} has been resolved, closed, and moved to the Archive Incident section in navigation.`);

      // Select next available active incident
      const remainingActive = updatedList.filter(i => i.status !== 'Closed' && i.status !== 'Archived');
      if (remainingActive.length > 0) {
        handleSelectIncident(remainingActive[0].id, remainingActive[0]);
      } else {
        setSelectedIncidentId(null);
        setImpact(null);
      }

      if (onRefreshIncidents) onRefreshIncidents();
    } catch (err) {
      console.error('Failed to close and archive incident:', err);
    } finally {
      setClosingIncident(false);
    }
  };

  // Calculations for the dashboard and table, shared with the archive view.
  const affectedList = useMemo(() => impact?.affected_servers ?? [], [impact]);
  const totalServers = affectedList.length;

  const analysis = useMemo(
    () => analyseIncident(affectedList, hostDetails),
    [affectedList, hostDetails]
  );
  const {
    buBreakdown,
    managerAccountability,
    productBreakdown,
    functionBreakdown,
    triageCounts: triageStats,
    patchedCount,
    patchedPct,
    communicatedCount,
    communicatedPct,
    pendingCommCount,
    hasNotesCount,
    hasNotesPct,
    missingNotesCount,
    isolatedCount,
  } = analysis;

  // Small projections keep the existing JSX unchanged.
  const notesStats = { hasNotesCount, missingNotesCount, pct: hasNotesPct };
  const commStats = { communicatedCount, pendingCommCount, pct: communicatedPct };

  // Report export handlers (shared with the archive page)
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

  // Filtered affected servers for display in table
  const displayedServers = useMemo(() => {
    return affectedList.filter(s => {
      if (filterBu && s.business_unit !== filterBu) return false;
      if (filterMgr && s.manager !== filterMgr) return false;
      if (filterProduct && s.product !== filterProduct) return false;

      const detail = hostDetails[s.id];
      if (filterStatus && (detail?.status || 'To be contacted') !== filterStatus) return false;

      if (filterNotes === 'has_notes') {
        if (!hasHostNotes(detail)) return false;
      } else if (filterNotes === 'no_notes') {
        if (hasHostNotes(detail)) return false;
      }

      if (filterCommunication === 'communicated' && !isHostCommunicated(detail)) return false;
      if (filterCommunication === 'pending' && isHostCommunicated(detail)) return false;

      if (searchTable) {
        const q = searchTable.toLowerCase();
        return (
          s.host.toLowerCase().includes(q) ||
          s.vm.toLowerCase().includes(q) ||
          s.primary_ip_address.toLowerCase().includes(q) ||
          (s.manager || '').toLowerCase().includes(q) ||
          (s.business_unit || '').toLowerCase().includes(q) ||
          (s.product || '').toLowerCase().includes(q) ||
          (s.function || '').toLowerCase().includes(q) ||
          (s.organisation_abbreviated || '').toLowerCase().includes(q) ||
          (detail?.status || '').toLowerCase().includes(q) ||
          (detail?.patch_engineer || '').toLowerCase().includes(q) ||
          (detail?.ticket_number || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    affectedList,
    filterBu,
    filterMgr,
    filterProduct,
    filterStatus,
    filterNotes,
    filterCommunication,
    searchTable,
    hostDetails,
  ]);

  const hasActiveFilters = Boolean(
    filterBu || filterMgr || filterProduct || filterStatus || filterNotes || filterCommunication || searchTable
  );

  // Status badge styling helper
  const getStatusBadgeClass = (status?: TriageHostStatus) => {
    switch (status) {
      case 'Patched':
      case 'Patch':
        return 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-bold';
      case 'Patching':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Contacted':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium';
      case 'Not Affected':
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
      case 'Uninstalled':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Isolated':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'To be contacted':
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  // Export handlers
  const exportAffectedCsv = () => {
    if (!impact || impact.affected_servers.length === 0) return;

    const headers = [
      'Host',
      'VM',
      'IP',
      'Business Unit',
      'Product',
      'Function',
      'Organisation Abbreviated',
      'Manager',
      'Email',
      'Triage Status',
      'Patching Status',
      'Patch Engineer',
      'Patch Date',
      'Ticket Number',
      'Communicated',
      'Notes',
    ];

    const rows = impact.affected_servers.map(s => {
      const d = hostDetails[s.id] || {};
      return [
        s.host,
        s.vm,
        s.primary_ip_address,
        s.business_unit,
        s.product,
        s.function,
        s.organisation_abbreviated,
        s.manager,
        s.email,
        d.status || 'To be contacted',
        d.patching_status || 'Not Started',
        d.patch_engineer || '',
        d.patching_date || '',
        d.ticket_number || '',
        d.communicated ? 'YES' : 'NO',
        d.notes || '',
      ];
    });

    downloadCsv(`incident_${selectedIncident?.incident_reference ?? 'unknown'}_triage.csv`, headers, rows);
  };

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  // Mask an IP like the communications templates (***.***.x.x), keeping CIDR suffix.
  const maskIpForManagerEmail = (ip: string | undefined | null): string => {
    const raw = (ip || '').trim();
    if (!raw) return 'N/A';
    const slashIndex = raw.indexOf('/');
    const address = slashIndex === -1 ? raw : raw.slice(0, slashIndex);
    const suffix = slashIndex === -1 ? '' : raw.slice(slashIndex);
    const octets = address.split('.');
    if (octets.length === 4 && octets.every(octet => /^\d{1,3}$/.test(octet))) {
      return `***.***.${octets[2]}.${octets[3]}${suffix}`;
    }
    return raw;
  };

  // Open the user's mail client: subject = incident title, body = description
  // + the manager's affected servers as a bulleted list with masked IPs.
  const openManagerEmail = (manager: { name: string; email: string }) => {
    if (!selectedIncident || !manager.email) return;
    const servers = affectedList.filter(s => (s.manager || 'Unassigned') === manager.name);
    const bullets = servers
      .map(s => `  • VM: ${s.vm} | IP: ${maskIpForManagerEmail(s.primary_ip_address)}`)
      .join('\n');
    const subject = selectedIncident.incident_title;
    const body = [
      `Dear ${manager.name},`,
      '',
      selectedIncident.description || 'A security incident is under investigation.',
      '',
      'Affected Systems Under Your Remit:',
      bullets,
      '',
      'Please confirm whether the systems above are vulnerable. If they can be patched, please let us know and advise when patching can be done.',
      '',
      'If you are not the server owner or the right contact for any of the servers above, please also let us know.',
      '',
      'Regards,',
      'SWG Team',
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(manager.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Incident Control & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Incident Triage of Alerts and Vulnerabilities
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                Command Center
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time operational dashboard tracking Business Units, Patching Lifecycle, Notes Documentation, and Stakeholder Outreach.
            </p>
          </div>
        </div>

        {/* View Mode Switcher: Minimal Icon-Only Mode */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
          <button
            onClick={() => setViewMode('dashboard')}
            title="Metrics Dashboard"
            aria-label="Metrics Dashboard"
            className={`p-2 rounded-md transition-all cursor-pointer ${
              viewMode === 'dashboard'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Action Table"
            aria-label="Action Table"
            className={`p-2 rounded-md transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ListFilter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incident Switcher Ribbon & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {activeIncidents.length === 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 py-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>All incidents have been archived and closed.</span>
            </div>
          ) : (
            activeIncidents.map(inc => {
              return (
                <button
                  key={inc.id}
                  onClick={() => handleSelectIncident(inc.id, inc)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all shrink-0 cursor-pointer ${
                    selectedIncidentId === inc.id
                      ? 'bg-rose-950/30 border-rose-500/50 text-rose-200 shadow-sm'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      inc.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-semibold text-white">{inc.incident_reference}</span>
                  <span className="text-[11px] truncate max-w-[170px]">{inc.incident_title}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedIncident && (
            <>
              {/* Upload / Add Hosts Button */}
              {canWrite && (
              <button
                onClick={() => {
                  setAddResults(null);
                  setShowAddServersModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-mono font-medium transition-all cursor-pointer shadow-sm"
                title="Upload or paste new hostnames into this incident"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Upload Hosts</span>
              </button>
              )}

              {/* Report Export Dropdown Button (PDF, Word, Markdown) */}
              <div className="relative">
                <button
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono font-medium transition-all cursor-pointer shadow-sm"
                  title="Generate incident report in PDF, Word, or Markdown format"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isExporting ? 'Generating...' : 'Create Report'}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {exportDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 rounded-xl bg-[var(--surface-1)] border border-blue-500/30 shadow-2xl py-1.5 z-50 text-xs font-mono backdrop-blur-xl">
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10 font-bold">
                      Export Incident Report
                    </div>
                    <button
                      onClick={handleExportPdf}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">PDF Document (.pdf)</div>
                        <div className="text-[10px] text-slate-400">Formal printable incident report</div>
                      </div>
                    </button>
                    <button
                      onClick={handleExportWord}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Word Document (.docx)</div>
                        <div className="text-[10px] text-slate-400">Standard DOCX executive report</div>
                      </div>
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 hover:text-white flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Markdown Report (.md)</div>
                        <div className="text-[10px] text-slate-400">Plain text / GitHub / SOC wiki</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Close & Archive Active Incident */}
              {canWrite && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/50 text-xs font-mono font-semibold hover:border-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                title="Close and archive active incident to the Archive Incident section"
              >
                <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Close & Archive</span>
              </button>
              )}
            </>
          )}

          {canWrite && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-mono font-medium hover:bg-rose-500 transition-colors cursor-pointer shrink-0 shadow-lg shadow-rose-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
          )}
        </div>
      </div>

      {/* Archive Success Notification Banner */}
      {archiveNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3 font-mono shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{archiveNotification}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToArchive && (
              <button
                onClick={onNavigateToArchive}
                className="px-3 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open Archive Incident →</span>
              </button>
            )}
            <button
              onClick={() => setArchiveNotification(null)}
              className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State when no active incidents exist */}
      {!selectedIncident && (
        <div className="p-12 text-center rounded-2xl bg-[var(--surface-1)]/80 border border-white/10 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <FolderArchive className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No Active Incidents in Triage</h3>
            <p className="text-xs text-slate-400">
              All incidents have been successfully triaged, remediated, or moved to Archive. You can view past incidents and export historical reports in the Archive Incident section under Data Sync.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {onNavigateToArchive && (
              <button
                onClick={onNavigateToArchive}
                className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2"
              >
                <FolderArchive className="w-4 h-4 text-emerald-400" />
                <span>Open Archive Incident</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Incident</span>
            </button>
          </div>
        </div>
      )}

      {selectedIncident && (
        <div className="space-y-6">
          {/* ============================================================== */}
          {/* OVERVIEW DASHBOARD PURELY BASED ON METRICS                     */}
          {/* (Rendered in 'unified' and 'dashboard_only' modes)             */}
          {/* ============================================================== */}
          {viewMode === 'dashboard' && (
            <div className="space-y-5">
              {/* 1. COMPACT INCIDENT SUMMARY & REMEDIATION GAUGE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                {/* Patched Systems Gauge Card (The single remaining card with a gauge chart) */}
                <div
                  onClick={() => setFilterStatus(filterStatus === 'Patched' ? null : 'Patched')}
                  className={`lg:col-span-4 p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    filterStatus === 'Patched'
                      ? 'border-emerald-400 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'border-emerald-500/30 bg-[var(--surface-1)]/90 hover:border-emerald-400/50 hover:bg-[var(--surface-2)]/90 shadow-lg'
                  }`}
                  title="Click to filter by patched servers"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-white tracking-wide">Patched Systems</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                      {patchedPct}% COMPLETE
                    </span>
                  </div>

                  {/* Gauge Chart SVG */}
                  <div className="py-2 flex items-center justify-center">
                    <div className="relative w-36 h-28 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 120 75">
                        {/* Semi-circular gauge track (180-degree arch) */}
                        <path
                          d="M 15 65 A 45 45 0 0 1 105 65"
                          fill="none"
                          stroke="var(--chart-track)"
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                        {/* Gauge fill arc */}
                        <path
                          d="M 15 65 A 45 45 0 0 1 105 65"
                          fill="none"
                          stroke="url(#gauge-patch-grad)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={141.37}
                          strokeDashoffset={
                            141.37 -
                            (totalServers > 0
                              ? (patchedCount / totalServers) * 141.37
                              : 0)
                          }
                          className="transition-all duration-700 ease-out"
                        />
                        <defs>
                          <linearGradient id="gauge-patch-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#059669" />
                            <stop offset="50%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#34D399" />
                          </linearGradient>
                        </defs>
                      </svg>
                      {/* Gauge Center readout */}
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

                  <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-white/5 text-slate-400">
                    <span>
                      {totalServers - patchedCount} pending remediation
                    </span>
                    <span className="text-emerald-400 hover:underline">
                      {filterStatus === 'Patched' ? 'Show all' : 'Filter table →'}
                    </span>
                  </div>
                </div>

                {/* Simpler Text Statistics Panel (Replacing the other 5 cards with smaller, clean text view) */}
                <div className="lg:col-span-8 p-4 rounded-xl bg-[var(--surface-1)]/70 border border-slate-800/80 backdrop-blur-md flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200 tracking-wide font-sans">
                        Operational Incident Statistics
                      </span>
                      {hasActiveFilters && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          FILTERED VIEW
                        </span>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <button
                        onClick={() => clearAllFilters()}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reset Filters</span>
                      </button>
                    )}
                  </div>

                  {/* Clean text statistics in 2 structured rows */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                    {/* Stat 1: Impacted Assets */}
                    <div
                      onClick={() => clearAllFilters()}
                      className="flex items-baseline justify-between py-1 border-b border-white/5 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-slate-200">Impacted Assets in Scope:</span>
                      <span className="font-mono font-bold text-white">
                        {totalServers} <span className="text-[11px] font-normal text-slate-400">servers (100% blast radius)</span>
                      </span>
                    </div>

                    {/* Stat 2: Communication Outreach */}
                    <div
                      onClick={() => setFilterCommunication(filterCommunication === 'communicated' ? null : 'communicated')}
                      className="flex items-baseline justify-between py-1 border-b border-white/5 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-blue-300">Stakeholder Outreach:</span>
                      <span className="font-mono font-bold text-blue-300">
                        {commStats.communicatedCount} of {totalServers} <span className="text-[11px] font-normal text-slate-400">({commStats.pct}%)</span>
                        {commStats.pendingCommCount > 0 && (
                          <span className="text-amber-400 ml-1 text-[10px]">· {commStats.pendingCommCount} pending</span>
                        )}
                      </span>
                    </div>

                    {/* Stat 3: Notes & Tickets */}
                    <div
                      onClick={() => setFilterNotes(filterNotes === 'has_notes' ? null : 'has_notes')}
                      className="flex items-baseline justify-between py-1 border-b border-white/5 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-amber-300">Notes & Ticket Tracking:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {notesStats.hasNotesCount} of {totalServers} <span className="text-[11px] font-normal text-slate-400">({notesStats.pct}%)</span>
                        {notesStats.missingNotesCount > 0 && (
                          <span className="text-slate-400 ml-1 text-[10px]">· {notesStats.missingNotesCount} missing notes</span>
                        )}
                      </span>
                    </div>

                    {/* Stat 4: Containment & Isolation */}
                    <div
                      onClick={() => setFilterStatus(filterStatus === 'Isolated' ? null : 'Isolated')}
                      className="flex items-baseline justify-between py-1 border-b border-white/5 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-rose-300">Quarantine & Containment:</span>
                      <span className="font-mono font-bold text-rose-300">
                        {isolatedCount} isolated <span className="text-[11px] font-normal text-slate-400">· {triageStats['Patching'] || 0} patching active</span>
                      </span>
                    </div>

                    {/* Stat 5: Organizational Blast Radius */}
                    <div
                      onClick={() => clearAllFilters()}
                      className="flex items-baseline justify-between py-1 border-b border-white/5 sm:border-b-0 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-purple-300">Impacted Business Units:</span>
                      <span className="font-mono font-bold text-purple-300">
                        {buBreakdown.length} BUs <span className="text-[11px] font-normal text-slate-400">({buBreakdown.map(b => b.name).slice(0, 2).join(', ')}{buBreakdown.length > 2 ? '...' : ''})</span>
                      </span>
                    </div>

                    {/* Stat 6: Workload Products & Managers */}
                    <div
                      onClick={() => clearAllFilters()}
                      className="flex items-baseline justify-between py-1 hover:text-white cursor-pointer group"
                    >
                      <span className="text-slate-400 group-hover:text-cyan-300">Products & Stakeholders:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {productBreakdown.length} Products <span className="text-[11px] font-normal text-slate-400">· {managerAccountability.length} Managers involved</span>
                      </span>
                    </div>
                  </div>

                  {/* Quick Triage Status Filter Pills (Simple plain text row with interactive filters) */}
                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-500 uppercase text-[10px] tracking-wider mr-1">Quick Filter:</span>
                    {(['Patching', 'To be contacted', 'Contacted', 'Isolated', 'Not Affected'] as TriageHostStatus[]).map(status => {
                      const count = triageStats[status] || 0;
                      if (count === 0 && status !== 'To be contacted') return null;
                      const isActive = filterStatus === status;
                      return (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(isActive ? null : status)}
                          className={`px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-blue-600/30 border-blue-400 text-blue-200 font-semibold'
                              : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                          }`}
                        >
                          <span>{status}: </span>
                          <span className="font-bold text-white">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. COMPREHENSIVE OPERATIONAL INTELLIGENCE MATRIX (GRID OF 3 SECTIONS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* PANEL A: ALL BUSINESS UNITS LINKED TO INCIDENT */}
                <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" /> Linked Business Units
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{buBreakdown.length} units</span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {buBreakdown.map(bu => {
                      const isFiltered = filterBu === bu.name;
                      const pct = bu.total > 0 ? Math.round((bu.patched / bu.total) * 100) : 0;

                      return (
                        <div
                          key={bu.name}
                          onClick={() => setFilterBu(isFiltered ? null : bu.name)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer text-xs space-y-1.5 ${
                            isFiltered
                              ? 'bg-purple-600/25 border-purple-400 text-white'
                              : 'bg-white/[0.02] border-white/5 hover:border-purple-400/40 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{bu.name}</span>
                            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300">
                              {bu.total} system{bu.total > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span className="text-emerald-400">{bu.patched}/{bu.total} Patched ({pct}%)</span>
                            <span className="text-blue-300">{bu.communicated}/{bu.total} Notified</span>
                          </div>

                          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PANEL B: NOTES COVERAGE & COMMUNICATION STATUS */}
                <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <StickyNote className="w-4 h-4" /> Notes & Communication
                    </span>
                    {canWrite && (
                    <button
                      onClick={handleMarkAllCommunicated}
                      className="text-[10px] font-mono text-blue-400 hover:text-blue-300 underline cursor-pointer"
                      title="Set all affected hosts as notified"
                    >
                      Notify All
                    </button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Notes Status Row */}
                    <div
                      onClick={() => setFilterNotes(filterNotes === 'has_notes' ? null : 'has_notes')}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        filterNotes === 'has_notes' ? 'bg-amber-600/25 border-amber-400 text-white' : 'bg-white/[0.02] border-white/5 hover:border-amber-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Documented Notes</span>
                      </div>
                      <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                        {notesStats.hasNotesCount}
                      </span>
                    </div>

                    <div
                      onClick={() => setFilterNotes(filterNotes === 'no_notes' ? null : 'no_notes')}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        filterNotes === 'no_notes' ? 'bg-slate-700 border-white text-white' : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-slate-400">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pending Notes/Log</span>
                      </div>
                      <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                        {notesStats.missingNotesCount}
                      </span>
                    </div>

                    {/* Communication Status Row */}
                    <div
                      onClick={() => setFilterCommunication(filterCommunication === 'communicated' ? null : 'communicated')}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        filterCommunication === 'communicated' ? 'bg-blue-600/25 border-blue-400 text-white' : 'bg-white/[0.02] border-white/5 hover:border-blue-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span>Stakeholder Notified</span>
                      </div>
                      <span className="font-mono font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
                        {commStats.communicatedCount}
                      </span>
                    </div>

                    <div
                      onClick={() => setFilterCommunication(filterCommunication === 'pending' ? null : 'pending')}
                      className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        filterCommunication === 'pending' ? 'bg-rose-950/40 border-rose-400 text-rose-200' : 'bg-white/[0.02] border-white/5 hover:border-rose-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-rose-400" />
                        <span>Awaiting Outreach</span>
                      </div>
                      <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                        {commStats.pendingCommCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PANEL D: LINKED SOFTWARE PRODUCTS & FUNCTIONS */}
                <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4" /> Products & Roles
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{productBreakdown.length} products</span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Impacted Products:</span>
                      <div className="flex flex-wrap gap-1">
                        {productBreakdown.map(([prod, count]) => {
                          const isFiltered = filterProduct === prod;
                          return (
                            <button
                              key={prod}
                              onClick={() => setFilterProduct(isFiltered ? null : prod)}
                              className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                isFiltered
                                  ? 'bg-cyan-600 text-white border-cyan-400'
                                  : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 hover:bg-cyan-500/20'
                              }`}
                            >
                              {prod}: <span className="font-bold">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1 border-t border-white/5">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Server Functions:</span>
                      <div className="flex flex-wrap gap-1">
                        {functionBreakdown.map(([func, count]) => (
                          <span
                            key={func}
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-300 border border-white/10"
                          >
                            {func} ({count})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. RESPONSIBLE MANAGERS LOOKING INTO THE ISSUES */}
              <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                      Responsible Managers Investigating & Coordinating Remediation ({managerAccountability.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Click any manager to filter affected infrastructure
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {managerAccountability.map(mgr => {
                    const isFiltered = filterMgr === mgr.name;
                    return (
                      <div
                        key={mgr.name}
                        onClick={() => setFilterMgr(isFiltered ? null : mgr.name)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                          isFiltered
                            ? 'bg-amber-600/25 border-amber-400 text-white'
                            : 'bg-white/[0.02] border-white/5 hover:border-amber-400/40 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{mgr.name}</span>
                          <div className="flex items-center gap-1.5">
                            {mgr.email && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openManagerEmail(mgr);
                                }}
                                title={`Email ${mgr.name}`}
                                aria-label={`Email ${mgr.name}`}
                                className="p-1 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/30 hover:text-blue-200 transition-colors cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300">
                              {mgr.total} server{mgr.total > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {mgr.email || 'No email recorded'}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-white/5">
                          <span className="text-emerald-400">{mgr.patched}/{mgr.total} Patched</span>
                          {mgr.communicated ? (
                            <span className="text-blue-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Notified
                            </span>
                          ) : (
                            <span className="text-amber-400">Outreach Pending</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* CENTRAL AFFECTED SERVERS & ACTION TABLE                        */}
          {/* (Rendered in both 'dashboard' and 'table' modes)               */}
          {/* ============================================================== */}
          {(viewMode === 'table' || viewMode === 'dashboard') && (
            <div className="rounded-xl soc-glass-panel border border-white/15 overflow-hidden space-y-4 p-5 shadow-2xl bg-[var(--surface-2)]/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                      Affected Asset Triage & Remediation Tracking ({displayedServers.length} of {totalServers})
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Change triage status directly, toggle communication notifications, and open notes to record assigned engineer and tickets.
                  </p>
                </div>

                {/* Filter / Search Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchTable}
                      onChange={e => setSearchTable(e.target.value)}
                      placeholder="Filter hosts, IPs, engineers..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-rose-400 hover:text-rose-300 font-mono underline cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}

                  {canWrite && (
                  <button
                    onClick={() => {
                      setAddResults(null);
                      setShowAddServersModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-mono cursor-pointer transition-colors"
                    title="Upload or paste hostnames into incident"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Hosts</span>
                  </button>
                  )}

                  <button
                    onClick={exportAffectedCsv}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
                    title="Export affected systems to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Active Filter Chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono p-2 rounded-lg bg-blue-950/20 border border-blue-500/20">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Active Filter:</span>
                  {filterBu && <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">BU: {filterBu}</span>}
                  {filterMgr && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Mgr: {filterMgr}</span>}
                  {filterProduct && <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Product: {filterProduct}</span>}
                  {filterStatus && <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Status: {filterStatus}</span>}
                  {filterNotes && <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">{filterNotes === 'has_notes' ? 'Has Notes' : 'No Notes'}</span>}
                  {filterCommunication && <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">{filterCommunication === 'communicated' ? 'Notified' : 'Pending Outreach'}</span>}
                </div>
              )}

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      <th className="p-3">Host Identifier</th>
                      <th className="p-3">VM</th>
                      <th className="p-3">Primary IP</th>
                      <th className="p-3">Business Unit</th>
                      <th className="p-3">Product & Role</th>
                      <th className="p-3">Manager</th>
                      <th className="p-3 font-semibold text-white">Triage Status</th>
                      <th className="p-3 text-center font-semibold text-white">Call / Contact</th>
                      <th className="p-3 text-center">Notes & Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {displayedServers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          No affected systems match current criteria.
                        </td>
                      </tr>
                    ) : (
                      displayedServers.map(s => {
                        const detail = hostDetails[s.id] || {
                          server_id: s.id,
                          status: 'To be contacted',
                        };
                        const currentStatus: TriageHostStatus = detail.status || 'To be contacted';
                        const isPatched = currentStatus === 'Patched' || currentStatus === 'Patch';

                        // Check if server has notes
                        const hasNotes = Boolean(
                          (detail.notes && detail.notes.trim().length > 0) ||
                          detail.patch_engineer ||
                          detail.ticket_number ||
                          detail.patching_date
                        );

                        return (
                          <tr
                            key={s.id}
                            className={`transition-colors ${
                              isPatched
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-y border-emerald-500/40 text-emerald-100 shadow-xs'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            {/* Host */}
                            <td
                              className={`p-3 font-medium ${
                                isPatched ? 'text-emerald-200' : 'text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 group">
                                <div
                                  onClick={() => setHostActionModal(s)}
                                  className="flex items-center gap-1.5 cursor-pointer hover:text-blue-300 transition-colors"
                                  title="Click hostname for options: View server profile or Remove from incident"
                                >
                                  {isPatched && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  <span className="underline decoration-dotted underline-offset-2 decoration-slate-500 hover:decoration-blue-400 font-mono font-bold">
                                    {s.host}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemovingServer(s);
                                  }}
                                  className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded transition-all cursor-pointer"
                                  title={`Remove ${s.host} from incident triage`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* VM */}
                            <td className={`p-3 ${isPatched ? 'text-emerald-200/90' : 'text-slate-300'}`}>{s.vm}</td>

                            {/* Primary IP */}
                            <td className={`p-3 ${isPatched ? 'text-emerald-300 font-semibold' : 'text-cyan-300'}`}>{s.primary_ip_address}</td>

                            {/* Business Unit */}
                            <td className="p-3 text-purple-300 font-sans">
                              <div>{s.business_unit}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{s.organisation_abbreviated || ''}</div>
                            </td>

                            {/* Product & Role */}
                            <td className="p-3 text-slate-300 font-sans">
                              <div>{s.product || '—'}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{s.function || ''}</div>
                            </td>

                            {/* Manager */}
                            <td className="p-3 text-slate-200 font-sans">
                              <div>{s.manager}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{s.email}</div>
                            </td>

                            {/* Triage Status Dropdown */}
                            <td className="p-3">
                              <select
                                value={currentStatus === 'Patch' ? 'Patched' : currentStatus}
                                onChange={e => handleStatusChange(s.id, e.target.value as TriageHostStatus)}
                                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium border cursor-pointer focus:outline-none transition-all ${getStatusBadgeClass(
                                  currentStatus
                                )}`}
                              >
                                {triageStatuses.map(status => (
                                  <option
                                    key={status}
                                    value={status}
                                    className="bg-slate-900 text-slate-200"
                                  >
                                    {status}
                                  </option>
                                ))}
                              </select>
                              {detail.patch_engineer && (
                                <div className="text-[10px] text-slate-400 font-sans mt-0.5 truncate max-w-[120px]">
                                  Eng: {detail.patch_engineer}
                                </div>
                              )}
                            </td>

                            {/* Call / Contact Icon: click changes status to Contacted */}
                            <td className="p-3 text-center">
                              <button
                                onClick={e => handleCallHost(s.id, e)}
                                className={`p-2 rounded-lg border transition-all cursor-pointer inline-flex items-center justify-center ${
                                  currentStatus === 'Contacted' || detail.communicated
                                    ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/35 shadow-xs'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                                title={
                                  currentStatus === 'Contacted'
                                    ? 'Status: Contacted (Stakeholder notified)'
                                    : 'Click call icon to contact & change triage status to Contacted'
                                }
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>
                              {detail.communication_date && (
                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                  {detail.communication_date}
                                </div>
                              )}
                            </td>

                            {/* Notes Icon (Changes when notes exist) */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => openNotesModal(s)}
                                className={`relative inline-flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                                  hasNotes
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}
                                title={hasNotes ? 'View/Edit existing notes and ticket' : 'Add triage notes, patch engineer, ticket'}
                              >
                                {hasNotes ? (
                                  <>
                                    <StickyNote className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                  </>
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                              {detail.ticket_number && (
                                <div className="text-[9px] font-mono text-cyan-300 mt-0.5">
                                  {detail.ticket_number}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* NOTES, PATCHING & TICKET DETAILS MODAL                         */}
      {/* ============================================================== */}
      {editingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[var(--surface-2)] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold font-mono text-white">
                    Incident Notes: {editingServer.vm}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  VM: {editingServer.host} • IP: {editingServer.primary_ip_address} • BU: {editingServer.business_unit}
                </p>
              </div>
              <button
                onClick={() => setEditingServer(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Field 1: Engineer name who is patching the server */}
              <div>
                <label className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Assigned Patch Engineer Name</span>
                </label>
                <input
                  type="text"
                  value={noteFormEngineer}
                  onChange={e => setNoteFormEngineer(e.target.value)}
                  placeholder="e.g. John Lennon (Senior DevOps)"
                  className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Field 2 & 3: Change status of patching + Patching Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Change Status of Patching</span>
                  </label>
                  <select
                    value={noteFormPatchingStatus}
                    onChange={e => setNoteFormPatchingStatus(e.target.value as ServerPatchingStatus)}
                    className="w-full p-2 rounded-lg bg-[var(--surface-3)] border border-white/10 text-white font-mono focus:outline-none focus:border-blue-400"
                  >
                    {patchingStatuses.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Patching Execution Date</span>
                  </label>
                  <input
                    type="date"
                    value={noteFormDate}
                    onChange={e => setNoteFormDate(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Field 4: Ticket Number */}
              <div>
                <label className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5 mb-1">
                  <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SR Number / Change Reference</span>
                </label>
                <input
                  type="text"
                  value={noteFormTicket}
                  onChange={e => setNoteFormTicket(e.target.value)}
                  placeholder="e.g. SR-90001 / CR-512333"
                  className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Communication Checkbox */}
              <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="noteComm"
                  checked={noteFormCommunicated}
                  onChange={e => setNoteFormCommunicated(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 cursor-pointer"
                />
                <label htmlFor="noteComm" className="text-slate-200 cursor-pointer flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>Business Owner Notified of this Incident ?</span>
                </label>
              </div>

              {/* Field 5: Long text notes */}
              <div>
                <label className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Detailed Investigation & Operational Notes</span>
                </label>
                <textarea
                  value={noteFormNotes}
                  onChange={e => setNoteFormNotes(e.target.value)}
                  rows={4}
                  placeholder="Record vulnerability mitigation findings, customer communication responses, kernel log status, scheduled maintenance window agreements..."
                  className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-sans leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 font-mono text-xs">
              <button
                type="button"
                onClick={() => setEditingServer(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNote}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                {savingNote ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Notes & Update Host</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE & ARCHIVE INCIDENT MODAL */}
      {showCloseModal && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--surface-2)] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold font-mono text-white">
                    Close & Archive Incident
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedIncident.incident_reference} — {selectedIncident.incident_title}
                </p>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready for Remediation Sign-off & Archive</span>
                </div>
                <p className="text-[11px] text-emerald-200/80">
                  Closing this incident archives the triage board, logs remediation in the audit history, and preserves all host notes and ticket numbers.
                </p>
                <div className="flex items-center gap-4 text-[11px] font-mono pt-1 text-slate-300">
                  <span>Impacted Hosts: <strong className="text-white">{totalServers}</strong></span>
                  <span>Patched Status: <strong className="text-emerald-400">{patchedCount}</strong></span>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-mono text-[11px] block mb-1">
                  Closing Engineer / Sign-off Lead
                </label>
                <input
                  type="text"
                  value={closingEngineer}
                  onChange={e => setClosingEngineer(e.target.value)}
                  placeholder="e.g. David Vance / SecOps Lead"
                  className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-mono text-[11px] block mb-1">
                  Closure Summary & Remediation Verification Notes
                </label>
                <textarea
                  value={closureNotes}
                  onChange={e => setClosureNotes(e.target.value)}
                  rows={4}
                  placeholder="Summarize root cause fix, verification results across business units, or maintenance ticket references..."
                  className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white font-sans focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCloseAndArchive}
                disabled={closingIncident}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {closingIncident ? <Clock className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                <span>Confirm Close & Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INCIDENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--surface-2)] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" /> Create Security Incident / Triage
            </h2>
            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-mono text-[11px] block mb-1">Incident Reference</label>
                <input
                  type="text"
                  value={newRef}
                  onChange={e => setNewRef(e.target.value)}
                  className="w-full p-2 rounded bg-white/5 border border-white/10 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-mono text-[11px] block mb-1">Incident Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Critical RCE in Apache/Log4j or Hypervisor Breach"
                  className="w-full p-2 rounded bg-white/5 border border-white/10 text-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-mono text-[11px] block mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value as any)}
                    className="w-full p-2 rounded bg-white/5 border border-white/10 text-white font-mono"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-mono text-[11px] block mb-1">IOC / CVE ID</label>
                  <input
                    type="text"
                    value={newIoc}
                    onChange={e => setNewIoc(e.target.value)}
                    placeholder="e.g. CVE-2026-3021"
                    className="w-full p-2 rounded bg-white/5 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-300 font-mono text-[11px] block mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Incident overview, affected subsystems, and technical notes..."
                  className="w-full p-2 rounded bg-white/5 border border-white/10 text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-mono text-[11px] block">
                    Impacted Hostnames / VMs / IPs (Optional)
                  </label>
                  <label className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-mono flex items-center gap-1">
                    <FileUp className="w-3 h-3" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept=".txt,.csv"
                      onChange={e => handleFileUpload(e, 'create')}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  value={newHostnamesInput}
                  onChange={e => setNewHostnamesInput(e.target.value)}
                  rows={4}
                  placeholder={`Paste hostnames, IPs or VM IDs (separated by newlines, commas, or spaces)\ne.g.:\nbr1-sse-esx-23.prd.local\n10.200.68.91\napp-server-04`}
                  className="w-full p-2.5 rounded bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-rose-400"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  * Hostnames are correlated against inventory. Duplicates are removed automatically.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 text-white font-medium hover:bg-rose-500 shadow-lg shadow-rose-500/20"
                >
                  Create & Launch Triage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / UPLOAD AFFECTED SERVERS MODAL */}
      {showAddServersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[var(--surface-2)] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" /> Upload / Add Data to Incident
              </h2>
              <button
                onClick={() => {
                  setShowAddServersModal(false);
                  setAddResults(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste hostnames, VM IDs, or IP addresses (or upload a .csv/.txt file). All duplicates are filtered out automatically against existing incident assets.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-mono text-[11px] block">
                  Paste Hostnames, VMs, or IPs
                </label>
                <label className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer font-mono flex items-center gap-1">
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Upload .txt / .csv file</span>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    onChange={e => handleFileUpload(e, 'bulk')}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                rows={6}
                placeholder={`br1-sse-esx-23.prd.local\n10.200.68.91\n152.114.118.226\nunknown-host-01.corp`}
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-blue-400"
              />

              {addResults && (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono space-y-2">
                  <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Successfully correlated & added {addResults.matched} server(s) (duplicates filtered out).
                  </div>
                  {addResults.unmatched.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-amber-400 font-bold block">
                        Unmatched Identifiers ({addResults.unmatched.length}):
                      </span>
                      <div className="p-2 rounded bg-amber-500/10 text-amber-200 text-[11px] max-h-24 overflow-y-auto">
                        {addResults.unmatched.join(', ')}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        * Unmatched records are preserved and not silently discarded as per operational spec.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowAddServersModal(false);
                  setAddResults(null);
                }}
                className="px-3 py-1.5 rounded bg-white/5 text-slate-300 hover:bg-white/10 text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkAddServers}
                className="px-4 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 text-xs cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Correlate & Add Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOST ACTION MODAL (OPENED BY CLICKING HOSTNAME) */}
      {hostActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--surface-2)] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-mono font-bold text-sm">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Host Management</span>
              </div>
              <button
                onClick={() => setHostActionModal(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Hostname:</span>
                <span className="text-white font-bold">{hostActionModal.host}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">VM Identifier:</span>
                <span className="text-slate-200">{hostActionModal.vm}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Primary IP:</span>
                <span className="text-cyan-300">{hostActionModal.primary_ip_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Business Unit:</span>
                <span className="text-purple-300">{hostActionModal.business_unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <span className="text-slate-300">{hostActionModal.product || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Responsible Manager:</span>
                <span className="text-amber-300">{hostActionModal.manager || 'Unassigned'}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1 font-mono">
              <button
                type="button"
                onClick={() => {
                  onSelectServer(hostActionModal.id);
                  setHostActionModal(null);
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Full Server Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRemovingServer(hostActionModal);
                  setHostActionModal(null);
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Remove Host from Incident Triage</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE SERVER CONFIRMATION MODAL */}
      {removingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--surface-2)] border border-rose-500/30 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Remove Host from Incident?</span>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to remove <strong className="text-white font-mono">{removingServer.host}</strong> ({removingServer.vm}) from this incident?
            </p>
            <p className="text-[11px] text-slate-400">
              This host will be unlinked from the incident's blast radius and removed from triage status tracking.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 font-mono text-xs">
              <button
                type="button"
                onClick={() => setRemovingServer(null)}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveServerFromIncident(removingServer.id)}
                disabled={isRemoving}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-600/30"
              >
                {isRemoving ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
