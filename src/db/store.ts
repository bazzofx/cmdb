// Persistence layer: two embedded SQLite databases (kept separate by design).
//
//   data/auth.sqlite — users and sessions (the "user database")
//   data/cmdb.sqlite — servers, incidents, patch campaigns, audit log,
//                      import history (the "application database")
//
// SQLite best practices enforced per connection:
//   * WAL journal mode
//   * foreign_keys = ON
//   * busy_timeout so concurrent writers wait instead of failing
//   * synchronous = NORMAL (WAL makes this durable while keeping writes fast)
//   * prepared statements for every query; values always passed as parameters
//
// On first boot, if the SQLite store is empty and a legacy data/csm_database.json
// exists, the store imports it. The JSON file is never modified or deleted.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const DB_DIR = path.resolve(__dirname, '..', '..', 'db');

const AUTH_DB = path.join(DATA_DIR, 'auth.sqlite');
const APP_DB = path.join(DATA_DIR, 'cmdb.sqlite');
const LEGACY_JSON = path.join(DATA_DIR, 'csm_database.json');

const AUTH_SCHEMA = path.join(DB_DIR, 'auth.sql');
const APP_SCHEMA = path.join(DB_DIR, 'app.sql');

type Row = any;

const toInt = (value: unknown): number | null =>
  value === true ? 1 : value === false ? 0 : value === null || value === undefined ? null : Number(value);

const toBool = (value: unknown): boolean | null | undefined =>
  value === null || value === undefined ? value : value === 1;

const toJson = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

const fromJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

function openDb(file: string, schemaFile: string): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(fs.readFileSync(schemaFile, 'utf-8'));
  return db;
}

export class Store {
  private auth: DatabaseSync;
  private app: DatabaseSync;
  private txDepth = 0;

  constructor() {
    this.auth = openDb(AUTH_DB, AUTH_SCHEMA);
    this.app = openDb(APP_DB, APP_SCHEMA);
  }

