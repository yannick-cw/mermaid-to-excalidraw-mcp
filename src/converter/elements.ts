import type { ExcalidrawElement, ParsedNode, ParsedSubgraph, ExcalidrawBinding } from '../types/index.js';
import type { LayoutNode, LayoutEdge, LayoutSubgraph } from './layout.js';
import { getStyleColors } from './styles.js';

export interface ArrowBindings {
  startBinding?: ExcalidrawBinding;
  endBinding?: ExcalidrawBinding;
}

let seedCounter = 1000;

function generateSeed(): number {
  return seedCounter++;
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createBaseElement(
  type: ExcalidrawElement['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  index: string
): Partial<ExcalidrawElement> {
  const seed = generateSeed();
  return {
    id: generateId(),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index,
    roundness: type === 'arrow' ? { type: 2 } : null,
    seed,
    version: 1,
    versionNonce: seed,
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

export function createRectangle(
  layout: LayoutNode,
  node: ParsedNode,
  index: string
): ExcalidrawElement {
  const colors = getStyleColors(node.styleType);
  const base = createBaseElement('rectangle', layout.x, layout.y, layout.width, layout.height, index);

  return {
    ...base,
    type: 'rectangle',
    strokeColor: colors.strokeColor,
    backgroundColor: colors.backgroundColor,
    hasTextLink: false,
  } as ExcalidrawElement;
}

export function createEllipse(
  layout: LayoutNode,
  node: ParsedNode,
  index: string
): ExcalidrawElement {
  const colors = getStyleColors(node.styleType);
  const base = createBaseElement('ellipse', layout.x, layout.y, layout.width, layout.height, index);

  return {
    ...base,
    type: 'ellipse',
    strokeColor: colors.strokeColor,
    backgroundColor: colors.backgroundColor,
    hasTextLink: false,
  } as ExcalidrawElement;
}

export function createText(
  x: number,
  y: number,
  text: string,
  index: string,
  options: {
    fontSize?: number;
    textAlign?: string;
    verticalAlign?: string;
    strokeColor?: string;
  } = {}
): ExcalidrawElement {
  const fontSize = options.fontSize ?? 16;
  const lineHeight = 1.25;
  const lines = text.split('\n');
  const width = Math.max(...lines.map(l => l.length)) * fontSize * 0.55;
  const height = lines.length * fontSize * lineHeight;

  const base = createBaseElement('text', x, y, width, height, index);
  const id = generateId();

  return {
    ...base,
    id,
    type: 'text',
    strokeColor: options.strokeColor ?? '#1e1e1e',
    text,
    fontSize,
    fontFamily: 1,
    textAlign: options.textAlign ?? 'center',
    verticalAlign: options.verticalAlign ?? 'middle',
    containerId: null,
    originalText: text,
    autoResize: true,
    baseline: Math.round(fontSize * 0.8),
    lineHeight,
    rawText: text,
    hasTextLink: false,
  } as ExcalidrawElement;
}

export interface ArrowOptions {
  bindings?: ArrowBindings;
  strokeColor?: string;
  strokeStyle?: 'solid' | 'dashed';
}

export function createArrow(
  edge: LayoutEdge,
  index: string,
  options?: ArrowOptions
): ExcalidrawElement {
  const points = edge.points;
  if (points.length < 2) {
    // Fallback for empty edges
    return createBaseElement('arrow', 0, 0, 0, 0, index) as ExcalidrawElement;
  }

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  // Arrow position is at the start point
  // Points array contains relative offsets from the arrow's x,y
  const relativePoints: [number, number][] = points.map(p => [
    p.x - startPoint.x,
    p.y - startPoint.y,
  ]);

  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);

  const base = createBaseElement('arrow', startPoint.x, startPoint.y, width, height, index);

  return {
    ...base,
    type: 'arrow',
    strokeColor: '#1e1e1e',
    strokeStyle: options?.strokeStyle ?? 'solid',
    points: relativePoints,
    lastCommittedPoint: null,
    startBinding: options?.bindings?.startBinding ?? null,
    endBinding: options?.bindings?.endBinding ?? null,
    startArrowhead: null,
    endArrowhead: 'arrow',
  } as ExcalidrawElement;
}

export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  index: string,
  options: {
    strokeColor?: string;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
    strokeWidth?: number;
  } = {}
): ExcalidrawElement {
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  const base = createBaseElement('line', x1, y1, width, height, index);

  return {
    ...base,
    type: 'line',
    strokeColor: options.strokeColor ?? '#1e1e1e',
    strokeStyle: options.strokeStyle ?? 'solid',
    strokeWidth: options.strokeWidth ?? 1,
    points: [[0, 0], [x2 - x1, y2 - y1]],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  } as ExcalidrawElement;
}

export function createSubgraphRect(
  layout: LayoutSubgraph,
  subgraph: ParsedSubgraph,
  index: string
): ExcalidrawElement {
  const colors = getStyleColors(subgraph.styleType);
  const base = createBaseElement('rectangle', layout.x, layout.y, layout.width, layout.height, index);

  return {
    ...base,
    type: 'rectangle',
    strokeColor: colors.strokeColor,
    backgroundColor: 'transparent',
    strokeStyle: 'dashed',
    strokeWidth: 2,
    hasTextLink: false,
  } as ExcalidrawElement;
}

export function nodeShapeToElement(
  layout: LayoutNode,
  node: ParsedNode,
  index: string
): ExcalidrawElement {
  switch (node.shape) {
    case 'ellipse':
    case 'cylinder': // Use ellipse as approximation for cylinder
      return createEllipse(layout, node, index);
    case 'diamond':
    case 'hexagon':
    case 'stadium':
    case 'rectangle':
    default:
      return createRectangle(layout, node, index);
  }
}

export interface TextElementInfo {
  element: ExcalidrawElement;
  id: string;
  text: string;
}

export function createNodeWithLabel(
  layout: LayoutNode,
  node: ParsedNode,
  shapeIndex: string,
  textIndex: string
): { shape: ExcalidrawElement; text: TextElementInfo } {
  const shape = nodeShapeToElement(layout, node, shapeIndex);

  // Calculate text dimensions for proper centering (handles multi-line)
  const fontSize = 16;
  const lineHeight = 1.25;
  const lines = node.label.split('\n');
  const maxLineLength = Math.max(...lines.map(l => l.length));
  const textWidth = maxLineLength * fontSize * 0.55;
  const textHeight = lines.length * fontSize * lineHeight;

  // Center text inside shape
  const textX = layout.x + (layout.width - textWidth) / 2;
  const textY = layout.y + (layout.height - textHeight) / 2;

  // Use left alignment for multi-line text (like ER entities with attributes)
  const textAlign = lines.length > 1 ? 'left' : 'center';

  const textElement = createText(textX, textY, node.label, textIndex, {
    textAlign,
    verticalAlign: 'top',
  });

  return {
    shape,
    text: {
      element: textElement,
      id: textElement.id,
      text: node.label,
    },
  };
}
