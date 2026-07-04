import { Global, Module } from '@nestjs/common';
import { AzureBlobService } from './azure-blob.service';

@Global()
@Module({
  providers: [AzureBlobService],
  exports: [AzureBlobService],
})
export class StorageModule {}
