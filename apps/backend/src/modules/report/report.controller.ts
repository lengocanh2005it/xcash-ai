import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPlan } from '../../common/decorators/requires-plan.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import { PlanGuard } from '../../common/guards/plan.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AccountBreakdownQueryDto } from './dto/account-breakdown.dto';
import { DashboardDailyTrendQueryDto } from './dto/dashboard-charts.dto';
import { ReportDataService } from './report-data.service';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class ReportController {
  constructor(private readonly reportData: ReportDataService) {}

  @Get('daily-trend')
  getDailyTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardDailyTrendQueryDto,
  ) {
    return this.reportData.getDailyTrend(user.tenantId!, query.days ?? 7);
  }

  @Get('status-breakdown')
  getStatusBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.reportData.getStatusBreakdown(user.tenantId!);
  }

  @Get('source-breakdown')
  getSourceBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.reportData.getSourceBreakdown(user.tenantId!);
  }

  @Get('summary')
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ) {
    return this.reportData.getSummary(user.tenantId!, year, month);
  }

  @Get('account-breakdown')
  getAccountBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AccountBreakdownQueryDto,
  ) {
    const year = query.year ?? new Date().getFullYear();
    const month = query.month ?? new Date().getMonth() + 1;
    return this.reportData.getAccountBreakdown(user.tenantId!, year, month, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      accountType: query.accountType,
    });
  }

  @Get('by-account')
  getByAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate =
      from ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to ?? new Date().toISOString().split('T')[0];
    return this.reportData.getByAccount(user.tenantId!, fromDate, toDate);
  }

  @Get('comparison')
  @RequiresPlan('starter')
  getComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ) {
    return this.reportData.getComparison(user.tenantId!, year, month);
  }

  @Get('top-accounts')
  @RequiresPlan('starter')
  getTopAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.reportData.getTopAccounts(user.tenantId!, year, month, limit);
  }

  @Get('export')
  @RequiresPlan('pro')
  async exportExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fromDate =
      from ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate = to ?? new Date().toISOString().split('T')[0];
    const file = await this.reportData.exportExcel(user.tenantId!, fromDate, toDate);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bao-cao-dinh-khoan-${fromDate}-${toDate}.xlsx"`,
    });
    return file;
  }
}
