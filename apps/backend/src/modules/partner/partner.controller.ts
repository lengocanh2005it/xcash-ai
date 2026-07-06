import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SubscriptionPlan } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, PartnerGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListAuditLogsQueryDto } from '../audit-log/dto/list-audit-logs.dto';
import { SetTenantPlanDto, UpdatePlanPricingDto } from './dto/plan-pricing.dto';
import { PartnerService } from './partner.service';

@ApiTags('partner')
@Controller('partner')
@UseGuards(JwtAuthGuard, PartnerGuard)
export class PartnerController {
  constructor(
    private readonly service: PartnerService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('tenants')
  listTenants(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listTenants({
      search,
      status,
      plan,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('stats')
  getStats(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
    return this.service.getStats({ fromDate, toDate });
  }

  @Get('tenants/:id')
  getTenantDetail(@Param('id') id: string) {
    return this.service.getTenantDetail(id);
  }

  @Get('revenue-trend')
  getRevenueTrend(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
    return this.service.getRevenueTrend({ fromDate, toDate });
  }

  @Get('payments')
  listPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.listPayments({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      plan,
      search,
      fromDate,
      toDate,
    });
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogService.listForPartner(query);
  }

  @Patch('tenants/:id/plan')
  setTenantPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetTenantPlanDto,
  ) {
    return this.service.setTenantPlan(id, dto.targetPlan as SubscriptionPlan, user.id);
  }

  @Patch('tenants/:id/suspend')
  suspend(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.suspendTenant(id, user.id);
  }

  @Patch('tenants/:id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.activateTenant(id, user.id);
  }

  @Get('plan-pricing')
  listPlanPricing() {
    return this.service.listPlanPricing();
  }

  @Patch('plan-pricing/:plan')
  updatePlanPricing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('plan') plan: SubscriptionPlan,
    @Body() dto: UpdatePlanPricingDto,
  ) {
    return this.service.updatePlanPricing(plan, dto, user.id);
  }
}
