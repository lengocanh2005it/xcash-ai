import type { ConfigService } from '@nestjs/config';
import type { Role } from '@xcash/shared-types';
import { COPILOT_TOOLS } from './copilot-tool.registry';
import type { CopilotToolService } from './copilot-tool.service';

type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict: boolean;
    parameters: object;
    parse: (text: string) => unknown;
    function: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export function buildCopilotTools(
  tenantId: string,
  toolService: CopilotToolService,
  configService?: ConfigService,
  resultsCapture?: Map<string, unknown>,
  role?: Role,
): ToolDefinition[] {
  const bind =
    (name: string) =>
    async (args: Record<string, unknown>): Promise<unknown> => {
      const result = await toolService.execute(tenantId, name, args, role);
      resultsCapture?.set(name, result);
      return result;
    };

  return COPILOT_TOOLS.filter((entry) => {
    if (!entry.enabledBy) return true;
    return configService?.get<boolean>(entry.enabledBy) ?? false;
  }).map((entry) => ({
    type: 'function' as const,
    function: {
      name: entry.name,
      description: entry.description,
      strict: true,
      parameters: entry.parameters,
      parse: JSON.parse,
      function: bind(entry.name),
    },
  }));
}
