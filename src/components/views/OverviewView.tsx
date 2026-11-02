import React from 'react';
import {
  Server,
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HardDrive,
  Network,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Layers,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import type { DashboardMetrics, AuditLogEvent } from '../../types/index.js';

interface OverviewViewProps {
  metrics: DashboardMetrics | null;
  recentLogs: AuditLogEvent[];
  loading: boolean;
  onNavigate: (view: string, filterParams?: Record<string, string>) => void;
  onSelectServer: (id: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  recentLogs,
  loading,
  onNavigate,
  onSelectServer,
}) => {
  if (loading || !metrics) {
    return (
      <div className="p-8 text-center text-xs font-mono text-slate-400">
        Loading operational intelligence metrics from database...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Operational Posture */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900/40 border border-blue-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-lg font-bold text-white tracking-wide">
              INFRASTRUCTURE INTELLIGENCE DASHBOARD
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              LIVE POSTURE
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Real-time server ownership mapping, business unit correlation, and technical vulnerability posture. Dynamic metrics calculated from database.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('data-management')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => onNavigate('incident-triage')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {/* 5.1 SUMMARY METRICS GRID (12 key operational metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total Servers"
          value={metrics.total_servers}
          icon={Server}
          color="blue"
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          label="Powered On"
          value={metrics.powered_on_servers}
          sub={`${Math.round((metrics.powered_on_servers / (metrics.total_servers || 1)) * 100)}% active`}
          icon={Activity}
          color="green"
          onClick={() => onNavigate('inventory', { power_state: 'poweredOn' })}
        />
        <MetricCard
          label="Powered Off"
          value={metrics.powered_off_servers}
          icon={HardDrive}
          color="slate"
          onClick={() => onNavigate('inventory', { power_state: 'poweredOff' })}
        />
        <MetricCard
          label="Business Units"
          value={metrics.total_business_units}
          icon={Building2}
          color="purple"
          onClick={() => onNavigate('business-units')}
        />
        <MetricCard
          label="Sub-Business Units"
          value={metrics.total_sub_business_units}
          icon={Layers}
          color="indigo"
          onClick={() => onNavigate('business-units')}
        />
        <MetricCard
          label="Datacenters"
          value={metrics.total_datacenters}
          icon={Database}
          color="cyan"
          onClick={() => onNavigate('infrastructure-map')}
        />
        <MetricCard
          label="Support Teams"
          value={metrics.total_support_teams}
          icon={Users}
          color="blue"
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          label="Unique Managers"
          value={metrics.total_unique_managers}
          icon={Users}
          color="purple"
          onClick={() => onNavigate('inventory')}
        />
        <MetricCard
          label="Missing Owner"
          value={metrics.servers_missing_ownership}
          sub="Requires triage"
          icon={AlertTriangle}
          color="amber"
          highlight={metrics.servers_missing_ownership > 0}
          onClick={() => onNavigate('inventory', { ownership: 'missing' })}
        />
        <MetricCard
          label="Missing Email"
          value={metrics.servers_missing_contact}
          sub="No contact"
          icon={AlertTriangle}
          color="amber"
          highlight={metrics.servers_missing_contact > 0}
          onClick={() => onNavigate('inventory', { email: 'missing' })}
        />
        <MetricCard
          label="Secure Boot Off"
          value={metrics.servers_without_secure_boot}
          sub="Vulnerable"
          icon={ShieldAlert}
          color="red"
          highlight={metrics.servers_without_secure_boot > 0}
          onClick={() => onNavigate('inventory', { secure_boot: 'FALSE' })}
        />
        <MetricCard
          label="Incomplete Meta"
          value={metrics.servers_incomplete_metadata}
          sub="Hygiene gap"
          icon={AlertTriangle}
          color="amber"
          onClick={() => onNavigate('reports')}
        />
      </div>

      {/* 5.2 DASHBOARD CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* A. Servers by Business Unit (Horizontal Bar Chart) */}
        <div className="lg:col-span-2 p-5 rounded-xl soc-glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" /> Servers by Business Unit
              </h2>
              <p className="text-xs text-slate-400">Click any business unit to filter the server inventory</p>
            </div>
            <button
              onClick={() => onNavigate('business-units')}
              className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
            >
              <span>Explore All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {metrics.servers_by_business_unit.map(bu => {
              const pct = Math.round((bu.count / (metrics.total_servers || 1)) * 100);
              return (
                <div
                  key={bu.name}
                  onClick={() => onNavigate('inventory', { business_unit: bu.name })}
                  className="group cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200 group-hover:text-purple-300 transition-colors">
                      {bu.name}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-400 text-[11px]">{pct}%</span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px]">
                        {bu.count} servers
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full group-hover:from-purple-400 group-hover:to-indigo-400 transition-all duration-300"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* F. Secure Boot & Power State Posture */}
        <div className="p-5 rounded-xl soc-glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Hardware Security & Power
            </h2>
          </div>

          {/* Secure Boot breakdown */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              EFI Secure Boot Status
            </span>
            <div className="grid grid-cols-3 gap-2">
              {metrics.secure_boot_status.map(item => {
                const isEnabled = item.name === 'Enabled';
                const isDisabled = item.name === 'Disabled';
                return (
                  <div
                    key={item.name}
                    onClick={() => onNavigate('inventory', { secure_boot: isEnabled ? 'TRUE' : isDisabled ? 'FALSE' : 'UNKNOWN' })}
                    className={`p-2.5 rounded-lg border text-center cursor-pointer transition-colors ${
                      isEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15 text-emerald-300'
                        : isDisabled
                        ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15 text-rose-300'
                        : 'bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/15 text-slate-300'
                    }`}
                  >
                    <div className="text-lg font-bold font-mono">{item.count}</div>
                    <div className="text-[10px] uppercase font-mono tracking-wide">{item.name}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ownership Completeness Breakdown */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Ownership Completeness
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-300">Fully Assigned (Owner, Email, BU, Team)</span>
                <span className="font-mono text-emerald-400 font-semibold">{metrics.ownership_completeness.fully_assigned}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Missing Manager</span>
                <span className="font-mono text-amber-400">{metrics.ownership_completeness.missing_manager}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Missing Email</span>
                <span className="font-mono text-amber-400">{metrics.ownership_completeness.missing_email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Missing Business Unit</span>
                <span className="font-mono text-rose-400">{metrics.ownership_completeness.missing_business_unit}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Chart Row: Environments, Datacenters, Support Teams */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Environments */}
        <div className="p-5 rounded-xl soc-glass-panel space-y-3">
          <h3 className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4" /> Environment Distribution
          </h3>
          <div className="space-y-2">
            {metrics.servers_by_environment.map(env => (
              <div
                key={env.name}
                onClick={() => onNavigate('inventory', { environment: env.name })}
                className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5 hover:border-blue-400/30 cursor-pointer text-xs"
              >
                <span className="text-slate-200 font-medium">{env.name}</span>
                <span className="font-mono text-blue-300 font-semibold px-2 py-0.5 rounded bg-blue-500/10">
                  {env.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Datacenters */}
        <div className="p-5 rounded-xl soc-glass-panel space-y-3">
          <h3 className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" /> Datacenter Infrastructure
          </h3>
          <div className="space-y-2">
            {metrics.servers_by_datacenter.map(dc => (
              <div
                key={dc.name}
                onClick={() => onNavigate('inventory', { datacenter: dc.name })}
                className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5 hover:border-cyan-400/30 cursor-pointer text-xs"
              >
                <span className="text-slate-200 font-medium">{dc.name}</span>
                <span className="font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded bg-cyan-500/10">
                  {dc.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Support Teams */}
        <div className="p-5 rounded-xl soc-glass-panel space-y-3">
          <h3 className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" /> Support Team Allocation
          </h3>
          <div className="space-y-2">
            {metrics.servers_by_support_team.map(team => (
              <div
                key={team.name}
                onClick={() => onNavigate('inventory', { support_team: team.name })}
                className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/5 hover:border-indigo-400/30 cursor-pointer text-xs"
              >
                <span className="text-slate-200 font-medium">{team.name} Team</span>
                <span className="font-mono text-indigo-300 font-semibold px-2 py-0.5 rounded bg-indigo-500/10">
                  {team.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5.3 RECENT ACTIVITY & AUDIT STREAM */}
      <div className="p-5 rounded-xl soc-glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Recent Operational Activity & Audit Trail
          </h2>
          <button
            onClick={() => onNavigate('settings')}
            className="text-xs text-blue-400 hover:text-blue-300 font-mono cursor-pointer"
          >
            View Full Audit Log →
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {recentLogs.slice(0, 5).map(log => (
            <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300 border border-white/10">
                  {log.action}
                </span>
                <span className="text-slate-200">{log.details || `Updated ${log.entity_type}`}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span>{log.user}</span>
                <span>•</span>
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: number;
  sub?: string;
  icon: any;
  color: 'blue' | 'green' | 'red' | 'purple' | 'amber' | 'cyan' | 'slate' | 'indigo';
  highlight?: boolean;
  onClick: () => void;
}> = ({ label, value, sub, icon: Icon, color, highlight, onClick }) => {
  const colorMap = {
    blue: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    green: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    red: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    purple: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
    amber: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    cyan: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10',
    slate: 'border-slate-500/30 text-slate-400 bg-slate-500/10',
    indigo: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10',
  };

  return (
    <div
      onClick={onClick}
      className={`p-3.5 rounded-xl soc-glass-panel soc-glass-panel-hover cursor-pointer space-y-2 select-none relative overflow-hidden group ${
        highlight ? 'border-amber-500/40 bg-amber-500/[0.04]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
        <span className={`p-1.5 rounded-md ${colorMap[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div>
        <div className="text-xl font-bold font-mono text-white tracking-tight">
          {value}
        </div>
        {sub && (
          <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};
