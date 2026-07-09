import { Module } from '@nestjs/common';
import { PlanGuard } from '../../common/guards/plan.guard';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportDataService } from './report-data.service';

@Module({
  controllers: [ReportController],
  providers: [ReportDataService, ReportService, PlanGuard],
  exports: [ReportService],
})
export class ReportModule {}
