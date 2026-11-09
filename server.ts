import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import type {
  ServerRecord,
  Incident,
  IncidentHostDetail,
  IncidentImpact,
  PatchCampaign,
  PatchTarget,
  ImportHistoryItem,
  DashboardMetrics,
  AuthUser,
  UserRole,
} from './src/types/index.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_HOURS,
  buildSessionCookie,
  clearSessionCookie,
  hashPassword,
  isRole,
  normalizeEmail,
  parseCookies,
  requiredRolesFor,
  sanitizeUser,
  validatePassword,
  verifyPassword,
} from './auth.js';
import type { UserRecord } from './auth.js';
import { db as store } from './src/db/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const CSV_SOURCE_FILE = path.resolve(__dirname, 'public/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv');
const AUDIT_LOG_LIMIT = Math.max(500, parseInt(process.env.AUDIT_LOG_LIMIT || '5000', 10) || 5000);

/**
 * Trusted browser origins for CORS and the Origin/CSRF check.
 *
 * `ALLOWED_ORIGINS` is a comma-separated addition to the built-in deployment
 * origins. `APP_URL` is always included so a reverse-proxied deployment works
 * without duplicating its public URL.
 */
const normalizeOrigin = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate) return null;
  const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
};

const ALLOWED_ORIGINS = new Set<string>();
[
  'http://10.102.151.184:3001',
  'https://10.102.151.184:3001',
  'http://soc-cmdb.development.local:3001',
  'http://soc-cmdb.development.local',
  'https://soc-cmdb.development.local',
  'https://soc-cmdb.cybersamurai.co.uk',
  'http://soc-cmdb.cybersamurai.co.uk',
  'http://soc-cmdb.cybersamurai.co.uk:3001',
  'https://soc-cmdb.cybersamurai.co.uk:3001',
  'http://172.236.21.180:3001',
  'https://172.236.21.180:3001',
].forEach(origin => {
  const normalized = normalizeOrigin(origin);
  if (normalized) ALLOWED_ORIGINS.add(normalized);
});
(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .forEach(origin => {
    const normalized = normalizeOrigin(origin);
    if (normalized) ALLOWED_ORIGINS.add(normalized);
  });
if (process.env.APP_URL) {
  const normalized = normalizeOrigin(process.env.APP_URL);
  if (normalized) ALLOWED_ORIGINS.add(normalized);
}

const isAllowedOrigin = (origin: string | undefined, req: Request): boolean => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return origin === `${req.protocol}://${req.get('host')}`;
};

export function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\0/g, '') // remove null characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width / BOM chars
    .replace(/\r/g, '') // strip carriage returns
    .trim(); // trim leading and trailing whitespace
}

/** Parses a comma-separated query parameter into normalised match values. */
export function parseFilterList(value: string): string[] {
  return value.split(',').map(item => cleanString(item).toLowerCase()).filter(Boolean);
}

/** Case-insensitive equality against one or more candidate fields. */
export function matchesAnyFilter(wanted: string[], candidates: Array<string | undefined>): boolean {
  return wanted.some(value => candidates.some(candidate => cleanString(candidate).toLowerCase() === value));
}

/** Distinct, non-empty, trimmed string values in first-seen order. */
export function uniqueValues<T>(items: T[], pick: (item: T) => string | undefined | null): string[] {
  return Array.from(new Set(items.map(pick).map(cleanString).filter(Boolean)));
}

/** Convenience wrapper used by the metrics endpoints. */
export function countUnique<T>(items: T[], pick: (item: T) => string | undefined | null): number {
  return uniqueValues(items, pick).length;
}

/**
 * Text fields searched by the inventory quick filter. Kept in one place so the
 * table search and the global autocomplete cannot drift apart.
 */
const SERVER_SEARCH_FIELDS: Array<(server: ServerRecord) => string | undefined> = [
  server => server.host,
  server => server.vm,
  server => server.dns_name,
  server => server.primary_ip_address,
  server => server.manager,
  server => server.email,
  server => server.customer,
  server => server.business_unit,
  server => server.sub_business_unit,
  server => server.product,
  server => server.function,
  server => server.datacenter,
  server => server.network_1,
  server => server.network_2,
  server => server.network_3,
  server => server.organisation_short_code,
];

/** The global search box additionally matches support team and org abbreviation. */
const SERVER_GLOBAL_SEARCH_FIELDS = [
  ...SERVER_SEARCH_FIELDS,
  (server: ServerRecord) => server.support_team,
  (server: ServerRecord) => server.organisation_abbreviated,
];

const matchesServerSearch = (
  server: ServerRecord,
  query: string,
  fields: Array<(server: ServerRecord) => string | undefined>
): boolean => fields.some(field => (field(server) || '').toLowerCase().includes(query));

export function sanitizeServerRecord(record: Partial<ServerRecord>): ServerRecord {
  return {
    id: record.id || crypto.randomUUID(),
    host: cleanString(record.host),
    vm: cleanString(record.vm),
    support_team: cleanString(record.support_team),
    environment: cleanString(record.environment),
    manager: cleanString(record.manager),
    email: cleanString(record.email).toLowerCase(),
    customer: cleanString(record.customer),
    power_state: cleanString(record.power_state) || 'poweredOn',
    dns_name: cleanString(record.dns_name),
    primary_ip_address: cleanString(record.primary_ip_address),
    efi_secure_boot: record.efi_secure_boot !== undefined ? record.efi_secure_boot : null,
    annotation: cleanString(record.annotation),
    business_unit: cleanString(record.business_unit),
    sub_business_unit: cleanString(record.sub_business_unit),
    product: cleanString(record.product),
    function: cleanString(record.function),
    business_environment: cleanString(record.business_environment || record.environment),
    organisation_short_code: cleanString(record.organisation_short_code),
    organisation_abbreviated: cleanString(record.organisation_abbreviated),
    datacenter: cleanString(record.datacenter),
    network_1: cleanString(record.network_1),
    network_2: cleanString(record.network_2),
    network_3: cleanString(record.network_3),
    imported_at: record.imported_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_missing_from_source: record.is_missing_from_source || false,
  };
}

