import type { ParsedDiagram, ParsedNode, ParsedEdge, ParsedSubgraph } from '../types/index.js';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
  points: Array<{ x: number; y: number }>;
  label?: string;
  lineStyle?: 'solid' | 'dashed';
  strokeColor?: string;
}

export interface LayoutSubgraph {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  subgraphs: LayoutSubgraph[];
  width: number;
  height: number;
}

// Layout configuration
const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 60;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 100;
const SUBGRAPH_PADDING = 40;
const LABEL_HEIGHT = 30;
const SEQUENCE_LIFELINE_HEIGHT = 400;
const SEQUENCE_MESSAGE_GAP = 60;

/**
 * Calculate node dimensions based on label content
 */
function calculateNodeSize(label: string): { width: number; height: number } {
  const lines = label.split('\n');
  const maxLineLength = Math.max(...lines.map(l => l.length));
  const width = Math.max(DEFAULT_NODE_WIDTH, maxLineLength * 9 + 20);
  const height = Math.max(DEFAULT_NODE_HEIGHT, lines.length * 20 + 20);
  return { width, height };
}

/**
 * Layout algorithm dispatcher
 */
export function layoutDiagram(diagram: ParsedDiagram): LayoutResult {
  switch (diagram.type) {
    case 'sequence':
      return layoutSequenceDiagram(diagram);
    case 'er':
      return layoutERDiagram(diagram);
    default:
      return layoutFlowchart(diagram);
  }
}

/**
 * Sequence diagram layout: participants in a row, messages as horizontal arrows
 * Includes lifeline information for rendering
 */
function layoutSequenceDiagram(diagram: ParsedDiagram): LayoutResult {
  const { nodes, edges } = diagram;
  const nodePositions = new Map<string, LayoutNode>();

  // Calculate total height needed for all messages
  const messageCount = edges.length;
  const messagesHeight = messageCount * SEQUENCE_MESSAGE_GAP + 80;

  // Place participants horizontally with more spacing
  let x = 0;
  for (const node of nodes) {
    const size = calculateNodeSize(node.label);
    // Store lifeline info in the node dimensions (height includes lifeline)
    nodePositions.set(node.id, {
      id: node.id,
      x,
      y: 0,
      width: Math.max(size.width, 120), // Minimum width for readability
      height: size.height,
    });
    x += Math.max(size.width, 120) + HORIZONTAL_GAP + 40; // More spacing between participants
  }

  // Layout messages as horizontal arrows between lifelines
  const layoutEdges: LayoutEdge[] = [];
  let messageY = DEFAULT_NODE_HEIGHT + 60; // Start below participant boxes

  for (const edge of edges) {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);

    if (source && target) {
      // Arrows connect at the lifeline centers (middle of participant boxes)
      const startX = source.x + source.width / 2;
      const endX = target.x + target.width / 2;

      layoutEdges.push({
        source: edge.source,
        target: edge.target,
        points: [
          { x: startX, y: messageY },
          { x: endX, y: messageY },
        ],
        label: edge.label,
      });

      messageY += SEQUENCE_MESSAGE_GAP;
    }
  }

  const width = x;
  const height = messageY + 60;

  return { nodes: nodePositions, edges: layoutEdges, subgraphs: [], width, height };
}

/**
 * ER diagram layout: entities in a grid with relationships
 */
function layoutERDiagram(diagram: ParsedDiagram): LayoutResult {
  const { nodes, edges } = diagram;
  const nodePositions = new Map<string, LayoutNode>();

  // Calculate sizes for all nodes (ER entities can be tall with attributes)
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    sizes.set(node.id, calculateNodeSize(node.label));
  }

  // Use more columns for better horizontal spread
  const cols = Math.min(4, Math.ceil(Math.sqrt(nodes.length) * 1.5));
  let maxRowHeight = 0;
  let x = 0;
  let y = 0;
  let col = 0;

  // Increase gaps for ER diagrams
  const erHorizontalGap = HORIZONTAL_GAP + 60;
  const erVerticalGap = VERTICAL_GAP + 40;

  for (const node of nodes) {
    const size = sizes.get(node.id)!;

    nodePositions.set(node.id, {
      id: node.id,
      x,
      y,
      width: size.width,
      height: size.height,
    });

    maxRowHeight = Math.max(maxRowHeight, size.height);
    x += size.width + erHorizontalGap;
    col++;

    if (col >= cols) {
      col = 0;
      x = 0;
      y += maxRowHeight + erVerticalGap;
      maxRowHeight = 0;
    }
  }

  // Layout edges with offset for overlapping labels
  const layoutEdges = edges.map((edge, index) =>
    layoutEdgeGenericWithOffset(edge, nodePositions, index)
  );

  const allX = Array.from(nodePositions.values()).map(n => n.x + n.width);
  const allY = Array.from(nodePositions.values()).map(n => n.y + n.height);
  const width = Math.max(...allX) + HORIZONTAL_GAP;
  const height = Math.max(...allY) + VERTICAL_GAP;

  return { nodes: nodePositions, edges: layoutEdges, subgraphs: [], width, height };
}

