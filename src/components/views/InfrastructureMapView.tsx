import React, { useState, useEffect } from 'react';
import {
  Network as NetIcon,
  Server,
  Database,
  Cpu,
  Layers,
  Building2,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface InfrastructureMapViewProps {
  onSelectServer: (id: string) => void;
  onFilterInventory: (filters: Record<string, string>) => void;
}

export const InfrastructureMapView: React.FC<InfrastructureMapViewProps> = ({
  onSelectServer,
  onFilterInventory,
}) => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'datacenter' | 'hypervisor' | 'network' | 'business_unit'>('hypervisor');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getServers({ limit: 500 });
      setServers(res.items);
    } catch (err) {
      console.error('Failed to load servers for infra map:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group by Hypervisor Host
  const hypervisorMap = new Map<string, ServerRecord[]>();
  servers.forEach(s => {
    const host = s.host || 'Unknown Hypervisor';
    if (!hypervisorMap.has(host)) hypervisorMap.set(host, []);
    hypervisorMap.get(host)!.push(s);
  });

  // Group by Datacenter
  const datacenterMap = new Map<string, Map<string, ServerRecord[]>>();
  servers.forEach(s => {
    const dc = s.datacenter || 'UK1-SSE-DC1';
    const host = s.host || 'Unknown Host';
    if (!datacenterMap.has(dc)) datacenterMap.set(dc, new Map());
    const dcHosts = datacenterMap.get(dc)!;
    if (!dcHosts.has(host)) dcHosts.set(host, []);
    dcHosts.get(host)!.push(s);
  });

  // Group by Network
  const networkMap = new Map<string, ServerRecord[]>();
  servers.forEach(s => {
    [s.network_1, s.network_2, s.network_3].filter(Boolean).forEach(net => {
      if (!networkMap.has(net)) networkMap.set(net, []);
      if (!networkMap.get(net)!.some(existing => existing.id === s.id)) {
        networkMap.get(net)!.push(s);
      }
    });
  });

  // Group by Business Unit
  const buMap = new Map<string, ServerRecord[]>();
  servers.forEach(s => {
    const bu = s.business_unit || 'Unassigned';
    if (!buMap.has(bu)) buMap.set(bu, []);
    buMap.get(bu)!.push(s);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <NetIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              INFRASTRUCTURE TOPOLOGY MAP
            </h1>
            <p className="text-xs text-slate-400">
              Technical mapping of physical datacenters, ESXi hypervisors, hosted VMs, and shared network segments.
            </p>
          </div>
        </div>

        {/* 11. View Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
          {[
            { id: 'hypervisor', label: 'Hypervisors' },
            { id: 'datacenter', label: 'Datacenters' },
            { id: 'network', label: 'Networks & VLANs' },
            { id: 'business_unit', label: 'BU Infrastructure' },
          ].map(view => (
            <button
              key={view.id}
              onClick={() => setActiveTab(view.id as any)}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === view.id
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400">
          Mapping infrastructure relationships...
        </div>
      ) : (
        <>
          {/* VIEW 1: HYPERVISOR VIEW */}
          {activeTab === 'hypervisor' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                <span>{hypervisorMap.size} Physical Hypervisors Hosting {servers.length} Virtual Machines</span>
                <span className="text-amber-400">★ Co-hosting highlighted for multi-tenant risk review</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from(hypervisorMap.entries()).map(([host, vms]) => {
                  const isMultiVm = vms.length > 1;
                  const distinctBUs = Array.from(new Set(vms.map(v => v.business_unit).filter(Boolean)));
                  const isCrossTenant = distinctBUs.length > 1;

                  return (
                    <div
                      key={host}
                      className={`p-5 rounded-xl soc-glass-panel border space-y-4 ${
                        isCrossTenant
                          ? 'border-amber-500/30 bg-amber-950/[0.04]'
                          : 'border-white/10'
                      }`}
                    >
                      {/* Hypervisor Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-blue-400" />
                            <span className="font-mono text-sm font-bold text-white">{host}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                            <span>DC: {vms[0]?.datacenter || 'UK1-SSE-DC1'}</span>
                            <span>•</span>
                            <span>{vms.length} Hosted VM(s)</span>
                          </div>
                        </div>

                        {isCrossTenant && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Shared across {distinctBUs.length} BUs
                          </span>
                        )}
                      </div>

                      {/* Hosted VMs List (Tree representation) */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                          Virtual Machines on this Host:
                        </span>
                        <div className="space-y-1.5">
                          {vms.map(vm => (
                            <div
                              key={vm.id}
                              onClick={() => onSelectServer(vm.id)}
                              className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-blue-400/30 hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <Server className="w-3.5 h-3.5 text-slate-400" />
                                <div>
                                  <div className="flex items-center gap-2 font-mono">
                                    <span className="text-white font-medium">{vm.vm}</span>
                                    <span className="text-cyan-400 text-[11px]">{vm.primary_ip_address}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400">{vm.function || vm.product}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-purple-300 font-medium text-[11px]">{vm.business_unit}</span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                    vm.power_state === 'poweredOn'
                                      ? 'text-emerald-400 bg-emerald-500/10'
                                      : 'text-rose-400 bg-rose-500/10'
                                  }`}
                                >
                                  {vm.power_state}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: DATACENTER VIEW */}
          {activeTab === 'datacenter' && (
            <div className="space-y-6">
              {Array.from(datacenterMap.entries()).map(([dcName, hosts]) => (
                <div key={dcName} className="p-5 rounded-xl soc-glass-panel border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-5 h-5 text-cyan-400" />
                      <div>
                        <h2 className="text-base font-bold text-white font-mono">{dcName}</h2>
                        <p className="text-xs text-slate-400">
                          {hosts.size} Hypervisor Clusters • {Array.from(hosts.values()).flat().length} Provisioned Nodes
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from(hosts.entries()).map(([host, vms]) => (
                      <div key={host} className="p-3.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-white">{host}</span>
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                            {vms.length} VMs
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                          {vms.map(v => (
                            <div
                              key={v.id}
                              onClick={() => onSelectServer(v.id)}
                              className="hover:text-blue-300 cursor-pointer flex justify-between"
                            >
                              <span>{v.vm}</span>
                              <span className="text-slate-500">{v.primary_ip_address}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW 3: NETWORK & VLAN VIEW */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-slate-400">
                {networkMap.size} Distinct Network Segments / VLAN Interfaces
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(networkMap.entries()).map(([netName, vms]) => {
                  const bus = Array.from(new Set(vms.map(v => v.business_unit).filter(Boolean)));
                  const isSharedNet = vms.length > 1;

                  return (
                    <div
                      key={netName}
                      className={`p-4 rounded-xl soc-glass-panel border space-y-3 ${
                        isSharedNet ? 'border-cyan-500/30' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                            <h3 className="font-mono text-xs font-bold text-white">{netName}</h3>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                            {vms.length} Attached Systems
                          </span>
                        </div>

                        {bus.length > 1 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                            {bus.length} BUs
                          </span>
                        )}
                      </div>

                      {/* Connected systems */}
                      <div className="space-y-1.5 pt-2 border-t border-white/5 max-h-40 overflow-y-auto font-mono text-xs">
                        {vms.map(v => (
                          <div
                            key={v.id}
                            onClick={() => onSelectServer(v.id)}
                            className="p-1.5 rounded bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer flex justify-between items-center"
                          >
                            <span className="text-slate-200">{v.vm}</span>
                            <span className="text-cyan-400 text-[10px]">{v.primary_ip_address}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: BU INFRASTRUCTURE VIEW */}
          {activeTab === 'business_unit' && (
            <div className="space-y-4">
              {Array.from(buMap.entries()).map(([buName, vms]) => (
                <div key={buName} className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white">{buName}</h3>
                    </div>
                    <button
                      onClick={() => onFilterInventory({ business_unit: buName })}
                      className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                    >
                      Filter Table ({vms.length}) →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                    {vms.map(v => (
                      <div
                        key={v.id}
                        onClick={() => onSelectServer(v.id)}
                        className="p-2 rounded bg-white/[0.02] border border-white/5 hover:border-purple-400/30 cursor-pointer"
                      >
                        <div className="text-white font-medium">{v.host}</div>
                        <div className="text-slate-400 text-[10px]">{v.vm} • {v.primary_ip_address}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
