import { ConfigService } from '@nestjs/config';
import { CopilotAgentHarness } from './copilot-agent.harness';
import { CopilotAgentFactoryService } from './copilot-agent-factory.service';
import type { ToolDeps } from './copilot-tool.executor';
import type { OpenAiService } from './openai.service';

jest.mock('./copilot-agent.harness', () => ({
  CopilotAgentHarness: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('./copilot-tools.factory', () => ({
  buildCopilotToolSchemas: jest.fn().mockReturnValue([]),
}));

jest.mock('./copilot-tool.executor', () => ({
  executeTool: jest.fn(),
}));

describe('CopilotAgentFactoryService.createCopilotRunner', () => {
  const toolDeps = {} as ToolDeps;

  function createFactory(): CopilotAgentFactoryService {
    const openAiService = {
      client: {},
      chatModel: 'gpt-4o-mini',
      minimaxClient: null,
      minimaxModel: 'MiniMax-M3',
      buildCopilotSystemPrompt: jest.fn().mockReturnValue('system prompt'),
    } as unknown as OpenAiService;
    const configService = {
      get: jest.fn().mockReturnValue(false),
    } as unknown as ConfigService;
    return new CopilotAgentFactoryService(openAiService, configService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('seeds get_review_queue_count when the message matches review-count intent', () => {
    const factory = createFactory();

    factory.createCopilotRunner('tenant-1', 'có bao nhiêu giao dịch chờ duyệt?', [], toolDeps);

    expect(CopilotAgentHarness).toHaveBeenCalledWith(
      expect.any(Array),
      'system prompt',
      [],
      'có bao nhiêu giao dịch chờ duyệt?',
      [],
      expect.any(Function),
      5,
      { name: 'get_review_queue_count', args: {} },
    );
  });

  it('does not seed a tool call when the message does not match', () => {
    const factory = createFactory();

    factory.createCopilotRunner('tenant-1', 'Doanh thu tháng này bao nhiêu?', [], toolDeps);

    expect(CopilotAgentHarness).toHaveBeenCalledWith(
      expect.any(Array),
      'system prompt',
      [],
      'Doanh thu tháng này bao nhiêu?',
      [],
      expect.any(Function),
      5,
      undefined,
    );
  });
});