  /** Runs fn inside a single application-DB transaction; nested calls are no-ops. */
  transaction<T>(fn: () => T): T {
    if (this.txDepth === 0) this.app.exec('BEGIN IMMEDIATE');
    this.txDepth++;
    try {
      const result = fn();
      this.txDepth--;
      if (this.txDepth === 0) this.app.exec('COMMIT');
      return result;
    } catch (err) {
      this.txDepth--;
      if (this.txDepth === 0) this.app.exec('ROLLBACK');
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // lifecycle
  // -------------------------------------------------------------------------

  init(): void {
    this.auth.prepare(`UPDATE users SET role = 'manager' WHERE role = 'steward'`).run();
    this.ensureServerColumns();
    this.migrateFromJsonIfEmpty();
    this.ensureBootstrapAdmin();
    this.pruneSessions();
  }

  /**
   * Adds columns introduced after the first SQLite release without rebuilding
   * the servers table. `CREATE TABLE IF NOT EXISTS` in app.sql only covers
   * fresh databases.
   */
  private ensureServerColumns(): void {
    const existing = new Set(
      (this.app.prepare(`PRAGMA table_info(servers)`).all() as Row[]).map(row => String(row.name)),
    );
    const additions: Array<[string, string]> = [
      ['support_team_lookup_csm', "TEXT NOT NULL DEFAULT ''"],
      ['team', "TEXT NOT NULL DEFAULT ''"],
      ['service', "TEXT NOT NULL DEFAULT ''"],
      ['initials', "TEXT NOT NULL DEFAULT ''"],
      ['total_servers_to_patch', 'INTEGER'],
      ['engineer_notes', "TEXT NOT NULL DEFAULT ''"],
      ['status', "TEXT NOT NULL DEFAULT ''"],
      ['swg_check', "TEXT NOT NULL DEFAULT ''"],
      ['source', "TEXT NOT NULL DEFAULT ''"],
    ];
    for (const [name, definition] of additions) {
      if (!existing.has(name)) {
        this.app.exec(`ALTER TABLE servers ADD COLUMN ${name} ${definition}`);
      }
    }
  }

  /** Compatibility shim: SQLite commits per statement, so there is no full save. */
  save(): void {
    // Intentionally empty.
  }

  // -------------------------------------------------------------------------
  // users (auth database)
  // -------------------------------------------------------------------------

  private userFromRow(r: Row): Row {
    return { ...r, active: r.active === 1, must_change_password: r.must_change_password === 1 };
  }

  listUsers(includeInactive = false): Row[] {
    const rows = this.auth.prepare(`SELECT * FROM users WHERE ? = 1 OR active = 1 ORDER BY created_at ASC`).all(includeInactive ? 1 : 0) as Row[];
    return rows.map((r) => this.userFromRow(r));
  }

  findUserByEmail(email: string): Row | undefined {
    const r = this.auth.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as Row | undefined;
    return r ? this.userFromRow(r) : undefined;
  }

  findUser(id: string): Row | undefined {
    const r = this.auth.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Row | undefined;
    return r ? this.userFromRow(r) : undefined;
  }

  insertUser(u: Row): void {
    this.auth.prepare(
      `INSERT INTO users (id, email, name, role, password_hash, active, must_change_password, created_at, updated_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      u.id, u.email, u.name, u.role, u.password_hash,
      u.active === false ? 0 : 1, u.must_change_password === false ? 0 : 1,
      u.created_at, u.updated_at, u.last_login_at ?? null,
    );
  }

  updateUser(id: string, fields: Record<string, any>): void {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    this.auth.prepare(`UPDATE users SET ${set} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
  }

  setUserPassword(id: string, hash: string, mustChange: boolean): void {
    this.auth.prepare(`UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?`)
      .run(hash, mustChange ? 1 : 0, new Date().toISOString(), id);
  }

  setUserLastLogin(id: string, at: string): void {
    this.auth.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(at, at, id);
  }

  countActiveAdmins(): number {
    const row = this.auth.prepare(`SELECT count(*) AS n FROM users WHERE role = 'admin' AND active = 1`).get() as Row;
    return Number(row.n);
  }

  // -------------------------------------------------------------------------
  // sessions (auth database)
  // -------------------------------------------------------------------------

  findSession(id: string): Row | undefined {
    return this.auth.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Row | undefined;
  }

  insertSession(s: Row): void {
    this.auth.prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(s.id, s.user_id, s.created_at, s.expires_at, s.ip ?? null, s.user_agent ?? null);
  }

  deleteSession(id: string): void {
    this.auth.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  }

  deleteSessionsForUser(userId: string): void {
    this.auth.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  }

  deleteSessionsForUserExcept(userId: string, keepId: string): void {
    this.auth.prepare(`DELETE FROM sessions WHERE user_id = ? AND id <> ?`).run(userId, keepId);
  }

  pruneSessions(): void {
    this.auth.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(new Date().toISOString());
  }

  sessionCount(): number {
    const row = this.auth.prepare(`SELECT count(*) AS n FROM sessions`).get() as Row;
    return Number(row.n);
  }

  // -------------------------------------------------------------------------
  // servers (application database)
  // -------------------------------------------------------------------------

  private serverFromRow(r: Row): Row {
    return {
      ...r,
      efi_secure_boot: toBool(r.efi_secure_boot),
      total_servers_to_patch: r.total_servers_to_patch === null || r.total_servers_to_patch === undefined
        ? null
        : Number(r.total_servers_to_patch),
      is_missing_from_source: r.is_missing_from_source === 1,
    };
  }

  allServers(): Row[] {
    const rows = this.app.prepare(`SELECT * FROM servers`).all() as Row[];
    return rows.map((r) => this.serverFromRow(r));
  }

  findServer(id: string): Row | undefined {
    const r = this.app.prepare(`SELECT * FROM servers WHERE id = ?`).get(id) as Row | undefined;
    return r ? this.serverFromRow(r) : undefined;
  }

  findServerByKey(hostLower: string, vmLower: string): Row | undefined {
    const r = this.app.prepare(`SELECT * FROM servers WHERE lower(host) = ? AND lower(vm) = ?`).get(hostLower, vmLower) as Row | undefined;
    return r ? this.serverFromRow(r) : undefined;
  }

  insertServer(s: Row): void {
    this.app.prepare(
      `INSERT INTO servers
        (id, host, vm, support_team, support_team_lookup_csm, team, service, initials, total_servers_to_patch,
         engineer_notes, status, swg_check, source, environment, manager, email, customer, power_state,
         dns_name, primary_ip_address, efi_secure_boot, annotation,
         business_unit, business_unit_id, sub_business_unit, sub_business_unit_id,
         product, product_id, function, business_environment,
         organisation_short_code, organisation_abbreviated,
         datacenter, datacenter_id, network_1, network_2, network_3,
         imported_at, updated_at, source_record_hash, is_missing_from_source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      s.id, s.host, s.vm, s.support_team, s.support_team_lookup_csm ?? '', s.team ?? '', s.service ?? '', s.initials ?? '', s.total_servers_to_patch ?? null,
      s.engineer_notes ?? '', s.status ?? '', s.swg_check ?? '', s.source ?? '', s.environment, s.manager, s.email, s.customer,
      s.power_state, s.dns_name, s.primary_ip_address, toInt(s.efi_secure_boot), s.annotation,
      s.business_unit, s.business_unit_id ?? null, s.sub_business_unit, s.sub_business_unit_id ?? null,
      s.product, s.product_id ?? null, s.function, s.business_environment,
      s.organisation_short_code, s.organisation_abbreviated,
      s.datacenter, s.datacenter_id ?? null, s.network_1, s.network_2, s.network_3,
      s.imported_at, s.updated_at, s.source_record_hash ?? null, s.is_missing_from_source ? 1 : 0,
    );
  }

  updateServer(id: string, s: Row): void {
    this.app.prepare(
      `UPDATE servers SET
         host = ?, vm = ?, support_team = ?, support_team_lookup_csm = ?, team = ?, service = ?, initials = ?, total_servers_to_patch = ?,
         engineer_notes = ?, status = ?, swg_check = ?, source = ?, environment = ?, manager = ?, email = ?, customer = ?,
         power_state = ?, dns_name = ?, primary_ip_address = ?, efi_secure_boot = ?, annotation = ?,
         business_unit = ?, business_unit_id = ?, sub_business_unit = ?, sub_business_unit_id = ?,
         product = ?, product_id = ?, function = ?, business_environment = ?,
         organisation_short_code = ?, organisation_abbreviated = ?,
         datacenter = ?, datacenter_id = ?, network_1 = ?, network_2 = ?, network_3 = ?,
         imported_at = ?, updated_at = ?, source_record_hash = ?, is_missing_from_source = ?
       WHERE id = ?`
    ).run(
      s.host, s.vm, s.support_team, s.support_team_lookup_csm ?? '', s.team ?? '', s.service ?? '', s.initials ?? '', s.total_servers_to_patch ?? null,
      s.engineer_notes ?? '', s.status ?? '', s.swg_check ?? '', s.source ?? '', s.environment, s.manager, s.email, s.customer,
      s.power_state, s.dns_name, s.primary_ip_address, toInt(s.efi_secure_boot), s.annotation,
      s.business_unit, s.business_unit_id ?? null, s.sub_business_unit, s.sub_business_unit_id ?? null,
      s.product, s.product_id ?? null, s.function, s.business_environment,
      s.organisation_short_code, s.organisation_abbreviated,
      s.datacenter, s.datacenter_id ?? null, s.network_1, s.network_2, s.network_3,
      s.imported_at, s.updated_at, s.source_record_hash ?? null, s.is_missing_from_source ? 1 : 0,
      id,
    );
  }

  deleteServer(id: string): void {
    this.app.prepare(`DELETE FROM servers WHERE id = ?`).run(id);
  }

  serverCount(): number {
    const row = this.app.prepare(`SELECT count(*) AS n FROM servers`).get() as Row;
    return Number(row.n);
  }

  // -------------------------------------------------------------------------
  // incidents (application database)
  // -------------------------------------------------------------------------

  private hostFromRow(r: Row): Row {
    return { ...r, communicated: toBool(r.communicated) };
  }

  private incidentServerIds(incidentId: string): string[] {
    const rows = this.app.prepare(`SELECT server_id FROM incident_hosts WHERE incident_id = ?`).all(incidentId) as Row[];
    return rows.map((r) => String(r.server_id));
  }

  private incidentHosts(incidentId: string): Record<string, Row> {
    const rows = this.app.prepare(`SELECT * FROM incident_hosts WHERE incident_id = ?`).all(incidentId) as Row[];
    const map: Record<string, Row> = {};
    for (const r of rows) map[String(r.server_id)] = this.hostFromRow(r);
    return map;
  }

  private hydrateIncident(r: Row): Row {
    const id = String(r.id);
    return { ...r, affected_server_ids: this.incidentServerIds(id), host_details: this.incidentHosts(id) };
  }

  allIncidents(): Row[] {
    const rows = this.app.prepare(`SELECT * FROM incidents ORDER BY created_at DESC`).all() as Row[];
    return rows.map((r) => this.hydrateIncident(r));
  }

  findIncident(idOrRef: string): Row | undefined {
    const r = this.app.prepare(`SELECT * FROM incidents WHERE id = ? OR incident_reference = ?`).get(idOrRef, idOrRef) as Row | undefined;
    return r ? this.hydrateIncident(r) : undefined;
  }

  insertIncident(inc: Row): void {
    this.transaction(() => {
      this.app.prepare(
        `INSERT INTO incidents
          (id, incident_reference, incident_title, description, severity, date_detected,
           detection_source, ioc_or_vulnerability, status, assigned_engineer,
           closed_at, closed_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        inc.id, inc.incident_reference, inc.incident_title, inc.description, inc.severity,
        inc.date_detected, inc.detection_source, inc.ioc_or_vulnerability, inc.status,
        inc.assigned_engineer, inc.closed_at ?? null, inc.closed_by ?? null,
        inc.created_at, inc.updated_at,
      );
      this.replaceIncidentHosts(inc.id, inc.affected_server_ids, inc.host_details);
    });
  }

  updateIncident(id: string, inc: Row): void {
    this.transaction(() => {
      this.app.prepare(
        `UPDATE incidents SET
           incident_reference = ?, incident_title = ?, description = ?, severity = ?,
           date_detected = ?, detection_source = ?, ioc_or_vulnerability = ?, status = ?,
           assigned_engineer = ?, closed_at = ?, closed_by = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        inc.incident_reference, inc.incident_title, inc.description, inc.severity,
        inc.date_detected, inc.detection_source, inc.ioc_or_vulnerability, inc.status,
        inc.assigned_engineer, inc.closed_at ?? null, inc.closed_by ?? null, inc.updated_at, id,
      );
      this.replaceIncidentHosts(id, inc.affected_server_ids, inc.host_details);
    });
  }

  private replaceIncidentHosts(incidentId: string, serverIds: string[] | undefined, hostDetails: Record<string, Row> | undefined): void {
    this.app.prepare(`DELETE FROM incident_hosts WHERE incident_id = ?`).run(incidentId);
    for (const serverId of serverIds ?? []) {
      const d = hostDetails?.[serverId] ?? {};
      this.upsertIncidentHost(incidentId, serverId, d);
    }
  }

  upsertIncidentHost(incidentId: string, serverId: string, d: Row): void {
    this.app.prepare(
      `INSERT INTO incident_hosts
        (incident_id, server_id, status, patch_engineer, patching_status, patching_date,
         ticket_number, notes, communicated, communication_date, updated_by, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(incident_id, server_id) DO UPDATE SET
         status = excluded.status, patch_engineer = excluded.patch_engineer,
         patching_status = excluded.patching_status, patching_date = excluded.patching_date,
         ticket_number = excluded.ticket_number, notes = excluded.notes,
         communicated = excluded.communicated, communication_date = excluded.communication_date,
         updated_by = excluded.updated_by, updated_at = excluded.updated_at`
    ).run(
      incidentId, serverId, d.status ?? 'To be contacted', d.patch_engineer ?? null,
      d.patching_status ?? null, d.patching_date ?? null, d.ticket_number ?? null,
      d.notes ?? null, toInt(d.communicated), d.communication_date ?? null,
      d.updated_by ?? null, d.updated_at ?? null,
    );
  }

  deleteIncidentHost(incidentId: string, serverId: string): void {
    this.app.prepare(`DELETE FROM incident_hosts WHERE incident_id = ? AND server_id = ?`).run(incidentId, serverId);
  }

  touchIncident(id: string, at: string): void {
    this.app.prepare(`UPDATE incidents SET updated_at = ? WHERE id = ?`).run(at, id);
  }

  // -------------------------------------------------------------------------
  // patch campaigns (application database)
  // -------------------------------------------------------------------------

  private campaignTargets(campaignId: string): Record<string, Row> {
    const rows = this.app.prepare(`SELECT * FROM campaign_targets WHERE campaign_id = ?`).all(campaignId) as Row[];
    const map: Record<string, Row> = {};
    for (const r of rows) map[String(r.server_id)] = r;
    return map;
  }

  private hydrateCampaign(r: Row): Row {
    return { ...r, targets: this.campaignTargets(String(r.id)) };
  }

  allCampaigns(): Row[] {
    const rows = this.app.prepare(`SELECT * FROM patch_campaigns ORDER BY created_at DESC`).all() as Row[];
    return rows.map((r) => this.hydrateCampaign(r));
  }

  findCampaign(id: string): Row | undefined {
    const r = this.app.prepare(`SELECT * FROM patch_campaigns WHERE id = ?`).get(id) as Row | undefined;
    return r ? this.hydrateCampaign(r) : undefined;
  }

  insertCampaign(c: Row): void {
    this.transaction(() => {
      this.app.prepare(
        `INSERT INTO patch_campaigns
          (id, campaign_name, cve_identifier, patch_reference, description, severity,
           start_date, target_completion_date, status, assigned_engineer, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        c.id, c.campaign_name, c.cve_identifier, c.patch_reference, c.description, c.severity,
        c.start_date, c.target_completion_date, c.status, c.assigned_engineer, c.created_at, c.updated_at,
      );
      for (const [serverId, t] of Object.entries((c.targets ?? {}) as Record<string, Row>)) {
        this.upsertCampaignTarget(c.id, serverId, t);
      }
    });
  }

  updateCampaign(id: string, c: Row): void {
    this.app.prepare(
      `UPDATE patch_campaigns SET
         campaign_name = ?, cve_identifier = ?, patch_reference = ?, description = ?,
         severity = ?, start_date = ?, target_completion_date = ?, status = ?,
         assigned_engineer = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      c.campaign_name, c.cve_identifier, c.patch_reference, c.description, c.severity,
      c.start_date, c.target_completion_date, c.status, c.assigned_engineer, c.updated_at, id,
    );
  }

  upsertCampaignTarget(campaignId: string, serverId: string, t: Row): void {
    this.app.prepare(
      `INSERT INTO campaign_targets
        (campaign_id, server_id, status, notes, scheduled_date, patched_at, validated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(campaign_id, server_id) DO UPDATE SET
         status = excluded.status, notes = excluded.notes,
         scheduled_date = excluded.scheduled_date, patched_at = excluded.patched_at,
         validated_at = excluded.validated_at`
    ).run(
      campaignId, serverId, t.status ?? 'Affected', t.notes ?? '',
      t.scheduled_date ?? null, t.patched_at ?? null, t.validated_at ?? null,
    );
  }

  touchCampaign(id: string, at: string): void {
    this.app.prepare(`UPDATE patch_campaigns SET updated_at = ? WHERE id = ?`).run(at, id);
  }

  // -------------------------------------------------------------------------
  // audit log + import history (application database)
  // -------------------------------------------------------------------------

  logAudit(e: Row, limit = 5000): void {
    this.appendAudit(e, limit);
  }

  appendAudit(e: Row, limit = 5000): void {
    this.transaction(() => {
      this.app.prepare(
        `INSERT INTO audit_logs
          (id, timestamp, user, action, entity_type, entity_id,
           previous_value, new_value, details, actor_role, outcome, ip, user_agent)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        e.id, e.timestamp, e.user, e.action, e.entity_type, e.entity_id,
        toJson(e.previous_value), toJson(e.new_value), e.details ?? null,
        e.actor_role ?? null, e.outcome ?? null, e.ip ?? null, e.user_agent ?? null,
      );
      this.app.prepare(
        `DELETE FROM audit_logs WHERE id NOT IN (SELECT id FROM audit_logs ORDER BY timestamp DESC LIMIT ?)`
      ).run(limit);
    });
  }

  allAudit(): Row[] {
    const rows = this.app.prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC`).all() as Row[];
    return rows.map((r) => ({ ...r, previous_value: fromJson(r.previous_value), new_value: fromJson(r.new_value) }));
  }

  insertImportHistory(h: Row): void {
    this.app.prepare(
      `INSERT INTO import_history
        (id, filename, import_date, user, strategy, total_records, new_records,
         updated_records, unchanged_records, duplicate_records, failed_records, status, errors)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      h.id, h.filename, h.import_date, h.user, h.strategy,
      h.total_records ?? 0, h.new_records ?? 0, h.updated_records ?? 0, h.unchanged_records ?? 0,
      h.duplicate_records ?? 0, h.failed_records ?? 0, h.status, toJson(h.errors),
    );
  }

  allImportHistory(): Row[] {
    const rows = this.app.prepare(`SELECT * FROM import_history ORDER BY import_date DESC`).all() as Row[];
    return rows.map((r) => ({ ...r, errors: fromJson(r.errors) }));
  }

  // -------------------------------------------------------------------------
  // bootstrap + seed
  // -------------------------------------------------------------------------

  ensureBootstrapAdmin(): void {
    const row = this.auth.prepare(`SELECT count(*) AS n FROM users`).get() as Row;
    if (Number(row.n) > 0) return;

    const email = String(process.env.cmdbUser ?? '').trim().toLowerCase();
    const password = process.env.cmdbPass;
    if (!email || !email.includes('@') || !password) {
      throw new Error(
        '[AUTH] No users exist and first-run bootstrap requires cmdbUser (a valid email) and cmdbPass environment variables.'
      );
    }
    const now = new Date().toISOString();
    this.insertUser({
      id: randomUUID(),
      email,
      name: process.env.cmdbName || 'CMDB Administrator',
      role: 'admin',
      password_hash: hashPassword(password),
      active: true,
      must_change_password: true,
      created_at: now,
      updated_at: now,
    });
    console.log(`[AUTH] Bootstrapped administrator: ${email}`);
  }

  seedApp(app: {
    servers: Row[];
    incidents: Row[];
    patch_campaigns: Row[];
    audit_logs: Row[];
    import_history: Row[];
  }): void {
    this.transaction(() => {
      for (const table of ['servers', 'incidents', 'incident_hosts', 'patch_campaigns', 'campaign_targets', 'audit_logs', 'import_history']) {
        this.app.prepare(`DELETE FROM ${table}`).run();
      }
      for (const s of app.servers) this.insertServer(s);
      for (const inc of app.incidents) this.insertIncident(inc);
      for (const c of app.patch_campaigns) this.insertCampaign(c);
      for (const e of app.audit_logs) this.logAudit(e);
      for (const h of app.import_history) this.insertImportHistory(h);
    });
  }

  private migrateFromJsonIfEmpty(): void {
    const appCount = this.serverCount();
    const userCount = Number((this.auth.prepare(`SELECT count(*) AS n FROM users`).get() as Row).n);
    if (appCount > 0 || userCount > 0) return;
    this.importFromJson();
  }

  /** Reads the legacy JSON and imports it into the two SQLite databases. */
  importFromJson(file = LEGACY_JSON): void {
    if (!fs.existsSync(file)) {
      console.error(`[DB] Legacy JSON not found: ${file}`);
      return;
    }
    const legacy = JSON.parse(fs.readFileSync(file, 'utf-8'));
    this.seedApp({
      servers: legacy.servers ?? [],
      incidents: legacy.incidents ?? [],
      patch_campaigns: legacy.patch_campaigns ?? [],
      audit_logs: legacy.audit_logs ?? [],
      import_history: legacy.import_history ?? [],
    });
    for (const u of (legacy.users ?? []) as Row[]) {
      if (!this.findUserByEmail(String(u.email))) this.insertUser(u);
    }
    for (const s of (legacy.sessions ?? []) as Row[]) {
      this.insertSession(s);
    }
    console.log(`[DB] Imported legacy JSON into ${AUTH_DB} and ${APP_DB}`);
  }
}

export const db = new Store();
