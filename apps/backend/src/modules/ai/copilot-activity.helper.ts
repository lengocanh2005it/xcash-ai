import type { CopilotActivity, CopilotFileExportData } from '@xcash/shared-types';
import { ACTION_CARD_TOOLS, COPILOT_TOOLS, FILE_EXPORT_TOOLS } from './copilot-tool.registry';
import type { CopilotToolEntry } from './copilot-tool.types';
import { KNOWLEDGE_SECTION_IDS_HIDDEN_FROM_SOURCES } from './knowledge';

export type { CopilotActivity };

type ToolActivityMeta = Omit<CopilotActivity, 'urls'>;

const ACTIVITY_MAP: Record<string, ToolActivityMeta> = Object.fromEntries(
  COPILOT_TOOLS.map((t) => [t.name, t.activity.final]),
);

const STREAMING_ACTIVITY_MAP: Record<string, ToolActivityMeta> = Object.fromEntries(
  COPILOT_TOOLS.map((t) => [t.name, t.activity.streaming]),
);

const TOOL_ENTRY_MAP: Map<string, CopilotToolEntry> = new Map(
  COPILOT_TOOLS.map((t) => [t.name, t]),
);

export function getStreamingActivityMeta(toolName: string): ToolActivityMeta | undefined {
  return STREAMING_ACTIVITY_MAP[toolName];
}

/** Emitted immediately after SSE headers — before the first OpenAI round-trip. */
export const COPILOT_INITIAL_STREAM_ACTIVITY: ToolActivityMeta = {
  kind: 'internal_data',
  label: 'Đang phân tích câu hỏi…',
  source: 'AI Copilot',
};

function sectionCategoryLabel(id: string): string {
  if (id.startsWith('casso_')) return 'Casso';
  if (id.startsWith('tt133_')) return 'TT133';
  if (id.startsWith('xcash_')) return 'X-Cash AI';
  return 'Kiến thức';
}

export function buildActivities(
  calledTools: string[],
  resultsCapture?: Map<string, unknown>,
): CopilotActivity[] {
  const seen = new Set<string>();
  const result: CopilotActivity[] = [];

  for (const name of calledTools) {
    if (ACTION_CARD_TOOLS.has(name)) {
      const key = `action_card:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = ACTIVITY_MAP[name];
      const data = resultsCapture?.get(name) as
        | Omit<NonNullable<CopilotActivity['actionCard']>, 'tool'>
        | undefined;
      if (meta && data)
        result.push({
          ...meta,
          actionCard: { ...data, tool: name } as CopilotActivity['actionCard'],
        });
      continue;
    }

    if (FILE_EXPORT_TOOLS.has(name)) {
      const data = resultsCapture?.get(name) as Omit<CopilotFileExportData, 'tool'> | undefined;
      if (!data) continue;
      const key = `file_export:${data.exportId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = ACTIVITY_MAP[name];
      if (meta) {
        result.push({ ...meta, fileExport: { ...data, tool: name } as CopilotFileExportData });
      }
      continue;
    }

    if (name === 'search_knowledge_base') {
      const data = resultsCapture?.get(name) as
        | { sections?: Array<{ id: string; title: string; content: string }> }
        | undefined;
      if (data?.sections?.length) {
        for (const section of data.sections) {
          if (KNOWLEDGE_SECTION_IDS_HIDDEN_FROM_SOURCES.has(section.id)) continue;
          const key = `knowledge:${section.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push({
            kind: 'knowledge',
            label: section.title,
            source: sectionCategoryLabel(section.id),
            snippet: section.content.slice(0, 350),
          });
        }
      }
      continue;
    }

    const meta = ACTIVITY_MAP[name];
    if (!meta) continue;
    const key = `${meta.kind}:${meta.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = TOOL_ENTRY_MAP.get(name);
    const snippet =
      resultsCapture && entry?.formatSnippet
        ? tryFormatSnippet(entry.formatSnippet, resultsCapture.get(name))
        : undefined;
    result.push({ ...meta, snippet });
  }
  return result;
}

function tryFormatSnippet(
  fn: (data: unknown) => string | undefined,
  data: unknown,
): string | undefined {
  try {
    return fn(data);
  } catch {
    return undefined;
  }
}
