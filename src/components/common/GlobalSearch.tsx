import React, { useState, useEffect, useRef } from 'react';
import { Search, Server, Building2, User, Globe, ArrowRight, X } from 'lucide-react';
import { api } from '../../services/api.js';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectServer: (serverId: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  onSelectServer,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [isOpen]);

  // Close on Escape no matter which element currently has focus.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchServers(query);
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onSelectServer(results[selectedIndex].id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--surface-2)] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Input Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type hostname, IP (e.g. 10.200.68), manager, network, BU..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[11px] font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10 hover:bg-white/15"
          >
            ESC
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        {!query && (
          <div className="p-4 border-b border-white/5 bg-white/[0.01]">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
              Try searching by:
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {['10.200.68', 'John Lennon', 'BRICK', 'Active Directory', 'DC2-PROD', 'br1-sse-esx-23'].map(preset => (
                <button
                  key={preset}
                  onClick={() => setQuery(preset)}
                  className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-blue-300 hover:border-blue-400/30 transition-all font-mono text-[11px] cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
          {loading && (
            <div className="p-6 text-center text-xs text-slate-400 font-mono">
              Searching infrastructure database...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-8 text-center">
              <Server className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-300 font-medium">No infrastructure matches found</p>
              <p className="text-xs text-slate-400 mt-1">
                No server matches "{query}". Check spelling or try searching by manager, IP, or network.
              </p>
            </div>
          )}

          {!loading &&
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectServer(item.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-600/15 border-l-2 border-blue-400' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white tracking-wide">
                        {item.host}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                        {item.vm}
                      </span>
                      {item.environment && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                          {item.environment}
                        </span>
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          item.power_state === 'poweredOn'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.power_state}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-purple-400" />
                        <span className="truncate">{item.business_unit || 'Unassigned BU'}</span>
                        {item.sub_business_unit && (
                          <span className="text-slate-400">/ {item.sub_business_unit}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>{item.primary_ip_address || 'No IP'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-400" />
                        <span className="truncate">{item.manager || 'No Manager'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                      {item.datacenter}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
          </div>
          <span>{results.length} result(s)</span>
        </div>
      </div>
    </div>
  );
};
