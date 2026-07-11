import { Module } from '@nestjs/common';
import { ClassificationPipelineModule } from '../ai/ai.module';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './classification.service';

@Module({
  imports: [ClassificationPipelineModule],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
