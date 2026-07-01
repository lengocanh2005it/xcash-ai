import { Module } from '@nestjs/common';
import { CasController } from './cas.controller';
import { CasClientService } from './cas-client.service';

@Module({
  controllers: [CasController],
  providers: [CasClientService],
  exports: [CasClientService],
})
export class CasModule {}
