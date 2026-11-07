import { useState, useEffect } from 'react';
import {
  Database,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ImportHistoryItem } from '../../types/index.js';

interface DataManagementViewProps {
  onRefreshData: () => void;
}

export const DataManagementView: React.FC<DataManagementViewProps> = ({ onRefreshData }) => {
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Import State
  const [csvContent, setCsvContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('csm_import.csv');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [strategy, setStrategy] = useState<'insert' | 'update' | 'synchronise'>('update');
  const [importSummary, setImportSummary] = useState<ImportHistoryItem | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const hist = await api.getImportHistory();
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load import history:', err);
    }
  };

  // Stage 1: File selection / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setCsvContent(content);
      proceedToPreview(content);
    };
    reader.readAsText(file);
  };

  const loadDefaultMockup = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/assets/aistudio/MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv');
      if (!res.ok) throw new Error('Could not load asset CSV');
      const text = await res.text();
      setCsvContent(text);
      setFilename('MOCKUP_CSM_Servers_-_Copy_c00cddf2.csv');
      await proceedToPreview(text);
    } catch (err: any) {
      setErrorMessage('Failed to load sample CSV: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const proceedToPreview = async (content: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.previewImport(content);
      setDetectedColumns(res.detected_columns);
      setColumnMapping(res.suggested_mapping);
      setPreviewRows(res.preview);
      setCurrentStage(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process CSV');
    } finally {
      setLoading(false);
    }
  };

  // Stage 4 to 5: Execute Import
  const handleExecuteImport = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.executeImport({
        csv_content: csvContent,
        filename,
        strategy,
        user: 'SecOps Administrator',
      });
      setImportSummary(res.summary);
      setCurrentStage(5);
      loadHistory();
      onRefreshData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Import execution failed');
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = () => {
    setCurrentStage(1);
    setCsvContent('');
    setImportSummary(null);
    setErrorMessage(null);
  };

  const restoreInitialSeed = async () => {
    if (confirm('Are you sure you want to re-seed the database to the initial 9 CSM records?')) {
      setLoading(true);
      try {
        await api.resetDatabase();
        alert('Database successfully restored to original seed inventory.');
        onRefreshData();
        loadHistory();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl soc-glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              DATA MANAGEMENT & 5-STAGE CSV IMPORT ENGINE
            </h1>
            <p className="text-xs text-slate-400">
              Ingest infrastructure records, map CSM attributes, validate data hygiene, and execute safe database synchronisation.
            </p>
          </div>
        </div>

        <button
          onClick={restoreInitialSeed}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-mono cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset to Demo Seed</span>
        </button>
      </div>

      {/* 5-STAGE STEPPER INDICATOR (Section 4.1) */}
      <div className="p-3.5 rounded-xl soc-glass-panel border border-white/10">
        <div className="grid grid-cols-5 gap-2 text-xs font-mono">
          {[
            { num: 1, label: 'Upload CSV' },
            { num: 2, label: 'Column Mapping' },
            { num: 3, label: 'Hygiene Preview' },
            { num: 4, label: 'Import Strategy' },
            { num: 5, label: 'Summary & Audit' },
          ].map(s => {
            const isCurrent = currentStage === s.num;
            const isCompleted = currentStage > s.num;

            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/[0.02] border-white/5 text-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-blue-500 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-black'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                </div>
                <span className="truncate hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STAGE 1: UPLOAD */}
      {currentStage === 1 && (
        <div className="rounded-xl soc-glass-panel border border-white/10 p-8 space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upload Infrastructure CSV Inventory</h2>
              <p className="text-xs text-slate-400 mt-1">
                Select a UTF-8 encoded CSV file containing hostnames, business units, networking, and security boot tags.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs cursor-pointer shadow-lg shadow-blue-500/20">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Choose Local File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={loadDefaultMockup}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-mono cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Load Sample CSM Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: COLUMN MAPPING */}
      {currentStage === 2 && (
        <div className="rounded-xl soc-glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white font-mono">Stage 2: Automatic Field & Column Mapping</h2>
              <p className="text-xs text-slate-400">
                Verify detected CSV headers mapped into normalized CSM entities (e.g. 6_Environmen → business_environment).
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => setCurrentStage(1)}
                className="px-3 py-1 rounded bg-white/5 text-slate-300"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStage(3)}
                className="px-4 py-1 rounded bg-blue-600 text-white font-medium flex items-center gap-1"
              >
                <span>Continue to Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto">
            {detectedColumns.map(col => (
              <div
                key={col}
                className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
              >
                <span className="font-mono text-slate-300 truncate max-w-[140px]">{col}</span>
                <span className="font-mono text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded">
                  → {columnMapping[col] || 'unmapped'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGE 3: HYGIENE PREVIEW */}
      {currentStage === 3 && (
        <div className="rounded-xl soc-glass-panel border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white font-mono">Stage 3: Data Hygiene Validation (First 20 Records)</h2>
              <p className="text-xs text-slate-400">
                Inspecting for missing hostnames, unassigned managers, missing emails, or invalid IP format.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => setCurrentStage(2)}
                className="px-3 py-1 rounded bg-white/5 text-slate-300"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStage(4)}
                className="px-4 py-1 rounded bg-blue-600 text-white font-medium flex items-center gap-1"
              >
                <span>Select Strategy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[450px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono text-slate-400 uppercase">
                  <th className="p-2">Row</th>
                  <th className="p-2">Host</th>
                  <th className="p-2">VM</th>
                  <th className="p-2">Business Unit</th>
                  <th className="p-2">Manager</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">IP Address</th>
                  <th className="p-2">Validation Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {previewRows.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="p-2 text-slate-500">{item.row_number}</td>
                    <td className="p-2 text-white font-medium">{item.server.host || <span className="text-rose-400">MISSING</span>}</td>
                    <td className="p-2 text-slate-300">{item.server.vm}</td>
                    <td className="p-2 text-purple-300 font-sans">{item.server.business_unit}</td>
                    <td className="p-2 text-slate-200 font-sans">{item.server.manager || <span className="text-amber-400">UNASSIGNED</span>}</td>
                    <td className="p-2 text-slate-400">{item.server.email || <span className="text-amber-400">MISSING</span>}</td>
                    <td className="p-2 text-cyan-300">{item.server.primary_ip_address}</td>
                    <td className="p-2">
                      {item.issues.length === 0 ? (
                        <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Valid
                        </span>
                      ) : (
                        <span className="text-amber-400 text-[10px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {item.issues.join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAGE 4: IMPORT STRATEGY (Section 4.1 Stage 4) */}
      {currentStage === 4 && (
        <div className="rounded-xl soc-glass-panel border border-white/10 p-6 space-y-6">
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-base font-bold text-white text-center">Stage 4: Select Database Import Strategy</h2>
            <p className="text-xs text-slate-400 text-center">
              Choose how existing records matched by Host and VM identifiers should be processed.
            </p>

            <div className="space-y-3 pt-2">
              <label
                onClick={() => setStrategy('update')}
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'update'
                    ? 'bg-blue-600/15 border-blue-500/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="strat"
                  checked={strategy === 'update'}
                  onChange={() => setStrategy('update')}
                  className="mt-1"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold block text-sm">Mode 2: Update Existing & Insert New Records (Recommended)</span>
                  <p className="text-slate-400">
                    Updates attributes (manager, networks, secure boot) for existing hosts while creating new entries.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setStrategy('insert')}
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'insert'
                    ? 'bg-blue-600/15 border-blue-500/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="strat"
                  checked={strategy === 'insert'}
                  onChange={() => setStrategy('insert')}
                  className="mt-1"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold block text-sm">Mode 1: Insert New Records Only</span>
                  <p className="text-slate-400">
                    Skips duplicates and preserves existing records exactly as they are in the database.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setStrategy('synchronise')}
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  strategy === 'synchronise'
                    ? 'bg-blue-600/15 border-blue-500/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="strat"
                  checked={strategy === 'synchronise'}
                  onChange={() => setStrategy('synchronise')}
                  className="mt-1"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold block text-sm">Mode 3: Synchronise & Flag Disappeared Assets</span>
                  <p className="text-slate-400">
                    Updates matched records and flags missing records as potentially decommissioned (never deletes).
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/10">
              <button
                onClick={() => setCurrentStage(3)}
                className="px-3 py-1.5 rounded bg-white/5 text-slate-300 font-mono text-xs"
              >
                Back
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-500/20"
              >
                {loading ? 'Executing Import...' : 'Execute Import Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 5: IMPORT SUMMARY (Section 4.1 Stage 5) */}
      {currentStage === 5 && importSummary && (
        <div className="rounded-xl soc-glass-panel border border-white/10 p-6 space-y-6">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <Check className="w-6 h-6" />
            </div>

            <h2 className="text-base font-bold text-white text-center">Import Completed Successfully</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                <span className="text-slate-400 text-[10px] uppercase block">Processed</span>
                <span className="text-base font-bold text-white">{importSummary.total_records}</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-center">
                <span className="text-emerald-400 text-[10px] uppercase block">New Records</span>
                <span className="text-base font-bold text-emerald-400">{importSummary.new_records}</span>
              </div>
              <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/30 text-center">
                <span className="text-blue-400 text-[10px] uppercase block">Updated</span>
                <span className="text-base font-bold text-blue-400">{importSummary.updated_records}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                <span className="text-slate-400 text-[10px] uppercase block">Duplicates</span>
                <span className="text-base font-bold text-slate-300">{importSummary.duplicate_records}</span>
              </div>
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-center">
                <span className="text-rose-400 text-[10px] uppercase block">Failed</span>
                <span className="text-base font-bold text-rose-400">{importSummary.failed_records}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                <span className="text-slate-400 text-[10px] uppercase block">Strategy</span>
                <span className="text-xs font-bold text-purple-300 uppercase">{importSummary.strategy}</span>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={resetWorkflow}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs"
              >
                Import Another File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORICAL IMPORT LOGS */}
      <div className="rounded-xl soc-glass-panel border border-white/10 p-5 space-y-3">
        <h3 className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> Historical Import Audits ({history.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-mono text-slate-400 uppercase">
                <th className="p-2">File</th>
                <th className="p-2">Date</th>
                <th className="p-2">User</th>
                <th className="p-2">Strategy</th>
                <th className="p-2">Total</th>
                <th className="p-2">New</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="p-2 text-white">{item.filename}</td>
                  <td className="p-2 text-slate-400">{new Date(item.import_date).toLocaleString()}</td>
                  <td className="p-2 text-slate-300">{item.user}</td>
                  <td className="p-2 uppercase text-purple-300">{item.strategy}</td>
                  <td className="p-2 text-white">{item.total_records}</td>
                  <td className="p-2 text-emerald-400">+{item.new_records}</td>
                  <td className="p-2 text-blue-400">{item.updated_records}</td>
                  <td className="p-2">
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {item.status}
                    </span>
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
