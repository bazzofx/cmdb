import React, { useState, useEffect } from 'react';
import {
  Server,
  Filter,
  Download,
  Copy,
  Check,
  Search,
  X,
  ChevronDown,
  Layers,
  Building2,
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Mail,
  ShieldAlert as IncidentIcon,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface InventoryViewProps {
  initialFilters?: Record<string, string>;
  onSelectServer: (id: string) => void;
  onOpenCommunicationsWithServers: (serverIds: string[]) => void;
  onOpenIncidentWithServers: (serverIds: string[]) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  initialFilters = {},
  onSelectServer,
  onOpenCommunicationsWithServers,
  onOpenIncidentWithServers,
}) => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  // Active filter state
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Filter options loaded from database
  const [filterOptions, setFilterOptions] = useState<{
    businessUnits: string[];
    subBusinessUnits: string[];
    managers: string[];
    environments: string[];
    supportTeams: string[];
    datacenters: string[];
    customers: string[];
    products: string[];
    functions: string[];
  }>({
    businessUnits: [],
    subBusinessUnits: [],
    managers: [],
    environments: [],
    supportTeams: [],
    datacenters: [],
    customers: [],
    products: [],
    functions: [],
  });

  // Visible columns configuration (Section 7.1)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    host: true,
    vm: true,
    business_unit: true,
    sub_business_unit: true,
    manager: true,
    email: true,
    support_team: true,
    environment: true,
    customer: true,
    dns_name: true,
    primary_ip_address: true,
    datacenter: true,
    power_state: true,
    efi_secure_boot: true,
    product: false,
    function: false,
    annotation: false,
    network_1: false,
    network_2: false,
  });

  // Load filter options on mount
  useEffect(() => {
    api.getServers({ limit: 1000 }).then(res => {
      const all = res.items;
      setFilterOptions({
        businessUnits: Array.from(new Set(all.map(s => s.business_unit).filter(Boolean))),
        subBusinessUnits: Array.from(new Set(all.map(s => s.sub_business_unit).filter(Boolean))),
        managers: Array.from(new Set(all.map(s => s.manager).filter(Boolean))),
        environments: Array.from(new Set(all.map(s => s.environment).filter(Boolean))),
        supportTeams: Array.from(new Set(all.map(s => s.support_team).filter(Boolean))),
        datacenters: Array.from(new Set(all.map(s => s.datacenter).filter(Boolean))),
        customers: Array.from(new Set(all.map(s => s.customer).filter(Boolean))),
        products: Array.from(new Set(all.map(s => s.product).filter(Boolean))),
        functions: Array.from(new Set(all.map(s => s.function).filter(Boolean))),
      });
    });
  }, []);

  // Sync when initialFilters changes (e.g. from Navbar 4_Product quick section)
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      setFilters(initialFilters);
      if (initialFilters.product) {
        setVisibleColumns(prev => ({ ...prev, product: true }));
      }
      setPage(1);
    }
  }, [initialFilters]);

  // Fetch servers when filters, search, or pagination changes
  const fetchServers = () => {
    setLoading(true);
    api.getServers({
      ...filters,
      q: searchQuery,
      page,
      limit: pageSize,
    })
      .then(res => {
        setServers(res.items);
        setTotal(res.total);
      })
      .catch(err => console.error('Failed to fetch servers:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchServers();
  }, [filters, searchQuery, page, pageSize]);

  // Handle active filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1);
  };

  const removeFilter = (key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
  };

  // Bulk Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === servers.length && servers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(servers.map(s => s.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk Actions
  const getSelectedServers = () => servers.filter(s => selectedIds.has(s.id));

  const copySelectedHostnames = () => {
    const list = getSelectedServers().map(s => s.host).join('\n');
    navigator.clipboard.writeText(list);
    setCopiedAction('hostnames');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const copySelectedIPs = () => {
    const list = getSelectedServers().map(s => s.primary_ip_address).filter(Boolean).join('\n');
    navigator.clipboard.writeText(list);
    setCopiedAction('ips');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const exportSelectedCsv = () => {
    const targetList = selectedIds.size > 0 ? getSelectedServers() : servers;
    if (targetList.length === 0) return;

    const headers = [
      'Host',
      'VM',
      'Business Unit',
      'Sub Business Unit',
      'Manager',
      'Email',
      'Support Team',
      'Environment',
      'Customer',
      'Power State',
      'DNS Name',
      'Primary IP Address',
      'EFI Secure Boot',
      'Datacenter',
      'Product',
      'Function',
    ];

    const rows = targetList.map(s => [
      `"${s.host}"`,
      `"${s.vm}"`,
      `"${s.business_unit || ''}"`,
      `"${s.sub_business_unit || ''}"`,
      `"${s.manager || ''}"`,
      `"${s.email || ''}"`,
      `"${s.support_team || ''}"`,
      `"${s.environment || ''}"`,
      `"${s.customer || ''}"`,
      `"${s.power_state || ''}"`,
      `"${s.dns_name || ''}"`,
      `"${s.primary_ip_address || ''}"`,
      `"${s.efi_secure_boot === true ? 'TRUE' : s.efi_secure_boot === false ? 'FALSE' : 'UNKNOWN'}"`,
      `"${s.datacenter || ''}"`,
      `"${s.product || ''}"`,
      `"${s.function || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `csm_server_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const activeFilterKeys = Object.keys(filters);

  return (
    <div className="space-y-4 max-w-full">
      {/* Table Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              SERVER INFRASTRUCTURE INVENTORY
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Showing {servers.length} of {total} indexed hosts
            </p>
          </div>
        </div>

        {/* Search & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search within table */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter table..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Filter Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                activeFilterKeys.length > 0
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters ({activeFilterKeys.length})</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {/* Filter Flyout */}
            {showFilterDropdown && (
              <div className="absolute right-0 top-10 w-80 bg-[#111827] border border-white/15 rounded-xl shadow-2xl p-4 z-40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-mono font-semibold uppercase text-slate-300">
                    Infrastructure Filters
                  </span>
                  <button
                    onClick={() => setShowFilterDropdown(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 text-xs">
                  {/* BU Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Business Unit</label>
                    <select
                      value={filters.business_unit || ''}
                      onChange={e => handleFilterChange('business_unit', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All Business Units</option>
                      {filterOptions.businessUnits.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Environment Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Environment</label>
                    <select
                      value={filters.environment || ''}
                      onChange={e => handleFilterChange('environment', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All Environments</option>
                      {filterOptions.environments.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </div>

                  {/* Manager Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Manager</label>
                    <select
                      value={filters.manager || ''}
                      onChange={e => handleFilterChange('manager', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All Managers</option>
                      {filterOptions.managers.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Secure Boot Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">EFI Secure Boot</label>
                    <select
                      value={filters.secure_boot || ''}
                      onChange={e => handleFilterChange('secure_boot', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All States</option>
                      <option value="TRUE">Enabled (Compliant)</option>
                      <option value="FALSE">Disabled (Attention Required)</option>
                      <option value="UNKNOWN">Unknown / Missing</option>
                    </select>
                  </div>

                  {/* Datacenter Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Datacenter</label>
                    <select
                      value={filters.datacenter || ''}
                      onChange={e => handleFilterChange('datacenter', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All Datacenters</option>
                      {filterOptions.datacenters.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Support Team Filter */}
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase">Support Team</label>
                    <select
                      value={filters.support_team || ''}
                      onChange={e => handleFilterChange('support_team', e.target.value)}
                      className="w-full mt-1 p-1.5 rounded bg-white/5 border border-white/10 text-slate-200"
                    >
                      <option value="">All Teams</option>
                      {filterOptions.supportTeams.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex justify-between">
                  <button
                    onClick={clearAllFilters}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-mono"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilterDropdown(false)}
                    className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Column Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-10 w-56 bg-[#111827] border border-white/15 rounded-xl shadow-2xl p-3 z-40 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-white/10 text-xs font-mono font-semibold uppercase text-slate-300">
                  <span>Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
                  {Object.entries(visibleColumns).map(([col, isVisible]) => (
                    <label key={col} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={e =>
                          setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }))
                        }
                        className="rounded border-white/20 bg-white/5"
                      />
                      <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportSelectedCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips (Section 7.2) */}
      {activeFilterKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 text-xs">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Active Filters:</span>
          {activeFilterKeys.map(key => (
            <span
              key={key}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-[11px]"
            >
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>: {filters[key]}
              <button onClick={() => removeFilter(key)} className="hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-mono ml-2 underline cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Bulk Action Bar (Section 7.3) */}
      {selectedIds.size > 0 && (
        <div className="p-3 rounded-lg bg-blue-900/30 border border-blue-400/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-mono text-white font-semibold">{selectedIds.size} servers selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono">
            <button
              onClick={copySelectedHostnames}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
            >
              {copiedAction === 'hostnames' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Hosts</span>
            </button>

            <button
              onClick={copySelectedIPs}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
            >
              {copiedAction === 'ips' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy IPs</span>
            </button>

            <button
              onClick={() => onOpenIncidentWithServers(Array.from(selectedIds))}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors cursor-pointer"
            >
              <IncidentIcon className="w-3.5 h-3.5" />
              <span>Incident Impact</span>
            </button>

            <button
              onClick={() => onOpenCommunicationsWithServers(Array.from(selectedIds))}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact List</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-slate-400 hover:text-white px-2 py-1"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Main Inventory Table (Section 7.1) */}
      <div className="rounded-xl soc-glass-panel overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === servers.length && servers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-white/5 cursor-pointer"
                  />
                </th>
                {visibleColumns.host && <th className="p-3 font-semibold">Host</th>}
                {visibleColumns.vm && <th className="p-3 font-semibold">VM Identifier</th>}
                {visibleColumns.business_unit && <th className="p-3 font-semibold">Business Unit</th>}
                {visibleColumns.sub_business_unit && <th className="p-3 font-semibold">Sub-BU</th>}
                {visibleColumns.manager && <th className="p-3 font-semibold">Manager</th>}
                {visibleColumns.email && <th className="p-3 font-semibold">Email</th>}
                {visibleColumns.support_team && <th className="p-3 font-semibold">Support Team</th>}
                {visibleColumns.environment && <th className="p-3 font-semibold">Env</th>}
                {visibleColumns.customer && <th className="p-3 font-semibold">Customer</th>}
                {visibleColumns.dns_name && <th className="p-3 font-semibold">DNS Name</th>}
                {visibleColumns.primary_ip_address && <th className="p-3 font-semibold">Primary IP</th>}
                {visibleColumns.datacenter && <th className="p-3 font-semibold">Datacenter</th>}
                {visibleColumns.power_state && <th className="p-3 font-semibold">Power State</th>}
                {visibleColumns.efi_secure_boot && <th className="p-3 font-semibold">Secure Boot</th>}
                {visibleColumns.product && <th className="p-3 font-semibold">Product</th>}
                {visibleColumns.function && <th className="p-3 font-semibold">Function</th>}
                {visibleColumns.annotation && <th className="p-3 font-semibold">Annotation</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={15} className="p-8 text-center text-xs font-mono text-slate-400">
                    Loading server infrastructure inventory...
                  </td>
                </tr>
              ) : servers.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-8 text-center text-slate-400">
                    No servers match the selected criteria.
                  </td>
                </tr>
              ) : (
                servers.map(server => {
                  const isSelected = selectedIds.has(server.id);
                  return (
                    <tr
                      key={server.id}
                      onClick={() => onSelectServer(server.id)}
                      className={`hover:bg-white/[0.04] transition-colors cursor-pointer select-none ${
                        isSelected ? 'bg-blue-600/10' : ''
                      }`}
                    >
                      <td className="p-3 text-center" onClick={e => toggleSelectRow(server.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-white/20 bg-white/5 cursor-pointer"
                        />
                      </td>

                      {visibleColumns.host && (
                        <td className="p-3 font-mono font-medium text-white truncate max-w-[180px]">
                          {server.host}
                        </td>
                      )}

                      {visibleColumns.vm && (
                        <td className="p-3 font-mono text-slate-300">
                          {server.vm}
                        </td>
                      )}

                      {visibleColumns.business_unit && (
                        <td className="p-3 text-purple-300 font-medium">
                          {server.business_unit || <span className="text-slate-600">—</span>}
                        </td>
                      )}

                      {visibleColumns.sub_business_unit && (
                        <td className="p-3 text-slate-300">
                          {server.sub_business_unit || <span className="text-slate-600">—</span>}
                        </td>
                      )}

                      {visibleColumns.manager && (
                        <td className="p-3 text-slate-200">
                          {server.manager || <span className="text-amber-400 font-mono text-[11px]">Unassigned</span>}
                        </td>
                      )}

                      {visibleColumns.email && (
                        <td className="p-3 text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                          {server.email || <span className="text-amber-400">Missing</span>}
                        </td>
                      )}

                      {visibleColumns.support_team && (
                        <td className="p-3 text-slate-300 font-mono">
                          {server.support_team || '—'}
                        </td>
                      )}

                      {visibleColumns.environment && (
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-mono text-[10px]">
                            {server.environment}
                          </span>
                        </td>
                      )}

                      {visibleColumns.customer && (
                        <td className="p-3 text-slate-300">
                          {server.customer || '—'}
                        </td>
                      )}

                      {visibleColumns.dns_name && (
                        <td className="p-3 font-mono text-slate-400 text-[11px] truncate max-w-[160px]">
                          {server.dns_name || '—'}
                        </td>
                      )}

                      {visibleColumns.primary_ip_address && (
                        <td className="p-3 font-mono text-cyan-300 font-medium">
                          {server.primary_ip_address || '—'}
                        </td>
                      )}

                      {visibleColumns.datacenter && (
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {server.datacenter || '—'}
                        </td>
                      )}

                      {visibleColumns.power_state && (
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              server.power_state === 'poweredOn'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {server.power_state}
                          </span>
                        </td>
                      )}

                      {visibleColumns.efi_secure_boot && (
                        <td className="p-3">
                          {server.efi_secure_boot === true ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <ShieldCheck className="w-3 h-3" /> TRUE
                            </span>
                          ) : server.efi_secure_boot === false ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              <ShieldAlert className="w-3 h-3" /> FALSE
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">
                              UNKNOWN
                            </span>
                          )}
                        </td>
                      )}

                      {visibleColumns.product && (
                        <td className="p-3 text-slate-300">{server.product}</td>
                      )}

                      {visibleColumns.function && (
                        <td className="p-3 text-slate-300">{server.function}</td>
                      )}

                      {visibleColumns.annotation && (
                        <td className="p-3 text-amber-300 text-[11px] truncate max-w-[140px]">{server.annotation}</td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer */}
        <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-slate-300"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Page {page} of {Math.ceil(total / pageSize) || 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
