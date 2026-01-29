import type { ParsedDiagram, ParsedNode, ParsedEdge, ParsedSubgraph } from '../types/index.js';
import { parseExcaliDirective, stripExcaliDirective } from './directive.js';
import { resolveStyle } from '../converter/styles.js';

type Direction = 'TD' | 'TB' | 'LR' | 'RL' | 'BT';
type NodeShape = 'rectangle' | 'cylinder' | 'stadium' | 'hexagon' | 'ellipse' | 'diamond';

// Shape detection patterns from Mermaid syntax
const SHAPE_PATTERNS: Array<{ pattern: RegExp; shape: NodeShape }> = [
  { pattern: /\[\((.+?)\)\]/, shape: 'cylinder' },      // [(label)]
  { pattern: /\(\[(.+?)\]\)/, shape: 'stadium' },       // ([label])
  { pattern: /\{\{(.+?)\}\}/, shape: 'hexagon' },       // {{label}}
  { pattern: /\(\((.+?)\)\)/, shape: 'ellipse' },       // ((label))
  { pattern: /\{(.+?)\}/, shape: 'diamond' },           // {label}
  { pattern: /\[(.+?)\]/, shape: 'rectangle' },         // [label]
  { pattern: /\((.+?)\)/, shape: 'ellipse' },           // (label)
];

// Arrow patterns
const ARROW_PATTERNS = [
  { pattern: /--?>/, hasArrow: true, text: false },
  { pattern: /===>/, hasArrow: true, text: false },
  { pattern: /-.->/, hasArrow: true, text: false },
  { pattern: /<--/, hasArrow: true, text: false },
  { pattern: /---/, hasArrow: false, text: false },
  { pattern: /--\|(.+?)\|/, hasArrow: true, text: true },
  { pattern: /--"(.+?)"/, hasArrow: true, text: true },
];

interface RawNode {
  id: string;
  label: string;
  shape: NodeShape;
}

interface RawEdge {
  source: string;
  target: string;
  label?: string;
}

interface RawSubgraph {
  id: string;
  label: string;
  content: string;
}

/**
 * Parse a flowchart definition into structured data
 */
export function parseFlowchart(mermaidSource: string): ParsedDiagram {
  const directive = parseExcaliDirective(mermaidSource);
  const cleanSource = stripExcaliDirective(mermaidSource);
  const lines = cleanSource.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  // Detect diagram type and direction
  const headerLine = lines[0] || '';
  const direction = parseDirection(headerLine);

  // Parse subgraphs first
  const subgraphs = parseSubgraphs(cleanSource);
  const subgraphNodeIds = new Set(subgraphs.flatMap(sg => sg.nodes));

  // Parse nodes and edges
  const nodesMap = new Map<string, RawNode>();
  const edges: RawEdge[] = [];

  // Process each line (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Skip subgraph declarations
    if (line.startsWith('subgraph') || line === 'end') continue;

    // Try to parse as edge definition
    const edgeResult = parseEdgeLine(line);
    if (edgeResult) {
      // Add source node if not exists
      if (edgeResult.sourceNode && !nodesMap.has(edgeResult.sourceNode.id)) {
        nodesMap.set(edgeResult.sourceNode.id, edgeResult.sourceNode);
      }
      // Add target node if not exists
      if (edgeResult.targetNode && !nodesMap.has(edgeResult.targetNode.id)) {
        nodesMap.set(edgeResult.targetNode.id, edgeResult.targetNode);
      }
      edges.push(edgeResult.edge);
      continue;
    }

    // Try to parse as standalone node definition
    const nodeResult = parseNodeDefinition(line);
    if (nodeResult && !nodesMap.has(nodeResult.id)) {
      nodesMap.set(nodeResult.id, nodeResult);
    }
  }

  // Convert to final format with styles resolved
  const nodes: ParsedNode[] = Array.from(nodesMap.values()).map(node => ({
    id: node.id,
    label: node.label,
    shape: node.shape,
    styleType: resolveStyle(node.id, node.label, node.shape, directive.styles),
  }));

  const parsedEdges: ParsedEdge[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    label: edge.label,
    arrowType: 'arrow' as const,
  }));

  const parsedSubgraphs: ParsedSubgraph[] = subgraphs.map(sg => ({
    id: sg.id,
    label: sg.label,
    nodes: sg.nodes,
    styleType: directive.styles[sg.id] || 'group',
  }));

  return {
    type: 'flowchart',
    direction,
    nodes,
    edges: parsedEdges,
    subgraphs: parsedSubgraphs,
    directive,
    rawMermaid: mermaidSource,
  };
}

