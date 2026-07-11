import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@xcash/shared-types';
import { RedisService } from '../../redis/redis.service';
import { ReportDataService } from '../report/report-data.service';

@Injectable()
export class CopilotContextService {
  constructor(
    private readonly reportService: ReportDataService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getFinancialContext(
    tenantId: string,
    userInfo?: { name: string; role: Role; businessName: string | null },
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const cacheKey = `copilot:context:${tenantId}:${year}-${month}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      // If user info is provided, prepend it even to cached context
      if (userInfo) {
        const userContext = this.buildUserContext(userInfo);
        return `${userContext}\n\n${cached}`;
      }
      return cached;
    }

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
    await this.redisService.set(cacheKey, context, 'EX', ttl);

    if (userInfo) {
      const userContext = this.buildUserContext(userInfo);
      return `${userContext}\n\n${context}`;
    }

    return context;
  }

  private buildUserContext(userInfo: {
    name: string;
    role: Role;
    businessName: string | null;
  }): string {
    const roleMap: Record<Role, string> = {
      admin: 'Quản trị viên',
      accountant: 'Kế toán viên',
      viewer: 'Người xem',
      cas_partner: 'Đối tác Casso',
    };
    const roleLabel = roleMap[userInfo.role] || userInfo.role;
    const company = userInfo.businessName || 'chưa cập nhật';

    return `Thông tin người dùng hiện tại:
- Họ tên: ${userInfo.name}
- Vai trò: ${roleLabel}
- Doanh nghiệp: ${company}`;
  }
}
