import { Module } from '@nestjs/common';
import { AiUsageLogService } from './ai-usage-log.service';
import { OpenAiService } from './openai.service';

@Module({
  providers: [OpenAiService, AiUsageLogService],
  exports: [OpenAiService, AiUsageLogService],
})
export class AiCoreModule {}
