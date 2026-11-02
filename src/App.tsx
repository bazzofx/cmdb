import React, { useState, useEffect } from 'react';
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
import { CommunicationsView } from './components/views/CommunicationsView.js';
import { ReportsView } from './components/views/ReportsView.js';
import { DataManagementView } from './components/views/DataManagementView.js';
import { SettingsAuditView } from './components/views/SettingsAuditView.js';

import { api } from './services/api.js';
import type { DashboardMetrics, AuditLogEvent, ServerRecord } from './types/index.js';

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
  const [loadingMetrics, setLoadingMetrics] = useState(true);

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

  const loadDashboardData = async () => {
    setLoadingMetrics(true);
    try {
      const stats = await api.getStats();
      setMetrics(stats);
      const logs = await api.getAuditLogs();
      setRecentLogs(logs);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Navigation router helper with filter arguments
  const handleNavigate = (view: string, filterParams: Record<string, string> = {}) => {
    if (Object.keys(filterParams).length > 0) {
      setInventoryFilters(filterParams);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    <div className="min-h-screen bg-[#0B1020] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-white">
      {/* 1. Global Navbar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onNavigate={handleNavigate}
        serverCount={metrics?.total_servers || 0}
        openIncidentsCount={1}
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
            productCount: 3,
            incidentCount: 1,
          }}
        />

        {/* 3. Main Workspace Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0B1020]">
          {currentView === 'overview' && (
            <OverviewView
              metrics={metrics}
              recentLogs={recentLogs}
              loading={loadingMetrics}
              onNavigate={handleNavigate}
              onSelectServer={id => setSelectedServerId(id)}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView
              initialFilters={inventoryFilters}
              onSelectServer={id => setSelectedServerId(id)}
              onOpenIncidentWithServers={handleOpenIncidentWithServers}
              onOpenCommunicationsWithServers={handleOpenCommunicationsWithServers}
            />
          )}

          {currentView === 'business-units' && (
            <BusinessUnitsView
              onSelectServer={id => setSelectedServerId(id)}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
            />
          )}

          {currentView === 'products' && (
            <ProductsView
              onSelectServer={id => setSelectedServerId(id)}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
              onOpenIncidentWithServers={handleOpenIncidentWithServers}
            />
          )}

          {currentView === 'ownership-explorer' && (
            <OwnershipExplorerView
              onSelectServer={id => setSelectedServerId(id)}
            />
          )}

          {currentView === 'infrastructure-map' && (
            <InfrastructureMapView
              onSelectServer={id => setSelectedServerId(id)}
              onFilterInventory={filters => handleNavigate('inventory', filters)}
            />
          )}

          {currentView === 'incident-triage' && (
            <IncidentTriageView
              initialServerIds={targetedServerIds}
              onSelectServer={id => setSelectedServerId(id)}
              onOpenCommunications={handleOpenCommunicationsWithServers}
            />
          )}

          {currentView === 'communications' && (
            <CommunicationsView
              initialServerIds={targetedServerIds}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              onSelectServer={id => setSelectedServerId(id)}
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
        onSelectServer={id => setSelectedServerId(id)}
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
