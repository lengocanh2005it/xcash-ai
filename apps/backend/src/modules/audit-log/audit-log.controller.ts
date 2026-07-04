import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.dto';

@ApiTags('audit-log')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAuditLogsQueryDto) {
    return this.service.listForTenant(user.tenantId!, query);
  }
}
