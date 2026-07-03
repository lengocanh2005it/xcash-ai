import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiService } from './openai.service';

class ChatMessage {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class CopilotDto {
  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history: ChatMessage[];
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CopilotController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('copilot')
  async chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: CopilotDto) {
    const tenantId = user.tenantId!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [classifications, reviewCount, totalCount] = await Promise.all([
      this.prisma.transactionClassification.findMany({
        where: {
          tenantId,
          status: TransactionStatus.classified,
          transaction: { transactionDate: { gte: monthStart } },
        },
        select: { debitAccount: true, creditAccount: true, amount: true },
      }),
      this.prisma.transactionClassification.count({
        where: { tenantId, status: TransactionStatus.review },
      }),
      this.prisma.transaction.count({
        where: { tenantId, transactionDate: { gte: monthStart } },
      }),
    ]);

    const totalRevenue = classifications
      .filter((c) => c.creditAccount.startsWith('5'))
      .reduce((s, c) => s + Number(c.amount), 0);

    const totalExpense = classifications
      .filter((c) => c.debitAccount.startsWith('6'))
      .reduce((s, c) => s + Number(c.amount), 0);

    const monthName = `${now.getMonth() + 1}/${now.getFullYear()}`;
    const financialContext = `Tháng ${monthName}:
- Tổng thu (doanh thu): ${totalRevenue.toLocaleString('vi-VN')}đ
- Tổng chi (chi phí): ${totalExpense.toLocaleString('vi-VN')}đ
- Lãi/lỗ ước tính: ${(totalRevenue - totalExpense).toLocaleString('vi-VN')}đ
- Tổng giao dịch: ${totalCount}
- Đã định khoản tự động: ${classifications.length}
- Đang chờ kế toán xét duyệt: ${reviewCount}`;

    const reply = await this.openAiService.chatCopilot(dto.message, dto.history, financialContext);
    return { reply };
  }
}
