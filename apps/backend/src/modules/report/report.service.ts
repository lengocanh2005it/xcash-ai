import { Injectable, StreamableFile } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { AccountBreakdownQueryDto } from './dto/account-breakdown.dto';
import { ReportDataService } from './report-data.service';
import { buildExportWorkbook } from './report-excel.util';

@Injectable()
export class ReportService {
  constructor(private readonly reportData: ReportDataService) {}

  async getDailyTrend(tenantId: string, days = 7) {
    return this.reportData.getDailyTrend(tenantId, days);
  }

  async getStatusBreakdown(tenantId: string) {
    return this.reportData.getStatusBreakdown(tenantId);
  }

  async getSourceBreakdown(tenantId: string) {
    return this.reportData.getSourceBreakdown(tenantId);
  }

  async getSummary(tenantId: string, year: number, month: number) {
    return this.reportData.getSummary(tenantId, year, month);
  }

  async getAccountBreakdown(
    tenantId: string,
    year: number,
    month: number,
    query: AccountBreakdownQueryDto,
  ) {
    return this.reportData.getAccountBreakdown(tenantId, year, month, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      accountType: query.accountType,
    });
  }

  async getByAccount(tenantId: string, fromDate: string, toDate: string) {
    return this.reportData.getByAccount(tenantId, fromDate, toDate);
  }

  async getComparison(tenantId: string, year: number, month: number) {
    return this.reportData.getComparison(tenantId, year, month);
  }

  async getTopAccounts(tenantId: string, year: number, month: number, limit: number) {
    return this.reportData.getTopAccounts(tenantId, year, month, limit);
  }

  async getSummaryByDateRange(tenantId: string, startDate: string, endDate: string) {
    return this.reportData.getSummaryByDateRange(tenantId, startDate, endDate);
  }

  async fetchExportData(tenantId: string, fromDate: string, toDate: string) {
    return this.reportData.fetchExportData(tenantId, fromDate, toDate);
  }

  async exportExcel(tenantId: string, fromDate: string, toDate: string): Promise<StreamableFile> {
    const data = await this.fetchExportData(tenantId, fromDate, toDate);

    const wb = buildExportWorkbook({
      businessName: data.businessName,
      fromDate,
      toDate,
      exportedAt: new Date(),
      summary: data.summary,
      accounts: data.accounts,
      details: data.details,
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="bao-cao-dinh-khoan-${fromDate}-${toDate}.xlsx"`,
    });
  }
}
