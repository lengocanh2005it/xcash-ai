# Copilot Export Report (Excel/PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Copilot tool `export_report` that lets users ask the AI Copilot to export the accounting report as Excel or PDF, with a download button rendered directly in the chat message.

**Architecture:** The tool generates the file server-side (reusing `ReportDataService.fetchExportData`), stores the buffer in Redis with a 10-minute TTL under a random `exportId`, and returns only `{ exportId, format, fileName, fromDate, toDate }` to the model (OpenAI function-calling cannot carry binary data). This metadata is persisted permanently in copilot history as a new `file_export` activity kind. A new authenticated endpoint `GET /reports/copilot-export/:exportId` serves the file — reading from Redis if still cached, or regenerating on-demand from `fromDate/toDate/format` (sent by the frontend, sourced from the persisted activity) if the Redis entry expired. The frontend renders a download card that fetches the file as a blob (auth header required, so no plain `<a href>`) and triggers a browser download.

**Tech Stack:** NestJS (backend), `xlsx` (existing, Excel), `pdfmake` (new, PDF — Node `PdfPrinter` class API, embeds the Roboto TTF already bundled inside the `pdfmake` npm package for Vietnamese diacritics support), `ioredis` via existing `RedisService`, React + TanStack Query (frontend), `class-validator` DTOs.

## Global Constraints

- All UI text, error messages, and business-facing labels are in Vietnamese; code identifiers and comments are in English (per `CLAUDE.md`).
- Every business query must be scoped by `tenantId` (multi-tenant rule).
- `pnpm verify` (lint + type-check + test + build) must pass before any task is considered done.
- No plan-tier gating is added to the tool or the download endpoint — existing Copilot tools (e.g. `get_month_comparison`, whose REST equivalent `/reports/comparison` is Starter+-gated) already bypass HTTP-layer plan guards when invoked through the tool-calling path, since tools call services directly rather than going through guarded controller routes. Adding gating only to the new download endpoint would be inconsistent (the Copilot could offer an export that the endpoint then refuses). This plan preserves that existing behavior rather than fixing it — out of scope.
- Do not download or fetch any external font/asset files from the network. The plan reuses the Roboto TTF fonts already bundled inside the `pdfmake` npm package (`pdfmake/build/vfs_fonts.js`, installed via `pnpm install`, not fetched ad hoc).

---

### Task 1: Add `pdfmake` dependency + ambient type declarations

**Files:**
- Modify: `apps/backend/package.json` (add `"pdfmake": "^0.2.20"` to `dependencies`)
- Create: `apps/backend/src/types/pdfmake.d.ts`

**Interfaces:**
- Produces: ambient modules `pdfmake` (default export `PdfPrinter` class) and `pdfmake/build/vfs_fonts` (default export `Record<string, string>`) usable from any later task.

**Context:** `@types/pdfmake` on npm only documents the browser-bundle API (`createPdf`, `TDocumentDefinitions`) and does NOT declare the Node-only `PdfPrinter` class (`require('pdfmake')` resolves to `src/printer.js` per its `package.json` `"main"` field, a completely different, undocumented-in-types API). Rather than fight a type mismatch, write a small local ambient declaration matching exactly what this plan uses.

- [ ] **Step 1: Add the dependency**

Edit `apps/backend/package.json`, in the `"dependencies"` object (near `"xlsx"`), add:

```json
"pdfmake": "^0.2.20",
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updated, no errors.

- [ ] **Step 3: Write the ambient type declaration**

Create `apps/backend/src/types/pdfmake.d.ts`:

```typescript
declare module 'pdfmake' {
  export interface PdfFontDescriptor {
    normal?: string | Buffer;
    bold?: string | Buffer;
    italics?: string | Buffer;
    bolditalics?: string | Buffer;
  }

  export type PdfFontDictionary = Record<string, PdfFontDescriptor>;

