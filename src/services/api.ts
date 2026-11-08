import type {
  ServerRecord,
  Incident,
  IncidentImpact,
  IncidentHostDetail,
  PatchCampaign,
  AuditLogEvent,
  ImportHistoryItem,
  DashboardMetrics,
  ProductSummary,
  AuthUser,
  UserRole,
} from '../types/index.js';

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// One request helper for the whole client. Before this, 31 of 34 calls carried
// an identical `if (!res.ok) throw new Error(...)` block.
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Fallback message when the server does not return `{ error }`. */
  failure: string;
}

async function request<T>(
  path: string,
  options: RequestOptions,
  base: string = API_BASE
): Promise<T> {
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'same-origin' };
  if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${base}${path}`, init);
  if (response.status === 401 && base === API_BASE && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || options.failure);
  }
  return response.json() as Promise<T>;
}

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.append(key, String(value));
  }
  return search.toString();
};

// ---------------------------------------------------------------------------
// Response shapes reused by views
// ---------------------------------------------------------------------------

export interface ServerListResponse {
  items: ServerRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ServerDetailResponse {
  server: ServerRecord;
  relationships: {
    same_hypervisor_vms: { id: string; vm: string; ip: string; bu: string }[];
    same_network_servers: { id: string; host: string; vm: string; ip: string; bu: string }[];
    same_manager_servers: { id: string; host: string; vm: string; ip: string; bu: string }[];
  };
  history: AuditLogEvent[];
}

export interface BusinessUnitSummary {
  name: string;
  organisation_short_code: string;
  organisation_abbreviated: string;
  customer: string;
  total_servers: number;
  powered_on_servers: number;
  sub_business_units_count: number;
  sub_business_units: string[];
  managers_count: number;
  managers: string[];
  support_teams_count: number;
  support_teams: string[];
  datacenters_count: number;
  datacenters: string[];
}

export interface BusinessUnitDetail {
  name: string;
  total_servers: number;
  powered_on_servers: number;
  sub_business_units: string[];
  products: string[];
  functions: string[];
  environments: string[];
  datacenters: string[];
  support_teams: string[];
  networks: string[];
  managers: { name: string; email: string; server_count: number }[];
  servers: ServerRecord[];
}

export interface CommunicationsPreview {
  total_contacts: number;
  valid_emails: number;
  missing_emails: number;
  contacts: Array<{
    id: string;
    business_unit: string;
    sub_business_unit?: string;
    manager: string;
    email: string;
    server_count: number;
    support_team: string;
    missing_email?: boolean;
    servers?: Array<{ host: string; vm: string; ip: string; bu: string }>;
  }>;
  preview_contact_id?: string;
  preview: { subject: string; body: string };
}

export interface ImportPreview {
  total_rows: number;
  detected_columns: string[];
  suggested_mapping: Record<string, string>;
  preview: Record<string, unknown>[];
}

export interface AddIncidentServersResult {
  incident: Incident;
  total_affected: number;
  matched_count: number;
  unmatched_count: number;
  matched_servers: ServerRecord[];
  unmatched_entries: string[];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export const api = {
  // Authentication
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>(
      '/auth/login',
      { method: 'POST', body: { email, password }, failure: 'Sign-in failed' },
      ''
    ),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST', failure: 'Sign-out failed' }, ''),

  getMe: () => request<{ user: AuthUser }>('/me', { failure: 'Not signed in' }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ success: boolean }>('/me/password', {
      method: 'POST',
      body: { current_password, new_password },
      failure: 'Failed to change password',
    }),

  getUsers: (all = false) =>
    request<AuthUser[]>(`/users${all ? '?all=1' : ''}`, { failure: 'Failed to fetch users' }),

  createUser: (data: { email: string; name: string; role: UserRole; password: string }) =>
    request<AuthUser>('/users', { method: 'POST', body: data, failure: 'Failed to create user' }),

  updateUser: (id: string, data: { name?: string; role?: UserRole; active?: boolean }) =>
    request<AuthUser>(`/users/${id}`, { method: 'PATCH', body: data, failure: 'Failed to update user' }),

  resetUserPassword: (id: string, password: string) =>
    request<{ success: boolean }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: { password },
      failure: 'Failed to reset password',
    }),

  // Stats
  getStats: () => request<DashboardMetrics>('/stats', { failure: 'Failed to fetch stats' }),

  // Products (4_Product) — unparameterised aggregation
  getProducts: () => request<ProductSummary[]>('/products', { failure: 'Failed to fetch products' }),

  // Servers
  getServers: (params: Record<string, string | number | undefined> = {}) =>
    request<ServerListResponse>(`/servers?${query(params)}`, { failure: 'Failed to fetch servers' }),

  getServer: (id: string) =>
    request<ServerDetailResponse>(`/servers/${id}`, { failure: 'Failed to fetch server details' }),

  searchServers: async (q: string): Promise<ServerRecord[]> => {
    if (!q.trim()) return [];
    try {
      return await request<ServerRecord[]>(`/servers/search?q=${encodeURIComponent(q)}`, {
        failure: 'Search failed',
      });
    } catch {
      return [];
    }
  },

  // Business units
  getBusinessUnits: () =>
    request<BusinessUnitSummary[]>('/business-units', { failure: 'Failed to fetch business units' }),

  getBusinessUnitDetail: (name: string) =>
    request<BusinessUnitDetail>(`/business-units/${encodeURIComponent(name)}`, {
      failure: 'Failed to fetch business unit detail',
    }),

  // Incidents
  getIncidents: () => request<Incident[]>('/incidents', { failure: 'Failed to fetch incidents' }),

  createIncident: (data: Partial<Incident> & { raw_input?: string }) =>
    request<Incident>('/incidents', { method: 'POST', body: data, failure: 'Failed to create incident' }),

  updateIncident: (id: string, data: Partial<Incident>) =>
    request<Incident>(`/incidents/${id}`, {
      method: 'PUT',
      body: data,
      failure: 'Failed to update incident',
    }),

  updateIncidentHostDetail: (
    incidentId: string,
    serverId: string,
    data: Partial<IncidentHostDetail>
  ) =>
    request<IncidentHostDetail>(`/incidents/${incidentId}/hosts/${serverId}`, {
      method: 'PUT',
      body: data,
      failure: 'Failed to update incident host detail',
    }),

  addIncidentServers: (id: string, payload: { raw_input?: string; server_ids?: string[] }) =>
    request<AddIncidentServersResult>(`/incidents/${id}/servers`, {
      method: 'POST',
      body: payload,
      failure: 'Failed to add incident servers',
    }),

  getIncidentImpact: (id: string) =>
    request<IncidentImpact>(`/incidents/${id}/impact`, {
      failure: 'Failed to calculate incident impact',
    }),

  removeIncidentServer: (incidentId: string, serverId: string) =>
    request<{ success: boolean; remaining: number }>(
      `/incidents/${incidentId}/servers/${serverId}`,
      { method: 'DELETE', failure: 'Failed to remove server from incident' }
    ),

  // Patching
  getPatchCampaigns: () =>
    request<PatchCampaign[]>('/patching/campaigns', { failure: 'Failed to fetch patch campaigns' }),

  // Communications
  previewCommunications: (payload: {
    server_ids?: string[];
    template_type?: string;
    incident_reference?: string;
    incident_title?: string;
    severity?: string;
    target_date?: string;
    contact_id?: string;
  }) =>
    request<CommunicationsPreview>('/communications/preview', {
      method: 'POST',
      body: payload,
      failure: 'Failed to generate communications preview',
    }),

  // Imports
  previewImport: (csv_content: string) =>
    request<ImportPreview>('/imports/preview', {
      method: 'POST',
      body: { csv_content },
      failure: 'Failed to preview CSV',
    }),

  executeImport: (payload: {
    csv_content: string;
    filename?: string;
    strategy: 'insert' | 'update' | 'synchronise';
    user?: string;
  }) =>
    request<{ summary: ImportHistoryItem; total_in_database: number }>('/imports/execute', {
      method: 'POST',
      body: payload,
      failure: 'Failed to execute import',
    }),

  getImportHistory: () =>
    request<ImportHistoryItem[]>('/imports/history', { failure: 'Failed to fetch import history' }),

  // Audit logs
  getAuditLogs: () =>
    request<AuditLogEvent[]>('/audit-logs', { failure: 'Failed to fetch audit logs' }),

  // Reset demo seed
  resetDatabase: () =>
    request<{ success: boolean; count: number }>('/seed/reset', {
      method: 'POST',
      failure: 'Failed to reset database',
    }),
};
