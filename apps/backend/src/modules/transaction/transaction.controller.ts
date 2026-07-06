import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { NotificationService } from '../notification/notification.service';
import { BulkReclassifyDto } from './dto/bulk-reclassify.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions.dto';
import { TransactionService } from './transaction.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly notificationService: NotificationService,
  ) {}

  @Public()
  @Sse('events')
  streamEvents(@Query('token') token: string): Observable<MessageEvent> {
    return this.notificationService.streamTransactionEventsForToken(
      token,
    ) as Observable<MessageEvent>;
  }

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

  @Post('bulk-reclassify')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Yêu cầu AI định khoản lại hàng loạt (chỉ GD pending)' })
  bulkReclassify(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkReclassifyDto) {
    return this.transactionService.bulkReclassify(user.tenantId as string, dto.ids);
  }

  @Post(':id/reclassify')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Yêu cầu AI định khoản lại giao dịch đang chờ xử lý' })
  reclassify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transactionService.reclassify(user.tenantId as string, id);
  }
}
