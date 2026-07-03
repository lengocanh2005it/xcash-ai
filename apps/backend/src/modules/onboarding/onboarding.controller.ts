import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CAS_DEFAULT_GRANT_SCOPES } from '../cas/cas-client.service';
import { BankingCallbackDto, GrantTokenQueryDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('banking/grant-token')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo grantToken để mở Cas Link' })
  createGrantToken(@Query() query: GrantTokenQueryDto) {
    return this.onboardingService.createGrantToken(query.scopes ?? CAS_DEFAULT_GRANT_SCOPES);
  }

  @Post('banking/callback')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Đổi publicToken lấy grantId và lưu cas_grants' })
  handleCallback(@CurrentUser() user: AuthenticatedUser, @Body() dto: BankingCallbackDto) {
    return this.onboardingService.handleBankingCallback(user.tenantId as string, dto.publicToken);
  }

  @Get('status')
  @ApiOperation({ summary: 'Trạng thái onboarding của tenant hiện tại' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getStatus(user.tenantId as string);
  }
}