function parseDirection(headerLine: string): Direction {
  const match = headerLine.match(/(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
  return (match?.[1]?.toUpperCase() as Direction) || 'TD';
}

function parseSubgraphs(source: string): Array<{ id: string; label: string; nodes: string[] }> {
  const subgraphs: Array<{ id: string; label: string; nodes: string[] }> = [];
  const lines = source.split('\n');

  let currentSubgraph: { id: string; label: string; nodes: string[] } | null = null;
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Start of subgraph
    const subgraphMatch = trimmed.match(/^subgraph\s+(\w+)(?:\s*\[(.+?)\])?/);
    if (subgraphMatch) {
      if (depth === 0) {
        currentSubgraph = {
          id: subgraphMatch[1],
          label: subgraphMatch[2] || subgraphMatch[1],
          nodes: [],
        };
      }
      depth++;
      continue;
    }

    // End of subgraph
    if (trimmed === 'end') {
      depth--;
      if (depth === 0 && currentSubgraph) {
        subgraphs.push(currentSubgraph);
        currentSubgraph = null;
      }
      continue;
    }

    // Collect node IDs within subgraph
    if (currentSubgraph && depth === 1) {
      // Extract node IDs from edge definitions or standalone nodes
      const nodeIds = extractNodeIds(trimmed);
      for (const id of nodeIds) {
        if (!currentSubgraph.nodes.includes(id)) {
          currentSubgraph.nodes.push(id);
        }
      }
    }
  }

  return subgraphs;
}

function extractNodeIds(line: string): string[] {
  const ids: string[] = [];

  // Match node definitions like A[Label] or A
  const nodePattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[|\(|\{|$|-->|---)/g;
  let match;
  while ((match = nodePattern.exec(line)) !== null) {
    const id = match[1];
    // Skip keywords
    if (!['subgraph', 'end', 'flowchart', 'graph', 'direction'].includes(id.toLowerCase())) {
      ids.push(id);
    }
  }

  return ids;
}

function parseNodeDefinition(text: string): RawNode | null {
  // Try each shape pattern
  for (const { pattern, shape } of SHAPE_PATTERNS) {
    const match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*/);
    if (!match) continue;

    const id = match[1];
    const rest = text.slice(match[0].length);

    const shapeMatch = rest.match(pattern);
    if (shapeMatch) {
      return {
        id,
        label: shapeMatch[1].trim(),
        shape,
      };
    }
  }

  // Check for plain node ID without shape
  const plainMatch = text.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  if (plainMatch) {
    return {
      id: plainMatch[1],
      label: plainMatch[1],
      shape: 'rectangle',
    };
  }

  return null;
}

function parseEdgeLine(line: string): { sourceNode: RawNode | null; targetNode: RawNode | null; edge: RawEdge } | null {
  // Match patterns like: A[Label] --> B[Label] or A --> B
  const edgeMatch = line.match(
    /^([A-Za-z_][A-Za-z0-9_]*)(\s*(?:\[.*?\]|\(.*?\)|\{.*?\})?)?\s*(-->|---)(?:\|(.+?)\|)?\s*([A-Za-z_][A-Za-z0-9_]*)(\s*(?:\[.*?\]|\(.*?\)|\{.*?\})?)?$/
  );

  if (!edgeMatch) return null;

  const [, sourceId, sourceShape, , edgeLabel, targetId, targetShape] = edgeMatch;

  const sourceNode = sourceShape
    ? parseNodeDefinition(sourceId + sourceShape)
    : { id: sourceId, label: sourceId, shape: 'rectangle' as const };

  const targetNode = targetShape
    ? parseNodeDefinition(targetId + targetShape)
    : { id: targetId, label: targetId, shape: 'rectangle' as const };

  return {
    sourceNode,
    targetNode,
    edge: {
      source: sourceId,
      target: targetId,
      label: edgeLabel?.trim(),
    },
  };
}
