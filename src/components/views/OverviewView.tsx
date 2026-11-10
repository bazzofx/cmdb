import { useEffect, useState } from 'react';
import {
  Server,
  Building2,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Package,
  CheckCircle2,
  Shield,
  Zap,
  PieChart,
  Layers,
  Users,
  UserCheck,
  Mail,
  ShieldAlert,
  FileWarning,
} from 'lucide-react';
import type { DashboardMetrics, AuditLogEvent, ServerRecord } from '../../types/index.js';
import { api } from '../../services/api.js';

interface OverviewViewProps {
  metrics: DashboardMetrics | null;
  recentLogs: AuditLogEvent[];
  loading: boolean;
  onNavigate: (view: string, filterParams?: Record<string, string>) => void;
  onSelectServer: (id: string) => void;
  canAccessIncidents?: boolean;
}

const BU_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
  'var(--chart-11)',
  'var(--chart-12)',
];

const SWG_COLORS: Record<string, string> = {
  GOOD: 'var(--chart-3)',
  PASS: 'var(--chart-3)',
  FAIL: 'var(--chart-5)',
  MISSING: 'var(--chart-4)',
  UNASSIGNED: 'var(--neutral)',
};

const polarPoint = (angle: number, radius: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: 100 + radius * Math.cos(radians),
    y: 100 + radius * Math.sin(radians),
  };
};

