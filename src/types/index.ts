// Types for CSM Server Ownership & Business Intelligence Dashboard

export type UserRole = 'viewer' | 'analyst' | 'manager' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active?: boolean;
  must_change_password?: boolean;
}

export interface ServerRecord {
  id: string;
  host: string;
  vm: string;
  support_team: string;
  support_team_lookup_csm?: string;
  team?: string;
  service?: string;
  initials?: string;
  total_servers_to_patch?: number | null;
  engineer_notes?: string;
  status?: string;
  swg_check?: string;
  source?: string;
  environment: string;
  manager: string;
  email: string;
  customer: string;
  power_state: 'poweredOn' | 'poweredOff' | 'suspended' | string;
  dns_name: string;
  primary_ip_address: string;
  efi_secure_boot: boolean | null; // true, false, null for unknown
  annotation: string;
  business_unit: string;
  business_unit_id?: string;
  sub_business_unit: string;
  sub_business_unit_id?: string;
  product: string;
  product_id?: string;
  function: string;
  business_environment: string; // from "6_Environmen"
  organisation_short_code: string;
  organisation_abbreviated: string;
  datacenter: string;
  datacenter_id?: string;
  network_1: string;
  network_2: string;
  network_3: string;
  imported_at: string;
  updated_at: string;
  source_record_hash?: string;
  is_missing_from_source?: boolean;
}

export interface BusinessUnit {
  id: string;
  name: string;
  organisation_short_code: string;
  organisation_abbreviated: string;
  customer: string;
  default_manager: string;
  default_email: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SubBusinessUnit {
  id: string;
  business_unit_id: string;
  business_unit_name: string;
  name: string;
  manager?: string;
  email?: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  business_unit_id?: string;
  business_unit_name?: string;
  description?: string;
}

export interface ProductOwner {
  name: string;
  email: string;
  server_count: number;
}

export interface ProductSummary {
  name: string;
  total_servers: number;
  powered_on: number;
  powered_off: number;
  primary_owner: string;
  product_owners: ProductOwner[];
  managers: string[];
  business_units: string[];
  customers: string[];
  functions: string[];
  environments: string[];
  datacenters: string[];
  server_ids: string[];
  servers?: Array<{
    id: string;
    host: string;
    vm: string;
    ip: string;
    bu: string;
    manager: string;
    email: string;
    function: string;
    power_state: string;
  }>;
}

export interface Datacenter {
  id: string;
  name: string;
  location?: string;
  description?: string;
}

export interface Network {
  id: string;
  network_name: string;
  network_type?: string;
  description?: string;
  server_count?: number;
}

export interface Contact {
  id: string;
  full_name: string;
  email: string;
  organisation?: string;
  business_unit?: string;
  sub_business_unit?: string;
  role: 'business_owner' | 'technical_owner' | 'support_team' | 'service_manager' | 'escalation_contact' | 'manager';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type TriageHostStatus =
  | 'To be contacted'
  | 'Contacted'
  | 'Patching'
  | 'Patched'
  | 'Patch'
  | 'Not Affected'
  | 'Uninstalled'
  | 'Isolated';

export type ServerPatchingStatus =
  | 'Not Started'
  | 'In progress'
  | 'Patched'
  | 'Validation required'
  | 'Validated'
  | 'Exception';

export interface IncidentHostDetail {
  server_id: string;
  status: TriageHostStatus;
  patch_engineer?: string;
  patching_status?: ServerPatchingStatus;
  patching_date?: string;
  ticket_number?: string;
  notes?: string;
  communicated?: boolean;
  communication_date?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface Incident {
  id: string;
  incident_reference: string;
  incident_title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  date_detected: string;
  detection_source: string;
  ioc_or_vulnerability: string;
  status: 'Open' | 'Investigating' | 'Contained' | 'Remediated' | 'Closed' | 'Archived';
  assigned_engineer: string;
  affected_server_ids: string[];
  host_details?: Record<string, IncidentHostDetail>;
  closed_at?: string;
  closed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentImpact {
  incident_id: string;
  total_affected_servers: number;
  unique_business_units: string[];
  unique_sub_business_units: string[];
  unique_managers: { name: string; email: string; server_count: number }[];
  unique_emails: string[];
  unique_support_teams: string[];
  unique_datacenters: string[];
  unique_hypervisors: string[];
  unique_networks: string[];
  affected_servers: ServerRecord[];
  correlation_leads: {
    type: 'hypervisor' | 'network' | 'business_unit' | 'manager' | 'datacenter';
    name: string;
    description: string;
    server_count: number;
    servers: { id: string; host: string; vm: string; ip: string }[];
  }[];
}

export type PatchStatus =
  | 'Not assessed'
  | 'Affected'
  | 'Not affected'
  | 'Patch available'
  | 'Scheduled'
  | 'In progress'
  | 'Patched'
  | 'Validation required'
  | 'Validated'
  | 'Exception granted';

export interface PatchTarget {
  server_id: string;
  status: PatchStatus;
  notes: string;
  scheduled_date?: string;
  patched_at?: string;
  validated_at?: string;
}

export interface PatchCampaign {
  id: string;
  campaign_name: string;
  cve_identifier: string;
  patch_reference: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  start_date: string;
  target_completion_date: string;
  status: 'Draft' | 'Active' | 'Under Review' | 'Completed' | 'Archived';
  assigned_engineer: string;
  targets: Record<string, PatchTarget>; // server_id -> PatchTarget
  created_at: string;
  updated_at: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_value?: any;
  new_value?: any;
  details?: string;
  actor_role?: UserRole;
  outcome?: 'success' | 'failure';
  ip?: string;
  user_agent?: string;
}

export interface ImportHistoryItem {
  id: string;
  filename: string;
  import_date: string;
  user: string;
  strategy: 'insert' | 'update' | 'synchronise';
  total_records: number;
  new_records: number;
  updated_records: number;
  unchanged_records: number;
  duplicate_records: number;
  failed_records: number;
  status: 'Completed' | 'Completed with warnings' | 'Failed';
  errors?: { row: number; field: string; message: string; raw_data: any }[];
}

export interface DashboardMetrics {
  total_servers: number;
  powered_on_servers: number;
  powered_off_servers: number;
  total_business_units: number;
  total_sub_business_units: number;
  total_support_teams: number;
  total_datacenters: number;
  total_unique_managers: number;
  servers_missing_ownership: number;
  servers_missing_contact: number;
  servers_without_secure_boot: number;
  servers_incomplete_metadata: number;
  total_products?: number;
  // Chart breakdowns
  servers_by_business_unit: { name: string; count: number }[];
  servers_by_product?: { name: string; count: number }[];
  servers_by_environment: { name: string; count: number }[];
  servers_by_datacenter: { name: string; count: number }[];
  servers_by_support_team: { name: string; count: number }[];
  servers_by_swg_check?: { name: string; count: number }[];
  servers_by_power_state: { name: string; count: number }[];
  secure_boot_status: { name: string; count: number }[];
  ownership_completeness: {
    fully_assigned: number;
    missing_manager: number;
    missing_email: number;
    missing_business_unit: number;
    missing_support_team: number;
  };
}
