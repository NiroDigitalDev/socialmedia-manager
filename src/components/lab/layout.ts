import ELK from "elkjs/lib/elk.bundled.js";
import type { Node, Edge } from "@xyflow/react";

const elk = new ELK();

const DEFAULT_LAYOUT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "200",
  "elk.spacing.nodeNode": "40",
};

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;

export interface LayoutOptions {
  /** Vertical distance between layers (default 200) */
  layerSpacing?: number;
  /** Horizontal distance between sibling nodes (default 40) */
  nodeSpacing?: number;
  /** Node IDs whose children should be excluded from layout (collapsed) */
  collapsedIds?: Set<string>;
  /** Node IDs to exclude entirely (e.g. hidden thumbs-downed nodes) */
  hiddenIds?: Set<string>;
}

/**
 * Compute an auto-layout for a tree of React Flow nodes using elkjs.
 *
 * Filters out collapsed-children and hidden nodes before passing to ELK,
 * then maps the computed positions back onto the original node objects.
 */
export async function computeTreeLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  options?: LayoutOptions,
): Promise<T[]> {
  const collapsedIds = options?.collapsedIds ?? new Set<string>();
  const hiddenIds = options?.hiddenIds ?? new Set<string>();

  // Build a set of IDs whose parent is collapsed -- these are excluded
  const excludedIds = new Set<string>();
  if (collapsedIds.size > 0) {
    // Iteratively collect all descendants of collapsed nodes
    const queue = [...collapsedIds];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const edge of edges) {
        if (edge.source === parentId && !excludedIds.has(edge.target)) {
          excludedIds.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
  }

  // Add hidden nodes
  for (const id of hiddenIds) {
    excludedIds.add(id);
  }

  // Filter visible nodes and edges
  const visibleNodes = nodes.filter((n) => !excludedIds.has(n.id));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
  );

  if (visibleNodes.length === 0) {
    return nodes;
  }

  const elkLayoutOptions: Record<string, string> = {
    ...DEFAULT_LAYOUT_OPTIONS,
  };

  if (options?.layerSpacing != null) {
    elkLayoutOptions["elk.layered.spacing.nodeNodeBetweenLayers"] =
      String(options.layerSpacing);
  }
  if (options?.nodeSpacing != null) {
    elkLayoutOptions["elk.spacing.nodeNode"] = String(options.nodeSpacing);
  }

  const graph = {
    id: "root",
    layoutOptions: elkLayoutOptions,
    children: visibleNodes.map((node) => ({
      id: node.id,
      width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
      height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
    })),
    edges: visibleEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  // Map positions back. Hidden/collapsed-children nodes keep position {0,0}.
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layoutedGraph.children ?? []) {
    positionMap.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
  }

  return nodes.map((node): T => {
    const pos = positionMap.get(node.id);
    if (!pos) {
      // Node was excluded -- mark hidden so React Flow can skip rendering
      return { ...node, hidden: true } as T;
    }
    return {
      ...node,
      position: pos,
      hidden: false,
    } as T;
  });
}
