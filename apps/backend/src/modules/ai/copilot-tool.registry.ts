import type { CopilotToolEntry } from './copilot-tool.types';
import { ALL_TOOLS } from './tools';

export type { CopilotToolEntry };

export const COPILOT_TOOLS: CopilotToolEntry[] = ALL_TOOLS;

/** Set of tool names that produce action cards in the UI. */
export const ACTION_CARD_TOOLS = new Set(
  COPILOT_TOOLS.filter((t) => t.activity.final.kind === 'action_card').map((t) => t.name),
);

/** Set of tool names that produce file_export activities in the UI. */
export const FILE_EXPORT_TOOLS = new Set(
  COPILOT_TOOLS.filter((t) => t.activity.final.kind === 'file_export').map((t) => t.name),
);
