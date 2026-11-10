-- Application database (kept separate from the authentication database).
-- File: data/cmdb.sqlite
--
-- Applied by the app at startup. The connection must also set:
--   PRAGMA journal_mode = WAL;
--   PRAGMA foreign_keys = ON;
--   PRAGMA busy_timeout = 5000;
--
-- Conventions:
--   * ids and ISO-8601 timestamps are TEXT
--   * booleans are INTEGER (0/1), NULL when unknown
--   * polymorphic payloads (audit prev/next, import errors) are JSON TEXT

CREATE TABLE IF NOT EXISTS servers (
  id                       TEXT PRIMARY KEY,
  host                     TEXT NOT NULL,
  vm                       TEXT NOT NULL,
  support_team             TEXT NOT NULL DEFAULT '',
  support_team_lookup_csm  TEXT NOT NULL DEFAULT '',
  team                     TEXT NOT NULL DEFAULT '',
  service                  TEXT NOT NULL DEFAULT '',
  initials                 TEXT NOT NULL DEFAULT '',
  total_servers_to_patch   INTEGER,
  engineer_notes           TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT '',
  swg_check                TEXT NOT NULL DEFAULT '',
  source                   TEXT NOT NULL DEFAULT '',
  environment              TEXT NOT NULL DEFAULT '',
  manager                  TEXT NOT NULL DEFAULT '',
  email                    TEXT NOT NULL DEFAULT '',
  customer                 TEXT NOT NULL DEFAULT '',
  power_state              TEXT NOT NULL DEFAULT 'poweredOn',
  dns_name                 TEXT NOT NULL DEFAULT '',
  primary_ip_address       TEXT NOT NULL DEFAULT '',
  efi_secure_boot          INTEGER,               -- NULL/0/1
  annotation               TEXT NOT NULL DEFAULT '',
  business_unit            TEXT NOT NULL DEFAULT '',
  business_unit_id         TEXT,
  sub_business_unit        TEXT NOT NULL DEFAULT '',
  sub_business_unit_id     TEXT,
  product                  TEXT NOT NULL DEFAULT '',
  product_id               TEXT,
  function                 TEXT NOT NULL DEFAULT '',
  business_environment     TEXT NOT NULL DEFAULT '',
  organisation_short_code  TEXT NOT NULL DEFAULT '',
  organisation_abbreviated TEXT NOT NULL DEFAULT '',
  datacenter               TEXT NOT NULL DEFAULT '',
  datacenter_id            TEXT,
  network_1                TEXT NOT NULL DEFAULT '',
  network_2                TEXT NOT NULL DEFAULT '',
  network_3                TEXT NOT NULL DEFAULT '',
  imported_at              TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  source_record_hash       TEXT,
  is_missing_from_source   INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_servers_host_vm  ON servers(lower(host), lower(vm));
CREATE INDEX IF NOT EXISTS idx_servers_bu             ON servers(business_unit);
CREATE INDEX IF NOT EXISTS idx_servers_sub_bu         ON servers(sub_business_unit);
CREATE INDEX IF NOT EXISTS idx_servers_manager        ON servers(manager);
CREATE INDEX IF NOT EXISTS idx_servers_customer       ON servers(customer);
CREATE INDEX IF NOT EXISTS idx_servers_datacenter     ON servers(datacenter);
CREATE INDEX IF NOT EXISTS idx_servers_environment    ON servers(environment);
CREATE INDEX IF NOT EXISTS idx_servers_product        ON servers(product);
CREATE INDEX IF NOT EXISTS idx_servers_support_team   ON servers(support_team);
CREATE INDEX IF NOT EXISTS idx_servers_power_state    ON servers(power_state);
CREATE INDEX IF NOT EXISTS idx_servers_ip             ON servers(primary_ip_address);

CREATE TABLE IF NOT EXISTS incidents (
  id                    TEXT PRIMARY KEY,
  incident_reference    TEXT NOT NULL,
  incident_title        TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  severity              TEXT NOT NULL DEFAULT 'High',
  date_detected         TEXT NOT NULL,
  detection_source      TEXT NOT NULL DEFAULT '',
  ioc_or_vulnerability  TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'Open',
  assigned_engineer     TEXT NOT NULL DEFAULT '',
  closed_at             TEXT,
  closed_by             TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

CREATE TABLE IF NOT EXISTS incident_hosts (
  incident_id         TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  server_id           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'To be contacted',
  patch_engineer      TEXT,
  patching_status     TEXT,
  patching_date       TEXT,
  ticket_number       TEXT,
  notes               TEXT,
  communicated        INTEGER,
  communication_date  TEXT,
  updated_by          TEXT,
  updated_at          TEXT,
  PRIMARY KEY (incident_id, server_id)
);
CREATE INDEX IF NOT EXISTS idx_incident_hosts_server ON incident_hosts(server_id);

CREATE TABLE IF NOT EXISTS patch_campaigns (
  id                      TEXT PRIMARY KEY,
  campaign_name           TEXT NOT NULL,
  cve_identifier          TEXT NOT NULL DEFAULT '',
  patch_reference         TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  severity                TEXT NOT NULL DEFAULT 'Medium',
  start_date              TEXT NOT NULL,
  target_completion_date  TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'Active',
  assigned_engineer       TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_targets (
  campaign_id     TEXT NOT NULL REFERENCES patch_campaigns(id) ON DELETE CASCADE,
  server_id       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Affected',
  notes           TEXT NOT NULL DEFAULT '',
  scheduled_date  TEXT,
  patched_at      TEXT,
  validated_at    TEXT,
  PRIMARY KEY (campaign_id, server_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_server ON campaign_targets(server_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              TEXT PRIMARY KEY,
  timestamp       TEXT NOT NULL,
  user            TEXT NOT NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  previous_value  TEXT,                              -- JSON
  new_value       TEXT,                              -- JSON
  details         TEXT,
  actor_role      TEXT,
  outcome         TEXT,
  ip              TEXT,
  user_agent      TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp   ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs(action);

CREATE TABLE IF NOT EXISTS import_history (
  id                  TEXT PRIMARY KEY,
  filename            TEXT NOT NULL,
  import_date         TEXT NOT NULL,
  user                TEXT NOT NULL,
  strategy            TEXT NOT NULL,
  total_records       INTEGER NOT NULL DEFAULT 0,
  new_records         INTEGER NOT NULL DEFAULT 0,
  updated_records     INTEGER NOT NULL DEFAULT 0,
  unchanged_records   INTEGER NOT NULL DEFAULT 0,
  duplicate_records   INTEGER NOT NULL DEFAULT 0,
  failed_records      INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL,
  errors              TEXT                               -- JSON
);
CREATE INDEX IF NOT EXISTS idx_import_history_date ON import_history(import_date);
