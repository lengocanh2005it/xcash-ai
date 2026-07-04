import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BlobServiceClient } from '@azure/storage-blob';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class AzureBlobService {
  private readonly logger = new Logger(AzureBlobService.name);
  private readonly maxFileSize: number;
  private readonly containerName: string;
  private blobServiceClient: BlobServiceClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.maxFileSize = this.configService.get<number>('AZURE_STORAGE_MAX_FILE_SIZE', 5_242_880);
    this.containerName = this.configService.get<string>(
      'AZURE_STORAGE_CONTAINER_NAME',
      'task-attachments',
    );

    const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      this.logger.warn(
        'AZURE_STORAGE_CONNECTION_STRING chưa cấu hình — upload avatar sẽ bị từ chối',
      );
    }
  }

  isConfigured(): boolean {
    return this.blobServiceClient !== null;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<string> {
    if (!this.blobServiceClient) {
      throw new BadRequestException('Dịch vụ lưu trữ ảnh chưa được cấu hình');
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Không tìm thấy file ảnh');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `Ảnh vượt quá giới hạn ${Math.round(this.maxFileSize / (1024 * 1024))}MB`,
      );
    }

    const mimeType = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF');
    }

    const extension = extname(file.originalname).toLowerCase() || MIME_TO_EXT[mimeType] || '.jpg';
    const blobName = `avatars/${userId}/${randomUUID()}${extension}`;
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    return blockBlobClient.url;
  }

  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url || !this.blobServiceClient) {
      return;
    }

    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const containerIndex = pathParts.indexOf(this.containerName);
      if (containerIndex === -1 || containerIndex >= pathParts.length - 1) {
        return;
      }

      const blobName = pathParts.slice(containerIndex + 1).join('/');
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.getBlockBlobClient(blobName).deleteIfExists();
    } catch (error) {
      this.logger.warn(`Không thể xóa avatar cũ: ${String(error)}`);
    }
  }
}
