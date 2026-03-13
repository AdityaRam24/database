'use client';

import React, { useCallback, useEffect, memo, useState } from 'react';
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
    getBezierPath,
    BaseEdge,
    EdgeLabelRenderer,
    Node,
    Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Table, Key, Database } from 'lucide-react';
import dagre from '@dagrejs/dagre';

// ─── Custom TableNode ────────────────────────────────────────────────────────

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
}

const TableNode = memo(({ data }: NodeProps<TableNodeData>) => {
    const formattedSize = data.size_bytes ? (data.size_bytes / 1024).toFixed(1) + ' KB' : '';

    return (
        <div className="schema-node" style={{ animationDelay: `${(data.index || 0) * 50}ms` }}>
            <Handle type="target" position={Position.Left} className="schema-handle" />

            {/* Header */}
            <div className="schema-node-header">
                <div className="schema-node-title">
                    <Table size={16} className="text-violet-400" />
                    <span>{data.label}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="schema-node-badge">{data.rows} rows</span>
                    {formattedSize && <span className="text-[9px] text-slate-500 font-medium">{formattedSize}</span>}
                </div>
            </div>

            {/* Columns */}
            <div className="schema-node-body">
                {(data.columns || []).map((col) => {
                    return (
                        <div key={col.name} className={`schema-col-row ${col.is_pk ? 'schema-pk-row' : ''}`}>
                            <div className={`schema-col-name ${col.is_pk ? 'schema-pk-name' : ''}`}>
                                {col.is_pk ? <Key size={12} className="text-amber-500" /> : <div className="w-3" />}
                                <span>{col.name}</span>
                            </div>
                            <span className="schema-col-type">{col.type}</span>
                        </div>
                    );
                })}
                {(!data.columns || data.columns.length === 0) && (
                    <div className="px-4 py-3 text-xs text-slate-500 flex items-center gap-2 italic">
                        <Database size={12} /> No columns found
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Right} className="schema-handle" />
        </div>
    );
});
TableNode.displayName = 'TableNode';

// ─── Custom Edge ─────────────────────────────────────────────────────────────

const CustomEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    label,
}: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="schema-edge-label nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { custom: CustomEdge };

// ─── SchemaGraph ─────────────────────────────────────────────────────────────

interface SchemaGraphProps {
    connectionString: string;
}

const SchemaGraph: React.FC<SchemaGraphProps> = ({ connectionString }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);

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

                // Mark columns that are foreign keys so node can render them implicitly if needed
                const fkColumns = new Set(data.edges.map((e: any) => `${e.source}.${e.label.split(' -> ')[0]}`));

                // Smarter Auto-Layout (Directed Acyclic Graph style via simple columns)
                let currentY = [0, 0, 0, 0]; // Y track for 4 columns

                const layoutNodes = data.nodes.map((node: any, index: number) => {
                    // Inject metadata
                    node.data.index = index;
                    if (node.data.columns) {
                        node.data.columns.forEach((col: any) => {
                            if (fkColumns.has(`${node.id}.${col.name}`)) {
                                col.is_fk = true;
                            }
                        });
                    }

                    const colCount = node.data?.columns?.length ?? 0;
                    const nodeHeight = 60 + colCount * 28;

                    // find column with min Y
                    let minCol = 0;
                    for (let c = 1; c < currentY.length; c++) {
                        if (currentY[c] < currentY[minCol]) minCol = c;
                    }

                    const position = {
                        x: minCol * 380, // wider spacing
                        y: currentY[minCol]
                    };

                    currentY[minCol] += nodeHeight + 60; // add gap

                    return {
                        ...node,
                        position,
                    };
                });

                setNodes(layoutNodes);
                setEdges(data.edges.map((e: any) => ({
                    ...e,
                    type: 'custom',
                    animated: true,
                    style: { stroke: '#8b5cf6', strokeWidth: 1.5, opacity: 0.7 },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 15,
                        height: 15,
                        color: '#8b5cf6',
                    },
                })));
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
    }, [connectionString, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    if (loading) {
        return (
            <div style={{ width: '100%', height: '700px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-[#0a0a0f]/50 backdrop-blur-sm relative outline-none border-none rounded-b-xl overflow-hidden">
                <div className="text-violet-500 animate-pulse font-medium text-sm flex items-center gap-2">
                    <Database size={16} className="animate-spin" /> Loading schema...
                </div>
            </div>
        );
    }

    if (!nodes || nodes.length === 0) {
        return (
            <div style={{ width: '100%', height: '700px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-[#0a0a0f]/50 backdrop-blur-sm relative outline-none border-none rounded-b-xl overflow-hidden">
                <div className="text-slate-500 font-medium text-sm flex flex-col items-center gap-3">
                    <Database size={48} className="opacity-20" /> No schema tables found in public schema
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '700px' }} className="bg-[#0a0a0f]/50 backdrop-blur-sm relative outline-none border-none block rounded-b-xl overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
                minZoom={0.1}
            >
                <Controls
                    className="bg-[#0f0f19] border border-white/10 rounded-lg overflow-hidden fill-white"
                />
                <MiniMap
                    nodeColor="#8b5cf6"
                    maskColor="rgba(0, 0, 0, 0.6)"
                    className="bg-[#0f0f19] border border-white/10 rounded-xl overflow-hidden hidden md:block"
                />
                <Background color="rgba(139, 92, 246, 0.15)" gap={24} size={2} />
            </ReactFlow>
        </div>
    );
};

export default SchemaGraph;
