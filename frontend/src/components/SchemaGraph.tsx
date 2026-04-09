'use client';

import React, { useCallback, useEffect, memo, useState, useMemo, useRef } from 'react';
import ReactFlow, {
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
    ReactFlowProvider,
    useReactFlow,
    Panel,
    EdgeLabelRenderer
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Database, ChevronRight, Search, Layers, Zap, HelpCircle, RefreshCcw, Activity } from 'lucide-react';
import dagre from 'dagre';

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
    isFocused: boolean;
    isDimmed: boolean;
    isHovered: boolean;
    isSearchHighlighted: boolean;
    overlayMode: boolean;
    heatmapMode: 'size' | 'rows' | 'scans';
    liveTelemetryMode: boolean;
    seq_scan: number;
    idx_scan: number;
    connectionDegree: number;
    category: 'entity' | 'junction' | 'lookup';
    onFocusNode: (id: string, panTo: boolean) => void;
    onHoverNode: (id: string | null) => void;
}

// ─── Node SVGs & Categorization ─────────────────────────────────────────────

const EntityIcon = () => (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="#7F77DD" /></svg>
);
const JunctionIcon = () => (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><rect x="0" y="0" width="3" height="3" rx="1" fill="#1D9E75" /><rect x="5" y="0" width="3" height="3" rx="1" fill="#1D9E75" /><rect x="0" y="5" width="3" height="3" rx="1" fill="#1D9E75" /><rect x="5" y="5" width="3" height="3" rx="1" fill="#1D9E75" /></svg>
);
const LookupIcon = () => (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" fill="#BA7517" /></svg>
);

const CATEGORY_STYLES = {
    entity: { borderLeft: '#7F77DD', iconBg: '#EEEDFE', badgeBg: '#EEEDFE', badgeText: '#3C3489', label: 'Entity', icon: <EntityIcon /> },
    junction: { borderLeft: '#1D9E75', iconBg: '#E1F5EE', badgeBg: '#E1F5EE', badgeText: '#0F6E56', label: 'Junction', icon: <JunctionIcon /> },
    lookup: { borderLeft: '#BA7517', iconBg: '#FAEEDA', badgeBg: '#FAEEDA', badgeText: '#633806', label: 'Lookup', icon: <LookupIcon /> }
};

function getTableCategory(nodeData: any): 'junction' | 'lookup' | 'entity' {
    const fkCount = nodeData.columns?.filter((c: any) => c.is_fk).length || 0;
    if (fkCount >= 2) return 'junction';
    if (nodeData.rows !== undefined && nodeData.rows < 50) return 'lookup';
    return 'entity';
}

// ─── Custom TableNode ───────────────────────────────────────────────────────

