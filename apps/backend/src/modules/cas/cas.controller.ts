import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import { CasClientService } from './cas-client.service';

@ApiTags('Cas')
@Controller('cas')
export class CasController {
  constructor(private readonly casClientService: CasClientService) {}

  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra cấu hình Cas SDK (không cần đăng nhập)' })
  healthCheck() {
    return {
      configured: this.casClientService.isConfigured(),
      baseUrl: process.env.CAS_API_BASE_URL ?? 'https://sandbox.bankhub.dev',
    };
  }

  @Get('ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gọi thử POST /grant/token — chỉ Admin (demo RBAC)' })
  async ping() {
    return this.casClientService.ping();
  }
}
