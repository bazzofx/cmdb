import React from 'react';
import {
  Search,
  TriangleAlert,
  Layers,
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
    <header className="h-16 border-b border-white/[0.08] bg-[#070B14]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand: Geometric Gradient N + NEXUSINFRA */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onNavigate('overview')}
          className="flex items-center gap-2.5 cursor-pointer group text-left transition-opacity hover:opacity-90"
          title="Return to Infrastructure Overview"
        >
          {/* Geometric Ribbon N Icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M9 28V8L20 22V8"
                stroke="url(#nexus-grad-1)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 28L27 14V28"
                stroke="url(#nexus-grad-2)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="nexus-grad-1" x1="9" y1="8" x2="20" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38BDF8" />
                  <stop offset="0.5" stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#6366F1" />
                </linearGradient>
                <linearGradient id="nexus-grad-2" x1="17" y1="14" x2="27" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#60A5FA" />
                  <stop offset="1" stopColor="#818CF8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="font-extrabold text-base tracking-wider text-white uppercase font-sans">
            NEXUS<span className="text-blue-400">INFRA</span>
          </span>
        </button>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl mx-4 sm:mx-8">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-[#0E1528]/80 border border-slate-700/50 hover:border-blue-500/50 hover:bg-[#121B33]/80 transition-all text-xs text-slate-400 group cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="truncate text-slate-300 text-xs">Search servers, owners, business units...</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 shrink-0">
            <span>Ctrl + K</span>
          </div>
        </button>
      </div>

      {/* Right Controls: Assets Pill, Incidents Pill, User Avatar */}
      <div className="flex items-center gap-3">
        {/* Assets Pill */}
        <button
          onClick={() => onNavigate('inventory')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-700/50 hover:border-blue-500/40 hover:bg-slate-800/80 transition-all cursor-pointer text-xs font-medium text-slate-200"
          title="Click to view all servers"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>{serverCount} Assets</span>
        </button>

        {/* Incidents Pill */}
        <button
          onClick={() => onNavigate('incident-triage')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer text-xs font-medium"
          title="Active incidents requiring triage"
        >
          <TriangleAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>{openIncidentsCount} Incident{openIncidentsCount === 1 ? '' : 's'}</span>
        </button>

        {/* User Avatar PB */}
        <div 
          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 border border-blue-400/30 transition-transform active:scale-95"
          title="Signed in as Primary SecOps Admin"
        >
          PB
        </div>
      </div>
    </header>
  );
};
