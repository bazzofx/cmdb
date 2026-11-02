import React from 'react';
import {
  LayoutDashboard,
  Server,
  Building2,
  Package,
  GitFork,
  Network as NetworkIcon,
  ShieldAlert,
  Mail,
  FileBarChart2,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  metrics?: {
    serverCount: number;
    buCount: number;
    productCount?: number;
    incidentCount: number;
    campaignCount?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  metrics,
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
      section: 'CORE',
    },
    {
      id: 'inventory',
      label: 'Server Inventory',
      icon: Server,
      badge: metrics?.serverCount ? String(metrics.serverCount) : null,
      section: 'CORE',
    },
    {
      id: 'business-units',
      label: 'Business Units',
      icon: Building2,
      badge: metrics?.buCount ? String(metrics.buCount) : null,
      section: 'ORGANISATION',
    },
    {
      id: 'products',
      label: '4_Product',
      icon: Package,
      badge: metrics?.productCount ? String(metrics.productCount) : null,
      section: 'ORGANISATION',
    },
    {
      id: 'ownership-explorer',
      label: 'Ownership Explorer',
      icon: GitFork,
      badge: 'Graph',
      section: 'ORGANISATION',
    },
    {
      id: 'infrastructure-map',
      label: 'Infrastructure Map',
      icon: NetworkIcon,
      badge: null,
      section: 'TOPOLOGY',
    },
    {
      id: 'incident-triage',
      label: 'Incident Triage',
      icon: ShieldAlert,
      badge: metrics?.incidentCount ? String(metrics.incidentCount) : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      section: 'OPERATIONS',
    },
    {
      id: 'communications',
      label: 'Communications',
      icon: Mail,
      badge: null,
      section: 'OPERATIONS',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileBarChart2,
      badge: null,
      section: 'INTEL',
    },
    {
      id: 'data-management',
      label: 'Data Management',
      icon: Database,
      badge: 'CSV',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      section: 'SYSTEM',
    },
    {
      id: 'settings',
      label: 'Settings & Audit',
      icon: Settings,
      badge: null,
      section: 'SYSTEM',
    },
  ];

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] bg-[#0B1020] border-r border-white/10 flex flex-col justify-between transition-all duration-300 select-none z-20 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item, index) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          const showSection =
            !collapsed && (index === 0 || navItems[index - 1].section !== item.section);

          return (
            <React.Fragment key={item.id}>
              {showSection && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          item.badgeColor || 'bg-white/10 text-slate-300 border-white/10'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-500 rounded-r" />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer Collapse Button */}
      <div className="p-2 border-t border-white/10 flex items-center justify-between">
        {!collapsed && (
          <div className="px-2 text-[10px] text-slate-400 font-mono">
            <span>CSM Core v2.4</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-auto cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
