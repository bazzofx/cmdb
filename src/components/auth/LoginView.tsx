import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertTriangle } from 'lucide-react';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl soc-glass-panel border border-white/10 p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-wider text-white uppercase">
              NEXUS<span className="text-blue-400">INFRA</span>
            </div>
            <div className="text-[11px] text-slate-400">CMDB access is restricted</div>
          </div>
        </div>

        <h1 className="text-lg font-bold text-white">Sign in</h1>
        <p className="text-xs text-slate-400 mt-1 mb-5">
          Local account. This deployment runs in an air-gapped environment.
        </p>

        {error && (
          <div className="flex items-start gap-2 p-2.5 mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Email</span>
            <div className="relative mt-1">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                placeholder="you@example.com"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Password</span>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                placeholder="Password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[10px] text-slate-500 mt-5 text-center">
          Accounts are created by an administrator. There is no self-registration.
        </p>
      </div>
    </div>
  );
};
