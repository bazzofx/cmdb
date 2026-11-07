import { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Database,
  Lock,
  Search,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { UsersPanel } from '../settings/UsersPanel.js';
import type { AuditLogEvent } from '../../types/index.js';

export const SettingsAuditView: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [search, setSearch] = useState('');
  const [serverCount, setServerCount] = useState(0);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
      const stats = await api.getStats();
      setServerCount(stats.total_servers);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const filteredLogs = logs.filter(
    l =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.user.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (l.details && l.details.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              SECURITY, ROLE-BASED ACCESS & AUDIT LOGS
            </h1>
            <p className="text-xs text-slate-400">
              Audit trail of all administrative mutations, user roles, and database persistence status.
            </p>
          </div>
        </div>

        <button
          onClick={loadAuditLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {user?.role === 'admin' && <UsersPanel />}

      {/* System Diagnostics & Storage Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px]">Database Engine</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white">Relational JSON Storage</div>
          <p className="text-[11px] text-slate-400 font-sans">
            Indexed with fast in-memory query engine and persistence on disk at <code className="text-cyan-300">data/csm_database.json</code>.
          </p>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 pt-1">
            <CheckCircle className="w-3.5 h-3.5" /> Connected • {serverCount} indexed servers
          </div>
        </div>

        <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px]">Session Security</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white">Local Authentication</div>
          <p className="text-[11px] text-slate-400 font-sans">
            Current user: <span className="text-blue-300 font-bold">{user?.name}</span>{' '}
            <span className="text-slate-300">({user?.role})</span>. Role checks are enforced by the API.
          </p>
          <div className="text-[11px] text-slate-400 pt-1">
            Future provider: on-prem LDAP / Active Directory
          </div>
        </div>

        <div className="p-4 rounded-xl soc-glass-panel border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px]">Audit Integrity</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-white">{logs.length} Logged Events</div>
          <p className="text-[11px] text-slate-400 font-sans">
            Operational log of authentication, inventory, incident and patch changes. Capped in the JSON store; export to a SIEM for durable evidence.
          </p>
          <div className="text-[11px] text-purple-300 pt-1">
            Retention: capped JSON audit log
          </div>
        </div>
      </div>

      {/* 21. CENTRAL AUDIT LOG TABLE */}
      <div className="rounded-xl soc-glass-panel border border-white/10 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" /> Administrative Audit Trail ({filteredLogs.length})
          </h2>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search audit actions..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono text-slate-400 uppercase">
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">User</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Entity</th>
                <th className="p-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {filteredLogs.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="p-2.5 text-slate-400 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleString()}
                  </td>
                  <td className="p-2.5 text-slate-200">{item.user}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {item.action}
                    </span>
                  </td>
                  <td className="p-2.5 text-purple-300">{item.entity_type}</td>
                  <td className="p-2.5 text-slate-300 font-sans text-xs">
                    {item.details || 'Mutation performed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
