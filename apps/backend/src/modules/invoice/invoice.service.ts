import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';
import { CustomerService } from '../customer/customer.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import {
  generateInvoiceImportTemplate,
  INVOICE_IMPORT_MAX_FILE_BYTES,
  INVOICE_IMPORT_TEMPLATE_FILENAME,
  parseInvoiceImportBuffer,
} from './utils/invoice-import.util';
import { buildVietQrImageUrl } from './utils/vietqr';

export { INVOICE_IMPORT_TEMPLATE_FILENAME };

interface UploadedImportFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly customerService: CustomerService,
  ) {}

  async findAll(tenantId: string, query: ListInvoicesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status as PrismaInvoiceStatus } : {}),
      ...(query.customer_id ? { customerId: query.customer_id } : {}),
      ...(query.from_date || query.to_date
        ? {
            createdAt: {
              ...(query.from_date ? { gte: new Date(query.from_date) } : {}),
              ...(query.to_date ? { lte: new Date(query.to_date) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        matches: {
          include: {
            transaction: {
              select: {
                id: true,
                transactionId: true,
                amount: true,
                transactionDate: true,
                content: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    return invoice;
  }

  async create(tenantId: string, dto: CreateInvoiceDto) {
    await this.customerService.findOne(tenantId, dto.customer_id);

    const existing = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceCode: dto.invoice_code,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Mã hóa đơn đã tồn tại trong tenant này');
    }

    const customer = await this.prisma.customer.findFirstOrThrow({
      where: { id: dto.customer_id, tenantId, deletedAt: null },
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        customerId: dto.customer_id,
        invoiceCode: dto.invoice_code,
        amount: new Prisma.Decimal(dto.amount),
        dueDate: dto.due_date ? new Date(dto.due_date) : null,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    await this.embeddingService.embedAndStoreInvoice(
      invoice.id,
      invoice.invoiceCode,
      customer.name,
      dto.amount,
    );

    return invoice;
  }

  async update(tenantId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(tenantId, id);

    if (dto.customer_id) {
      await this.customerService.findOne(tenantId, dto.customer_id);
    }

    if (dto.invoice_code && dto.invoice_code !== invoice.invoiceCode) {
      const duplicate = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          invoiceCode: dto.invoice_code,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Mã hóa đơn đã tồn tại trong tenant này');
      }
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.customer_id ? { customerId: dto.customer_id } : {}),
        ...(dto.invoice_code ? { invoiceCode: dto.invoice_code } : {}),
        ...(dto.amount !== undefined ? { amount: new Prisma.Decimal(dto.amount) } : {}),
        ...(dto.due_date !== undefined
          ? { dueDate: dto.due_date ? new Date(dto.due_date) : null }
          : {}),
        ...(dto.status ? { status: dto.status as PrismaInvoiceStatus } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    const customer = await this.prisma.customer.findFirstOrThrow({
      where: { id: updated.customerId },
    });

    await this.embeddingService.embedAndStoreInvoice(
      updated.id,
      updated.invoiceCode,
      customer.name,
      Number(updated.amount),
    );

    return updated;
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }

  async getQr(tenantId: string, id: string) {
    const invoice = await this.findOne(tenantId, id);

    const grant = await this.prisma.casGrant.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { linkedAt: 'desc' },
    });

    if (!grant?.accountNumber) {
      throw new BadRequestException(
        'Chưa liên kết tài khoản ngân hàng. Vui lòng hoàn tất onboarding Cas Link.',
      );
    }

    const qrImageUrl = buildVietQrImageUrl({
      bankName: grant.bankName,
      accountNumber: grant.accountNumber,
      amount: Number(invoice.amount),
      transferContent: invoice.invoiceCode,
      accountHolderName: grant.accountHolderName,
    });

    return {
      invoiceId: invoice.id,
      invoiceCode: invoice.invoiceCode,
      amount: invoice.amount,
      accountNumber: grant.accountNumber,
      bankName: grant.bankName,
      bankLogo: grant.bankLogo,
      transferContent: invoice.invoiceCode,
      qrImageUrl,
    };
  }

  generateImportTemplate(): { buffer: Buffer; filename: string } {
    return {
      buffer: generateInvoiceImportTemplate(),
      filename: INVOICE_IMPORT_TEMPLATE_FILENAME,
    };
  }

  async importFromFile(tenantId: string, file: UploadedImportFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'File import không hợp lệ. Vui lòng chọn file .xlsx và thử lại.',
      );
    }

    if (file.buffer.length > INVOICE_IMPORT_MAX_FILE_BYTES) {
      throw new BadRequestException(
        `File vượt quá ${INVOICE_IMPORT_MAX_FILE_BYTES / (1024 * 1024)}MB. Vui lòng chia nhỏ file.`,
      );
    }

    const parsed = parseInvoiceImportBuffer(file.buffer);

    if (parsed.headerError) {
      throw new BadRequestException(parsed.headerError);
    }

    if (parsed.validRows.length === 0) {
      throw new BadRequestException({
        message:
          'Không có dòng hợp lệ để import. Kiểm tra lại định dạng file hoặc tải file mẫu tại GET /api/v1/invoices/import/template.',
        errors: parsed.errors,
      });
    }

    const results = {
      imported: 0,
      skipped: 0,
      skipped_empty_rows: parsed.skippedEmptyRows,
      errors: [...parsed.errors] as string[],
    };

    for (const row of parsed.validRows) {
      try {
        const existing = await this.prisma.invoice.findFirst({
          where: { tenantId, invoiceCode: row.invoice_code, deletedAt: null },
        });

        if (existing) {
          results.skipped += 1;
          continue;
        }

        let customer = await this.prisma.customer.findFirst({
          where: {
            tenantId,
            deletedAt: null,
            name: { equals: row.customer_name, mode: 'insensitive' },
          },
        });

        if (!customer) {
          customer = await this.customerService.create(tenantId, {
            name: row.customer_name,
            phone: row.phone,
            email: row.email,
          });
        }

        await this.create(tenantId, {
          customer_id: customer.id,
          invoice_code: row.invoice_code,
          amount: row.amount,
          due_date: row.due_date,
        });

        results.imported += 1;
      } catch (error) {
        results.errors.push(
          `Dòng ${row.source_row_number}: ${error instanceof Error ? error.message : 'Lỗi không xác định'}`,
        );
      }
    }

    return results;
  }
}
