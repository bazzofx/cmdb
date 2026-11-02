import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Download,
  Printer,
  FileSpreadsheet,
  Check,
  Search,
  ExternalLink,
  ShieldAlert,
  Server,
  Building2,
  Users,
  HardDrive,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface ReportsViewProps {
  onSelectServer: (id: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectServer }) => {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<number>(1);
  const [reportSearch, setReportSearch] = useState('');

  const reportDefinitions = [
    { id: 1, title: '1. Complete Server Inventory', desc: 'Full export of all hardware, virtual machines, networking, and organizational records.' },
    { id: 2, title: '2. Business Unit Inventory', desc: 'Grouped breakdown of technical workloads across departments and sub-units.' },
    { id: 3, title: '3. Ownership Completeness Audit', desc: 'Hygiene audit identifying systems with unassigned managers or missing emails.' },
    { id: 4, title: '4. Servers by Manager Directory', desc: 'Roster of systems mapped to specific operational and technical leads.' },
    { id: 5, title: '5. Servers by Support Team', desc: 'Infrastructure breakdown across regional and technical support tiers.' },
    { id: 6, title: '6. Servers by Datacenter', desc: 'Physical facilities distribution, clusters, and ESXi hosts.' },
    { id: 7, title: '7. Servers by Network Segment', desc: 'Interface connectivity across corporate DMZ, production VLANs, and isolated networks.' },
    { id: 8, title: '8. Servers with Secure Boot Disabled', desc: 'Critical compliance report for hosts lacking UEFI hardware kernel verification.' },
    { id: 9, title: '9. Missing Ownership Metadata', desc: 'Orphaned assets lacking business unit or technical owner assignment.' },
    { id: 10, title: '10. Incident Impact Summary', desc: 'Comprehensive damage and stakeholder audit across open security investigations.' },
    { id: 11, title: '11. Vulnerability Assessment Posture', desc: 'High-risk assets requiring immediate containment or configuration hardening.' },
    { id: 12, title: '12. Patching Lifecycle Progress', desc: 'Remediation throughput and outstanding overdue maintenance targets.' },
  ];

  useEffect(() => {
    api.getServers({ limit: 1000 }).then(res => {
      setServers(res.items);
      setLoading(false);
    });
  }, []);

  // Filter dataset according to selected report
  const getFilteredData = () => {
    switch (selectedReportId) {
      case 8: // Secure Boot disabled
        return servers.filter(s => s.efi_secure_boot === false);
      case 9: // Missing ownership
        return servers.filter(s => !s.manager || !s.business_unit);
      case 3: // Incomplete metadata
        return servers.filter(s => !s.email || !s.manager || !s.business_unit || !s.product);
      default:
        return servers;
    }
  };

  const currentData = getFilteredData().filter(s => {
    if (!reportSearch) return true;
    const q = reportSearch.toLowerCase();
    return (
      s.host.toLowerCase().includes(q) ||
      s.vm.toLowerCase().includes(q) ||
      s.business_unit.toLowerCase().includes(q) ||
      s.manager.toLowerCase().includes(q) ||
      s.primary_ip_address.toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const headers = [
      'Host',
      'VM',
      'Business Unit',
      'Sub BU',
      'Manager',
      'Email',
      'Primary IP',
      'Datacenter',
      'Power State',
      'Secure Boot',
    ];

    const rows = currentData.map(s => [
      `"${s.host}"`,
      `"${s.vm}"`,
      `"${s.business_unit}"`,
      `"${s.sub_business_unit}"`,
      `"${s.manager}"`,
      `"${s.email}"`,
      `"${s.primary_ip_address}"`,
      `"${s.datacenter}"`,
      `"${s.power_state}"`,
      `"${s.efi_secure_boot === true ? 'TRUE' : s.efi_secure_boot === false ? 'FALSE' : 'UNKNOWN'}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csm_report_${selectedReportId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportJson = () => {
    const jsonStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csm_report_${selectedReportId}.json`;
    a.click();
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <FileBarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              OPERATIONAL REPORTING ENGINE
            </h1>
            <p className="text-xs text-slate-400">
              Generate standardized SOC reports, compliance audits, and CSV/JSON data packages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-xs font-mono cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Export</span>
          </button>
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
          >
            <span>JSON</span>
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Reports Grid & Selection */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Reports Navigation (12 Standard Reports) */}
        <div className="md:col-span-4 rounded-xl soc-glass-panel border border-white/10 p-3 space-y-1.5 max-h-[600px] overflow-y-auto">
          <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider px-2 block mb-2">
            12 Standard Operational Reports
          </span>
          {reportDefinitions.map(rep => (
            <button
              key={rep.id}
              onClick={() => setSelectedReportId(rep.id)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                selectedReportId === rep.id
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="font-semibold">{rep.title}</div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">{rep.desc}</div>
            </button>
          ))}
        </div>

        {/* Report Output Table */}
        <div className="md:col-span-8 rounded-xl soc-glass-panel border border-white/10 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white font-mono">
                {reportDefinitions.find(r => r.id === selectedReportId)?.title}
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {currentData.length} records matching current criteria
              </span>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-8 pr-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono text-slate-400 uppercase">
                  <th className="p-2">Host</th>
                  <th className="p-2">VM</th>
                  <th className="p-2">Business Unit</th>
                  <th className="p-2">Manager</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Primary IP</th>
                  <th className="p-2">Datacenter</th>
                  <th className="p-2">Secure Boot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {currentData.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => onSelectServer(s.id)}
                    className="hover:bg-white/[0.03] cursor-pointer"
                  >
                    <td className="p-2 text-white font-medium">{s.host}</td>
                    <td className="p-2 text-slate-300">{s.vm}</td>
                    <td className="p-2 text-purple-300 font-sans">{s.business_unit}</td>
                    <td className="p-2 text-slate-200 font-sans">{s.manager || 'Unassigned'}</td>
                    <td className="p-2 text-slate-400">{s.email || 'None'}</td>
                    <td className="p-2 text-cyan-300">{s.primary_ip_address}</td>
                    <td className="p-2 text-slate-400">{s.datacenter}</td>
                    <td className="p-2">
                      {s.efi_secure_boot === true ? (
                        <span className="text-emerald-400">TRUE</span>
                      ) : s.efi_secure_boot === false ? (
                        <span className="text-rose-400">FALSE</span>
                      ) : (
                        <span className="text-slate-500">UNK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
