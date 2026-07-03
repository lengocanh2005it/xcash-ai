import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SubscriptionPlan } from '@prisma/client';
import { JwtAuthGuard, PartnerGuard } from '../../common/guards/auth.guards';
import { SetTenantPlanDto, UpdatePlanPricingDto } from './dto/plan-pricing.dto';
import { PartnerService } from './partner.service';

@ApiTags('partner')
@Controller('partner')
@UseGuards(JwtAuthGuard, PartnerGuard)
export class PartnerController {
  constructor(private readonly service: PartnerService) {}

  @Get('tenants')
  listTenants() {
    return this.service.listTenants();
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

  @Patch('tenants/:id/plan')
  setTenantPlan(@Param('id') id: string, @Body() dto: SetTenantPlanDto) {
    return this.service.setTenantPlan(id, dto.targetPlan as SubscriptionPlan);
  }

  @Patch('tenants/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.service.suspendTenant(id);
  }

  @Patch('tenants/:id/activate')
  activate(@Param('id') id: string) {
    return this.service.activateTenant(id);
  }

  @Get('plan-pricing')
  listPlanPricing() {
    return this.service.listPlanPricing();
  }

  @Patch('plan-pricing/:plan')
  updatePlanPricing(@Param('plan') plan: SubscriptionPlan, @Body() dto: UpdatePlanPricingDto) {
    return this.service.updatePlanPricing(plan, dto);
  }
}
