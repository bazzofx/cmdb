import React, { useEffect, useRef, useState, useMemo, Component, type ReactNode } from 'react';
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
  Building2,
  Server,
  UserCheck,
  Layers,
  Info,
  Orbit,
  Workflow,
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
        <div className="p-8 rounded-2xl bg-[var(--surface-2)]/95 border border-rose-500/30 text-center space-y-4 max-w-lg mx-auto my-12 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Relationship Graph Recovered</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              The topology renderer encountered an edge-mapping anomaly with the active filters.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md transition-colors"
          >
            Reload Graph Explorer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface HoverTooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: any;
}

// Layout Position Computation Helper
const computePositions = (
  nodes: { id: string; type: string; label: string; [key: string]: any }[],
  mode: 'radial' | 'linear'
): Record<string, { x: number; y: number }> => {
  const positions: Record<string, { x: number; y: number }> = {};

  const buList = nodes.filter(n => n.type === 'business_unit');
  const subBuList = nodes.filter(n => n.type === 'sub_business_unit');
  const prodList = nodes.filter(n => n.type === 'product');
  const srvList = nodes.filter(n => n.type === 'server');
  const mgrList = nodes.filter(n => n.type === 'manager');

  if (mode === 'radial') {
    // 1. Central Hero Circular Radius for SERVERS (VMs)
    const srvTotal = srvList.length;
    const rServerX = Math.max(160, Math.min(240, 26 * Math.max(4, srvTotal)));
    const rServerY = Math.max(160, Math.min(230, 24 * Math.max(4, srvTotal)));

    srvList.forEach((s, idx) => {
      // Distribute evenly around the central circular orbit
      const angle = (idx / Math.max(1, srvTotal)) * 2 * Math.PI - Math.PI / 2;
      positions[s.id] = {
        x: Math.round(rServerX * Math.cos(angle)),
        y: Math.round(rServerY * Math.sin(angle)),
      };
    });

    // 2. Concentric Radial Arcs to the LEFT:
    // Arc 1 (Products): Closest concentric arc to the left (radius ~ rServerX + 175)
    const prodTotal = prodList.length;
    const rProd = rServerX + 175;
    const prodSpan = Math.min(Math.PI * 0.72, Math.max(0.65, prodTotal * 0.35));
    prodList.forEach((p, idx) => {
      const step = prodTotal > 1 ? (idx - (prodTotal - 1) / 2) * (prodSpan / (prodTotal - 1)) : 0;
      const angle = Math.PI + step; // 180° = Leftwards
      positions[p.id] = {
        x: Math.round(rProd * Math.cos(angle)),
        y: Math.round(rProd * Math.sin(angle)),
      };
    });

    // Arc 2 (Sub-BUs): Middle concentric arc to the left (radius ~ rProd + 160)
    const subBuTotal = subBuList.length;
    const rSubBu = rProd + (subBuTotal > 0 ? 160 : 0);
    const subBuSpan = Math.min(Math.PI * 0.7, Math.max(0.6, subBuTotal * 0.35));
    subBuList.forEach((sb, idx) => {
      const step = subBuTotal > 1 ? (idx - (subBuTotal - 1) / 2) * (subBuSpan / (subBuTotal - 1)) : 0;
      const angle = Math.PI + step;
      positions[sb.id] = {
        x: Math.round(rSubBu * Math.cos(angle)),
        y: Math.round(rSubBu * Math.sin(angle)),
      };
    });

    // Arc 3 (Business Units): Outermost concentric arc to the left
    const buTotal = buList.length;
    const rBu = rSubBu + (subBuTotal > 0 ? 175 : 185);
    const buSpan = Math.min(Math.PI * 0.65, Math.max(0.5, buTotal * 0.38));
    buList.forEach((bu, idx) => {
      const step = buTotal > 1 ? (idx - (buTotal - 1) / 2) * (buSpan / (buTotal - 1)) : 0;
      const angle = Math.PI + step;
      positions[bu.id] = {
        x: Math.round(rBu * Math.cos(angle)),
        y: Math.round(rBu * Math.sin(angle)),
      };
    });

    // 3. Radial Arc to the RIGHT for Operational Managers
    const mgrTotal = mgrList.length;
    const rMgr = Math.max(340, rServerX + 175);
    const mgrSpan = Math.min(Math.PI * 0.65, Math.max(0.5, mgrTotal * 0.35));
    mgrList.forEach((m, idx) => {
      const step = mgrTotal > 1 ? (idx - (mgrTotal - 1) / 2) * (mgrSpan / (mgrTotal - 1)) : 0;
      const angle = 0 + step; // 0° = Rightwards
      positions[m.id] = {
        x: Math.round(rMgr * Math.cos(angle)),
        y: Math.round(rMgr * Math.sin(angle)),
      };
    });

    return positions;
  }

  // Linear Flow (Tiered Governance Columns from Left to Right)
  // Col 1: Business Units (x = -480)
  const buTotal = buList.length;
  buList.forEach((bu, idx) => {
    const spacing = Math.min(80, Math.max(50, 480 / Math.max(1, buTotal)));
    const y = (idx - (buTotal - 1) / 2) * spacing;
    positions[bu.id] = { x: -480, y };
  });

  // Col 2: Sub-Business Units (x = -270)
  const subBuTotal = subBuList.length;
  subBuList.forEach((sb, idx) => {
    const spacing = Math.min(75, Math.max(48, 500 / Math.max(1, subBuTotal)));
    const y = (idx - (subBuTotal - 1) / 2) * spacing;
    positions[sb.id] = { x: -270, y };
  });

  // Col 3: Products (x = -50)
  const prodTotal = prodList.length;
  prodList.forEach((p, idx) => {
    const spacing = Math.min(75, Math.max(48, 500 / Math.max(1, prodTotal)));
    const y = (idx - (prodTotal - 1) / 2) * spacing;
    positions[p.id] = { x: -50, y };
  });

  // Col 4: SERVERS (Hero Center, x = 190 or balanced split 140 / 310)
  const srvTotal = srvList.length;
  if (srvTotal <= 7) {
    srvList.forEach((s, idx) => {
      const spacing = Math.min(65, Math.max(48, 520 / Math.max(1, srvTotal)));
      const y = (idx - (srvTotal - 1) / 2) * spacing;
      positions[s.id] = { x: 190, y };
    });
  } else {
    const srvsPerCol = Math.ceil(srvTotal / 2);
    srvList.forEach((s, idx) => {
      const col = Math.floor(idx / srvsPerCol);
      const row = idx % srvsPerCol;
      const rowsInThisCol = Math.min(srvsPerCol, srvTotal - col * srvsPerCol);
      const x = 140 + col * 170;
      const spacing = Math.min(60, Math.max(46, 520 / Math.max(1, rowsInThisCol)));
      const y = (row - (rowsInThisCol - 1) / 2) * spacing;
      positions[s.id] = { x, y };
    });
  }

  // Col 5: Operational Managers (x = 440 or 500)
  const mgrTotal = mgrList.length;
  const mgrX = srvTotal > 7 ? 500 : 440;
  mgrList.forEach((m, idx) => {
    const spacing = Math.min(75, Math.max(48, 500 / Math.max(1, mgrTotal)));
    const y = (idx - (mgrTotal - 1) / 2) * spacing;
    positions[m.id] = { x: mgrX, y };
  });

  return positions;
};

