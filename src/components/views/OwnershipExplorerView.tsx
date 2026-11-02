import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Download,
  Filter,
  User,
  Building2,
  Server,
  Network,
  Cpu,
  Database,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface OwnershipExplorerViewProps {
  onSelectServer: (id: string) => void;
}

export const OwnershipExplorerView: React.FC<OwnershipExplorerViewProps> = ({
  onSelectServer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({
    business_unit: true,
    sub_business_unit: true,
    product: true,
    server: true,
    manager: true,
    network: true,
    hypervisor: true,
  });

  const [selectedBU, setSelectedBU] = useState<string>('all');
  const [allBUs, setAllBUs] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getServers({ limit: 500 });
      setServers(res.items);
      const bus = Array.from(new Set(res.items.map(s => s.business_unit).filter(Boolean)));
      setAllBUs(bus);
    } catch (err) {
      console.error('Failed to load servers for graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || servers.length === 0) return;

    // Filter servers if a specific BU is selected
    const activeServers =
      selectedBU === 'all'
        ? servers
        : servers.filter(s => (s.business_unit || '').toLowerCase() === selectedBU.toLowerCase());

    const elements: cytoscape.ElementDefinition[] = [];
    const addedNodeIds = new Set<string>();

    const addNode = (id: string, label: string, type: string, extraData: any = {}) => {
      if (!addedNodeIds.has(id)) {
        addedNodeIds.add(id);
        elements.push({
          data: {
            id,
            label,
            type,
            ...extraData,
          },
        });
      }
    };

    const addEdge = (source: string, target: string, edgeType: string) => {
      elements.push({
        data: {
          id: `${source}__${target}`,
          source,
          target,
          edgeType,
        },
      });
    };

    // Construct relational graph structure
    activeServers.forEach(s => {
      const buId = `bu_${s.business_unit || 'Unassigned'}`;
      if (visibleTypes.business_unit) {
        addNode(buId, s.business_unit || 'Unassigned BU', 'business_unit', {
          org: s.organisation_short_code,
          customer: s.customer,
        });
      }

      // Sub-BU
      let parentForProduct = buId;
      if (s.sub_business_unit && visibleTypes.sub_business_unit) {
        const subBuId = `subbu_${s.sub_business_unit}`;
        addNode(subBuId, s.sub_business_unit, 'sub_business_unit');
        if (visibleTypes.business_unit) addEdge(buId, subBuId, 'contains');
        parentForProduct = subBuId;
      }

      // Product
      let parentForServer = parentForProduct;
      if (s.product && visibleTypes.product) {
        const prodId = `prod_${s.product}`;
        addNode(prodId, s.product, 'product');
        addEdge(parentForProduct, prodId, 'provides');
        parentForServer = prodId;
      }

      // Server node
      const serverNodeId = `server_${s.id}`;
      if (visibleTypes.server) {
        addNode(serverNodeId, `${s.host}\n(${s.vm})`, 'server', {
          serverRecord: s,
          host: s.host,
          vm: s.vm,
          ip: s.primary_ip_address,
          power: s.power_state,
        });

        addEdge(parentForServer, serverNodeId, 'runs');

        // Associated Manager
        if (s.manager && visibleTypes.manager) {
          const mgrId = `mgr_${s.manager}`;
          addNode(mgrId, s.manager, 'manager', { email: s.email });
          addEdge(serverNodeId, mgrId, 'managed_by');
        }

        // Associated Hypervisor Host
        if (s.host && visibleTypes.hypervisor) {
          const hostId = `host_${s.host}`;
          addNode(hostId, s.host, 'hypervisor', { dc: s.datacenter });
          addEdge(serverNodeId, hostId, 'hosted_on');
        }

        // Associated Network(s)
        if (visibleTypes.network) {
          [s.network_1, s.network_2].filter(Boolean).forEach(net => {
            const netId = `net_${net}`;
            addNode(netId, net, 'network');
            addEdge(serverNodeId, netId, 'attached_to');
          });
        }
      }
    });

    // Destroy existing
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#E2E8F0',
            'font-size': '10px',
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '90px',
            'border-width': 1.5,
            width: 44,
            height: 44,
            'transition-property': 'background-color, border-color, width, height',
            'transition-duration': 0.2,
          },
        },
        {
          selector: 'node[type = "business_unit"]',
          style: {
            'background-color': '#6D28D9',
            'border-color': '#A78BFA',
            width: 60,
            height: 60,
            'font-weight': 'bold',
            'font-size': '11px',
          },
        },
        {
          selector: 'node[type = "sub_business_unit"]',
          style: {
            'background-color': '#4338CA',
            'border-color': '#818CF8',
            width: 48,
            height: 48,
          },
        },
        {
          selector: 'node[type = "product"]',
          style: {
            'background-color': '#1D4ED8',
            'border-color': '#60A5FA',
            width: 44,
            height: 44,
          },
        },
        {
          selector: 'node[type = "server"]',
          style: {
            'background-color': '#0F172A',
            'border-color': '#38BDF8',
            width: 52,
            height: 52,
            'font-size': '9px',
          },
        },
        {
          selector: 'node[type = "manager"]',
          style: {
            'background-color': '#B45309',
            'border-color': '#FBBF24',
            width: 46,
            height: 46,
          },
        },
        {
          selector: 'node[type = "hypervisor"]',
          style: {
            'background-color': '#1E293B',
            'border-color': '#94A3B8',
            width: 44,
            height: 44,
            shape: 'diamond',
          },
        },
        {
          selector: 'node[type = "network"]',
          style: {
            'background-color': '#047857',
            'border-color': '#34D399',
            width: 42,
            height: 42,
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#F43F5E',
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': 'rgba(255, 255, 255, 0.12)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'none',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 2.5,
            'line-color': '#60A5FA',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        componentSpacing: 70,
        nodeOverlap: 20,
        idealEdgeLength: 60,
      },
    });

    // Node click handler (Section 10.2)
    cy.on('tap', 'node', evt => {
      const node = evt.target;
      const data = node.data();

      // Find connected nodes
      const neighbors = node.neighborhood('node').map((n: any) => n.data());

      setSelectedNode({
        id: data.id,
        label: data.label,
        type: data.type,
        extra: data,
        neighbors,
      });

      // Highlight connections
      cy.elements().removeClass('highlighted');
      node.neighborhood().addClass('highlighted');
    });

    cy.on('tap', evt => {
      if (evt.target === cy) {
        setSelectedNode(null);
        cy.elements().removeClass('highlighted');
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [servers, visibleTypes, selectedBU]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit();
  const handleReset = () => {
    cyRef.current?.layout({ name: 'cose', animate: true }).run();
  };

  const exportPng = () => {
    if (!cyRef.current) return;
    const png64 = cyRef.current.png({ full: true, bg: '#0B1020' });
    const link = document.createElement('a');
    link.href = png64;
    link.download = `csm_ownership_graph_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  };

  return (
    <div className="space-y-4 max-w-full h-[calc(100vh-6rem)] flex flex-col">
      {/* Top Controls Bar */}
      <div className="p-3.5 rounded-xl soc-glass-panel flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              OWNERSHIP RELATIONSHIP GRAPH
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Progressive visualisation of organisational units, products, hypervisors, and managers
            </p>
          </div>
        </div>

        {/* Filter Controls & Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* BU Filter */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Focus BU:</span>
            <select
              value={selectedBU}
              onChange={e => setSelectedBU(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none"
            >
              <option value="all">All Units ({servers.length} servers)</option>
              {allBUs.map(bu => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>

          {/* Node Toggles */}
          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
            {Object.entries(visibleTypes).map(([type, enabled]) => (
              <label key={type} className="flex items-center gap-1 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e =>
                    setVisibleTypes(prev => ({ ...prev, [type]: e.target.checked }))
                  }
                  className="rounded border-white/20 bg-white/5"
                />
                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          {/* Graph Action Buttons */}
          <div className="flex items-center gap-1 font-mono">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
              title="Fit to screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300"
              title="Reset Layout"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportPng}
              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
              title="Export Graph Image"
            >
              <Download className="w-3 h-3" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas & Detail Side Panel */}
      <div className="flex-1 rounded-xl soc-glass-panel relative overflow-hidden flex border border-white/10">
        {/* Graph Canvas */}
        <div ref={containerRef} className="flex-1 w-full h-full bg-[#080D1A]" />

        {/* Legend */}
        <div className="absolute left-3 bottom-3 p-3 rounded-lg bg-[#0F172A]/90 border border-white/10 backdrop-blur-md text-[11px] font-mono space-y-1.5 select-none pointer-events-none z-10 shadow-lg">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Graph Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-600 border border-purple-400" />
            <span className="text-slate-300">Business Unit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400" />
            <span className="text-slate-300">Product / Sub-BU</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-900 border border-cyan-400" />
            <span className="text-slate-300">Server (Host & VM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-600 border border-amber-400" />
            <span className="text-slate-300">Operational Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400" />
            <span className="text-slate-300">Network Segment</span>
          </div>
        </div>

        {/* 10.2 INFORMATION PANEL (When a node is selected) */}
        {selectedNode && (
          <div className="w-80 border-l border-white/10 bg-[#0F172A]/95 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-20">
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-2 border-b border-white/10">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
                    Node Details ({selectedNode.type.replace(/_/g, ' ')})
                  </span>
                  <h3 className="text-sm font-bold text-white font-mono break-words">
                    {selectedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Node Type Specific Info */}
              {selectedNode.type === 'server' && selectedNode.extra.serverRecord && (
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Host:</span>
                      <span className="font-mono text-white">{selectedNode.extra.serverRecord.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">VM:</span>
                      <span className="font-mono text-white">{selectedNode.extra.serverRecord.vm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IP:</span>
                      <span className="font-mono text-cyan-300">{selectedNode.extra.serverRecord.primary_ip_address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Manager:</span>
                      <span className="text-amber-300">{selectedNode.extra.serverRecord.manager}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Business Unit:</span>
                      <span className="text-purple-300">{selectedNode.extra.serverRecord.business_unit}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectServer(selectedNode.extra.serverRecord.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    <span>Open Server Detail Drawer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {selectedNode.type === 'manager' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Contact Email:</span>
                    <span className="font-mono text-amber-300 block">{selectedNode.extra.email || 'None'}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Connected to {selectedNode.neighbors?.length || 0} systems across inventory.
                  </p>
                </div>
              )}

              {selectedNode.type === 'business_unit' && (
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Org Code:</span>
                      <span className="font-mono text-purple-300">{selectedNode.extra.org || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Customer:</span>
                      <span className="text-slate-200">{selectedNode.extra.customer || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Neighbors list */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Associated Entities ({selectedNode.neighbors?.length || 0}):
                </span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedNode.neighbors?.map((nb: any) => (
                    <div
                      key={nb.id}
                      className="p-1.5 rounded bg-white/[0.02] border border-white/5 text-[11px] font-mono flex items-center justify-between"
                    >
                      <span className="text-slate-300 truncate max-w-[170px]">{nb.label.split('\n')[0]}</span>
                      <span className="text-[9px] uppercase px-1 rounded bg-white/5 text-slate-400">
                        {nb.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
