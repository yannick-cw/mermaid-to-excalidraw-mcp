// Style types that map to color palettes
export type StyleType =
  | 'ui'
  | 'api'
  | 'db'
  | 'cache'
  | 'queue'
  | 'gateway'
  | 'external'
  | 'agent'
  | 'storage'
  | 'user'
  | 'orchestrator'
  | 'problem'
  | 'solution'
  | 'highlight'
  | 'group';

export interface StyleColors {
  backgroundColor: string;
  strokeColor: string;
}

export interface ExcaliDirective {
  theme?: string;
  styles: Record<string, StyleType>;
}

export interface ParsedNode {
  id: string;
  label: string;
  shape: 'rectangle' | 'cylinder' | 'stadium' | 'hexagon' | 'ellipse' | 'diamond';
  styleType?: StyleType;
}

export interface ParsedEdge {
  source: string;
  target: string;
  label?: string;
  arrowType: 'arrow' | 'none' | 'both';
  lineStyle?: 'solid' | 'dashed';
}

export interface ParsedSubgraph {
  id: string;
  label: string;
  nodes: string[];
  styleType?: StyleType;
}

export interface ParsedDiagram {
  type: 'flowchart' | 'sequence' | 'er' | 'class';
  direction: 'TD' | 'TB' | 'LR' | 'RL' | 'BT';
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  subgraphs: ParsedSubgraph[];
  directive: ExcaliDirective;
  rawMermaid: string;
}

// Excalidraw element types
export interface ExcalidrawElement {
  id: string;
  type: 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  index: string;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ id: string; type: 'arrow' | 'text' }>;
  updated: number;
  link: null;
  locked: boolean;
  // Text-specific
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: null;
  originalText?: string;
  autoResize?: boolean;
  baseline?: number;
  lineHeight?: number;
  rawText?: string;
  hasTextLink?: boolean;
  // Arrow-specific
  points?: [number, number][];
  lastCommittedPoint?: null;
  startBinding?: { elementId: string; focus: number; gap: number; fixedPoint: null } | null;
  endBinding?: { elementId: string; focus: number; gap: number; fixedPoint: null } | null;
  startArrowhead?: null | 'arrow';
  endArrowhead?: null | 'arrow';
}

export interface ExcalidrawBinding {
  elementId: string;
  focus: number;
  gap: number;
  fixedPoint: null;
}

export interface BoundElement {
  id: string;
  type: 'arrow' | 'text';
}

export interface ExcalidrawAppState {
  theme: string;
  viewBackgroundColor: string;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: string;
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: string;
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: number;
  currentItemFontSize: number;
  currentItemTextAlign: string;
  currentItemStartArrowhead: null;
  currentItemEndArrowhead: string;
  currentItemArrowType: string;
  currentItemFrameRole: null;
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  currentItemRoundness: string;
  gridSize: number;
  gridStep: number;
  gridModeEnabled: boolean;
  gridColor: { Bold: string; Regular: string };
  currentStrokeOptions: null;
  frameRendering: {
    enabled: boolean;
    clip: boolean;
    name: boolean;
    outline: boolean;
    markerName: boolean;
    markerEnabled: boolean;
  };
  objectsSnapModeEnabled: boolean;
  activeTool: {
    type: string;
    customType: null;
    locked: boolean;
    fromSelection: boolean;
    lastActiveTool: null;
  };
  disableContextMenu: boolean;
}

export interface ExcalidrawDocument {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState: ExcalidrawAppState;
  files: Record<string, never>;
}
