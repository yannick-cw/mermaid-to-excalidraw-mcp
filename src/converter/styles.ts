import type { StyleType, StyleColors } from '../types/index.js';

// Color palette matching the excalidraw skill
export const COLOR_PALETTE: Record<StyleType, StyleColors> = {
  ui: { backgroundColor: '#a5d8ff', strokeColor: '#1971c2' },
  api: { backgroundColor: '#d0bfff', strokeColor: '#7048e8' },
  db: { backgroundColor: '#b2f2bb', strokeColor: '#2f9e44' },
  cache: { backgroundColor: '#ffe8cc', strokeColor: '#fd7e14' },
  queue: { backgroundColor: '#fff3bf', strokeColor: '#fab005' },
  gateway: { backgroundColor: '#dee2e6', strokeColor: '#495057' },
  external: { backgroundColor: '#ffc9c9', strokeColor: '#e03131' },
  agent: { backgroundColor: '#e599f7', strokeColor: '#9c36b5' },
  storage: { backgroundColor: '#ffec99', strokeColor: '#f08c00' },
  user: { backgroundColor: '#e7f5ff', strokeColor: '#1971c2' },
  orchestrator: { backgroundColor: '#ffa8a8', strokeColor: '#c92a2a' },
  problem: { backgroundColor: '#ffc9c9', strokeColor: '#c92a2a' },
  solution: { backgroundColor: '#b2f2bb', strokeColor: '#087f5b' },
  highlight: { backgroundColor: '#e5dbff', strokeColor: '#5f3dc4' },
  group: { backgroundColor: 'transparent', strokeColor: '#868e96' },
};

// Default style for nodes without explicit mapping
export const DEFAULT_STYLE: StyleColors = {
  backgroundColor: '#e9ecef',
  strokeColor: '#495057',
};

// Semantic inference patterns
const SEMANTIC_PATTERNS: Array<{ pattern: RegExp; style: StyleType }> = [
  { pattern: /\b(database|db|postgres|mysql|mongo|sqlite|dynamo)\b/i, style: 'db' },
  { pattern: /\b(redis|cache|memcache)\b/i, style: 'cache' },
  { pattern: /\b(queue|kafka|rabbit|sqs|pubsub)\b/i, style: 'queue' },
  { pattern: /\b(api|service|backend|server)\b/i, style: 'api' },
  { pattern: /\b(ui|frontend|react|vue|angular|client|app)\b/i, style: 'ui' },
  { pattern: /\b(gateway|router|proxy|nginx|kong)\b/i, style: 'gateway' },
  { pattern: /\b(external|third.?party|vendor)\b/i, style: 'external' },
  { pattern: /\b(ai|ml|agent|llm|gpt|claude)\b/i, style: 'agent' },
  { pattern: /\b(storage|s3|blob|file)\b/i, style: 'storage' },
  { pattern: /\b(user|actor|client|customer)\b/i, style: 'user' },
  { pattern: /\b(orchestrat|workflow|step.?function)\b/i, style: 'orchestrator' },
];

// Shape-based inference
const SHAPE_STYLES: Record<string, StyleType> = {
  cylinder: 'db',
  stadium: 'cache',
  hexagon: 'orchestrator',
};

export function getStyleColors(styleType: StyleType | undefined): StyleColors {
  if (!styleType) return DEFAULT_STYLE;
  return COLOR_PALETTE[styleType] ?? DEFAULT_STYLE;
}

export function inferStyleFromLabel(label: string): StyleType | undefined {
  for (const { pattern, style } of SEMANTIC_PATTERNS) {
    if (pattern.test(label)) {
      return style;
    }
  }
  return undefined;
}

export function inferStyleFromShape(shape: string): StyleType | undefined {
  return SHAPE_STYLES[shape];
}

export function resolveStyle(
  nodeId: string,
  label: string,
  shape: string,
  explicitStyles: Record<string, StyleType>
): StyleType | undefined {
  // 1. Explicit mapping takes precedence
  if (explicitStyles[nodeId]) {
    return explicitStyles[nodeId];
  }

  // 2. Shape-based inference
  const shapeStyle = inferStyleFromShape(shape);
  if (shapeStyle) return shapeStyle;

  // 3. Label-based inference
  return inferStyleFromLabel(label);
}
