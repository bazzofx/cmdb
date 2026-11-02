import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Plus,
  Users,
  Building2,
  Server,
  Layers,
  Network,
  Cpu,
  Mail,
  Download,
  AlertTriangle,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  StickyNote,
  Calendar,
  Ticket,
  UserCheck,
  CheckCircle2,
  X,
  Clock,
  Filter,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  ListFilter,
  Package,
  Wrench,
  ShieldCheck,
  Send,
  RefreshCw,
  SlidersHorizontal,
  Phone,
  PhoneCall,
  FolderArchive,
  Archive,
  RotateCcw,
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

interface IncidentTriageViewProps {
  onSelectServer: (id: string) => void;
  onOpenCommunications: (serverIds: string[]) => void;
  initialServerIds?: string[];
}

export const IncidentTriageView: React.FC<IncidentTriageViewProps> = ({
  onSelectServer,
  onOpenCommunications,
  initialServerIds,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [impact, setImpact] = useState<IncidentImpact | null>(null);
  const [loading, setLoading] = useState(true);

  // View Display Mode: 'unified' (Dashboard + Table), 'dashboard_only', 'table_only'
  const [viewMode, setViewMode] = useState<'unified' | 'dashboard_only' | 'table_only'>('unified');

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

  // Bulk add servers modal
  const [showAddServersModal, setShowAddServersModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [addResults, setAddResults] = useState<{
    matched: number;
    unmatched: string[];
  } | null>(null);

  // Close & Archive incident modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingIncident, setClosingIncident] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');
  const [closingEngineer, setClosingEngineer] = useState('SecOps Lead');

  // Interactive filters
  const [filterBu, setFilterBu] = useState<string | null>(null);
  const [filterMgr, setFilterMgr] = useState<string | null>(null);
  const [filterOrgAbbr, setFilterOrgAbbr] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPatchingStatus, setFilterPatchingStatus] = useState<string | null>(null);
  const [filterNotes, setFilterNotes] = useState<'has_notes' | 'no_notes' | null>(null);
  const [filterCommunication, setFilterCommunication] = useState<'communicated' | 'pending' | null>(null);
  const [filterProduct, setFilterProduct] = useState<string | null>(null);
  const [searchTable, setSearchTable] = useState('');

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
    setLoading(true);
    try {
      const data = await api.getIncidents();
      setIncidents(data);
      if (data.length > 0 && !selectedIncidentId) {
        handleSelectIncident(data[0].id, data[0]);
      }
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
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

      // Seed initial sample host detail if empty for demonstration
      if (inc && (!inc.host_details || Object.keys(inc.host_details).length === 0)) {
        const seeded: Record<string, IncidentHostDetail> = {};
        imp.affected_servers.forEach((s, idx) => {
          seeded[s.id] = {
            server_id: s.id,
            status: idx === 0 ? 'Patching' : idx === 1 ? 'Isolated' : 'To be contacted',
            patch_engineer: idx === 0 ? 'Sarah Jenkins' : idx === 2 ? 'David Vance' : '',
            patching_status: idx === 0 ? 'Patched' : idx === 2 ? 'In progress' : 'Not Started',
            patching_date: idx === 0 ? '2026-10-28' : '',
            ticket_number: idx === 0 ? 'INC-8821' : idx === 2 ? 'CHG-4019' : '',
            notes: idx === 0 ? 'Applied emergency microcode hotfix to hypervisor core' : '',
            communicated: idx === 0 || idx === 1,
            communication_date: idx === 0 ? '2026-10-28' : undefined,
          };
        });
        setHostDetails(seeded);
      }
    } catch (err) {
      console.error('Failed to load incident impact:', err);
    }
  };

  const clearAllFilters = () => {
    setFilterBu(null);
    setFilterMgr(null);
    setFilterOrgAbbr(null);
    setFilterStatus(null);
    setFilterPatchingStatus(null);
    setFilterNotes(null);
    setFilterCommunication(null);
    setFilterProduct(null);
  };

  const handleStatusChange = async (serverId: string, newStatus: TriageHostStatus) => {
    if (!selectedIncidentId) return;

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
    if (!selectedIncidentId) return;

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

  const handleToggleCommunicated = async (serverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIncidentId) return;

    const current = hostDetails[serverId] || { server_id: serverId, status: 'To be contacted' };
    const newCommState = !current.communicated;
    const updated: IncidentHostDetail = {
      ...current,
      communicated: newCommState,
      communication_date: newCommState ? new Date().toISOString().split('T')[0] : undefined,
      status: newCommState ? 'Contacted' : current.status,
      updated_at: new Date().toISOString(),
    };

    setHostDetails(prev => ({
      ...prev,
      [serverId]: updated,
    }));

    try {
      await api.updateIncidentHostDetail(selectedIncidentId, serverId, updated);
    } catch (err) {
      console.error('Failed to toggle communication status:', err);
    }
  };

  const handleMarkAllCommunicated = async () => {
    if (!selectedIncidentId || !impact) return;
    const now = new Date().toISOString().split('T')[0];
    const updatedMap = { ...hostDetails };

    for (const s of impact.affected_servers) {
      const current = updatedMap[s.id] || { server_id: s.id, status: 'To be contacted' };
      updatedMap[s.id] = {
        ...current,
        communicated: true,
        communication_date: now,
        status: current.status === 'To be contacted' ? 'Patching' : current.status,
        updated_at: new Date().toISOString(),
      };
      await api.updateIncidentHostDetail(selectedIncidentId, s.id, updatedMap[s.id]);
    }

    setHostDetails(updatedMap);
  };

  // Open Notes Modal
  const openNotesModal = (server: ServerRecord) => {
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
    if (!selectedIncidentId || !editingServer) return;
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
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewIoc('');
      await loadIncidents();
      handleSelectIncident(created.id, created);
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
    } catch (err) {
      console.error('Failed to add servers:', err);
    }
  };

  // Close & Archive active incident handler
  const handleCloseAndArchive = async () => {
    if (!selectedIncident) return;
    setClosingIncident(true);
    try {
      const now = new Date().toISOString();
      await api.updateIncident(selectedIncident.id, {
        status: 'Closed',
        closed_at: now,
        closed_by: closingEngineer || 'SecOps Lead',
        description: closureNotes
          ? `${selectedIncident.description}\n\n[RESOLVED & ARCHIVED on ${new Date().toLocaleDateString()} by ${closingEngineer || 'SecOps Lead'}]: ${closureNotes}`
          : selectedIncident.description,
      });

      setIncidents(prev =>
        prev.map(i =>
          i.id === selectedIncident.id
            ? {
                ...i,
                status: 'Closed',
                closed_at: now,
                closed_by: closingEngineer || 'SecOps Lead',
              }
            : i
        )
      );
      setShowCloseModal(false);
      setClosureNotes('');
    } catch (err) {
      console.error('Failed to close and archive incident:', err);
    } finally {
      setClosingIncident(false);
    }
  };

  // Reopen incident handler
  const handleReopenIncident = async () => {
    if (!selectedIncident) return;
    try {
      await api.updateIncident(selectedIncident.id, {
        status: 'Investigating',
      });
      setIncidents(prev =>
        prev.map(i =>
          i.id === selectedIncident.id
            ? {
                ...i,
                status: 'Investigating',
              }
            : i
        )
      );
    } catch (err) {
      console.error('Failed to reopen incident:', err);
    }
  };

  // Calculations for Overview Dashboard Metrics
  const affectedList = impact?.affected_servers || [];
  const totalServers = affectedList.length;

  // 1. Business Units Linked with breakdown
  const buBreakdown = useMemo(() => {
    const map = new Map<string, {
      name: string;
      total: number;
      patched: number;
      inProgress: number;
      communicated: number;
      managers: Set<string>;
      isolated: number;
    }>();

    affectedList.forEach(s => {
      const bu = s.business_unit || 'Unassigned';
      if (!map.has(bu)) {
        map.set(bu, {
          name: bu,
          total: 0,
          patched: 0,
          inProgress: 0,
          communicated: 0,
          managers: new Set(),
          isolated: 0,
        });
      }
      const item = map.get(bu)!;
      item.total++;
      if (s.manager) item.managers.add(s.manager);

      const detail = hostDetails[s.id];
      const isPatched = detail?.status === 'Patched' || detail?.status === 'Patch' || detail?.patching_status === 'Patched' || detail?.patching_status === 'Validated';
      if (isPatched) {
        item.patched++;
      } else if (detail?.status === 'Patching' || detail?.patching_status === 'In progress') {
        item.inProgress++;
      }
      if (detail?.status === 'Contacted' || detail?.communicated) {
        item.communicated++;
      }
      if (detail?.status === 'Isolated') {
        item.isolated++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [affectedList, hostDetails]);

  // 2. Patching Status Breakdown
  const patchingStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Patched': 0,
      'In progress': 0,
      'Validation required': 0,
      'Not Started': 0,
      'Exception': 0,
    };

    affectedList.forEach(s => {
      const st = hostDetails[s.id]?.patching_status || 'Not Started';
      counts[st] = (counts[st] || 0) + 1;
    });

    const patchedTotal = counts['Patched'] + (counts['Validated'] || 0);
    const pct = totalServers > 0 ? Math.round((patchedTotal / totalServers) * 100) : 0;

    return { counts, patchedTotal, pct };
  }, [affectedList, hostDetails, totalServers]);

  // 3. Notes Coverage
  const notesStats = useMemo(() => {
    let hasNotesCount = 0;
    affectedList.forEach(s => {
      const d = hostDetails[s.id];
      if ((d?.notes && d.notes.trim().length > 0) || d?.patch_engineer || d?.ticket_number) {
        hasNotesCount++;
      }
    });
    const missingNotesCount = totalServers - hasNotesCount;
    const pct = totalServers > 0 ? Math.round((hasNotesCount / totalServers) * 100) : 0;
    return { hasNotesCount, missingNotesCount, pct };
  }, [affectedList, hostDetails, totalServers]);

  // 4. Communication Status
  const commStats = useMemo(() => {
    let communicatedCount = 0;
    affectedList.forEach(s => {
      const d = hostDetails[s.id];
      if (d?.communicated) {
        communicatedCount++;
      }
    });
    const pendingCommCount = totalServers - communicatedCount;
    const pct = totalServers > 0 ? Math.round((communicatedCount / totalServers) * 100) : 0;
    return { communicatedCount, pendingCommCount, pct };
  }, [affectedList, hostDetails, totalServers]);

  // 5. Triage Status Distribution
  const triageStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Isolated': 0,
      'Patching': 0,
      'Patched': 0,
      'Patch': 0,
      'Contacted': 0,
      'To be contacted': 0,
      'Not Affected': 0,
      'Uninstalled': 0,
    };
    affectedList.forEach(s => {
      const st = hostDetails[s.id]?.status || 'To be contacted';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [affectedList, hostDetails]);

  // 6. Impacted Software Products & Workload Functions
  const productBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    affectedList.forEach(s => {
      const p = s.product || 'Unassigned Product';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [affectedList]);

  const functionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    affectedList.forEach(s => {
      const f = s.function || 'General Server';
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [affectedList]);

  // 7. Organisation Abbreviated Breakdown
  const orgAbbrBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    affectedList.forEach(s => {
      const org = s.organisation_abbreviated || 'Unassigned';
      counts[org] = (counts[org] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [affectedList]);

  // 8. Responsible Managers looking into the issues
  const managerAccountability = useMemo(() => {
    const map = new Map<string, {
      name: string;
      email: string;
      total: number;
      patched: number;
      communicated: boolean;
      businessUnits: Set<string>;
    }>();

    affectedList.forEach(s => {
      const mgr = s.manager || 'Unassigned Manager';
      if (!map.has(mgr)) {
        map.set(mgr, {
          name: mgr,
          email: s.email || '',
          total: 0,
          patched: 0,
          communicated: true,
          businessUnits: new Set(),
        });
      }
      const entry = map.get(mgr)!;
      entry.total++;
      if (s.business_unit) entry.businessUnits.add(s.business_unit);

      const d = hostDetails[s.id];
      if (d?.patching_status === 'Patched' || d?.patching_status === 'Validated') {
        entry.patched++;
      }
      if (!d?.communicated) {
        entry.communicated = false;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [affectedList, hostDetails]);

  // Filtered affected servers for display in table
  const displayedServers = useMemo(() => {
    return affectedList.filter(s => {
      if (filterBu && s.business_unit !== filterBu) return false;
      if (filterMgr && s.manager !== filterMgr) return false;
      if (filterOrgAbbr && s.organisation_abbreviated !== filterOrgAbbr) return false;
      if (filterProduct && s.product !== filterProduct) return false;

      const detail = hostDetails[s.id];
      if (filterStatus && (detail?.status || 'To be contacted') !== filterStatus) return false;
      if (filterPatchingStatus && (detail?.patching_status || 'Not Started') !== filterPatchingStatus) return false;

      if (filterNotes === 'has_notes') {
        const has = Boolean((detail?.notes && detail.notes.trim().length > 0) || detail?.patch_engineer || detail?.ticket_number);
        if (!has) return false;
      } else if (filterNotes === 'no_notes') {
        const has = Boolean((detail?.notes && detail.notes.trim().length > 0) || detail?.patch_engineer || detail?.ticket_number);
        if (has) return false;
      }

      if (filterCommunication === 'communicated' && !detail?.communicated) return false;
      if (filterCommunication === 'pending' && detail?.communicated) return false;

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
    filterOrgAbbr,
    filterProduct,
    filterStatus,
    filterPatchingStatus,
    filterNotes,
    filterCommunication,
    searchTable,
    hostDetails,
  ]);

  const hasActiveFilters = Boolean(
    filterBu || filterMgr || filterOrgAbbr || filterProduct || filterStatus || filterPatchingStatus || filterNotes || filterCommunication || searchTable
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
        `"${s.host}"`,
        `"${s.vm}"`,
        `"${s.primary_ip_address}"`,
        `"${s.business_unit}"`,
        `"${s.product}"`,
        `"${s.function}"`,
        `"${s.organisation_abbreviated}"`,
        `"${s.manager}"`,
        `"${s.email}"`,
        `"${d.status || 'To be contacted'}"`,
        `"${d.patching_status || 'Not Started'}"`,
        `"${d.patch_engineer || ''}"`,
        `"${d.patching_date || ''}"`,
        `"${d.ticket_number || ''}"`,
        `"${d.communicated ? 'YES' : 'NO'}"`,
        `"${(d.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_${selectedIncident?.incident_reference}_triage.csv`;
    a.click();
  };

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

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
              <h1 className="text-base font-bold text-white tracking-wide">
                INCIDENT TRIAGE & REMEDIATION COMMAND CENTER
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                Metrics & Triage
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time operational dashboard tracking Business Units, Patching Lifecycle, Notes Documentation, and Stakeholder Outreach.
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
          <button
            onClick={() => setViewMode('unified')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'unified'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Unified View</span>
          </button>
          <button
            onClick={() => setViewMode('dashboard_only')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'dashboard_only'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Metrics Dashboard</span>
          </button>
          <button
            onClick={() => setViewMode('table_only')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'table_only'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>Action Table</span>
          </button>
        </div>
      </div>

      {/* Incident Switcher Ribbon & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {incidents.map(inc => {
            const isClosed = inc.status === 'Closed' || inc.status === 'Archived';
            return (
              <button
                key={inc.id}
                onClick={() => handleSelectIncident(inc.id, inc)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all shrink-0 cursor-pointer ${
                  selectedIncidentId === inc.id
                    ? isClosed
                      ? 'bg-slate-800/90 border-emerald-500/50 text-emerald-200 shadow-sm'
                      : 'bg-rose-950/30 border-rose-500/50 text-rose-200 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isClosed ? 'bg-emerald-400' : inc.severity === 'Critical' ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                />
                <span className="font-semibold text-white">{inc.incident_reference}</span>
                {isClosed && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                    ARCHIVED
                  </span>
                )}
                <span className="text-[11px] truncate max-w-[170px]">{inc.incident_title}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedIncident && (
            <>
              {selectedIncident.status === 'Closed' || selectedIncident.status === 'Archived' ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ARCHIVED & CLOSED</span>
                  </span>
                  <button
                    onClick={handleReopenIncident}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-mono cursor-pointer transition-colors"
                    title="Reopen this incident for investigation"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reopen</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/50 text-xs font-mono font-semibold hover:border-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                  title="Close and archive active incident"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Close & Archive Incident</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-mono font-medium hover:bg-rose-500 transition-colors cursor-pointer shrink-0 shadow-lg shadow-rose-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {selectedIncident && (
        <div className="space-y-6">
          {/* ============================================================== */}
          {/* OVERVIEW DASHBOARD PURELY BASED ON METRICS                     */}
          {/* (Rendered in 'unified' and 'dashboard_only' modes)             */}
          {/* ============================================================== */}
          {(viewMode === 'unified' || viewMode === 'dashboard_only') && (
            <div className="space-y-5">
              {/* 1. TOP EXECUTIVE PULSE BAR (6 KEY METRIC TILES) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Impacted Assets */}
                <div
                  onClick={() => clearAllFilters()}
                  className="p-3.5 rounded-xl soc-glass-panel border border-white/10 hover:border-blue-400/40 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider">Impacted Assets</span>
                    <Server className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">{totalServers}</div>
                  <div className="text-[10px] text-slate-400 font-mono">100% In Blast Radius</div>
                </div>

                {/* 2. Patched Systems */}
                <div
                  onClick={() => setFilterStatus(filterStatus === 'Patched' ? null : 'Patched')}
                  className={`p-3.5 rounded-xl soc-glass-panel border cursor-pointer transition-all space-y-1 ${
                    filterStatus === 'Patched' ? 'border-emerald-400 bg-emerald-950/30' : 'border-emerald-500/30 hover:border-emerald-400/50 bg-emerald-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Patched Systems</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {(triageStats['Patched'] || 0) + (triageStats['Patch'] || 0)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ({totalServers > 0 ? Math.round((((triageStats['Patched'] || 0) + (triageStats['Patch'] || 0)) / totalServers) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all"
                      style={{
                        width: `${totalServers > 0 ? Math.round((((triageStats['Patched'] || 0) + (triageStats['Patch'] || 0)) / totalServers) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 3. Communication Outreach */}
                <div
                  onClick={() => setFilterCommunication(filterCommunication === 'communicated' ? null : 'communicated')}
                  className={`p-3.5 rounded-xl soc-glass-panel border cursor-pointer transition-all space-y-1 ${
                    filterCommunication === 'communicated' ? 'border-blue-400 bg-blue-950/30' : 'border-blue-500/30 hover:border-blue-400/50 bg-blue-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Communicated</span>
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-blue-300">{commStats.pct}%</span>
                    <span className="text-xs font-mono text-slate-400">({commStats.communicatedCount}/{totalServers})</span>
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono">
                    {commStats.pendingCommCount} Pending Outreach
                  </div>
                </div>

                {/* 4. Notes Coverage */}
                <div
                  onClick={() => setFilterNotes(filterNotes === 'has_notes' ? null : 'has_notes')}
                  className={`p-3.5 rounded-xl soc-glass-panel border cursor-pointer transition-all space-y-1 ${
                    filterNotes === 'has_notes' ? 'border-amber-400 bg-amber-950/30' : 'border-amber-500/30 hover:border-amber-400/50 bg-amber-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-amber-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Notes & Tickets</span>
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-amber-300">{notesStats.pct}%</span>
                    <span className="text-xs font-mono text-slate-400">({notesStats.hasNotesCount}/{totalServers})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {notesStats.missingNotesCount} Missing Notes
                  </div>
                </div>

                {/* 5. Isolated Containment */}
                <div
                  onClick={() => setFilterStatus(filterStatus === 'Isolated' ? null : 'Isolated')}
                  className={`p-3.5 rounded-xl soc-glass-panel border cursor-pointer transition-all space-y-1 ${
                    filterStatus === 'Isolated' ? 'border-rose-400 bg-rose-950/30' : 'border-rose-500/30 hover:border-rose-400/50 bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-rose-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Isolated Hosts</span>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-300">{triageStats['Isolated']}</div>
                  <div className="text-[10px] text-rose-400 font-mono">Quarantine Active</div>
                </div>

                {/* 6. Linked Business Units */}
                <div
                  onClick={() => clearAllFilters()}
                  className="p-3.5 rounded-xl soc-glass-panel border border-purple-500/30 bg-purple-950/10 hover:border-purple-400/50 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between text-purple-400">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Linked BUs</span>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-purple-300">{buBreakdown.length}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Across Organisation</div>
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
                    <button
                      onClick={handleMarkAllCommunicated}
                      className="text-[10px] font-mono text-blue-400 hover:text-blue-300 underline cursor-pointer"
                      title="Set all affected hosts as notified"
                    >
                      Notify All
                    </button>
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
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300">
                            {mgr.total} server{mgr.total > 1 ? 's' : ''}
                          </span>
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
          {/* (Rendered in 'unified' and 'table_only' modes)                 */}
          {/* ============================================================== */}
          {(viewMode === 'unified' || viewMode === 'table_only') && (
            <div className="rounded-xl soc-glass-panel border border-white/15 overflow-hidden space-y-4 p-5 shadow-2xl bg-[#0F172A]/80">
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
                  {filterOrgAbbr && <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Org: {filterOrgAbbr}</span>}
                  {filterProduct && <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Product: {filterProduct}</span>}
                  {filterStatus && <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Status: {filterStatus}</span>}
                  {filterPatchingStatus && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Patching: {filterPatchingStatus}</span>}
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
                              className={`p-3 font-medium cursor-pointer ${
                                isPatched ? 'text-emerald-200 hover:text-white font-semibold' : 'text-white hover:text-blue-300'
                              }`}
                              onClick={() => onSelectServer(s.id)}
                              title="Click to view full server profile"
                            >
                              <div className="flex items-center gap-1.5">
                                {isPatched && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                <span>{s.host}</span>
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
          <div className="w-full max-w-xl bg-[#111827] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold font-mono text-white">
                    Investigation & Remediation Notes: {editingServer.host}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  VM: {editingServer.vm} • IP: {editingServer.primary_ip_address} • BU: {editingServer.business_unit}
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
                  placeholder="e.g. Sarah Jenkins (Senior SecOps)"
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
                    className="w-full p-2 rounded-lg bg-[#1F2937] border border-white/10 text-white font-mono focus:outline-none focus:border-blue-400"
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
                  <span>Ticket Number / Change Reference</span>
                </label>
                <input
                  type="text"
                  value={noteFormTicket}
                  onChange={e => setNoteFormTicket(e.target.value)}
                  placeholder="e.g. SEC-2026-9041 / CHG-4812"
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
                  <span>Stakeholder / Business Owner Notified of this Incident</span>
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
          <div className="w-full max-w-lg bg-[#111827] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
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
                  <span>Patched Status: <strong className="text-emerald-400">{(triageStats['Patched'] || 0) + (triageStats['Patch'] || 0)}</strong></span>
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
          <div className="w-full max-w-lg bg-[#111827] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
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
                  rows={3}
                  placeholder="Incident overview, affected subsystems, and technical notes..."
                  className="w-full p-2 rounded bg-white/5 border border-white/10 text-white"
                />
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

      {/* ADD AFFECTED SERVERS MODAL */}
      {showAddServersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-[#111827] border border-white/15 rounded-xl p-5 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" /> Batch Match Affected Infrastructure
            </h2>
            <p className="text-xs text-slate-400">
              Paste a list of hostnames, VM IDs, or IP addresses (separated by commas, newlines, or spaces). The system will correlate against inventory.
            </p>

            <div className="space-y-3">
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
                    <Check className="w-4 h-4" /> Successfully matched {addResults.matched} server(s).
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
                className="px-3 py-1.5 rounded bg-white/5 text-slate-300 hover:bg-white/10 text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkAddServers}
                className="px-4 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-500 text-xs cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Correlate & Add to Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
