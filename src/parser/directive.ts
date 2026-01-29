import type { ExcaliDirective, StyleType } from '../types/index.js';

// Valid style types for validation
const VALID_STYLES: Set<string> = new Set([
  'ui', 'api', 'db', 'cache', 'queue', 'gateway', 'external',
  'agent', 'storage', 'user', 'orchestrator', 'problem', 'solution',
  'highlight', 'group'
]);

/**
 * Parse %%{excali: ...}%% directive from Mermaid source
 *
 * Supports formats:
 * - %%{excali: theme: architecture, styles: {A: ui, B: db}}%%
 * - %%{excali: styles: {A: ui}}%%
 * - No directive (returns empty styles)
 */
export function parseExcaliDirective(mermaidSource: string): ExcaliDirective {
  const directive: ExcaliDirective = {
    styles: {}
  };

  // Match %%{excali: ...}%% block
  const directiveMatch = mermaidSource.match(/%%\{excali:\s*([\s\S]*?)\}%%/);
  if (!directiveMatch) {
    return directive;
  }

  const content = directiveMatch[1].trim();

  // Parse theme
  const themeMatch = content.match(/theme:\s*(\w+)/);
  if (themeMatch) {
    directive.theme = themeMatch[1];
  }

  // Parse styles object
  // Match styles: { A: ui, B: db, ... }
  const stylesMatch = content.match(/styles:\s*\{([^}]+)\}/);
  if (stylesMatch) {
    const stylesContent = stylesMatch[1];

    // Parse key: value pairs
    const pairRegex = /(\w+):\s*(\w+)/g;
    let match;
    while ((match = pairRegex.exec(stylesContent)) !== null) {
      const [, nodeId, styleType] = match;
      if (VALID_STYLES.has(styleType)) {
        directive.styles[nodeId] = styleType as StyleType;
      }
    }
  }

  return directive;
}

/**
 * Remove the excali directive from Mermaid source
 * Returns clean Mermaid that can be rendered by standard tools
 */
export function stripExcaliDirective(mermaidSource: string): string {
  return mermaidSource.replace(/%%\{excali:[\s\S]*?\}%%\s*/g, '').trim();
}

/**
 * Check if source contains excali directive
 */
export function hasExcaliDirective(mermaidSource: string): boolean {
  return /%%\{excali:/.test(mermaidSource);
}
