import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@xcash/shared-types';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ImportHistoryQueryDto } from './dto/import.dto';
import { ImportService } from './import.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

@ApiTags('Import')
@ApiBearerAuth()
@Controller('transactions/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ACCOUNTANT)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('template')
  @ApiOperation({ summary: 'Tải file Excel mẫu để nhập giao dịch tiền mặt' })
  downloadTemplate(@Res() res: Response) {
    const buffer = this.importService.buildTemplate();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="xcash-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Dry-run: validate file Excel, trả lỗi, KHÔNG import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === XLSX_MIME || file.originalname.endsWith('.xlsx')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Chỉ hỗ trợ file Excel (.xlsx)'), false);
        }
      },
    }),
  )
  async validate(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file Excel (.xlsx)');
    return this.importService.validate(user.tenantId as string, file.buffer);
  }

  @Post()
  @ApiOperation({ summary: 'Import giao dịch từ file Excel đã validate' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === XLSX_MIME || file.originalname.endsWith('.xlsx')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Chỉ hỗ trợ file Excel (.xlsx)'), false);
        }
      },
    }),
  )
  async importFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Vui lòng chọn file Excel (.xlsx)');
    return this.importService.importRows(
      user.tenantId as string,
      user.id,
      file.originalname,
      file.buffer,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Lịch sử các lần import của tenant' })
  getHistory(@CurrentUser() user: AuthenticatedUser, @Query() query: ImportHistoryQueryDto) {
    return this.importService.getHistory(user.tenantId as string, query.page, query.limit);
  }
}
