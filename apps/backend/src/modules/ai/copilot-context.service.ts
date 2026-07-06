import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { ReportService } from '../report/report.service';

@Injectable()
export class CopilotContextService {
  constructor(
    private readonly reportService: ReportService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getFinancialContext(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const cacheKey = `copilot:context:${tenantId}:${year}-${month}`;

    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return cached;

    const { summary, stats } = await this.reportService.getSummary(tenantId, year, month);

    const context = `Tháng ${month}/${year}:
- Tổng thu (doanh thu): ${summary.totalRevenue.toLocaleString('vi-VN')}đ
- Tổng chi (chi phí): ${summary.totalExpense.toLocaleString('vi-VN')}đ
- Lãi/lỗ ước tính: ${summary.net.toLocaleString('vi-VN')}đ
- Tổng giao dịch: ${stats.totalCount}
- Đã định khoản tự động: ${stats.classifiedCount}
- Đang chờ kế toán xét duyệt: ${stats.reviewCount}
- Độ chính xác AI: ${stats.aiAccuracy}%`;

    const ttl = this.configService.get<number>('COPILOT_CONTEXT_CACHE_TTL_SECONDS', 300);
    await this.redisService.client.set(cacheKey, context, 'EX', ttl);

    return context;
  }
}
