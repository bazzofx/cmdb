import { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/layout/Navbar.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { GlobalSearch } from './components/common/GlobalSearch.js';
import { ServerDetailDrawer } from './components/common/ServerDetailDrawer.js';

// Views
import { OverviewView } from './components/views/OverviewView.js';
import { InventoryView } from './components/views/InventoryView.js';
import { BusinessUnitsView } from './components/views/BusinessUnitsView.js';
import { ProductsView } from './components/views/ProductsView.js';
import { OwnershipExplorerView } from './components/views/OwnershipExplorerView.js';
import { InfrastructureMapView } from './components/views/InfrastructureMapView.js';
import { IncidentTriageView } from './components/views/IncidentTriageView.js';
import { ArchivedIncidentsView } from './components/views/ArchivedIncidentsView.js';
import { CommunicationsView } from './components/views/CommunicationsView.js';
import { ReportsView } from './components/views/ReportsView.js';
import { DataManagementView } from './components/views/DataManagementView.js';
import { SettingsAuditView } from './components/views/SettingsAuditView.js';

import { api } from './services/api.js';
import type { DashboardMetrics, AuditLogEvent, Incident } from './types/index.js';

export function App() {
  const [currentView, setCurrentView] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Global search modal state
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Server detail drawer state
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  // Cross-view state transfer
  const [inventoryFilters, setInventoryFilters] = useState<Record<string, string>>({});
  const [targetedServerIds, setTargetedServerIds] = useState<string[]>([]);

  // Telemetry & metrics state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEvent[]>([]);
  const [activeIncidentCount, setActiveIncidentCount] = useState<number>(0);
  const [archivedIncidentCount, setArchivedIncidentCount] = useState<number>(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const mainRef = useRef<HTMLElement>(null);

  // Global Keyboard shortcuts: '/' or 'Cmd+K' / 'Ctrl+K' opens search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const [stats, logs, incidents] = await Promise.all([
        api.getStats(),
        api.getAuditLogs(),
        api.getIncidents().catch(() => [] as Incident[]),
      ]);
      setMetrics(stats);
      setRecentLogs(logs);

      let active = 0;
      let archived = 0;
      for (const incident of incidents ?? []) {
        if (incident.status === 'Closed' || incident.status === 'Archived') archived += 1;
        else active += 1;
      }
      setActiveIncidentCount(active);
      setArchivedIncidentCount(archived);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const handleSelectServer = useCallback((id: string) => setSelectedServerId(id), []);

  // Navigation router helper with filter arguments
  const handleNavigate = useCallback((view: string, filterParams?: Record<string, string>) => {
    if (filterParams !== undefined) {
      setInventoryFilters(filterParams);
    }
    setCurrentView(view);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Launch Incident with Server IDs
  const handleOpenIncidentWithServers = (serverIds: string[]) => {
    setTargetedServerIds(serverIds);
    setCurrentView('incident-triage');
  };

  // Launch Communications with Server IDs
  const handleOpenCommunicationsWithServers = (serverIds: string[]) => {
    setTargetedServerIds(serverIds);
    setCurrentView('communications');
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-white">
      {/* 1. Global Navbar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onNavigate={handleNavigate}
        serverCount={metrics?.total_servers ?? 0}
        openIncidentsCount={activeIncidentCount}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 2. Collapsible Left-hand Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          metrics={{
            serverCount: metrics?.total_servers || 0,
            buCount: metrics?.total_business_units || 0,
            productCount: metrics?.total_products ?? 0,
            incidentCount: activeIncidentCount,
            archivedIncidentCount: archivedIncidentCount,
          }}
        />

        {/* 3. Main Workspace Area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#070B14]">
          {currentView === 'overview' && (
            <OverviewView
              metrics={metrics}
              recentLogs={recentLogs}
              loading={loadingMetrics}
              onNavigate={handleNavigate}
              onSelectServer={handleSelectServer}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView
              initialFilters={inventoryFilters}
              onFiltersChange={setInventoryFilters}
              onClearFilters={() => setInventoryFilters({})}
              onSelectServer={handleSelectServer}
              onOpenIncidentWithServers={handleOpenIncidentWithServers}
              onOpenCommunicationsWithServers={handleOpenCommunicationsWithServers}
            />
          )}

          {currentView === 'business-units' && (
            <BusinessUnitsView
              onSelectServer={handleSelectServer}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
            />
          )}

          {currentView === 'products' && (
            <ProductsView
              onSelectServer={handleSelectServer}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
              onOpenIncidentWithServers={handleOpenIncidentWithServers}
            />
          )}

          {currentView === 'ownership-explorer' && (
            <OwnershipExplorerView
              onSelectServer={handleSelectServer}
            />
          )}

          {currentView === 'infrastructure-map' && (
            <InfrastructureMapView
              onSelectServer={handleSelectServer}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
            />
          )}

          {currentView === 'incident-triage' && (
            <IncidentTriageView
              initialServerIds={targetedServerIds}
              onSelectServer={handleSelectServer}
              onNavigateToArchive={() => setCurrentView('archived-incidents')}
              onRefreshIncidents={loadDashboardData}
            />
          )}

          {currentView === 'archived-incidents' && (
            <ArchivedIncidentsView
              onSelectServer={handleSelectServer}
              onNavigateToActiveIncidents={() => setCurrentView('incident-triage')}
              onRefreshIncidents={loadDashboardData}
            />
          )}

          {currentView === 'communications' && (
            <CommunicationsView
              initialServerIds={targetedServerIds}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              onSelectServer={handleSelectServer}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
            />
          )}

          {currentView === 'data-management' && (
            <DataManagementView
              onRefreshData={loadDashboardData}
            />
          )}

          {currentView === 'settings' && (
            <SettingsAuditView />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectServer={handleSelectServer}
      />

      {/* Server Detail Drawer */}
      <ServerDetailDrawer
        serverId={selectedServerId}
        onClose={() => setSelectedServerId(null)}
        onNavigateServer={id => setSelectedServerId(id)}
        onAddToIncident={server => handleOpenIncidentWithServers([server.id])}
      />
    </div>
  );
}

export default App;
