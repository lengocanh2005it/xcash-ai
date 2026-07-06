import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from './billing.service';
import { CycleTransactionsQueryDto } from './dto/cycle-transactions-query.dto';
import { PaymentHistoryDto } from './dto/payment-history.dto';
import { UpgradeBillingDto } from './dto/upgrade-billing.dto';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly service: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Get('plans')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  listPlans() {
    return this.service.listPlans();
  }

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
    return this.service.confirmPayment(orderCode, user.tenantId!);
  }

  @Get('cycle-transactions')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getCycleTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: CycleTransactionsQueryDto,
  ) {
    return this.service.getCycleTransactions(user.tenantId!, dto);
  }

  @Get('payment-history')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getPaymentHistory(@CurrentUser() user: AuthenticatedUser, @Query() dto: PaymentHistoryDto) {
    return this.service.getPaymentHistory(user.tenantId!, dto);
  }

  @Get('overage-orders')
  @Roles(Role.ADMIN)
  getOverageOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOverageOrders(user.tenantId!);
  }

  @Post('overage-order')
  @Roles(Role.ADMIN)
  createOverageOrder(@CurrentUser() user: AuthenticatedUser) {
    return this.service.createOverageOrder(user.tenantId!);
  }

  @Post('overage-order/:orderCode/mock-confirm')
  @Roles(Role.ADMIN)
  mockConfirmOverage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderCode') orderCode: string,
  ) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      return { success: false, message: 'Không khả dụng trong môi trường production' };
    }
    return this.service.confirmPayment(orderCode, user.tenantId!);
  }
}
