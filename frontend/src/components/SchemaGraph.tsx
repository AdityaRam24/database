'use client';

import React, { useCallback, useEffect, memo } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Custom TableNode ────────────────────────────────────────────────────────

interface Column {
    name: string;
    type: string;
    is_pk: boolean;
}

interface TableNodeData {
    label: string;
    rows: number;
    columns: Column[];
}

const TableNode = memo(({ data }: NodeProps<TableNodeData>) => {
    return (
        <div style={{
            background: '#1e1e2e',
            border: '1px solid #7c3aed',
            borderRadius: '8px',
            minWidth: 180,
            fontFamily: 'monospace',
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(124,58,237,0.25)',
            overflow: 'hidden',
        }}>
            <Handle type="target" position={Position.Left} style={{ background: '#7c3aed' }} />

            {/* Header */}
            <div style={{
                background: '#7c3aed',
                color: '#fff',
                padding: '6px 10px',
                fontWeight: 700,
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span>📦 {data.label}</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{data.rows} rows</span>
            </div>

            {/* Columns */}
            <div style={{ padding: '4px 0' }}>
                {(data.columns || []).map((col) => (
                    <div key={col.name} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '3px 10px',
                        color: col.is_pk ? '#fbbf24' : '#c4b5fd',
                        borderBottom: '1px solid #2e2e4e',
                    }}>
                        <span>{col.is_pk ? '🔑 ' : '  '}{col.name}</span>
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>{col.type}</span>
                    </div>
                ))}
                {(!data.columns || data.columns.length === 0) && (
                    <div style={{ padding: '4px 10px', color: '#6b7280' }}>No columns</div>
                )}
            </div>

            <Handle type="source" position={Position.Right} style={{ background: '#7c3aed' }} />
        </div>
    );
});
TableNode.displayName = 'TableNode';

const nodeTypes = { tableNode: TableNode };

// ─── SchemaGraph ─────────────────────────────────────────────────────────────

interface SchemaGraphProps {
    connectionString: string;
}

const SchemaGraph: React.FC<SchemaGraphProps> = ({ connectionString }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analysis/graph`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ connection_string: connectionString }),
                });
                const data = await response.json();

                // Guard against malformed / error responses
                if (!Array.isArray(data?.nodes) || !Array.isArray(data?.edges)) return;

                // Grid layout — spacing based on number of columns to avoid overlap
                const layoutNodes = data.nodes.map((node: any, index: number) => {
                    const colCount = node.data?.columns?.length ?? 0;
                    const nodeHeight = 40 + colCount * 24; // approx height
                    const col = index % 3;
                    const row = Math.floor(index / 3);
                    return {
                        ...node,
                        position: {
                            x: col * 320,
                            y: row * (nodeHeight + 40),
                        },
                    };
                });

                setNodes(layoutNodes);
                setEdges(data.edges.map((e: any) => ({
                    ...e,
                    animated: true,
                    style: { stroke: '#7c3aed' },
                    labelStyle: { fill: '#fff', fontSize: 10 },
                    labelBgStyle: { fill: '#3b0764' },
                })));
            } catch (error) {
                console.error('Failed to fetch graph data:', error);
            }
        };

        if (connectionString) fetchData();
    }, [connectionString, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div style={{ height: 600, border: '1px solid #3b0764', borderRadius: '8px', background: '#0f0f1a' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
            >
                <Controls style={{ background: '#1e1e2e', border: '1px solid #3b0764' }} />
                <MiniMap nodeColor="#7c3aed" style={{ background: '#1e1e2e' }} />
                <Background color="#2e2e4e" gap={16} />
            </ReactFlow>
        </div>
    );
};

export default SchemaGraph;
