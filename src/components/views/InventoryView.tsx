import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Server,
  Download,
  Copy,
  Check,
  Search,
  X,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Mail,
  ShieldAlert as IncidentIcon,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { downloadCsv } from '../../utils/export.js';
import { todayIso } from '../../utils/format.js';
import type { ServerRecord } from '../../types/index.js';

// Canonical column labels and order, shared by the table and the CSV export.
const COLUMN_LABELS: Record<string, string> = {
    vm: 'VM Identifier',
    environment: 'Env',
    business_unit: 'Business Unit',
    sub_business_unit: 'Sub-BU',
    customer: 'Customer',
    product: 'Product',
    function: 'Function',
    support_team: 'Support Team',
    manager: 'Manager',
    email: 'Email',
    primary_ip_address: 'Primary IP',
    datacenter: 'Datacenter',
    host: 'Host',
    power_state: 'Power State',
    efi_secure_boot: 'Secure Boot',
    dns_name: 'DNS Name',
    annotation: 'Annotation',
};

interface InventoryViewProps {
  initialFilters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
  onClearFilters?: () => void;
  onSelectServer: (id: string) => void;
  onOpenCommunicationsWithServers: (serverIds: string[]) => void;
  onOpenIncidentWithServers: (serverIds: string[]) => void;
  canCreateIncident?: boolean;
  canCommunicate?: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  initialFilters = {},
  onFiltersChange,
  onClearFilters,
  onSelectServer,
  onOpenCommunicationsWithServers,
  onOpenIncidentWithServers,
  canCreateIncident = true,
  canCommunicate = true,
}) => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced so typing does not fire one /api/servers request per keystroke.
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  // Active filter state
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Column header sorting and interactive filter dropdown state
  const [sortBy, setSortBy] = useState<string>('vm');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<string | null>(null);
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');
  const [allServers, setAllServers] = useState<ServerRecord[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close column header dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveHeaderDropdown(null);
        setColumnSearchQuery('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveHeaderDropdown(null);
        setColumnSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  // Visible columns configuration ordered according to specification
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    vm: true,
    environment: true,
    business_unit: true,
    sub_business_unit: true,
    customer: true,
    product: true,
    function: true,
    support_team: true,
    manager: true,
    email: true,
    primary_ip_address: true,
    datacenter: true,
    host: false,
    power_state: false,
    efi_secure_boot: false,
    dns_name: false,
    annotation: false,
  });

  // Load full server list on mount to compute column options and counts
  useEffect(() => {
    api.getServers({ limit: 1000 }).then(res => {
      const all = res.items;
      setAllServers(all);
    });
  }, []);

  // Distinct options and per-option counts for every column, computed once
  // per dataset instead of on every render/header.
  const columnOptions = useMemo(() => {
    const options: Record<string, Array<{ value: string; label: string; count: number }>> = {};
    for (const colKey of Object.keys(COLUMN_LABELS)) {
      const counts = new Map<string, number>();
      for (const server of allServers) {
        const value =
          colKey === 'efi_secure_boot'
            ? server.efi_secure_boot === true
              ? 'TRUE'
              : server.efi_secure_boot === false
                ? 'FALSE'
                : 'UNKNOWN'
            : String((server as any)[colKey] || '').trim();
        if (value) counts.set(value, (counts.get(value) || 0) + 1);
      }
      options[colKey] = Array.from(counts.entries())
        .map(([value, count]) => ({
          value,
          label:
            colKey === 'efi_secure_boot'
              ? value === 'TRUE'
                ? 'Enabled (Compliant)'
                : value === 'FALSE'
                  ? 'Disabled (Attention Required)'
                  : 'Unknown / Missing'
              : value,
          count,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }
    options.secure_boot = options.efi_secure_boot;
    const unassignedManagerCount = allServers.filter(
      server => !String(server.manager || '').trim(),
    ).length;
    if (unassignedManagerCount > 0) {
      options.manager = [
        ...(options.manager ?? []),
        { value: 'Unassigned', label: 'Unassigned', count: unassignedManagerCount },
      ].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }
    return options;
  }, [allServers]);

  const getColumnOptions = (colKey: string) => columnOptions[colKey] ?? [];

  // Sync when initialFilters changes (e.g. from Navbar 4_Product quick section or external navigation)
  useEffect(() => {
    if (initialFilters !== undefined) {
      setFilters(initialFilters);
      if (initialFilters.product) {
        setVisibleColumns(prev => ({ ...prev, product: true }));
      }
      setPage(1);
    }
  }, [initialFilters]);

  // Fetch servers when filters, debounced search, sorting, or pagination changes
  const fetchServers = () => {
    setLoading(true);
    api.getServers({
      ...filters,
      q: debouncedSearch,
      sort_by: sortBy,
      sort_order: sortOrder,
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
  }, [filters, debouncedSearch, sortBy, sortOrder, page, pageSize]);

  // Handle active filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      onFiltersChange?.(next);
      return next;
    });
    setPage(1);
  };

  const removeFilter = (key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      onFiltersChange?.(next);
      return next;
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchQuery('');
    setPage(1);
    onClearFilters?.();
    onFiltersChange?.({});
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
      'VM Identifier',
      'Env',
      'Business Unit',
      'Sub-BU',
      'Customer',
      'Product',
      'Function',
      'Support Team',
      'Manager',
      'Email',
      'Primary IP',
      'Datacenter',
      'Host',
      'Power State',
      'Secure Boot',
      'DNS Name',
    ];

    const rows = targetList.map(s => [
      s.vm || '',
      s.environment || '',
      s.business_unit || '',
      s.sub_business_unit || '',
      s.customer || '',
      s.product || '',
      s.function || '',
      s.support_team || '',
      s.manager || '',
      s.email || '',
      s.primary_ip_address || '',
      s.datacenter || '',
      s.host || '',
      s.power_state || '',
      s.efi_secure_boot === true ? 'TRUE' : s.efi_secure_boot === false ? 'FALSE' : 'UNKNOWN',
      s.dns_name || '',
    ]);

    downloadCsv(`csm_server_inventory_${todayIso()}.csv`, headers, rows);
  };

  const activeFilterKeys = Object.keys(filters);

  // Interactive Column Header Component with integrated Sorting & Filtering
  const renderColumnHeader = (colKey: string, label: string, customFilterKey?: string) => {
    const fKey = customFilterKey || colKey;
    const isFiltered = !!filters[fKey];
    const isSorted = sortBy === colKey;
    const isOpen = activeHeaderDropdown === colKey;
    const options = getColumnOptions(colKey);
    const filteredOptions = columnSearchQuery
      ? options.filter(o => o.label.toLowerCase().includes(columnSearchQuery.toLowerCase()))
      : options;

    const alignRight = ['datacenter', 'primary_ip_address', 'annotation', 'dns_name', 'efi_secure_boot'].includes(colKey);

    return (
      <th key={colKey} className={`p-2 relative select-none ${isOpen ? 'z-50' : 'z-20'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setActiveHeaderDropdown(null);
              setColumnSearchQuery('');
            } else {
              setActiveHeaderDropdown(colKey);
              setColumnSearchQuery('');
            }
          }}
          className={`w-full group flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all border text-left font-mono ${
            isOpen
              ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/20'
              : isFiltered
              ? 'bg-blue-950/70 border-blue-500/50 text-blue-200'
              : isSorted
              ? 'bg-white/10 border-white/20 text-white'
              : 'border-transparent hover:bg-white/[0.07] hover:border-white/15 text-slate-300 hover:text-white'
          }`}
          title={`Click to sort or filter by ${label}`}
        >
          <span className="font-semibold text-[11px] truncate uppercase tracking-wider">{label}</span>
          <div className="flex items-center gap-1 shrink-0">
            {isSorted && (
              <span className="text-cyan-400">
                {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              </span>
            )}
            {isFiltered && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold shadow-xs">
                <Check className="w-2.5 h-2.5" />
              </span>
            )}
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            />
          </div>
        </button>

        {/* Dropdown Popup for Sorting & Filtering directly under this header */}
        {isOpen && (
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${alignRight ? 'right-0' : 'left-0'} top-full mt-1.5 min-w-[250px] max-w-[310px] bg-[#0D1527] border border-slate-700/80 rounded-xl shadow-2xl p-3 z-50 text-xs font-sans space-y-2.5 animate-in fade-in zoom-in-95 duration-150`}
            style={{ colorScheme: 'dark' }}
          >
            {/* Header info */}
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-200 font-bold truncate">
                {label} Controls
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHeaderDropdown(null);
                  setColumnSearchQuery('');
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Section */}
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Sort Order</div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setSortBy(colKey);
                    setSortOrder('asc');
                    setPage(1);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                    isSorted && sortOrder === 'asc'
                      ? 'bg-blue-600/35 border-blue-400 text-white font-bold shadow-xs'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <ArrowUp className="w-3 h-3 text-cyan-400" />
                  <span>Asc (A→Z)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortBy(colKey);
                    setSortOrder('desc');
                    setPage(1);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border transition-all cursor-pointer ${
                    isSorted && sortOrder === 'desc'
                      ? 'bg-blue-600/35 border-blue-400 text-white font-bold shadow-xs'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <ArrowDown className="w-3 h-3 text-cyan-400" />
                  <span>Desc (Z→A)</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* Filter Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                  Filter by {label}
                </span>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => removeFilter(fKey)}
                    className="text-[10px] text-rose-400 hover:text-rose-300 font-mono underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Search input for options list */}
              {options.length > 5 && (
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={columnSearchQuery}
                    onChange={(e) => setColumnSearchQuery(e.target.value)}
                    placeholder={`Search ${label}...`}
                    className="w-full pl-7 pr-2.5 py-1 text-[11px] rounded-lg bg-[#0B1223] border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}

              {/* Options list */}
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 font-mono text-[11px]">
                {/* "(Show All)" option */}
                <button
                  type="button"
                  onClick={() => {
                    removeFilter(fKey);
                    setActiveHeaderDropdown(null);
                  }}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    !isFiltered
                      ? 'bg-blue-600/20 text-white font-semibold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {!isFiltered ? <Check className="w-3 h-3 text-blue-400" /> : <span className="w-3" />}
                    <span>(Show All)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">{total}</span>
                </button>

                {filteredOptions.length === 0 ? (
                  <div className="p-2 text-center text-[10px] text-slate-500">No matching options</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = filters[fKey] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            removeFilter(fKey);
                          } else {
                            handleFilterChange(fKey, opt.value);
                          }
                          setActiveHeaderDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/30 text-white font-semibold border border-blue-500/40'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate pr-2">
                          {isSelected ? (
                            <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                          ) : (
                            <span className="w-3 shrink-0" />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0 font-normal">({opt.count})</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </th>
    );
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Table Action Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel relative ${showColumnPicker ? 'z-50' : 'z-20'}`}>
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

          {/* Reset Filters Shortcut (if any column filter is active) */}
          {activeFilterKeys.length > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs font-mono text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer shadow-sm"
              title="Clear all active column filters"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Filters ({activeFilterKeys.length})</span>
            </button>
          )}

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
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#111827] border border-white/15 rounded-xl shadow-2xl p-3 z-40 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-white/10 text-xs font-mono font-semibold uppercase text-slate-300">
                  <span>Toggle Columns</span>
                  <button onClick={() => setShowColumnPicker(false)}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
                  {Object.entries(COLUMN_LABELS).map(([col, label]) => (
                    <label key={col} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!visibleColumns[col]}
                        onChange={e =>
                          setVisibleColumns(prev => ({ ...prev, [col]: e.target.checked }))
                        }
                        className="rounded border-white/20 bg-white/5"
                      />
                      <span>{label}</span>
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
              onClick={() => canCreateIncident && onOpenIncidentWithServers(Array.from(selectedIds))}
              disabled={!canCreateIncident}
              title={canCreateIncident ? 'Open an incident for the selection' : 'Your role cannot create incidents'}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IncidentIcon className="w-3.5 h-3.5" />
              <span>Incident Impact</span>
            </button>

            <button
              onClick={() => canCommunicate && onOpenCommunicationsWithServers(Array.from(selectedIds))}
              disabled={!canCommunicate}
              title={canCommunicate ? 'Build a contact list for the selection' : 'Your role cannot open communications'}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
      <div className="relative z-10 rounded-xl soc-glass-panel border border-white/10">
        <div className="overflow-x-auto min-h-[440px] pb-24">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="relative z-30">
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === servers.length && servers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-white/5 cursor-pointer"
                  />
                </th>
                {visibleColumns.vm && renderColumnHeader('vm', 'VM Identifier')}
                {visibleColumns.environment && renderColumnHeader('environment', 'Env')}
                {visibleColumns.business_unit && renderColumnHeader('business_unit', 'Business Unit')}
                {visibleColumns.sub_business_unit && renderColumnHeader('sub_business_unit', 'Sub-BU')}
                {visibleColumns.customer && renderColumnHeader('customer', 'Customer')}
                {visibleColumns.product && renderColumnHeader('product', 'Product')}
                {visibleColumns.function && renderColumnHeader('function', 'Function')}
                {visibleColumns.support_team && renderColumnHeader('support_team', 'Support Team')}
                {visibleColumns.manager && renderColumnHeader('manager', 'Manager')}
                {visibleColumns.email && renderColumnHeader('email', 'Email')}
                {visibleColumns.primary_ip_address && renderColumnHeader('primary_ip_address', 'Primary IP')}
                {visibleColumns.datacenter && renderColumnHeader('datacenter', 'Datacenter')}
                {visibleColumns.host && renderColumnHeader('host', 'Host')}
                {visibleColumns.power_state && renderColumnHeader('power_state', 'Power State')}
                {visibleColumns.efi_secure_boot && renderColumnHeader('efi_secure_boot', 'Secure Boot', 'secure_boot')}
                {visibleColumns.dns_name && renderColumnHeader('dns_name', 'DNS Name')}
                {visibleColumns.annotation && renderColumnHeader('annotation', 'Annotation')}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={18} className="p-8 text-center text-xs font-mono text-slate-400">
                    Loading server infrastructure inventory...
                  </td>
                </tr>
              ) : servers.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-8 text-center text-slate-400">
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

                      {/* 1. VM Identifier */}
                      {visibleColumns.vm && (
                        <td className="p-3 font-mono font-medium text-white">
                          {server.vm || server.host}
                        </td>
                      )}

                      {/* 2. Env */}
                      {visibleColumns.environment && (
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-mono text-[10px]">
                            {server.environment || '—'}
                          </span>
                        </td>
                      )}

                      {/* 3. Business Unit */}
                      {visibleColumns.business_unit && (
                        <td className="p-3 text-purple-300 font-medium">
                          {server.business_unit || <span className="text-slate-600">—</span>}
                        </td>
                      )}

                      {/* 4. Sub-BU */}
                      {visibleColumns.sub_business_unit && (
                        <td className="p-3 text-slate-300">
                          {server.sub_business_unit || <span className="text-slate-600">—</span>}
                        </td>
                      )}

                      {/* 5. Customer */}
                      {visibleColumns.customer && (
                        <td className="p-3 text-slate-300">
                          {server.customer || '—'}
                        </td>
                      )}

                      {/* 6. Product */}
                      {visibleColumns.product && (
                        <td className="p-3 text-blue-300 font-medium">
                          {server.product || <span className="text-slate-600">—</span>}
                        </td>
                      )}

                      {/* 7. Function */}
                      {visibleColumns.function && (
                        <td className="p-3 text-slate-300">
                          {server.function || '—'}
                        </td>
                      )}

                      {/* 8. Support Team */}
                      {visibleColumns.support_team && (
                        <td className="p-3 text-slate-300 font-mono text-[11px]">
                          {server.support_team || '—'}
                        </td>
                      )}

                      {/* 9. Manager */}
                      {visibleColumns.manager && (
                        <td className="p-3 text-slate-200">
                          {server.manager || <span className="text-amber-400 font-mono text-[11px]">Unassigned</span>}
                        </td>
                      )}

                      {/* 10. Email */}
                      {visibleColumns.email && (
                        <td className="p-3 text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                          {server.email || <span className="text-amber-400">Missing</span>}
                        </td>
                      )}

                      {/* 11. Primary IP */}
                      {visibleColumns.primary_ip_address && (
                        <td className="p-3 font-mono text-cyan-300 font-medium">
                          {server.primary_ip_address || '—'}
                        </td>
                      )}

                      {/* 12. Datacenter */}
                      {visibleColumns.datacenter && (
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {server.datacenter || '—'}
                        </td>
                      )}

                      {/* Optional: Host */}
                      {visibleColumns.host && (
                        <td className="p-3 font-mono text-slate-400 text-[11px] truncate max-w-[160px]">
                          {server.host}
                        </td>
                      )}

                      {/* Optional: Power State */}
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

                      {/* Optional: EFI Secure Boot */}
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

                      {/* Optional: DNS Name */}
                      {visibleColumns.dns_name && (
                        <td className="p-3 font-mono text-slate-400 text-[11px] truncate max-w-[160px]">
                          {server.dns_name || '—'}
                        </td>
                      )}

                      {/* Optional: Annotation */}
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
              className="bg-[#0B1223] border border-slate-700/80 rounded px-2 py-0.5 text-white font-mono text-xs cursor-pointer focus:outline-none focus:border-blue-400"
              style={{ colorScheme: 'dark' }}
            >
              <option value={10} className="bg-[#0B1223] text-white">10</option>
              <option value={25} className="bg-[#0B1223] text-white">25</option>
              <option value={50} className="bg-[#0B1223] text-white">50</option>
              <option value={100} className="bg-[#0B1223] text-white">100</option>
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
