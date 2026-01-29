import type { ParsedDiagram, ExcalidrawElement } from '../types/index.js';
import { layoutDiagram } from './layout.js';
import {
  createNodeWithLabel,
  createArrow,
  createSubgraphRect,
  createText,
  createLine,
  type TextElementInfo,
  type ArrowBindings,
  type ArrowOptions,
} from './elements.js';
import { createExcalidrawDocument, formatObsidianFile } from '../formatter/obsidian.js';
import { getStyleColors } from './styles.js';

export interface ConversionResult {
  obsidianContent: string;
  elements: ExcalidrawElement[];
  textInfos: TextElementInfo[];
}

/**
 * Convert a parsed diagram to Excalidraw format
 */
export function convertToExcalidraw(diagram: ParsedDiagram): ConversionResult {
  const layout = layoutDiagram(diagram);
  const elements: ExcalidrawElement[] = [];
  const textInfos: TextElementInfo[] = [];

  let indexCounter = 0;
  const nextIndex = () => `a${indexCounter++}`;

  // Track shape element IDs for binding arrows
  const nodeElementIds = new Map<string, string>();

  // Create subgraph backgrounds first (so they're behind nodes)
  for (const sg of diagram.subgraphs) {
    const layoutSg = layout.subgraphs.find(l => l.id === sg.id);
    if (layoutSg) {
      // Subgraph rectangle
      const sgRect = createSubgraphRect(layoutSg, sg, nextIndex());
      elements.push(sgRect);

      // Subgraph label
      const labelText = createText(
        layoutSg.x + 10,
        layoutSg.y + 5,
        layoutSg.label,
        nextIndex(),
        { fontSize: 14, textAlign: 'left', strokeColor: '#495057' }
      );
      elements.push(labelText);
      textInfos.push({
        element: labelText,
        id: labelText.id,
        text: layoutSg.label,
      });
    }
  }

  // Create nodes with labels
  for (const node of diagram.nodes) {
    const layoutNode = layout.nodes.get(node.id);
    if (!layoutNode) continue;

    const { shape, text } = createNodeWithLabel(
      layoutNode,
      node,
      nextIndex(),
      nextIndex()
    );

    // Track the shape element ID for arrow bindings
    nodeElementIds.set(node.id, shape.id);

    elements.push(shape);
    elements.push(text.element);
    textInfos.push(text);

    // For ER diagrams: add separator line between entity name and attributes
    if (diagram.type === 'er' && node.label.includes('\n')) {
      const lines = node.label.split('\n');
      const fontSize = 16;
      const lineHeight = 1.25;
      const firstLineHeight = fontSize * lineHeight;
      const separatorY = layoutNode.y + (layoutNode.height - lines.length * firstLineHeight) / 2 + firstLineHeight + 2;

      const separatorLine = createLine(
        layoutNode.x + 8,
        separatorY,
        layoutNode.x + layoutNode.width - 8,
        separatorY,
        nextIndex(),
        { strokeColor: '#868e96', strokeWidth: 1 }
      );
      elements.push(separatorLine);
    }
  }

  // For sequence diagrams: add lifelines (vertical dashed lines from participants)
  if (diagram.type === 'sequence') {
    // Find the maximum Y position of all edges to determine lifeline length
    let maxMessageY = 0;
    for (const edge of layout.edges) {
      for (const point of edge.points) {
        maxMessageY = Math.max(maxMessageY, point.y);
      }
    }
    const lifelineEndY = maxMessageY + 80; // Extend a bit past the last message

    for (const node of diagram.nodes) {
      const layoutNode = layout.nodes.get(node.id);
      if (!layoutNode) continue;

      const centerX = layoutNode.x + layoutNode.width / 2;
      const startY = layoutNode.y + layoutNode.height;

      const lifeline = createLine(
        centerX,
        startY,
        centerX,
        lifelineEndY,
        nextIndex(),
        { strokeColor: '#868e96', strokeStyle: 'dashed', strokeWidth: 1 }
      );
      elements.push(lifeline);
    }
  }

  // Create arrows with bindings
  const arrowElements: ExcalidrawElement[] = [];

  // Find the corresponding parsed edge for line style info
  const parsedEdgeMap = new Map<string, typeof diagram.edges[0]>();
  for (const edge of diagram.edges) {
    parsedEdgeMap.set(`${edge.source}->${edge.target}`, edge);
  }

  for (const layoutEdge of layout.edges) {
    // Create bindings to connect arrows to shapes
    const sourceElementId = nodeElementIds.get(layoutEdge.source);
    const targetElementId = nodeElementIds.get(layoutEdge.target);

    const bindings: ArrowBindings = {};

    if (sourceElementId) {
      bindings.startBinding = {
        elementId: sourceElementId,
        focus: 0,
        gap: 1,
        fixedPoint: null,
      };
    }

    if (targetElementId) {
      bindings.endBinding = {
        elementId: targetElementId,
        focus: 0,
        gap: 1,
        fixedPoint: null,
      };
    }

    // Get line style from parsed edge (for dashed sequence diagram returns)
    const parsedEdge = parsedEdgeMap.get(`${layoutEdge.source}->${layoutEdge.target}`);
    const lineStyle = parsedEdge?.lineStyle ?? layoutEdge.lineStyle ?? 'solid';

    const arrowOptions: ArrowOptions = {
      bindings,
      strokeStyle: lineStyle,
    };

    const arrow = createArrow(layoutEdge, nextIndex(), arrowOptions);
    arrowElements.push(arrow);
    elements.push(arrow);

    // Edge label if present
    if (layoutEdge.label && layoutEdge.points.length >= 2) {
      const midX = (layoutEdge.points[0].x + layoutEdge.points[1].x) / 2;
      const midY = (layoutEdge.points[0].y + layoutEdge.points[1].y) / 2;

      const labelText = createText(
        midX - (layoutEdge.label.length * 12 * 0.55) / 2,
        midY - 10,
        layoutEdge.label,
        nextIndex(),
        { fontSize: 12 }
      );
      elements.push(labelText);
      textInfos.push({
        element: labelText,
        id: labelText.id,
        text: layoutEdge.label,
      });
    }
  }

  // Update shape boundElements to reference the arrows
  for (const element of elements) {
    if (element.type === 'rectangle' || element.type === 'ellipse') {
      const boundArrows: Array<{ id: string; type: 'arrow' }> = [];

      for (const arrow of arrowElements) {
        if (arrow.startBinding?.elementId === element.id ||
            arrow.endBinding?.elementId === element.id) {
          boundArrows.push({ id: arrow.id, type: 'arrow' });
        }
      }

      if (boundArrows.length > 0) {
        element.boundElements = boundArrows;
      }
    }
  }

  const document = createExcalidrawDocument(elements);
  const obsidianContent = formatObsidianFile(document, textInfos, diagram.rawMermaid);

  return {
    obsidianContent,
    elements,
    textInfos,
  };
}
