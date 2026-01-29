#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFile } from 'fs/promises';
import { parseFlowchart } from './parser/flowchart.js';
import { parseSequenceDiagram } from './parser/sequence.js';
import { parseERDiagram } from './parser/er.js';
import { convertToExcalidraw } from './converter/index.js';
import type { ParsedDiagram } from './types/index.js';

const server = new Server(
  {
    name: 'mermaid-to-excalidraw-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Detect diagram type from Mermaid source
 */
function detectDiagramType(source: string): 'flowchart' | 'sequence' | 'er' | null {
  const trimmed = source.trim();

  if (/^\s*%%\{excali/.test(trimmed)) {
    // Has directive, check after it
    const afterDirective = trimmed.replace(/%%\{excali:[\s\S]*?\}%%\s*/, '');
    return detectDiagramType(afterDirective);
  }

  if (/^(flowchart|graph)\s/im.test(trimmed)) return 'flowchart';
  if (/^sequenceDiagram/im.test(trimmed)) return 'sequence';
  if (/^erDiagram/im.test(trimmed)) return 'er';

  return null;
}

/**
 * Parse diagram based on detected type
 */
function parseDiagram(source: string, type: 'flowchart' | 'sequence' | 'er'): ParsedDiagram {
  switch (type) {
    case 'flowchart':
      return parseFlowchart(source);
    case 'sequence':
      return parseSequenceDiagram(source);
    case 'er':
      return parseERDiagram(source);
  }
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'convert',
        description:
          'Convert a Mermaid diagram to a styled Excalidraw file in Obsidian format. ' +
          'Supports flowcharts, sequence diagrams, and ER diagrams. ' +
          'Use %%{excali: styles: {nodeId: styleType}}%% directive for explicit styling. ' +
          'Style types: ui, api, db, cache, queue, gateway, external, agent, storage, user, orchestrator, problem, solution, highlight.',
        inputSchema: {
          type: 'object',
          properties: {
            mermaid: {
              type: 'string',
              description:
                'Mermaid diagram source. Supports flowchart/graph, sequenceDiagram, and erDiagram. ' +
                'Add %%{excali: styles: {A: db, B: api}}%% for explicit colors.',
            },
            outputPath: {
              type: 'string',
              description:
                'File path to write the .excalidraw.md file. ' +
                'RECOMMENDED: Always provide this to avoid large responses. ' +
                'If not provided, returns the full content (token-heavy).',
            },
          },
          required: ['mermaid'],
        },
      },
      {
        name: 'list_styles',
        description: 'List all available style types and their colors',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'convert') {
    const mermaidSource = args?.mermaid as string;
    const outputPath = args?.outputPath as string | undefined;

    if (!mermaidSource) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: mermaid source is required',
          },
        ],
        isError: true,
      };
    }

    try {
      const diagramType = detectDiagramType(mermaidSource);

      if (!diagramType) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Could not detect diagram type. ' +
                    'Supported types: flowchart/graph, sequenceDiagram, erDiagram',
            },
          ],
          isError: true,
        };
      }

      const parsed = parseDiagram(mermaidSource, diagramType);
      const result = convertToExcalidraw(parsed);

      if (outputPath) {
        await writeFile(outputPath, result.obsidianContent, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote Excalidraw file to: ${outputPath}\n\n` +
                    `Type: ${diagramType}\n` +
                    `Nodes: ${parsed.nodes.length}\n` +
                    `Edges: ${parsed.edges.length}` +
                    (parsed.subgraphs.length > 0 ? `\nSubgraphs: ${parsed.subgraphs.length}` : ''),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: result.obsidianContent,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error converting diagram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'list_styles') {
    const styles = `Available style types:

| Type | Background | Stroke | Use For |
|------|-----------|--------|---------|
| ui | #a5d8ff | #1971c2 | Frontend components |
| api | #d0bfff | #7048e8 | Backend services |
| db | #b2f2bb | #2f9e44 | Databases |
| cache | #ffe8cc | #fd7e14 | Caches, Redis |
| queue | #fff3bf | #fab005 | Message queues |
| gateway | #dee2e6 | #495057 | Gateways, routers |
| external | #ffc9c9 | #e03131 | External APIs |
| agent | #e599f7 | #9c36b5 | AI/ML services |
| storage | #ffec99 | #f08c00 | File storage |
| user | #e7f5ff | #1971c2 | Users, actors |
| orchestrator | #ffa8a8 | #c92a2a | Orchestration hubs |
| problem | #ffc9c9 | #c92a2a | Issues, deprecated |
| solution | #b2f2bb | #087f5b | Recommended paths |
| highlight | #e5dbff | #5f3dc4 | Key entities |

Supported diagram types:
- flowchart/graph TD|LR|RL|BT
- sequenceDiagram
- erDiagram

Usage examples:

Flowchart with styles:
%%{excali: styles: {A: db, B: api, C: ui}}%%
flowchart TD
    A[(Database)] --> B[API Service]
    B --> C[React App]

Sequence diagram:
%%{excali: styles: {Client: user, API: api, DB: db}}%%
sequenceDiagram
    Client->>API: Request
    API->>DB: Query
    DB-->>API: Result
    API-->>Client: Response

ER diagram:
%%{excali: styles: {User: highlight, Order: db}}%%
erDiagram
    User ||--o{ Order : places
    Order ||--|{ LineItem : contains`;

    return {
      content: [
        {
          type: 'text',
          text: styles,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('mermaid-excali MCP server running');
}

main().catch(console.error);
