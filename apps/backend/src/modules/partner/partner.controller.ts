import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SubscriptionPlan } from '@prisma/client';
import { JwtAuthGuard, PartnerGuard } from '../../common/guards/auth.guards';
import { UpdatePlanPricingDto } from './dto/plan-pricing.dto';
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
  getStats() {
    return this.service.getStats();
  }

  @Get('tenants/:id')
  getTenantDetail(@Param('id') id: string) {
    return this.service.getTenantDetail(id);
  }

  @Get('revenue-trend')
  getRevenueTrend() {
    return this.service.getRevenueTrend();
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
