import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('current-plan')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getCurrentPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getCurrentPlan(user.tenantId!);
  }

  @Get('usage-history')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getUsageHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getUsageHistory(user.tenantId!);
  }
}