const TableNode = memo(({ id, data }: NodeProps<TableNodeData>) => {
    const formattedSize = data.size_bytes ? (data.size_bytes < 1024 * 1024 ? (data.size_bytes / 1024).toFixed(0) + ' KB' : (data.size_bytes / (1024 * 1024)).toFixed(1) + ' MB') : '0 B';
    const cat = CATEGORY_STYLES[data.category];

    const isBottleneck = data.connectionDegree > 4;

    const metricValue = data.heatmapMode === 'size' 
        ? (data.size_bytes || 0) 
        : (data.heatmapMode === 'rows' ? (data.rows || 0) : (data.seq_scan || 0));
    
    // We'll pass max values in data later, for now we use a heuristic or just pass it in node data
    const maxVal = (data as any).maxHeatmapVal || 1;
    const intensity = Math.min(metricValue / maxVal, 1) * 0.8;

    const heatmapColor = data.overlayMode 
        ? `rgba(239, 68, 68, ${intensity})`
        : 'transparent';

    let containerClasses = `relative rounded-[10px] bg-white dark:bg-white/[0.05] border-t border-r border-b border-gray-200 dark:border-white/[0.08] px-3 py-2.5 min-w-[130px] cursor-pointer transition-all duration-150`;

    if (data.isDimmed) containerClasses += ` opacity-20`;
    else containerClasses += ` shadow-sm hover:shadow-md`;

    if (data.isFocused || data.isSearchHighlighted) {
        containerClasses += ` ring-2 ring-violet-500 z-10`;
    }

    return (
        <div
            className={containerClasses}
            style={{
                borderLeft: `3px solid ${cat.borderLeft}`,
                backgroundColor: heatmapColor !== 'transparent' ? heatmapColor : undefined
            }}
            onClick={(e) => {
                e.stopPropagation();
                data.onFocusNode?.(id, false);
            }}
            onMouseEnter={() => data.onHoverNode?.(id)}
            onMouseLeave={() => data.onHoverNode?.(null)}
        >
            <Handle type="target" position={Position.Left} className="opacity-0" />

            <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center shrink-0" style={{ background: cat.iconBg }}>
                    {cat.icon}
                </div>
                <span className="text-[13px] font-medium text-gray-900 dark:text-slate-100 leading-none">{data.label}</span>
            </div>

            <hr className="border-t border-gray-100 dark:border-white/[0.07] my-1.5" />

            <div className="flex justify-between items-end gap-3">
                <div>
                    <div className="text-[11px] text-gray-600 dark:text-slate-300 font-medium leading-none mb-0.5">{(data.rows ?? 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 leading-none">rows</div>
                </div>
                <div className="text-right">
                    <div className="text-[11px] text-gray-600 dark:text-slate-300 font-medium leading-none mb-0.5">{formattedSize}</div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 leading-none">size</div>
                </div>
            </div>

            <span
                className="inline-block px-[7px] py-[2px] rounded-full text-[10px] font-medium mt-1.5"
                style={{ background: cat.badgeBg, color: cat.badgeText }}
            >
                {localStorage.getItem('db_type') === 'mongodb' ? 'Collection' : cat.label}
            </span>

            <Handle type="source" position={Position.Right} className="opacity-0" />

            {isBottleneck && !data.overlayMode && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" title="High Degree Node" />
            )}

            {/* Hover state columns list */}
            {data.isHovered && data.columns?.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-2 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Attributes</div>
                    {data.columns.map((c: any) => (
                        <div key={c.name} className="flex justify-between items-center gap-4 bg-gray-50/80 dark:bg-white/[0.04] px-2 py-1 rounded">
                            <span className="text-[11px] font-medium text-gray-700 dark:text-slate-200">{c.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {c.is_pk && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded-sm uppercase font-bold">PK</span>}
                                {c.is_fk && <span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded-sm uppercase font-bold">FK</span>}
                                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono tracking-tighter">{c.type}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});
TableNode.displayName = 'TableNode';

// ─── Custom Edge ────────────────────────────────────────────────────────────

const CustomEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }: EdgeProps) => {
    const isHovered = data?.isHovered;
    const isDimmed = data?.isDimmed;
    const isFocused = data?.isFocused;
    const sourceCategory = data?.sourceCategory || 'entity';
    const participation = data?.participation || 'partial';
    const cardinality = data?.cardinality || '1:n';
    const sourceCol = data?.source_col || '';
    const targetCol = data?.target_col || '';
    const liveTelemetryMode = data?.liveTelemetryMode || false;
    const seqScan = data?.source_seq_scan || 0;

    const catEdgeColor = CATEGORY_STYLES[sourceCategory as keyof typeof CATEGORY_STYLES].borderLeft;
    const isTotal = participation === 'total';

    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 16,
    });

    const flowSpeed = seqScan > 1000 ? '0.5s' : seqScan > 100 ? '1s' : '2s';

    const edgeStyle = useMemo(() => ({
        ...style,
        strokeWidth: isTotal ? (isHovered || isFocused ? 4 : 2) : (isHovered || isFocused ? 2 : 1),
        strokeDasharray: isTotal ? 'none' : '5,5',
        stroke: isHovered || isFocused ? catEdgeColor : `${catEdgeColor}C0`,
        opacity: isDimmed ? 0.1 : 1,
        transition: 'all 0.2s ease',
    }), [style, isHovered, isFocused, isDimmed, catEdgeColor, isTotal]);

    return (
        <g
            onMouseEnter={() => data?.onHoverToggle?.(id, true, source, target)}
            onMouseLeave={() => data?.onHoverToggle?.(id, false, source, target)}
            className="react-flow__edge-custom"
        >
            <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="react-flow__edge-interaction cursor-pointer z-50" />
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            
            {liveTelemetryMode && !isDimmed && (
                <path
                    d={edgePath}
                    fill="none"
                    stroke={catEdgeColor}
                    strokeWidth={isTotal ? 4 : 2}
                    className="origin-center"
                    strokeDasharray="4 8"
                    style={{
                        animation: `dash ${flowSpeed} linear infinite`,
                        opacity: isTotal ? 1 : 0.6,
                        filter: `drop-shadow(0 0 4px ${catEdgeColor})`
                    }}
                />
            )}
            
            <EdgeLabelRenderer>
                <div
                    className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-40 transition-opacity duration-200"
                    style={{
                        left: labelX,
                        top: labelY,
                        opacity: isDimmed ? 0 : (isHovered || isFocused ? 1 : 0.85),
                    }}
                >
                    <div className="p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border shadow-lg flex flex-col items-center gap-1.5 text-center min-w-[160px]" style={{ borderColor: catEdgeColor }}>
                        <div className="text-[11px] text-slate-700 dark:text-slate-200 leading-tight w-full">
                            <div className="font-bold mb-1 text-[12px] truncate" style={{ color: catEdgeColor }}>{source}</div>
                            <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500 text-[10px]">
                                <span>uses</span>
                                <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200">{sourceCol || target}</code> 
                                <span>to find its</span>
                            </div>
                            <div className="font-bold mt-1 text-[12px] truncate text-slate-800">{target}</div>
                        </div>
                        
                        {(isHovered || isFocused) && (
                            <div className="bg-slate-50 px-2 py-1 rounded-lg text-[9px] flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest text-slate-500 border border-slate-100 mt-0.5 w-full">
                                <span className={`px-1 rounded ${sourceCategory === 'junction' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {sourceCategory === 'junction' ? 'M:M' : (cardinality === '1:n' ? '1:M' : '1:1')}
                                </span>
                                <span>•</span>
                                <span>{isTotal ? 'Required' : 'Optional'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
};

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { custom: CustomEdge };

// ─── Zoom Controls ──────────────────────────────────────────────────────────

const ZoomControls = () => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    return (
        <Panel position="bottom-right" className="m-4 z-20">
            <div className="flex bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-lg overflow-hidden shadow-sm pointer-events-auto">
                <button onClick={() => zoomOut()} className="px-3 py-1.5 text-[14px] text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] border-r border-gray-200 dark:border-white/[0.08] transition-colors">−</button>
                <button onClick={() => fitView({ duration: 800, padding: 0.2 })} className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.06] border-r border-gray-200 dark:border-white/[0.08] transition-colors">Fit</button>
                <button onClick={() => zoomIn()} className="px-3 py-1.5 text-[14px] text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors">+</button>
            </div>
        </Panel>
    );
};

// ─── SchemaGraphContent ─────────────────────────────────────────────────────

const SchemaGraphContent = ({ connectionString }: { connectionString: string }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

    const { setCenter, fitView, getNodes } = useReactFlow();

    // Feature States
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredEdgeScope, setHoveredEdgeScope] = useState<{ source: string, target: string } | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, label: string }[]>([]);
    const [dbType, setDbType] = useState<string>('sql');

    useEffect(() => {
        setDbType(localStorage.getItem('db_type') || 'sql');
    }, []);

    // Top bar interactions
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'All' | 'Entities' | 'Junctions' | 'Lookups'>('All');
    const [overlayMode, setOverlayMode] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState<'size' | 'rows' | 'scans'>('size');
    const [liveTelemetryMode, setLiveTelemetryMode] = useState(false);
    const [legendExpanded, setLegendExpanded] = useState(false);

    const [graphData, setGraphData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });

    // Focus / Pan to Node
    const handleFocusNode = useCallback((id: string, panTo: boolean = true) => {
        setFocusedNodeId(prev => (prev === id ? null : id));

        if (panTo) {
            const nds = getNodes();
            const node = nds.find(n => n.id === id);
            if (node && node.position) {
                setCenter(node.position.x + (node.width || 200) / 2, node.position.y + (node.height || 100) / 2, { duration: 800, zoom: 1.2 });
            }
        }

        const nodeData = graphData.nodes.find(n => n.id === id);
        if (nodeData) {
            setBreadcrumbs(prev => {
                const idx = prev.findIndex(b => b.id === id);
                if (idx >= 0) return prev.slice(0, idx + 1);
                return [...prev, { id, label: nodeData.data.label }];
            });
        }
    }, [graphData, getNodes, setCenter]);

    const handleClearFocus = () => {
        setFocusedNodeId(null);
        setBreadcrumbs([]);
        fitView({ duration: 800 });
    };

    const handleNodeHover = useCallback((id: string | null) => setHoveredNodeId(id), []);
    const handleEdgeHoverToggle = useCallback((id: string, isHovered: boolean, source: string, target: string) => {
        setHoveredEdgeScope(isHovered ? { source, target } : null);
    }, []);

    // Custom event listener from sidebar table list
    useEffect(() => {
        const handleCustomFocus = (e: any) => {
            const tableName = e.detail?.tableName;
            if (tableName) {
                const node = graphData.nodes.find((n: any) => n.data.label === tableName);
                if (node) handleFocusNode(node.id, true);
            }
        };
        window.addEventListener('focus-schema-node', handleCustomFocus);
        return () => window.removeEventListener('focus-schema-node', handleCustomFocus);
    }, [graphData.nodes, handleFocusNode]);

    // Fetch and Layout
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString }),
                });
                const data = await response.json();

                if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) {
                    setLoading(false);
                    return;
                }

                const categorizedNodes = data.nodes.map((n: any) => ({
                    ...n,
                    data: { ...n.data, category: getTableCategory(n.data) }
                }));

                // Filter orphaned edges that crash d3.forceLink
                const nodeIds = new Set(categorizedNodes.map((n: any) => n.id));
                const validEdges = data.edges.filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target));

                const degrees: Record<string, number> = {};
                categorizedNodes.forEach((n: any) => degrees[n.id] = 0);
                validEdges.forEach((e: any) => {
                    if (degrees[e.source] !== undefined) degrees[e.source]++;
                    if (degrees[e.target] !== undefined) degrees[e.target]++;
                });

                setGraphData({ nodes: categorizedNodes, edges: validEdges });

                const dagreGraph = new dagre.graphlib.Graph();
                dagreGraph.setDefaultEdgeLabel(() => ({}));
                dagreGraph.setGraph({ rankdir: 'LR', nodesep: 150, ranksep: 400 });

                categorizedNodes.forEach((node: any) => {
                    const nodeWidth = 240;
                    const nodeHeight = 160; 
                    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
                });

                validEdges.forEach((edge: any) => {
                    dagreGraph.setEdge(edge.source, edge.target);
                });

                dagre.layout(dagreGraph);

                const flowNodes = categorizedNodes.map((node: any, index: number) => {
                    const nodeWithPosition = dagreGraph.node(node.id);
                    return {
                        id: node.id,
                        type: 'tableNode',
                        position: { x: nodeWithPosition.x - 120, y: nodeWithPosition.y - 80 },
                        data: { ...node.data, index, connectionDegree: degrees[node.id] || 0 }
                    };
                });

                const flowEdges = validEdges.map((e: any, idx: number) => ({
                    ...e,
                    id: e.id || `edge-${idx}-${e.source}-${e.target}`,
                    type: 'custom',
                    animated: false,
                    data: {
                        ...e.data,
                        onHoverToggle: handleEdgeHoverToggle,
                        sourceCategory: flowNodes.find((n: any) => n.id === e.source)?.data.category
                    },
                    markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: CATEGORY_STYLES[flowNodes.find((n: any) => n.id === e.source)?.data.category as keyof typeof CATEGORY_STYLES]?.borderLeft || '#8b5cf6' },
                }));

                setNodes(flowNodes);
                setEdges(flowEdges);
                setLoading(false);

                setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);

            } catch (error) {
                console.error('Failed to fetch graph data:', error);
                setLoading(false);
            }
        };

        if (connectionString) {
            setLoading(true);
            fetchData();
        } else setLoading(false);
    }, [connectionString]);

    // Update Nodes State
    useEffect(() => {
        if (!graphData.nodes.length) return;

        let focusedScope = new Set<string>();
        if (focusedNodeId) {
            focusedScope.add(focusedNodeId);
            graphData.edges.forEach((e: any) => {
                if (e.source === focusedNodeId) focusedScope.add(e.target);
                else if (e.target === focusedNodeId) focusedScope.add(e.source);
            });
        }

        let hoveredScope = new Set<string>();
        if (hoveredNodeId) {
            hoveredScope.add(hoveredNodeId);
            graphData.edges.forEach((e: any) => {
                if (e.source === hoveredNodeId) hoveredScope.add(e.target);
                else if (e.target === hoveredNodeId) hoveredScope.add(e.source);
            });
        } else if (hoveredEdgeScope) {
            hoveredScope.add(hoveredEdgeScope.source);
            hoveredScope.add(hoveredEdgeScope.target);
        }

        const maxVal = Math.max(...nodes.map(n => {
            if (heatmapMode === 'size') return n.data.size_bytes || 0;
            if (heatmapMode === 'rows') return n.data.rows || 0;
            return n.data.seq_scan || 0;
        }), 1);

        setNodes((nds) => nds.map((node) => {
            let isDimmed = false;

            // Filtering dimming
            if (activeFilter !== 'All') {
                const map: Record<string, string> = { 'Entities': 'entity', 'Junctions': 'junction', 'Lookups': 'lookup' };
                if (node.data.category !== map[activeFilter]) isDimmed = true;
            }

            // Focus/Hover dimming
            if (focusedNodeId) {
                if (!focusedScope.has(node.id)) isDimmed = true;
            } else if (hoveredNodeId || hoveredEdgeScope) {
                if (!hoveredScope.has(node.id)) isDimmed = true;
            }

            const isFocused = node.id === focusedNodeId;
            const isSearchHighlighted = searchQuery.length > 1 && (
                node.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.data.columns?.some((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
            );

            const isHovered = node.id === hoveredNodeId;

            const newData = {
                ...node.data,
                onFocusNode: handleFocusNode,
                onHoverNode: handleNodeHover,
                isFocused,
                isHovered,
                isDimmed,
                isSearchHighlighted,
                overlayMode,
                heatmapMode,
                maxHeatmapVal: maxVal,
                liveTelemetryMode,
            };

            const isChanged = node.data.isFocused !== newData.isFocused || node.data.isHovered !== newData.isHovered || node.data.isDimmed !== newData.isDimmed ||
                node.data.isSearchHighlighted !== newData.isSearchHighlighted || node.data.overlayMode !== newData.overlayMode || node.data.heatmapMode !== newData.heatmapMode || node.data.liveTelemetryMode !== newData.liveTelemetryMode;

            if (!isChanged) return node;
            return { ...node, data: newData };
        }));
    }, [focusedNodeId, hoveredNodeId, hoveredEdgeScope, searchQuery, overlayMode, heatmapMode, activeFilter, graphData, setNodes, handleFocusNode, handleNodeHover]);

    // Update Edges State
    useEffect(() => {
        if (!graphData.edges.length) return;

        setEdges((eds) => eds.map((edge) => {
            let isDimmed = false;
            let isFocused = false;
            let isHovered = false;

            if (focusedNodeId) {
                if (edge.source !== focusedNodeId && edge.target !== focusedNodeId) isDimmed = true;
                else isFocused = true;
            } else if (hoveredNodeId) {
                if (edge.source !== hoveredNodeId && edge.target !== hoveredNodeId) isDimmed = true;
                else isHovered = true;
            } else if (hoveredEdgeScope) {
                if (edge.source !== hoveredEdgeScope.source || edge.target !== hoveredEdgeScope.target) isDimmed = true;
                else isHovered = true;
            }

            const sourceNode = nodes.find(n => n.id === edge.source);
            const sourceSeqScan = sourceNode?.data.seq_scan || 0;

            const newData = { ...edge.data, isDimmed, isHovered, isFocused, liveTelemetryMode, source_seq_scan: sourceSeqScan };
            const isChanged = edge.data.isDimmed !== newData.isDimmed || edge.data.isHovered !== newData.isHovered || edge.data.isFocused !== newData.isFocused || edge.data.liveTelemetryMode !== newData.liveTelemetryMode || edge.data.source_seq_scan !== newData.source_seq_scan;

            if (!isChanged) return edge;
            return { ...edge, data: newData };
        }));
    }, [focusedNodeId, hoveredNodeId, hoveredEdgeScope, graphData, nodes, liveTelemetryMode, setEdges]);

    // Typeahead search results
    const searchResults = useMemo(() => {
        if (searchQuery.length < 2) return { tables: [], columns: [] };
        const q = searchQuery.toLowerCase();

        const tables = graphData.nodes.filter(n => n.data.label.toLowerCase().includes(q)).slice(0, 5);
        const columns: any[] = [];

        graphData.nodes.forEach(n => {
            n.data.columns?.forEach((c: any) => {
                if (c.name.toLowerCase().includes(q)) {
                    if (columns.length < 5) columns.push({ table: n, col: c });
                }
            });
        });

        return { tables, columns };
    }, [searchQuery, graphData]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] rounded-b-3xl">
                <Database size={16} className="animate-pulse text-violet-500 mb-2" />
                <div className="text-gray-500 dark:text-slate-400 font-medium text-sm">{dbType === 'mongodb' ? 'Analyzing Collections...' : 'Analyzing & Clustering Schema...'}</div>
            </div>
        );
    }

    return (
        <div className="relative block rounded-b-3xl overflow-hidden border-t border-gray-100 w-full flex-1 h-full min-h-[400px]">

            {/* Top Navigation & Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-start justify-between gap-4 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">

                    {/* Breadcrumbs or Filter Chips row */}
                    {!focusedNodeId ? (
                        <div className="flex gap-2 bg-white/90 dark:bg-white/[0.06] backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/[0.08] shadow-sm">
                            {(['All', 'Entities', 'Junctions', 'Lookups'] as const).map(f => (
                                <button key={f} onClick={() => setActiveFilter(f)}
                                    className={`px-3 py-1 text-[12px] font-medium rounded-full transition-colors ${activeFilter === f ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-transparent text-gray-500 hover:bg-gray-100'}`}>
                                    {f === 'All' ? (dbType === 'mongodb' ? 'All collections' : 'All tables') : f}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white/90 dark:bg-white/[0.06] backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] shadow-sm hover:shadow-md transition-shadow">
                            <button onClick={handleClearFocus} className="text-[13px] font-bold text-gray-500 hover:text-gray-900 transition-colors">
                                {dbType === 'mongodb' ? 'All Collections' : 'All Tables'}
                            </button>
                            {breadcrumbs.map((crumb, idx) => (
                                <div key={crumb.id} className="flex items-center gap-2">
                                    <ChevronRight size={14} className="text-gray-400" />
                                    <button onClick={() => handleFocusNode(crumb.id, true)} className={`text-[13px] transition-colors ${idx === breadcrumbs.length - 1 ? 'text-indigo-600 font-bold' : 'text-gray-500 font-medium hover:text-gray-900'}`}>{crumb.label}</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Expandable Legend */}
                    <div className="relative group self-start mt-1">
                        <button
                            onMouseEnter={() => setLegendExpanded(true)}
                            onMouseLeave={() => setLegendExpanded(false)}
                            className="bg-white/90 dark:bg-white/[0.06] backdrop-blur-md border border-gray-200 dark:border-white/[0.08] text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 w-7 h-7 flex items-center justify-center rounded-full shadow-sm"
                        >
                            <HelpCircle size={14} />
                        </button>
                        {legendExpanded && (
                            <div className="absolute top-full left-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-white/[0.08] rounded-lg p-3 shadow-lg min-w-[160px] pointer-events-none text-left">
                                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2.5">Legend</div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium mb-1.5">
                                    <div className="w-2.5 h-2.5 rounded bg-indigo-50 border border-indigo-500"></div> Focal Node
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium mb-1.5">
                                    <div className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-500"></div> Search Match
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
                                    <Zap size={10} className="text-amber-500" /> Highly Connected
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 pointer-events-auto">
                    {/* Search & Heatmap row */}
                    <div className="flex items-center gap-2">
                        {/* Typeahead Search */}
                        <div className="relative" onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}>
                            <div className="relative group shadow-sm flex items-center bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 transition-all">
                                <Search size={14} className="absolute left-3 text-gray-400 z-10" />
                                <input
                                    type="text"
                                    placeholder={dbType === 'mongodb' ? "Find collection or field..." : "Find table or column..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-14 py-2 w-64 text-[13px] text-gray-900 dark:text-slate-100 border-none outline-none placeholder:text-gray-400 bg-transparent"
                                />
                                <span className="absolute right-3 text-[10px] text-gray-400 pointer-events-none">↵</span>
                            </div>

                            {/* Dropdown */}
                            {isSearchFocused && searchQuery.length > 1 && (searchResults.tables.length > 0 || searchResults.columns.length > 0) && (
                                <div className="absolute top-full right-0 mt-1 w-72 bg-white dark:bg-slate-900/95 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-lg overflow-hidden z-30">
                                    {searchResults.tables.length > 0 && (
                                        <div className="p-1">
                                            {searchResults.tables.map(n => (
                                                <button key={n.id} onClick={() => { handleFocusNode(n.id, true); setSearchQuery(''); }} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 rounded-lg group">
                                                    <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0">
                                                        {dbType === 'mongodb' ? 'Collection' : 'Table'}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[13px] text-gray-900 font-medium truncate group-hover:text-indigo-600 transition-colors">{n.data.label}</div>
                                                        <div className="text-[11px] text-gray-400 mt-0.5">{(n.data.rows ?? 0).toLocaleString()} {dbType === 'mongodb' ? 'docs' : 'rows'}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {searchResults.columns.length > 0 && (
                                        <div className="p-1 border-t border-gray-100 bg-gray-50/50">
                                            {searchResults.columns.map((r, i) => (
                                                <button key={i} onClick={() => { handleFocusNode(r.table.id, true); setSearchQuery(''); }} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-lg group">
                                                    <span className="text-[10px] font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full shrink-0">Col</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[13px] text-gray-900 font-medium truncate flex items-baseline gap-1">
                                                            <span>{r.col.name}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">in {r.table.data.label}</span>
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                                                            {r.col.is_pk ? (dbType === 'mongodb' ? 'Object ID' : 'Primary Key') : r.col.is_fk ? 'Ref' : r.col.type}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Heatmap Mode Selector */}
                        {overlayMode && (
                            <div className="flex bg-white dark:bg-slate-900/90 border border-rose-200 dark:border-rose-500/30 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-right-2">
                                {(['size', 'rows', 'scans'] as const).map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setHeatmapMode(m)}
                                        className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${heatmapMode === m ? 'bg-rose-500 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Heatmap Tooltip + Button */}
                        <div className="relative group">
                            <button
                                onClick={() => setOverlayMode(!overlayMode)}
                                className={`flex items-center justify-center p-2.5 rounded-xl border text-[13px] font-medium transition-all shadow-sm ${overlayMode ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600' : 'bg-white dark:bg-white/[0.06] border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-white/[0.10]'}`}
                            >
                                <Layers size={16} />
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-max max-w-[2000px] px-3 py-2 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border border-slate-700 leading-relaxed translate-y-1 group-hover:translate-y-0 duration-200">
                                <span className="text-rose-400 font-bold block mb-1">Heat Detector</span>
                                Colors tables by "Stress". Brighter red = more work or storage pressure on that table.
                            </div>
                        </div>

                        {/* Live Telemetry Mode */}
                        <div className="relative group">
                            <button
                                onClick={() => setLiveTelemetryMode(!liveTelemetryMode)}
                                className={`flex items-center justify-center p-2.5 rounded-xl border text-[13px] font-medium transition-all shadow-sm ${liveTelemetryMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                            >
                                <Activity size={16} className={liveTelemetryMode ? "animate-pulse" : ""} />
                            </button>
                            <div className="absolute top-full right-0 mt-2 w-max max-w-[200px] px-3 py-2 bg-slate-800 text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border border-slate-700 leading-relaxed translate-y-1 group-hover:translate-y-0 duration-200">
                                <span className="text-emerald-400 font-bold block mb-1">Flow Telemetry</span>
                                Shows "Traffic" between tables. Faster moving lines = more people asking for this data right now.
                            </div>
                        </div>
                    </div>

                    {/* Active Heatmap Legend */}
                    {overlayMode && (
                        <div className="bg-white/95 dark:bg-white/[0.06] backdrop-blur-md border border-rose-100 dark:border-rose-500/20 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">{heatmapMode === 'size' ? 'Size' : (heatmapMode === 'rows' ? 'Rows' : 'Scans')}</span>
                            <div className="w-24 h-1.5 rounded-full bg-gradient-to-r from-transparent via-rose-300 to-rose-600 border border-gray-100"></div>
                            <span className="text-[10px] font-bold text-rose-600">Peak</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full h-full absolute inset-0 z-0 bg-gray-50/30 dark:bg-white/[0.01]" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    minZoom={0.1}
                    maxZoom={1.5}
                >
                    <ZoomControls />
                </ReactFlow>
            </div>
        </div>
    );
};

export default function SchemaGraph(props: { connectionString: string }) {
    return (
        <ReactFlowProvider>
            <SchemaGraphContent {...props} />
        </ReactFlowProvider>
    );
}