const donutSlicePath = (startAngle: number, endAngle: number, outer = 78, inner = 48) => {
  const outerStart = polarPoint(startAngle, outer);
  const outerEnd = polarPoint(endAngle, outer);
  const innerEnd = polarPoint(endAngle, inner);
  const innerStart = polarPoint(startAngle, inner);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  recentLogs,
  loading,
  onNavigate,
  onSelectServer,
  canAccessIncidents = false,
}) => {
  const [hoveredBusinessUnit, setHoveredBusinessUnit] = useState<number | null>(null);
  const [hoveredSwgCheck, setHoveredSwgCheck] = useState<number | null>(null);
  const [affectedAssets, setAffectedAssets] = useState<ServerRecord[]>([]);
  const [affectedLoading, setAffectedLoading] = useState(false);

  useEffect(() => {
    if (!canAccessIncidents) return;
    let cancelled = false;

    (async () => {
      setAffectedLoading(true);
      try {
        const incidents = await api.getIncidents();
        const affectedIds = new Set<string>();
        for (const incident of incidents) {
          if (incident.status === 'Closed' || incident.status === 'Archived') continue;
          for (const id of incident.affected_server_ids ?? []) affectedIds.add(id);
        }
        if (affectedIds.size === 0) {
          if (!cancelled) setAffectedAssets([]);
          return;
        }
        const response = await api.getServers({ limit: 100000 });
        if (!cancelled) setAffectedAssets(response.items.filter(s => affectedIds.has(s.id)));
      } catch {
        if (!cancelled) setAffectedAssets([]);
      } finally {
        if (!cancelled) setAffectedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canAccessIncidents]);

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="p-8 text-center text-xs font-mono text-slate-400 bg-slate-900/40 rounded-2xl border border-white/5">
          <Activity className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
          Loading infrastructure overview intelligence...
        </div>
      </div>
    );
  }

  const productBreakdown = metrics.servers_by_product ?? [];

  const totalProductCount = metrics.total_products ?? productBreakdown.length;
  const totalServers = metrics.total_servers;
  const poweredOnCount = metrics.powered_on_servers ?? 0;
  const poweredOffCount = metrics.powered_off_servers ?? 0;
  const poweredOnPct = Math.round((poweredOnCount / (totalServers || 1)) * 100);
  const poweredOffPct = 100 - poweredOnPct;

  const secureBootEnabled = metrics.secure_boot_status?.find(s => s.name === 'Enabled')?.count ?? 0;
  const secureBootDisabled = metrics.secure_boot_status?.find(s => s.name === 'Disabled')?.count ?? 0;
  const secureBootPct = Math.round((secureBootEnabled / (totalServers || 1)) * 100);

  const fullyAssigned = metrics.ownership_completeness?.fully_assigned ?? 0;
  const ownershipPct = Math.round((fullyAssigned / (totalServers || 1)) * 100);

  const businessUnits = metrics.servers_by_business_unit ?? [];
  const businessUnitTotal = businessUnits.reduce((sum, unit) => sum + unit.count, 0);
  let businessUnitAngle = 0;
  const businessUnitSlices = businessUnits.map((unit, index) => {
    const sweep = businessUnitTotal > 0 ? (unit.count / businessUnitTotal) * 360 : 0;
    const slice = {
      ...unit,
      startAngle: businessUnitAngle,
      endAngle: businessUnitAngle + sweep,
      color: BU_COLORS[index % BU_COLORS.length],
      percentage: businessUnitTotal > 0 ? Math.round((unit.count / businessUnitTotal) * 100) : 0,
    };
    businessUnitAngle += sweep;
    return slice;
  });
  const hoveredBusinessUnitSlice =
    hoveredBusinessUnit !== null ? businessUnitSlices[hoveredBusinessUnit] : null;

  const swgChecks = metrics.servers_by_swg_check ?? [];
  const swgCheckTotal = swgChecks.reduce((sum, item) => sum + item.count, 0);
  let swgCheckAngle = 0;
  const swgCheckSlices = swgChecks.map((item, index) => {
    const sweep = swgCheckTotal > 0 ? (item.count / swgCheckTotal) * 360 : 0;
    const slice = {
      ...item,
      startAngle: swgCheckAngle,
      endAngle: swgCheckAngle + sweep,
      color: SWG_COLORS[item.name.toUpperCase()] ?? BU_COLORS[index % BU_COLORS.length],
      percentage: swgCheckTotal > 0 ? Math.round((item.count / swgCheckTotal) * 100) : 0,
    };
    swgCheckAngle += sweep;
    return slice;
  });
  const hoveredSwgCheckSlice =
    hoveredSwgCheck !== null ? swgCheckSlices[hoveredSwgCheck] : null;

  const axisMax = Math.max(1, totalServers);
  const axisTicks = Array.from({ length: 5 }, (_, index) => Math.round((axisMax * index) / 4));

  const telemetryItems = [
    {
      label: 'Sub-Business Units',
      value: metrics.total_sub_business_units,
      icon: Layers,
      iconClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      numberClass: 'text-cyan-300',
      onClick: () => onNavigate('business-units'),
    },
    {
      label: 'Datacenters',
      value: metrics.total_datacenters,
      icon: Building2,
      iconClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      numberClass: 'text-blue-300',
      onClick: () => onNavigate('infrastructure-map'),
    },
    {
      label: 'Support Teams',
      value: metrics.total_support_teams,
      icon: Users,
      iconClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      numberClass: 'text-emerald-300',
      onClick: () => onNavigate('inventory'),
    },
    {
      label: 'Unique Managers',
      value: metrics.total_unique_managers,
      icon: UserCheck,
      iconClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      numberClass: 'text-violet-300',
      onClick: () => onNavigate('inventory'),
    },
    {
      label: 'Missing Owner',
      value: metrics.ownership_completeness?.missing_manager ?? 0,
      icon: ShieldAlert,
      iconClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      numberClass: 'text-amber-300',
      onClick: () => onNavigate('inventory', { manager: 'Unassigned' }),
    },
    {
      label: 'Missing Email',
      value: metrics.servers_missing_contact,
      icon: Mail,
      iconClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      numberClass: 'text-rose-300',
      onClick: () => onNavigate('inventory', { email: 'missing' }),
    },
    {
      label: 'Incomplete Metadata',
      value: metrics.servers_incomplete_metadata,
      icon: FileWarning,
      iconClass: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
      numberClass: 'text-slate-200',
      onClick: () => onNavigate('reports'),
    },
  ];

  const renderTelemetryItem = (item: (typeof telemetryItems)[number]) => {
    const Icon = item.icon;
    return (
      <button
        key={item.label}
        type="button"
        onClick={item.onClick}
        className="group flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-left cursor-pointer transition-colors"
      >
        <span className={`p-1 rounded border shrink-0 ${item.iconClass}`}>
          <Icon className="w-3 h-3" />
        </span>
        <span className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-slate-500 truncate">
            {item.label}
          </span>
          <span className={`text-xs font-black font-mono leading-none shrink-0 ${item.numberClass}`}>
            {item.value}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="relative space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Background Celestial Earth Digital Wireframe (matching reference image) */}
      <div className="absolute -top-12 -right-8 w-[640px] h-[400px] pointer-events-none opacity-40 overflow-hidden hidden md:block">
        <svg
          viewBox="0 0 500 350"
          className="w-full h-full text-blue-500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="globe-glow" cx="60%" cy="40%" r="60%">
              <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.4" />
              <stop offset="60%" stopColor="var(--accent-4)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--app-bg-solid)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Luminous sphere base */}
          <circle cx="320" cy="140" r="150" fill="url(#globe-glow)" />

          {/* Latitude & Longitude curves */}
          <ellipse cx="320" cy="140" rx="150" ry="60" stroke="var(--accent-2)" strokeWidth="0.75" strokeOpacity="0.3" strokeDasharray="4 4" />
          <ellipse cx="320" cy="140" rx="150" ry="110" stroke="var(--accent)" strokeWidth="0.75" strokeOpacity="0.25" />
          <ellipse cx="320" cy="140" rx="150" ry="25" stroke="var(--accent-3)" strokeWidth="0.75" strokeOpacity="0.2" />
          <ellipse cx="320" cy="140" rx="60" ry="150" stroke="var(--accent-2)" strokeWidth="0.75" strokeOpacity="0.3" />
          <ellipse cx="320" cy="140" rx="110" ry="150" stroke="var(--accent)" strokeWidth="0.75" strokeOpacity="0.25" strokeDasharray="6 4" />

          {/* Atmospheric orbit rings */}
          <ellipse cx="320" cy="140" rx="175" ry="85" stroke="url(#orbit-grad)" strokeWidth="1" strokeDasharray="8 6" transform="rotate(-18 320 140)" />

          {/* Glowing Network Nodes & Interconnects */}
          <g>
            <line x1="280" y1="110" x2="350" y2="85" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="350" y1="85" x2="410" y2="130" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="280" y1="110" x2="310" y2="175" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="310" y1="175" x2="390" y2="185" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="390" y1="185" x2="410" y2="130" stroke="var(--accent-2)" strokeWidth="1" strokeOpacity="0.5" />

            <circle cx="280" cy="110" r="3" fill="var(--accent-2)" />
            <circle cx="350" cy="85" r="3.5" fill="var(--accent-2)" />
            <circle cx="410" cy="130" r="2.5" fill="var(--accent)" />
            <circle cx="310" cy="175" r="3" fill="var(--accent-3)" />
            <circle cx="390" cy="185" r="3.5" fill="var(--accent-2)" />
            <circle cx="240" cy="150" r="2" fill="var(--accent-2)" />
            <circle cx="360" cy="220" r="2" fill="var(--accent)" />
          </g>
        </svg>
      </div>

      {/* Header: Title and subtitle */}
      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
          Infrastructure Overview
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Real-time visibility of your infrastructure, security posture and ownership
        </p>
      </div>

      {/* TOP KPI CARDS ROW (5 Cards: Total Servers, Online, Products, Secure Boot, Ownership Complete) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
        {/* 1. Total Servers */}
        <TopKpiCard
          label="Total Servers"
          mainValue={String(totalServers)}
          icon={<Server className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/20"
          onClick={() => onNavigate('inventory')}
        />

        {/* 2. Online (Powered On) */}
        <TopKpiCard
          label="Online"
          mainValue={`${poweredOnCount} / ${totalServers}`}
          badgePct={`${poweredOnPct}%`}
          badgeColor="text-emerald-400"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          iconBg="bg-emerald-500/20"
          onClick={() => onNavigate('inventory', { power_state: 'poweredOn' })}
        />

        {/* 3. Products Metric Card (Added as specifically requested!) */}
        <TopKpiCard
          label="Products"
          mainValue={String(totalProductCount)}
          badgePct="Products"
          badgeColor="text-cyan-400"
          icon={<Package className="w-4 h-4 text-cyan-400" />}
          iconBg="bg-cyan-500/20"
          onClick={() => onNavigate('products')}
        />

        {/* 4. Secure Boot */}
        <TopKpiCard
          label="Secure Boot"
          mainValue={`${secureBootEnabled} / ${totalServers}`}
          badgePct={`${secureBootPct}%`}
          badgeColor="text-purple-400"
          icon={<Shield className="w-4 h-4 text-purple-400" />}
          iconBg="bg-purple-500/20"
          onClick={() => onNavigate('inventory', { secure_boot: 'TRUE' })}
        />

        {/* 5. Ownership Complete */}
        <TopKpiCard
          label="Ownership Complete"
          mainValue={`${fullyAssigned} / ${totalServers}`}
          badgePct={`${ownershipPct}%`}
          badgeColor="text-teal-400"
          icon={<ShieldCheck className="w-4 h-4 text-teal-400" />}
          iconBg="bg-teal-500/20"
          onClick={() => onNavigate('ownership-explorer')}
        />
      </div>

      {/* MIDDLE SECTION: Charts & Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* Left Column (8 cols): Primary Visual Charts */}
        <div className="lg:col-span-8 space-y-5">
          {/* Row A: Servers by Business Unit & Product Counts Top 10 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Servers by Business Unit (Horizontal Bar Chart) */}
            <div className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4 flex flex-col lg:h-[340px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Servers by Business Unit
                    </h2>
                    <span className="text-[11px] text-slate-400">Inventory allocation</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('business-units')}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
                >
                  <span>All BUs</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {/* Horizontal Bars */}
              <div className="space-y-3 pt-1 flex-1 min-h-0 overflow-y-auto pr-1">
                {metrics.servers_by_business_unit.slice(0, 6).map((bu) => {
                  const pct = Math.round((bu.count / (totalServers || 1)) * 100);
                  return (
                    <div
                      key={bu.name}
                      onClick={() => onNavigate('inventory', { business_unit: bu.name })}
                      className="group cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300 group-hover:text-blue-300 transition-colors truncate max-w-[150px]">
                          {bu.name}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          {bu.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[var(--chart-track)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                          style={{
                            width: `${Math.max(10, pct)}%`,
                            backgroundImage: 'linear-gradient(90deg, var(--chart-1), var(--chart-2))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axis markers */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                {axisTicks.map((tick, index) => (
                  <span key={`${index}-${tick}`}>{tick}</span>
                ))}
              </div>
            </div>

            {/* Product Counts as Bar Chart Top 10 (Added as specifically requested!) */}
            <div className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4 flex flex-col lg:h-[340px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Product Counts (Top 10)
                    </h2>
                    <span className="text-[11px] text-slate-400">Product server mapping</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('products')}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                >
                  <span>All Products</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {/* Horizontal Bars for Top Products */}
              <div className="space-y-3 pt-1 flex-1 min-h-0 overflow-y-auto pr-1">
                {productBreakdown.slice(0, 10).map((prod) => {
                  const pct = Math.round((prod.count / (totalServers || 1)) * 100);
                  return (
                    <div
                      key={prod.name}
                      onClick={() => onNavigate('inventory', { product: prod.name })}
                      className="group cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300 group-hover:text-cyan-300 transition-colors truncate max-w-[150px]">
                          {prod.name}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-slate-400">{pct}%</span>
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {prod.count} {prod.count === 1 ? 'server' : 'servers'}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-[var(--chart-track)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                          style={{
                            width: `${Math.max(10, pct)}%`,
                            backgroundImage: 'linear-gradient(90deg, var(--chart-6), var(--chart-1))',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axis markers */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                {axisTicks.map((tick, index) => (
                  <span key={`${index}-${tick}`}>{tick}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Row B: Pie Chart on Power On/Off Servers & Security Posture Donut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pie / Donut Chart: Power on / off servers (Added as specifically requested!) */}
            <div className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Power State Distribution
                    </h2>
                    <span className="text-[11px] text-slate-400">Operational power status</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {poweredOnPct}% ACTIVE
                </span>
              </div>

              {/* Pie / Donut Chart SVG */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background track circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="var(--chart-track)"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {/* Powered On segment (emerald) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="url(#power-green-grad)"
                      strokeWidth="14"
                      fill="transparent"
                      strokeDasharray={`${(poweredOnPct / 100) * 238.76} 238.76`}
                      strokeLinecap="round"
                    />
                    {/* Powered Off segment (amber/rose) */}
                    {poweredOffCount > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#f59e0b"
                        strokeWidth="14"
                        fill="transparent"
                        strokeDasharray={`${(poweredOffPct / 100) * 238.76} 238.76`}
                        strokeDashoffset={`-${(poweredOnPct / 100) * 238.76}`}
                        strokeLinecap="round"
                      />
                    )}
                    <defs>
                      <linearGradient id="power-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#34D399" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Center percentage */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black font-mono text-white tracking-tight">
                      {poweredOnPct}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Powered On</span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="flex-1 space-y-2.5 w-full">
                  <div 
                    onClick={() => onNavigate('inventory', { power_state: 'poweredOn' })}
                    className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/15 hover:bg-emerald-500/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <span className="text-xs text-slate-200 font-medium">Powered On</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {poweredOnCount} ({poweredOnPct}%)
                    </span>
                  </div>

                  <div 
                    onClick={() => onNavigate('inventory', { power_state: 'poweredOff' })}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      <span className="text-xs text-slate-400 font-medium">Powered Off</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {poweredOffCount} ({poweredOffPct}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500/40" />
                      <span className="text-xs font-medium">Suspended</span>
                    </div>
                    <span className="text-xs font-mono">0 (0%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Posture Donut Chart (matching reference image) */}
            <div className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Security Posture
                    </h2>
                    <span className="text-[11px] text-slate-400">EFI Secure Boot & Hardware</span>
                  </div>
                </div>
              </div>

              {/* Security Posture Donut & Breakdown (as seen in image) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="var(--chart-track)"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {/* Secure segment (green) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#10B981"
                      strokeWidth="14"
                      fill="transparent"
                      strokeDasharray={`${(secureBootPct / 100) * 238.76} 238.76`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black font-mono text-white tracking-tight">
                      {secureBootPct}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Secure</span>
                  </div>
                </div>

                {/* Legend list matching image */}
                <div className="flex-1 space-y-2 w-full text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      <span className="text-slate-300">Secure</span>
                    </div>
                    <span className="font-mono text-white font-bold">{secureBootEnabled}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-slate-400">At Risk</span>
                    </div>
                    <span className="font-mono text-slate-400">0</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-400">At Risk (High)</span>
                    </div>
                    <span className="font-mono text-slate-400">0</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      <span className="text-slate-400">Unknown / Disabled</span>
                    </div>
                    <span className="font-mono text-slate-400">{secureBootDisabled}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Business Unit distribution + secondary metrics */}
        <div className="lg:col-span-4 space-y-5">
          {/* Servers by Business Unit pie chart */}
          <div data-testid="bu-pie-card" className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3 flex flex-col lg:h-[340px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Business Unit Distribution
                  </h2>
                  <p className="text-[10px] text-slate-500">Share of servers across the estate</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {businessUnits.length} BU{businessUnits.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
              <div className="relative w-36 h-36 shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  <circle cx="100" cy="100" r="63" fill="none" stroke="var(--chart-track)" strokeWidth="30" />

                  {businessUnitTotal > 0 && businessUnitSlices.length === 1 && (() => {
                    const slice = businessUnitSlices[0];
                    const canFilter = slice.name !== 'Unassigned';
                    return (
                      <circle
                        cx="100"
                        cy="100"
                        r="63"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="30"
                        opacity={hoveredBusinessUnit === null || hoveredBusinessUnit === 0 ? 1 : 0.45}
                        onMouseEnter={() => setHoveredBusinessUnit(0)}
                        onMouseLeave={() => setHoveredBusinessUnit(null)}
                        onClick={() => canFilter && onNavigate('inventory', { business_unit: slice.name })}
                        role={canFilter ? 'button' : 'img'}
                        tabIndex={canFilter ? 0 : -1}
                        aria-label={`${slice.name}: ${slice.count} servers`}
                        style={{ cursor: canFilter ? 'pointer' : 'default' }}
                        className="transition-opacity duration-150 outline-none"
                        onKeyDown={event => {
                          if (canFilter && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            onNavigate('inventory', { business_unit: slice.name });
                          }
                        }}
                      >
                        <title>{`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}</title>
                      </circle>
                    );
                  })()}

                  {businessUnitTotal > 0 && businessUnitSlices.length > 1 &&
                    businessUnitSlices.map((slice, index) => {
                      const canFilter = slice.name !== 'Unassigned';
                      return (
                        <path
                          key={slice.name}
                          d={donutSlicePath(slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          stroke="var(--chart-hole)"
                          strokeWidth="1.5"
                          opacity={hoveredBusinessUnit === null || hoveredBusinessUnit === index ? 1 : 0.45}
                          onMouseEnter={() => setHoveredBusinessUnit(index)}
                          onMouseLeave={() => setHoveredBusinessUnit(null)}
                          onClick={() => canFilter && onNavigate('inventory', { business_unit: slice.name })}
                          role={canFilter ? 'button' : 'img'}
                          tabIndex={canFilter ? 0 : -1}
                          aria-label={`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}
                          style={{ cursor: canFilter ? 'pointer' : 'default' }}
                          className="transition-opacity duration-150 outline-none focus-visible:opacity-100"
                          onKeyDown={event => {
                            if (canFilter && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              onNavigate('inventory', { business_unit: slice.name });
                            }
                          }}
                        >
                          <title>{`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}</title>
                        </path>
                      );
                    })}

                  <circle cx="100" cy="100" r="47" fill="var(--chart-hole)" />
                </svg>

                <div data-testid="bu-pie-center" className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  <span className="text-[8px] uppercase tracking-wider text-slate-500 max-w-[92px] truncate">
                    {hoveredBusinessUnitSlice?.name ?? 'Total'}
                  </span>
                  <span className="text-xl font-black text-white leading-tight">
                    {hoveredBusinessUnitSlice?.count ?? businessUnitTotal}
                  </span>
                  <span className="text-[8px] text-slate-500">
                    {hoveredBusinessUnitSlice
                      ? `${hoveredBusinessUnitSlice.percentage}% of servers`
                      : 'servers'}
                  </span>
                </div>
              </div>

              {businessUnits.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-2 flex-1">No business unit data.</p>
              ) : (
                <div data-testid="bu-legend" className="flex-1 w-full min-w-0 max-h-[190px] overflow-y-auto space-y-1 pr-1">
                  {businessUnitSlices.map((slice, index) => {
                    const canFilter = slice.name !== 'Unassigned';
                    return (
                      <button
                        key={slice.name}
                        type="button"
                        disabled={!canFilter}
                        onMouseEnter={() => setHoveredBusinessUnit(index)}
                        onMouseLeave={() => setHoveredBusinessUnit(null)}
                        onClick={() => canFilter && onNavigate('inventory', { business_unit: slice.name })}
                        title={
                          canFilter
                            ? `Open Inventory filtered to ${slice.name}`
                            : 'Unassigned servers cannot be filtered by business unit'
                        }
                        className={`w-full flex items-center justify-between gap-1.5 px-1.5 py-1 rounded text-[10px] ${
                          canFilter ? 'hover:bg-white/[0.04] cursor-pointer' : 'cursor-default opacity-80'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                          <span className="text-slate-300 truncate">{slice.name}</span>
                        </span>
                        <span className="font-mono text-slate-400 shrink-0 text-[10px]">
                          {slice.count} <span className="text-slate-600">({slice.percentage}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 font-mono border-t border-white/5 pt-2 mt-auto">
              Hover a slice for detail · click to filter Inventory
            </p>
          </div>

          {/* SWG Check status pie chart */}
          <div data-testid="swg-pie-card" className="p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Trend AV Status</h2>
                  <p className="text-[10px] text-slate-500">Security working group verification</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {swgChecks.length} state{swgChecks.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
              <div className="relative w-36 h-36 shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  <circle cx="100" cy="100" r="63" fill="none" stroke="var(--chart-track)" strokeWidth="30" />

                  {swgCheckTotal > 0 && swgCheckSlices.length === 1 && (() => {
                    const slice = swgCheckSlices[0];
                    const canFilter = slice.name !== 'Unassigned';
                    return (
                      <circle
                        cx="100"
                        cy="100"
                        r="63"
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="30"
                        opacity={hoveredSwgCheck === null || hoveredSwgCheck === 0 ? 1 : 0.45}
                        onMouseEnter={() => setHoveredSwgCheck(0)}
                        onMouseLeave={() => setHoveredSwgCheck(null)}
                        onClick={() => canFilter && onNavigate('inventory', { swg_check: slice.name })}
                        role={canFilter ? 'button' : 'img'}
                        tabIndex={canFilter ? 0 : -1}
                        aria-label={`${slice.name}: ${slice.count} servers`}
                        style={{ cursor: canFilter ? 'pointer' : 'default' }}
                        className="transition-opacity duration-150 outline-none"
                      >
                        <title>{`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}</title>
                      </circle>
                    );
                  })()}

                  {swgCheckTotal > 0 && swgCheckSlices.length > 1 &&
                    swgCheckSlices.map((slice, index) => {
                      const canFilter = slice.name !== 'Unassigned';
                      return (
                        <path
                          key={slice.name}
                          d={donutSlicePath(slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          stroke="var(--chart-hole)"
                          strokeWidth="1.5"
                          opacity={hoveredSwgCheck === null || hoveredSwgCheck === index ? 1 : 0.45}
                          onMouseEnter={() => setHoveredSwgCheck(index)}
                          onMouseLeave={() => setHoveredSwgCheck(null)}
                          onClick={() => canFilter && onNavigate('inventory', { swg_check: slice.name })}
                          role={canFilter ? 'button' : 'img'}
                          tabIndex={canFilter ? 0 : -1}
                          aria-label={`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}
                          style={{ cursor: canFilter ? 'pointer' : 'default' }}
                          className="transition-opacity duration-150 outline-none focus-visible:opacity-100"
                        >
                          <title>{`${slice.name}: ${slice.count} servers (${slice.percentage}%)`}</title>
                        </path>
                      );
                    })}

                  <circle cx="100" cy="100" r="47" fill="var(--chart-hole)" />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  <span className="text-[8px] uppercase tracking-wider text-slate-500 max-w-[92px] truncate">
                    {hoveredSwgCheckSlice?.name ?? 'Total'}
                  </span>
                  <span className="text-xl font-black text-white leading-tight">
                    {hoveredSwgCheckSlice?.count ?? swgCheckTotal}
                  </span>
                  <span className="text-[8px] text-slate-500">
                    {hoveredSwgCheckSlice
                      ? `${hoveredSwgCheckSlice.percentage}% of servers`
                      : 'servers'}
                  </span>
                </div>
              </div>

              {swgChecks.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-2 flex-1">No SWG check data.</p>
              ) : (
                <div className="flex-1 w-full min-w-0 max-h-[190px] overflow-y-auto space-y-1 pr-1">
                  {swgCheckSlices.map((slice, index) => {
                    const canFilter = slice.name !== 'Unassigned';
                    return (
                      <button
                        key={slice.name}
                        type="button"
                        disabled={!canFilter}
                        onMouseEnter={() => setHoveredSwgCheck(index)}
                        onMouseLeave={() => setHoveredSwgCheck(null)}
                        onClick={() => canFilter && onNavigate('inventory', { swg_check: slice.name })}
                        title={
                          canFilter
                            ? `Open Inventory filtered to SWG Check ${slice.name}`
                            : 'Unassigned SWG status cannot be filtered'
                        }
                        className={`w-full flex items-center justify-between gap-1.5 px-1.5 py-1 rounded text-[10px] ${
                          canFilter ? 'hover:bg-white/[0.04] cursor-pointer' : 'cursor-default opacity-80'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                          <span className="text-slate-300 truncate">{slice.name}</span>
                        </span>
                        <span className="font-mono text-slate-400 shrink-0 text-[10px]">
                          {slice.count} <span className="text-slate-600">({slice.percentage}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-500 font-mono border-t border-white/5 pt-2 mt-auto">
              Hover a slice for detail · click to filter Inventory
            </p>
          </div>

        </div>
      </div>

      {/* AFFECTED ASSET TRIAGE — read-only mirror of the incident triage asset list */}
      {canAccessIncidents && (
        <div className="relative z-10 p-5 rounded-2xl bg-[var(--surface-1)]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Affected Asset Triage</h2>
                <span className="text-[11px] text-slate-400">Assets across open incidents</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('incident-triage')}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
            >
              <span>Open Incident Triage</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {affectedLoading ? (
            <p className="text-[11px] text-slate-500 font-mono py-2">Loading affected assets…</p>
          ) : affectedAssets.length === 0 ? (
            <p className="text-[11px] text-slate-500 font-mono py-2">No affected assets across open incidents.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="p-3">Host Identifier</th>
                    <th className="p-3">VM</th>
                    <th className="p-3">Primary IP</th>
                    <th className="p-3">Business Unit</th>
                    <th className="p-3">Manager</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                  {affectedAssets.map(s => (
                    <tr
                      key={s.id}
                      onClick={() => onSelectServer(s.id)}
                      className="cursor-pointer hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="p-3 font-medium text-white">{s.host}</td>
                      <td className="p-3 text-slate-300">{s.vm}</td>
                      <td className="p-3 text-cyan-300">{s.primary_ip_address}</td>
                      <td className="p-3 text-purple-300 font-sans">{s.business_unit || '—'}</td>
                      <td className="p-3 text-slate-300 font-sans">{s.manager || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FULL-WIDTH OPERATIONAL TELEMETRY BAR */}
      <div className="relative z-10 p-2.5 rounded-xl bg-[var(--surface-1)]/60 border border-slate-800/50 shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-slate-300 tracking-wide">
              Operational Telemetry
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Secondary Metrics
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
          {telemetryItems.slice(0, 4).map(renderTelemetryItem)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 mt-1">
          {telemetryItems.slice(4).map(renderTelemetryItem)}
        </div>
      </div>

      {/* BOTTOM ROW: Infrastructure Health, Top Risks, Recent Activity (matching reference image) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">

      </div>
    </div>
  );
};

// Reusable Top KPI Card (compact, current-state only)
const TopKpiCard: React.FC<{
  label: string;
  mainValue: string;
  badgePct?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
}> = ({
  label,
  mainValue,
  badgePct,
  badgeColor = 'text-emerald-400',
  icon,
  iconBg,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl bg-[var(--surface-1)]/80 border border-slate-800/80 hover:border-slate-700/80 hover:bg-[var(--surface-2)]/90 transition-all duration-300 shadow-xl backdrop-blur-md cursor-pointer relative overflow-hidden group select-none"
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-slate-300 tracking-wide truncate">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-xl font-black font-mono text-white tracking-tight">
          {mainValue}
        </span>
        {badgePct && (
          <span className={`text-xs font-mono font-bold ${badgeColor}`}>
            {badgePct}
          </span>
        )}
      </div>
    </div>
  );
};
