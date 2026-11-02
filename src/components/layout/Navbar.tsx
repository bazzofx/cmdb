import React from 'react';
import {
  Search,
  ShieldAlert,
  Server,
} from 'lucide-react';

interface NavbarProps {
  onOpenSearch: () => void;
  onNavigate: (view: string, filterParams?: Record<string, string>) => void;
  serverCount: number;
  openIncidentsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onNavigate,
  serverCount,
  openIncidentsCount,
}) => {
  return (
    <header className="h-14 border-b border-white/10 bg-[#0B1020]/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand / Title */}
      <div className="flex items-center gap-3">
        <div 
          onClick={() => onNavigate('overview')}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="Return to SOC Overview"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30 group-hover:scale-105 transition-transform">
            <Server className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white uppercase">Nexus<span className="text-blue-400">Infra</span></span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">SOC Core</span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">Server Ownership & Business Intelligence</p>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-lg mx-2 sm:mx-4">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-blue-400/50 hover:bg-white/[0.07] transition-all text-xs text-slate-400 group cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="truncate">Search Host, VM, IP, Manager, BU, Network...</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-white/10 px-1.5 py-0.5 rounded border border-white/10 shrink-0">
            <span>⌘K</span>
            <span className="text-slate-500">or</span>
            <span>/</span>
          </div>
        </button>
      </div>

      {/* Right Controls: Telemetry & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Servers Pill */}
        <div 
          onClick={() => onNavigate('inventory')}
          className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
          title="Click to view all servers"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-mono text-slate-300 font-medium">{serverCount}</span>
          <span className="text-[11px] text-slate-400">Assets</span>
        </div>

        {/* Incident Alert Pill */}
        {openIncidentsCount > 0 && (
          <div 
            onClick={() => onNavigate('incident-triage')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer font-mono text-xs font-medium"
            title="Active Incidents Requiring Triage"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">{openIncidentsCount} Incidents</span>
            <span className="sm:hidden">{openIncidentsCount}</span>
          </div>
        )}

        {/* User Identity / Role */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[11px] font-mono text-blue-300 font-semibold">
            SO
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-medium text-slate-200 leading-tight">SecOps Lead</div>
            <div className="text-[10px] text-slate-400 font-mono">Infra & IR</div>
          </div>
        </div>
      </div>
    </header>
  );
};
