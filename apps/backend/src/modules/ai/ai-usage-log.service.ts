import { Injectable, Logger } from '@nestjs/common';
import type { AiCallType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RecordAiUsageParams {
  tenantId: string;
  callType: AiCallType;
  model: string;
  tokensIn: number;
  tokensOut: number;
  transactionId?: string;
  conversationId?: string;
}

@Injectable()
export class AiUsageLogService {
  private readonly logger = new Logger(AiUsageLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(params: RecordAiUsageParams): void {
    this.prisma.aiUsageLog
      .create({
        data: {
          tenantId: params.tenantId,
          callType: params.callType,
          model: params.model,
          tokensIn: params.tokensIn,
          tokensOut: params.tokensOut,
          transactionId: params.transactionId,
          conversationId: params.conversationId,
        },
      })
      .catch((err: unknown) =>
        this.logger.warn(`Failed to record AI usage for tenant ${params.tenantId}`, err),
      );
  }
}
