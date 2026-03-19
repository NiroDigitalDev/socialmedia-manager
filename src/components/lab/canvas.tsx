"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useLabStore } from "@/stores/use-lab-store";
import { computeTreeLayout } from "./layout";

// ── API types (matches getTree tRPC return) ──────────────────────

export interface LabNode {
  id: string;
  parentId: string | null;
  layer: "source" | "idea" | "outline" | "image" | "caption";
  status: "pending" | "generating" | "completed" | "failed";
  output: unknown;
  rating: "up" | "down" | null;
  r2Key: string | null;
  mimeType: string | null;
  fileName: string | null;
  systemPrompt: string | null;
  contentPrompt: string | null;
  [key: string]: unknown; // index signature required by React Flow Node<data>
}

/** React Flow node parameterised with LabNode data */
type LabFlowNode = Node<LabNode>;

// ── Placeholder node (replaced in Task 7) ────────────────────────

function PlaceholderNode({ data }: NodeProps<LabFlowNode>) {
  return (
    <div
      className="rounded-lg border bg-card p-3 text-xs shadow-sm"
      style={{ width: 180 }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary"
      />
      <div className="font-medium capitalize">{data.layer}</div>
      <div className="text-muted-foreground truncate">{data.status}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  source: PlaceholderNode,
  idea: PlaceholderNode,
  outline: PlaceholderNode,
  image: PlaceholderNode,
  caption: PlaceholderNode,
};

// ── Conversion helpers ───────────────────────────────────────────

function apiNodesToReactFlow(
  apiNodes: LabNode[],
  showHidden: boolean,
): { rfNodes: LabFlowNode[]; rfEdges: Edge[] } {
  const visibleNodes = showHidden
    ? apiNodes
    : apiNodes.filter((n) => n.rating !== "down");

  const rfNodes: LabFlowNode[] = visibleNodes.map((node) => ({
    id: node.id,
    type: node.layer,
    position: { x: 0, y: 0 },
    data: node,
  }));

  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  const rfEdges: Edge[] = visibleNodes
    .filter((n) => n.parentId && visibleIds.has(n.parentId))
    .map((node) => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id,
      animated: node.status === "generating",
    }));

  return { rfNodes, rfEdges };
}

// ── Canvas component ─────────────────────────────────────────────

interface LabCanvasProps {
  nodes: LabNode[];
  treeId: string;
}

export function LabCanvas({ nodes: apiNodes, treeId }: LabCanvasProps) {
  const showHidden = useLabStore((s) => s.showHidden);
  const selectNode = useLabStore((s) => s.selectNode);
  const toggleMultiSelect = useLabStore((s) => s.toggleMultiSelect);
  const clearMultiSelect = useLabStore((s) => s.clearMultiSelect);

  const [rfNodes, setNodes, onNodesChange] = useNodesState<LabFlowNode>([]);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Track the previous node count to detect additions/removals
  const prevNodeKeyRef = useRef<string>("");

  // Convert API nodes whenever apiNodes or showHidden changes
  const { rfNodes: convertedNodes, rfEdges: convertedEdges } = useMemo(
    () => apiNodesToReactFlow(apiNodes, showHidden),
    [apiNodes, showHidden],
  );

  // Compute layout whenever converted nodes/edges change
  useEffect(() => {
    // Build a stable key from node IDs to detect structural changes
    const nodeKey = convertedNodes
      .map((n) => n.id)
      .sort()
      .join(",");

    // Always compute layout when node structure changes or on first render
    const structureChanged = nodeKey !== prevNodeKeyRef.current;
    prevNodeKeyRef.current = nodeKey;

    if (convertedNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Use measured dimensions from current rfNodes if available
    const measuredNodes = convertedNodes.map((node) => {
      const existing = rfNodes.find((n) => n.id === node.id);
      if (existing?.measured) {
        return { ...node, measured: existing.measured };
      }
      return node;
    });

    let cancelled = false;

    void computeTreeLayout(measuredNodes, convertedEdges).then(
      (layoutedNodes) => {
        if (cancelled) return;
        setNodes(layoutedNodes);
        setEdges(convertedEdges);
      },
    );

    return () => {
      cancelled = true;
    };
    // We intentionally exclude rfNodes from deps to avoid infinite loops.
    // The layout is recomputed when the converted (API-derived) data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convertedNodes, convertedEdges, setNodes, setEdges]);

  // ── Selection handlers ───────────────────────────────────────

  const handleNodeClick: NodeMouseHandler<LabFlowNode> = useCallback(
    (event, node) => {
      const isMulti = event.metaKey || event.ctrlKey;

      if (isMulti) {
        toggleMultiSelect(node.id);
      } else {
        clearMultiSelect();
        selectNode(node.id);
      }
    },
    [selectNode, toggleMultiSelect, clearMultiSelect],
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
    clearMultiSelect();
  }, [selectNode, clearMultiSelect]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={16} />
      </ReactFlow>
    </div>
  );
}
