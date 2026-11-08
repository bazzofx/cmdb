import React, { useState } from 'react';
import {
  Home,
  Server,
  Building2,
  Package,
  TriangleAlert,
  BarChart3,
  Settings,
  Database,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Network,
  FolderArchive,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  role: 'viewer' | 'analyst' | 'manager' | 'admin';
  metrics?: {
    serverCount: number;
    buCount: number;
    productCount?: number;
    incidentCount: number;
    archivedIncidentCount?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  role,
  metrics,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Nov 2, 2026 - 22:17');

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastUpdated(`Nov 2, 2026 - ${timeStr}`);
      setIsRefreshing(false);
    }, 600);
  };

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Home,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Server,
      badge: metrics?.serverCount ? String(metrics.serverCount) : null,
    },
    {
      id: 'business-units',
      label: 'Business Units',
      icon: Building2,
      badge: metrics?.buCount ? String(metrics.buCount) : null,
    },
    {
      id: 'products',
      label: 'Products',
      icon: Package,
      badge: metrics?.productCount ? String(metrics.productCount) : null,
    },
    {
      id: 'ownership-explorer',
      label: 'Ownership Graph',
      icon: Network,
    },
    {
      id: 'infrastructure-map',
      label: 'Infrastructure Map',
      icon: Network,
    },
    {
      id: 'incident-triage',
      label: 'Incidents',
      icon: TriangleAlert,
      badge: metrics?.incidentCount ? String(metrics.incidentCount) : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
    },
    {
      id: 'data-management',
      label: 'Data Sync',
      icon: Database,
    },
    {
      id: 'archived-incidents',
      label: 'Archive Incident',
      icon: FolderArchive,
      badge: metrics?.archivedIncidentCount ? String(metrics.archivedIncidentCount) : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const canSeeIncidents = role === 'analyst' || role === 'manager' || role === 'admin';
  const visibleNavItems = navItems.filter(item => {
    if (item.id === 'incident-triage' || item.id === 'archived-incidents') return canSeeIncidents;
    if (item.id === 'data-management') return role === 'manager' || role === 'admin';
    if (item.id === 'settings') return role === 'manager' || role === 'admin';
    return true;
  });

  return (
    <aside
      className={`h-[calc(100vh-4rem)] bg-[#070B14] border-r border-white/[0.06] flex flex-col justify-between transition-all duration-300 select-none z-20 relative overflow-hidden ${
        collapsed ? 'w-18' : 'w-60'
      }`}
    >
      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 z-10 scrollbar-none">
        {visibleNavItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/35 via-blue-600/20 to-blue-500/10 text-white border border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between truncate text-left">
                  <span className={`truncate ${isActive ? 'font-semibold text-white' : ''}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                        item.badgeColor || 'bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Atmospheric Silhouette Artwork & Status Card */}
      <div className="p-3 z-10 space-y-3">
        {/* Silhouette Vector Artwork */}
        {!collapsed && (
          <div className="w-full h-24 rounded-xl relative overflow-hidden flex items-end justify-center bg-gradient-to-t from-[#0b1329] via-[#091024] to-transparent border border-blue-500/10 shadow-inner">
            {/* Stars & Crescent Glow */}
            <div className="absolute top-2 right-4 w-6 h-6 rounded-full bg-cyan-400/20 blur-sm pointer-events-none" />
            <div className="absolute top-3 right-5 w-4 h-4 rounded-full border-t border-l border-cyan-200 opacity-70 pointer-events-none" />
            <div className="absolute top-4 left-6 w-1 h-1 bg-white/60 rounded-full" />
            <div className="absolute top-8 left-12 w-0.5 h-0.5 bg-blue-300/60 rounded-full" />
            <div className="absolute top-3 left-24 w-1 h-1 bg-indigo-300/70 rounded-full" />

            {/* Crag & Samurai silhouette SVG */}
            <svg
              viewBox="0 0 200 80"
              className="w-full h-full object-cover opacity-85 pointer-events-none"
              preserveAspectRatio="xMidYMax meet"
            >
              <defs>
                <linearGradient id="rock-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#070b14" />
                </linearGradient>
              </defs>
              {/* Distant crags */}
              <polygon points="0,80 30,55 70,68 110,50 160,70 200,55 200,80" fill="#0f172a" />
              {/* Forefront rocky bluff */}
              <polygon points="0,80 20,45 55,42 90,62 140,80" fill="url(#rock-grad)" />
              {/* Silhouette warrior standing with sword */}
              <g transform="translate(36, 18) scale(0.65)">
                {/* Head / helmet with horns */}
                <circle cx="15" cy="10" r="4.5" fill="#070b14" />
                <path d="M11 7 L9 2 L13 6" stroke="#070b14" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M19 7 L21 2 L17 6" stroke="#070b14" strokeWidth="1.5" strokeLinecap="round" />
                {/* Torso / Armor */}
                <path d="M9 14 L21 14 L18 27 L12 27 Z" fill="#070b14" />
                {/* Cape / Robe flowing */}
                <path d="M9 15 Q4 22 2 35 Q10 32 15 30 Z" fill="#070b14" />
                {/* Legs */}
                <path d="M12 27 L10 40 M18 27 L20 40" stroke="#070b14" strokeWidth="3" strokeLinecap="round" />
                {/* Sword / Katana */}
                <line x1="6" y1="18" x2="2" y2="38" stroke="#070b14" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </svg>
          </div>
        )}

        {/* System Status Card */}
        <div className="p-3 rounded-xl bg-[#0B1325]/90 border border-slate-700/50 shadow-lg text-left">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="text-xs font-semibold text-slate-100 truncate">
              All Systems Online
            </span>
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="space-y-0.5">
                <span className="block text-slate-500 text-[9px] uppercase tracking-wider">Status checked</span>
                <span className="text-slate-300 truncate">{lastUpdated}</span>
              </div>
              <button
                onClick={handleRefresh}
                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh system status"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
