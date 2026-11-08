// One-shot legacy JSON -> SQLite importer.
//
//   npm run migrate:db
//
// Deletes any existing SQLite files, then re-imports data/csm_database.json into
//   data/auth.sqlite (users + sessions)
//   data/cmdb.sqlite (servers, incidents, patch campaigns, audit log, import history)
//
// The JSON file is never modified or deleted, so it remains a rollback target.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../src/db/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const JSON_FILE = path.join(DATA_DIR, 'csm_database.json');

if (!fs.existsSync(JSON_FILE)) {
  console.error(`[migrate] ${JSON_FILE} not found. Nothing to import.`);
  process.exit(1);
}

for (const name of ['auth.sqlite', 'cmdb.sqlite', 'auth.sqlite-wal', 'auth.sqlite-shm', 'cmdb.sqlite-wal', 'cmdb.sqlite-shm']) {
  fs.rmSync(path.join(DATA_DIR, name), { force: true });
}

const store = new Store();
store.importFromJson(JSON_FILE);

console.log('[migrate] servers:        ', store.allServers().length);
console.log('[migrate] users:          ', store.listUsers(true).length);
console.log('[migrate] sessions:       ', store.sessionCount());
console.log('[migrate] incidents:      ', store.allIncidents().length);
console.log('[migrate] campaigns:      ', store.allCampaigns().length);
console.log('[migrate] audit_logs:     ', store.allAudit().length);
console.log('[migrate] import_history: ', store.allImportHistory().length);
