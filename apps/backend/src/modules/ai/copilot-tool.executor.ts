import { BadRequestException } from '@nestjs/common';
import type { Role } from '@xcash/shared-types';
import { COPILOT_TOOLS } from './copilot-tool.registry';
import type { CopilotToolEntry, ToolDeps } from './copilot-tool.types';

export type { ToolDeps };

const registry = new Map(COPILOT_TOOLS.map((t) => [t.name, t]));

export async function executeTool(
  deps: ToolDeps,
  name: string,
  tenantId: string,
  args: Record<string, unknown>,
  role?: Role,
): Promise<unknown> {
  const entry = registry.get(name);
  if (!entry) throw new BadRequestException(`Unknown copilot tool: ${name}`);
  return entry.execute(deps, tenantId, args, role);
}

export function getToolRegistry(): Map<string, CopilotToolEntry> {
  return registry;
}
