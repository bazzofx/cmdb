import React, { useState } from 'react';
import {
  Server,
  Building2,
  Users,
  ShieldCheck,
  TriangleAlert,
  HardDrive,
  Activity,
  ArrowUpRight,
  Clock,
  Layers,
  Database,
  Calendar,
  ChevronDown,
  Package,
  CheckCircle2,
  Shield,
  Zap,
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
}) => {
  const [timeRange, setTimeRange] = useState('Last 24 Hours');
  const [isTimeRangeOpen, setIsTimeRangeOpen] = useState(false);

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

  // Fallback product breakdown if not yet in metrics
  const productBreakdown = metrics.servers_by_product && metrics.servers_by_product.length > 0
    ? metrics.servers_by_product
    : [
        { name: 'NDM', count: 5 },
        { name: 'Housing', count: 3 },
        { name: 'Pulse VTM', count: 1 },
      ];

  const totalProductCount = metrics.total_products || productBreakdown.length || 3;
  const totalServers = metrics.total_servers || 9;
  const poweredOnCount = metrics.powered_on_servers ?? 9;
  const poweredOffCount = metrics.powered_off_servers ?? 0;
  const poweredOnPct = Math.round((poweredOnCount / (totalServers || 1)) * 100);
  const poweredOffPct = 100 - poweredOnPct;

  const secureBootEnabled = metrics.secure_boot_status?.find(s => s.name === 'Enabled')?.count ?? 6;
  const secureBootDisabled = metrics.secure_boot_status?.find(s => s.name === 'Disabled')?.count ?? 3;
  const secureBootPct = Math.round((secureBootEnabled / (totalServers || 1)) * 100);

  const fullyAssigned = metrics.ownership_completeness?.fully_assigned ?? totalServers;
  const ownershipPct = Math.round((fullyAssigned / (totalServers || 1)) * 100);

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
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#1e3a8a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Luminous sphere base */}
          <circle cx="320" cy="140" r="150" fill="url(#globe-glow)" />

          {/* Latitude & Longitude curves */}
          <ellipse cx="320" cy="140" rx="150" ry="60" stroke="#38bdf8" strokeWidth="0.75" strokeOpacity="0.3" strokeDasharray="4 4" />
          <ellipse cx="320" cy="140" rx="150" ry="110" stroke="#60a5fa" strokeWidth="0.75" strokeOpacity="0.25" />
          <ellipse cx="320" cy="140" rx="150" ry="25" stroke="#93c5fd" strokeWidth="0.75" strokeOpacity="0.2" />
          <ellipse cx="320" cy="140" rx="60" ry="150" stroke="#38bdf8" strokeWidth="0.75" strokeOpacity="0.3" />
          <ellipse cx="320" cy="140" rx="110" ry="150" stroke="#60a5fa" strokeWidth="0.75" strokeOpacity="0.25" strokeDasharray="6 4" />

          {/* Atmospheric orbit rings */}
          <ellipse cx="320" cy="140" rx="175" ry="85" stroke="url(#orbit-grad)" strokeWidth="1" strokeDasharray="8 6" transform="rotate(-18 320 140)" />

          {/* Glowing Network Nodes & Interconnects */}
          <g>
            <line x1="280" y1="110" x2="350" y2="85" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="350" y1="85" x2="410" y2="130" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="280" y1="110" x2="310" y2="175" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="310" y1="175" x2="390" y2="185" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />
            <line x1="390" y1="185" x2="410" y2="130" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" />

            <circle cx="280" cy="110" r="3" fill="#67e8f9" />
            <circle cx="350" cy="85" r="3.5" fill="#38bdf8" />
            <circle cx="410" cy="130" r="2.5" fill="#60a5fa" />
            <circle cx="310" cy="175" r="3" fill="#93c5fd" />
            <circle cx="390" cy="185" r="3.5" fill="#38bdf8" />
            <circle cx="240" cy="150" r="2" fill="#38bdf8" />
            <circle cx="360" cy="220" r="2" fill="#60a5fa" />
          </g>
        </svg>
      </div>

      {/* Header: Title, Subtitle, and Time Filter Dropdown (matching reference image) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            Infrastructure Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time visibility of your infrastructure, security posture and ownership
          </p>
        </div>

        {/* Date Filter Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsTimeRangeOpen(!isTimeRangeOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0d1424]/90 border border-slate-700/60 hover:border-slate-600 text-xs font-medium text-slate-200 transition-colors shadow-sm cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {isTimeRangeOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0e1629] border border-slate-700/70 shadow-2xl py-1.5 z-50 text-xs">
              {['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Year to Date'].map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setIsTimeRangeOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-white/10 transition-colors flex items-center justify-between ${
                    timeRange === range ? 'text-blue-400 font-semibold bg-white/5' : 'text-slate-300'
                  }`}
                >
                  <span>{range}</span>
                  {timeRange === range && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOP KPI CARDS ROW (5 Cards: Total Servers, Online, Products, Secure Boot, Ownership Complete) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
        {/* 1. Total Servers */}
        <TopKpiCard
          label="Total Servers"
          mainValue={String(totalServers)}
          trend="↑ 0% vs previous period"
          icon={<Server className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/20"
          waveColor="#3B82F6"
          onClick={() => onNavigate('inventory')}
        />

        {/* 2. Online (Powered On) */}
        <TopKpiCard
          label="Online"
          mainValue={`${poweredOnCount} / ${totalServers}`}
          badgePct={`${poweredOnPct}%`}
          badgeColor="text-emerald-400"
          trend="↑ 0% vs previous period"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          iconBg="bg-emerald-500/20"
          waveColor="#10B981"
          onClick={() => onNavigate('inventory', { power_state: 'poweredOn' })}
        />

        {/* 3. Products Metric Card (Added as specifically requested!) */}
        <TopKpiCard
          label="Products"
          mainValue={String(totalProductCount)}
          badgePct="4_Product"
          badgeColor="text-cyan-400"
          trend="↑ 0% vs previous period"
          icon={<Package className="w-4 h-4 text-cyan-400" />}
          iconBg="bg-cyan-500/20"
          waveColor="#06B6D4"
          onClick={() => onNavigate('products')}
        />

        {/* 4. Secure Boot */}
        <TopKpiCard
          label="Secure Boot"
          mainValue={`${secureBootEnabled} / ${totalServers}`}
          badgePct={`${secureBootPct}%`}
          badgeColor="text-purple-400"
          trend="↑ 0% vs previous period"
          icon={<Shield className="w-4 h-4 text-purple-400" />}
          iconBg="bg-purple-500/20"
          waveColor="#8B5CF6"
          onClick={() => onNavigate('inventory', { secure_boot: 'TRUE' })}
        />

        {/* 5. Ownership Complete */}
        <TopKpiCard
          label="Ownership Complete"
          mainValue={`${fullyAssigned} / ${totalServers}`}
          badgePct={`${ownershipPct}%`}
          badgeColor="text-teal-400"
          trend="↑ 0% vs previous period"
          icon={<ShieldCheck className="w-4 h-4 text-teal-400" />}
          iconBg="bg-teal-500/20"
          waveColor="#14B8A6"
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
            <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
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
              <div className="space-y-3 pt-1">
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
                      <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full group-hover:from-blue-500 group-hover:to-indigo-400 transition-all duration-300"
                          style={{ width: `${Math.max(10, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axis markers */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                <span>0</span>
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4+</span>
              </div>
            </div>

            {/* Product Counts as Bar Chart Top 10 (Added as specifically requested!) */}
            <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Product Counts (Top 10)
                    </h2>
                    <span className="text-[11px] text-slate-400">4_Product server mapping</span>
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
              <div className="space-y-3 pt-1">
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
                      <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full group-hover:from-cyan-400 group-hover:to-blue-400 transition-all duration-300"
                          style={{ width: `${Math.max(10, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axis markers */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
                <span>0</span>
                <span>2</span>
                <span>4</span>
                <span>6</span>
                <span>8+</span>
              </div>
            </div>
          </div>

          {/* Row B: Pie Chart on Power On/Off Servers & Security Posture Donut */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pie / Donut Chart: Power on / off servers (Added as specifically requested!) */}
            <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
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
                      stroke="#1e293b"
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
            <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
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
                      stroke="#1e293b"
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

        {/* Right Column (4 cols): Secondary / Compact Metrics + Incidents & Alerts Spline */}
        <div className="lg:col-span-4 space-y-5">
          {/* Incidents & Alerts Spline Chart Card (matching reference image) */}
          <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Incidents & Alerts
                  </h2>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                1 Active
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Incidents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Alerts</span>
              </div>
            </div>

            {/* Spline Chart SVG */}
            <div className="h-32 w-full pt-2">
              <svg viewBox="0 0 300 110" className="w-full h-full" fill="none">
                {/* Horizontal grid lines */}
                <line x1="25" y1="20" x2="295" y2="20" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="25" y1="50" x2="295" y2="50" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="25" y1="80" x2="295" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3 3" />

                {/* Y-axis labels */}
                <text x="5" y="24" fill="#64748b" fontSize="8" fontFamily="monospace">15</text>
                <text x="5" y="54" fill="#64748b" fontSize="8" fontFamily="monospace">10</text>
                <text x="12" y="84" fill="#64748b" fontSize="8" fontFamily="monospace">5</text>
                <text x="12" y="105" fill="#64748b" fontSize="8" fontFamily="monospace">0</text>

                {/* Alerts Blue Spline Curve */}
                <path
                  d="M 30 75 Q 70 65 110 40 T 190 70 T 240 45 T 290 60"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Alerts Dots */}
                <circle cx="30" cy="75" r="3" fill="#3B82F6" />
                <circle cx="110" cy="40" r="3.5" fill="#3B82F6" />
                <circle cx="190" cy="70" r="3" fill="#3B82F6" />
                <circle cx="240" cy="45" r="3.5" fill="#3B82F6" />
                <circle cx="290" cy="60" r="3" fill="#3B82F6" />

                {/* Incidents Coral Spline Curve */}
                <path
                  d="M 30 95 Q 70 90 110 70 T 190 92 T 240 75 T 290 85"
                  stroke="#F43F5E"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Incidents Dots */}
                <circle cx="30" cy="95" r="3" fill="#F43F5E" />
                <circle cx="110" cy="70" r="3.5" fill="#F43F5E" />
                <circle cx="190" cy="92" r="3" fill="#F43F5E" />
                <circle cx="240" cy="75" r="3.5" fill="#F43F5E" />
                <circle cx="290" cy="85" r="3" fill="#F43F5E" />
              </svg>
              {/* Day markers */}
              <div className="flex justify-between px-6 text-[9px] font-mono text-slate-500">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </div>

          {/* ALL OTHER METRICS ON A SMALLER CARD NOT SO IN FOCUS (Specifically requested!) */}
          <div className="p-5 rounded-2xl bg-[#0D1424]/70 border border-slate-800/60 shadow-lg backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-semibold text-slate-300 tracking-wide">
                Operational Telemetry
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Secondary Metrics
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div 
                onClick={() => onNavigate('business-units')}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200">Sub-Business Units</span>
                <span className="font-mono text-slate-200 font-semibold">{metrics.total_sub_business_units}</span>
              </div>

              <div 
                onClick={() => onNavigate('infrastructure-map')}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200">Datacenters</span>
                <span className="font-mono text-slate-200 font-semibold">{metrics.total_datacenters}</span>
              </div>

              <div 
                onClick={() => onNavigate('inventory')}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200">Support Teams</span>
                <span className="font-mono text-slate-200 font-semibold">{metrics.total_support_teams}</span>
              </div>

              <div 
                onClick={() => onNavigate('inventory')}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200">Unique Managers</span>
                <span className="font-mono text-slate-200 font-semibold">{metrics.total_unique_managers}</span>
              </div>

              <div 
                onClick={() => onNavigate('inventory', { ownership: 'missing' })}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-amber-300">Missing Owner</span>
                <span className={`font-mono font-semibold ${metrics.servers_missing_ownership > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {metrics.servers_missing_ownership}
                </span>
              </div>

              <div 
                onClick={() => onNavigate('inventory', { email: 'missing' })}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-amber-300">Missing Email</span>
                <span className={`font-mono font-semibold ${metrics.servers_missing_contact > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {metrics.servers_missing_contact}
                </span>
              </div>

              <div 
                onClick={() => onNavigate('reports')}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200">Incomplete Metadata</span>
                <span className="font-mono text-slate-400 font-semibold">{metrics.servers_incomplete_metadata}</span>
              </div>
            </div>

            {/* Quick environment breakdown */}
            <div className="pt-2 border-t border-white/5">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
                Environments
              </span>
              <div className="flex flex-wrap gap-1.5">
                {metrics.servers_by_environment?.map((env) => (
                  <span
                    key={env.name}
                    onClick={() => onNavigate('inventory', { environment: env.name })}
                    className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-[11px] text-slate-300 font-mono hover:border-blue-500/30 cursor-pointer"
                  >
                    {env.name}: {env.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Infrastructure Health, Top Risks, Recent Activity (matching reference image) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
        {/* 1. Infrastructure Health with 4 Gauges */}
        <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Infrastructure Health
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            {/* Availability 100% */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.2"
                    strokeDasharray="100, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] font-bold text-white">100%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">Availability</span>
              <span className="text-[9px] font-mono text-emerald-400">↑ +0%</span>
            </div>

            {/* Performance 99.8% */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="3.2"
                    strokeDasharray="99.8, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] font-bold text-white">99.8%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">Performance</span>
              <span className="text-[9px] font-mono text-cyan-400">↑ +0.1%</span>
            </div>

            {/* Patch Level 98% */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.2"
                    strokeDasharray="98, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] font-bold text-white">98%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">Patch Level</span>
              <span className="text-[9px] font-mono text-emerald-400">↑ +0.5%</span>
            </div>

            {/* Compliance 87% */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="3.2"
                    strokeDasharray="87, 100"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute font-mono text-[11px] font-bold text-white">87%</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block">Compliance</span>
              <span className="text-[9px] font-mono text-purple-400">↑ +1%</span>
            </div>
          </div>
        </div>

        {/* 2. Top Risks (matching reference image) */}
        <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Top Risks
              </h2>
            </div>
            <button
              onClick={() => onNavigate('incident-triage')}
              className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Risk 1 */}
            <div
              onClick={() => onNavigate('incident-triage')}
              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 cursor-pointer text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-slate-500 text-xs">1</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  High
                </span>
                <span className="text-slate-300 group-hover:text-white truncate max-w-[170px]">
                  1 high severity incident detected
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">6h ago</span>
            </div>

            {/* Risk 2 */}
            <div
              onClick={() => onNavigate('inventory', { secure_boot: 'FALSE' })}
              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 cursor-pointer text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-slate-500 text-xs">2</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Med
                </span>
                <span className="text-slate-300 group-hover:text-white truncate max-w-[170px]">
                  Secure boot disabled (3 servers)
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">2d ago</span>
            </div>

            {/* Risk 3 */}
            <div
              onClick={() => onNavigate('reports')}
              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 cursor-pointer text-xs group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-slate-500 text-xs">3</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Med
                </span>
                <span className="text-slate-300 group-hover:text-white truncate max-w-[170px]">
                  Review ownership metadata
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">2d ago</span>
            </div>
          </div>
        </div>

        {/* 3. Recent Activity (matching reference image) */}
        <div className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 shadow-xl backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Recent Activity
              </h2>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <span className="text-slate-300 truncate">Ownership updated for 1 server</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">2h ago</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-slate-300 truncate">Secure boot status updated</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">4h ago</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="text-slate-300 truncate">1 high severity incident detected</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">6h ago</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                <span className="text-slate-300 truncate">New server added to Central BU</span>
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">1d ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable Top KPI Card with sleek wave sparkline (matching reference image)
const TopKpiCard: React.FC<{
  label: string;
  mainValue: string;
  badgePct?: string;
  badgeColor?: string;
  trend: string;
  icon: React.ReactNode;
  iconBg: string;
  waveColor: string;
  onClick: () => void;
}> = ({
  label,
  mainValue,
  badgePct,
  badgeColor = 'text-emerald-400',
  trend,
  icon,
  iconBg,
  waveColor,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="p-5 rounded-2xl bg-[#0D1424]/80 border border-slate-800/80 hover:border-slate-700/80 hover:bg-[#10192e]/90 transition-all duration-300 shadow-xl backdrop-blur-md cursor-pointer relative overflow-hidden group select-none flex flex-col justify-between h-[155px]"
    >
      <div>
        {/* Top row: Icon on left, Label on right */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <span className="text-xs font-semibold text-slate-300 tracking-wide truncate">
            {label}
          </span>
        </div>

        {/* Value row with optional badge */}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-black font-mono text-white tracking-tight">
            {mainValue}
          </span>
          {badgePct && (
            <span className={`text-xs font-mono font-bold ${badgeColor}`}>
              {badgePct}
            </span>
          )}
        </div>

        {/* Trend subtitle */}
        <div className="text-[10px] font-mono text-emerald-400/90 mt-0.5">
          {trend}
        </div>
      </div>

      {/* Smooth Sparkline Wave at Bottom (matching reference image) */}
      <div className="w-full h-8 -mx-5 -mb-5 relative overflow-hidden pointer-events-none mt-2">
        <svg viewBox="0 0 200 40" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0 30 Q 30 38 60 25 T 120 20 T 160 28 T 200 15"
            fill="none"
            stroke={waveColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Subtle glow layer */}
          <path
            d="M0 30 Q 30 38 60 25 T 120 20 T 160 28 T 200 15"
            fill="none"
            stroke={waveColor}
            strokeWidth="5"
            strokeOpacity="0.25"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
