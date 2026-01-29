import type { ParsedDiagram, ParsedNode, ParsedEdge, StyleType } from '../types/index.js';
import { parseExcaliDirective } from './directive.js';

interface EREntity {
  name: string;
  attributes: Array<{
    type: string;
    name: string;
    keys: string[]; // PK, FK, UK
  }>;
}

interface ERRelationship {
  entity1: string;
  entity2: string;
  cardinality1: string; // ||, |o, }|, }o, etc.
  cardinality2: string;
  label?: string;
}

/**
 * Parse an ER diagram definition into structured data
 *
 * Mermaid ER syntax:
 * erDiagram
 *   CUSTOMER ||--o{ ORDER : places
 *   CUSTOMER {
 *     string name
 *     int id PK
 *   }
 */
export function parseERDiagram(mermaidSource: string): ParsedDiagram {
  const directive = parseExcaliDirective(mermaidSource);
  const lines = mermaidSource.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  const entities = new Map<string, EREntity>();
  const relationships: ERRelationship[] = [];

  let currentEntity: EREntity | null = null;
  let inEntityBlock = false;

  for (const line of lines) {
    // Skip header
    if (line.startsWith('erDiagram')) continue;

    // Start of entity attribute block
    const entityStartMatch = line.match(/^(\w+)\s*\{$/);
    if (entityStartMatch) {
      const name = entityStartMatch[1];
      currentEntity = entities.get(name) || { name, attributes: [] };
      entities.set(name, currentEntity);
      inEntityBlock = true;
      continue;
    }

    // End of entity block
    if (line === '}') {
      currentEntity = null;
      inEntityBlock = false;
      continue;
    }

    // Parse attribute inside entity block
    if (inEntityBlock && currentEntity) {
      // Format: type name [PK|FK|UK]
      const attrMatch = line.match(/^(\w+)\s+(\w+)(?:\s+(PK|FK|UK))?$/);
      if (attrMatch) {
        const [, type, name, key] = attrMatch;
        currentEntity.attributes.push({
          type,
          name,
          keys: key ? [key] : [],
        });
      }
      continue;
    }

    // Parse relationship: ENTITY1 cardinality--cardinality ENTITY2 : label
    // Cardinalities: ||, |o, o|, oo, }|, |{, }{, }o, o{
    const relMatch = line.match(/^(\w+)\s*(\|[|o]|o[|o]|\}[|o]|\|[\{]|\}[\{]|o[\{])--(\|[|o]|o[|o]|\}[|o]|[\|][\}]|[\{][\|]|[\{]o)\s*(\w+)(?:\s*:\s*(.+))?$/);
    if (relMatch) {
      const [, entity1, card1, card2, entity2, label] = relMatch;

      // Ensure entities exist
      if (!entities.has(entity1)) {
        entities.set(entity1, { name: entity1, attributes: [] });
      }
      if (!entities.has(entity2)) {
        entities.set(entity2, { name: entity2, attributes: [] });
      }

      relationships.push({
        entity1,
        entity2,
        cardinality1: card1,
        cardinality2: card2,
        label: label?.trim(),
      });
      continue;
    }

    // Simpler relationship format without detailed cardinality parsing
    const simpleRelMatch = line.match(/^(\w+)\s+\S+\s+(\w+)(?:\s*:\s*(.+))?$/);
    if (simpleRelMatch) {
      const [, entity1, entity2, label] = simpleRelMatch;

      if (!entities.has(entity1)) {
        entities.set(entity1, { name: entity1, attributes: [] });
      }
      if (!entities.has(entity2)) {
        entities.set(entity2, { name: entity2, attributes: [] });
      }

      relationships.push({
        entity1,
        entity2,
        cardinality1: '||',
        cardinality2: 'o{',
        label: label?.trim(),
      });
    }
  }

  // Convert to ParsedDiagram format
  const nodes: ParsedNode[] = Array.from(entities.values()).map(e => ({
    id: e.name,
    label: formatEntityLabel(e),
    shape: 'rectangle' as const,
    styleType: directive.styles[e.name] || 'db',
  }));

  const edges: ParsedEdge[] = relationships.map(r => ({
    source: r.entity1,
    target: r.entity2,
    label: r.label || formatCardinality(r.cardinality1, r.cardinality2),
    arrowType: 'arrow' as const,
  }));

  return {
    type: 'er',
    direction: 'LR',
    nodes,
    edges,
    subgraphs: [],
    directive,
    rawMermaid: mermaidSource,
  };
}

function formatEntityLabel(entity: EREntity): string {
  if (entity.attributes.length === 0) {
    return entity.name;
  }

  const attrs = entity.attributes
    .map(a => {
      const keyStr = a.keys.length > 0 ? ` [${a.keys.join(',')}]` : '';
      return `- ${a.name}: ${a.type}${keyStr}`;
    })
    .join('\n');

  return `${entity.name}\n${attrs}`;
}

function formatCardinality(card1: string, card2: string): string {
  // Convert cardinality symbols to readable text
  const cardMap: Record<string, string> = {
    '||': '1',
    '|o': '0..1',
    'o|': '0..1',
    'oo': '0..1',
    '}|': 'n',
    '|{': 'n',
    '}{': 'n',
    '}o': '0..n',
    'o{': '0..n',
  };

  const left = cardMap[card1] || card1;
  const right = cardMap[card2] || card2;

  return `${left}:${right}`;
}
