import { Role } from '@klassi/shared-types';
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ClassificationService } from './classification.service';
import { CorrectClassificationDto } from './dto/review.dto';

@ApiTags('review')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassificationController {
  constructor(private readonly service: ClassificationService) {}

  @Get('transactions/:id/classification')
  getClassification(@CurrentUser() user: AuthenticatedUser, @Param('id') transactionId: string) {
    return this.service.getClassification(user.tenantId!, transactionId);
  }

  @Post('transactions/:id/classification')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  overrideClassification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') transactionId: string,
    @Body() dto: CorrectClassificationDto,
  ) {
    return this.service.overrideClassification(user.tenantId!, transactionId, user.id, dto);
  }

  @Get('review/queue')
  getReviewQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.getReviewQueue(user.tenantId!, page, Math.min(limit, 50));
  }

  @Post('review/:id/confirm')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') classificationId: string) {
    return this.service.confirm(user.tenantId!, classificationId, user.id);
  }

  @Post('review/:id/correct')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') classificationId: string,
    @Body() dto: CorrectClassificationDto,
  ) {
    return this.service.correct(user.tenantId!, classificationId, user.id, dto);
  }

  @Post('review/:id/skip')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  skip(@CurrentUser() user: AuthenticatedUser, @Param('id') classificationId: string) {
    return this.service.skip(user.tenantId!, classificationId, user.id);
  }
}
