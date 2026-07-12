import { Module } from '@nestjs/common';
import { AiUsageLogService } from './ai-usage-log.service';
import { ChatProviderService } from './chat-provider.service';
import { CopilotAgentFactoryService } from './copilot-agent-factory.service';
import { EmbeddingProviderService } from './embedding-provider.service';
import { OpenAiService } from './openai.service';

@Module({
  providers: [
    OpenAiService,
    AiUsageLogService,
    EmbeddingProviderService,
    ChatProviderService,
    CopilotAgentFactoryService,
  ],
  exports: [
    OpenAiService,
    AiUsageLogService,
    EmbeddingProviderService,
    ChatProviderService,
    CopilotAgentFactoryService,
  ],
})
export class AiCoreModule {}
