import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { InviteMemberDto } from './dto/team.dto';
import { TeamService } from './team.service';

@ApiTags('team')
@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private readonly service: TeamService) {}

  @Get('members')
  @Roles(Role.ADMIN)
  getMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMembers(user.tenantId!);
  }

  @Post('members')
  @Roles(Role.ADMIN)
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteMemberDto) {
    return this.service.invite(user.tenantId!, user.id, dto);
  }

  @Post('members/:id/resend-invite')
  @Roles(Role.ADMIN)
  resendInvite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.resendInvite(user.tenantId!, id, user.id);
  }

  @Delete('members/:id')
  @Roles(Role.ADMIN)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.removeMember(user.tenantId!, user.id, id);
  }
}
