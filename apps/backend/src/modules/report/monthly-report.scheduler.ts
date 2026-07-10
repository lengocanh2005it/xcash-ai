import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { meetsPlan } from '../../common/util/plan.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EMAIL_JOB_OPTIONS,
  EMAIL_MONTHLY_REPORT_JOB,
  type EmailMonthlyReportJobData,
} from '../notification/email.constants';
import { SettingsService } from '../settings/settings.service';
import { ReportDataService } from './report-data.service';

@Injectable()
export class MonthlyReportScheduler {
  private readonly logger = new Logger(MonthlyReportScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportDataService,
    private readonly settingsService: SettingsService,
    @InjectQueue('email-delivery') private readonly emailQueue: Queue<EmailMonthlyReportJobData>,
  ) {}

  @Cron('0 8 1 * *')
  async sendMonthlyReports() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    this.logger.log(`Monthly report cron triggered for ${year}-${month}`);

    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        businessName: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { startedAt: 'desc' },
          select: { plan: true },
          take: 1,
        },
      },
    });

    let queued = 0;
    let skipped = 0;

    for (const tenant of tenants) {
      const plan = tenant.subscriptions[0]?.plan ?? null;
      if (!meetsPlan(plan, 'starter')) {
        skipped++;
        continue;
      }

      const config = await this.settingsService.getNotifications(tenant.id);
      if (!config.monthlyReportEnabled) {
        skipped++;
        continue;
      }

      const reportEmail = config.monthlyReportEmail?.trim() || config.email?.trim();
      if (!reportEmail) {
        skipped++;
        continue;
      }

      try {
        const summaryResult = await this.reportService.getSummary(tenant.id, year, month);

        let comparison: EmailMonthlyReportJobData['comparison'] | undefined;
        try {
          const compResult = await this.reportService.getComparison(tenant.id, year, month);
          comparison = {
            revenueChange: compResult.changes.revenue,
            expenseChange: compResult.changes.expense,
            netChange: compResult.changes.net,
          };
        } catch {
          // First month of data — no comparison available
        }

        let topExpense: EmailMonthlyReportJobData['topExpense'] | undefined;
        let topRevenue: EmailMonthlyReportJobData['topRevenue'] | undefined;
        try {
          const top = await this.reportService.getTopAccounts(tenant.id, year, month, 5);
          topExpense = top.topExpense.map((a) => ({
            accountName: a.accountName,
            total: a.total,
          }));
          topRevenue = top.topRevenue.map((a) => ({
            accountName: a.accountName,
            total: a.total,
          }));
        } catch {
          // No classified transactions yet
        }

        const jobData: EmailMonthlyReportJobData = {
          tenantId: tenant.id,
          to: reportEmail,
          businessName: tenant.businessName,
          year,
          month,
          summary: {
            totalRevenue: summaryResult.summary.totalRevenue,
            totalExpense: summaryResult.summary.totalExpense,
            net: summaryResult.summary.net,
            classifiedCount: summaryResult.stats.classifiedCount,
            reviewCount: summaryResult.stats.reviewCount,
            totalCount: summaryResult.stats.totalCount,
            aiAccuracy: summaryResult.stats.aiAccuracy,
          },
          comparison,
          topExpense,
          topRevenue,
        };

        await this.emailQueue.add(EMAIL_MONTHLY_REPORT_JOB, jobData, EMAIL_JOB_OPTIONS);
        queued++;
      } catch (error) {
        this.logger.warn(
          `Failed to build monthly report for tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        skipped++;
      }
    }

    this.logger.log(`Monthly report cron done: ${queued} queued, ${skipped} skipped`);
  }
}
