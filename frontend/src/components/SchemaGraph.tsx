'use client';

import React, { useCallback, useEffect, memo, useState, useMemo } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Handle,
    Position,
    NodeProps,
    MarkerType,
    EdgeProps,
    getSmoothStepPath,
    BaseEdge,
    EdgeLabelRenderer,
    Node,
    Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Table, Key, Database, ChevronRight, Search, Layers, Zap } from 'lucide-react';
import * as d3 from 'd3-force';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Column {
    name: string;
    type: string;
    is_pk: boolean;
    is_fk?: boolean;
}

interface TableNodeData {
    label: string;
    rows: number;
    size_bytes?: number;
    columns: Column[];
    index?: number;
    isExpanded: boolean;
    onToggleExpand: (id: string, expanded: boolean) => void;
    onFocusNode: (id: string) => void;
    isFocused: boolean;
    isDimmed: boolean;
    isSearchHighlighted: boolean;
    overlayMode: boolean;
    connectionDegree: number;
    moduleColor?: string; // For "Islands" visual grouping
}

// ─── Custom TableNode (Progressive Detail & Focus) ─────────────────────────

const TableNode = memo(({ id, data }: NodeProps<TableNodeData>) => {
    const formattedSize = data.size_bytes ? (data.size_bytes / 1024).toFixed(1) + ' KB' : '';
    
    // Bottleneck logic: scale and glow if highly connected
    const isBottleneck = data.connectionDegree > 4;
    const bottleneckStyle = isBottleneck ? {
        boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
        transform: 'scale(1.05)',
        border: '1px solid rgba(139, 92, 246, 0.8)'
    } : {};

    // Heatmap Overlay (Storage size based coloring)
    const heatmapColor = data.overlayMode && data.size_bytes !== undefined
        ? `rgba(239, 68, 68, ${Math.min(data.size_bytes / (1024 * 500) * 0.5, 0.8)})` 
        : 'transparent';

    let containerClasses = `schema-node transition-all duration-300 relative rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm`;
    if (data.isFocused) containerClasses += ` ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-50 z-10`;
    if (data.isDimmed) containerClasses += ` opacity-25 grayscale`;
    if (data.isSearchHighlighted) containerClasses += ` ring-2 ring-amber-400 z-10`;

    // Semantic grouping module border
    const moduleBorderStyle = data.moduleColor && !data.overlayMode && !isBottleneck
        ? { borderTop: `3px solid ${data.moduleColor}` }
        : {};

    return (
        <div 
            className={containerClasses} 
            style={{ 
                animationDelay: `${(data.index || 0) * 50}ms`,
                backgroundColor: heatmapColor !== 'transparent' ? heatmapColor : undefined,
                ...bottleneckStyle,
                ...moduleBorderStyle
            }}
            onClick={(e) => {
                e.stopPropagation();
                data.onFocusNode(id);
            }}
            onMouseEnter={() => data.onToggleExpand(id, true)}
            onMouseLeave={() => data.onToggleExpand(id, false)}
        >
            <Handle type="target" position={Position.Left} className="schema-handle !w-3 !h-3 !border-2 !border-white !bg-violet-500" />

            {/* Header */}
            <div className="schema-node-header flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 cursor-pointer">
                <div className="schema-node-title flex items-center gap-2 font-bold text-sm text-gray-900">
                    <Table size={16} className={isBottleneck ? "text-amber-500" : "text-violet-600"} />
                    <span>{data.label}</span>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4 shadow-sm">
                    <span className="schema-node-badge text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-white font-medium">{data.rows} rows</span>
                    {formattedSize && <span className="text-[9px] text-gray-500 font-bold">{formattedSize}</span>}
                </div>
            </div>

            {/* Progressive Detail: Columns */}
            <div className={`schema-node-body p-2 bg-white rounded-b-lg overflow-hidden transition-all duration-300 ${data.isExpanded || data.isFocused || data.isSearchHighlighted ? 'max-h-96' : 'max-h-0 !p-0'}`}>
                {(data.columns || []).map((col) => {
                    const isColHighlighted = data.isSearchHighlighted && col.name.includes("searchQuery_placeholder"); // We'll highlight via CSS or generic if needed
                    return (
                        <div key={col.name} className={`schema-col-row flex items-center justify-between py-1.5 px-2 text-xs rounded-md ${col.is_pk ? 'bg-amber-50' : 'hover:bg-gray-50'} ${col.is_fk ? 'text-violet-600 font-medium' : 'text-gray-600'}`}>
                            <div className="schema-col-name flex items-center gap-2 font-medium">
                                {col.is_pk ? <Key size={12} className="text-amber-500 shrink-0" /> : <div className="w-3 shrink-0" />}
                                <span className="truncate max-w-[120px]" title={col.name}>{col.name}</span>
                            </div>
                            <span className="schema-col-type text-[10px] text-gray-400 font-bold ml-4 font-mono">{col.type}</span>
                        </div>
                    );
                })}
                {(!data.columns || data.columns.length === 0) && (
                    <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2 italic font-medium">
                        <Database size={12} /> No cols
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="schema-handle !w-3 !h-3 !border-2 !border-white !bg-violet-500" />
        </div>
    );
});
TableNode.displayName = 'TableNode';

// ─── Custom Edge (Smart Manhattan Routing) ───────────────────────────────────

const CustomEdge = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    label,
    data
}: EdgeProps) => {
    const isHovered = data?.isHovered;
    const isDimmed = data?.isDimmed;
    const isFocused = data?.isFocused;

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16,
    });

    const edgeStyle = useMemo(() => ({
        ...style,
        strokeWidth: isHovered || isFocused ? 2.5 : 1.5,
        stroke: isHovered || isFocused ? '#c4b5fd' : '#8b5cf6',
        opacity: isDimmed ? 0.1 : (isHovered || isFocused ? 1 : 0.6),
        transition: 'all 0.3s ease',
        cursor: 'pointer'
    }), [style, isHovered, isFocused, isDimmed]);

    return (
        <g 
            onMouseEnter={() => data?.onHoverToggle?.(id, true)} 
            onMouseLeave={() => data?.onHoverToggle?.(id, false)}
            className="react-flow__edge-custom group"
        >
            {/* Invisible thicker area for easier hovering */}
            <path
                d={edgePath}
                fill="none"
                strokeOpacity={0}
                strokeWidth={20}
                className="react-flow__edge-interaction"
            />
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            {label && !isDimmed && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className={`schema-edge-label nodrag nopan text-[10px] px-2 py-1 bg-white border rounded-full transition-colors font-bold ${
                            isHovered || isFocused 
                            ? 'border-violet-500 text-violet-700 z-20 shadow-md shadow-violet-500/10' 
                            : 'border-gray-200 text-gray-500 z-10 shadow-sm'
                        }`}
                        onMouseEnter={() => data?.onHoverToggle?.(id, true)} 
                        onMouseLeave={() => data?.onHoverToggle?.(id, false)}
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </g>
    );
};

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { custom: CustomEdge };

