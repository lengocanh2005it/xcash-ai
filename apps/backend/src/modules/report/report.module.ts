import { Module } from '@nestjs/common';
import { PlanGuard } from '../../common/guards/plan.guard';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, PlanGuard],
  exports: [ReportService],
})
export class ReportModule {}
