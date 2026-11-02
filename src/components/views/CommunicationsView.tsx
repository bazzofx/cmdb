import React, { useState, useEffect } from 'react';
import {
  Mail,
  Copy,
  Check,
  Send,
  Users,
  Building2,
  FileText,
  AlertTriangle,
  Download,
  Filter,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api.js';

interface CommunicationsViewProps {
  initialServerIds?: string[];
}

export const CommunicationsView: React.FC<CommunicationsViewProps> = ({
  initialServerIds,
}) => {
  const [data, setData] = useState<{
    total_contacts: number;
    valid_emails: number;
    missing_emails: number;
    contacts: any[];
    preview: { subject: string; body: string };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<'incident' | 'vulnerability' | 'patching' | 'maintenance' | 'ownership'>('incident');
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  // Template variables
  const [incidentRef, setIncidentRef] = useState('INC-2026-0842');
  const [incidentTitle, setIncidentTitle] = useState('Critical Infrastructure Kernel Advisory');
  const [severity, setSeverity] = useState('Critical');
  const [targetDate, setTargetDate] = useState('2026-11-15');

  // Contact selection checkboxes
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPreview();
  }, [selectedTemplate, incidentRef, incidentTitle, severity, targetDate, initialServerIds]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.previewCommunications({
        server_ids: initialServerIds,
        template_type: selectedTemplate,
        incident_reference: incidentRef,
        incident_title: incidentTitle,
        severity,
        target_date: targetDate,
      });
      setData(res);

      // Select all valid emails by default
      const valid = new Set(res.contacts.filter(c => !c.missing_email).map(c => c.email));
      setSelectedEmails(valid);
    } catch (err) {
      console.error('Failed to load communications preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyAllEmails = () => {
    if (!data) return;
    const list = data.contacts
      .filter(c => !c.missing_email)
      .map(c => c.email)
      .join(', ');
    navigator.clipboard.writeText(list);
    setCopiedAction('all_emails');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const copySelectedEmails = () => {
    const list = Array.from(selectedEmails).join(', ');
    navigator.clipboard.writeText(list);
    setCopiedAction('selected_emails');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const copyEmailText = () => {
    if (!data) return;
    const full = `Subject: ${data.preview.subject}\n\n${data.preview.body}`;
    navigator.clipboard.writeText(full);
    setCopiedAction('email_text');
    setTimeout(() => setCopiedAction(null), 2000);
  };

  const exportContactCsv = () => {
    if (!data) return;
    const headers = ['Business Unit', 'Manager', 'Email', 'Affected Servers', 'Support Team'];
    const rows = data.contacts.map(c => [
      `"${c.business_unit}"`,
      `"${c.manager}"`,
      `"${c.email || 'MISSING'}"`,
      c.server_count,
      `"${c.support_team}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stakeholder_contacts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const toggleSelectEmail = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedEmails.size > 0) {
      setSelectedEmails(new Set());
    } else {
      const all = new Set(data.contacts.filter(c => !c.missing_email).map(c => c.email));
      setSelectedEmails(all);
    }
  };

  const openMailto = () => {
    if (!data) return;
    const bccList = Array.from(selectedEmails).join(',');
    const subject = encodeURIComponent(data.preview.subject);
    const body = encodeURIComponent(data.preview.body);
    window.location.href = `mailto:?bcc=${bccList}&subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              INCIDENT COMMUNICATIONS & STAKEHOLDER MESSAGING
            </h1>
            <p className="text-xs text-slate-400">
              Transform technical inventory into deduplicated stakeholder distribution lists with standardized response templates.
            </p>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportContactCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={openMailto}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Email Client</span>
            </button>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl soc-glass-panel border border-white/10 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Unique Stakeholders</span>
            <div className="text-xl font-bold font-mono text-white">{data.total_contacts}</div>
          </div>
          <div className="p-3.5 rounded-xl soc-glass-panel border border-emerald-500/20 space-y-1 bg-emerald-950/[0.04]">
            <span className="text-[10px] font-mono uppercase text-emerald-400">Valid Email Addresses</span>
            <div className="text-xl font-bold font-mono text-emerald-400">{data.valid_emails}</div>
          </div>
          <div className="p-3.5 rounded-xl soc-glass-panel border border-amber-500/20 space-y-1 bg-amber-950/[0.04]">
            <span className="text-[10px] font-mono uppercase text-amber-400">Missing Email Addresses</span>
            <div className="text-xl font-bold font-mono text-amber-400">{data.missing_emails}</div>
          </div>
        </div>
      )}

      {/* Main Grid: Contact List on left, Template Composer on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 14.1 & 14.2 DEDUPLICATED CONTACT LIST (5 Cols) */}
        <div className="lg:col-span-5 rounded-xl soc-glass-panel border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Stakeholder Directory ({data?.contacts.length || 0})
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <button
                onClick={copyAllEmails}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                {copiedAction === 'all_emails' ? 'Copied!' : 'Copy All'}
              </button>
              <span>•</span>
              <button
                onClick={copySelectedEmails}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                {copiedAction === 'selected_emails' ? 'Copied!' : `Copy Selected (${selectedEmails.size})`}
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {data?.contacts.map(c => {
              const isSelected = selectedEmails.has(c.email);
              return (
                <div
                  key={c.manager + (c.email || '')}
                  className={`p-3 rounded-lg border transition-all text-xs space-y-1.5 ${
                    c.missing_email
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : isSelected
                      ? 'bg-blue-950/30 border-blue-500/40'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {!c.missing_email && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectEmail(c.email)}
                          className="rounded border-white/20 bg-white/5"
                        />
                      )}
                      <div>
                        <span className="font-bold text-white block">{c.manager}</span>
                        <span className="text-[11px] text-purple-300 font-medium">{c.business_unit}</span>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                      {c.server_count} svr
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-white/5">
                    {c.missing_email ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No email in inventory
                      </span>
                    ) : (
                      <span className="text-slate-300">{c.email}</span>
                    )}
                    <span className="text-slate-400">Team: {c.support_team}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 14.3 EMAIL TEMPLATES & LIVE PREVIEW (7 Cols) */}
        <div className="lg:col-span-7 rounded-xl soc-glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" /> Operational Message Templates
            </span>
            <button
              onClick={copyEmailText}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-mono cursor-pointer"
            >
              {copiedAction === 'email_text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Formatted Email</span>
            </button>
          </div>

          {/* Template Selectors (Section 14.3: 5 reusable templates) */}
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {[
              { id: 'incident', label: '1. Security Incident' },
              { id: 'vulnerability', label: '2. Vulnerability Notice' },
              { id: 'patching', label: '3. Patching Request' },
              { id: 'maintenance', label: '4. Datacenter Maintenance' },
              { id: 'ownership', label: '5. Ownership Hygiene' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id as any)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedTemplate === t.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Dynamic Variables Input Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/[0.02] p-3 rounded-lg border border-white/5 font-mono">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Reference</label>
              <input
                type="text"
                value={incidentRef}
                onChange={e => setIncidentRef(e.target.value)}
                className="w-full p-1 rounded bg-white/5 border border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Title / Subject</label>
              <input
                type="text"
                value={incidentTitle}
                onChange={e => setIncidentTitle(e.target.value)}
                className="w-full p-1 rounded bg-white/5 border border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                className="w-full p-1 rounded bg-white/5 border border-white/10 text-white"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Target Due Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full p-1 rounded bg-white/5 border border-white/10 text-white"
              />
            </div>
          </div>

          {/* Rendered Live Preview (with interpolated variables) */}
          {data && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 space-y-2 text-xs font-mono">
                <div className="pb-2 border-b border-white/10">
                  <span className="text-slate-400 text-[10px] block uppercase">Subject Line:</span>
                  <span className="text-blue-300 font-semibold">{data.preview.subject}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase mb-1">Message Body Preview:</span>
                  <pre className="text-slate-200 whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-72 overflow-y-auto">
                    {data.preview.body}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