// ─── Module Colors for "Islands" ──────────────────────────────────────────

const MODULE_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#8b5cf6', // violet
];

const getModuleColor = (tableName: string) => {
    const prefixMatch = tableName.match(/^([a-z]+)_/);
    const prefix = prefixMatch ? prefixMatch[1] : tableName;
    let hash = 0;
    for (let i = 0; i < prefix.length; i++) hash = prefix.charCodeAt(i) + ((hash << 5) - hash);
    return MODULE_COLORS[Math.abs(hash) % MODULE_COLORS.length];
};

// ─── SchemaGraph ─────────────────────────────────────────────────────────────

interface SchemaGraphProps {
    connectionString: string;
}

const SchemaGraph: React.FC<SchemaGraphProps> = ({ connectionString }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    // Feature States
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{id: string, label: string}[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [overlayMode, setOverlayMode] = useState(false);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
    const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

    // Original graph data reference for filtering
    const [graphData, setGraphData] = useState<{nodes: any[], edges: any[]}>({nodes: [], edges: []});

    // Handle expand/collapse toggle
    const handleToggleExpand = useCallback((id: string, expanded: boolean) => {
        setExpandedNodeIds(prev => {
            const next = new Set(prev);
            if (expanded) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    // Handle focus node (Ego-Graph)
    const handleFocusNode = useCallback((id: string) => {
        setFocusedNodeId(prev => {
            if (prev === id) return null; // toggle off
            return id;
        });
        
        // Update breadcrumbs
        const node = graphData.nodes.find(n => n.id === id);
        if (node) {
            setBreadcrumbs(prev => {
                const idx = prev.findIndex(b => b.id === id);
                if (idx >= 0) {
                    return prev.slice(0, idx + 1); // Truncate to this point
                } else {
                    return [...prev, { id, label: node.data.label }];
                }
            });
        }
    }, [graphData]);

    const handleClearFocus = () => {
        setFocusedNodeId(null);
        setBreadcrumbs([]);
    };

    // Edge Hover
    const handleEdgeHoverToggle = useCallback((id: string, isHovered: boolean) => {
        setHoveredEdgeId(isHovered ? id : null);
    }, []);

    // ─── Data Fetching & D3 Force Layout ────────────────────────────────────
    
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString }),
                });
                const data = await response.json();

                if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) return;

                setGraphData(data); // Store original

                // Calculate connection degrees for Bottleneck visualizer
                const degrees: Record<string, number> = {};
                data.nodes.forEach((n: any) => degrees[n.id] = 0);
                data.edges.forEach((e: any) => {
                    if (degrees[e.source] !== undefined) degrees[e.source]++;
                    if (degrees[e.target] !== undefined) degrees[e.target]++;
                });

                // Prepare nodes for D3 Force Simulation
                const layoutNodes = data.nodes.map((node: any, index: number) => {
                    const colCount = node.data?.columns?.length ?? 0;
                    return {
                        id: node.id,
                        x: Math.random() * 800, // Initial random pos
                        y: Math.random() * 600,
                        width: 250,
                        height: 60 + colCount * 28,
                        data: {
                            ...node.data,
                            index,
                            connectionDegree: degrees[node.id] || 0,
                            moduleColor: getModuleColor(node.data.label)
                        }
                    };
                });

                const layoutEdges = data.edges.map((e: any) => ({
                    source: e.source,
                    target: e.target
                }));

                // Run D3 Force-Directed Layout
                const simulation = d3.forceSimulation(layoutNodes)
                    .force('link', d3.forceLink(layoutEdges).id((d: any) => d.id).distance(250).strength(0.5))
                    .force('charge', d3.forceManyBody().strength(-1500))
                    .force('collide', d3.forceCollide().radius((d: any) => d.height / 2 + 50))
                    .force('center', d3.forceCenter(400, 300))
                    .stop();

                // Run simulation synchronously
                for (let i = 0; i < 300; ++i) simulation.tick();

                // Format for ReactFlow
                const flowNodes = layoutNodes.map((node: any) => ({
                    id: node.id,
                    type: 'tableNode',
                    position: { x: node.x, y: node.y },
                    data: node.data
                }));

                const flowEdges = data.edges.map((e: any) => ({
                    ...e,
                    type: 'custom',
                    animated: true,
                    data: {
                        onHoverToggle: handleEdgeHoverToggle
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 15,
                        height: 15,
                        color: '#8b5cf6',
                    },
                }));

                setNodes(flowNodes);
                setEdges(flowEdges);

            } catch (error) {
                console.error('Failed to fetch graph data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (connectionString) {
            setLoading(true);
            fetchData();
        } else {
            setLoading(false);
        }
    }, [connectionString, setNodes, setEdges, handleEdgeHoverToggle]);

    // ─── Update Node & Edge States based on Current Features ───────────────

    useEffect(() => {
        if (!graphData.nodes.length) return;

        // Determine Ego-Graph scope
        let focusedScope = new Set<string>();
        let focusedEdgesScope = new Set<string>();

        if (focusedNodeId) {
            focusedScope.add(focusedNodeId);
            graphData.edges.forEach((e: any) => {
                if (e.source === focusedNodeId) {
                    focusedScope.add(e.target);
                    focusedEdgesScope.add(e.id);
                } else if (e.target === focusedNodeId) {
                    focusedScope.add(e.source);
                    focusedEdgesScope.add(e.id);
                }
            });
        }

        setNodes((nds) => nds.map((node) => {
            const isDimmed = focusedNodeId ? !focusedScope.has(node.id) : false;
            const isFocused = node.id === focusedNodeId;
            const isSearchHighlighted = searchQuery.length > 2 && (
                node.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.data.columns?.some((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            return {
                ...node,
                data: {
                    ...node.data,
                    isExpanded: expandedNodeIds.has(node.id),
                    onToggleExpand: handleToggleExpand,
                    onFocusNode: handleFocusNode,
                    isFocused,
                    isDimmed,
                    isSearchHighlighted,
                    overlayMode,
                }
            };
        }));

        setEdges((eds) => eds.map((edge) => {
            const isDimmed = focusedNodeId ? !focusedEdgesScope.has(edge.id) : false;
            const isHovered = edge.id === hoveredEdgeId;
            const isFocused = focusedNodeId && focusedEdgesScope.has(edge.id);

            return {
                ...edge,
                data: {
                    ...edge.data,
                    isDimmed,
                    isHovered,
                    isFocused
                }
            };
        }));
    }, [focusedNodeId, searchQuery, overlayMode, hoveredEdgeId, expandedNodeIds, graphData, setNodes, setEdges, handleToggleExpand, handleFocusNode]);


    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    if (loading) {
        return (
            <div style={{ width: '100%', height: '700px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-white relative outline-none border border-gray-100 rounded-b-3xl overflow-hidden">
                <div className="text-violet-600 animate-pulse font-bold text-sm flex items-center gap-2">
                    <Database size={16} className="animate-spin" /> Analyzing & Clustering Schema...
                </div>
            </div>
        );
    }

    if (!nodes || nodes.length === 0) {
        return (
            <div style={{ width: '100%', height: '700px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-white relative outline-none border border-gray-100 rounded-b-3xl overflow-hidden">
                <div className="text-gray-400 font-bold text-sm flex flex-col items-center gap-3">
                    <Database size={48} className="opacity-20" /> No schema tables found
                </div>
            </div>
        );
    }

    return (
        <div className="relative bg-gray-50/50 block rounded-b-3xl overflow-hidden border-t border-gray-100">
            
            {/* Top Navigation & Filters Bar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-4 pointer-events-none">
                
                {/* Breadcrumbs for Focus Mode */}
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 shadow-sm pointer-events-auto">
                    <button 
                        onClick={handleClearFocus}
                        className={`text-sm font-bold transition-colors ${!focusedNodeId ? 'text-violet-700' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        All Tables
                    </button>
                    {breadcrumbs.map((crumb, idx) => (
                        <div key={crumb.id} className="flex items-center gap-2">
                            <ChevronRight size={14} className="text-gray-400" />
                            <button
                                onClick={() => handleFocusNode(crumb.id)}
                                className={`text-sm tracking-tight transition-colors ${
                                    idx === breadcrumbs.length - 1 ? 'text-violet-600 font-bold' : 'text-gray-500 font-medium hover:text-gray-900'
                                }`}
                            >
                                {crumb.label}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Right side controls (Search & Overlay) */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    {/* Search Bar */}
                    <div className="relative group shadow-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Find table or column..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/90 backdrop-blur-md border border-gray-200 text-gray-900 font-medium text-sm rounded-xl pl-9 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder:text-gray-400 shadow-sm"
                        />
                    </div>
                    
                    {/* Storage Heatmap Toggle */}
                    <button
                        onClick={() => setOverlayMode(!overlayMode)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-all shadow-sm ${
                            overlayMode 
                            ? 'bg-rose-50 border-rose-200 text-rose-600' 
                            : 'bg-white/90 backdrop-blur-md border-gray-200 text-gray-500 hover:text-gray-900'
                        }`}
                        title="Toggle Storage Heatmap overlay"
                    >
                        <Layers size={14} />
                        <span className="hidden md:inline">Heatmap</span>
                    </button>
                </div>
            </div>

            <div style={{ width: '100%', height: '750px' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
                    minZoom={0.1}
                >
                    <Controls
                        showInteractive={false}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden fill-gray-500 pointer-events-auto"
                    />
                    <MiniMap
                        nodeColor={(n: any) => n.data?.isFocused ? '#8b5cf6' : n.data?.moduleColor || '#94a3b8'}
                        maskColor="rgba(255, 255, 255, 0.6)"
                        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hidden lg:block !w-48 !h-32"
                    />
                    <Background color="#cbd5e1" gap={32} size={1.5} />
                </ReactFlow>
            </div>
            
            {/* Visual Legend */}
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden md:block">
                <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Legend</div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                            <div className="w-3 h-3 rounded-full bg-violet-100 border border-violet-500"></div> Focal Node
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                            <div className="w-3 h-3 rounded bg-amber-100 border border-amber-400"></div> Search Match
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                            <Zap size={12} className="text-amber-500" /> High-Degree Node
                        </div>
                        {overlayMode && (
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-bold mt-1.5 pt-1.5 border-t border-gray-100">
                                <div className="w-full h-1.5 rounded-full bg-gradient-to-r from-gray-100 to-rose-600"></div> Size Heatmap
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchemaGraph;
