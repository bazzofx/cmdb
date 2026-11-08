import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Server,
  User,
  Users,
  Building2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldAlert,
  CheckCircle2,
  Check,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ProductSummary } from '../../types/index.js';

interface ProductsViewProps {
  onSelectServer?: (id: string) => void;
  onFilterInventory?: (filters: Record<string, string>) => void;
  onOpenIncidentWithServers?: (serverIds: string[]) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  onSelectServer,
  onFilterInventory,
  onOpenIncidentWithServers,
}) => {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.primary_owner.toLowerCase().includes(q) ||
        p.product_owners.some(po => po.name.toLowerCase().includes(q) || po.email.toLowerCase().includes(q)) ||
        p.business_units.some(bu => bu.toLowerCase().includes(q)) ||
        p.functions.some(fn => fn.toLowerCase().includes(q)) ||
        p.customers.some(c => c.toLowerCase().includes(q))
      );
    });
  }, [products, searchQuery]);

  // Overall aggregate metrics
  const totalAssets = products.reduce((acc, p) => acc + p.total_servers, 0);
  const totalOnline = products.reduce((acc, p) => acc + p.powered_on, 0);
  const allOwners = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      p.product_owners.forEach(po => set.add(po.name));
    });
    return Array.from(set);
  }, [products]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">4_Product Catalog</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {products.length} Products
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Overview of software products, deployed host counts, and designated product owners.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search product, owner, BU..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-400/50 transition-colors"
            />
          </div>
          <button
            onClick={loadProducts}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Products"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Total Products</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{products.length}</div>
          <span className="text-[10px] text-slate-500 font-mono">Catalogued software classifications</span>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Deployed Servers</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{totalAssets}</div>
          <span className="text-[10px] text-slate-500 font-mono">Across all datacenters</span>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Product Owners</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{allOwners.length}</div>
          <span className="text-[10px] text-slate-500 font-mono">Accountable managers</span>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Fleet Availability</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
            {totalAssets > 0 ? Math.round((totalOnline / totalAssets) * 100) : 100}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{totalOnline} of {totalAssets} online</span>
        </div>
      </div>

      {/* 3. Product Cards Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono text-slate-400">Loading product portfolio...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-white/[0.02] border border-white/10 p-8">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No products found</h3>
          <p className="text-xs text-slate-400 mt-1">No products match your search query &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map(product => {
            const isExpanded = expandedProduct === product.name;
            const primaryOwner = product.product_owners[0] || {
              name: product.primary_owner || 'Unassigned',
              email: '',
              server_count: product.total_servers,
            };

            return (
              <div
                key={product.name}
                className="rounded-xl bg-[#0c1222]/90 border border-white/10 hover:border-blue-500/40 transition-all shadow-xl flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top / Header */}
                <div className="p-5 space-y-4">
                  {/* Name and Server Count */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white tracking-wide group-hover:text-blue-300 transition-colors">
                          {product.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-[11px] font-mono text-emerald-400">
                            {product.powered_on} / {product.total_servers} Online
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Count Pill */}
                    <div className="flex flex-col items-end">
                      <span className="text-lg font-bold font-mono text-white">
                        {product.total_servers}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                        {product.total_servers === 1 ? 'Server' : 'Servers'}
                      </span>
                    </div>
                  </div>

                  {/* Primary Product Owner Section (Requested) */}
                  <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-mono">
                      <span className="flex items-center gap-1.5 text-blue-300">
                        <User className="w-3.5 h-3.5" />
                        Product Owner
                      </span>
                      {product.product_owners.length > 1 && (
                        <span className="text-[10px] text-slate-500">
                          +{product.product_owners.length - 1} co-owner
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xs font-mono font-semibold text-blue-300 shrink-0">
                          {primaryOwner.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {primaryOwner.name}
                          </div>
                          {primaryOwner.email && (
                            <a
                              href={`mailto:${encodeURIComponent(primaryOwner.email)}`}
                              className="text-[10px] text-slate-400 hover:text-blue-400 font-mono truncate block transition-colors"
                              title={`Email ${primaryOwner.name}`}
                            >
                              {primaryOwner.email}
                            </a>
                          )}
                        </div>
                      </div>

                      {primaryOwner.email && (
                        <button
                          onClick={e => handleCopyEmail(primaryOwner.email, e)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                          title="Copy email address"
                        >
                          {copiedEmail === primaryOwner.email ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Secondary owners if any */}
                    {product.product_owners.length > 1 && (
                      <div className="pt-2 border-t border-white/5 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-slate-500 font-mono">Co-leads:</span>
                        {product.product_owners.slice(1).map(po => (
                          <span
                            key={po.name}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5 flex items-center gap-1"
                          >
                            <span>{po.name}</span>
                            <span className="text-[9px] text-slate-500 font-normal">({po.server_count})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Business Units & Customers */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                      Business Units & Customers
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.business_units.map(bu => (
                        <span
                          key={bu}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                        >
                          <Building2 className="w-3 h-3 text-blue-400" />
                          {bu}
                        </span>
                      ))}
                      {product.customers.map(c => (
                        <span
                          key={c}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Server Workload Functions */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                      Workload Roles & Functions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.functions.map(fn => (
                        <span
                          key={fn}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1"
                        >
                          <Cpu className="w-2.5 h-2.5 text-purple-400" />
                          {fn}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Server List inside card */}
                  {isExpanded && product.servers && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-in fade-in">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                        Assigned Servers ({product.servers.length})
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {product.servers.map(s => (
                          <div
                            key={s.id}
                            onClick={() => onSelectServer && onSelectServer(s.id)}
                            className="p-2 rounded bg-black/40 border border-white/5 hover:border-blue-400/40 transition-colors cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-mono text-slate-200 truncate font-medium">
                                {s.host}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {s.vm} &bull; {s.ip}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                                {s.function || 'Server'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-white/[0.02] border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setExpandedProduct(isExpanded ? null : product.name)}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide' : 'Quick View'} Hosts</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onOpenIncidentWithServers && (
                      <button
                        onClick={() => onOpenIncidentWithServers(product.server_ids)}
                        className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        title="Triage all servers of this product"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => onFilterInventory && onFilterInventory({ product: product.name })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/20"
                    >
                      <span>View Servers</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
