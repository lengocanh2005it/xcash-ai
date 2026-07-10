import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { AI_CLASSIFY_JOB } from './classification.constants';
import { ClassificationService } from './classification.service';

export interface AiClassifyJobData {
  transactionDbId: string;
}

@Processor(WEBHOOK_QUEUE)
export class ClassificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ClassificationProcessor.name);

  constructor(private readonly classificationService: ClassificationService) {
    super();
  }

  async process(job: Job<AiClassifyJobData>): Promise<void> {
    if (job.name !== AI_CLASSIFY_JOB) {
      return;
    }

    try {
      await this.classificationService.processTransaction(job.data.transactionDbId);
    } catch (error) {
      this.logger.error(
        `AI classification failed for transaction ${job.data.transactionDbId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
