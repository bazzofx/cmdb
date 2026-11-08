import React, { useState } from 'react';
import {
  Search,
  TriangleAlert,
  Layers,
  LogOut,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import type { AuthUser } from '../../types/index.js';
import { ThemeSwitcher } from './ThemeSwitcher.js';

interface NavbarProps {
  onOpenSearch: () => void;
  onNavigate: (view: string, filterParams?: Record<string, string>) => void;
  serverCount: number;
  openIncidentsCount: number;
  user: AuthUser;
  onLogout: () => void;
  onChangePassword: () => void;
  canAccessIncidents: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onNavigate,
  serverCount,
  openIncidentsCount,
  user,
  onLogout,
  onChangePassword,
  canAccessIncidents,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || user.email[0]?.toUpperCase() || '?';
  return (
    <header className="h-16 border-b border-white/[0.08] bg-[var(--app-bg)]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Brand: SOC CMDB */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('overview')}
          aria-label="SOC CMDB — return to Infrastructure Overview"
          className="flex items-center gap-2.5 cursor-pointer group text-left transition-opacity hover:opacity-90"
          title="SOC CMDB — return to Infrastructure Overview"
        >
          <span className="relative h-10 w-10 shrink-0 overflow-hidden">
            <img
              src="/assets/logo.png"
              alt=""
              aria-hidden="true"
              className="absolute left-1/2 top-0 h-[165%] w-[165%] max-w-none -translate-x-1/2 object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.35)] transition-transform duration-300 group-hover:scale-105"
            />
          </span>
          <span className="hidden sm:inline font-extrabold text-base tracking-wider text-white uppercase font-sans">
            SOC <span className="text-cyan-400">CMDB</span>
          </span>
        </button>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-xl mx-4 sm:mx-8">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-[var(--surface-1)]/80 border border-slate-700/50 hover:border-blue-500/50 hover:bg-[var(--surface-2)]/80 transition-all text-xs text-slate-400 group cursor-pointer shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
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

      {/* Right Controls: Palette, Assets Pill, Incidents Pill, User Avatar */}
      <div className="flex items-center gap-3">
        <ThemeSwitcher />

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
        {canAccessIncidents && (
          <button
            onClick={() => onNavigate('incident-triage')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer text-xs font-medium"
            title="Active incidents requiring triage"
          >
            <TriangleAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>{openIncidentsCount} Incident{openIncidentsCount === 1 ? '' : 's'}</span>
          </button>
        )}

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(open => !open)}
            className="flex items-center gap-1.5 cursor-pointer group"
            title={`Signed in as ${user.name} (${user.role})`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 group-hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-400/30 transition-transform active:scale-95">
              {initials}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-60 z-50 rounded-xl border border-white/10 bg-[var(--surface-2)] shadow-2xl p-2">
                <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                  <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
                  <span className="inline-block mt-1 text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); onChangePassword(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-slate-300 hover:bg-white/5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Change password
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
