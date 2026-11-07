import React, { useEffect, useState } from 'react';
import { UserPlus, RefreshCw, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import type { AuthUser, UserRole } from '../../types/index.js';

const ROLES: UserRole[] = ['viewer', 'analyst', 'manager', 'admin'];

const roleClass: Record<UserRole, string> = {
  viewer: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  analyst: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  admin: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await api.getUsers(true));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createUser({ email, name: name || email, role, password });
      setEmail('');
      setName('');
      setRole('viewer');
      setPassword('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (user: AuthUser, nextRole: UserRole) => {
    try {
      await api.updateUser(user.id, { role: nextRole });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const toggleActive = async (user: AuthUser) => {
    try {
      await api.updateUser(user.id, { active: !user.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const resetPassword = async (user: AuthUser) => {
    const next = window.prompt(`New temporary password for ${user.email} (min 12 characters)`);
    if (!next) return;
    try {
      await api.resetUserPassword(user.id, next);
      window.alert('Password reset. The user must change it at next sign-in.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <section className="rounded-xl soc-glass-panel border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Users & Roles</h2>
          <span className="text-[10px] font-mono text-slate-400">{users.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
            title="Reload users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(value => !value)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[11px] cursor-pointer hover:bg-blue-600/30"
          >
            <UserPlus className="w-3.5 h-3.5" />
            New user
          </button>
        </div>
      </div>

      {error && <div className="text-[11px] text-rose-300">{error}</div>}

      {showForm && (
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white"
          />
          <input
            placeholder="Display name"
            value={name}
            onChange={event => setName(event.target.value)}
            className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white"
          />
          <select
            value={role}
            onChange={event => setRole(event.target.value as UserRole)}
            className="px-2.5 py-1.5 rounded bg-[#0b1120] border border-white/10 text-xs text-white"
          >
            {ROLES.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            type="password"
            required
            placeholder="Temporary password (min 12)"
            value={password}
            onChange={event => setPassword(event.target.value)}
            className="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 text-xs text-white"
          />
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-[11px] font-semibold cursor-pointer"
            >
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase font-mono text-slate-400">
              <th className="p-2">User</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(user => (
              <tr key={user.id}>
                <td className="p-2">
                  <div className="text-white font-medium">{user.name}</div>
                  <div className="text-slate-400 font-mono text-[10px]">{user.email}</div>
                </td>
                <td className="p-2">
                  <select
                    value={user.role}
                    onChange={event => void changeRole(user, event.target.value as UserRole)}
                    className={`px-1.5 py-0.5 rounded border text-[10px] bg-transparent ${roleClass[user.role]}`}
                  >
                    {ROLES.map(item => (
                      <option key={item} value={item} className="bg-[#0b1120] text-white">{item}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <span className={user.active === false ? 'text-rose-300' : 'text-emerald-300'}>
                    {user.active === false ? 'Disabled' : 'Active'}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => void resetPassword(user)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => void toggleActive(user)}
                      className="p-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 cursor-pointer"
                      title={user.active === false ? 'Enable user' : 'Disable user'}
                    >
                      {user.active === false ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
