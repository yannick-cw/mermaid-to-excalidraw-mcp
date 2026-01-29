import type { ExcalidrawDocument, ExcalidrawAppState, ExcalidrawElement } from '../types/index.js';
import type { TextElementInfo } from '../converter/elements.js';

const OBSIDIAN_SOURCE = 'https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/2.19.1';

export function createAppState(): ExcalidrawAppState {
  return {
    theme: 'light',
    viewBackgroundColor: '#ffffff',
    currentItemStrokeColor: '#1e1e1e',
    currentItemBackgroundColor: 'transparent',
    currentItemFillStyle: 'solid',
    currentItemStrokeWidth: 2,
    currentItemStrokeStyle: 'solid',
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontFamily: 5,
    currentItemFontSize: 20,
    currentItemTextAlign: 'left',
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: 'arrow',
    currentItemArrowType: 'round',
    currentItemFrameRole: null,
    scrollX: 0,
    scrollY: 0,
    zoom: { value: 1 },
    currentItemRoundness: 'round',
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: false,
    gridColor: {
      Bold: 'rgba(217, 217, 217, 0.5)',
      Regular: 'rgba(230, 230, 230, 0.5)',
    },
    currentStrokeOptions: null,
    frameRendering: {
      enabled: true,
      clip: true,
      name: true,
      outline: true,
      markerName: true,
      markerEnabled: true,
    },
    objectsSnapModeEnabled: false,
    activeTool: {
      type: 'selection',
      customType: null,
      locked: false,
      fromSelection: false,
      lastActiveTool: null,
    },
    disableContextMenu: false,
  };
}

export function createExcalidrawDocument(elements: ExcalidrawElement[]): ExcalidrawDocument {
  return {
    type: 'excalidraw',
    version: 2,
    source: OBSIDIAN_SOURCE,
    elements,
    appState: createAppState(),
    files: {},
  };
}

export function formatTextElementsSection(textInfos: TextElementInfo[]): string {
  return textInfos
    .map(info => `${info.text} ^${info.id}`)
    .join('\n\n');
}

export function formatObsidianFile(
  document: ExcalidrawDocument,
  textInfos: TextElementInfo[],
  mermaidSource: string
): string {
  const frontmatter = `---

excalidraw-plugin: parsed
tags: [excalidraw]

---`;

  const warning = `==%% Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. %%==`;

  // Mermaid source goes BEFORE Excalidraw Data section
  // This keeps it as regular markdown, not parsed by Excalidraw plugin
  const mermaidSection = `## Mermaid Source

\`\`\`mermaid
${mermaidSource.trim()}
\`\`\``;

  const textElementsSection = `## Text Elements
${formatTextElementsSection(textInfos)}`;

  const jsonContent = JSON.stringify(document, null, 2);

  const drawingSection = `%%
## Drawing
\`\`\`json
${jsonContent}
\`\`\`
%%`;

  // Structure: frontmatter -> warning -> mermaid source -> excalidraw data
  // The Excalidraw plugin only parses content under "# Excalidraw Data"
  return `${frontmatter}

${warning}

${mermaidSection}

# Excalidraw Data

${textElementsSection}

${drawingSection}
`;
}
