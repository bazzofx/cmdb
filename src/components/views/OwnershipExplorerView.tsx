import React, { useEffect, useRef, useState, Component, type ReactNode } from 'react';
import cytoscape from 'cytoscape';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Download,
  X,
  ExternalLink,
  Share2,
  Eye,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { ServerRecord } from '../../types/index.js';

interface OwnershipExplorerViewProps {
  onSelectServer: (id: string) => void;
}

// Defensive Error Boundary to protect the application from uncaught runtime graph errors
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class OwnershipErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Ownership graph boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl bg-[#0D1424]/90 border border-rose-500/30 text-center space-y-4 max-w-lg mx-auto my-12">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Relationship Graph Recovered</h3>
            <p className="text-xs text-slate-300">
              The topology renderer encountered an edge-mapping anomaly with the active filters.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            Reload Graph Explorer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const OwnershipExplorerInternal: React.FC<OwnershipExplorerViewProps> = ({
  onSelectServer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Connection visibility toggle
  const [showConnections, setShowConnections] = useState<boolean>(true);

  // Node Type Filters
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
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [edgeCount, setEdgeCount] = useState<number>(0);

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

  const handleResetFilters = () => {
    setVisibleTypes({
      business_unit: true,
      sub_business_unit: true,
      product: true,
      server: true,
      manager: true,
      network: true,
      hypervisor: true,
    });
    setShowConnections(true);
    setSelectedBU('all');
    setSelectedNode(null);
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
    const addedEdgeIds = new Set<string>();

    const addNode = (id: string, label: string, type: string, extraData: any = {}) => {
      if (!id) return;
      if (!addedNodeIds.has(id)) {
        addedNodeIds.add(id);
        elements.push({
          group: 'nodes',
          data: {
            id,
            label,
            type,
            ...extraData,
          },
        });
      }
    };

    const addEdge = (source: string | null | undefined, target: string | null | undefined, edgeType: string) => {
      if (!showConnections) return;
      if (!source || !target) return;
      // CRITICAL FIX: Cytoscape crashes if an edge points to a source or target that does not exist in addedNodeIds
      if (!addedNodeIds.has(source) || !addedNodeIds.has(target)) return;

      const edgeId = `edge_${source}_${target}_${edgeType}`;
      if (!addedEdgeIds.has(edgeId)) {
        addedEdgeIds.add(edgeId);
        elements.push({
          group: 'edges',
          data: {
            id: edgeId,
            source,
            target,
            edgeType,
          },
        });
      }
    };

    // 1. Build Nodes based on current visibility checkboxes
    activeServers.forEach(s => {
      // Business Unit Node
      const buName = s.business_unit || 'Unassigned BU';
      const buId = `bu_${buName}`;
      if (visibleTypes.business_unit) {
        addNode(buId, buName, 'business_unit', {
          org: s.organisation_short_code,
          customer: s.customer,
        });
      }

      // Sub-BU Node
      const subBuName = s.sub_business_unit;
      const subBuId = subBuName ? `subbu_${subBuName}` : null;
      if (subBuId && visibleTypes.sub_business_unit) {
        addNode(subBuId, subBuName, 'sub_business_unit');
      }

      // Product Node
      const prodName = s.product;
      const prodId = prodName ? `prod_${prodName}` : null;
      if (prodId && visibleTypes.product) {
        addNode(prodId, prodName, 'product');
      }

      // Server Node (only VM info displayed on the circle)
      const serverNodeId = `server_${s.id}`;
      if (visibleTypes.server) {
        addNode(serverNodeId, s.vm || s.host || 'Unknown VM', 'server', {
          serverRecord: s,
          host: s.host,
          vm: s.vm,
          ip: s.primary_ip_address,
          power: s.power_state,
        });
      }

      // Manager Node
      const mgrName = s.manager;
      const mgrId = mgrName ? `mgr_${mgrName}` : null;
      if (mgrId && visibleTypes.manager) {
        addNode(mgrId, mgrName, 'manager', { email: s.email });
      }

      // Hypervisor Node
      const hostName = s.host;
      const hostId = hostName ? `host_${hostName}` : null;
      if (hostId && visibleTypes.hypervisor) {
        addNode(hostId, hostName, 'hypervisor', { dc: s.datacenter });
      }

      // Network Nodes
      if (visibleTypes.network) {
        [s.network_1, s.network_2].filter(Boolean).forEach(net => {
          const netId = `net_${net}`;
          addNode(netId, net, 'network');
        });
      }
    });

    // 2. Build Safe Edges (Only linking nodes that are actually present)
    activeServers.forEach(s => {
      const buId = `bu_${s.business_unit || 'Unassigned BU'}`;
      const subBuId = s.sub_business_unit ? `subbu_${s.sub_business_unit}` : null;
      const prodId = s.product ? `prod_${s.product}` : null;
      const serverNodeId = `server_${s.id}`;
      const mgrId = s.manager ? `mgr_${s.manager}` : null;
      const hostId = s.host ? `host_${s.host}` : null;

      // Link Sub-BU to BU if both are visible
      if (subBuId && addedNodeIds.has(subBuId) && addedNodeIds.has(buId)) {
        addEdge(buId, subBuId, 'contains');
      }

      // Link Product to closest visible ancestor (Sub-BU or BU)
      if (prodId && addedNodeIds.has(prodId)) {
        if (subBuId && addedNodeIds.has(subBuId)) {
          addEdge(subBuId, prodId, 'provides');
        } else if (addedNodeIds.has(buId)) {
          addEdge(buId, prodId, 'provides');
        }
      }

      // Link Server to closest visible ancestor (Product, Sub-BU, or BU)
      if (addedNodeIds.has(serverNodeId)) {
        if (prodId && addedNodeIds.has(prodId)) {
          addEdge(prodId, serverNodeId, 'runs');
        } else if (subBuId && addedNodeIds.has(subBuId)) {
          addEdge(subBuId, serverNodeId, 'runs');
        } else if (addedNodeIds.has(buId)) {
          addEdge(buId, serverNodeId, 'runs');
        }

        // Link Server to Manager
        if (mgrId && addedNodeIds.has(mgrId)) {
          addEdge(serverNodeId, mgrId, 'managed_by');
        }

        // Link Server to Hypervisor
        if (hostId && addedNodeIds.has(hostId)) {
          addEdge(serverNodeId, hostId, 'hosted_on');
        }

        // Link Server to Networks
        if (visibleTypes.network) {
          [s.network_1, s.network_2].filter(Boolean).forEach(net => {
            const netId = `net_${net}`;
            if (addedNodeIds.has(netId)) {
              addEdge(serverNodeId, netId, 'attached_to');
            }
          });
        }
      }
    });

    setNodeCount(addedNodeIds.size);
    setEdgeCount(addedEdgeIds.size);

    // Clean up selected node if it was filtered out
    if (selectedNode && !addedNodeIds.has(selectedNode.id)) {
      setSelectedNode(null);
    }

    // Safely destroy existing Cytoscape instance
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (err) {
        console.warn('Cytoscape cleanup warning:', err);
      }
      cyRef.current = null;
    }

    // If no nodes are visible, avoid initializing Cytoscape with empty elements
    if (addedNodeIds.size === 0) {
      setGraphError(null);
      return;
    }

    try {
      // Pick layout safely: use grid/circle if edges are hidden or 0 edges exist
      const hasEdges = addedEdgeIds.size > 0;
      const layoutConfig: any = hasEdges
        ? {
            name: 'cose',
            animate: false,
            randomize: false,
            componentSpacing: 60,
            nodeOverlap: 20,
            idealEdgeLength: 60,
          }
        : {
            name: 'grid',
            animate: false,
            padding: 30,
            rows: Math.ceil(Math.sqrt(addedNodeIds.size)),
          };

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
              'line-color': 'rgba(255, 255, 255, 0.15)',
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
          {
            selector: '.highlighted',
            style: {
              'line-color': '#38BDF8',
              'border-color': '#38BDF8',
              'border-width': 2.5,
            },
          },
        ],
        layout: layoutConfig,
      });

      // Node click handler
      cy.on('tap', 'node', evt => {
        try {
          const node = evt.target;
          const data = node.data();

          const neighbors = node.neighborhood('node').map((n: any) => n.data());

          setSelectedNode({
            id: data.id,
            label: data.label,
            type: data.type,
            extra: data,
            neighbors,
          });

          cy.elements().removeClass('highlighted');
          node.neighborhood().addClass('highlighted');
        } catch (err) {
          console.warn('Node selection handling warning:', err);
        }
      });

      cy.on('tap', evt => {
        if (evt.target === cy) {
          setSelectedNode(null);
          try {
            cy.elements().removeClass('highlighted');
          } catch (e) {
            // Ignore
          }
        }
      });

      cyRef.current = cy;
      setGraphError(null);
    } catch (err: any) {
      console.error('Error initializing Cytoscape graph:', err);
      setGraphError(err?.message || 'Error configuring topology elements');
    }

    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch (e) {
          // Ignore
        }
        cyRef.current = null;
      }
    };
  }, [servers, visibleTypes, selectedBU, showConnections]);

  const handleZoomIn = () => {
    try {
      if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.25);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleZoomOut = () => {
    try {
      if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 0.8);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleFit = () => {
    try {
      cyRef.current?.fit();
    } catch (e) {
      console.warn(e);
    }
  };

  const handleReset = () => {
    try {
      if (cyRef.current) {
        const hasEdges = edgeCount > 0;
        cyRef.current.layout(hasEdges ? { name: 'cose', animate: true } : { name: 'grid', animate: true }).run();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const exportPng = () => {
    try {
      if (!cyRef.current) return;
      const png64 = cyRef.current.png({ full: true, bg: '#070B14' });
      const link = document.createElement('a');
      link.href = png64;
      link.download = `ownership-graph-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export graph failed:', e);
    }
  };

  return (
    <div className="space-y-4 max-w-full h-[calc(100vh-6rem)] flex flex-col select-none">
      {/* Top Controls Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0D1424]/90 border border-slate-800/80 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide font-sans">
                OWNERSHIP RELATIONSHIP GRAPH
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                {nodeCount} Nodes · {edgeCount} Connections
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Progressive visualisation of organisational units, products, hypervisors, and managers
            </p>
          </div>
        </div>

        {/* Filter Controls & Presets (Targeted selector container) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* BU Filter */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Focus BU:</span>
            <select
              value={selectedBU}
              onChange={e => setSelectedBU(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0e1629]">All Units ({servers.length} servers)</option>
              {allBUs.map(bu => (
                <option key={bu} value={bu} className="bg-[#0e1629]">{bu}</option>
              ))}
            </select>
          </div>

          {/* Connections Toggle */}
          <button
            onClick={() => setShowConnections(!showConnections)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono border transition-all cursor-pointer ${
              showConnections
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title="Toggle visible connecting lines"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Connections {showConnections ? 'ON' : 'OFF'}</span>
          </button>

          {/* Node Toggles (Unit Boxes) */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
            {Object.entries(visibleTypes).map(([type, enabled]) => (
              <label
                key={type}
                className={`flex items-center gap-1.5 text-[11px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  enabled ? 'text-slate-200 font-medium' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e =>
                    setVisibleTypes(prev => ({ ...prev, [type]: e.target.checked }))
                  }
                  className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          {/* Graph Action Buttons */}
          <div className="flex items-center gap-1 font-mono">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              title="Fit to screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              title="Reset Layout"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportPng}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors cursor-pointer"
              title="Export Graph Image"
            >
              <Download className="w-3 h-3" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas & Detail Side Panel */}
      <div className="flex-1 rounded-2xl bg-[#080D1A] relative overflow-hidden flex border border-slate-800/80 shadow-2xl">
        {/* Graph Canvas Container */}
        <div ref={containerRef} className="flex-1 w-full h-full" />

        {/* Empty State Banner if all nodes are filtered out */}
        {nodeCount === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#070B14]/80 backdrop-blur-sm z-20 space-y-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400">
              <Eye className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">All Node Types Currently Hidden</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Enable one or more unit boxes (Business Unit, Product, Server, etc.) above to visualise their relations.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Show All Unit Types</span>
            </button>
          </div>
        )}

        {/* Graph Error Fallback Notice */}
        {graphError && (
          <div className="absolute top-4 left-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3 z-30 shadow-xl backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Topology adjusted for active selection.</span>
            <button
              onClick={handleResetFilters}
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono text-[10px] cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {/* Graph Legend */}
        <div className="absolute left-4 bottom-4 p-3.5 rounded-xl bg-[#0F172A]/90 border border-slate-700/60 backdrop-blur-md text-[11px] font-mono space-y-1.5 select-none pointer-events-none z-10 shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">Graph Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-600 border border-purple-400 shadow-sm" />
            <span className="text-slate-300">Business Unit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400 shadow-sm" />
            <span className="text-slate-300">Product / Sub-BU</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-900 border border-cyan-400 shadow-sm" />
            <span className="text-slate-300">Server (VM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-600 border border-amber-400 shadow-sm" />
            <span className="text-slate-300">Operational Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400 shadow-sm" />
            <span className="text-slate-300">Network Segment</span>
          </div>
        </div>

        {/* Node Information Panel */}
        {selectedNode && (
          <div className="w-80 border-l border-slate-800 bg-[#0F172A]/95 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-20 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-2 border-b border-white/10">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
                    Node Details ({selectedNode.type?.replace(/_/g, ' ')})
                  </span>
                  <h3 className="text-sm font-bold text-white font-mono break-words">
                    {selectedNode.label}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Server Specific Info */}
              {selectedNode.type === 'server' && selectedNode.extra?.serverRecord && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Host:</span>
                      <span className="text-white">{selectedNode.extra.serverRecord.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">VM:</span>
                      <span className="text-white">{selectedNode.extra.serverRecord.vm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IP:</span>
                      <span className="text-cyan-300">{selectedNode.extra.serverRecord.primary_ip_address}</span>
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
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <span>Open Server Detail Drawer</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Manager Specific Info */}
              {selectedNode.type === 'manager' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Contact Email:</span>
                    <span className="font-mono text-amber-300 block">{selectedNode.extra?.email || 'None'}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Associated with {selectedNode.neighbors?.length || 0} entities across the infrastructure.
                  </p>
                </div>
              )}

              {/* Business Unit Specific Info */}
              {selectedNode.type === 'business_unit' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Org Code:</span>
                      <span className="font-mono text-purple-300">{selectedNode.extra?.org || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Customer:</span>
                      <span className="text-slate-200">{selectedNode.extra?.customer || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Connected Neighbors list */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider font-semibold">
                  Associated Entities ({selectedNode.neighbors?.length || 0}):
                </span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedNode.neighbors?.map((nb: any) => (
                    <div
                      key={nb.id}
                      className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] font-mono flex items-center justify-between"
                    >
                      <span className="text-slate-300 truncate max-w-[170px]">{nb.label?.split('\n')[0]}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
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

export const OwnershipExplorerView: React.FC<OwnershipExplorerViewProps> = (props) => {
  return (
    <OwnershipErrorBoundary>
      <OwnershipExplorerInternal {...props} />
    </OwnershipErrorBoundary>
  );
};
