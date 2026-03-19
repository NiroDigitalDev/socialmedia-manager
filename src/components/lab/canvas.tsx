"use client";

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useLabStore } from "@/stores/use-lab-store";
import { computeTreeLayout } from "./layout";
import { SourceNode } from "./nodes/source-node";
import { IdeaNode } from "./nodes/idea-node";
import { OutlineNode } from "./nodes/outline-node";
import { ImageNode } from "./nodes/image-node";
import { CaptionNode } from "./nodes/caption-node";

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

// ── Custom node types ─────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  source: SourceNode,
  idea: IdeaNode,
  outline: OutlineNode,
  image: ImageNode,
  caption: CaptionNode,
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

export interface LabCanvasHandle {
  fitToLayer: (layer: string) => void;
}

interface LabCanvasProps {
  nodes: LabNode[];
  treeId: string;
  handleRef?: MutableRefObject<LabCanvasHandle | null>;
}

/**
 * Outer wrapper that provides ReactFlowProvider context.
 * The actual canvas logic lives in LabCanvasInner which can use useReactFlow.
 */
export function LabCanvas(props: LabCanvasProps) {
  return (
    <ReactFlowProvider>
      <LabCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function LabCanvasInner({ nodes: apiNodes, treeId, handleRef }: LabCanvasProps) {
  const showHidden = useLabStore((s) => s.showHidden);
  const selectNode = useLabStore((s) => s.selectNode);
  const toggleMultiSelect = useLabStore((s) => s.toggleMultiSelect);
  const clearMultiSelect = useLabStore((s) => s.clearMultiSelect);

  const { fitView } = useReactFlow<LabFlowNode>();

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

  // ── Expose fitToLayer via handleRef ─────────────────────────
  // Keep rfNodes in a ref so the handle callback always sees the latest nodes
  const rfNodesRef = useRef(rfNodes);
  rfNodesRef.current = rfNodes;

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      fitToLayer: (layer: string) => {
        const layerNodeIds = rfNodesRef.current
          .filter((n) => n.data.layer === layer)
          .map((n) => ({ id: n.id }));

        if (layerNodeIds.length > 0) {
          fitView({ nodes: layerNodeIds, padding: 0.2, duration: 500 });
        }
      },
    };
    return () => {
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef, fitView]);

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
