import type { ParsedDiagram, ParsedNode, ParsedEdge, StyleType } from '../types/index.js';
import { parseExcaliDirective } from './directive.js';

interface SequenceParticipant {
  id: string;
  alias?: string;
  label: string;
  type: 'participant' | 'actor';
}

interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  type: 'solid' | 'dashed' | 'solidOpen' | 'dashedOpen';
}

/**
 * Parse a sequence diagram definition into structured data
 */
export function parseSequenceDiagram(mermaidSource: string): ParsedDiagram {
  const directive = parseExcaliDirective(mermaidSource);
  const lines = mermaidSource.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  const participants: SequenceParticipant[] = [];
  const messages: SequenceMessage[] = [];
  const participantOrder: string[] = [];

  for (const line of lines) {
    // Skip header
    if (line.startsWith('sequenceDiagram')) continue;

    // Parse participant/actor declarations
    const participantMatch = line.match(/^(participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/);
    if (participantMatch) {
      const [, type, id, alias] = participantMatch;
      participants.push({
        id,
        alias: alias?.trim(),
        label: alias?.trim() || id,
        type: type as 'participant' | 'actor',
      });
      if (!participantOrder.includes(id)) {
        participantOrder.push(id);
      }
      continue;
    }

    // Parse messages: A->>B: Message or A-->>B: Message
    const messageMatch = line.match(/^(\w+)\s*(--?>>?[+-]?|--?>[+-]?|--?x[+-]?)\s*(\w+)\s*:\s*(.*)$/);
    if (messageMatch) {
      const [, from, arrow, to, label] = messageMatch;

      // Add implicit participants
      if (!participantOrder.includes(from)) {
        participantOrder.push(from);
        participants.push({ id: from, label: from, type: 'participant' });
      }
      if (!participantOrder.includes(to)) {
        participantOrder.push(to);
        participants.push({ id: to, label: to, type: 'participant' });
      }

      const isDashed = arrow.includes('--');
      const isOpen = !arrow.includes('>>');

      messages.push({
        from,
        to,
        label: label.trim(),
        type: isDashed ? (isOpen ? 'dashedOpen' : 'dashed') : (isOpen ? 'solidOpen' : 'solid'),
      });
      continue;
    }

    // Parse note declarations (skip for now, could add as annotations)
    // Parse loop/alt/opt blocks (skip for now)
  }

  // Convert to ParsedDiagram format
  const nodes: ParsedNode[] = participants.map(p => ({
    id: p.id,
    label: p.label,
    shape: p.type === 'actor' ? 'ellipse' as const : 'rectangle' as const,
    styleType: directive.styles[p.id] || inferParticipantStyle(p.label),
  }));

  const edges: ParsedEdge[] = messages.map(m => ({
    source: m.from,
    target: m.to,
    label: m.label,
    arrowType: 'arrow' as const,
    lineStyle: (m.type === 'dashed' || m.type === 'dashedOpen') ? 'dashed' as const : 'solid' as const,
  }));

  return {
    type: 'sequence',
    direction: 'LR', // Sequence diagrams flow left-to-right with vertical messages
    nodes,
    edges,
    subgraphs: [],
    directive,
    rawMermaid: mermaidSource,
  };
}

function inferParticipantStyle(label: string): StyleType | undefined {
  const lower = label.toLowerCase();
  if (lower.includes('user') || lower.includes('client') || lower.includes('actor')) return 'user';
  if (lower.includes('api') || lower.includes('service') || lower.includes('backend')) return 'api';
  if (lower.includes('db') || lower.includes('database')) return 'db';
  if (lower.includes('cache') || lower.includes('redis')) return 'cache';
  if (lower.includes('queue') || lower.includes('kafka')) return 'queue';
  if (lower.includes('gateway') || lower.includes('proxy')) return 'gateway';
  if (lower.includes('external') || lower.includes('third')) return 'external';
  return undefined;
}
