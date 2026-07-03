import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UpdateNotificationsDto, UpdateThresholdDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('threshold')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  getThreshold(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getThreshold(user.tenantId!);
  }

  @Put('threshold')
  @Roles(Role.ADMIN)
  updateThreshold(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateThresholdDto) {
    return this.service.updateThreshold(user.tenantId!, dto);
  }

  @Get('notifications')
  @Roles(Role.ADMIN)
  getNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getNotifications(user.tenantId!);
  }

  @Put('notifications')
  @Roles(Role.ADMIN)
  updateNotifications(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNotificationsDto) {
    return this.service.updateNotifications(user.tenantId!, dto);
  }
}
