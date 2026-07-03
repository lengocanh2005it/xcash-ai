# Backend Conventions — `apps/backend` (NestJS)

Kiến trúc: **Monolithic Modular** (1 NestJS app, nhiều module độc lập theo domain), giao tiếp qua Service Layer. Xem lý do chọn kiến trúc này tại [`reference/business-overview.md`](./reference/business-overview.md#-system-architecture).

## Cấu trúc module chuẩn

Mỗi domain là 1 thư mục dưới `apps/backend/src/modules/<domain>/`, đầy đủ các phần sau (không bắt buộc có hết nếu domain không cần, nhưng khi có phải đặt đúng chỗ):

```
src/modules/<domain>/
├── <domain>.module.ts
├── <domain>.controller.ts
├── <domain>.service.ts
├── dto/
│   ├── create-<domain>.dto.ts
│   └── update-<domain>.dto.ts
├── entities/
│   └── <domain>.entity.ts        # nếu cần type riêng ngoài Prisma model
└── <domain>.controller.spec.ts / <domain>.service.spec.ts
```

## Danh sách module (X-Cash AI)

```
src/modules/
├── auth/                 # register, login, refresh, logout — JWT
├── onboarding/           # Cas Link Grant/Exchange flow
├── banking/              # webhook Cas Balance Hook, cas_grants
├── transaction/          # CRUD giao dịch
├── classification/       # Human Review queue + định khoản
├── chart-of-accounts/    # danh mục TT133
├── report/               # báo cáo thu/chi, export Excel
├── ai/                   # AI Classification pipeline (BullMQ ai-classify)
├── cas/                  # CasClientService
├── health/               # health check
└── partner/              # route /partner/*, chỉ Cas Partner (Sprint 4+)
```

Các module dự kiến Sprint 3+: `settings`, `team`, `billing`, `notification`, `audit-log`, `analytics`.

`src/common/` chứa cross-cutting concerns dùng chung mọi module:

```
src/common/
├── decorators/
│   └── roles.decorator.ts        # @Roles(Role.ADMIN, ...)
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts             # cho route nghiệp vụ thường
│   └── partner.guard.ts           # RIÊNG cho /partner/*, check tenant_id === null
├── filters/
│   └── all-exceptions.filter.ts   # Global Exception Filter
├── interceptors/
│   └── response.interceptor.ts    # bọc response theo format chuẩn (xem bên dưới)
└── enums/                          # KHÔNG tự định nghĩa lại — import từ @xcash/shared-types
```

## Nguồn sự thật cho từng phần

| Cần biết gì | Đọc file nào |
|---|---|
| Endpoint nào, method nào, query param gì | [`reference/business-overview.md`](./reference/business-overview.md#-api-design) mục API Design |
| Role nào được gọi endpoint nào | [`reference/rbac.md`](./reference/rbac.md#-ma-trận-phân-quyền-đầy-đủ-cấp-tenant) |
| Bảng nào có cột gì, FK gì, cần index gì | [`reference/database-schema.md`](./reference/database-schema.md) — **dùng file này**, không dùng bảng rút gọn trong `business-overview.md` |
| Cas Grant/Exchange flow, webhook payload | [`reference/business-overview.md`](./reference/business-overview.md#2-liên-kết-ngân-hàng-qua-cas-link-trong-bước-onboarding) |
| Cách tính quota, flow PayOS billing | [`reference/rbac.md`](./reference/rbac.md) |

## RBAC — bắt buộc mọi controller nghiệp vụ

```typescript
import { Role } from '@xcash/shared-types';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  @Get()
  findAll() { ... }                        // không @Roles() = mọi role đã login đều gọi được

  @Post()
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  create() { ... }
}
```

Quy tắc bắt buộc khi thêm endpoint mới (đối chiếu checklist trong `reference/rbac.md`):
1. Xác định endpoint thuộc nhóm nào trong ma trận phân quyền.
2. Gắn `@UseGuards(JwtAuthGuard, RolesGuard)`.
3. Gắn `@Roles(...)` đúng role — không gắn nghĩa là mọi role đã đăng nhập đều vào được (kể cả Viewer).
4. **Không bao giờ** để `PartnerController` dùng `RolesGuard` thường — chỉ dùng `PartnerGuard` riêng, và ngược lại controller nghiệp vụ không bao giờ cho `cas_partner` lọt qua.

```typescript
// PartnerGuard — check khác hẳn RolesGuard thông thường
@Injectable()
export class PartnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user.role === Role.CAS_PARTNER && user.tenantId === null;
  }
}
```

## Multi-tenant — mọi query nghiệp vụ phải scope theo `tenant_id`

Trừ route `/partner/*`, mọi service method thao tác data nghiệp vụ (transaction, classification, chart-of-accounts...) phải nhận `tenantId` (lấy từ `request.user.tenantId`, không bao giờ từ body/param client gửi lên) và luôn `WHERE tenant_id = :tenantId`. Đây là điểm rủi ro bảo mật lớn nhất của hệ thống multi-tenant — xem rủi ro "RBAC cấu hình sai khiến lộ dữ liệu giữa các tenant" trong `reference/sprint-plan.md`.

## Webhook Cas Balance Hook — thứ tự xử lý bắt buộc

Xem code mẫu đầy đủ tại [`reference/rbac.md`](./reference/rbac.md#implementation-mẫu-nestjs). Thứ tự **không được đảo**:

```
1. Verify signature (HMAC-SHA256 + timestamp chống replay)
2. Idempotency check qua Redis (key = transaction.id từ payload, TTL 24h)
3. Query cas_grants WHERE grant_id = payload.grantId → tenant_id
4. Check quota (subscriptions.transaction_used_this_cycle vs transaction_quota)
5. Lưu transaction
6. transaction_used_this_cycle += 1 NGAY (không đợi AI Classification)
7. Enqueue BullMQ job `ai-classify`
```

Idempotency luôn chạy **trước** bước đếm quota — nếu không, Cas retry webhook sẽ đếm quota 2 lần cho cùng 1 giao dịch.

## Build & dev

- **`nest build`** / **`nest start --watch`** (`pnpm dev:backend`) dùng **SWC** — cấu hình `nest-cli.json` (`builder: "swc"`) + `.swcrc` (`legacyDecorator`, `decoratorMetadata` bắt buộc cho DI; `module.type: commonjs` để `node dist/main` / `start:prod` chạy được).
- **Type-check** vẫn chạy `tsc --noEmit` riêng trong `pnpm verify` / `pnpm type-check` — không gộp vào SWC (`typeCheck: false` trong nest-cli) để tránh chậm lại lúc dev watch.

## Response format chuẩn (toàn bộ endpoint)

```json
{
  "success": true,
  "data": {},
  "meta": { "timestamp": "...", "request_id": "...", "page": 1, "limit": 20, "total": 150 },
  "error": null
}
```

Dùng type `ApiResponse<T>` từ `@xcash/shared-types`, bọc qua 1 global `ResponseInterceptor` — không tự format tay trong từng controller.

## AI Module — quy tắc riêng

- Toàn bộ gọi OpenAI đi qua 1 service dùng chung (`OpenAiService`) trong `src/modules/ai/`, không gọi trực tiếp SDK OpenAI rải rác ở module khác.
- Confidence threshold mặc định **85%**, đọc từ `tenants.classification_threshold` (per-tenant, không hardcode).
- Job BullMQ tên `ai-classify` — output lưu vào `transaction_classifications`.

## Lint gotcha — không để `useImportType` bật cho backend

Biome rule `useImportType` tự đổi `import { AppService }` thành `import type { AppService }` khi thấy class chỉ xuất hiện ở vị trí type — nhưng NestJS Dependency Injection (constructor parameter property) cần import runtime thật để `reflect-metadata` hoạt động, nếu không Nest báo lỗi `Nest can't resolve dependencies` dù code "nhìn đúng". Rule này đã tắt cho `apps/backend/**` trong `biome.json` (mục `overrides`) — không bật lại, và cẩn thận khi copy code có `import type { XService }` từ nơi khác vào 1 provider/controller.

## Prisma

Schema thật viết theo đúng `reference/database-schema.md`, đặc biệt đọc kỹ mục "Những điểm cần lưu ý khi viết Prisma schema thật" ở cuối file đó trước khi migrate lần đầu — có 5 điểm bắt buộc (index, soft delete, pgvector extension, encrypted field, cascade behavior).

## Testing

- Unit test theo chuẩn NestJS/Jest, đặt cạnh file test (`*.spec.ts`), `pnpm --filter @xcash/backend test`.
- Integration test cho webhook flow là **bắt buộc** trước khi coi module `banking` là xong (idempotency + quota + tenant resolution là 3 nhánh phải test riêng).
