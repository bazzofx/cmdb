import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type {
  ServerRecord,
  BusinessUnit,
  SubBusinessUnit,
  Product,
  Datacenter,
  Network,
  Incident,
  IncidentImpact,
  PatchCampaign,
  PatchTarget,
  AuditLogEvent,
  ImportHistoryItem,
  DashboardMetrics,
} from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'csm_database.json');
const CSV_SOURCE_FILE = path.resolve(__dirname, 'public/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv');

interface DatabaseSchema {
  servers: ServerRecord[];
  incidents: Incident[];
  patch_campaigns: PatchCampaign[];
  audit_logs: AuditLogEvent[];
  import_history: ImportHistoryItem[];
}

// In-memory persistent database instance
class Database {
  data: DatabaseSchema = {
    servers: [],
    incidents: [],
    patch_campaigns: [],
    audit_logs: [],
    import_history: [],
  };

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        console.log(`[DB] Loaded ${this.data.servers.length} servers from ${DB_FILE}`);
      } catch (err) {
        console.error('[DB] Error loading database file, re-seeding...', err);
        this.seedFromDefaultCsv();
      }
    } else {
      console.log('[DB] Database file not found. Seeding initial data from CSV...');
      this.seedFromDefaultCsv();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to save database:', err);
    }
  }

  logAudit(user: string, action: string, entity_type: string, entity_id: string, prev?: any, next?: any, details?: string) {
    const event: AuditLogEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: user || 'SecOps Admin',
      action,
      entity_type,
      entity_id,
      previous_value: prev,
      new_value: next,
      details,
    };
    this.data.audit_logs.unshift(event);
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
  }

  seedFromDefaultCsv() {
    let csvContent = '';
    if (fs.existsSync(CSV_SOURCE_FILE)) {
      csvContent = fs.readFileSync(CSV_SOURCE_FILE, 'utf-8');
    } else {
      // Fallback CSV text exactly matching supplied prompt
      csvContent = `Host,VM,Support Team,Environment,Manager,Email,Customer,PowerState,DNS Name,Primary IP Address,EFI Secure boot,Annotation,1_BusinessUnit,2_SubBusinessUnit,4_Product,5_Function,6_Environmen,7_OrganisationShortCode,8_OrganisationAbbreviated,Datacenter,Network #1,Network #2,Network #3
br1-sse-esx-02.prd.local,br1-VM-SSS-1,UK,SSE,Mr Mine,mr.mime@pokemon.com,Central,poweredOn,ADC-BUILD-VM,172.29.100.115,TRUE,,CENTRAL,CST,Pulse VTM,TBA,,NECSWS,Central,UK1-SSE-DC1,WEB-DEPLOY-NET,CORP-DMZ-NET,
br1-sse-esx-23.prd.local,br2-VM-SSS-2,UK,SPSE,John Lennon,John.Lennon@acme.com,BRICK,poweredOn,ah-p-dc01.ahnecsws.internal,10.200.68.91,TRUE,,Macs,Housing,NDM,Domain Controler,,BRK,BRICK,UK1-SSE-DC1,DC2-PROD-VLAN-4721,OPS-USER-ADMIN-ISOLATED,
br1-sse-esx-23.prd.local,br1-VM-SSS-3,UK,SPSE,John Lennon,John.Lennon@acme.com,BRICK,poweredOn,AH-PRD-V-AD01.ANCH.CORP.ROOT.LOCAL,10.200.68.76,FALSE,,Macs,Housing,Housing,Active Directory,,BRK,BRICK,UK1-SSE-DC1,ADMIN-OPS-ISOLATED,LON-DC3-PROD-5824,
br1-sse-esx-23.prd.local,br2-VM-SSS-4,UK,SPSE,John Lennon,John.Lennon@acme.com,BRICK,poweredOn,AH-PRD-V-AD02.ANCH.CORP.ROOT.LOCAL,10.200.68.77,FALSE,,Macs,Housing,Housing,Active Directory,,BRK,BRICK,UK1-SSE-DC1,ADMIN-OPS-ISOLATED,LON-DC3-PROD-5824,
br1-sse-esx-04.prd.local,br1-VM-SSS-5,UK,SPSE,Leticia Camargo,Leticia.Camargo@month.com,Laggon,poweredOn,AH-PRD-V-IS01.ANCH.CORP.ROOT.LOCAL,152.114.118.226,TRUE,,KFC,Kitched,NDM,TBA,,LG,Laggon,UK1-SSE-DC1,DC2-GUEST-MGMT,LON-DC3-PROD-5824,
br1-sse-esx-23.prd.local,br1-VM-SSS-6,UK,SPSE,Leticia Camargo,Leticia.Camargo@month.com,Laggon,poweredOn,AH-PREP-ENT01.ANCH.CORP.ROOT.LOCAL,10.200.68.82,TRUE,Build in progress - RW,Local Government,Housing,NDM,Enterprise Server,,LG,Brich Stone,UK1-SSE-DC1,MGMT-MONITOR-NET,LON-DC3-PROD-5824,SECURE-BACKUP-NET
br1-sse-esx-05.prd.local,br2-VM-SSS-7,UK,SPSE,Louver Call,Louver.call@humming.com,Brich Stone,poweredOn,AH-P-SQL01.ahnecsws.internal,152.114.120.6,TRUE,,Local Government,Housing,NDM,Database Server,,BS,Brich Stone,UK1-SSE-DC1,DC2-PROD-VLAN-4721,OPS-USER-ADMIN-ISOLATED,SECURE-BACKUP-NET
br1-sse-esx-06.prd.local,br1-VM-SSS-8,UK,SPSE,Louver Call,Louver.call@humming.com,Brich Stone,poweredOn,AH-T-ENT01.ahnecsws.internal,152.114.114.216,TRUE,,Local Government,Housing,NDM,NDM Application Server,,BS,,UK1-SSE-DC1,DC2-PROD-VLAN-4721,OPS-USER-ADMIN-ISOLATED,
br1-sse-esx-09.prd.local,br1-VM-SSS-9,UK,SPSE,Louver Call,Louver.call@humming.com,Ameriton,poweredOn,ANCH-VM-APP01,152.114.115.230,FALSE,,Local Government,Housing,Housing,ORDS Server,,AMT,Ameriton,UK1-SSE-DC1,ADMIN-OPS-ISOLATED,LON-DC3-PROD-5824,`;
    }

    const parsed = parseCsvToServers(csvContent);
    this.data.servers = parsed;

    // Seed sample incident & patch campaign for immediate realistic SOC demonstration
    const sampleIncidentId = crypto.randomUUID();
    const affectedServers = this.data.servers.slice(1, 4).map(s => s.id); // br1-sse-esx-23.prd.local hosts
    
    const initialHostDetails: Record<string, any> = {};
    affectedServers.forEach((sid, idx) => {
      initialHostDetails[sid] = {
        server_id: sid,
        status: idx === 0 ? 'Patching' : idx === 1 ? 'To be contacted' : 'Isolated',
        patch_engineer: idx === 0 ? 'David Vance' : idx === 1 ? 'Sarah Jenkins' : 'Alex Mercer',
        notes: idx === 0 ? 'Patch staging underway on hypervisor slice.' : idx === 1 ? 'Awaiting response from John Lennon regarding outage window.' : 'Temporarily isolated from network segment pending review.',
        updated_at: new Date().toISOString(),
      };
    });

    this.data.incidents = [
      {
        id: sampleIncidentId,
        incident_reference: 'INC-2026-0842',
        incident_title: 'Active Directory Kerberos Elevation Vulnerability (CVE-2026-3021)',
        description: 'Investigation into unpatched domain controllers and hypervisors with secure boot disabled under BRICK/Macs and Local Government.',
        severity: 'Critical',
        date_detected: new Date(Date.now() - 86400000 * 2).toISOString(),
        detection_source: 'Vulnerability Scanner / SIEM Alert',
        ioc_or_vulnerability: 'CVE-2026-3021',
        status: 'Investigating',
        assigned_engineer: 'Sarah Jenkins (Senior SecOps)',
        affected_server_ids: affectedServers,
        host_details: initialHostDetails,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const patchCampaignId = crypto.randomUUID();
    const targets: Record<string, PatchTarget> = {};
    this.data.servers.forEach((s, idx) => {
      if (idx < 5) {
        targets[s.id] = {
          server_id: s.id,
          status: idx === 0 ? 'Patched' : idx === 1 ? 'In progress' : idx === 2 ? 'Affected' : 'Scheduled',
          notes: idx === 0 ? 'Applied firmware and ESX update' : 'Awaiting maintenance window with business unit manager',
          scheduled_date: '2026-11-05',
          patched_at: idx === 0 ? new Date().toISOString() : undefined,
        };
      }
    });

    this.data.patch_campaigns = [
      {
        id: patchCampaignId,
        campaign_name: 'Q4 2026 Hypervisor & DC Security Hardening',
        cve_identifier: 'CVE-2026-1944 / MS-PATCH-Q4',
        patch_reference: 'KB-8899201',
        description: 'Mandatory kernel patching and EFI secure boot compliance across UK1-SSE-DC1 infrastructure.',
        severity: 'High',
        start_date: '2026-10-15',
        target_completion_date: '2026-11-20',
        status: 'Active',
        assigned_engineer: 'David Vance (Infra Sec)',
        targets,
        created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    this.data.audit_logs = [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user: 'System Provisioner',
        action: 'INITIAL_IMPORT',
        entity_type: 'INVENTORY',
        entity_id: 'ALL',
        details: `Imported initial inventory of ${this.data.servers.length} server records from CSM dataset`,
      },
    ];

    this.data.import_history = [
      {
        id: crypto.randomUUID(),
        filename: 'MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv',
        import_date: new Date().toISOString(),
        user: 'System Provisioner',
        strategy: 'insert',
        total_records: this.data.servers.length,
        new_records: this.data.servers.length,
        updated_records: 0,
        unchanged_records: 0,
        duplicate_records: 0,
        failed_records: 0,
        status: 'Completed',
      },
    ];

    this.save();
    console.log(`[DB] Seeded ${this.data.servers.length} server records.`);
  }
}

export const db = new Database();
db.init();

// CSV Parser Helper with support for quoted strings and clean mapping
export function parseCsvToServers(csvText: string): ServerRecord[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header line respecting commas inside quotes if any
  const headers = parseCsvLine(lines[0]);
  const headerMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerMap[h.trim()] = idx;
  });

  const getCol = (cols: string[], name: string): string => {
    const idx = headerMap[name];
    if (idx !== undefined && cols[idx] !== undefined) {
      return cols[idx].trim();
    }
    return '';
  };

  const records: ServerRecord[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0 || cols.every(c => c.trim() === '')) continue;

    const host = getCol(cols, 'Host');
    const vm = getCol(cols, 'VM');
    const secureBootRaw = getCol(cols, 'EFI Secure boot').toUpperCase();
    let efi_secure_boot: boolean | null = null;
    if (secureBootRaw === 'TRUE') efi_secure_boot = true;
    else if (secureBootRaw === 'FALSE') efi_secure_boot = false;

    const email = getCol(cols, 'Email').toLowerCase();

    // Map source column "6_Environmen" or "business_environment"
    const businessEnv = getCol(cols, '6_Environmen') || getCol(cols, 'business_environment') || getCol(cols, 'Environment');

    const record: ServerRecord = {
      id: crypto.randomUUID(),
      host,
      vm,
      support_team: getCol(cols, 'Support Team'),
      environment: getCol(cols, 'Environment'),
      manager: getCol(cols, 'Manager'),
      email,
      customer: getCol(cols, 'Customer'),
      power_state: getCol(cols, 'PowerState') || 'poweredOn',
      dns_name: getCol(cols, 'DNS Name'),
      primary_ip_address: getCol(cols, 'Primary IP Address'),
      efi_secure_boot,
      annotation: getCol(cols, 'Annotation'),
      business_unit: getCol(cols, '1_BusinessUnit') || getCol(cols, 'business_unit'),
      sub_business_unit: getCol(cols, '2_SubBusinessUnit') || getCol(cols, 'sub_business_unit'),
      product: getCol(cols, '4_Product') || getCol(cols, 'product'),
      function: getCol(cols, '5_Function') || getCol(cols, 'function'),
      business_environment: businessEnv,
      organisation_short_code: getCol(cols, '7_OrganisationShortCode') || getCol(cols, 'organisation_short_code'),
      organisation_abbreviated: getCol(cols, '8_OrganisationAbbreviated') || getCol(cols, 'organisation_abbreviated'),
      datacenter: getCol(cols, 'Datacenter'),
      network_1: getCol(cols, 'Network #1') || getCol(cols, 'network_1'),
      network_2: getCol(cols, 'Network #2') || getCol(cols, 'network_2'),
      network_3: getCol(cols, 'Network #3') || getCol(cols, 'network_3'),
      imported_at: now,
      updated_at: now,
    };

    records.push(record);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// REST API SETUP
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Router
  const api = express.Router();

  // 1. STATS / DASHBOARD METRICS (dynamically calculated)
  api.get('/stats', (req: Request, res: Response) => {
    const servers = db.data.servers;
    const total = servers.length;
    const poweredOn = servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length;
    const poweredOff = total - poweredOn;

    const buSet = new Set(servers.map(s => s.business_unit).filter(Boolean));
    const subBuSet = new Set(servers.map(s => s.sub_business_unit).filter(Boolean));
    const productSet = new Set(servers.map(s => s.product).filter(Boolean));
    const supportTeamSet = new Set(servers.map(s => s.support_team).filter(Boolean));
    const dcSet = new Set(servers.map(s => s.datacenter).filter(Boolean));
    const managerSet = new Set(servers.map(s => s.manager).filter(Boolean));

    const missingOwnership = servers.filter(s => !s.manager || !s.business_unit).length;
    const missingContact = servers.filter(s => !s.email).length;
    const secureBootDisabled = servers.filter(s => s.efi_secure_boot === false).length;
    const incompleteMeta = servers.filter(
      s => !s.product || !s.function || !s.organisation_short_code || !s.sub_business_unit
    ).length;

    // Breakdown maps
    const countBy = (fn: (s: ServerRecord) => string) => {
      const counts: Record<string, number> = {};
      servers.forEach(s => {
        const key = fn(s) || 'Unassigned';
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts).map(([name, count]) => ({ name, count }));
    };

    const metrics: DashboardMetrics = {
      total_servers: total,
      powered_on_servers: poweredOn,
      powered_off_servers: poweredOff,
      total_products: productSet.size,
      total_business_units: buSet.size,
      total_sub_business_units: subBuSet.size,
      total_support_teams: supportTeamSet.size,
      total_datacenters: dcSet.size,
      total_unique_managers: managerSet.size,
      servers_missing_ownership: missingOwnership,
      servers_missing_contact: missingContact,
      servers_without_secure_boot: secureBootDisabled,
      servers_incomplete_metadata: incompleteMeta,
      servers_by_business_unit: countBy(s => s.business_unit).sort((a, b) => b.count - a.count),
      servers_by_product: countBy(s => s.product).filter(p => p.name !== 'Unassigned').sort((a, b) => b.count - a.count).slice(0, 10),
      servers_by_environment: countBy(s => s.environment).sort((a, b) => b.count - a.count),
      servers_by_datacenter: countBy(s => s.datacenter).sort((a, b) => b.count - a.count),
      servers_by_support_team: countBy(s => s.support_team).sort((a, b) => b.count - a.count),
      servers_by_power_state: countBy(s => s.power_state),
      secure_boot_status: [
        { name: 'Enabled', count: servers.filter(s => s.efi_secure_boot === true).length },
        { name: 'Disabled', count: servers.filter(s => s.efi_secure_boot === false).length },
        { name: 'Unknown', count: servers.filter(s => s.efi_secure_boot === null).length },
      ],
      ownership_completeness: {
        fully_assigned: servers.filter(s => s.manager && s.email && s.business_unit && s.support_team).length,
        missing_manager: servers.filter(s => !s.manager).length,
        missing_email: servers.filter(s => !s.email).length,
        missing_business_unit: servers.filter(s => !s.business_unit).length,
        missing_support_team: servers.filter(s => !s.support_team).length,
      },
    };

    res.json(metrics);
  });

  // 2. SERVERS LIST & FILTERING
  api.get('/servers', (req: Request, res: Response) => {
    let list = [...db.data.servers];

    const {
      business_unit,
      sub_business_unit,
      customer,
      manager,
      support_team,
      environment,
      power_state,
      datacenter,
      product,
      function: func,
      secure_boot,
      network,
      host,
      q,
      sort_by = 'host',
      sort_order = 'asc',
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    // Multi-attribute filtering
    if (business_unit) {
      const bus = business_unit.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => bus.includes((s.business_unit || '').toLowerCase()));
    }
    if (sub_business_unit) {
      const subs = sub_business_unit.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => subs.includes((s.sub_business_unit || '').toLowerCase()));
    }
    if (customer) {
      const custs = customer.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => custs.includes((s.customer || '').toLowerCase()));
    }
    if (manager) {
      const mgrs = manager.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => mgrs.includes((s.manager || '').toLowerCase()));
    }
    if (support_team) {
      const sts = support_team.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => sts.includes((s.support_team || '').toLowerCase()));
    }
    if (environment) {
      const envs = environment.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => envs.includes((s.environment || '').toLowerCase()));
    }
    if (power_state) {
      const ps = power_state.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => ps.includes((s.power_state || '').toLowerCase()));
    }
    if (datacenter) {
      const dcs = datacenter.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => dcs.includes((s.datacenter || '').toLowerCase()));
    }
    if (product) {
      const prods = product.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => prods.includes((s.product || '').toLowerCase()));
    }
    if (func) {
      const funcs = func.split(',').map(s => s.trim().toLowerCase());
      list = list.filter(s => funcs.includes((s.function || '').toLowerCase()));
    }
    if (secure_boot !== undefined && secure_boot !== '') {
      if (secure_boot === 'TRUE' || secure_boot === 'true') {
        list = list.filter(s => s.efi_secure_boot === true);
      } else if (secure_boot === 'FALSE' || secure_boot === 'false') {
        list = list.filter(s => s.efi_secure_boot === false);
      } else if (secure_boot === 'UNKNOWN' || secure_boot === 'null') {
        list = list.filter(s => s.efi_secure_boot === null);
      }
    }
    if (network) {
      const net = network.toLowerCase();
      list = list.filter(
        s =>
          (s.network_1 || '').toLowerCase().includes(net) ||
          (s.network_2 || '').toLowerCase().includes(net) ||
          (s.network_3 || '').toLowerCase().includes(net)
      );
    }
    if (host) {
      list = list.filter(s => (s.host || '').toLowerCase() === host.toLowerCase());
    }

    // Global Query inside table
    if (q) {
      const query = q.toLowerCase();
      list = list.filter(
        s =>
          (s.host || '').toLowerCase().includes(query) ||
          (s.vm || '').toLowerCase().includes(query) ||
          (s.dns_name || '').toLowerCase().includes(query) ||
          (s.primary_ip_address || '').toLowerCase().includes(query) ||
          (s.manager || '').toLowerCase().includes(query) ||
          (s.email || '').toLowerCase().includes(query) ||
          (s.customer || '').toLowerCase().includes(query) ||
          (s.business_unit || '').toLowerCase().includes(query) ||
          (s.sub_business_unit || '').toLowerCase().includes(query) ||
          (s.product || '').toLowerCase().includes(query) ||
          (s.function || '').toLowerCase().includes(query) ||
          (s.datacenter || '').toLowerCase().includes(query) ||
          (s.network_1 || '').toLowerCase().includes(query) ||
          (s.network_2 || '').toLowerCase().includes(query) ||
          (s.network_3 || '').toLowerCase().includes(query) ||
          (s.organisation_short_code || '').toLowerCase().includes(query)
      );
    }

    // Sorting
    list.sort((a: any, b: any) => {
      let valA = a[sort_by] ?? '';
      let valB = b[sort_by] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sort_order === 'asc' ? -1 : 1;
      if (valA > valB) return sort_order === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, parseInt(limit, 10));
    const totalCount = list.length;
    const paginated = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({
      items: paginated,
      total: totalCount,
      page: pageNum,
      limit: pageSize,
      total_pages: Math.ceil(totalCount / pageSize),
    });
  });

  // 3. GLOBAL SEARCH ENGINE (Section 6: Host, VM, DNS, IP, Manager, Email, Customer, BU, Sub-BU, Product, Function, Datacenter, Network, Support Team, Org Short Code)
  api.get('/servers/search', (req: Request, res: Response) => {
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    if (!q) {
      return res.json([]);
    }

    const matches = db.data.servers.filter(s => {
      return (
        (s.host || '').toLowerCase().includes(q) ||
        (s.vm || '').toLowerCase().includes(q) ||
        (s.dns_name || '').toLowerCase().includes(q) ||
        (s.primary_ip_address || '').toLowerCase().includes(q) ||
        (s.manager || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.customer || '').toLowerCase().includes(q) ||
        (s.business_unit || '').toLowerCase().includes(q) ||
        (s.sub_business_unit || '').toLowerCase().includes(q) ||
        (s.product || '').toLowerCase().includes(q) ||
        (s.function || '').toLowerCase().includes(q) ||
        (s.datacenter || '').toLowerCase().includes(q) ||
        (s.support_team || '').toLowerCase().includes(q) ||
        (s.organisation_short_code || '').toLowerCase().includes(q) ||
        (s.organisation_abbreviated || '').toLowerCase().includes(q) ||
        (s.network_1 || '').toLowerCase().includes(q) ||
        (s.network_2 || '').toLowerCase().includes(q) ||
        (s.network_3 || '').toLowerCase().includes(q)
      );
    });

    // Limit to top 25 for quick autocomplete dropdown
    const results = matches.slice(0, 25).map(s => ({
      id: s.id,
      host: s.host,
      vm: s.vm,
      business_unit: s.business_unit,
      sub_business_unit: s.sub_business_unit,
      manager: s.manager,
      email: s.email,
      primary_ip_address: s.primary_ip_address,
      dns_name: s.dns_name,
      environment: s.environment,
      datacenter: s.datacenter,
      power_state: s.power_state,
    }));

    res.json(results);
  });

  // 4. SERVER DETAILS + RELATIONSHIPS + AUDIT
  api.get('/servers/:id', (req: Request, res: Response) => {
    const server = db.data.servers.find(s => s.id === req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Find correlated infrastructure entities
    const sameHostServers = db.data.servers
      .filter(s => s.id !== server.id && s.host && s.host.toLowerCase() === server.host.toLowerCase())
      .map(s => ({ id: s.id, vm: s.vm, ip: s.primary_ip_address, bu: s.business_unit }));

    const serverNetworks = [server.network_1, server.network_2, server.network_3].filter(Boolean);
    const sameNetworkServers = db.data.servers
      .filter(s => {
        if (s.id === server.id) return false;
        const nets = [s.network_1, s.network_2, s.network_3].filter(Boolean);
        return serverNetworks.some(sn => nets.includes(sn));
      })
      .map(s => ({ id: s.id, host: s.host, vm: s.vm, ip: s.primary_ip_address, bu: s.business_unit }));

    const sameManagerServers = db.data.servers
      .filter(s => s.id !== server.id && s.manager && s.manager.toLowerCase() === server.manager.toLowerCase())
      .map(s => ({ id: s.id, host: s.host, vm: s.vm, bu: s.business_unit }));

    const history = db.data.audit_logs.filter(
      l => l.entity_id === server.id || (l.details && l.details.includes(server.host))
    );

    res.json({
      server,
      relationships: {
        same_hypervisor_vms: sameHostServers,
        same_network_servers: sameNetworkServers,
        same_manager_servers: sameManagerServers,
      },
      history,
    });
  });

  // 5. CREATE / UPDATE SERVER
  api.post('/servers', (req: Request, res: Response) => {
    const body = req.body;
    if (!body.host || !body.vm) {
      return res.status(400).json({ error: 'Host and VM fields are required' });
    }

    const newServer: ServerRecord = {
      id: crypto.randomUUID(),
      host: body.host,
      vm: body.vm,
      support_team: body.support_team || '',
      environment: body.environment || '',
      manager: body.manager || '',
      email: (body.email || '').toLowerCase(),
      customer: body.customer || '',
      power_state: body.power_state || 'poweredOn',
      dns_name: body.dns_name || '',
      primary_ip_address: body.primary_ip_address || '',
      efi_secure_boot: body.efi_secure_boot !== undefined ? body.efi_secure_boot : null,
      annotation: body.annotation || '',
      business_unit: body.business_unit || '',
      sub_business_unit: body.sub_business_unit || '',
      product: body.product || '',
      function: body.function || '',
      business_environment: body.business_environment || body.environment || '',
      organisation_short_code: body.organisation_short_code || '',
      organisation_abbreviated: body.organisation_abbreviated || '',
      datacenter: body.datacenter || '',
      network_1: body.network_1 || '',
      network_2: body.network_2 || '',
      network_3: body.network_3 || '',
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.data.servers.unshift(newServer);
    db.logAudit(body.updated_by || 'SecOps Admin', 'CREATE_SERVER', 'SERVER', newServer.id, null, newServer, `Created server ${newServer.host} (${newServer.vm})`);
    res.status(201).json(newServer);
  });

  api.put('/servers/:id', (req: Request, res: Response) => {
    const idx = db.data.servers.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const prev = db.data.servers[idx];
    const updated: ServerRecord = {
      ...prev,
      ...req.body,
      id: prev.id, // preserve id
      updated_at: new Date().toISOString(),
    };

    db.data.servers[idx] = updated;
    db.logAudit(req.body.updated_by || 'SecOps Admin', 'UPDATE_SERVER', 'SERVER', updated.id, prev, updated, `Updated attributes for ${updated.host}`);
    res.json(updated);
  });

  api.delete('/servers/:id', (req: Request, res: Response) => {
    const idx = db.data.servers.findIndex(s => s.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const removed = db.data.servers.splice(idx, 1)[0];
    db.logAudit('SecOps Admin', 'DELETE_SERVER', 'SERVER', removed.id, removed, null, `Deleted server ${removed.host}`);
    res.json({ success: true, removed });
  });

  // 6. BUSINESS UNITS EXPLORER & RELATIONSHIPS (Section 9)
  api.get('/business-units', (req: Request, res: Response) => {
    const servers = db.data.servers;
    const buMap = new Map<string, {
      name: string;
      organisation_short_code: string;
      organisation_abbreviated: string;
      customer: string;
      total_servers: number;
      powered_on_servers: number;
      sub_business_units: Set<string>;
      managers: Set<string>;
      support_teams: Set<string>;
      datacenters: Set<string>;
    }>();

    servers.forEach(s => {
      const buName = s.business_unit || 'Unassigned';
      if (!buMap.has(buName)) {
        buMap.set(buName, {
          name: buName,
          organisation_short_code: s.organisation_short_code || '',
          organisation_abbreviated: s.organisation_abbreviated || '',
          customer: s.customer || '',
          total_servers: 0,
          powered_on_servers: 0,
          sub_business_units: new Set(),
          managers: new Set(),
          support_teams: new Set(),
          datacenters: new Set(),
        });
      }
      const item = buMap.get(buName)!;
      item.total_servers++;
      if ((s.power_state || '').toLowerCase() === 'poweredon') {
        item.powered_on_servers++;
      }
      if (s.sub_business_unit) item.sub_business_units.add(s.sub_business_unit);
      if (s.manager) item.managers.add(s.manager);
      if (s.support_team) item.support_teams.add(s.support_team);
      if (s.datacenter) item.datacenters.add(s.datacenter);
      if (!item.organisation_short_code && s.organisation_short_code) item.organisation_short_code = s.organisation_short_code;
      if (!item.organisation_abbreviated && s.organisation_abbreviated) item.organisation_abbreviated = s.organisation_abbreviated;
      if (!item.customer && s.customer) item.customer = s.customer;
    });

    const result = Array.from(buMap.values()).map(b => ({
      name: b.name,
      organisation_short_code: b.organisation_short_code,
      organisation_abbreviated: b.organisation_abbreviated,
      customer: b.customer,
      total_servers: b.total_servers,
      powered_on_servers: b.powered_on_servers,
      sub_business_units_count: b.sub_business_units.size,
      sub_business_units: Array.from(b.sub_business_units),
      managers_count: b.managers.size,
      managers: Array.from(b.managers),
      support_teams_count: b.support_teams.size,
      support_teams: Array.from(b.support_teams),
      datacenters_count: b.datacenters.size,
      datacenters: Array.from(b.datacenters),
    }));

    res.json(result);
  });

  api.get('/business-units/:name', (req: Request, res: Response) => {
    const buName = decodeURIComponent(req.params.name);
    const servers = db.data.servers.filter(
      s => (s.business_unit || '').toLowerCase() === buName.toLowerCase()
    );

    if (servers.length === 0 && buName.toLowerCase() !== 'unassigned') {
      return res.status(404).json({ error: 'Business unit not found' });
    }

    const subBUs = Array.from(new Set(servers.map(s => s.sub_business_unit).filter(Boolean)));
    const products = Array.from(new Set(servers.map(s => s.product).filter(Boolean)));
    const functions = Array.from(new Set(servers.map(s => s.function).filter(Boolean)));
    const environments = Array.from(new Set(servers.map(s => s.environment).filter(Boolean)));
    const datacenters = Array.from(new Set(servers.map(s => s.datacenter).filter(Boolean)));
    const supportTeams = Array.from(new Set(servers.map(s => s.support_team).filter(Boolean)));

    const networksSet = new Set<string>();
    servers.forEach(s => {
      if (s.network_1) networksSet.add(s.network_1);
      if (s.network_2) networksSet.add(s.network_2);
      if (s.network_3) networksSet.add(s.network_3);
    });

    const managerMap = new Map<string, { name: string; email: string; server_count: number }>();
    servers.forEach(s => {
      if (s.manager) {
        if (!managerMap.has(s.manager)) {
          managerMap.set(s.manager, { name: s.manager, email: s.email, server_count: 0 });
        }
        managerMap.get(s.manager)!.server_count++;
      }
    });

    res.json({
      name: buName,
      total_servers: servers.length,
      powered_on_servers: servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length,
      sub_business_units: subBUs,
      products,
      functions,
      environments,
      datacenters,
      support_teams: supportTeams,
      networks: Array.from(networksSet),
      managers: Array.from(managerMap.values()),
      servers,
    });
  });

  // 6.1 PRODUCTS DIRECTORY (4_Product breakdown)
  api.get('/products', (req: Request, res: Response) => {
    const servers = db.data.servers;
    const map = new Map<string, {
      name: string;
      total_servers: number;
      powered_on: number;
      powered_off: number;
      business_units: Set<string>;
      customers: Set<string>;
      managers: Set<string>;
      ownerMap: Map<string, { name: string; email: string; server_count: number }>;
      functions: Set<string>;
      environments: Set<string>;
      datacenters: Set<string>;
      server_ids: string[];
      servers: Array<{
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
    }>();

    servers.forEach(s => {
      const p = s.product || 'Unassigned Product';
      if (!map.has(p)) {
        map.set(p, {
          name: p,
          total_servers: 0,
          powered_on: 0,
          powered_off: 0,
          business_units: new Set(),
          customers: new Set(),
          managers: new Set(),
          ownerMap: new Map(),
          functions: new Set(),
          environments: new Set(),
          datacenters: new Set(),
          server_ids: [],
          servers: [],
        });
      }
      const entry = map.get(p)!;
      entry.total_servers++;
      entry.server_ids.push(s.id);
      entry.servers.push({
        id: s.id,
        host: s.host,
        vm: s.vm,
        ip: s.primary_ip_address,
        bu: s.business_unit,
        manager: s.manager,
        email: s.email,
        function: s.function,
        power_state: s.power_state,
      });

      if ((s.power_state || '').toLowerCase() === 'poweredon') {
        entry.powered_on++;
      } else {
        entry.powered_off++;
      }
      if (s.business_unit) entry.business_units.add(s.business_unit);
      if (s.customer) entry.customers.add(s.customer);
      if (s.manager) {
        entry.managers.add(s.manager);
        if (!entry.ownerMap.has(s.manager)) {
          entry.ownerMap.set(s.manager, { name: s.manager, email: s.email || '', server_count: 0 });
        }
        entry.ownerMap.get(s.manager)!.server_count++;
      }
      if (s.function) entry.functions.add(s.function);
      if (s.environment) entry.environments.add(s.environment);
      if (s.datacenter) entry.datacenters.add(s.datacenter);
    });

    const result = Array.from(map.values()).map(p => {
      const productOwners = Array.from(p.ownerMap.values()).sort((a, b) => b.server_count - a.server_count);
      const primaryOwner = productOwners.length > 0 ? productOwners[0].name : 'Unassigned';
      return {
        name: p.name,
        total_servers: p.total_servers,
        powered_on: p.powered_on,
        powered_off: p.powered_off,
        primary_owner: primaryOwner,
        product_owners: productOwners,
        managers: Array.from(p.managers),
        business_units: Array.from(p.business_units),
        customers: Array.from(p.customers),
        functions: Array.from(p.functions),
        environments: Array.from(p.environments),
        datacenters: Array.from(p.datacenters),
        server_ids: p.server_ids,
        servers: p.servers,
      };
    }).sort((a, b) => b.total_servers - a.total_servers);

    res.json(result);
  });

  // 7. MANAGERS DIRECTORY
  api.get('/managers', (req: Request, res: Response) => {
    const map = new Map<string, {
      name: string;
      email: string;
      server_count: number;
      business_units: Set<string>;
      datacenters: Set<string>;
      support_teams: Set<string>;
    }>();

    db.data.servers.forEach(s => {
      const mgr = s.manager || 'Unassigned';
      if (!map.has(mgr)) {
        map.set(mgr, {
          name: mgr,
          email: s.email || '',
          server_count: 0,
          business_units: new Set(),
          datacenters: new Set(),
          support_teams: new Set(),
        });
      }
      const entry = map.get(mgr)!;
      entry.server_count++;
      if (s.email && !entry.email) entry.email = s.email;
      if (s.business_unit) entry.business_units.add(s.business_unit);
      if (s.datacenter) entry.datacenters.add(s.datacenter);
      if (s.support_team) entry.support_teams.add(s.support_team);
    });

    const result = Array.from(map.values()).map(m => ({
      name: m.name,
      email: m.email,
      server_count: m.server_count,
      business_units: Array.from(m.business_units),
      datacenters: Array.from(m.datacenters),
      support_teams: Array.from(m.support_teams),
    }));

    res.json(result);
  });

  api.get('/managers/:name/servers', (req: Request, res: Response) => {
    const mgrName = decodeURIComponent(req.params.name);
    const servers = db.data.servers.filter(
      s => (s.manager || '').toLowerCase() === mgrName.toLowerCase()
    );
    res.json(servers);
  });

  // 8. NETWORKS DIRECTORY
  api.get('/networks', (req: Request, res: Response) => {
    const map = new Map<string, {
      name: string;
      server_count: number;
      business_units: Set<string>;
      datacenters: Set<string>;
      hosts: Set<string>;
    }>();

    db.data.servers.forEach(s => {
      const nets = [s.network_1, s.network_2, s.network_3].filter(Boolean);
      nets.forEach(n => {
        if (!map.has(n)) {
          map.set(n, {
            name: n,
            server_count: 0,
            business_units: new Set(),
            datacenters: new Set(),
            hosts: new Set(),
          });
        }
        const item = map.get(n)!;
        item.server_count++;
        if (s.business_unit) item.business_units.add(s.business_unit);
        if (s.datacenter) item.datacenters.add(s.datacenter);
        if (s.host) item.hosts.add(s.host);
      });
    });

    const list = Array.from(map.values()).map(n => ({
      name: n.name,
      server_count: n.server_count,
      business_units: Array.from(n.business_units),
      datacenters: Array.from(n.datacenters),
      hosts: Array.from(n.hosts),
    }));

    res.json(list);
  });

  api.get('/networks/:name/servers', (req: Request, res: Response) => {
    const netName = decodeURIComponent(req.params.name).toLowerCase();
    const servers = db.data.servers.filter(
      s =>
        (s.network_1 || '').toLowerCase() === netName ||
        (s.network_2 || '').toLowerCase() === netName ||
        (s.network_3 || '').toLowerCase() === netName
    );
    res.json(servers);
  });

  // 9. DATACENTERS & HYPERVISORS
  api.get('/datacenters', (req: Request, res: Response) => {
    const map = new Map<string, {
      name: string;
      server_count: number;
      hypervisors: Map<string, { host: string; vm_count: number; vms: string[] }>;
    }>();

    db.data.servers.forEach(s => {
      const dc = s.datacenter || 'Unknown';
      if (!map.has(dc)) {
        map.set(dc, { name: dc, server_count: 0, hypervisors: new Map() });
      }
      const d = map.get(dc)!;
      d.server_count++;

      const host = s.host || 'Unknown Host';
      if (!d.hypervisors.has(host)) {
        d.hypervisors.set(host, { host, vm_count: 0, vms: [] });
      }
      const h = d.hypervisors.get(host)!;
      h.vm_count++;
      if (s.vm) h.vms.push(s.vm);
    });

    const result = Array.from(map.values()).map(d => ({
      name: d.name,
      server_count: d.server_count,
      hypervisors_count: d.hypervisors.size,
      hypervisors: Array.from(d.hypervisors.values()),
    }));

    res.json(result);
  });

  // 10. INCIDENT TRIAGE WORKSPACE (Section 12)
  api.get('/incidents', (req: Request, res: Response) => {
    res.json(db.data.incidents);
  });

  api.post('/incidents', (req: Request, res: Response) => {
    const body = req.body;
    if (!body.incident_title) {
      return res.status(400).json({ error: 'Incident title is required' });
    }

    const affectedIds = new Set<string>(Array.isArray(body.affected_server_ids) ? body.affected_server_ids : []);
    if (body.raw_input && typeof body.raw_input === 'string') {
      const tokens = body.raw_input.split(/[\r\n,;\s]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      tokens.forEach((token: string) => {
        const found = db.data.servers.filter(
          s =>
            (s.host || '').toLowerCase() === token ||
            (s.vm || '').toLowerCase() === token ||
            (s.primary_ip_address || '').toLowerCase() === token ||
            (s.dns_name || '').toLowerCase() === token
        );
        found.forEach(s => affectedIds.add(s.id));
      });
    }

    const newInc: Incident = {
      id: crypto.randomUUID(),
      incident_reference: body.incident_reference || `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      incident_title: body.incident_title,
      description: body.description || '',
      severity: body.severity || 'High',
      date_detected: body.date_detected || new Date().toISOString(),
      detection_source: body.detection_source || 'Manual Triage',
      ioc_or_vulnerability: body.ioc_or_vulnerability || '',
      status: body.status || 'Open',
      assigned_engineer: body.assigned_engineer || 'SecOps Lead',
      affected_server_ids: Array.from(affectedIds),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.data.incidents.unshift(newInc);
    db.logAudit(body.user || 'SecOps', 'CREATE_INCIDENT', 'INCIDENT', newInc.id, null, newInc, `Created incident ${newInc.incident_reference} with ${newInc.affected_server_ids.length} host(s)`);
    res.status(201).json(newInc);
  });

  api.get('/incidents/:id', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id || i.incident_reference === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    res.json(inc);
  });

  api.put('/incidents/:id', (req: Request, res: Response) => {
    const idx = db.data.incidents.findIndex(i => i.id === req.params.id || i.incident_reference === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Incident not found' });

    const prev = db.data.incidents[idx];
    const updated = {
      ...prev,
      ...req.body,
      id: prev.id,
      updated_at: new Date().toISOString(),
    };

    db.data.incidents[idx] = updated;
    db.logAudit('SecOps', 'UPDATE_INCIDENT', 'INCIDENT', updated.id, prev, updated, `Updated ${updated.incident_reference}`);
    res.json(updated);
  });

  api.put('/incidents/:id/hosts/:serverId', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id || i.incident_reference === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    const serverId = req.params.serverId;
    inc.host_details = inc.host_details || {};
    inc.host_details[serverId] = {
      ...(inc.host_details[serverId] || { server_id: serverId, status: 'To be contacted', notes: '' }),
      ...req.body,
      server_id: serverId,
      updated_at: new Date().toISOString(),
    };
    inc.updated_at = new Date().toISOString();
    db.save();
    res.json(inc.host_details[serverId]);
  });

  // Batch Add Affected Servers by hostnames, IPs, or IDs (Section 12.2: Reports matched and unmatched!)
  api.post('/incidents/:id/servers', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id || i.incident_reference === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const { raw_input, server_ids } = req.body;
    const currentIds = new Set(inc.affected_server_ids);
    const matchedServers: ServerRecord[] = [];
    const unmatchedEntries: string[] = [];

    if (Array.isArray(server_ids)) {
      server_ids.forEach(id => {
        const found = db.data.servers.find(s => s.id === id);
        if (found) {
          currentIds.add(found.id);
          matchedServers.push(found);
        } else {
          unmatchedEntries.push(id);
        }
      });
    }

    if (raw_input && typeof raw_input === 'string') {
      // Split by commas, newlines, semicolons, tabs, spaces
      const tokens = raw_input
        .split(/[\r\n,;\s]+/)
        .map(t => t.trim())
        .filter(Boolean);

      tokens.forEach(token => {
        const tLower = token.toLowerCase();
        // Match against host, vm, primary_ip_address, dns_name
        const found = db.data.servers.filter(
          s =>
            (s.host || '').toLowerCase() === tLower ||
            (s.vm || '').toLowerCase() === tLower ||
            (s.primary_ip_address || '').toLowerCase() === tLower ||
            (s.dns_name || '').toLowerCase() === tLower
        );

        if (found.length > 0) {
          found.forEach(s => {
            currentIds.add(s.id);
            if (!matchedServers.some(m => m.id === s.id)) matchedServers.push(s);
          });
        } else {
          unmatchedEntries.push(token);
        }
      });
    }

    inc.affected_server_ids = Array.from(currentIds);
    inc.updated_at = new Date().toISOString();
    db.save();

    db.logAudit('SecOps', 'ADD_INCIDENT_SERVERS', 'INCIDENT', inc.id, null, null, `Added ${matchedServers.length} affected servers to ${inc.incident_reference}`);

    res.json({
      incident: inc,
      total_affected: inc.affected_server_ids.length,
      matched_count: matchedServers.length,
      unmatched_count: unmatchedEntries.length,
      matched_servers: matchedServers,
      unmatched_entries: unmatchedEntries,
    });
  });

  // Update specific host triage status, engineer name, and notes in an incident
  api.put('/incidents/:id/hosts/:serverId', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    if (!inc.host_details) inc.host_details = {};
    const serverId = req.params.serverId;
    const prev = inc.host_details[serverId] || {
      server_id: serverId,
      status: 'To be contacted',
      patch_engineer: '',
      notes: '',
    };

    inc.host_details[serverId] = {
      ...prev,
      ...req.body,
      server_id: serverId,
      updated_at: new Date().toISOString(),
    };
    inc.updated_at = new Date().toISOString();
    db.save();

    res.json(inc.host_details[serverId]);
  });

  // Remove host from incident
  api.delete('/incidents/:id/servers/:serverId', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id || i.incident_reference === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const serverId = req.params.serverId;
    inc.affected_server_ids = inc.affected_server_ids.filter(id => id !== serverId);
    if (inc.host_details && inc.host_details[serverId]) {
      delete inc.host_details[serverId];
    }
    inc.updated_at = new Date().toISOString();
    db.save();
    db.logAudit('SecOps', 'REMOVE_INCIDENT_SERVER', 'INCIDENT', inc.id, null, null, `Removed server ${serverId} from ${inc.incident_reference}`);

    res.json({ success: true, remaining: inc.affected_server_ids.length });
  });

  // Calculate Impact & Correlation Leads (Section 12.3 & 12.4)
  api.get('/incidents/:id/impact', (req: Request, res: Response) => {
    const inc = db.data.incidents.find(i => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const affected = db.data.servers.filter(s => inc.affected_server_ids.includes(s.id));

    const buSet = new Set<string>();
    const subBuSet = new Set<string>();
    const emailSet = new Set<string>();
    const stSet = new Set<string>();
    const dcSet = new Set<string>();
    const hypervisorSet = new Set<string>();
    const netSet = new Set<string>();

    const mgrMap = new Map<string, { name: string; email: string; server_count: number }>();

    affected.forEach(s => {
      if (s.business_unit) buSet.add(s.business_unit);
      if (s.sub_business_unit) subBuSet.add(s.sub_business_unit);
      if (s.email) emailSet.add(s.email.toLowerCase());
      if (s.support_team) stSet.add(s.support_team);
      if (s.datacenter) dcSet.add(s.datacenter);
      if (s.host) hypervisorSet.add(s.host);
      if (s.network_1) netSet.add(s.network_1);
      if (s.network_2) netSet.add(s.network_2);
      if (s.network_3) netSet.add(s.network_3);

      const mgr = s.manager || 'Unassigned';
      if (!mgrMap.has(mgr)) {
        mgrMap.set(mgr, { name: mgr, email: s.email || '', server_count: 0 });
      }
      mgrMap.get(mgr)!.server_count++;
    });

    // Correlation leads (shared infrastructure / owners)
    const correlationLeads: IncidentImpact['correlation_leads'] = [];

    // Check shared hypervisors with multiple affected servers
    const hostCounts: Record<string, ServerRecord[]> = {};
    affected.forEach(s => {
      if (s.host) {
        hostCounts[s.host] = hostCounts[s.host] || [];
        hostCounts[s.host].push(s);
      }
    });
    Object.entries(hostCounts).forEach(([host, servers]) => {
      if (servers.length > 1) {
        correlationLeads.push({
          type: 'hypervisor',
          name: host,
          description: `${servers.length} affected virtual machines share the same hypervisor host. Potential lateral movement / hypervisor exploit risk.`,
          server_count: servers.length,
          servers: servers.map(s => ({ id: s.id, host: s.host, vm: s.vm, ip: s.primary_ip_address })),
        });
      }
    });

    // Check shared networks
    const netCounts: Record<string, ServerRecord[]> = {};
    affected.forEach(s => {
      [s.network_1, s.network_2, s.network_3].filter(Boolean).forEach(net => {
        netCounts[net] = netCounts[net] || [];
        if (!netCounts[net].some(item => item.id === s.id)) {
          netCounts[net].push(s);
        }
      });
    });
    Object.entries(netCounts).forEach(([net, servers]) => {
      if (servers.length > 1) {
        correlationLeads.push({
          type: 'network',
          name: net,
          description: `${servers.length} affected servers reside on the same network segment. Verify network broadcast/ARP sniffing or subnet-wide exposure.`,
          server_count: servers.length,
          servers: servers.map(s => ({ id: s.id, host: s.host, vm: s.vm, ip: s.primary_ip_address })),
        });
      }
    });

    // Check shared managers
    mgrMap.forEach((val, mgr) => {
      if (val.server_count > 1 && mgr !== 'Unassigned') {
        const mgrServers = affected.filter(s => s.manager === mgr);
        correlationLeads.push({
          type: 'manager',
          name: mgr,
          description: `Single operational owner responsible for ${val.server_count} affected systems. Primary stakeholder for authorization and outage scheduling.`,
          server_count: val.server_count,
          servers: mgrServers.map(s => ({ id: s.id, host: s.host, vm: s.vm, ip: s.primary_ip_address })),
        });
      }
    });

    const impact: IncidentImpact = {
      incident_id: inc.id,
      total_affected_servers: affected.length,
      unique_business_units: Array.from(buSet),
      unique_sub_business_units: Array.from(subBuSet),
      unique_managers: Array.from(mgrMap.values()),
      unique_emails: Array.from(emailSet),
      unique_support_teams: Array.from(stSet),
      unique_datacenters: Array.from(dcSet),
      unique_hypervisors: Array.from(hypervisorSet),
      unique_networks: Array.from(netSet),
      affected_servers: affected,
      correlation_leads: correlationLeads,
    };

    res.json(impact);
  });

  // 11. PATCHING & VULNERABILITY MANAGEMENT (Section 13)
  api.get('/patching/campaigns', (req: Request, res: Response) => {
    res.json(db.data.patch_campaigns);
  });

  api.post('/patching/campaigns', (req: Request, res: Response) => {
    const body = req.body;
    if (!body.campaign_name) return res.status(400).json({ error: 'Campaign name is required' });

    const targets: Record<string, PatchTarget> = {};
    if (Array.isArray(body.server_ids)) {
      body.server_ids.forEach((id: string) => {
        targets[id] = {
          server_id: id,
          status: 'Affected',
          notes: 'Targeted in initial campaign scope',
        };
      });
    }

    const campaign: PatchCampaign = {
      id: crypto.randomUUID(),
      campaign_name: body.campaign_name,
      cve_identifier: body.cve_identifier || '',
      patch_reference: body.patch_reference || '',
      description: body.description || '',
      severity: body.severity || 'Medium',
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      target_completion_date: body.target_completion_date || '',
      status: 'Active',
      assigned_engineer: body.assigned_engineer || 'Patch Management Team',
      targets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.data.patch_campaigns.unshift(campaign);
    db.logAudit(body.user || 'SecOps', 'CREATE_CAMPAIGN', 'CAMPAIGN', campaign.id, null, campaign, `Created patch campaign ${campaign.campaign_name}`);
    res.status(201).json(campaign);
  });

  api.get('/patching/campaigns/:id', (req: Request, res: Response) => {
    const campaign = db.data.patch_campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Join target server records
    const targetList = Object.entries(campaign.targets).map(([serverId, target]) => {
      const server = db.data.servers.find(s => s.id === serverId);
      return {
        ...target,
        server,
      };
    });

    // Compute progress stats
    const totalTargets = Object.keys(campaign.targets).length;
    const patchedCount = Object.values(campaign.targets).filter(t => t.status === 'Patched' || t.status === 'Validated').length;
    const pendingCount = Object.values(campaign.targets).filter(t => t.status !== 'Patched' && t.status !== 'Validated' && t.status !== 'Not affected' && t.status !== 'Exception granted').length;
    const validationRequired = Object.values(campaign.targets).filter(t => t.status === 'Validation required').length;

    res.json({
      ...campaign,
      targets_list: targetList,
      stats: {
        total: totalTargets,
        patched: patchedCount,
        pending: pendingCount,
        validation_required: validationRequired,
        completion_pct: totalTargets > 0 ? Math.round((patchedCount / totalTargets) * 100) : 0,
      },
    });
  });

  api.put('/patching/campaigns/:id', (req: Request, res: Response) => {
    const idx = db.data.patch_campaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Campaign not found' });

    const prev = db.data.patch_campaigns[idx];
    const updated = {
      ...prev,
      ...req.body,
      id: prev.id,
      updated_at: new Date().toISOString(),
    };

    db.data.patch_campaigns[idx] = updated;
    db.save();
    res.json(updated);
  });

  api.put('/patching/campaigns/:id/servers/:serverId', (req: Request, res: Response) => {
    const campaign = db.data.patch_campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const serverId = req.params.serverId;
    const prevTarget = campaign.targets[serverId] || { server_id: serverId, status: 'Not assessed', notes: '' };

    campaign.targets[serverId] = {
      ...prevTarget,
      ...req.body,
      server_id: serverId,
      patched_at: req.body.status === 'Patched' ? (prevTarget.patched_at || new Date().toISOString()) : prevTarget.patched_at,
    };
    campaign.updated_at = new Date().toISOString();
    db.save();

    db.logAudit('SecOps', 'UPDATE_PATCH_STATUS', 'CAMPAIGN', campaign.id, prevTarget, campaign.targets[serverId], `Updated server ${serverId} status to ${req.body.status}`);
    res.json(campaign.targets[serverId]);
  });

  // 12. COMMUNICATIONS CENTRE (Section 14)
  api.post('/communications/preview', (req: Request, res: Response) => {
    const { server_ids, template_type, incident_reference, incident_title, severity, target_date } = req.body;

    let selectedServers: ServerRecord[] = [];
    if (Array.isArray(server_ids) && server_ids.length > 0) {
      selectedServers = db.data.servers.filter(s => server_ids.includes(s.id));
    } else {
      selectedServers = db.data.servers;
    }

    // Deduplicate contacts by email
    const contactMap = new Map<string, {
      manager: string;
      email: string;
      business_units: Set<string>;
      sub_business_units: Set<string>;
      support_teams: Set<string>;
      servers: { host: string; vm: string; ip: string; bu: string }[];
      missing_email: boolean;
    }>();

    selectedServers.forEach(s => {
      const email = (s.email || '').toLowerCase().trim();
      const manager = s.manager || 'Unassigned';
      const key = email || `no-email-${manager}`;

      if (!contactMap.has(key)) {
        contactMap.set(key, {
          manager,
          email,
          business_units: new Set(),
          sub_business_units: new Set(),
          support_teams: new Set(),
          servers: [],
          missing_email: !email,
        });
      }

      const item = contactMap.get(key)!;
      if (s.business_unit) item.business_units.add(s.business_unit);
      if (s.sub_business_unit) item.sub_business_units.add(s.sub_business_unit);
      if (s.support_team) item.support_teams.add(s.support_team);
      item.servers.push({
        host: s.host,
        vm: s.vm,
        ip: s.primary_ip_address,
        bu: s.business_unit,
      });
    });

    const contactList = Array.from(contactMap.values()).map(c => ({
      manager: c.manager,
      email: c.email,
      missing_email: c.missing_email,
      business_unit: Array.from(c.business_units).join(', ') || 'N/A',
      sub_business_unit: Array.from(c.sub_business_units).join(', ') || 'N/A',
      support_team: Array.from(c.support_teams).join(', ') || 'N/A',
      server_count: c.servers.length,
      servers: c.servers,
    }));

    // Templates library (Section 14.3)
    const templates: Record<string, { subject: string; body: string }> = {
      incident: {
        subject: `[SECURITY INCIDENT] {{incident_reference}} - {{incident_title}} [{{severity}}]`,
        body: `Dear {{manager_name}},\n\nThis is an urgent security notification from the Cyber Security Operations Center regarding infrastructure under your business responsibility ({{business_unit}}).\n\nIncident Reference: {{incident_reference}}\nTitle: {{incident_title}}\nSeverity: {{severity}}\nAffected System Count: {{affected_server_count}}\n\nAffected Systems Under Your Remit:\n{{affected_servers}}\n\nPlease review these hosts immediately with your application lead and confirm availability for mitigation steps. If you have questions or require technical assistance, respond to this message directly.\n\nRegards,\nSecurity Operations & Infrastructure Response Team`,
      },
      vulnerability: {
        subject: `[VULNERABILITY ADVISORY] Action Required for {{business_unit}} Servers`,
        body: `Hello {{manager_name}},\n\nA critical security vulnerability has been identified affecting {{affected_server_count}} server(s) assigned to {{business_unit}}.\n\nAffected Systems:\n{{affected_servers}}\n\nPlease ensure remediation or virtual patching is scheduled prior to {{target_completion_date}}.\n\nThank you,\nVulnerability Management Team`,
      },
      patching: {
        subject: `[PATCHING REQUEST] Maintenance Window Scheduling - {{business_unit}}`,
        body: `Dear {{manager_name}},\n\nThe upcoming quarterly OS and hypervisor security patch cycle requires scheduling for your systems in {{business_unit}}.\n\nTarget Completion Date: {{target_completion_date}}\nNumber of Servers: {{affected_server_count}}\n\nHosts:\n{{affected_servers}}\n\nPlease reply with your approved maintenance downtime window.\n\nBest regards,\nInfrastructure Operations`,
      },
      maintenance: {
        subject: `[INFRASTRUCTURE NOTICE] Datacenter Network & Firmware Maintenance`,
        body: `Dear {{manager_name}},\n\nScheduled maintenance is planned for the hypervisors and network fabrics supporting {{business_unit}}.\n\nServers Impacted:\n{{affected_servers}}\n\nEstimated downtime: ~15 minutes per host failover. Automated HA will keep impact minimal.\n\nBest regards,\nInfrastructure Team`,
      },
      ownership: {
        subject: `[OWNERSHIP CONFIRMATION] Verification of Asset Responsibility`,
        body: `Dear {{manager_name}},\n\nAs part of our periodic asset hygiene review, please confirm whether you remain the designated technical and operational manager for the following {{affected_server_count}} server(s) in {{business_unit}}:\n\n{{affected_servers}}\n\nIf any system has transitioned or been decommissioned, please notify us.\n\nThank you,\nConfiguration Management Team`,
      },
    };

    const chosen = templates[template_type || 'incident'] || templates.incident;

    // Build sample preview for the first contact
    const first = contactList[0] || {
      manager: 'John Lennon',
      business_unit: 'BRICK',
      servers: [{ host: 'br1-sse-esx-23.prd.local', vm: 'br1-VM-SSS-3', ip: '10.200.68.76' }],
    };

    const formatServerList = (srvs: any[]) =>
      srvs.map(s => `  • Host: ${s.host} | VM: ${s.vm} | IP: ${s.ip}`).join('\n');

    const previewSubject = chosen.subject
      .replace(/{{incident_reference}}/g, incident_reference || 'INC-2026-0842')
      .replace(/{{incident_title}}/g, incident_title || 'Critical Patching Advisory')
      .replace(/{{severity}}/g, severity || 'Critical')
      .replace(/{{business_unit}}/g, first.business_unit || 'Default BU');

    const previewBody = chosen.body
      .replace(/{{manager_name}}/g, first.manager)
      .replace(/{{business_unit}}/g, first.business_unit)
      .replace(/{{incident_reference}}/g, incident_reference || 'INC-2026-0842')
      .replace(/{{incident_title}}/g, incident_title || 'Critical Patching Advisory')
      .replace(/{{severity}}/g, severity || 'Critical')
      .replace(/{{affected_server_count}}/g, String(first.server_count || first.servers.length))
      .replace(/{{affected_servers}}/g, formatServerList(first.servers))
      .replace(/{{target_completion_date}}/g, target_date || '2026-11-15');

    res.json({
      total_contacts: contactList.length,
      valid_emails: contactList.filter(c => !c.missing_email).length,
      missing_emails: contactList.filter(c => c.missing_email).length,
      contacts: contactList,
      preview: {
        subject: previewSubject,
        body: previewBody,
      },
    });
  });

  // 13. CSV IMPORT ENGINE (Section 4)
  api.post('/imports/preview', (req: Request, res: Response) => {
    const { csv_content } = req.body;
    if (!csv_content || typeof csv_content !== 'string') {
      return res.status(400).json({ error: 'No CSV content provided' });
    }

    const lines = csv_content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return res.status(400).json({ error: 'CSV file is empty' });

    const rawHeaders = parseCsvLine(lines[0]);
    const detectedColumns = rawHeaders.map(h => h.trim());

    // Standard mapping recommendations
    const suggestedMapping: Record<string, string> = {};
    detectedColumns.forEach(h => {
      const lower = h.toLowerCase();
      if (lower === 'host') suggestedMapping[h] = 'host';
      else if (lower === 'vm') suggestedMapping[h] = 'vm';
      else if (lower.includes('support')) suggestedMapping[h] = 'support_team';
      else if (lower === 'environment') suggestedMapping[h] = 'environment';
      else if (lower === 'manager') suggestedMapping[h] = 'manager';
      else if (lower === 'email') suggestedMapping[h] = 'email';
      else if (lower === 'customer') suggestedMapping[h] = 'customer';
      else if (lower.includes('power')) suggestedMapping[h] = 'power_state';
      else if (lower.includes('dns')) suggestedMapping[h] = 'dns_name';
      else if (lower.includes('ip')) suggestedMapping[h] = 'primary_ip_address';
      else if (lower.includes('secure') || lower.includes('efi')) suggestedMapping[h] = 'efi_secure_boot';
      else if (lower.includes('annotation')) suggestedMapping[h] = 'annotation';
      else if (lower.includes('1_businessunit') || lower === 'business unit') suggestedMapping[h] = 'business_unit';
      else if (lower.includes('2_subbusinessunit') || lower === 'sub business unit') suggestedMapping[h] = 'sub_business_unit';
      else if (lower.includes('4_product') || lower === 'product') suggestedMapping[h] = 'product';
      else if (lower.includes('5_function') || lower === 'function') suggestedMapping[h] = 'function';
      else if (lower.includes('6_environmen') || lower === 'business environment') suggestedMapping[h] = 'business_environment';
      else if (lower.includes('7_organisationshortcode')) suggestedMapping[h] = 'organisation_short_code';
      else if (lower.includes('8_organisationabbreviated')) suggestedMapping[h] = 'organisation_abbreviated';
      else if (lower === 'datacenter') suggestedMapping[h] = 'datacenter';
      else if (lower.includes('network #1') || lower === 'network_1') suggestedMapping[h] = 'network_1';
      else if (lower.includes('network #2') || lower === 'network_2') suggestedMapping[h] = 'network_2';
      else if (lower.includes('network #3') || lower === 'network_3') suggestedMapping[h] = 'network_3';
    });

    const parsedRows = parseCsvToServers(csv_content);
    const previewRows = parsedRows.slice(0, 20);

    // Validation checks for preview (Section 4.1 Stage 3)
    const existingHosts = new Set(db.data.servers.map(s => (s.host || '').toLowerCase()));
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

    const rowValidations = previewRows.map((row, index) => {
      const issues: string[] = [];
      if (!row.host) issues.push('Missing hostname');
      if (!row.manager) issues.push('Missing manager information');
      if (!row.email) issues.push('Missing email address');
      if (!row.business_unit) issues.push('Missing business unit');
      if (row.primary_ip_address && !ipRegex.test(row.primary_ip_address)) issues.push('Invalid IP format');
      if (existingHosts.has(row.host.toLowerCase())) issues.push('Duplicate host in existing database');

      return {
        row_number: index + 1,
        server: row,
        issues,
        has_warnings: issues.length > 0,
      };
    });

    res.json({
      total_rows: parsedRows.length,
      detected_columns: detectedColumns,
      suggested_mapping: suggestedMapping,
      preview: rowValidations,
    });
  });

  api.post('/imports/execute', (req: Request, res: Response) => {
    const { csv_content, filename = 'import.csv', strategy = 'update', user = 'SecOps Admin' } = req.body;
    if (!csv_content) return res.status(400).json({ error: 'No CSV content provided' });

    const incoming = parseCsvToServers(csv_content);
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    const existingHostMap = new Map<string, number>();
    db.data.servers.forEach((s, idx) => {
      existingHostMap.set(`${s.host.toLowerCase()}::${s.vm.toLowerCase()}`, idx);
    });

    const processedKeys = new Set<string>();

    incoming.forEach((row, i) => {
      if (!row.host || !row.vm) {
        failedCount++;
        errors.push({ row: i + 1, field: 'host/vm', message: 'Host and VM identifiers are mandatory', raw_data: row });
        return;
      }

      const key = `${row.host.toLowerCase()}::${row.vm.toLowerCase()}`;
      if (processedKeys.has(key)) {
        duplicateCount++;
      }
      processedKeys.add(key);

      const existingIndex = existingHostMap.get(key);

      if (strategy === 'insert') {
        if (existingIndex !== undefined) {
          duplicateCount++;
        } else {
          db.data.servers.push(row);
          newCount++;
        }
      } else if (strategy === 'update') {
        if (existingIndex !== undefined) {
          const old = db.data.servers[existingIndex];
          db.data.servers[existingIndex] = {
            ...old,
            ...row,
            id: old.id, // maintain primary key
            updated_at: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          db.data.servers.push(row);
          newCount++;
        }
      } else if (strategy === 'synchronise') {
        if (existingIndex !== undefined) {
          const old = db.data.servers[existingIndex];
          db.data.servers[existingIndex] = {
            ...old,
            ...row,
            id: old.id,
            is_missing_from_source: false,
            updated_at: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          db.data.servers.push(row);
          newCount++;
        }
      }
    });

    // If synchronise, flag disappeared records without deleting (Section 4.1 Stage 4)
    if (strategy === 'synchronise') {
      db.data.servers.forEach(s => {
        const key = `${s.host.toLowerCase()}::${s.vm.toLowerCase()}`;
        if (!processedKeys.has(key)) {
          s.is_missing_from_source = true;
          s.updated_at = new Date().toISOString();
        }
      });
    }

    const historyItem: ImportHistoryItem = {
      id: crypto.randomUUID(),
      filename,
      import_date: new Date().toISOString(),
      user,
      strategy,
      total_records: incoming.length,
      new_records: newCount,
      updated_records: updatedCount,
      unchanged_records: unchangedCount,
      duplicate_records: duplicateCount,
      failed_records: failedCount,
      status: failedCount > 0 ? 'Completed with warnings' : 'Completed',
      errors: errors.length > 0 ? errors : undefined,
    };

    db.data.import_history.unshift(historyItem);
    db.logAudit(user, 'IMPORT_CSV', 'INVENTORY', historyItem.id, null, null, `Imported ${incoming.length} records (${strategy}): ${newCount} new, ${updatedCount} updated`);
    db.save();

    res.json({
      summary: historyItem,
      total_in_database: db.data.servers.length,
    });
  });

  api.get('/imports/history', (req: Request, res: Response) => {
    res.json(db.data.import_history);
  });

  // 14. AUDIT LOGS
  api.get('/audit-logs', (req: Request, res: Response) => {
    res.json(db.data.audit_logs);
  });

  // 15. RESET / SEED
  api.post('/seed/reset', (req: Request, res: Response) => {
    db.seedFromDefaultCsv();
    res.json({ success: true, count: db.data.servers.length });
  });

  // Mount API router
  app.use('/api', api);

  // Vite or Static file serving
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CSM Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[CSM Server] Fatal startup error:', err);
  process.exit(1);
});
