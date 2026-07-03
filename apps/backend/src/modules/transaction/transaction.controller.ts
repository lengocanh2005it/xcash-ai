import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ListTransactionsQueryDto } from './dto/list-transactions.dto';
import { TransactionService } from './transaction.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách giao dịch (filter + pagination)' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTransactionsQueryDto) {
    return this.transactionService.findAll(user.tenantId as string, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết giao dịch kèm định khoản' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionService.findOne(user.tenantId as string, id);
  }

  @Post(':id/reclassify')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Yêu cầu AI định khoản lại giao dịch đang chờ xử lý' })
  reclassify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionService.reclassify(user.tenantId as string, id);
  }
}