/**
 * Generic edge layout - finds best connection points
 */
function layoutEdgeGeneric(edge: ParsedEdge, nodePositions: Map<string, LayoutNode>): LayoutEdge {
  return layoutEdgeGenericWithOffset(edge, nodePositions, 0);
}

/**
 * Generic edge layout with offset to prevent overlapping labels
 */
function layoutEdgeGenericWithOffset(
  edge: ParsedEdge,
  nodePositions: Map<string, LayoutNode>,
  index: number
): LayoutEdge {
  const source = nodePositions.get(edge.source);
  const target = nodePositions.get(edge.target);

  if (!source || !target) {
    return { source: edge.source, target: edge.target, points: [], label: edge.label };
  }

  // Small offset based on edge index to prevent overlapping lines
  const offset = (index % 3 - 1) * 15;

  // Determine best connection points based on relative positions
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  let startX: number, startY: number, endX: number, endY: number;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      startX = source.x + source.width;
      endX = target.x;
    } else {
      startX = source.x;
      endX = target.x + target.width;
    }
    startY = sourceCenterY + offset;
    endY = targetCenterY + offset;
  } else {
    // Vertical connection
    if (dy > 0) {
      startY = source.y + source.height;
      endY = target.y;
    } else {
      startY = source.y;
      endY = target.y + target.height;
    }
    startX = sourceCenterX + offset;
    endX = targetCenterX + offset;
  }

  return {
    source: edge.source,
    target: edge.target,
    points: [{ x: startX, y: startY }, { x: endX, y: endY }],
    label: edge.label,
  };
}

/**
 * Flowchart layout: nodes in rows based on dependency depth
 */
