import type { ConfigService } from '@nestjs/config';
import type { Role } from '@xcash/shared-types';
import { COPILOT_TOOLS } from './copilot-tool.registry';
import type { CopilotToolService } from './copilot-tool.service';
import type { LlmToolDefinition } from './llm/llm-provider.interface';
import type { LlmTool } from './llm-adapter.interface';

/**
 * Chỉ build JSON schema của tool để gửi lên LLM — không gắn executor.
 * Việc thực thi tool do CopilotAgentHarness gọi thẳng CopilotToolService.execute().
 */
export function buildCopilotToolSchemas(configService?: ConfigService): LlmTool[] {
  return COPILOT_TOOLS.filter((entry) => {
    if (!entry.enabledBy) return true;
    return configService?.get<boolean>(entry.enabledBy) ?? false;
  }).map((entry) => ({
    type: 'function' as const,
    function: {
      name: entry.name,
      description: entry.description,
      strict: true,
      parameters: entry.parameters as Record<string, unknown>,
    },
  }));
}

/**
 * Build plain JSON Schema tool definitions cho generic agent loop.
 * Không绑定 execute — agent loop tự dispatch qua CopilotToolService.
 */
export function buildCopilotToolDefinitions(
  toolService: CopilotToolService,
  tenantId: string,
  role?: Role,
  configService?: ConfigService,
): LlmToolDefinition[] {
  void toolService;
  void tenantId;
  void role;

  return COPILOT_TOOLS.filter((entry) => {
    if (!entry.enabledBy) return true;
    return configService?.get<boolean>(entry.enabledBy) ?? false;
  }).map((entry) => ({
    name: entry.name,
    description: entry.description,
    parameters: entry.parameters as Record<string, unknown>,
  }));
}
