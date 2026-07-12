import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';

export interface CopilotStreamMessage {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
}

export interface ConversationPreparation {
  tenantId: string;
  isNewConv: boolean;
  useFunctionCalling: boolean;
  conversation: Awaited<ReturnType<CopilotConversationService['findOrCreate']>>;
  userMsg: Awaited<ReturnType<CopilotConversationService['saveUserMessage']>>;
  history: CopilotStreamMessage['history'];
  financialContext: string;
}

/**
 * Encapsulates the "prepare conversation" step shared by both
 * chat() and streamChat() in CopilotStreamService.
 *
 * Single method, single seam — caller gets everything needed for the LLM call.
 */
@Injectable()
export class CopilotConversationSetupService {
  constructor(
    private readonly conversationService: CopilotConversationService,
    private readonly copilotContextService: CopilotContextService,
    private readonly configService: ConfigService,
  ) {}

  async prepare(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
  ): Promise<ConversationPreparation> {
    const tenantId = user.tenantId!;
    const isNewConv = !dto.conversationId;
    const useFunctionCalling =
      this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING') ?? false;

    const userInfo = { name: user.name, role: user.role, businessName: user.businessName };
    const [conversation, financialContext] = await Promise.all([
      this.conversationService.findOrCreate(tenantId, user.id, dto.conversationId),
      this.copilotContextService.getFinancialContext(tenantId, userInfo),
    ]);
    const userMsg = await this.conversationService.saveUserMessage(conversation.id, dto.message);

    const history = dto.conversationId
      ? await this.conversationService.getHistoryForContext(conversation.id, userMsg.id)
      : dto.history;

    return {
      tenantId,
      isNewConv,
      useFunctionCalling,
      conversation,
      userMsg,
      history,
      financialContext,
    };
  }
}