// ---------------------------------------------------------------------------
// Persistence: two embedded SQLite databases (auth + app) — see src/db/store.ts.
// `db` aliases the store singleton; a legacy data/csm_database.json is imported
// automatically on first boot and never modified.
// ---------------------------------------------------------------------------
const db = store;

/** Audit writer kept in the old call signature; values are parameterised. */
function logAudit(
  user: string,
  action: string,
  entity_type: string,
  entity_id: string,
  prev?: any,
  next?: any,
  details?: string,
  meta?: { actor_role?: UserRole; outcome?: 'success' | 'failure'; ip?: string; user_agent?: string }
): void {
  store.appendAudit(
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: user || 'system',
      action,
      entity_type,
      entity_id,
      previous_value: prev,
      new_value: next,
      details,
      actor_role: meta?.actor_role,
      outcome: meta?.outcome ?? 'success',
      ip: meta?.ip,
      user_agent: meta?.user_agent,
    },
    AUDIT_LOG_LIMIT,
  );
}

/** Rebuilds the demo dataset and writes it to the application database. */
function seedFromDefaultCsv(): number {
  let csvContent = '';
  if (fs.existsSync(CSV_SOURCE_FILE)) {
    csvContent = fs.readFileSync(CSV_SOURCE_FILE, 'utf-8');
  } else {
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

  const servers = parseCsvToServers(csvContent);

  const sampleIncidentId = crypto.randomUUID();
  const affectedServers = servers.slice(1, 4).map(s => s.id);
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

  const incidents = [
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
  servers.forEach((s, idx) => {
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

  const patch_campaigns = [
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

  const audit_logs = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user: 'System Provisioner',
      action: 'INITIAL_IMPORT',
      entity_type: 'INVENTORY',
      entity_id: 'ALL',
      details: `Imported initial inventory of ${servers.length} server records from CSM dataset`,
    },
  ];

  const import_history = [
    {
      id: crypto.randomUUID(),
      filename: 'MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv',
      import_date: new Date().toISOString(),
      user: 'System Provisioner',
      strategy: 'insert',
      total_records: servers.length,
      new_records: servers.length,
      updated_records: 0,
      unchanged_records: 0,
      duplicate_records: 0,
      failed_records: 0,
      status: 'Completed',
    },
  ];

  store.seedApp({ servers, incidents, patch_campaigns, audit_logs, import_history });
  console.log(`[DB] Seeded ${servers.length} server records.`);
  return servers.length;
}



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
      return cleanString(cols[idx]);
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

    records.push(sanitizeServerRecord(record));
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
  store.init();
  // Fresh install (no legacy JSON and empty SQLite) seeds the demo dataset.
  if (db.serverCount() === 0) seedFromDefaultCsv();
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // -------------------------------------------------------------------------
  // LOCAL AUTHENTICATION (air-gapped)
  // -------------------------------------------------------------------------
  const AUTH_MODE = (process.env.AUTH_MODE || 'local').toLowerCase();
  if (!['local', 'disabled', 'ldap'].includes(AUTH_MODE)) {
    throw new Error(`[AUTH] Unsupported AUTH_MODE "${AUTH_MODE}". Use local, ldap or disabled.`);
  }
  if (AUTH_MODE === 'ldap') {
    throw new Error('[AUTH] AUTH_MODE=ldap is not implemented yet. Use local for now.');
  }
  if (
    AUTH_MODE === 'disabled' &&
    (process.env.NODE_ENV === 'production' || process.env.ALLOW_INSECURE_DEV_AUTH !== '1')
  ) {
    throw new Error(
      '[AUTH] AUTH_MODE=disabled requires NODE_ENV=development (not production) and ALLOW_INSECURE_DEV_AUTH=1.'
    );
  }

  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const SESSION_SECURE = process.env.COOKIE_SECURE === '1' || IS_PRODUCTION;
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  app.disable('x-powered-by');

  // Security response headers. CSP is applied only in production so Vite HMR
  // and its inline/eval dev pipeline keep working during development.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (SESSION_SECURE) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (IS_PRODUCTION) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      );
    }
    next();
  });

  // CORS allowlist. This runs before the API/auth/CSRF layers so browser
  // preflights are answered without requiring a session cookie.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();

    if (!isAllowedOrigin(origin, req)) {
      return res.status(403).json({ error: 'Origin not allowed.' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.get('access-control-request-headers') || 'Content-Type, Accept, X-Requested-With',
      );
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }

    return next();
  });

  // Never cache authenticated or auth-related responses; vary by cookie as a
  // defense against shared-cache reuse of per-session JSON.
  app.use(['/api', '/auth'], (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Vary', 'Origin, Cookie');
    next();
  });

  // Basic CSRF hardening: reject cross-origin state changes from browsers.
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.headers.origin;
    const trustedOrigin = isAllowedOrigin(origin, req);
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite) && !trustedOrigin) {
      return res.status(403).json({ error: 'Cross-site request blocked.' });
    }
    if (origin && !trustedOrigin) {
      return res.status(403).json({ error: 'Cross-origin request blocked.' });
    }
    return next();
  });

  const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;

  const auditMeta = (
    req: Request,
    role?: UserRole,
    outcome: 'success' | 'failure' = 'success'
  ) => ({
    actor_role: role,
    outcome,
    ip: req.ip,
    user_agent: req.headers['user-agent'],
  });

  const findSessionUser = (req: Request): AuthUser | undefined => {
    if (AUTH_MODE === 'disabled') {
      return {
        id: 'local-dev',
        email: 'dev@localhost',
        name: 'Local Developer',
        role: 'admin',
      };
    }
    const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!sessionId) return undefined;
    const session = db.findSession(sessionId);
    if (!session || Date.parse(session.expires_at) <= Date.now()) return undefined;
    const user = db.findUser(session.user_id);
    return user && user.active ? sanitizeUser(user) : undefined;
  };

  const createSession = (user: UserRecord, req: Request): string => {
    const id = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    db.insertSession({
      id,
      user_id: user.id,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + SESSION_TTL_HOURS * 3600_000).toISOString(),
      ip: req.ip,
      user_agent: req.headers['user-agent'],
    });
    return id;
  };

  app.post('/auth/login', (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? '');
    const now = Date.now();
    const attempt = loginAttempts.get(email);
    if (attempt && attempt.lockedUntil > now) {
      logAudit(
        email || 'unknown',
        'LOGIN_LOCKED',
        'AUTH',
        email,
        null,
        null,
        'Login blocked by lockout',
        auditMeta(req, undefined, 'failure')
      );
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    if (attempt && attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
      loginAttempts.delete(email);
    }
    const previousFailures = attempt && attempt.lockedUntil === 0 ? attempt.count : 0;

    const user = db.findUserByEmail(email);
    if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
      const next = { count: previousFailures + 1, lockedUntil: 0 };
      if (next.count >= MAX_LOGIN_ATTEMPTS) next.lockedUntil = now + LOCKOUT_MS;
      loginAttempts.set(email, next);
      if (loginAttempts.size > 10_000) {
        for (const [key, value] of loginAttempts) {
          if (value.lockedUntil > 0 && value.lockedUntil <= now) loginAttempts.delete(key);
        }
      }
      logAudit(
        email || 'unknown',
        'LOGIN_FAILED',
        'AUTH',
        user?.id || '',
        null,
        null,
        'Invalid credentials',
        auditMeta(req, user?.role, 'failure')
      );
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    loginAttempts.delete(email);
    const loginAt = new Date().toISOString();
    db.setUserLastLogin(user.id, loginAt);
    db.pruneSessions();
    const sessionId = createSession(user, req);
    logAudit(
      user.email,
      'LOGIN_SUCCESS',
      'AUTH',
      user.id,
      null,
      null,
      'Signed in',
      auditMeta(req, user.role)
    );
    res.setHeader('Set-Cookie', buildSessionCookie(sessionId, SESSION_SECURE));
    return res.json({ user: sanitizeUser(user) });
  });

  app.post('/auth/logout', (req: Request, res: Response) => {
    const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = db.findSession(sessionId);
    if (session) {
      const user = db.findUser(session.user_id);
      db.deleteSession(sessionId);
      if (user) {
        logAudit(
          user.email,
          'LOGOUT',
          'AUTH',
          user.id,
          null,
          null,
          'Signed out',
          auditMeta(req, user.role)
        );
      }
    }
    res.setHeader('Set-Cookie', clearSessionCookie(SESSION_SECURE));
    res.json({ success: true });
  });

  const requireAuth: express.RequestHandler = (req, res, next) => {
    const user = findSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.user = user;
    return next();
  };

  const authorize: express.RequestHandler = (req, res, next) => {
    const user = req.user!;
    const required = requiredRolesFor(req.method, req.originalUrl.split('?')[0]);
    if (!required || required.includes(user.role)) return next();

    logAudit(
      user.email,
      'ACCESS_DENIED',
      'API',
      `${req.method} ${req.originalUrl.split('?')[0]}`,
      null,
      null,
      `Role ${user.role} attempted a restricted action`,
      auditMeta(req, user.role, 'failure')
    );
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  };

  // API Router
  const api = express.Router();

  api.use(requireAuth);
  api.use(authorize);

  // Enforce forced password rotation at the API boundary: users with a
  // temporary/bootstrap password may only read /me and change their password.
  api.use((req: Request, res: Response, next) => {
    if (!req.user?.must_change_password) return next();
    const path = req.path.replace(/\/+$/, '') || '/';
    if (path === '/me' || path === '/me/password') return next();
    return res
      .status(403)
      .json({ error: 'You must change your password before using the application.', code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  api.get('/me', (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  api.post('/me/password', (req: Request, res: Response) => {
    const record = db.findUser(req.user!.id);
    if (!record) return res.status(404).json({ error: 'User not found.' });

    const currentPassword = String(req.body?.current_password ?? '');
    const newPassword = String(req.body?.new_password ?? '');
    if (!verifyPassword(currentPassword, record.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const policyError = validatePassword(newPassword, record.email);
    if (policyError) return res.status(400).json({ error: policyError });

    const currentSessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    db.setUserPassword(record.id, hashPassword(newPassword), false);
    db.deleteSessionsForUserExcept(record.id, currentSessionId);
    logAudit(
      record.email,
      'PASSWORD_CHANGED',
      'AUTH',
      record.id,
      null,
      null,
      'Password changed by the user',
      auditMeta(req, record.role)
    );
    return res.json({ success: true });
  });

  // Directory for assignment pickers and the admin user screen.
  api.get('/users', (req: Request, res: Response) => {
    const includeInactive = req.query.all === '1' && req.user!.role === 'admin';
    const users = db.listUsers(includeInactive).map(sanitizeUser);
    res.json(users);
  });

  api.post('/users', (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    const name = cleanString(req.body?.name) || email;
    const role = req.body?.role;
    const password = String(req.body?.password ?? '');
    if (!email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
    if (!isRole(role)) return res.status(400).json({ error: 'Role must be viewer, analyst, manager or admin.' });
    if (db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    const policyError = validatePassword(password, email);
    if (policyError) return res.status(400).json({ error: policyError });

    const now = new Date().toISOString();
    const user: UserRecord = {
      id: crypto.randomUUID(),
      email,
      name,
      role,
      password_hash: hashPassword(password),
      active: true,
      must_change_password: true,
      created_at: now,
      updated_at: now,
    };
    db.insertUser(user);
    logAudit(
      req.user!.email,
      'USER_CREATED',
      'USER',
      user.id,
      null,
      sanitizeUser(user),
      `Created ${role} user ${email}`,
      auditMeta(req, req.user!.role)
    );
    res.status(201).json(sanitizeUser(user));
  });

  api.patch('/users/:id', (req: Request, res: Response) => {
    const user = db.findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const nextRole = req.body?.role;
    const nextActive = req.body?.active;
    if (nextRole !== undefined && !isRole(nextRole)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    const demotingLastAdmin =
      user.role === 'admin' &&
      (nextRole !== undefined && nextRole !== 'admin' || nextActive === false) &&
      db.countActiveAdmins() <= 1;
    if (demotingLastAdmin) {
      return res.status(400).json({ error: 'The last active administrator cannot be demoted or disabled.' });
    }
    if (user.id === req.user!.id && nextActive === false) {
      return res.status(400).json({ error: 'You cannot disable your own account.' });
    }

    const before = sanitizeUser(user);
    const fields: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body?.name !== undefined) fields.name = cleanString(req.body.name) || user.name;
    if (nextRole !== undefined) fields.role = nextRole;
    if (nextActive !== undefined) fields.active = Boolean(nextActive);
    db.updateUser(user.id, fields);
    if (fields.active === false) db.deleteSessionsForUser(user.id);
    const updatedUser = { ...user, ...fields };
    logAudit(
      req.user!.email,
      'USER_UPDATED',
      'USER',
      user.id,
      before,
      sanitizeUser(updatedUser),
      `Updated user ${user.email}`,
      auditMeta(req, req.user!.role)
    );
    res.json(sanitizeUser(updatedUser));
  });

  api.post('/users/:id/reset-password', (req: Request, res: Response) => {
    const user = db.findUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const password = String(req.body?.password ?? '');
    const policyError = validatePassword(password, user.email);
    if (policyError) return res.status(400).json({ error: policyError });

    db.setUserPassword(user.id, hashPassword(password), true);
    db.deleteSessionsForUser(user.id);
    logAudit(
      req.user!.email,
      'PASSWORD_RESET',
      'USER',
      user.id,
      null,
      null,
      `Reset password for ${user.email}`,
      auditMeta(req, req.user!.role)
    );
    res.json({ success: true });
  });

  // 1. STATS / DASHBOARD METRICS (dynamically calculated)
  api.get('/stats', (req: Request, res: Response) => {
    const servers = db.allServers();
    const total = servers.length;
    const poweredOn = servers.filter(s => (s.power_state || '').toLowerCase() === 'poweredon').length;
    const poweredOff = total - poweredOn;

    const buCount = countUnique(servers, s => s.business_unit);
    const subBuCount = countUnique(servers, s => s.sub_business_unit);
    const productCount = countUnique(servers, s => s.product);
    const supportTeamCount = countUnique(servers, s => s.support_team);
    const dcCount = countUnique(servers, s => s.datacenter);
    const managerCount = countUnique(servers, s => s.manager);

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
      total_products: productCount,
      total_business_units: buCount,
      total_sub_business_units: subBuCount,
      total_support_teams: supportTeamCount,
      total_datacenters: dcCount,
      total_unique_managers: managerCount,
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
    let list = db.allServers();

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
      vm,
      primary_ip_address,
      email,
      dns_name,
      q,
      sort_by = 'host',
      sort_order = 'asc',
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    // Multi-attribute filtering. Every comma-separated value is matched
    // case-insensitively; business_unit and sub_business_unit intentionally
    // cross-match each other (a BU filter also accepts a sub-BU name).
    if (business_unit) {
      const wanted = parseFilterList(business_unit);
      list = list.filter(s => matchesAnyFilter(wanted, [s.business_unit, s.sub_business_unit]));
    }
    if (sub_business_unit) {
      const wanted = parseFilterList(sub_business_unit);
      list = list.filter(s => matchesAnyFilter(wanted, [s.business_unit, s.sub_business_unit]));
    }
    if (customer) {
      const wanted = parseFilterList(customer);
      list = list.filter(s => matchesAnyFilter(wanted, [s.customer]));
    }
    if (manager) {
      const wanted = parseFilterList(manager);
      const wantsUnassigned = wanted.some(value =>
        ['unassigned', 'missing', 'none', 'empty'].includes(value.toLowerCase()),
      );
      list = list.filter(
        s =>
          (wantsUnassigned && !cleanString(s.manager)) ||
          matchesAnyFilter(wanted, [s.manager]),
      );
    }
    if (support_team) {
      const wanted = parseFilterList(support_team);
      list = list.filter(s => matchesAnyFilter(wanted, [s.support_team]));
    }
    if (environment) {
      const wanted = parseFilterList(environment);
      list = list.filter(s => matchesAnyFilter(wanted, [s.environment]));
    }
    if (power_state) {
      const wanted = parseFilterList(power_state);
      list = list.filter(s => matchesAnyFilter(wanted, [s.power_state]));
    }
    if (datacenter) {
      const wanted = parseFilterList(datacenter);
      list = list.filter(s => matchesAnyFilter(wanted, [s.datacenter]));
    }
    if (product) {
      const wanted = parseFilterList(product);
      list = list.filter(s => matchesAnyFilter(wanted, [s.product]));
    }
    if (func) {
      const wanted = parseFilterList(func);
      list = list.filter(s => matchesAnyFilter(wanted, [s.function]));
    }
    if (secure_boot !== undefined && secure_boot !== '') {
      const wanted = secure_boot.toLowerCase();
      list = list.filter(s => {
        if (wanted === 'true') return s.efi_secure_boot === true;
        if (wanted === 'false') return s.efi_secure_boot === false;
        if (wanted === 'unknown' || wanted === 'null') return s.efi_secure_boot === null;
        return true;
      });
    }
    if (network) {
      const wanted = cleanString(network).toLowerCase();
      list = list.filter(
        s =>
          cleanString(s.network_1).toLowerCase().includes(wanted) ||
          cleanString(s.network_2).toLowerCase().includes(wanted) ||
          cleanString(s.network_3).toLowerCase().includes(wanted)
      );
    }
    if (host) {
      const wanted = cleanString(host).toLowerCase();
      list = list.filter(s => cleanString(s.host).toLowerCase() === wanted);
    }
    if (vm) {
      const wanted = parseFilterList(vm);
      list = list.filter(s => matchesAnyFilter(wanted, [s.vm]));
    }
    if (primary_ip_address) {
      const wanted = parseFilterList(primary_ip_address);
      list = list.filter(s => matchesAnyFilter(wanted, [s.primary_ip_address]));
    }
    if (email) {
      const wanted = parseFilterList(email);
      list = list.filter(s => matchesAnyFilter(wanted, [s.email]));
    }
    if (dns_name) {
      const wanted = parseFilterList(dns_name);
      list = list.filter(s => matchesAnyFilter(wanted, [s.dns_name]));
    }

    // Global Query inside table
    if (q) {
      const query = q.toLowerCase();
      list = list.filter(server => matchesServerSearch(server, query, SERVER_SEARCH_FIELDS));
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

    const matches = db.allServers().filter(server =>
      matchesServerSearch(server, q, SERVER_GLOBAL_SEARCH_FIELDS)
    );

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
    const server = db.findServer(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Find correlated infrastructure entities
    const sameHostServers = db.allServers()
      .filter(s => s.id !== server.id && s.host && s.host.toLowerCase() === server.host.toLowerCase())
      .map(s => ({ id: s.id, vm: s.vm, ip: s.primary_ip_address, bu: s.business_unit }));

    const serverNetworks = [server.network_1, server.network_2, server.network_3].filter(Boolean);
    const sameNetworkServers = db.allServers()
      .filter(s => {
        if (s.id === server.id) return false;
        const nets = [s.network_1, s.network_2, s.network_3].filter(Boolean);
        return serverNetworks.some(sn => nets.includes(sn));
      })
      .map(s => ({ id: s.id, host: s.host, vm: s.vm, ip: s.primary_ip_address, bu: s.business_unit }));

    const sameManagerServers = db.allServers()
      .filter(s => s.id !== server.id && s.manager && s.manager.toLowerCase() === server.manager.toLowerCase())
      .map(s => ({ id: s.id, host: s.host, vm: s.vm, bu: s.business_unit }));

    const history =
      req.user?.role === 'viewer'
        ? []
        : db.allAudit().filter(
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

    const newServer = sanitizeServerRecord({
      ...body,
      id: crypto.randomUUID(),
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    db.insertServer(newServer);
    logAudit(req.user?.email || body.updated_by || 'system', 'CREATE_SERVER', 'SERVER', newServer.id, null, newServer, `Created server ${newServer.host} (${newServer.vm})`);
    res.status(201).json(newServer);
  });

  api.put('/servers/:id', (req: Request, res: Response) => {
    const prev = db.findServer(req.params.id);
    if (!prev) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const updated = sanitizeServerRecord({
      ...prev,
      ...req.body,
      id: prev.id, // preserve id
      updated_at: new Date().toISOString(),
    });

    db.updateServer(prev.id, updated);
    logAudit(req.user?.email || req.body.updated_by || 'system', 'UPDATE_SERVER', 'SERVER', updated.id, prev, updated, `Updated attributes for ${updated.host}`);
    res.json(updated);
  });

  api.delete('/servers/:id', (req: Request, res: Response) => {
    const removed = db.findServer(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Server not found' });
    }
    db.deleteServer(removed.id);
    logAudit(req.user?.email ?? 'system', 'DELETE_SERVER', 'SERVER', removed.id, removed, null, `Deleted server ${removed.host}`);
    res.json({ success: true, removed });
  });

  // 6. BUSINESS UNITS EXPLORER & RELATIONSHIPS (Section 9)
  api.get('/business-units', (req: Request, res: Response) => {
    const servers = db.allServers();
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
    const buName = req.params.name;
    const servers = db.allServers().filter(
      s => (s.business_unit || '').toLowerCase() === buName.toLowerCase()
    );

    if (servers.length === 0 && buName.toLowerCase() !== 'unassigned') {
      return res.status(404).json({ error: 'Business unit not found' });
    }

    const subBUs = uniqueValues(servers, s => s.sub_business_unit);
    const products = uniqueValues(servers, s => s.product);
    const functions = uniqueValues(servers, s => s.function);
    const environments = uniqueValues(servers, s => s.environment);
    const datacenters = uniqueValues(servers, s => s.datacenter);
    const supportTeams = uniqueValues(servers, s => s.support_team);

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
    const servers = db.allServers();
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

    db.allServers().forEach(s => {
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
    const mgrName = req.params.name;
    const servers = db.allServers().filter(
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

    db.allServers().forEach(s => {
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
    const netName = req.params.name.toLowerCase();
    const servers = db.allServers().filter(
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

    db.allServers().forEach(s => {
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
    res.json(db.allIncidents());
  });

  api.post('/incidents', (req: Request, res: Response) => {
    const body = req.body;
    if (!body.incident_title) {
      return res.status(400).json({ error: 'Incident title is required' });
    }

    const requestedIds: unknown[] = Array.isArray(body.affected_server_ids) ? body.affected_server_ids : [];
    const existingServerIds = new Set(db.allServers().map(s => s.id));
    const affectedIds = new Set<string>(
      requestedIds.filter(
        (id): id is string => typeof id === 'string' && existingServerIds.has(id),
      ),
    );
    if (body.raw_input && typeof body.raw_input === 'string') {
      const tokens = body.raw_input.split(/[\r\n,;\s]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      tokens.forEach((token: string) => {
        const found = db.allServers().filter(
          s =>
            (s.host || '').toLowerCase() === token ||
            (s.vm || '').toLowerCase() === token ||
            (s.primary_ip_address || '').toLowerCase() === token ||
            (s.dns_name || '').toLowerCase() === token
        );
        found.forEach(s => affectedIds.add(s.id));
      });
    }

    const initialHostDetails: Record<string, IncidentHostDetail> = {};
    affectedIds.forEach(id => {
      initialHostDetails[id] = {
        server_id: id,
        status: 'To be contacted',
        patching_status: 'Not Started',
        communicated: false,
      };
    });

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
      host_details: initialHostDetails,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.insertIncident(newInc);
    logAudit(req.user?.email || body.user || 'system', 'CREATE_INCIDENT', 'INCIDENT', newInc.id, null, newInc, `Created incident ${newInc.incident_reference} with ${newInc.affected_server_ids.length} host(s)`);
    res.status(201).json(newInc);
  });

  api.get('/incidents/:id', (req: Request, res: Response) => {
    const inc = db.findIncident(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    res.json(inc);
  });

  api.put('/incidents/:id', (req: Request, res: Response) => {
    const prev = db.findIncident(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Incident not found' });

    const updated = {
      ...prev,
      ...req.body,
      id: prev.id,
      updated_at: new Date().toISOString(),
    };

    db.updateIncident(prev.id, updated);
    logAudit(req.user?.email ?? 'system', 'UPDATE_INCIDENT', 'INCIDENT', updated.id, prev, updated, `Updated ${updated.incident_reference}`);
    res.json(updated);
  });

  // Update one host's triage state inside an incident (single canonical handler)
  api.put('/incidents/:id/hosts/:serverId', (req: Request, res: Response) => {
    const inc = db.findIncident(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    const serverId = req.params.serverId;
    const before = inc.host_details?.[serverId] ? { ...inc.host_details[serverId] } : null;
    const detail = {
      ...(inc.host_details?.[serverId] || { server_id: serverId, status: 'To be contacted', notes: '' }),
      ...req.body,
      server_id: serverId,
      updated_by: req.user?.email,
      updated_at: new Date().toISOString(),
    };
    db.upsertIncidentHost(inc.id, serverId, detail);
    db.touchIncident(inc.id, new Date().toISOString());
    logAudit(
      req.user?.email ?? 'system',
      'UPDATE_INCIDENT_HOST',
      'INCIDENT',
      inc.id,
      before,
      detail,
      `Updated host ${serverId} in ${inc.incident_reference}`,
      auditMeta(req, req.user?.role)
    );
    res.json(detail);
  });

  // Batch Add Affected Servers by hostnames, IPs, or IDs (Section 12.2: Reports matched and unmatched!)
  api.post('/incidents/:id/servers', (req: Request, res: Response) => {
    const inc = db.findIncident(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const { raw_input, server_ids } = req.body;
    const currentIds = new Set<string>(inc.affected_server_ids as string[]);
    const matchedServers: ServerRecord[] = [];
    const unmatchedEntries: string[] = [];

    if (Array.isArray(server_ids)) {
      server_ids.forEach(id => {
        const found = db.findServer(id);
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
        const found = db.allServers().filter(
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

    for (const id of currentIds) {
      db.upsertIncidentHost(inc.id, id, { server_id: id });
    }
    db.touchIncident(inc.id, new Date().toISOString());
    const affectedIds = Array.from(currentIds);

    logAudit(req.user?.email ?? 'system', 'ADD_INCIDENT_SERVERS', 'INCIDENT', inc.id, null, null, `Added ${matchedServers.length} affected servers to ${inc.incident_reference}`);

    res.json({
      incident: { ...inc, affected_server_ids: affectedIds },
      total_affected: affectedIds.length,
      matched_count: matchedServers.length,
      unmatched_count: unmatchedEntries.length,
      matched_servers: matchedServers,
      unmatched_entries: unmatchedEntries,
    });
  });

  // Remove host from incident
  api.delete('/incidents/:id/servers/:serverId', (req: Request, res: Response) => {
    const inc = db.findIncident(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const serverId = req.params.serverId;
    db.deleteIncidentHost(inc.id, serverId);
    db.touchIncident(inc.id, new Date().toISOString());
    logAudit(req.user?.email ?? 'system', 'REMOVE_INCIDENT_SERVER', 'INCIDENT', inc.id, null, null, `Removed server ${serverId} from ${inc.incident_reference}`);

    res.json({ success: true, remaining: (inc.affected_server_ids as string[]).filter(id => id !== serverId).length });
  });

  // Calculate Impact & Correlation Leads (Section 12.3 & 12.4)
  api.get('/incidents/:id/impact', (req: Request, res: Response) => {
    const inc = db.findIncident(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const affected = db.allServers().filter(s => inc.affected_server_ids.includes(s.id));

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
    res.json(db.allCampaigns());
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

    db.insertCampaign(campaign);
    logAudit(req.user?.email || body.user || 'system', 'CREATE_CAMPAIGN', 'CAMPAIGN', campaign.id, null, campaign, `Created patch campaign ${campaign.campaign_name}`);
    res.status(201).json(campaign);
  });

  api.get('/patching/campaigns/:id', (req: Request, res: Response) => {
    const campaign = db.findCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Join target server records
    const targets: Record<string, any> = campaign.targets ?? {};
    const targetList = Object.entries(targets).map(([serverId, target]) => {
      const server = db.findServer(serverId);
      return {
        ...target,
        server,
      };
    });

    // Compute progress stats
    const totalTargets = Object.keys(targets).length;
    const patchedCount = Object.values(targets).filter(t => t.status === 'Patched' || t.status === 'Validated').length;
    const pendingCount = Object.values(targets).filter(t => t.status !== 'Patched' && t.status !== 'Validated' && t.status !== 'Not affected' && t.status !== 'Exception granted').length;
    const validationRequired = Object.values(targets).filter(t => t.status === 'Validation required').length;

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
    const prev = db.findCampaign(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Campaign not found' });

    const updated = {
      ...prev,
      ...req.body,
      id: prev.id,
      updated_at: new Date().toISOString(),
    };

    db.updateCampaign(prev.id, updated);
    res.json(updated);
  });

  api.put('/patching/campaigns/:id/servers/:serverId', (req: Request, res: Response) => {
    const campaign = db.findCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const serverId = req.params.serverId;
    const prevTarget = campaign.targets[serverId] || { server_id: serverId, status: 'Not assessed', notes: '' };

    const target = {
      ...prevTarget,
      ...req.body,
      server_id: serverId,
      patched_at: req.body.status === 'Patched' ? (prevTarget.patched_at || new Date().toISOString()) : prevTarget.patched_at,
    };
    db.upsertCampaignTarget(campaign.id, serverId, target);
    db.touchCampaign(campaign.id, new Date().toISOString());

    logAudit(req.user?.email ?? 'system', 'UPDATE_PATCH_STATUS', 'CAMPAIGN', campaign.id, prevTarget, target, `Updated server ${serverId} status to ${req.body.status}`);
    res.json(target);
  });

  /**
   * Masks the first two octets of an IPv4 address before it is written into an
   * outbound stakeholder message, e.g. 152.114.2.55 -> ***.***.2.55.
   * Anything that is not a plain IPv4 address is left untouched so hostnames
   * and IPv6 addresses are not mangled.
   */
  const maskIpForMessage = (ip: unknown): string => {
    const raw = cleanString(ip);
    if (!raw) return 'N/A';

    const slashIndex = raw.indexOf('/');
    const address = slashIndex === -1 ? raw : raw.slice(0, slashIndex);
    const suffix = slashIndex === -1 ? '' : raw.slice(slashIndex);
    const octets = address.split('.');

    if (octets.length === 4 && octets.every(octet => /^\d{1,3}$/.test(octet))) {
      return `***.***.${octets[2]}.${octets[3]}${suffix}`;
    }

    return raw;
  };

  // 12. COMMUNICATIONS CENTRE (Section 14)
  api.post('/communications/preview', (req: Request, res: Response) => {
    const { server_ids, template_type, incident_reference, incident_title, severity, target_date, contact_id } = req.body;

    let selectedServers: ServerRecord[] = [];
    if (Array.isArray(server_ids) && server_ids.length > 0) {
      selectedServers = db.allServers().filter(s => server_ids.includes(s.id));
    } else {
      selectedServers = db.allServers();
    }

    // Deduplicate contacts by email
    const contactMap = new Map<string, {
      id: string;
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
          id: key,
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
      id: c.id,
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
      ownership: {
        subject: `[OWNERSHIP CONFIRMATION] Verification of Asset Responsibility`,
        body: `Dear {{manager_name}},\n\nAs part of our periodic asset hygiene review, please confirm whether you remain the designated technical and operational manager for the following {{affected_server_count}} server(s) in {{business_unit}}:\n\n{{affected_servers}}\n\nIf any system has transitioned or been decommissioned, please notify us.\n\nThank you,\nConfiguration Management Team`,
      },
    };

    const chosen = templates[template_type || 'incident'] || templates.incident;

    // Build the preview for the stakeholder the operator selected in the
    // directory. Fall back to the first contact when no (or a stale) id is sent.
    const requestedContactId = typeof contact_id === 'string' ? contact_id : '';
    const previewContact = (requestedContactId
      ? contactList.find(c => c.id === requestedContactId)
      : undefined) || contactList[0] || {
      id: 'john.lennon@acme.com',
      manager: 'John Lennon',
      email: 'john.lennon@acme.com',
      business_unit: 'BRICK',
      missing_email: false,
      server_count: 1,
      servers: [{ host: 'br1-sse-esx-23.prd.local', vm: 'br1-VM-SSS-3', ip: '10.200.68.76', bu: 'BRICK' }],
    };

    const formatServerList = (srvs: Array<{ host: string; vm: string; ip: string }>) =>
      srvs
        .map(s => `  • VM: ${s.vm} | IP: ${maskIpForMessage(s.ip)}`)
        .join('\n');

    const previewSubject = chosen.subject
      .replace(/{{incident_reference}}/g, incident_reference || 'INC-2026-0842')
      .replace(/{{incident_title}}/g, incident_title || 'Critical Patching Advisory')
      .replace(/{{severity}}/g, severity || 'Critical')
      .replace(/{{business_unit}}/g, previewContact.business_unit || 'Default BU');

    const previewBody = chosen.body
      .replace(/{{manager_name}}/g, previewContact.manager)
      .replace(/{{business_unit}}/g, previewContact.business_unit)
      .replace(/{{incident_reference}}/g, incident_reference || 'INC-2026-0842')
      .replace(/{{incident_title}}/g, incident_title || 'Critical Patching Advisory')
      .replace(/{{severity}}/g, severity || 'Critical')
      .replace(/{{affected_server_count}}/g, String(previewContact.server_count ?? previewContact.servers.length))
      .replace(/{{affected_servers}}/g, formatServerList(previewContact.servers))
      .replace(/{{target_completion_date}}/g, target_date || '2026-11-15');

    res.json({
      total_contacts: contactList.length,
      valid_emails: contactList.filter(c => !c.missing_email).length,
      missing_emails: contactList.filter(c => c.missing_email).length,
      contacts: contactList,
      preview_contact_id: previewContact.id,
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
    const existingHosts = new Set(db.allServers().map(s => (s.host || '').toLowerCase()));
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
    const { csv_content, filename = 'import.csv', strategy = 'update' } = req.body;
    const user = req.user?.email || 'system';
    if (!csv_content) return res.status(400).json({ error: 'No CSV content provided' });

    const incoming = parseCsvToServers(csv_content);
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    const existing = new Map<string, any>();
    for (const srv of db.allServers()) {
      existing.set(`${srv.host.toLowerCase()}::${srv.vm.toLowerCase()}`, srv);
    }

    const processedKeys = new Set<string>();

    db.transaction(() => {
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

        const old = existing.get(key);
        const nowIso = new Date().toISOString();

        if (strategy === 'insert') {
          if (old) {
            duplicateCount++;
          } else {
            db.insertServer(row);
            newCount++;
          }
        } else if (strategy === 'update') {
          if (old) {
            db.updateServer(old.id, { ...old, ...row, id: old.id, updated_at: nowIso });
            updatedCount++;
          } else {
            db.insertServer(row);
            newCount++;
          }
        } else if (strategy === 'synchronise') {
          if (old) {
            db.updateServer(old.id, { ...old, ...row, id: old.id, is_missing_from_source: false, updated_at: nowIso });
            updatedCount++;
          } else {
            db.insertServer(row);
            newCount++;
          }
        }
      });

      // If synchronise, flag disappeared records without deleting (Section 4.1 Stage 4)
      if (strategy === 'synchronise') {
        for (const srv of db.allServers()) {
          const key = `${srv.host.toLowerCase()}::${srv.vm.toLowerCase()}`;
          if (!processedKeys.has(key)) {
            db.updateServer(srv.id, { ...srv, is_missing_from_source: true, updated_at: new Date().toISOString() });
          }
        }
      }
    });

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

    db.insertImportHistory(historyItem);
    logAudit(req.user?.email || user || 'system', 'IMPORT_CSV', 'INVENTORY', historyItem.id, null, null, `Imported ${incoming.length} records (${strategy}): ${newCount} new, ${updatedCount} updated`);

    res.json({
      summary: historyItem,
      total_in_database: db.serverCount(),
    });
  });

  api.get('/imports/history', (req: Request, res: Response) => {
    res.json(db.allImportHistory());
  });

  // 14. AUDIT LOGS
  api.get('/audit-logs', (req: Request, res: Response) => {
    res.json(db.allAudit());
  });

  // 15. RESET / SEED
  // The manual demo-reset endpoint was removed. The initial demo dataset is
  // still seeded automatically only when a fresh database has no servers.

  // Mount API router
  app.use('/api', api);

  // JSON 404 for unknown API routes (before the static/SPA fallback).
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found.' });
  });

  const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');

  // Vite or Static file serving
  if (IS_PRODUCTION) {
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

  // Central error handler: return JSON and never expose stack traces.
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('[HTTP] Unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Internal server error.' });
  });

  app.listen(PORT, HOST, () => {
    console.log(`[CSM Server] Running on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[CSM Server] Fatal startup error:', err);
  process.exit(1);
});
