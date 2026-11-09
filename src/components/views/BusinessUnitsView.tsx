import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Layers,
  Database,
  Network,
  ArrowRight,
  ArrowLeft,
  Search,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface BusinessUnitsViewProps {
  onSelectServer: (id: string) => void;
  onFilterInventory: (filters: Record<string, string>) => void;
}

export const BusinessUnitsView: React.FC<BusinessUnitsViewProps> = ({
  onSelectServer,
  onFilterInventory,
}) => {
  const [buList, setBuList] = useState<any[]>([]);
  const [selectedBuName, setSelectedBuName] = useState<string | null>(null);
  const [selectedBuDetail, setSelectedBuDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Sub-filter inside detail view
  const [detailFilter, setDetailFilter] = useState('');

  useEffect(() => {
    loadBusinessUnits();
  }, []);

  const loadBusinessUnits = async () => {
    setLoading(true);
    try {
      const data = await api.getBusinessUnits();
      setBuList(data);
    } catch (err) {
      console.error('Failed to load business units:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBu = async (name: string) => {
    setSelectedBuName(name);
    setLoading(true);
    try {
      const detail = await api.getBusinessUnitDetail(name);
      setSelectedBuDetail(detail);
    } catch (err) {
      console.error('Failed to load business unit details:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBUs = buList.filter(
    b =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.organisation_short_code.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 9.1 BUSINESS UNIT OVERVIEW */}
      {!selectedBuName ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-xl font-extrabold text-white tracking-tight font-sans">
                  Business Unit Infrastructure Explorer
                </h1>
                <p className="text-xs text-slate-400">
                  Select a business unit to analyze ownership hierarchies, sub-units, and dedicated infrastructure.
                </p>
              </div>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search business units or codes..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full p-8 text-center text-xs font-mono text-slate-400">
                Loading business unit ownership directories...
              </div>
            ) : filteredBUs.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-400">
                No business units match your query.
              </div>
            ) : (
              filteredBUs.map(bu => (
                <div
                  key={bu.name}
                  onClick={() => handleSelectBu(bu.name)}
                  className="p-5 rounded-xl soc-glass-panel soc-glass-panel-hover cursor-pointer border border-white/10 space-y-4 group relative"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                        {bu.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {bu.organisation_short_code && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {bu.organisation_short_code}
                          </span>
                        )}
                        {bu.customer && (
                          <span className="text-[11px] text-slate-400">
                            Cust: {bu.customer}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-all text-slate-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5 text-center text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Servers</span>
                      <span className="text-sm font-bold font-mono text-white">{bu.total_servers}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Sub-BUs</span>
                      <span className="text-sm font-bold font-mono text-indigo-300">{bu.sub_business_units_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Managers</span>
                      <span className="text-sm font-bold font-mono text-amber-300">{bu.managers_count}</span>
                    </div>
                  </div>

                  {/* Managers preview */}
                  <div className="text-xs space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                      Lead Managers:
                    </span>
                    <p className="text-slate-300 truncate">
                      {bu.managers.join(', ') || 'None assigned'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 9.2 BUSINESS UNIT DETAIL VIEW */
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-4 rounded-xl soc-glass-panel">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedBuName(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                title="Back to all business units"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-white tracking-wide">
                    {selectedBuDetail?.name}
                  </h1>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Business Unit Detail
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedBuDetail?.total_servers} Total Assets • {selectedBuDetail?.powered_on_servers} Powered On
                </p>
              </div>
            </div>

            <button
              onClick={() => onFilterInventory({ business_unit: selectedBuDetail?.name })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 text-xs font-medium cursor-pointer"
            >
              <span>View in Inventory Table</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 9.3 CORRELATION BREAKDOWN (Sub-BUs, Products, Functions, Managers, Networks, Datacenters) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Managers Card */}
            <div className="p-4 rounded-xl soc-glass-panel space-y-3">
              <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Designated Managers ({selectedBuDetail?.managers?.length || 0})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedBuDetail?.managers?.map((m: any) => (
                  <div
                    key={m.name}
                    onClick={() => onFilterInventory({ manager: m.name })}
                    className="p-2 rounded bg-white/[0.03] border border-white/5 hover:border-amber-400/40 cursor-pointer transition-colors text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-white">{m.name}</span>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded">
                        {m.server_count} svr
                      </span>
                    </div>
                    {m.email && <div className="text-[11px] text-slate-400 font-mono truncate">{m.email}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-BUs & Products */}
            <div className="p-4 rounded-xl soc-glass-panel space-y-3">
              <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Sub-Units & Products
              </span>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Sub-Business Units:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedBuDetail?.sub_business_units?.map((sub: string) => (
                      <span key={sub} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px]">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Products:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedBuDetail?.products?.map((prod: string) => (
                      <span key={prod} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px]">
                        {prod}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Datacenters & Functions */}
            <div className="p-4 rounded-xl soc-glass-panel space-y-3">
              <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Datacenters & Roles
              </span>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Hosting Datacenters:</span>
                  <div className="flex flex-wrap gap-1 mt-1 font-mono text-[11px]">
                    {selectedBuDetail?.datacenters?.map((dc: string) => (
                      <span key={dc} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {dc}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Workload Functions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedBuDetail?.functions?.map((fn: string) => (
                      <span key={fn} className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[11px]">
                        {fn}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Networks */}
            <div className="p-4 rounded-xl soc-glass-panel space-y-3">
              <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5" /> Attached Networks ({selectedBuDetail?.networks?.length || 0})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedBuDetail?.networks?.map((net: string) => (
                  <div
                    key={net}
                    onClick={() => onFilterInventory({ network: net })}
                    className="p-1.5 rounded bg-white/[0.03] border border-white/5 hover:border-emerald-400/40 text-[11px] font-mono text-emerald-300 truncate cursor-pointer"
                  >
                    {net}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All Servers in this BU */}
          <div className="rounded-xl soc-glass-panel overflow-hidden border border-white/10 space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
                Servers Allocated to {selectedBuDetail?.name} ({selectedBuDetail?.servers?.length || 0})
              </h3>
              <input
                type="text"
                value={detailFilter}
                onChange={e => setDetailFilter(e.target.value)}
                placeholder="Search within this BU..."
                className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono text-slate-400 uppercase">
                    <th className="p-2.5">Host</th>
                    <th className="p-2.5">VM</th>
                    <th className="p-2.5">Manager</th>
                    <th className="p-2.5">IP Address</th>
                    <th className="p-2.5">Datacenter</th>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">Function</th>
                    <th className="p-2.5">Power</th>
                    <th className="p-2.5">Secure Boot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {selectedBuDetail?.servers
                    ?.filter((s: ServerRecord) => {
                      if (!detailFilter) return true;
                      const q = detailFilter.toLowerCase();
                      return (
                        s.host.toLowerCase().includes(q) ||
                        s.vm.toLowerCase().includes(q) ||
                        s.manager.toLowerCase().includes(q) ||
                        s.primary_ip_address.toLowerCase().includes(q) ||
                        s.product.toLowerCase().includes(q) ||
                        s.function.toLowerCase().includes(q)
                      );
                    })
                    .map((server: ServerRecord) => (
                      <tr
                        key={server.id}
                        onClick={() => onSelectServer(server.id)}
                        className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                      >
                        <td className="p-2.5 text-white font-medium">{server.host}</td>
                        <td className="p-2.5 text-slate-300">{server.vm}</td>
                        <td className="p-2.5 text-amber-300 font-sans">{server.manager}</td>
                        <td className="p-2.5 text-cyan-300">{server.primary_ip_address}</td>
                        <td className="p-2.5 text-slate-400">{server.datacenter}</td>
                        <td className="p-2.5 text-slate-300 font-sans">{server.product}</td>
                        <td className="p-2.5 text-slate-300 font-sans">{server.function}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] ${
                              server.power_state === 'poweredOn'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {server.power_state}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {server.efi_secure_boot === true ? (
                            <span className="text-emerald-400">TRUE</span>
                          ) : server.efi_secure_boot === false ? (
                            <span className="text-rose-400">FALSE</span>
                          ) : (
                            <span className="text-slate-500">UNK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
