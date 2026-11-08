import { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Mail,
  Server,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Network as NetIcon,
  User,
  Clock,
  Cpu,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord, AuditLogEvent } from '../../types/index.js';

interface ServerDetailDrawerProps {
  serverId: string | null;
  onClose: () => void;
  onNavigateServer: (id: string) => void;
  onAddToIncident?: (server: ServerRecord) => void;
}

export const ServerDetailDrawer: React.FC<ServerDetailDrawerProps> = ({
  serverId,
  onClose,
  onNavigateServer,
  onAddToIncident,
}) => {
  const [data, setData] = useState<{
    server: ServerRecord;
    relationships: {
      same_hypervisor_vms: { id: string; vm: string; ip: string; bu: string }[];
      same_network_servers: { id: string; host: string; vm: string; ip: string; bu: string }[];
      same_manager_servers: { id: string; host: string; vm: string; bu: string }[];
    };
    history: AuditLogEvent[];
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ownership' | 'infrastructure' | 'security' | 'relationships' | 'history'>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) {
      setData(null);
      return;
    }

    setLoading(true);
    api.getServer(serverId)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load server details:', err))
      .finally(() => setLoading(false));
  }, [serverId]);

  if (!serverId) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const server = data?.server;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-[#0F172A] border-l border-white/10 h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Server className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono text-white tracking-wide">
                      {server?.host || 'Loading host...'}
                    </h2>
                    {server && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                        {server.vm}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono text-cyan-400">
                      IP: {server?.primary_ip_address || 'Unassigned'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-300">
                      BU: {server?.business_unit || 'Unassigned'}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">
                      Env: {server?.environment || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {server && (
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium ${
                    server.power_state === 'poweredOn'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {server.power_state}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Actions Bar (Section 8.1) */}
          {server && (
            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => copyToClipboard(server.host, 'host')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors font-mono cursor-pointer"
              >
                {copiedField === 'host' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Host
              </button>
              {server.primary_ip_address && (
                <button
                  onClick={() => copyToClipboard(server.primary_ip_address, 'ip')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors font-mono cursor-pointer"
                >
                  {copiedField === 'ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy IP
                </button>
              )}
              {server.dns_name && (
                <button
                  onClick={() => copyToClipboard(server.dns_name, 'dns')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors font-mono cursor-pointer"
                >
                  {copiedField === 'dns' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy DNS
                </button>
              )}
              {server.email && (
                <a
                  href={`mailto:${encodeURIComponent(server.email)}?subject=${encodeURIComponent(`Inquiry regarding server ${server.host}`)}&body=${encodeURIComponent(`Hello ${server.manager},\n\nWe are contacting you regarding ${server.host} (${server.vm}) in ${server.business_unit}.`)}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-300 transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Manager
                </a>
              )}
              {onAddToIncident && (
                <button
                  onClick={() => onAddToIncident(server)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Add to Incident
                </button>
              )}
            </div>
          )}

          {/* Navigation Tabs (Section 8.2) */}
          <div className="flex border-b border-white/10 mt-4 -mb-5 space-x-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'ownership', label: 'Ownership' },
              { id: 'infrastructure', label: 'Infrastructure' },
              { id: 'security', label: 'Security & Health' },
              { id: 'relationships', label: 'Relationships' },
              { id: 'history', label: 'Audit History' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-blue-300 bg-white/[0.04]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="p-8 text-center text-xs font-mono text-slate-400">
              Loading server profile and correlation leads...
            </div>
          )}

          {!loading && server && activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Identity & Basic Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoCard label="Host Identifier" value={server.host} isMono />
                <InfoCard label="VM Identifier" value={server.vm} isMono />
                <InfoCard label="Power State" value={server.power_state} />
                <InfoCard label="Primary IP" value={server.primary_ip_address} isMono isCyan />
                <InfoCard label="DNS Name" value={server.dns_name || 'N/A'} isMono />
                <InfoCard label="Environment" value={server.environment} />
                <InfoCard label="Datacenter" value={server.datacenter} />
                <InfoCard label="Support Team" value={server.support_team} />
                <InfoCard label="Customer" value={server.customer} />
              </div>

              {/* Organisational Assignment */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                <h3 className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Organisational Hierarchy
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">1. Business Unit</span>
                    <span className="text-white font-medium">{server.business_unit || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">2. Sub-Business Unit</span>
                    <span className="text-white font-medium">{server.sub_business_unit || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">4. Product</span>
                    <span className="text-white font-medium">{server.product || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">5. Function</span>
                    <span className="text-white font-medium">{server.function || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">6. Business Environment</span>
                    <span className="text-white font-medium">{server.business_environment || server.environment}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Org Code / Abbr</span>
                    <span className="text-white font-mono">{server.organisation_short_code || 'N/A'} ({server.organisation_abbreviated || 'N/A'})</span>
                  </div>
                </div>
              </div>

              {/* Annotation */}
              {server.annotation && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="font-mono text-amber-400 font-semibold uppercase text-[10px] block mb-1">
                    Annotation / Operational Note:
                  </span>
                  <p className="text-amber-200">{server.annotation}</p>
                </div>
              )}
            </div>
          )}

          {!loading && server && activeTab === 'ownership' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{server.manager || 'No Operational Manager Assigned'}</h4>
                    <p className="text-xs text-slate-400">{server.email || 'No email registered'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Contact Role</span>
                    <span className="text-white font-medium">Business / Operational Owner</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Technical Support Team</span>
                    <span className="text-white font-medium">{server.support_team || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Customer / Account</span>
                    <span className="text-white font-medium">{server.customer || 'Internal'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Responsible Business Unit</span>
                    <span className="text-purple-300 font-medium">{server.business_unit}</span>
                  </div>
                </div>
              </div>

              {/* Associated Manager Servers list */}
              {data?.relationships?.same_manager_servers && data.relationships.same_manager_servers.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Other Systems Under Same Manager ({data.relationships.same_manager_servers.length}):
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {data.relationships.same_manager_servers.map(rel => (
                      <div
                        key={rel.id}
                        onClick={() => onNavigateServer(rel.id)}
                        className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-blue-400/30 hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white">{rel.host}</span>
                          <span className="font-mono text-slate-400 text-[10px]">({rel.vm})</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">{rel.bu}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && server && activeTab === 'infrastructure' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <h4 className="font-mono text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4" /> Compute & Virtualization
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">ESXi Hypervisor Host</span>
                    <span className="font-mono text-white">{server.host}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">VM Guest Identifier</span>
                    <span className="font-mono text-white">{server.vm}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Physical Datacenter</span>
                    <span className="text-white font-medium">{server.datacenter || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Target Environment</span>
                    <span className="text-white font-medium">{server.environment}</span>
                  </div>
                </div>
              </div>

              {/* Connected Networks */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <h4 className="font-mono text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <NetIcon className="w-4 h-4" /> Network Interfaces & VLANs
                </h4>
                <div className="space-y-2">
                  {[
                    { label: 'Network Interface #1', val: server.network_1 },
                    { label: 'Network Interface #2', val: server.network_2 },
                    { label: 'Network Interface #3', val: server.network_3 },
                  ].map(net => (
                    <div key={net.label} className="flex items-center justify-between p-2 rounded bg-white/[0.03] border border-white/5 font-mono">
                      <span className="text-slate-400 text-[11px]">{net.label}:</span>
                      <span className={net.val ? 'text-cyan-300 font-medium' : 'text-slate-600'}>
                        {net.val || 'Not Connected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && server && activeTab === 'security' && (
            <div className="space-y-4">
              {/* Secure Boot Status */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    EFI Secure Boot
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hardware root of trust & kernel integrity verification.
                  </p>
                </div>
                <div>
                  {server.efi_secure_boot === true ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-medium">
                      <ShieldCheck className="w-4 h-4" /> Enabled (Compliant)
                    </span>
                  ) : server.efi_secure_boot === false ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-xs font-mono font-medium">
                      <ShieldAlert className="w-4 h-4" /> Disabled (Action Required)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-500/15 text-slate-400 border border-slate-500/30 text-xs font-mono">
                      Unknown / Not Reported
                    </span>
                  )}
                </div>
              </div>

              {/* Ownership Hygiene Check */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3 text-xs">
                <h4 className="font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Asset Metadata Completeness Checklist
                </h4>
                <div className="space-y-1.5">
                  <CheckRow label="Assigned Manager" ok={!!server.manager} val={server.manager} />
                  <CheckRow label="Contact Email Address" ok={!!server.email} val={server.email} />
                  <CheckRow label="Business Unit Mapping" ok={!!server.business_unit} val={server.business_unit} />
                  <CheckRow label="Product & Function Defined" ok={!!server.product && !!server.function} val={`${server.product || 'Missing'} / ${server.function || 'Missing'}`} />
                  <CheckRow label="Primary IP Address Configured" ok={!!server.primary_ip_address} val={server.primary_ip_address} />
                  <CheckRow label="Datacenter Location Tagged" ok={!!server.datacenter} val={server.datacenter} />
                </div>
              </div>
            </div>
          )}

          {!loading && server && activeTab === 'relationships' && (
            <div className="space-y-5 text-xs">
              {/* Same Hypervisor VMs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" /> Co-Hosted VMs on {server.host} ({data?.relationships?.same_hypervisor_vms?.length || 0})
                  </h4>
                  <span className="text-[10px] text-amber-400 font-mono">Shared Hypervisor</span>
                </div>
                {(!data?.relationships?.same_hypervisor_vms || data.relationships.same_hypervisor_vms.length === 0) ? (
                  <p className="text-slate-500 italic p-2">No other VMs on this hypervisor in inventory.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.relationships.same_hypervisor_vms.map(v => (
                      <div
                        key={v.id}
                        onClick={() => onNavigateServer(v.id)}
                        className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-blue-400/30 hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-medium">{v.vm}</span>
                          <span className="text-cyan-400 text-[11px]">{v.ip}</span>
                        </div>
                        <span className="text-purple-300 text-[11px]">{v.bu}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Same Network Servers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <NetIcon className="w-4 h-4 text-cyan-400" /> Connected Network Neighbors ({data?.relationships?.same_network_servers?.length || 0})
                  </h4>
                  <span className="text-[10px] text-cyan-400 font-mono">Shared VLAN / Segment</span>
                </div>
                {(!data?.relationships?.same_network_servers || data.relationships.same_network_servers.length === 0) ? (
                  <p className="text-slate-500 italic p-2">No other servers sharing these networks in inventory.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {data.relationships.same_network_servers.map(n => (
                      <div
                        key={n.id}
                        onClick={() => onNavigateServer(n.id)}
                        className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-cyan-400/30 hover:bg-white/[0.05] transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-white font-medium">{n.host}</span>
                          <span className="text-slate-400 text-[10px]">({n.vm})</span>
                          <span className="text-cyan-400 text-[11px]">{n.ip}</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">{n.bu}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && server && activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-mono text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" /> Audit Trail & Changes
              </h4>
              {(!data?.history || data.history.length === 0) ? (
                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-500 italic">
                  No historical mutations recorded yet for this asset.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.history.map(item => (
                    <div key={item.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-400 font-medium">{item.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-300">{item.details || 'Attribute updated'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">By: {item.user}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ label: string; value?: string | null; isMono?: boolean; isCyan?: boolean }> = ({
  label,
  value,
  isMono,
  isCyan,
}) => (
  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-0.5">
    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
      {label}
    </span>
    <span
      className={`text-xs truncate block ${isMono ? 'font-mono' : 'font-medium'} ${
        isCyan ? 'text-cyan-400' : 'text-slate-200'
      }`}
    >
      {value || '—'}
    </span>
  </div>
);

const CheckRow: React.FC<{ label: string; ok: boolean; val?: string }> = ({ label, ok, val }) => (
  <div className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5">
    <div className="flex items-center gap-2">
      {ok ? (
        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      )}
      <span className="text-slate-300">{label}</span>
    </div>
    <span className={`text-[11px] font-mono ${ok ? 'text-emerald-300' : 'text-amber-400'}`}>
      {val || (ok ? 'Configured' : 'Missing')}
    </span>
  </div>
);