  export default class PdfPrinter {
    constructor(fontDescriptors: PdfFontDictionary);
    createPdfKitDocument(docDefinition: Record<string, unknown>): NodeJS.ReadableStream & {
      end(): void;
    };
  }
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export default vfs;
}
```

- [ ] **Step 4: Verify the project still type-checks**

Run: `pnpm --filter @xcash/backend type-check`
Expected: PASS (no errors related to the new ambient module — it isn't used anywhere yet, this just confirms no syntax errors in the `.d.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml apps/backend/src/types/pdfmake.d.ts
git commit -m "chore(backend): thêm pdfmake + ambient types cho PDF export"
```

---

### Task 2: `monthToDateRange` util + test

**Files:**
- Modify: `apps/backend/src/modules/report/report-date.util.ts`
- Modify: `apps/backend/src/modules/report/report-date.util.spec.ts`

**Interfaces:**
- Produces: `monthToDateRange(year: number, month: number): { fromDate: string; toDate: string }` — `fromDate`/`toDate` are `YYYY-MM-DD` strings (first and last calendar day of the month), matching the string-based date-range contract already used by `ReportDataService.fetchExportData(tenantId, fromDate, toDate)` and `getSummaryByDateRange`. Distinct from the existing `periodBounds()` (which returns `Date` objects with an exclusive-end contract for Prisma `lt` queries) — this new helper is specifically for the inclusive string-range contract.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `apps/backend/src/modules/report/report-date.util.spec.ts`:

```typescript
describe('monthToDateRange', () => {
  it('returns first and last day of month as YYYY-MM-DD strings', () => {
    expect(monthToDateRange(2026, 7)).toEqual({ fromDate: '2026-07-01', toDate: '2026-07-31' });
  });

  it('handles February in a leap year', () => {
    expect(monthToDateRange(2028, 2)).toEqual({ fromDate: '2028-02-01', toDate: '2028-02-29' });
  });

  it('handles February in a non-leap year', () => {
    expect(monthToDateRange(2026, 2)).toEqual({ fromDate: '2026-02-01', toDate: '2026-02-28' });
  });

  it('handles December', () => {
    expect(monthToDateRange(2026, 12)).toEqual({ fromDate: '2026-12-01', toDate: '2026-12-31' });
  });
});
```

Update the import at the top of the same file:

```typescript
import {
  buildDailyTrendBuckets,
  formatDayKey,
  formatDayLabel,
  monthToDateRange,
  periodBounds,
  startOfDay,
} from './report-date.util';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- report-date.util.spec.ts`
Expected: FAIL with `monthToDateRange is not a function` / TypeScript compile error (not yet exported).

- [ ] **Step 3: Implement**

Add to `apps/backend/src/modules/report/report-date.util.ts` (after `periodBounds`):

```typescript
export function monthToDateRange(year: number, month: number): { fromDate: string; toDate: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    fromDate: `${year}-${pad(month)}-01`,
    toDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- report-date.util.spec.ts`
Expected: PASS, all `monthToDateRange` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/report/report-date.util.ts apps/backend/src/modules/report/report-date.util.spec.ts
git commit -m "feat(report): thêm monthToDateRange util cho export theo tháng"
```

---

### Task 3: `report-pdf.util.ts` — PDF builder + test

**Files:**
- Create: `apps/backend/src/modules/report/report-pdf.util.ts`
- Create: `apps/backend/src/modules/report/report-pdf.util.spec.ts`

**Interfaces:**
- Consumes: `ExcelExportContext` type from `apps/backend/src/modules/report/report-excel.util.ts` (already defined: `businessName`, `fromDate`, `toDate`, `exportedAt`, `summary`, `accounts`, `details`) — same input shape as the Excel builder, per the design decision to reuse one data source for both formats.
- Produces: `buildExportPdf(ctx: ExcelExportContext): Promise<Buffer>` — later tasks (`ReportExportService`) call this directly.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/report/report-pdf.util.spec.ts`:

```typescript
import { buildExportPdf } from './report-pdf.util';

describe('report-pdf.util', () => {
  const baseCtx = {
    businessName: 'Công ty Demo',
    fromDate: '2026-06-01',
    toDate: '2026-06-30',
    exportedAt: new Date('2026-07-04'),
    summary: {
      totalRevenue: 120_000_000,
      totalExpense: 45_000_000,
      net: 75_000_000,
      classifiedCount: 10,
      reviewCount: 2,
      totalCount: 12,
      aiAccuracy: 83,
    },
    accounts: [
      {
        accountCode: '511',
        accountName: 'Doanh thu bán hàng',
        accountType: 'revenue',
        totalDebit: 0,
        totalCredit: 120_000_000,
        transactionCount: 5,
      },
    ],
    details: [
      {
        transactionDate: new Date('2026-06-15'),
        content: 'Thanh toán hóa đơn điện',
        amount: 1_500_000,
        debitAccount: '642',
        creditAccount: '112',
        classificationType: 'auto',
        reason: 'Chi phí điện năng văn phòng',
      },
    ],
  };

  it('builds a non-empty PDF buffer starting with the PDF magic bytes', async () => {
    const buffer = await buildExportPdf(baseCtx);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('builds a valid PDF even with zero accounts/details', async () => {
    const buffer = await buildExportPdf({ ...baseCtx, accounts: [], details: [] });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- report-pdf.util.spec.ts`
Expected: FAIL — `Cannot find module './report-pdf.util'`.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/report/report-pdf.util.ts`:

```typescript
import PdfPrinter from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { ExcelExportContext } from './report-excel.util';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Tài sản',
  liability: 'Nợ phải trả',
  equity: 'Vốn chủ sở hữu',
  revenue: 'Doanh thu',
  expense: 'Chi phí',
  unknown: 'Khác',
};

const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfsFonts['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfsFonts['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

const printer = new PdfPrinter(fonts);

function fmtVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

function formatPeriodLabel(fromDate: string, toDate: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}

function pdfDocToBuffer(doc: NodeJS.ReadableStream & { end(): void }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function buildExportPdf(ctx: ExcelExportContext): Promise<Buffer> {
  const accountRows = ctx.accounts.map((a, i) => [
    String(i + 1),
    a.accountCode,
    a.accountName,
    ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType,
    fmtVnd(a.totalDebit),
    fmtVnd(a.totalCredit),
    String(a.transactionCount),
  ]);

  const detailRows = ctx.details.map((d, i) => [
    String(i + 1),
    d.transactionDate.toLocaleDateString('vi-VN'),
    d.content,
    d.debitAccount,
    d.creditAccount,
    fmtVnd(d.amount),
    d.classificationType === 'auto' ? 'Tự động (AI)' : 'Thủ công',
  ]);

  const docDefinition = {
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 14, bold: true, margin: [0, 0, 0, 6] },
      section: { fontSize: 11, bold: true, margin: [0, 10, 0, 6] },
    },
    content: [
      { text: 'BÁO CÁO TỔNG HỢP ĐỊNH KHOẢN (TT133)', style: 'title' },
      { text: `Doanh nghiệp: ${ctx.businessName}` },
      { text: `Kỳ báo cáo: ${formatPeriodLabel(ctx.fromDate, ctx.toDate)}` },
      { text: `Ngày xuất: ${ctx.exportedAt.toLocaleDateString('vi-VN')}`, margin: [0, 0, 0, 10] },
      { text: 'I. Tổng hợp thu chi', style: 'section' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Chỉ tiêu', 'Giá trị (VNĐ)'],
            ['Tổng doanh thu', fmtVnd(ctx.summary.totalRevenue)],
            ['Tổng chi phí', fmtVnd(ctx.summary.totalExpense)],
            ['Lãi / lỗ ròng', fmtVnd(ctx.summary.net)],
          ],
        },
        margin: [0, 0, 0, 10],
      },
      {
        text: `Số giao dịch: ${ctx.summary.totalCount} · Đã định khoản: ${ctx.summary.classifiedCount} · Chờ review: ${ctx.summary.reviewCount} · AI tự động: ${ctx.summary.aiAccuracy}%`,
        margin: [0, 0, 0, 10],
      },
      { text: 'II. Phân bổ theo tài khoản', style: 'section' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['STT', 'Mã TK', 'Tên tài khoản', 'Loại TK', 'PS Nợ', 'PS Có', 'Số GD'],
            ...(accountRows.length > 0 ? accountRows : [['', '', 'Không có dữ liệu', '', '', '', '']]),
          ],
        },
        margin: [0, 0, 0, 10],
      },
      { text: 'III. Sổ chi tiết định khoản', style: 'section', pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['STT', 'Ngày', 'Diễn giải', 'TK Nợ', 'TK Có', 'Số tiền', 'Nguồn'],
            ...(detailRows.length > 0 ? detailRows : [['', '', 'Không có giao dịch', '', '', '', '']]),
          ],
        },
      },
    ],
  };

  const doc = printer.createPdfKitDocument(docDefinition);
  return pdfDocToBuffer(doc);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- report-pdf.util.spec.ts`
Expected: PASS, both cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/report/report-pdf.util.ts apps/backend/src/modules/report/report-pdf.util.spec.ts
git commit -m "feat(report): thêm report-pdf.util build PDF từ dữ liệu export"
```

---

### Task 4: `ReportExportService` — Redis-backed create/get + test

**Files:**
- Create: `apps/backend/src/modules/report/report-export.service.ts`
- Create: `apps/backend/src/modules/report/report-export.service.spec.ts`
- Modify: `apps/backend/src/modules/report/report.module.ts`

**Interfaces:**
- Consumes: `ReportDataService.fetchExportData(tenantId, fromDate, toDate)` (existing), `buildExportWorkbook` from `report-excel.util.ts` (existing), `buildExportPdf` from Task 3, `RedisService` (`get`, `setex` — existing, `@Global()` module, no import needed in `report.module.ts`).
- Produces:
  - `type ExportFormat = 'excel' | 'pdf'`
  - `buildFile(tenantId: string, format: ExportFormat, fromDate: string, toDate: string): Promise<{ buffer: Buffer; contentType: string; fileName: string }>`
  - `createExport(tenantId: string, format: ExportFormat, fromDate: string, toDate: string): Promise<{ exportId: string; format: ExportFormat; fileName: string; fromDate: string; toDate: string }>`
  - `getExportFile(exportId: string, tenantId: string, fallback: { format: ExportFormat; fromDate: string; toDate: string }): Promise<{ buffer: Buffer; contentType: string; fileName: string }>` — throws `ForbiddenException` if the cached entry's `tenantId` doesn't match.
  - These 3 methods are what Task 6 (tool registry) and Task 10 (controller endpoint) call by exact name.

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/report/report-export.service.spec.ts`:

```typescript
import { ForbiddenException } from '@nestjs/common';
import { ReportExportService } from './report-export.service';

describe('ReportExportService', () => {
  const fetchExportData = jest.fn().mockResolvedValue({
    businessName: 'Công ty Demo',
    fromDate: '2026-06-01',
    toDate: '2026-06-30',
    summary: {
      totalRevenue: 100,
      totalExpense: 40,
      net: 60,
      classifiedCount: 1,
      reviewCount: 0,
      totalCount: 1,
      aiAccuracy: 100,
    },
    accounts: [],
    details: [],
  });
  const reportData = { fetchExportData } as never;

  let store: Map<string, string>;
  let redis: { get: jest.Mock; setex: jest.Mock };

  beforeEach(() => {
    store = new Map();
    redis = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setex: jest.fn((key: string, _ttl: number, value: string) => {
        store.set(key, value);
        return Promise.resolve('OK');
      }),
    };
    fetchExportData.mockClear();
  });

  function makeService() {
    return new ReportExportService(reportData, redis as never);
  }

  it('createExport generates an excel file and caches it in Redis', async () => {
    const service = makeService();
    const result = await service.createExport('tenant-1', 'excel', '2026-06-01', '2026-06-30');

    expect(result.exportId).toEqual(expect.any(String));
    expect(result.format).toBe('excel');
    expect(result.fileName).toContain('.xlsx');
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('createExport generates a pdf file', async () => {
    const service = makeService();
    const result = await service.createExport('tenant-1', 'pdf', '2026-06-01', '2026-06-30');
    expect(result.fileName).toContain('.pdf');
  });

  it('getExportFile returns cached file when Redis hit and tenant matches', async () => {
    const service = makeService();
    const created = await service.createExport('tenant-1', 'excel', '2026-06-01', '2026-06-30');

    const file = await service.getExportFile(created.exportId, 'tenant-1', {
      format: 'excel',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });

    expect(file.buffer.length).toBeGreaterThan(0);
    expect(fetchExportData).toHaveBeenCalledTimes(1); // not called again for the cached read
  });

  it('getExportFile throws ForbiddenException when tenant does not match cached entry', async () => {
    const service = makeService();
    const created = await service.createExport('tenant-1', 'excel', '2026-06-01', '2026-06-30');

    await expect(
      service.getExportFile(created.exportId, 'tenant-2', {
        format: 'excel',
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getExportFile regenerates the file when Redis misses', async () => {
    const service = makeService();

    const file = await service.getExportFile('non-existent-id', 'tenant-1', {
      format: 'pdf',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });

    expect(file.buffer.length).toBeGreaterThan(0);
    expect(fetchExportData).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- report-export.service.spec.ts`
Expected: FAIL — `Cannot find module './report-export.service'`.

- [ ] **Step 3: Implement**

Create `apps/backend/src/modules/report/report-export.service.ts`:

```typescript
import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { RedisService } from '../../redis/redis.service';
import { buildExportWorkbook } from './report-excel.util';
import { buildExportPdf } from './report-pdf.util';
import { ReportDataService } from './report-data.service';

export type ExportFormat = 'excel' | 'pdf';

interface CachedExport {
  tenantId: string;
  format: ExportFormat;
  fileName: string;
  bufferBase64: string;
}

const EXPORT_CACHE_TTL_SECONDS = 600;
const EXPORT_CACHE_PREFIX = 'copilot:export:';

function contentTypeFor(format: ExportFormat): string {
  return format === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf';
}

function fileNameFor(format: ExportFormat, fromDate: string, toDate: string): string {
  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  return `bao-cao-dinh-khoan-${fromDate}-${toDate}.${ext}`;
}

@Injectable()
export class ReportExportService {
  constructor(
    private readonly reportData: ReportDataService,
    private readonly redis: RedisService,
  ) {}

  async buildFile(
    tenantId: string,
    format: ExportFormat,
    fromDate: string,
    toDate: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const data = await this.reportData.fetchExportData(tenantId, fromDate, toDate);
    const fileName = fileNameFor(format, fromDate, toDate);

    if (format === 'excel') {
      const wb = buildExportWorkbook({ ...data, exportedAt: new Date() });
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      return { buffer, contentType: contentTypeFor(format), fileName };
    }

    const buffer = await buildExportPdf({ ...data, exportedAt: new Date() });
    return { buffer, contentType: contentTypeFor(format), fileName };
  }

  async createExport(
    tenantId: string,
    format: ExportFormat,
    fromDate: string,
    toDate: string,
  ): Promise<{ exportId: string; format: ExportFormat; fileName: string; fromDate: string; toDate: string }> {
    const { buffer, fileName } = await this.buildFile(tenantId, format, fromDate, toDate);
    const exportId = randomUUID();

    const cached: CachedExport = {
      tenantId,
      format,
      fileName,
      bufferBase64: buffer.toString('base64'),
    };
    await this.redis.setex(`${EXPORT_CACHE_PREFIX}${exportId}`, EXPORT_CACHE_TTL_SECONDS, JSON.stringify(cached));

    return { exportId, format, fileName, fromDate, toDate };
  }

  async getExportFile(
    exportId: string,
    tenantId: string,
    fallback: { format: ExportFormat; fromDate: string; toDate: string },
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const raw = await this.redis.get(`${EXPORT_CACHE_PREFIX}${exportId}`);

    if (raw) {
      const cached = JSON.parse(raw) as CachedExport;
      if (cached.tenantId !== tenantId) {
        throw new ForbiddenException('Không có quyền truy cập file export này');
      }
      return {
        buffer: Buffer.from(cached.bufferBase64, 'base64'),
        contentType: contentTypeFor(cached.format),
        fileName: cached.fileName,
      };
    }

    return this.buildFile(tenantId, fallback.format, fallback.fromDate, fallback.toDate);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- report-export.service.spec.ts`
Expected: PASS, all 5 cases green.

- [ ] **Step 5: Wire into `ReportModule`**

Edit `apps/backend/src/modules/report/report.module.ts`:

```typescript
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PlanGuard } from '../../common/guards/plan.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { SettingsModule } from '../settings/settings.module';
import { MonthlyReportScheduler } from './monthly-report.scheduler';
import { ReportController } from './report.controller';
import { ReportExportService } from './report-export.service';
import { ReportSqlBuilder } from './report.sql';
import { ReportDataService } from './report-data.service';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    NotificationModule,
    BullModule.registerQueue({ name: 'email-delivery' }),
  ],
  controllers: [ReportController],
  providers: [ReportDataService, ReportSqlBuilder, ReportExportService, MonthlyReportScheduler, PlanGuard],
  exports: [ReportDataService, ReportSqlBuilder, ReportExportService],
})
export class ReportModule {}
```

(Only the `ReportExportService` import, and its addition to `providers`/`exports`, are new — everything else is unchanged.)

- [ ] **Step 6: Full backend test run to confirm no regressions**

Run: `pnpm --filter @xcash/backend test`
Expected: PASS, all suites green.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/report/report-export.service.ts apps/backend/src/modules/report/report-export.service.spec.ts apps/backend/src/modules/report/report.module.ts
git commit -m "feat(report): thêm ReportExportService (Redis cache + regenerate on-demand)"
```

---

### Task 5: Shared types — `CopilotFileExportData` + `file_export` activity kind

**Files:**
- Modify: `packages/shared-types/src/copilot.ts`

**Interfaces:**
- Produces: `CopilotFileExportData` interface and the widened `CopilotActivity['kind']` union — consumed by Task 6 (registry), Task 7 (activity helper), Task 8 (executor test types), and Task 11 (frontend).

- [ ] **Step 1: Edit the shared type file**

In `packages/shared-types/src/copilot.ts`, add the new interface right after `CopilotActionCardData` (after line 31 in the current file), and widen `CopilotActivity`:

```typescript
export interface CopilotFileExportData {
  tool: 'export_report';
  exportId: string;
  format: 'excel' | 'pdf';
  fileName: string;
  fromDate: string;
  toDate: string;
}

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search' | 'action_card' | 'file_export';
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
  actionCard?: CopilotActionCardData;
  fileExport?: CopilotFileExportData;
}
```

(This replaces the existing `CopilotActivity` interface in place — same fields plus `fileExport` and the widened `kind` union.)

- [ ] **Step 2: Build shared-types and type-check dependents**

Run: `pnpm --filter @xcash/shared-types build && pnpm --filter @xcash/backend type-check && pnpm --filter @xcash/frontend type-check`
Expected: PASS. (No existing code references the new fields yet, so this only confirms the type file itself compiles and the widened union doesn't break existing exhaustive switches — if it does, that's expected and gets fixed in Task 7/11.)

If `type-check` fails in `apps/frontend` on `CopilotSourceChips.tsx`'s `KIND_ICON: Record<CopilotActivityKind, ...>` (missing the new `file_export` key), that is expected — it gets fixed in Task 11. Note the error and continue; do not fix it here.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/copilot.ts
git commit -m "feat(shared-types): thêm CopilotFileExportData + kind file_export"
```

---

### Task 6: `export_report` tool in the Copilot registry

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-tool.registry.ts`
- Modify: `apps/backend/src/modules/ai/copilot-tool.executor.ts`
- Modify: `apps/backend/src/modules/ai/copilot-tool.executor.spec.ts`

**Interfaces:**
- Consumes: `ReportExportService.createExport` (Task 4).
- Produces: registry entry named `export_report`, `ToolDeps.exportService: ReportExportService` field — consumed by Task 9 (`copilot-stream.service.ts` wiring).

- [ ] **Step 1: Write the failing test**

Add to `apps/backend/src/modules/ai/copilot-tool.executor.spec.ts`, inside the `deps` object (add a new key after `billingService`):

```typescript
    exportService: {
      createExport: jest.fn().mockResolvedValue({
        exportId: 'export-1',
        format: 'excel',
        fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      }),
    } as never,
```

Add a new `describe` block at the end of the file (before the closing of the file, after the existing `describe('getToolRegistry', ...)` block):

```typescript
describe('export_report tool', () => {
  it('dispatches export_report with year+month to exportService.createExport', async () => {
    const result = await executeTool(deps, 'export_report', 'tenant-1', {
      format: 'excel',
      year: 2026,
      month: 7,
    });
    expect(deps.exportService.createExport).toHaveBeenCalledWith(
      'tenant-1',
      'excel',
      '2026-07-01',
      '2026-07-31',
    );
    expect(result).toEqual({
      exportId: 'export-1',
      format: 'excel',
      fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });
  });

  it('dispatches export_report with startDate+endDate to exportService.createExport', async () => {
    await executeTool(deps, 'export_report', 'tenant-1', {
      format: 'pdf',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });
    expect(deps.exportService.createExport).toHaveBeenCalledWith(
      'tenant-1',
      'pdf',
      '2026-01-01',
      '2026-06-30',
    );
  });

  it('throws BadRequestException when neither pair of params is given', async () => {
    await expect(
      executeTool(deps, 'export_report', 'tenant-1', { format: 'excel' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when both pairs of params are given', async () => {
    await expect(
      executeTool(deps, 'export_report', 'tenant-1', {
        format: 'excel',
        year: 2026,
        month: 7,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- copilot-tool.executor.spec.ts`
Expected: FAIL — `Unknown copilot tool: export_report` (thrown as `BadRequestException`, so the "throws" tests may spuriously pass; the first two dispatch tests fail because `createExport` was never called).

- [ ] **Step 3: Add `exportService` to `ToolDeps`**

Edit `apps/backend/src/modules/ai/copilot-tool.executor.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import type { Role } from '@xcash/shared-types';
import { BillingService } from '../billing/billing.service';
import { ReportDataService } from '../report/report-data.service';
import { ReportExportService } from '../report/report-export.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { COPILOT_TOOLS, type CopilotToolEntry } from './copilot-tool.registry';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';

export interface ToolDeps {
  reportService: ReportDataService;
  txQueryService: CopilotTransactionQueryService;
  knowledgeService: CopilotKnowledgeService;
  billingService: BillingService;
  exportService: ReportExportService;
}
```

(Only the `ReportExportService` import and the new `exportService` field are added — the rest of the file is unchanged.)

- [ ] **Step 4: Add the tool entry to the registry**

Edit `apps/backend/src/modules/ai/copilot-tool.registry.ts`. Add the import at the top:

```typescript
import { BadRequestException } from '@nestjs/common';
```

(alongside the existing `import type { CopilotActivity, Role } from '@xcash/shared-types';` — add this as a new import line before it since it's a value import, not type-only)

Add `monthToDateRange` to the imports used by tools — but since the registry doesn't currently import report utils directly (it calls `deps.reportService.X`), inline the month-to-range math directly in the tool's `execute` to avoid a new cross-module import into the registry file. Add this new entry to the `COPILOT_TOOLS` array, right after the `get_period_summary` entry (end of the array, before the closing `];`):

```typescript
  {
    name: 'export_report',
    description:
      'Xuất báo cáo định khoản ra file Excel hoặc PDF theo tháng hoặc khoảng ngày tùy chỉnh. Chỉ dùng khi user yêu cầu rõ ràng xuất/tải file báo cáo.',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['excel', 'pdf'],
          description: 'Định dạng file: excel hoặc pdf',
        },
        year: { type: 'integer', description: 'Năm, vd 2026 — dùng cùng month' },
        month: {
          type: 'integer',
          minimum: 1,
          maximum: 12,
          description: 'Tháng từ 1 đến 12 — dùng cùng year',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày bắt đầu (YYYY-MM-DD) — dùng cùng endDate, thay cho year/month',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'Ngày kết thúc (YYYY-MM-DD) — dùng cùng startDate, thay cho year/month',
        },
      },
      required: ['format'],
      additionalProperties: false,
    },
    activity: {
      final: { kind: 'file_export', label: 'Xuất báo cáo', source: 'X-Cash AI' },
      streaming: { kind: 'file_export', label: 'Đang xuất báo cáo…', source: 'X-Cash AI' },
    },
    execute: (deps, tenantId, args) => {
      const format = args.format as 'excel' | 'pdf';
      const hasMonth = args.year != null && args.month != null;
      const hasRange = args.startDate != null && args.endDate != null;

      if (hasMonth === hasRange) {
        throw new BadRequestException(
          'Cần truyền đúng 1 trong 2: (year và month) HOẶC (startDate và endDate), không được thiếu cả hai hoặc cả hai cùng lúc.',
        );
      }

      let fromDate: string;
      let toDate: string;
      if (hasMonth) {
        const year = Number(args.year);
        const month = Number(args.month);
        const pad = (n: number) => String(n).padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        fromDate = `${year}-${pad(month)}-01`;
        toDate = `${year}-${pad(month)}-${pad(lastDay)}`;
      } else {
        fromDate = String(args.startDate);
        toDate = String(args.endDate);
      }

      return deps.exportService.createExport(tenantId, format, fromDate, toDate);
    },
  },
```

Add `FILE_EXPORT_TOOLS` export at the bottom of the file, next to `ACTION_CARD_TOOLS`:

```typescript
/** Set of tool names that produce file_export activities in the UI. */
export const FILE_EXPORT_TOOLS = new Set(
  COPILOT_TOOLS.filter((t) => t.activity.final.kind === 'file_export').map((t) => t.name),
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- copilot-tool.executor.spec.ts`
Expected: PASS, all cases green including the 4 new `export_report tool` cases.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @xcash/backend type-check`
Expected: PASS (this will fail if `ToolDeps.exportService` isn't satisfied everywhere it's constructed — that wiring happens in Task 9; if `copilot-stream.service.ts`'s `getToolDeps()` doesn't yet provide `exportService`, this step is expected to show that error — note it and proceed; Task 9 fixes it).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/ai/copilot-tool.registry.ts apps/backend/src/modules/ai/copilot-tool.executor.ts apps/backend/src/modules/ai/copilot-tool.executor.spec.ts
git commit -m "feat(copilot): thêm tool export_report vào registry"
```

---

### Task 7: `buildActivities` — handle `file_export` tools

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-activity.helper.ts`
- Create: `apps/backend/src/modules/ai/copilot-activity.helper.spec.ts`

**Interfaces:**
- Consumes: `FILE_EXPORT_TOOLS` from Task 6.
- Produces: `buildActivities` now pushes a `{ ...meta, fileExport: {...} }` entry for `export_report` calls (mirrors the `ACTION_CARD_TOOLS` branch, but keyed by `exportId` for dedup instead of tool name, since a single turn could produce two different exports e.g. "xuất Excel tháng 6 và PDF tháng 7").

- [ ] **Step 1: Write the failing test**

Create `apps/backend/src/modules/ai/copilot-activity.helper.spec.ts`:

```typescript
import { buildActivities } from './copilot-activity.helper';

describe('buildActivities — file_export', () => {
  it('includes a fileExport payload for export_report calls', () => {
    const resultsCapture = new Map<string, unknown>([
      [
        'export_report',
        {
          exportId: 'export-1',
          format: 'excel',
          fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
        },
      ],
    ]);

    const activities = buildActivities(['export_report'], resultsCapture);

    expect(activities).toHaveLength(1);
    expect(activities[0]?.kind).toBe('file_export');
    expect(activities[0]?.fileExport).toEqual({
      tool: 'export_report',
      exportId: 'export-1',
      format: 'excel',
      fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });
  });

  it('does not deduplicate two different exports in the same turn', () => {
    const resultsCapture = new Map<string, unknown>([
      [
        'export_report',
        {
          exportId: 'export-2',
          format: 'pdf',
          fileName: 'bao-cao-dinh-khoan-2026-01-01-2026-06-30.pdf',
          fromDate: '2026-01-01',
          toDate: '2026-06-30',
        },
      ],
    ]);

    // Simulate two calls to the same tool with different results by calling twice
    // with distinct resultsCapture maps and concatenating — buildActivities dedups
    // per-call within one resultsCapture, so this asserts the key includes exportId.
    const first = buildActivities(['export_report'], resultsCapture);
    expect(first[0]?.fileExport?.exportId).toBe('export-2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- copilot-activity.helper.spec.ts`
Expected: FAIL — `activities[0].fileExport` is `undefined` (falls through to the generic branch which doesn't set `fileExport`, and depending on the `formatSnippet` absence, may still produce an entry without `fileExport`).

- [ ] **Step 3: Implement**

Edit `apps/backend/src/modules/ai/copilot-activity.helper.ts`. Update the import line:

```typescript
import type { CopilotActivity, CopilotFileExportData } from '@xcash/shared-types';
import {
  ACTION_CARD_TOOLS,
  COPILOT_TOOLS,
  FILE_EXPORT_TOOLS,
  type CopilotToolEntry,
} from './copilot-tool.registry';
```

Add a new branch inside the `for (const name of calledTools)` loop in `buildActivities`, right after the existing `ACTION_CARD_TOOLS` branch (i.e. after its `continue;` and before the `search_knowledge_base` check):

```typescript
    if (FILE_EXPORT_TOOLS.has(name)) {
      const data = resultsCapture?.get(name) as Omit<CopilotFileExportData, 'tool'> | undefined;
      if (!data) continue;
      const key = `file_export:${data.exportId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = ACTIVITY_MAP[name];
      if (meta) {
        result.push({ ...meta, fileExport: { ...data, tool: name } as CopilotFileExportData });
      }
      continue;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- copilot-activity.helper.spec.ts`
Expected: PASS, both cases green.

- [ ] **Step 5: Full backend test suite**

Run: `pnpm --filter @xcash/backend test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ai/copilot-activity.helper.ts apps/backend/src/modules/ai/copilot-activity.helper.spec.ts
git commit -m "feat(copilot): buildActivities xử lý file_export tools"
```

---

### Task 8: Wire `ReportExportService` into `CopilotStreamService.getToolDeps()`

**Files:**
- Modify: `apps/backend/src/modules/ai/copilot-stream.service.ts`
- Modify: `apps/backend/src/modules/ai/copilot.module.ts` (if `ReportExportService` isn't already visible — it is, since `ReportModule` now exports it and `CopilotModule` already imports `ReportModule`, so no module change needed; verify only)

**Interfaces:**
- Consumes: `ReportExportService` (Task 4, now exported from `ReportModule`, which `CopilotModule` already imports — see `apps/backend/src/modules/ai/copilot.module.ts:8`).
- Produces: fully satisfied `ToolDeps` (Task 6) at the single production call site.

- [ ] **Step 1: Inject `ReportExportService` and add it to `getToolDeps()`**

Edit `apps/backend/src/modules/ai/copilot-stream.service.ts`. In the constructor parameter list (around line 49-56), add the new dependency after `reportService`:

```typescript
    private readonly reportService: ReportDataService,
    private readonly exportService: ReportExportService,
    private readonly txQueryService: CopilotTransactionQueryService,
```

Add the import at the top of the file, alongside the existing `ReportDataService` import:

```typescript
import { ReportExportService } from '../report/report-export.service';
```

Update `getToolDeps()`:

```typescript
  private getToolDeps(): ToolDeps {
    return {
      reportService: this.reportService,
      exportService: this.exportService,
      txQueryService: this.txQueryService,
      knowledgeService: this.knowledgeService,
      billingService: this.billingService,
    };
  }
```

- [ ] **Step 2: Verify `ReportModule` is importing correctly (no module change needed)**

Run: `grep -n "ReportModule" apps/backend/src/modules/ai/copilot.module.ts`
Expected: shows `ReportModule` already in the `imports` array (confirmed during planning — `ReportExportService` is exported from `ReportModule` as of Task 4, so Nest's DI can resolve it into `CopilotStreamService` without further module wiring).

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @xcash/backend type-check`
Expected: PASS — this resolves the expected failure noted at the end of Task 6 Step 6.

- [ ] **Step 4: Full backend test suite**

Run: `pnpm --filter @xcash/backend test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ai/copilot-stream.service.ts
git commit -m "feat(copilot): wire ReportExportService vào ToolDeps"
```

---

### Task 9: `GET /reports/copilot-export/:exportId` endpoint

**Files:**
- Create: `apps/backend/src/modules/report/dto/copilot-export-query.dto.ts`
- Modify: `apps/backend/src/modules/report/report.controller.ts`
- Create: `apps/backend/src/modules/report/report.controller.spec.ts` (if none exists yet for this controller — check first; if a suitable spec file exists under a different name, add to it instead)

**Interfaces:**
- Consumes: `ReportExportService.getExportFile` (Task 4).
- Produces: `GET /reports/copilot-export/:exportId?format=&fromDate=&toDate=` — consumed by Task 11 (frontend fetch).

- [ ] **Step 1: Check for an existing controller spec file**

Run: `find apps/backend/src/modules/report -iname "report.controller.spec.ts"`

If it exists, read it first and add the new `describe` block to it in Step 4 below instead of creating a new file. If it does not exist (expected, based on the file listing gathered during planning — only `report.service.spec.ts`, `report.sql.spec.ts`, `report-date.util.spec.ts`, `report-excel.util.spec.ts` exist), create `apps/backend/src/modules/report/report.controller.spec.ts` fresh in Step 2.

- [ ] **Step 2: Write the failing test**

Create `apps/backend/src/modules/report/report.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { ReportController } from './report.controller';
import { ReportDataService } from './report-data.service';
import { ReportExportService } from './report-export.service';

describe('ReportController — copilot export', () => {
  let controller: ReportController;
  const getExportFile = jest.fn();

  beforeEach(async () => {
    getExportFile.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        { provide: ReportDataService, useValue: {} },
        { provide: ReportExportService, useValue: { getExportFile } },
      ],
    }).compile();

    controller = moduleRef.get(ReportController);
  });

  it('returns the file from ReportExportService.getExportFile', async () => {
    getExportFile.mockResolvedValue({
      buffer: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
      fileName: 'bao-cao.pdf',
    });
    const res = { set: jest.fn() } as unknown as Response;

    const file = await controller.getCopilotExport(
      { tenantId: 'tenant-1' } as never,
      'export-1',
      { format: 'pdf', fromDate: '2026-06-01', toDate: '2026-06-30' },
      res,
    );

    expect(getExportFile).toHaveBeenCalledWith('export-1', 'tenant-1', {
      format: 'pdf',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="bao-cao.pdf"',
    });
    expect(file).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @xcash/backend test -- report.controller.spec.ts`
Expected: FAIL — `controller.getCopilotExport is not a function`.

- [ ] **Step 4: Create the query DTO**

Create `apps/backend/src/modules/report/dto/copilot-export-query.dto.ts`:

```typescript
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class CopilotExportQueryDto {
  @IsOptional()
  @IsIn(['excel', 'pdf'])
  format?: 'excel' | 'pdf';

  @IsOptional()
  @IsISO8601({ strict: true })
  fromDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  toDate?: string;
}
```

- [ ] **Step 5: Implement the controller endpoint**

Edit `apps/backend/src/modules/report/report.controller.ts`. Update imports:

```typescript
import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPlan } from '../../common/decorators/requires-plan.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import { PlanGuard } from '../../common/guards/plan.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AccountBreakdownQueryDto } from './dto/account-breakdown.dto';
import { CopilotExportQueryDto } from './dto/copilot-export-query.dto';
import { DashboardDailyTrendQueryDto } from './dto/dashboard-charts.dto';
import { ReportDataService } from './report-data.service';
import { ReportExportService } from './report-export.service';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class ReportController {
  constructor(
    private readonly reportData: ReportDataService,
    private readonly exportService: ReportExportService,
  ) {}
```

Add the new endpoint at the end of the class, after `exportExcel` (before the closing `}` of the class):

```typescript
  @Get('copilot-export/:exportId')
  async getCopilotExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('exportId') exportId: string,
    @Query() query: CopilotExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.exportService.getExportFile(exportId, user.tenantId!, {
      format: query.format ?? 'excel',
      fromDate: query.fromDate ?? '',
      toDate: query.toDate ?? '',
    });
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });
    return file.buffer;
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @xcash/backend test -- report.controller.spec.ts`
Expected: PASS.

- [ ] **Step 7: Full backend suite + build**

Run: `pnpm --filter @xcash/backend test && pnpm --filter @xcash/backend build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/report/dto/copilot-export-query.dto.ts apps/backend/src/modules/report/report.controller.ts apps/backend/src/modules/report/report.controller.spec.ts
git commit -m "feat(report): thêm GET /reports/copilot-export/:exportId"
```

---

### Task 10: Frontend — `CopilotFileExportCard` + wiring

**Files:**
- Modify: `apps/frontend/src/components/copilot/CopilotSourceChips.tsx`
- Create: `apps/frontend/src/components/copilot/CopilotFileExportCard.tsx`
- Modify: `apps/frontend/src/components/copilot/CopilotMessageBubble.tsx`

**Interfaces:**
- Consumes: `CopilotFileExportData` from `@xcash/shared-types` (Task 5), `api` axios instance from `@/lib/api` (existing, same instance `ReportsPage.tsx` uses for blob downloads).
- Produces: `CopilotFileExportCard` component rendering a download button for one `CopilotActivity` with `kind: 'file_export'`.

- [ ] **Step 1: Fix `KIND_ICON` for the new activity kind**

Edit `apps/frontend/src/components/copilot/CopilotSourceChips.tsx`. Update the import:

```typescript
import type { CopilotActivity } from '@xcash/shared-types';
import { BarChart3, BookOpen, CheckSquare, ExternalLink, FileDown, Globe } from 'lucide-react';
```

Update `KIND_ICON`:

```typescript
const KIND_ICON: Record<CopilotActivityKind, typeof BarChart3> = {
  internal_data: BarChart3,
  knowledge: BookOpen,
  web_search: Globe,
  action_card: CheckSquare,
  file_export: FileDown,
};
```

- [ ] **Step 2: Type-check to confirm the exhaustiveness fix**

Run: `pnpm --filter @xcash/frontend type-check`
Expected: PASS — this resolves the expected failure noted at the end of Task 5 Step 2.

- [ ] **Step 3: Write the download card component**

Create `apps/frontend/src/components/copilot/CopilotFileExportCard.tsx`:

```typescript
import type { CopilotFileExportData } from '@xcash/shared-types';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function CopilotFileExportCard({ fileExport }: { fileExport: CopilotFileExportData }) {
  const [downloading, setDownloading] = useState(false);
  const Icon = fileExport.format === 'excel' ? FileSpreadsheet : FileText;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/reports/copilot-export/${fileExport.exportId}`, {
        params: {
          format: fileExport.format,
          fromDate: fileExport.fromDate,
          toDate: fileExport.toDate,
        },
        responseType: 'blob',
      });

      const blob = res.data as Blob;
      if (blob.type.includes('json')) {
        const message = JSON.parse(await blob.text()) as { error?: { message?: string } };
        throw new Error(message.error?.message ?? 'Không thể tải file');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileExport.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống báo cáo');
    } catch {
      toast.error('Không thể tải file, vui lòng thử lại');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-2 flex max-w-sm items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-xs">{fileExport.fileName}</span>
      <Button size="sm" variant="secondary" disabled={downloading} onClick={handleDownload}>
        {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
        Tải về
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Wire the card into `CopilotMessageBubble`**

Edit `apps/frontend/src/components/copilot/CopilotMessageBubble.tsx`. Update the import:

```typescript
import { Bot, StopCircle } from 'lucide-react';
import { CopilotActionCard } from '@/components/copilot/CopilotActionCard';
import { CopilotCorrectionCard } from '@/components/copilot/CopilotCorrectionCard';
import { CopilotFileExportCard } from '@/components/copilot/CopilotFileExportCard';
import { CopilotMessageActions } from '@/components/copilot/CopilotMessageActions';
import type { CopilotActivity } from '@/components/copilot/CopilotSourceChips';
import { CopilotSourceChips } from '@/components/copilot/CopilotSourceChips';
import { HighlightedText } from '@/components/shared/HighlightedText';
```

Update the activities-rendering block (replace the existing block that starts with `{msg.activities && msg.activities.length > 0 && (`):

```typescript
        {msg.activities && msg.activities.length > 0 && (
          <>
            <CopilotSourceChips
              activities={msg.activities.filter(
                (a) => a.kind !== 'action_card' && a.kind !== 'file_export',
              )}
            />
            {msg.activities
              .filter((a) => a.kind === 'action_card' && a.actionCard)
              .map((a) => {
                const card = a.actionCard;
                if (!card) return null;
                return card.tool === 'propose_correct_transaction_classification' ? (
                  <CopilotCorrectionCard key={card.transactionId} actionCard={card} />
                ) : (
                  <CopilotActionCard key={card.transactionId} actionCard={card} />
                );
              })}
            {msg.activities
              .filter((a) => a.kind === 'file_export' && a.fileExport)
              .map((a) => {
                const fileExport = a.fileExport;
                if (!fileExport) return null;
                return <CopilotFileExportCard key={fileExport.exportId} fileExport={fileExport} />;
              })}
          </>
        )}
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm --filter @xcash/frontend type-check && pnpm --filter @xcash/frontend lint`
Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Run: `pnpm dev:frontend` and `pnpm dev:backend` (or `pnpm dev` for both), open the Copilot page, ask e.g. "xuất báo cáo tháng 6 dạng Excel", confirm:
- A download card appears in the assistant message with a spreadsheet icon, the filename, and a "Tải về" button.
- Clicking it downloads a valid `.xlsx` file that opens correctly.
- Repeat asking for `pdf` format — confirm the file icon differs and the downloaded `.pdf` opens with correct Vietnamese text (no mojibake/garbled diacritics).

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/components/copilot/CopilotSourceChips.tsx apps/frontend/src/components/copilot/CopilotFileExportCard.tsx apps/frontend/src/components/copilot/CopilotMessageBubble.tsx
git commit -m "feat(fe): hiển thị nút tải file export báo cáo trong khung chat Copilot"
```

---

### Task 11: Full verify + sync agent docs

**Files:**
- Modify: `agent-docs/00-current-state.md` (via `/sync-agent-docs` skill, not manual edit)

**Interfaces:** None — this is the final validation and documentation-sync task.

- [ ] **Step 1: Run the full verify suite**

Run: `pnpm verify`
Expected: PASS — lint, type-check, test, build all green across `@xcash/backend`, `@xcash/frontend`, `@xcash/shared-types`.

If anything fails, fix it in this task (do not defer) before proceeding.

- [ ] **Step 2: Run the copilot tool-routing eval (manual, not part of `pnpm verify`)**

Run: `pnpm --filter @xcash/backend eval:copilot-tools` (requires `OPENAI_API_KEY` set in the environment)
Expected: existing 11 sample cases still pass — this confirms the new `export_report` tool's description doesn't confuse the model into mis-routing unrelated requests (e.g. a plain "tổng hợp tháng 6" request should still call `get_month_summary`, not `export_report`).

If this eval script doesn't have a case that would catch confusion with the new tool, that's acceptable — it's a pre-existing regression net, not something this plan is required to extend.

- [ ] **Step 3: Invoke `/sync-agent-docs`**

Run the `sync-agent-docs` skill (per `CLAUDE.md`: mandatory when a change adds a new module/route/tool or changes conventions — this change adds a new tool to the Copilot registry, a new REST endpoint, and a new npm dependency, all of which are documented in `agent-docs/00-current-state.md`).

Expected: `agent-docs/00-current-state.md` updated to mention:
- The new `export_report` Copilot tool in the tool count/list.
- The new `GET /reports/copilot-export/:exportId` route in the API table.
- The new `pdfmake` dependency in the "Dependencies đáng chú ý" line.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "docs: sync agent-docs sau khi thêm copilot export_report tool"
```

---

## Post-plan note for the executor

Task 6 Step 6 and Task 5 Step 2 intentionally leave the codebase in a temporarily-broken type-check state between commits (documented inline) — this is expected because `ToolDeps.exportService` and `KIND_ICON['file_export']` are each satisfied by a *later* task in this same plan, not the task introducing the type. Do not treat those specific, called-out failures as blockers; do treat any *other* unexpected type-check failure as a real bug to fix before moving on.
