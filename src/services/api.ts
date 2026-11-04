import type {
  ServerRecord,
  Incident,
  IncidentImpact,
  PatchCampaign,
  PatchTarget,
  AuditLogEvent,
  ImportHistoryItem,
  DashboardMetrics,
  ProductSummary,
} from '../types/index.js';

const API_BASE = '/api';

export const api = {
  // Stats
  async getStats(): Promise<DashboardMetrics> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // Products (4_Product)
  async getProducts(): Promise<ProductSummary[]> {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  // Servers
  async getServers(params: Record<string, string | number | undefined> = {}): Promise<{
    items: ServerRecord[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, String(v));
    });
    const res = await fetch(`${API_BASE}/servers?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch servers');
    return res.json();
  },

  async getServer(id: string): Promise<{
    server: ServerRecord;
    relationships: {
      same_hypervisor_vms: { id: string; vm: string; ip: string; bu: string }[];
      same_network_servers: { id: string; host: string; vm: string; ip: string; bu: string }[];
      same_manager_servers: { id: string; host: string; vm: string; bu: string }[];
    };
    history: AuditLogEvent[];
  }> {
    const res = await fetch(`${API_BASE}/servers/${id}`);
    if (!res.ok) throw new Error('Failed to fetch server details');
    return res.json();
  },

  async createServer(data: Partial<ServerRecord>): Promise<ServerRecord> {
    const res = await fetch(`${API_BASE}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create server');
    return res.json();
  },

  async updateServer(id: string, data: Partial<ServerRecord>): Promise<ServerRecord> {
    const res = await fetch(`${API_BASE}/servers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update server');
    return res.json();
  },

  async deleteServer(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/servers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete server');
    return res.json();
  },

  // Search
  async searchServers(q: string): Promise<any[]> {
    if (!q.trim()) return [];
    const res = await fetch(`${API_BASE}/servers/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return res.json();
  },

  // Business Units
  async getBusinessUnits(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/business-units`);
    if (!res.ok) throw new Error('Failed to fetch business units');
    return res.json();
  },

  async getBusinessUnitDetail(name: string): Promise<any> {
    const res = await fetch(`${API_BASE}/business-units/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error('Failed to fetch business unit detail');
    return res.json();
  },

  // Managers
  async getManagers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/managers`);
    if (!res.ok) throw new Error('Failed to fetch managers');
    return res.json();
  },

  async getManagerServers(name: string): Promise<ServerRecord[]> {
    const res = await fetch(`${API_BASE}/managers/${encodeURIComponent(name)}/servers`);
    if (!res.ok) throw new Error('Failed to fetch manager servers');
    return res.json();
  },

  // Networks
  async getNetworks(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/networks`);
    if (!res.ok) throw new Error('Failed to fetch networks');
    return res.json();
  },

  async getNetworkServers(name: string): Promise<ServerRecord[]> {
    const res = await fetch(`${API_BASE}/networks/${encodeURIComponent(name)}/servers`);
    if (!res.ok) throw new Error('Failed to fetch network servers');
    return res.json();
  },

  // Datacenters
  async getDatacenters(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/datacenters`);
    if (!res.ok) throw new Error('Failed to fetch datacenters');
    return res.json();
  },

  // Incidents
  async getIncidents(): Promise<Incident[]> {
    const res = await fetch(`${API_BASE}/incidents`);
    if (!res.ok) throw new Error('Failed to fetch incidents');
    return res.json();
  },

  async createIncident(data: Partial<Incident> & { raw_input?: string }): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create incident');
    return res.json();
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`);
    if (!res.ok) throw new Error('Failed to fetch incident');
    return res.json();
  },

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update incident');
    return res.json();
  },

  async updateIncidentHostDetail(incidentId: string, serverId: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/hosts/${serverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update incident host detail');
    return res.json();
  },

  async addIncidentServers(id: string, payload: { raw_input?: string; server_ids?: string[] }): Promise<{
    incident: Incident;
    total_affected: number;
    matched_count: number;
    unmatched_count: number;
    matched_servers: ServerRecord[];
    unmatched_entries: string[];
  }> {
    const res = await fetch(`${API_BASE}/incidents/${id}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to add incident servers');
    return res.json();
  },

  async getIncidentImpact(id: string): Promise<IncidentImpact> {
    const res = await fetch(`${API_BASE}/incidents/${id}/impact`);
    if (!res.ok) throw new Error('Failed to calculate incident impact');
    return res.json();
  },

  async updateIncidentHost(incidentId: string, serverId: string, data: Partial<{ status: string; patch_engineer: string; notes: string }>): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/hosts/${serverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update incident host status');
    return res.json();
  },

  async removeIncidentServer(incidentId: string, serverId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/incidents/${incidentId}/servers/${serverId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove server from incident');
    return res.json();
  },

  // Patching
  async getPatchCampaigns(): Promise<PatchCampaign[]> {
    const res = await fetch(`${API_BASE}/patching/campaigns`);
    if (!res.ok) throw new Error('Failed to fetch patch campaigns');
    return res.json();
  },

  async createPatchCampaign(data: Partial<PatchCampaign> & { server_ids?: string[] }): Promise<PatchCampaign> {
    const res = await fetch(`${API_BASE}/patching/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create patch campaign');
    return res.json();
  },

  async getPatchCampaignDetail(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/patching/campaigns/${id}`);
    if (!res.ok) throw new Error('Failed to fetch patch campaign detail');
    return res.json();
  },

  async updatePatchCampaignTarget(campaignId: string, serverId: string, data: Partial<PatchTarget>): Promise<any> {
    const res = await fetch(`${API_BASE}/patching/campaigns/${campaignId}/servers/${serverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update patch target');
    return res.json();
  },

  // Communications
  async previewCommunications(payload: {
    server_ids?: string[];
    template_type?: string;
    incident_reference?: string;
    incident_title?: string;
    severity?: string;
    target_date?: string;
  }): Promise<{
    total_contacts: number;
    valid_emails: number;
    missing_emails: number;
    contacts: any[];
    preview: { subject: string; body: string };
  }> {
    const res = await fetch(`${API_BASE}/communications/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to generate communications preview');
    return res.json();
  },

  // Imports
  async previewImport(csv_content: string): Promise<{
    total_rows: number;
    detected_columns: string[];
    suggested_mapping: Record<string, string>;
    preview: any[];
  }> {
    const res = await fetch(`${API_BASE}/imports/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to preview CSV');
    }
    return res.json();
  },

  async executeImport(payload: {
    csv_content: string;
    filename?: string;
    strategy: 'insert' | 'update' | 'synchronise';
    user?: string;
  }): Promise<{ summary: ImportHistoryItem; total_in_database: number }> {
    const res = await fetch(`${API_BASE}/imports/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute import');
    }
    return res.json();
  },

  async getImportHistory(): Promise<ImportHistoryItem[]> {
    const res = await fetch(`${API_BASE}/imports/history`);
    if (!res.ok) throw new Error('Failed to fetch import history');
    return res.json();
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLogEvent[]> {
    const res = await fetch(`${API_BASE}/audit-logs`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  // Reset demo seed
  async resetDatabase(): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/seed/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset database');
    return res.json();
  },
};
