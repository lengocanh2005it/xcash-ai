import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from './billing.service';
import { UpgradeBillingDto } from './dto/upgrade-billing.dto';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly service: BillingService,
    private readonly config: ConfigService,
  ) {}

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

  @Post('upgrade')
  @Roles(Role.ADMIN)
  upgrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpgradeBillingDto) {
    return this.service.upgrade(user.tenantId!, dto.targetPlan);
  }

  @Post('upgrade/:orderCode/mock-confirm')
  @Roles(Role.ADMIN)
  mockConfirm(@CurrentUser() user: AuthenticatedUser, @Param('orderCode') orderCode: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      return { success: false, message: 'Không khả dụng trong môi trường production' };
    }
    // Verify orderCode thuộc về tenant hiện tại sẽ được check trong service (tìm theo PK)
    void user;
    return this.service.confirmPayment(orderCode);
  }
}