const OwnershipExplorerInternal: React.FC<OwnershipExplorerViewProps> = ({
  onSelectServer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const handleNodeSelectRef = useRef<((node: cytoscape.NodeSingular) => void) | null>(null);

  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Connection visibility toggle (preserved)
  const [showConnections, setShowConnections] = useState<boolean>(true);

  // Visualization Layout Mode: 'radial' (Radial Orbit - Default) vs 'linear' (Linear Flow)
  const [visualizationMode, setVisualizationMode] = useState<'radial' | 'linear'>('radial');

  // Filter types - Network and Hypervisor removed as requested
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({
    business_unit: true,
    sub_business_unit: true,
    product: true,
    server: true,
    manager: true,
  });

  const [selectedBU, setSelectedBU] = useState<string>('all');
  const [allBUs, setAllBUs] = useState<string[]>([]);
  const [nodeCount, setNodeCount] = useState<number>(0);

  // Interactive Hover Tooltip State
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

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
    });
    setShowConnections(true);
    setSelectedBU('all');
    setSelectedNode(null);
    setVisualizationMode('radial');
  };

  // Filter servers if a specific BU is selected
  const activeServers = useMemo(() => {
    if (selectedBU === 'all') return servers;
    return servers.filter(s => (s.business_unit || '').toLowerCase() === selectedBU.toLowerCase());
  }, [servers, selectedBU]);

  // Main Cytoscape Graph Building & Positioning
  useEffect(() => {
    if (!containerRef.current || servers.length === 0) return;

    const elements: cytoscape.ElementDefinition[] = [];
    const addedNodeIds = new Set<string>();
    const addedEdgeIds = new Set<string>();

    const addNode = (
      id: string,
      label: string,
      type: string,
      extraData: any = {}
    ) => {
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

    const addEdge = (
      source: string | null | undefined,
      target: string | null | undefined,
      edgeType: string
    ) => {
      if (!showConnections) return;
      if (!source || !target) return;
      // CRITICAL DEFENSIVE CHECK: Cytoscape crashes if an edge points to a source or target that does not exist in addedNodeIds
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

    // 1. Build Nodes based on active visible types
    // Business Units
    if (visibleTypes.business_unit) {
      const buMap = new Map<string, { label: string; org?: string; customer?: string }>();
      activeServers.forEach(s => {
        const buName = s.business_unit || 'Unassigned BU';
        buMap.set(`bu_${buName}`, {
          label: buName,
          org: s.organisation_short_code,
          customer: s.customer,
        });
      });
      buMap.forEach((val, id) => {
        addNode(id, val.label, 'business_unit', {
          org: val.org,
          customer: val.customer,
        });
      });
    }

    // Sub-Business Units
    if (visibleTypes.sub_business_unit) {
      const subBuMap = new Map<string, { label: string; buName: string }>();
      activeServers.forEach(s => {
        if (s.sub_business_unit) {
          subBuMap.set(`subbu_${s.sub_business_unit}`, {
            label: s.sub_business_unit,
            buName: s.business_unit || 'Unassigned BU',
          });
        }
      });
      subBuMap.forEach((val, id) => {
        addNode(id, val.label, 'sub_business_unit', {
          buName: val.buName,
        });
      });
    }

    // Products
    if (visibleTypes.product) {
      const prodMap = new Map<string, { label: string; subBu?: string; bu: string }>();
      activeServers.forEach(s => {
        if (s.product) {
          prodMap.set(`prod_${s.product}`, {
            label: s.product,
            subBu: s.sub_business_unit,
            bu: s.business_unit || 'Unassigned BU',
          });
        }
      });
      prodMap.forEach((val, id) => {
        addNode(id, val.label, 'product', {
          subBu: val.subBu,
          bu: val.bu,
        });
      });
    }

    // SERVERS (VMs) - Hero Main Component of the Graph
    if (visibleTypes.server) {
      activeServers.forEach(s => {
        const serverNodeId = `server_${s.id}`;
        addNode(serverNodeId, s.vm || s.host || 'Unknown VM', 'server', {
          serverRecord: s,
          host: s.host,
          vm: s.vm,
          ip: s.primary_ip_address,
          power: s.power_state,
          bu: s.business_unit,
          subBu: s.sub_business_unit,
          product: s.product,
          manager: s.manager,
        });
      });
    }

    // Operational Managers
    if (visibleTypes.manager) {
      const mgrMap = new Map<string, { label: string; email?: string }>();
      activeServers.forEach(s => {
        if (s.manager) {
          mgrMap.set(`mgr_${s.manager}`, {
            label: s.manager,
            email: s.email,
          });
        }
      });
      mgrMap.forEach((val, id) => {
        addNode(id, val.label, 'manager', {
          email: val.email,
        });
      });
    }

    // 2. Build Explicit Relationships:
    // Business Unit -> Sub-BU -> Product -> Server -> Manager
    activeServers.forEach(s => {
      const buId = visibleTypes.business_unit ? `bu_${s.business_unit || 'Unassigned BU'}` : null;
      const subBuId = visibleTypes.sub_business_unit && s.sub_business_unit ? `subbu_${s.sub_business_unit}` : null;
      const prodId = visibleTypes.product && s.product ? `prod_${s.product}` : null;
      const serverId = visibleTypes.server ? `server_${s.id}` : null;
      const mgrId = visibleTypes.manager && s.manager ? `mgr_${s.manager}` : null;

      // 1. Business Unit -> Sub-BU
      if (buId && subBuId) {
        addEdge(buId, subBuId, 'contains');
      }

      // 2. Preceding parent for Product (Sub-BU or BU)
      if (prodId) {
        if (subBuId) {
          addEdge(subBuId, prodId, 'provides');
        } else if (buId) {
          addEdge(buId, prodId, 'provides');
        }
      }

      // 3. Preceding parent for Server (Product, Sub-BU, or BU)
      if (serverId) {
        if (prodId) {
          addEdge(prodId, serverId, 'hosts');
        } else if (subBuId) {
          addEdge(subBuId, serverId, 'hosts');
        } else if (buId) {
          addEdge(buId, serverId, 'hosts');
        }

        // 4. Server -> Manager
        if (mgrId) {
          addEdge(serverId, mgrId, 'managed_by');
        }
      } else if (mgrId) {
        // If servers are unchecked, connect manager to Product, Sub-BU, or BU
        const fallbackParent = prodId || subBuId || buId;
        if (fallbackParent) {
          addEdge(fallbackParent, mgrId, 'manages');
        }
      }
    });

    setNodeCount(addedNodeIds.size);

    // Clean up selected node if it was filtered out
    if (selectedNode && !addedNodeIds.has(selectedNode.id)) {
      setSelectedNode(null);
    }

    // Safely destroy previous Cytoscape instance
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (err) {
        console.warn('Cytoscape cleanup warning:', err);
      }
      cyRef.current = null;
    }

    if (addedNodeIds.size === 0) {
      setGraphError(null);
      return;
    }

    // 3. Compute Positions based on active visualization mode
    const nodeElements = (elements.filter(e => e.group === 'nodes').map(e => e.data) as any[])
      .filter((n): n is { id: string; type: string; label: string; [key: string]: any } => Boolean(n && n.id));

    const positions = computePositions(nodeElements, visualizationMode);

    try {
      const cy = cytoscape({
        container: containerRef.current,
        elements,
        boxSelectionEnabled: false,
        autounselectify: false,
        style: [
          // Universal Node Styling: Modern Compact Pill/Card
          {
            selector: 'node',
            style: {
              shape: 'round-rectangle',
              label: 'data(label)',
              color: '#E8EDF7',
              'font-size': '12px',
              'font-family': 'Roboto, JetBrains Mono, sans-serif',
              'font-weight': 600,
              'text-valign': 'center',
              'text-halign': 'center',
              'text-wrap': 'wrap',
              'text-max-width': '125px',
              width: 146,
              height: 38,
              'border-width': 1.2,
              'border-color': 'rgba(148, 163, 184, 0.18)',
              'background-color': '#111A2E',
              'background-opacity': 0.95,
              'transition-property': 'background-color, border-color, border-width, width, height, opacity',
              'transition-duration': 0.2,
            },
          },
          // 1. Business Unit (Purple)
          {
            selector: 'node[type = "business_unit"]',
            style: {
              'background-color': '#1C1230',
              'border-color': '#A855F7',
              'border-width': 1.4,
              width: 152,
              height: 40,
              color: '#F3E8FF',
              'font-weight': 'bold',
            },
          },
          // 2. Sub-Business Unit (Indigo)
          {
            selector: 'node[type = "sub_business_unit"]',
            style: {
              'background-color': '#131833',
              'border-color': '#818CF8',
              'border-width': 1.2,
              width: 140,
              height: 36,
              color: '#E0E7FF',
            },
          },
          // 3. Product (Blue / Indigo)
          {
            selector: 'node[type = "product"]',
            style: {
              'background-color': '#101B36',
              'border-color': '#4F8CFF',
              'border-width': 1.2,
              width: 144,
              height: 38,
              color: '#DBEAFE',
            },
          },
          // 4. Server (VM) - Hero Element (Cyan with high contrast & glowing border)
          {
            selector: 'node[type = "server"]',
            style: {
              'background-color': '#081F33',
              'border-color': '#38BDF8',
              'border-width': 1.6,
              width: 152,
              height: 40,
              color: '#E0F2FE',
              'font-weight': 'bold',
            },
          },
          // 5. Manager (Amber)
          {
            selector: 'node[type = "manager"]',
            style: {
              'background-color': '#241708',
              'border-color': '#F59E0B',
              'border-width': 1.2,
              width: 144,
              height: 38,
              color: '#FEF3C7',
            },
          },
          // Selection Highlight
          {
            selector: 'node:selected',
            style: {
              'border-width': 2.5,
              'border-color': '#38BDF8',
              'background-color': '#1E293B',
              color: '#FFFFFF',
            },
          },
          // Edges: Elegant Curved Bézier Connectors
          {
            selector: 'edge',
            style: {
              width: 1.3,
              'line-color': 'rgba(148, 163, 184, 0.25)',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.65,
              'target-arrow-color': 'rgba(148, 163, 184, 0.4)',
              'line-opacity': 0.75,
              'transition-property': 'line-color, width, line-opacity, target-arrow-color',
              'transition-duration': 0.15,
            },
          },
          {
            selector: 'edge.highlighted',
            style: {
              width: 2.4,
              'line-color': '#38BDF8',
              'target-arrow-color': '#38BDF8',
              'line-opacity': 1,
              'z-index': 99,
            },
          },
          {
            selector: 'node.highlighted',
            style: {
              'border-width': 2.5,
              'border-color': '#38BDF8',
            },
          },
          {
            selector: '.dimmed',
            style: {
              opacity: 0.22,
            },
          },
        ],
        layout: {
          name: 'preset',
          positions,
          fit: true,
          padding: 40,
        } as cytoscape.PresetLayoutOptions,
      });

      // Interactive Hover Events (Border brightness, edge highlighting, tooltip)
      cy.on('mouseover', 'node', evt => {
        const node = evt.target;
        const data = node.data();

        // Highlight connected edges and dim unrelated elements
        cy.elements().addClass('dimmed');
        node.removeClass('dimmed').addClass('highlighted');
        const connectedEdges = node.connectedEdges();
        connectedEdges.removeClass('dimmed').addClass('highlighted');
        connectedEdges.connectedNodes().removeClass('dimmed');

        // Tooltip position
        const renderedPos = node.renderedPosition();
        setHoverTooltip({
          visible: true,
          x: renderedPos.x,
          y: renderedPos.y,
          data,
        });
      });

      cy.on('mouseout', 'node', () => {
        cy.elements().removeClass('dimmed').removeClass('highlighted');
        setHoverTooltip(prev => ({ ...prev, visible: false }));
      });

      // Interactive Click & Tap Handler (Opens first small window automatically on any node click)
      const handleNodeSelect = (node: cytoscape.NodeSingular) => {
        try {
          if (!node || !node.isNode || !node.isNode()) return;
          const data = node.data();
          if (!data || !data.id) return;

          const neighbors = node.neighborhood('node').map((n: any) => n.data());

          setSelectedNode({
            id: data.id,
            label: data.label,
            type: data.type,
            extra: data,
            neighbors,
          });

          cy.elements().removeClass('highlighted');
          node.addClass('highlighted');
          node.neighborhood().addClass('highlighted');
        } catch (err) {
          console.warn('Node selection handling warning:', err);
        }
      };

      handleNodeSelectRef.current = handleNodeSelect;

      cy.on('tap', 'node', evt => {
        handleNodeSelect(evt.target);
      });

      cy.on('click', 'node', evt => {
        handleNodeSelect(evt.target);
      });

      cy.on('select', 'node', evt => {
        handleNodeSelect(evt.target);
      });

      // Clicking empty canvas background deselects
      cy.on('tap', evt => {
        if (evt.target === cy) {
          setSelectedNode(null);
          try {
            cy.elements().removeClass('highlighted').removeClass('dimmed');
          } catch (e) {
            // Ignore
          }
        }
      });

      // Auto-resize observer to guarantee pixel-perfect hit-testing coordinates
      const resizeObserver = new ResizeObserver(() => {
        if (cyRef.current) {
          try {
            cyRef.current.resize();
          } catch (e) {
            // Ignore
          }
        }
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      cyRef.current = cy;
      setGraphError(null);

      return () => {
        resizeObserver.disconnect();
        if (cyRef.current) {
          try {
            cyRef.current.destroy();
          } catch (e) {
            // Ignore
          }
          cyRef.current = null;
        }
      };
    } catch (err: any) {
      console.error('Error initializing Cytoscape graph:', err);
      setGraphError(err?.message || 'Error configuring topology elements');
    }
  }, [servers, visibleTypes, selectedBU, showConnections]);

  // Smooth layout repositioning when switching between Radial Orbit and Linear Flow without destroying the graph instance
  useEffect(() => {
    if (!cyRef.current) return;
    try {
      const nodesData = cyRef.current.nodes().map(n => n.data());
      const newPos = computePositions(nodesData, visualizationMode);
      cyRef.current.layout({
        name: 'preset',
        positions: (node: cytoscape.NodeSingular) => newPos[node.id()] || node.position(),
        animate: true,
        animationDuration: 350,
        fit: true,
        padding: 40,
      } as any).run();
    } catch (err) {
      console.warn('Layout transition warning:', err);
    }
  }, [visualizationMode]);

  // Smooth layout switcher between Radial Orbit and Linear Flow
  const handleSwitchMode = (mode: 'radial' | 'linear') => {
    if (mode === visualizationMode) return;
    setVisualizationMode(mode);
  };

  // Zoom, Pan, Fit, and PNG Export Controls
  const handleZoomIn = () => {
    try {
      if (cyRef.current) cyRef.current.zoom({ level: cyRef.current.zoom() * 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleZoomOut = () => {
    try {
      if (cyRef.current) cyRef.current.zoom({ level: cyRef.current.zoom() * 0.8, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleFit = () => {
    try {
      cyRef.current?.fit(undefined, 40);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleReset = () => {
    try {
      if (cyRef.current) {
        const nodesData = cyRef.current.nodes().map(n => n.data());
        const newPos = computePositions(nodesData, visualizationMode);
        cyRef.current.layout({
          name: 'preset',
          positions: (node: cytoscape.NodeSingular) => newPos[node.id()] || node.position(),
          animate: true,
          animationDuration: 300,
          fit: true,
          padding: 40,
        } as any).run();
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const exportPng = () => {
    try {
      if (!cyRef.current) return;
      const png64 = cyRef.current.png({ full: true, bg: '#0B1223' });
      const link = document.createElement('a');
      link.href = png64;
      link.download = `soc-cmdb-ownership-${visualizationMode}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Export graph failed:', e);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'business_unit':
        return <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'sub_business_unit':
        return <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'product':
        return <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'server':
        return <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case 'manager':
        return <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-3 max-w-full h-[calc(100vh-5.5rem)] flex flex-col select-none bg-[var(--app-bg)] text-[var(--text-primary)]">
      {/* 1. TOP COMPACT CONTROL TOOLBAR (Strictly Single-Line Layout) */}
      <div className="px-3 py-2 rounded-xl bg-[var(--surface-2)]/90 border border-slate-800/80 shadow-xl backdrop-blur-md flex items-center justify-between gap-2.5 shrink-0 flex-nowrap overflow-x-auto">
        {/* Title & Count Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm shrink-0">
            <GitFork className="w-22 h-4" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-lg font-bold text-white tracking-wider font-sans shrink-0 uppercase">
              Ownership Graph
            </h1>
          </div>
        </div>

        {/* Filter Controls & Action Buttons (Strictly One Line) */}
        <div className="flex items-center flex-nowrap gap-1.5 text-xs shrink-0 whitespace-nowrap">
          {/* Focus BU Dropdown */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-lg shrink-0">
            <span className="text-[12px] font-mono text-[var(--text-secondary)] uppercase font-semibold">BU:</span>
            <select
              value={selectedBU}
              onChange={e => setSelectedBU(e.target.value)}
              className="bg-transparent text-slate-200 text-[14px] font-mono focus:outline-none cursor-pointer max-w-[95px] truncate"
              title="Focus Business Unit"
            >
              <option value="all" className="bg-[var(--surface-2)]">All</option>
              {allBUs.map(bu => (
                <option key={bu} value={bu} className="bg-[var(--surface-2)]">{bu}</option>
              ))}
            </select>
          </div>

          {/* Connections Toggle */}
          <button
            onClick={() => setShowConnections(!showConnections)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer shrink-0 ${
              showConnections
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title={`Connections: ${showConnections ? 'Active' : 'Hidden'}`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[12px] font-bold">{showConnections ? 'ON' : 'OFF'}</span>
          </button>

          {/* Visualization Option: Radial Orbit (Default) vs Linear Flow */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-[11px] font-mono shrink-0">
            <button
              onClick={() => handleSwitchMode('radial')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                visualizationMode === 'radial'
                  ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/50 font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-slate-200 hover:bg-white/5'
              }`}
              title="Radial Orbit View (Default): Central server ring with concentric arcs"
            >
              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[12px]">Orbit</span>
            </button>
            <button
              onClick={() => handleSwitchMode('linear')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                visualizationMode === 'linear'
                  ? 'bg-blue-600/30 text-blue-200 border border-blue-500/50 font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-slate-200 hover:bg-white/5'
              }`}
              title="Linear Flow View: Tiered governance columns"
            >
              <Workflow className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[12px]">Linear</span>
            </button>
          </div>

          {/* Node Category Checkboxes (Compact Pills with Short Labels) */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-lg shrink-0">
            {Object.entries(visibleTypes).map(([type, enabled]) => {
              const shortLabels: Record<string, string> = {
                business_unit: 'BU',
                sub_business_unit: 'Sub-BU',
                product: 'Prod',
                server: 'Server',
                manager: 'Mgr',
              };
              return (
                <label
                  key={type}
                  title={`Toggle ${type.replace(/_/g, ' ')}`}
                  className={`flex items-center gap-1 text-[12px] font-mono px-1 py-0.5 rounded cursor-pointer transition-colors ${
                    enabled ? 'text-slate-200 font-semibold' : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e =>
                      setVisibleTypes(prev => ({ ...prev, [type]: e.target.checked }))
                    }
                    className="rounded border-white/20 bg-white/5 text-blue-500 focus:ring-0 cursor-pointer w-2.5 h-2.5"
                  />
                  <span>{shortLabels[type] || type}</span>
                </label>
              );
            })}
          </div>

          {/* Graph Action Buttons: Zoom In, Zoom Out, Fit, Reset, Export PNG */}
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 p-0.5 rounded-lg shrink-0 font-mono">
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset Layout"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportPng}
              className="p-1 rounded bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 hover:text-white transition-colors cursor-pointer"
              title="Export PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN GRAPH CANVAS & DETAIL PANEL CONTAINER */}
      <div className="flex-1 rounded-2xl bg-[var(--surface-1)] relative overflow-hidden flex border border-slate-800/80 shadow-2xl">
        {/* Graph Canvas Mount Point */}
        <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Interactive Floating Hover Tooltip */}
        {hoverTooltip.visible && hoverTooltip.data && (
          <div
            className="absolute z-30 pointer-events-none p-3 rounded-xl bg-[var(--surface-2)]/95 border border-slate-700/60 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 max-w-xs transition-opacity duration-150 -translate-x-1/2 -translate-y-full -mt-3"
            style={{
              left: `${hoverTooltip.x}px`,
              top: `${hoverTooltip.y}px`,
            }}
          >
            <div className="flex items-center gap-2 pb-1 border-b border-white/10">
              {getNodeIcon(hoverTooltip.data.type)}
              <span className="font-bold text-white truncate">{hoverTooltip.data.label?.replace('\n', ' ')}</span>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)] space-y-0.5">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="text-white capitalize">{hoverTooltip.data.type?.replace(/_/g, ' ')}</span>
              </div>
              {hoverTooltip.data.ip && (
                <div className="flex justify-between">
                  <span>Primary IP:</span>
                  <span className="text-cyan-300">{hoverTooltip.data.ip}</span>
                </div>
              )}
              {hoverTooltip.data.host && (
                <div className="flex justify-between">
                  <span>Host:</span>
                  <span className="text-slate-300">{hoverTooltip.data.host}</span>
                </div>
              )}
              {hoverTooltip.data.product && (
                <div className="flex justify-between">
                  <span>Product:</span>
                  <span className="text-blue-300">{hoverTooltip.data.product}</span>
                </div>
              )}
              {hoverTooltip.data.manager && (
                <div className="flex justify-between">
                  <span>Manager:</span>
                  <span className="text-amber-300">{hoverTooltip.data.manager}</span>
                </div>
              )}
              {hoverTooltip.data.email && (
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="text-amber-300 truncate max-w-[150px]">{hoverTooltip.data.email}</span>
                </div>
              )}
              {hoverTooltip.data.bu && (
                <div className="flex justify-between">
                  <span>Business Unit:</span>
                  <span className="text-purple-300">{hoverTooltip.data.bu}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State Banner if all nodes are filtered out */}
        {nodeCount === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--app-bg)]/80 backdrop-blur-sm z-20 space-y-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400">
              <Eye className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">All Node Types Currently Hidden</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm">
                Enable one or more unit boxes (Business Unit, Sub-BU, Product, Server, Manager) above to visualise relations.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-md"
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
              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono text-[12px] cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {/* 3. REDESIGNED COMPACT LEGEND */}
        <div className="absolute right-4 bottom-4 p-3 rounded-xl bg-[var(--surface-2)]/90 border border-slate-700/60 backdrop-blur-md text-[11px] font-mono space-y-1.5 select-none z-10 shadow-2xl">
          <div className="text-[12px] text-[var(--text-secondary)] uppercase tracking-wider mb-1 font-semibold flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Ownership Legend</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1C1230] border border-[#A855F7]" />
              <span className="text-slate-300">Business Unit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#131833] border border-[#818CF8]" />
              <span className="text-slate-300">Sub-BU</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#101B36] border border-[#4F8CFF]" />
              <span className="text-slate-300">Product</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#081F33] border border-[#38BDF8]" />
              <span className="text-cyan-200 font-semibold">Server (VM)</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#241708] border border-[#F59E0B]" />
              <span className="text-slate-300">Operational Manager</span>
            </div>
          </div>
        </div>

        {/* 4. NODE INFORMATION DETAIL PANEL (Slide-out drawer when node is clicked) */}
        {selectedNode && (
          <div className="absolute top-0 right-0 bottom-0 w-80 md:w-84 border-l border-slate-700/60 bg-[var(--surface-2)]/95 backdrop-blur-md p-4 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 z-30 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-2 border-b border-white/10">
                <div className="space-y-0.5">
                  <span className="text-[12px] font-mono uppercase tracking-wider text-cyan-400">
                    Node Details ({selectedNode.type?.replace(/_/g, ' ')})
                  </span>
                  <h3 className="text-sm font-bold text-white font-mono break-words">
                    {selectedNode.label?.replace('\n', ' ')}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Server Specific Info */}
              {selectedNode.type === 'server' && selectedNode.extra?.serverRecord && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">VM:</span>
                      <span className="text-white font-bold">{selectedNode.extra.serverRecord.vm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Host:</span>
                      <span className="text-white">{selectedNode.extra.serverRecord.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">IP:</span>
                      <span className="text-cyan-300">{selectedNode.extra.serverRecord.primary_ip_address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Product:</span>
                      <span className="text-blue-300">{selectedNode.extra.serverRecord.product || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Sub-BU:</span>
                      <span className="text-indigo-300">{selectedNode.extra.serverRecord.sub_business_unit || 'None'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Business Unit:</span>
                      <span className="text-purple-300">{selectedNode.extra.serverRecord.business_unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Manager:</span>
                      <span className="text-amber-300">{selectedNode.extra.serverRecord.manager}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedNode.extra?.serverRecord?.id) {
                        onSelectServer(selectedNode.extra.serverRecord.id);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-blue-500/20 active:scale-[0.99]"
                  >
                    <span>More Details (Server Profile)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Manager Specific Info */}
              {selectedNode.type === 'manager' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <span className="text-[var(--text-secondary)] block text-[11px]">Contact Email:</span>
                    <span className="font-mono text-amber-300 block">{selectedNode.extra?.email || 'None'}</span>
                  </div>
                  <p className="text-[var(--text-secondary)] text-[11px]">
                    Directly overseeing {selectedNode.neighbors?.length || 0} server entities.
                  </p>
                </div>
              )}

              {/* Product Specific Info */}
              {selectedNode.type === 'product' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Business Unit:</span>
                      <span className="font-mono text-purple-300">{selectedNode.extra?.bu || 'N/A'}</span>
                    </div>
                    {selectedNode.extra?.subBu && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">Sub-BU:</span>
                        <span className="font-mono text-indigo-300">{selectedNode.extra?.subBu}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-Business Unit Specific Info */}
              {selectedNode.type === 'sub_business_unit' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Parent BU:</span>
                      <span className="font-mono text-purple-300">{selectedNode.extra?.buName || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Business Unit Specific Info */}
              {selectedNode.type === 'business_unit' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Org Code:</span>
                      <span className="font-mono text-purple-300">{selectedNode.extra?.org || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">Customer:</span>
                      <span className="text-slate-200">{selectedNode.extra?.customer || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Connected Neighbors list */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[12px] font-mono uppercase text-[var(--text-secondary)] tracking-wider font-semibold">
                  Linked Entities ({selectedNode.neighbors?.length || 0}):
                </span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedNode.neighbors?.map((nb: any) => (
                    <div
                      key={nb.id}
                      onClick={() => {
                        if (cyRef.current && handleNodeSelectRef.current) {
                          const targetNode = cyRef.current.getElementById(nb.id);
                          if (targetNode && targetNode.length > 0) {
                            handleNodeSelectRef.current(targetNode[0]);
                          }
                        }
                      }}
                      className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.07] border border-white/5 text-[11px] font-mono flex items-center justify-between cursor-pointer transition-colors"
                      title="Click to view details"
                    >
                      <span className="text-slate-300 truncate max-w-[170px]">{nb.label?.split('\n')[0]}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-secondary)]">
                        {nb.type?.replace(/_/g, ' ')}
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
