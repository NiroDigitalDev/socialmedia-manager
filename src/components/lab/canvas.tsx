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
  imageStyleId: string | null;
  captionStyleId: string | null;
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

/**
 * Collect all descendant IDs of collapsed nodes so they can be hidden.
 * Uses BFS to find all nodes whose ancestor chain includes a collapsed node.
 */
function getHiddenByCollapse(apiNodes: LabNode[], collapsedIds: Set<string>): Set<string> {
  if (collapsedIds.size === 0) return new Set();
  const hidden = new Set<string>();
  // Build parent→children map
  const childrenMap = new Map<string, string[]>();
  for (const n of apiNodes) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) ?? [];
      list.push(n.id);
      childrenMap.set(n.parentId, list);
    }
  }
  // BFS from each collapsed node to hide all descendants
  for (const collapsedId of collapsedIds) {
    const queue = childrenMap.get(collapsedId) ?? [];
    for (const id of queue) {
      hidden.add(id);
      const kids = childrenMap.get(id);
      if (kids) queue.push(...kids);
    }
  }
  return hidden;
}

function apiNodesToReactFlow(
  apiNodes: LabNode[],
  showHidden: boolean,
  collapsedIds: Set<string>,
): { rfNodes: LabFlowNode[]; rfEdges: Edge[] } {
  // Filter thumbs-downed
  const ratingFiltered = showHidden
    ? apiNodes
    : apiNodes.filter((n) => n.rating !== "down");

  // Filter collapsed descendants
  const hiddenByCollapse = getHiddenByCollapse(ratingFiltered, collapsedIds);
  const visibleNodes = ratingFiltered.filter((n) => !hiddenByCollapse.has(n.id));

  // Build child count map (direct children in the full list, not just visible)
  const childCountMap = new Map<string, number>();
  for (const n of ratingFiltered) {
    if (n.parentId) {
      childCountMap.set(n.parentId, (childCountMap.get(n.parentId) ?? 0) + 1);
    }
  }

  const rfNodes: LabFlowNode[] = visibleNodes.map((node) => ({
    id: node.id,
    type: node.layer,
    position: { x: 0, y: 0 },
    data: { ...node, _childCount: childCountMap.get(node.id) ?? 0 },
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
  const collapsedIds = useLabStore((s) => s.collapsedIds);
  const selectNode = useLabStore((s) => s.selectNode);
  const toggleMultiSelect = useLabStore((s) => s.toggleMultiSelect);
  const clearMultiSelect = useLabStore((s) => s.clearMultiSelect);

  const { fitView } = useReactFlow<LabFlowNode>();

  const [rfNodes, setNodes, onNodesChange] = useNodesState<LabFlowNode>([]);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Track which node IDs have been laid out so we know when new ones appear
  const laidOutIdsRef = useRef<Set<string>>(new Set());
  const isInitialLayoutRef = useRef(true);

  // Convert API nodes whenever apiNodes, showHidden, or collapsedIds changes
  const { rfNodes: convertedNodes, rfEdges: convertedEdges } = useMemo(
    () => apiNodesToReactFlow(apiNodes, showHidden, collapsedIds),
    [apiNodes, showHidden, collapsedIds],
  );

  useEffect(() => {
    if (convertedNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      laidOutIdsRef.current = new Set();
      isInitialLayoutRef.current = true;
      return;
    }

    const convertedIds = new Set(convertedNodes.map((n) => n.id));
    const newNodeIds = convertedNodes
      .filter((n) => !laidOutIdsRef.current.has(n.id))
      .map((n) => n.id);
    const hasNewNodes = newNodeIds.length > 0;
    const isInitial = isInitialLayoutRef.current;

    if (isInitial || hasNewNodes) {
      // Full relayout needed (initial load or new nodes added)
      const existingMap = new Map(rfNodes.map((n) => [n.id, n]));
      const measuredNodes = convertedNodes.map((node) => {
        const existing = existingMap.get(node.id);
        return existing?.measured ? { ...node, measured: existing.measured } : node;
      });

      let cancelled = false;
      void computeTreeLayout(measuredNodes, convertedEdges).then(
        (layoutedNodes) => {
          if (cancelled) return;
          setNodes(layoutedNodes);
          setEdges(convertedEdges);
          laidOutIdsRef.current = convertedIds;
          isInitialLayoutRef.current = false;
        },
      );
      return () => { cancelled = true; };
    } else {
      // No new nodes — update data in place, keep existing positions
      // Remove nodes that are no longer visible (collapsed/hidden)
      setNodes((prev) => {
        const updated = prev
          .filter((n) => convertedIds.has(n.id))
          .map((n) => {
            const source = convertedNodes.find((c) => c.id === n.id);
            return source ? { ...n, data: source.data } : n;
          });
        return updated;
      });
      setEdges(convertedEdges);
      laidOutIdsRef.current = convertedIds;
    }
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
    <div className="h-full w-full dark">
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
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-neutral-800 !border-neutral-700 !shadow-md [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!fill-neutral-300 [&>button:hover]:!bg-neutral-700" />
        <MiniMap
          zoomable
          pannable
          className="!bg-neutral-900 !border-neutral-700"
          maskColor="rgba(0, 0, 0, 0.6)"
          nodeColor="hsl(var(--muted-foreground))"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} color="hsl(var(--muted-foreground) / 0.15)" />
      </ReactFlow>
    </div>
  );
}
