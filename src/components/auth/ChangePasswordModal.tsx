import React, { useState } from 'react';
import { X, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';

interface ChangePasswordModalProps {
  temporary?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  temporary = false,
  onClose,
  onSuccess,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1120] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">Change password</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {temporary && (
          <p className="text-[11px] text-amber-300 mb-3">
            You are using a temporary password. Set a new password before continuing.
          </p>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Password updated.
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <div className="flex items-start gap-2 p-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="New password (min 12 characters)"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