function layoutFlowchart(diagram: ParsedDiagram): LayoutResult {
  const { nodes, edges, subgraphs, direction } = diagram;
  const isHorizontal = direction === 'LR' || direction === 'RL';
  const isReverse = direction === 'RL' || direction === 'BT';

  // Build adjacency for depth calculation
  const adjacency = buildAdjacency(nodes, edges);

  // Calculate depth (rank) for each node
  const depths = calculateDepths(nodes, adjacency);

  // Group nodes by depth
  const nodesByDepth = groupByDepth(nodes, depths);

  // Calculate positions
  const nodePositions = new Map<string, LayoutNode>();
  const maxNodesInRow = Math.max(...nodesByDepth.map(row => row.length));

  nodesByDepth.forEach((rowNodes, depthIndex) => {
    const rowWidth = rowNodes.length * (DEFAULT_NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
    const startOffset = ((maxNodesInRow * (DEFAULT_NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP) - rowWidth) / 2;

    rowNodes.forEach((node, colIndex) => {
      let x: number, y: number;

      if (isHorizontal) {
        x = depthIndex * (DEFAULT_NODE_WIDTH + HORIZONTAL_GAP);
        y = startOffset + colIndex * (DEFAULT_NODE_HEIGHT + VERTICAL_GAP);
      } else {
        x = startOffset + colIndex * (DEFAULT_NODE_WIDTH + HORIZONTAL_GAP);
        y = depthIndex * (DEFAULT_NODE_HEIGHT + VERTICAL_GAP);
      }

      if (isReverse) {
        const maxDepth = nodesByDepth.length - 1;
        if (isHorizontal) {
          x = (maxDepth - depthIndex) * (DEFAULT_NODE_WIDTH + HORIZONTAL_GAP);
        } else {
          y = (maxDepth - depthIndex) * (DEFAULT_NODE_HEIGHT + VERTICAL_GAP);
        }
      }

      nodePositions.set(node.id, {
        id: node.id,
        x,
        y,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
      });
    });
  });

  // Layout subgraphs (bounding boxes around their nodes)
  const layoutSubgraphs = subgraphs.map(sg => layoutSubgraph(sg, nodePositions));

  // Adjust node positions if inside subgraphs
  for (const sg of layoutSubgraphs) {
    const subgraphDef = subgraphs.find(s => s.id === sg.id);
    if (!subgraphDef) continue;

    for (const nodeId of subgraphDef.nodes) {
      const pos = nodePositions.get(nodeId);
      if (pos) {
        // Already inside bounding box, no adjustment needed
        // Subgraph was calculated to wrap nodes
      }
    }
  }

  // Calculate edge paths
  const layoutEdges = edges.map(edge => layoutEdge(edge, nodePositions, isHorizontal));

  // Calculate total dimensions
  const allX = Array.from(nodePositions.values()).map(n => n.x + n.width);
  const allY = Array.from(nodePositions.values()).map(n => n.y + n.height);
  const width = Math.max(...allX, ...layoutSubgraphs.map(s => s.x + s.width)) + HORIZONTAL_GAP;
  const height = Math.max(...allY, ...layoutSubgraphs.map(s => s.y + s.height)) + VERTICAL_GAP;

  return {
    nodes: nodePositions,
    edges: layoutEdges,
    subgraphs: layoutSubgraphs,
    width,
    height,
  };
}

function buildAdjacency(
  nodes: ParsedNode[],
  edges: ParsedEdge[]
): Map<string, { incoming: string[]; outgoing: string[] }> {
  const adjacency = new Map<string, { incoming: string[]; outgoing: string[] }>();

  for (const node of nodes) {
    adjacency.set(node.id, { incoming: [], outgoing: [] });
  }

  for (const edge of edges) {
    const source = adjacency.get(edge.source);
    const target = adjacency.get(edge.target);

    if (source) source.outgoing.push(edge.target);
    if (target) target.incoming.push(edge.source);
  }

  return adjacency;
}

function calculateDepths(
  nodes: ParsedNode[],
  adjacency: Map<string, { incoming: string[]; outgoing: string[] }>
): Map<string, number> {
  const depths = new Map<string, number>();

  // Find root nodes (no incoming edges)
  const roots = nodes.filter(n => {
    const adj = adjacency.get(n.id);
    return !adj || adj.incoming.length === 0;
  });

  // BFS to assign depths
  const queue = roots.map(r => ({ id: r.id, depth: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (visited.has(id)) {
      // Update depth if we found a longer path
      const currentDepth = depths.get(id) ?? 0;
      if (depth > currentDepth) {
        depths.set(id, depth);
      }
      continue;
    }

    visited.add(id);
    depths.set(id, depth);

    const adj = adjacency.get(id);
    if (adj) {
      for (const targetId of adj.outgoing) {
        queue.push({ id: targetId, depth: depth + 1 });
      }
    }
  }

  // Handle disconnected nodes
  for (const node of nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, 0);
    }
  }

  return depths;
}

function groupByDepth(nodes: ParsedNode[], depths: Map<string, number>): ParsedNode[][] {
  const maxDepth = Math.max(...depths.values());
  const groups: ParsedNode[][] = Array.from({ length: maxDepth + 1 }, () => []);

  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0;
    groups[depth].push(node);
  }

  return groups;
}

function layoutSubgraph(
  sg: ParsedSubgraph,
  nodePositions: Map<string, LayoutNode>
): LayoutSubgraph {
  const nodeLayouts = sg.nodes
    .map(id => nodePositions.get(id))
    .filter((n): n is LayoutNode => n !== undefined);

  if (nodeLayouts.length === 0) {
    return {
      id: sg.id,
      x: 0,
      y: 0,
      width: DEFAULT_NODE_WIDTH + SUBGRAPH_PADDING * 2,
      height: DEFAULT_NODE_HEIGHT + SUBGRAPH_PADDING * 2 + LABEL_HEIGHT,
      label: sg.label,
    };
  }

  const minX = Math.min(...nodeLayouts.map(n => n.x));
  const minY = Math.min(...nodeLayouts.map(n => n.y));
  const maxX = Math.max(...nodeLayouts.map(n => n.x + n.width));
  const maxY = Math.max(...nodeLayouts.map(n => n.y + n.height));

  return {
    id: sg.id,
    x: minX - SUBGRAPH_PADDING,
    y: minY - SUBGRAPH_PADDING - LABEL_HEIGHT,
    width: maxX - minX + SUBGRAPH_PADDING * 2,
    height: maxY - minY + SUBGRAPH_PADDING * 2 + LABEL_HEIGHT,
    label: sg.label,
  };
}

function layoutEdge(
  edge: ParsedEdge,
  nodePositions: Map<string, LayoutNode>,
  isHorizontal: boolean
): LayoutEdge {
  const source = nodePositions.get(edge.source);
  const target = nodePositions.get(edge.target);

  if (!source || !target) {
    return {
      source: edge.source,
      target: edge.target,
      points: [],
      label: edge.label,
      lineStyle: edge.lineStyle,
    };
  }

  // Calculate connection points (straight lines)
  let startX: number, startY: number, endX: number, endY: number;

  if (isHorizontal) {
    // Horizontal flow: connect left/right edges
    if (source.x < target.x) {
      startX = source.x + source.width;
      startY = source.y + source.height / 2;
      endX = target.x;
      endY = target.y + target.height / 2;
    } else {
      startX = source.x;
      startY = source.y + source.height / 2;
      endX = target.x + target.width;
      endY = target.y + target.height / 2;
    }
  } else {
    // Vertical flow: connect top/bottom edges
    if (source.y < target.y) {
      startX = source.x + source.width / 2;
      startY = source.y + source.height;
      endX = target.x + target.width / 2;
      endY = target.y;
    } else {
      startX = source.x + source.width / 2;
      startY = source.y;
      endX = target.x + target.width / 2;
      endY = target.y + target.height;
    }
  }

  return {
    source: edge.source,
    target: edge.target,
    points: [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ],
    label: edge.label,
    lineStyle: edge.lineStyle,
  };
}

/**
 * Estimate text width based on character count
 * Rough approximation: average char width at font size 16 is ~9px
 */
export function estimateTextWidth(text: string, fontSize: number = 16): number {
  const avgCharWidth = fontSize * 0.55;
  return text.length * avgCharWidth;
}

/**
 * Estimate text height based on line count
 */
export function estimateTextHeight(text: string, fontSize: number = 16, lineHeight: number = 1.25): number {
  const lines = text.split('\n').length;
  return lines * fontSize * lineHeight;
}
