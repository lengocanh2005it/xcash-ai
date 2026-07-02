import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@paypilot/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceService } from './invoice.service';

interface UploadedImportFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hóa đơn' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvoicesQueryDto) {
    return this.invoiceService.findAll(user.tenantId as string, query);
  }

  @Get('import/template')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({
    summary: 'Tải file Excel mẫu để import hóa đơn',
    description: 'Xem hướng dẫn đầy đủ tại agent-docs/reference/invoice-import-guide.md',
  })
  downloadImportTemplate(): StreamableFile {
    const { buffer, filename } = this.invoiceService.generateImportTemplate();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({
    summary: 'Import hóa đơn từ Excel/CSV',
    description:
      'Dùng file mẫu từ GET /invoices/import/template. Cột bắt buộc: ma_hoa_don, ten_khach_hang, so_tien.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  import(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: UploadedImportFile) {
    return this.invoiceService.importFromFile(user.tenantId as string, file);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Sinh QR VietQR cho hóa đơn' })
  getQr(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoiceService.getQr(user.tenantId as string, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hóa đơn' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoiceService.findOne(user.tenantId as string, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo hóa đơn mới' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.invoiceService.create(user.tenantId as string, dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Cập nhật hóa đơn' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(user.tenantId as string, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Xóa hóa đơn (soft delete)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoiceService.softDelete(user.tenantId as string, id);
  }
}
