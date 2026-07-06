# Migration: AI Copilot — Prompt stuffing → OpenAI Function Calling (`runTools`)

> **Trạng thái:** Spec triển khai — chưa code  
> **Phạm vi:** Backend Copilot (`POST /api/v1/ai/copilot`) dùng OpenAI Node SDK `chat.completions.runTools()`  
> **Không đổi:** Contract API FE, luồng AI classify GD (`ai-classify` job), Prisma schema  
> **SDK hiện có:** `openai@^6.45.0` — đã xác nhận `client.chat.completions.runTools` tồn tại

---

## 1. Vì sao migrate

### 1.1 Kiến trúc hiện tại (trước migrate)

```
CopilotPage (FE)
  → POST /ai/copilot { message, history }
  → CopilotController
  → CopilotContextService.getFinancialContext(tenantId)
       → Redis cache copilot:context:{tenantId}:{year}-{month}
       → ReportService.getSummary(tháng hiện tại)
       → formatFinancialContext() → string dài
  → OpenAiService.chatCopilot(message, history, financialContext)
       → 1 lần chat.completions.create (không tools)
       → system prompt = persona + financialContext cố định
  → { reply: string }
```

**Hạn chế:**

| Vấn đề | Mô tả |
|--------|--------|
| Context cố định | Luôn preload **tháng hiện tại** — user hỏi "tháng 3" vẫn chỉ có số tháng này trong prompt |
| Token lãng phí | Mỗi turn gửi lại block summary dù câu hỏi không cần số liệu |
| Không tra TK động | Không gọi `chart_of_accounts` khi user hỏi "TK 642 là gì" |
| Không so sánh tháng | `getComparison` có sẵn nhưng Copilot không dùng |
| Không phải agent | Model không quyết định **khi nào** cần data — chỉ đọc text đã nhét |
| Câu hỏi Casso / Cas Link | Không biết tenant đã liên kết NH chưa, không phân biệt lỗi tích hợp vs câu hỏi sản phẩm Casso — model **đoán** |

### 1.2 Kiến trúc mục tiêu (sau migrate)

```
CopilotPage (FE) — KHÔNG ĐỔI contract
  → POST /ai/copilot
  → CopilotController
  → OpenAiService.chatCopilotWithTools(tenantId, message, history)
       → client.chat.completions.runTools({ tools, messages, ... })
       → SDK tự loop: model gọi tool → handler NestJS → tool result → model trả lời
  → CopilotToolService.execute(tenantId, toolName, args)
       → ReportService / OnboardingService / Prisma / FAQ tĩnh (luôn scope tenantId từ JWT)
  → { reply: string }
```

**Lợi ích:**

- Câu hỏi "doanh thu tháng 5" → model gọi `get_month_summary(2026, 5)`  
- Câu hỏi "đã liên kết ngân hàng chưa?" → `get_banking_status` + FAQ Cas Link  
- Câu hỏi xã giao → không gọi tool, trả lời trực tiếp  
- Giảm token system prompt (bỏ preload summary cố định)  
- Dùng đúng API **function calling / tools** của OpenAI qua helper SDK  

### 1.3 Phạm vi KHÔNG migrate trong đợt này

| Thành phần | Lý do |
|------------|--------|
| **AI classify GD** | Latency nhạy; few-shot + JSON mode đủ; validate TK sau parse (phase riêng) |
| **FE Copilot streaming** | Optional phase 2 — `runTools` hỗ trợ event stream nhưng FE chưa consume |
| **Responses API** | Giữ Chat Completions + `runTools` — đã có trong SDK, ít đổi nhất |
| **`zodFunction`** | Optional — cần thêm dependency `zod` (hiện chưa có trong monorepo) |
| **Web search Casso** | Phase 3 optional — Phase 1b dùng FAQ tĩnh + `get_banking_status` |

---

## 2. OpenAI SDK — cơ chế `runTools`

Repo đã cài `openai@^6.45.0`. Helper chính:

```typescript
const runner = client.chat.completions.runTools(
  {
    model: 'gpt-4o-mini',
    messages: [...],
    tools: [ /* định nghĩa function + handler */ ],
    tool_choice: 'auto',
  },
  {
    maxChatCompletions: 5, // giới hạn vòng tool (mặc định SDK = 10)
  },
);

const reply = await runner.finalContent();
```

**SDK tự làm:**

1. Gửi request có `tools`  
2. Nếu response có `tool_calls` → parse arguments → gọi `function` handler đã gắn trong tool definition  
3. Append `role: tool` messages → gọi lại API  
4. Lặp đến khi model trả text hoặc đạt `maxChatCompletions`  

**Không cần** tự viết vòng `while (tool_calls)`.

### 2.1 Hai style định nghĩa tool

#### A. Plain JSON Schema + handler (khuyến nghị — không thêm dependency)

```typescript
{
  type: 'function',
  function: {
    name: 'get_month_summary',
    description: '...',
    strict: true,
    parameters: {
      type: 'object',
      properties: { year: { type: 'integer' }, month: { type: 'integer' } },
      required: ['year', 'month'],
      additionalProperties: false,
    },
    function: async (args: { year: number; month: number }) => { /* ... */ },
    parse: JSON.parse,
  },
}
```

#### B. `zodFunction` từ `openai/helpers/zod` (phase optional)

- Cần `pnpm add zod --filter @xcash/backend`  
- SDK hiện resolve `zod/v4` — kiểm tra version tương thích khi cài  
- Lợi: validate args type-safe; SDK set `strict: true` tự động  

### 2.2 Tham số `runTools` quan trọng

| Option | Ý nghĩa | Gợi ý X-Cash |
|--------|---------|--------------|
| `maxChatCompletions` | Số lần gọi API tối đa trong 1 user message | `5` |
| `parallel_tool_calls` | Model gọi nhiều tool song song | `true` (mặc định) — OK cho `get_month_summary` + `get_review_queue_count` |
| `tool_choice: 'auto'` | Model tự chọn | Mặc định Copilot |
| `temperature` | | `0.3` (số liệu) thay vì `0.7` hiện tại |
| `max_tokens` | Per completion | `500` (giữ như hiện tại) |

### 2.3 Event hooks (debug / logging)

```typescript
runner
  .on('functionToolCall', (call) => logger.debug(`Tool: ${call.name}`))
  .on('message', (msg) => { /* audit optional */ });
```

---

## 3. Danh sách tools (Phase 1a + 1b)

Mọi tool **bắt buộc** nhận `tenantId` từ closure factory — **không** để model truyền `tenantId` trong arguments.

### 3.1 `get_month_summary`

| | |
|--|--|
| **Mô tả** | Tổng hợp thu/chi/lãi-lỗ/stats tháng theo `transactionDate` |
| **Backend** | `ReportService.getSummary(tenantId, year, month)` |
| **Plan** | Starter+ (giống Copilot hiện tại) |
| **Cache** | Redis `copilot:tool:summary:{tenantId}:{year}-{month}` TTL = `COPILOT_CONTEXT_CACHE_TTL_SECONDS` (300s) |

**JSON Schema:**

```json
{
  "type": "object",
  "properties": {
    "year": { "type": "integer", "description": "Năm, vd 2026" },
    "month": { "type": "integer", "minimum": 1, "maximum": 12 }
  },
  "required": ["year", "month"],
  "additionalProperties": false
}
```

**Response shape** (trả về model dạng JSON string):

```typescript
{
  period: { year, month },
  summary: { totalRevenue, totalExpense, net },
  stats: { totalCount, classifiedCount, reviewCount, aiAccuracy },
}
```

**Ghi chú metric:** `aiAccuracy` = `classifiedCount / totalCount` — cùng định nghĩa Báo cáo (`agent-docs/00-current-state.md`).

### 3.2 `get_month_comparison`

| | |
|--|--|
| **Mô tả** | So sánh tháng chỉ định với tháng trước (% thay đổi thu/chi/lãi-lỗ/accuracy) |
| **Backend** | `ReportService.getComparison(tenantId, year, month)` |
| **Plan** | Starter+ (`@RequiresPlan` trên endpoint comparison hiện có) |

**Parameters:** giống `get_month_summary`.

### 3.3 `get_top_accounts`

| | |
|--|--|
| **Mô tả** | Top TK chi / thu nhiều nhất trong tháng |
| **Backend** | `ReportService.getTopAccounts(tenantId, year, month, limit)` |
| **Plan** | Starter+ |

**Parameters:**

```json
{
  "year": "integer",
  "month": "integer (1-12)",
  "limit": "integer (default 5, max 10)"
}
```

### 3.4 `get_review_queue_count`

| | |
|--|--|
| **Mô tả** | Số GD đang `status = review` **toàn tenant** (không filter tháng — khớp `GET /review/count`) |
| **Backend** | Query Prisma trực tiếp trong `CopilotToolService` **hoặc** delegate `ClassificationService.getReviewCount` |
| **Lưu ý circular dep** | `classification` module import `AiModule` — **tránh** `AiModule` import `ClassificationModule`. Dùng `PrismaService` count trong `CopilotToolService` |

```typescript
await prisma.transactionClassification.count({
  where: { tenantId, status: 'review' },
});
```

### 3.5 `lookup_chart_account`

| | |
|--|--|
| **Mô tả** | Tra tên + `accountType` TK trong danh mục TT133 của tenant |
| **Backend** | `prisma.chartOfAccount.findFirst({ where: { tenantId, accountCode } })` |

**Parameters:**

```json
{ "accountCode": "string — mã TK, vd 642" }
```

### 3.6 `get_banking_status` (Phase 1b — Casso / Cas Link)

Trả lời câu hỏi *"Đã liên kết ngân hàng chưa?"*, *"Sao không thấy giao dịch từ ngân hàng?"* bằng **dữ liệu thật của tenant**, không crawl `casso.vn`.

| | |
|--|--|
| **Mô tả** | Trạng thái Cas Link + tài khoản đã liên kết + gợi ý chẩn đoán mất GD |
| **Backend chính** | `OnboardingService.getStatus(tenantId)` — đã có `bankingLinked`, `grants[]` |
| **Bổ sung** | `CopilotToolService` query thêm Prisma (cùng tenant): GD `source=cas` gần nhất, đếm GD cas 7 ngày |
| **Plan** | Starter+ (mọi role tenant có Copilot) |
| **Cache** | Redis `copilot:tool:banking:{tenantId}` TTL **60s** (trạng thái có thể đổi sau khi user vừa link) |
| **Module** | `AiModule` import `OnboardingModule` (export `OnboardingService`) — **không** import `BankingModule` |

**Parameters:** `{}` — không argument (tenant từ JWT).

**Response shape (gợi ý):**

```typescript
{
  bankingLinked: boolean;
  grants: Array<{
    bankName: string | null;
    accountNumber: string | null; // che 4 số cuối khi trả model nếu cần — xem mục 5
    linkedAt: string;
    status: string;
  }>;
  recentCasActivity: {
    lastTransactionAt: string | null; // transactionDate GD cas mới nhất
    countLast7Days: number;
  };
  uiHints: {
    settingsBankingPath: '/settings'; // tab Ngân hàng
    onboardingPath: '/onboarding';
  };
}
```

**System prompt — khi nào gọi:**

- User nhắc **Casso, Cas Link, liên kết ngân hàng, webhook, mất giao dịch, không nhận GD** → gọi `get_banking_status` **trước**, kết hợp `get_cas_integration_help` nếu cần hướng dẫn bước.

**Không trả về:** `accessToken`, `grantId` đầy đủ trong reply user-facing (chỉ metadata an toàn).

### 3.7 `get_cas_integration_help` (Phase 1b — FAQ tĩnh)

Kiến thức **curated** về tích hợp X-Cash ↔ Casso — thay cho web search live trong phase đầu.

| | |
|--|--|
| **Mô tả** | FAQ ngắn: Cas Link là gì, luồng nhận GD, phân biệt X-Cash vs Casso |
| **Backend** | File tĩnh `apps/backend/src/modules/ai/copilot-cas-faq.ts` — **không** HTTP ra ngoài |
| **Plan** | Starter+ |

**Parameters:**

```json
{
  "topic": {
    "type": "string",
    "enum": ["overview", "how_to_link", "missing_transactions", "webhook_explained"],
    "description": "overview = tổng quan; how_to_link = cách liên kết; missing_transactions = không thấy GD; webhook_explained = webhook Cas Balance Hook"
  }
}
```

`required: ["topic"]`, `additionalProperties: false`, `strict: true`.

**Nội dung FAQ (nguyên văn đưa vào code — rút gọn spec):**

| `topic` | Nội dung chính |
|---------|----------------|
| `overview` | X-Cash nhận GD qua **Cas Balance Hook** (webhook Casso). Mỗi DN liên kết NH qua **Cas Link** (Settings → Ngân hàng). Casso là đối tác banking; X-Cash là lớp định khoản AI + báo cáo. |
| `how_to_link` | Admin vào **Cài đặt → Ngân hàng** → Liên kết → hoàn tất Cas Link → hệ thống lưu `cas_grants`. Onboarding: `/onboarding`. |
| `missing_transactions` | Kiểm tra: (1) `bankingLinked`? (2) GD có trên sao kê NH nhưng chưa vào X-Cash → Casso có thể chưa push — xem lại liên kết; (3) GD **Import Excel** không qua Casso; (4) subscription suspended / quota. Gợi ý xem **Giao dịch** + filter nguồn **Ngân hàng**. |
| `webhook_explained` | Một URL webhook chung app; routing tenant qua `grantId` trong payload — **không** cấu hình webhook per-tenant. Idempotency Redis theo `transaction.id`. |

### 3.8 Tools Phase 2 — dữ liệu tài chính (không chặn Phase 1)

| Tool | Backend | Ghi chú |
|------|---------|---------|
| `search_transactions` | `TransactionService` list + filter | `limit ≤ 20`; filter `source=cas` khi user hỏi GD ngân hàng |
| `get_account_breakdown` | `ReportService.getAccountBreakdown` | Phân trang — trả page 1 mặc định |
| `list_chart_accounts` | `chart-of-accounts` | Filter `accountType`, search |

### 3.9 Tools Phase 3 — tùy chọn (sau khi 1b ổn định)

| Tool | Mô tả | Khuyến nghị |
|------|--------|--------------|
| `search_product_help` | RAG trên `agent-docs/reference/` nội bộ (user-journey, business-overview) | **Làm trước** web search Casso |
| `search_casso_public` | Tìm `site:casso.vn` (Bing/Google CSE hoặc fetch URL allowlist) | Chỉ câu **sản phẩm Casso** (bank hỗ trợ, giá) — xem mục 3A |

---

## 3A. Casso / Cas Link — phân loại câu hỏi & web search

User nhắc "Casso" có thể muốn **3 thứ khác nhau**. Copilot phải **routing đúng** trước khi trả lời.

```
                    User hỏi về "Casso"
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   Tích hợp X-Cash      Hướng dẫn thao tác    Sản phẩm Casso
   (trạng thái DN)      (Cas Link steps)      (bank list, giá...)
          │                   │                   │
          ▼                   ▼                   ▼
 get_banking_status    get_cas_integration_help   Phase 3:
 + optional            (FAQ tĩnh)                 search_casso_public
 search_transactions                             HOẶC trả link casso.vn
 (source=cas)
```

### 3A.1 Ưu tiên: tool nội bộ, không web search

| Lý do | Chi tiết |
|-------|----------|
| Đúng ngữ cảnh | 80% câu trong app là *"sao tôi không thấy GD"* — cần `cas_grants` + GD cas, không cần docs Casso |
| Tin cậy | FAQ + DB do X-Cash kiểm soát; web Casso dễ lỗi thời |
| Latency / cost | Không thêm round-trip search |
| Bảo mật | Không leak tenant; không scrape partner site chưa rõ policy |

### 3A.2 Khi nào mới cân nhắc web search `casso.vn`

| Điều kiện | Ví dụ câu hỏi |
|-----------|----------------|
| Không có trong FAQ + không có trong DB tenant | "Casso hỗ trợ ngân hàng X chưa?" |
| User hỏi rõ **sản phẩm Casso**, không phải X-Cash | "Phí dịch vụ Casso", "Casso là gì" (marketing) |

**Nếu implement Phase 3 `search_casso_public`:**

| Quy tắc | Chi tiết |
|---------|----------|
| Allowlist domain | `casso.vn`, `www.casso.vn`, subdomain docs nếu có — **không** search toàn web |
| Cache | Redis 24h theo query hash |
| Disclaimer trong reply | *"Theo thông tin công khai trên website Casso; chi tiết tích hợp trong X-Cash xem Cài đặt → Ngân hàng."* |
| Plan gating | Có thể giữ Starter+ hoặc chỉ Admin — tránh abuse API search |
| Env | `COPILOT_CASSO_SEARCH_ENABLED=0` mặc định tắt |
| **Không** dùng | OpenAI built-in browsing tự do — khó kiểm soát domain |

### 3A.3 Câu trả lời mẫu (sau tools)

**Chưa link NH:**

> Bạn **chưa liên kết ngân hàng** qua Cas Link. Vào **Cài đặt → Ngân hàng** để liên kết — sau đó giao dịch từ Casso sẽ tự vào X-Cash để AI định khoản.

**Đã link, không thấy GD mới:**

> Đã liên kết **{bankName}** (từ {linkedAt}). GD ngân hàng gần nhất: **{date hoặc "chưa có"}**. Nếu sao kê có GD mà đây không có, thử làm mới trang Giao dịch hoặc kiểm tra lại liên kết Casso.

**Hỏi giá Casso / bank Casso hỗ trợ (Phase 3 hoặc fallback):**

> Về sản phẩm **Casso** (ngân hàng hỗ trợ, bảng giá), bạn xem [casso.vn](https://casso.vn). Trong **X-Cash AI**, mình giúp bạn kiểm tra liên kết và giao dịch đã nhận — bạn muốn xem trạng thái liên kết không?

### 3A.4 Phân biệt thuật ngữ (ghi trong system prompt)

| Thuật ngữ | Trong X-Cash |
|-----------|--------------|
| **Casso / Cas** | Đối tác banking — Cas Link + Balance Hook |
| **Cas Link** | Luồng OAuth user liên kết TK NH → lưu `cas_grants` |
| **Webhook Cas** | `POST /api/v1/webhook/cas` — nhận GD real-time (1 URL app, route `grantId`) |
| **GD nguồn Ngân hàng** | `transactions.source = cas` — khác Import Excel |

---

## 4. Thay đổi code — file by file

### 4.1 File mới

```
apps/backend/src/modules/ai/
├── copilot-tool.service.ts       # execute(tenantId, name, args) + cache Redis
├── copilot-tools.factory.ts      # buildCopilotTools(tenantId, toolService) → Tool[]
├── copilot-cas-faq.ts            # FAQ tĩnh cho get_cas_integration_help
└── copilot-tool.types.ts         # (optional) tên tool + arg types
```

#### `copilot-tool.service.ts` (khung)

```typescript
@Injectable()
export class CopilotToolService {
  constructor(
    private readonly reportService: ReportService,
    private readonly onboardingService: OnboardingService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getMonthSummary(tenantId: string, year: number, month: number) {
    const cacheKey = `copilot:tool:summary:${tenantId}:${year}-${month}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const data = await this.reportService.getSummary(tenantId, year, month);
    const ttl = this.config.get<number>('COPILOT_CONTEXT_CACHE_TTL_SECONDS', 300);
    await this.redisService.client.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    return data;
  }

  async execute(tenantId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'get_month_summary':
        return this.getMonthSummary(tenantId, Number(args.year), Number(args.month));
      case 'get_month_comparison':
        return this.reportService.getComparison(tenantId, Number(args.year), Number(args.month));
      case 'get_top_accounts':
        return this.reportService.getTopAccounts(
          tenantId,
          Number(args.year),
          Number(args.month),
          Math.min(10, Number(args.limit ?? 5)),
        );
      case 'get_review_queue_count':
        return {
          count: await this.prisma.transactionClassification.count({
            where: { tenantId, status: 'review' },
          }),
        };
      case 'lookup_chart_account':
        return this.prisma.chartOfAccount.findFirst({
          where: { tenantId, accountCode: String(args.accountCode) },
          select: { accountCode: true, accountName: true, accountType: true, isActive: true },
        });
      case 'get_banking_status':
        return this.getBankingStatus(tenantId);
      case 'get_cas_integration_help':
        return getCasIntegrationFaq(String(args.topic));
      default:
        throw new BadRequestException(`Unknown copilot tool: ${name}`);
    }
  }

  private async getBankingStatus(tenantId: string) {
    const cacheKey = `copilot:tool:banking:${tenantId}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const status = await this.onboardingService.getStatus(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [lastCas, countLast7Days] = await Promise.all([
      this.prisma.transaction.findFirst({
        where: { tenantId, source: 'cas' },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      this.prisma.transaction.count({
        where: { tenantId, source: 'cas', transactionDate: { gte: sevenDaysAgo } },
      }),
    ]);

    const payload = {
      bankingLinked: status.bankingLinked,
      grants: status.grants.map((g) => ({
        bankName: g.bankName,
        accountNumber: g.accountNumber,
        linkedAt: g.linkedAt,
        status: g.status,
      })),
      recentCasActivity: {
        lastTransactionAt: lastCas?.transactionDate?.toISOString() ?? null,
        countLast7Days,
      },
      uiHints: { settingsBankingPath: '/settings', onboardingPath: '/onboarding' },
    };

    await this.redisService.client.set(cacheKey, JSON.stringify(payload), 'EX', 60);
    return payload;
  }
}
```

#### `copilot-tools.factory.ts`

Factory bind `tenantId` + delegate `toolService.execute` — pattern OpenAI SDK gắn `function` trực tiếp trên tool object (xem mục 2.1).

### 4.2 File sửa

| File | Thay đổi |
|------|----------|
| `openai.service.ts` | Thêm `chatCopilotWithTools()` dùng `runTools`; giữ `chatCopilot()` cũ với `@deprecated` 1 sprint hoặc feature flag |
| `copilot.controller.ts` | Gọi method mới; inject `CopilotToolService` |
| `ai.module.ts` | Register `CopilotToolService`; import `ReportModule`, **`OnboardingModule`** |
| `copilot-context.service.ts` | **Phase 1:** giữ làm fallback nếu `runTools` lỗi; **Phase 2:** xóa hoặc chỉ dùng cho cache warming |

### 4.3 `openai.service.ts` — method mới (pseudo đầy đủ)

```typescript
async chatCopilotWithTools(
  tenantId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  toolService: CopilotToolService,
): Promise<string> {
  if (!this.client) {
    return 'AI Copilot chưa được cấu hình. Vui lòng liên hệ quản trị viên.';
  }

  const systemPrompt = `Bạn là AI Copilot tài chính của X-Cash AI...
- Khi cần số liệu thu/chi/lãi-lỗ, giao dịch, TK — HÃY GỌI TOOL phù hợp thay vì đoán.
- Khi user hỏi về Casso, Cas Link, liên kết ngân hàng, mất GD từ ngân hàng:
  → gọi get_banking_status; nếu cần giải thích luồng → get_cas_integration_help.
  → Không bịa thông tin từ website Casso; không hứa gọi support Casso thay user.
- Tháng/năm: nếu user nói "tháng này", dùng ${new Date().getMonth() + 1}/${new Date().getFullYear()}.
- Luôn trả lời tiếng Việt, in đậm **số tiền**, **%**, **mã TK** như quy tắc hiện tại.
- Không tiết lộ tên tool, grantId, accessToken hay JSON thô cho user.`;

  const tools = buildCopilotTools(tenantId, toolService);

  try {
    const runner = this.client.chat.completions.runTools(
      {
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ],
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 500,
      },
      { maxChatCompletions: 5 },
    );

    return (await runner.finalContent()) ?? 'Xin lỗi, tôi không thể trả lời lúc này.';
  } catch (error) {
    this.logger.error('Copilot runTools failed', error);
    return 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.';
  }
}
```

### 4.4 Frontend — contract & quy ước giao diện

**Phase 1a:** giữ request/response tối thiểu (tương thích ngược).

**Phase 1b+:** mở rộng response với `meta.activities[]` — xem **mục 4B** (hiển thị tra cứu nội bộ + web search).

```typescript
// Request — không đổi
POST /ai/copilot { message, history }

// Response Phase 1a (hiện tại)
{ data: { reply: string } }

// Response Phase 1b+ (backward compatible — FE cũ vẫn đọc reply)
{
  data: {
    reply: string;
    meta?: {
      activities: CopilotActivity[];
    };
  }
}
```

Types đề xuất (`packages/shared-types` hoặc `apps/frontend/src/types/copilot.ts`):

```typescript
export type CopilotActivityKind = 'internal_data' | 'knowledge' | 'web_search';

export interface CopilotActivity {
  kind: CopilotActivityKind;
  /** Nhãn tiếng Việt — không dùng tên tool kỹ thuật */
  label: string;
  /** Domain hoặc tên nguồn ngắn, vd "casso.vn", "Báo cáo X-Cash" */
  source?: string;
  /** Chỉ khi kind = web_search — tối đa 3 URL đã đọc */
  urls?: string[];
}
```

**Phase 2 (optional):** `POST /ai/copilot/stream` (SSE) — event `activity` trong lúc chờ, `delta` + `done` — xem 4B.4.

---

## 4B. Quy ước giao diện — tool, tra cứu & web search

Mục tiêu: user **nhìn thấy** Copilot đang làm gì (tra số liệu nội bộ vs tìm web), và **biết nguồn** của câu trả lời — đặc biệt khi có `search_casso_public` (Phase 3).

### 4B.1 Nguyên tắc UX

| Nguyên tắc | Chi tiết |
|------------|----------|
| Tiếng Việt | Mọi nhãn hiển thị cho user là tiếng Việt |
| Không lộ kỹ thuật | Không hiện `get_month_summary`, `runTools`, OpenAI, JSON tool |
| Phân biệt nguồn | **Dữ liệu X-Cash** (nội bộ) vs **Tìm trên web** (casso.vn) — icon + màu khác nhau |
| Minh bạch web | Web search **bắt buộc** chip nguồn + link; disclaimer ngắn dưới bubble |
| Không spam | Tối đa **3** chip nguồn / tin nhắn; gộp tool cùng loại (vd 2 báo cáo → 1 chip) |
| Viewer OK | Mọi role có Copilot đều thấy cùng pattern (chỉ đọc) |

### 4B.2 Map tool → nhãn UI (backend `meta.activities`)

Backend map sau khi `runTools` xong — **không** để model tự viết meta.

| Tool (nội bộ) | `kind` | `label` (chip / loading) | `source` |
|---------------|--------|--------------------------|----------|
| `get_month_summary` | `internal_data` | Báo cáo tháng | X-Cash AI |
| `get_month_comparison` | `internal_data` | So sánh tháng | X-Cash AI |
| `get_top_accounts` | `internal_data` | Top tài khoản | X-Cash AI |
| `get_review_queue_count` | `internal_data` | Hàng đợi xét duyệt | X-Cash AI |
| `lookup_chart_account` | `internal_data` | Hệ thống tài khoản TT133 | X-Cash AI |
| `get_banking_status` | `internal_data` | Liên kết ngân hàng | X-Cash AI |
| `get_cas_integration_help` | `knowledge` | Hướng dẫn tích hợp Casso | X-Cash AI |
| `search_transactions` | `internal_data` | Giao dịch | X-Cash AI |
| `search_product_help` | `knowledge` | Tài liệu sản phẩm | X-Cash AI |
| `search_casso_public` | `web_search` | Tìm trên web | casso.vn |

**Loading text** (khi có SSE — 4B.4): thêm `…` cuối, vd `Đang tra cứu báo cáo tháng…`, `Đang tìm trên web (casso.vn)…`.

### 4B.3 Layout bubble assistant (sau khi trả lời)

```
┌─ Avatar 🤖 ─────────────────────────────────────────┐
│ ┌─ bubble ──────────────────────────────────────┐ │
│ │ Tháng 7/2026, tổng **doanh thu** đạt **125tr**… │ │
│ │ (HighlightedText — giữ như hiện tại)            │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Nguồn tham khảo                                 │ │  text-xs text-muted-foreground
│ │ [📊 Báo cáo X-Cash]  [🌐 casso.vn ↗]             │ │  chips — xem 4B.5
│ │ Thông tin từ website Casso — xem Cài đặt →     │ │  chỉ khi có web_search
│ │ Ngân hàng cho tích hợp trong X-Cash.            │ │
│ └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

- Footer nguồn **chỉ** gắn tin `assistant` có `meta.activities.length > 0`.
- Câu xã giao / không gọi tool → **không** hiện dòng "Nguồn".

### 4B.4 Trạng thái loading (đang chờ reply)

| Phase | Hành vi |
|-------|---------|
| **1a** | Giữ 3 chấm bounce (như `CopilotPage` hiện tại) |
| **1b** | Vẫn 3 chấm; sau khi có reply → hiện chip nguồn (không live step) |
| **2** | SSE: thay chấm bằng dòng trạng thái + icon theo `activity` event |

**Loading có SSE (Phase 2):**

```jsx
// Thay block bounce khi nhận event activity
<div className="flex items-center gap-2 text-sm text-muted-foreground">
  {kind === 'web_search' ? (
    <Globe className="size-4 shrink-0 text-amber-600 animate-pulse" />
  ) : (
    <Database className="size-4 shrink-0 animate-pulse" />
  )}
  <span>{label}…</span>
  {source && kind === 'web_search' && (
    <span className="text-xs opacity-70">({source})</span>
  )}
</div>
```

`aria-live="polite"` trên vùng chat (đã có) — cập nhật text loading khi đổi step.

### 4B.5 Component & style (shadcn + lucide)

| Component | File đề xuất | Vai trò |
|-----------|--------------|---------|
| `CopilotSourceChips` | `components/copilot/CopilotSourceChips.tsx` | Render `activities[]` |
| `CopilotLoadingStatus` | `components/copilot/CopilotLoadingStatus.tsx` | Loading SSE / fallback dots |
| `CopilotMessage` | refactor từ map trong `CopilotPage` | Bubble + footer nguồn |

**Chip theo `kind`:**

| `kind` | Icon (lucide) | Badge `variant` | Ghi chú |
|--------|---------------|-----------------|--------|
| `internal_data` | `BarChart3` hoặc `Database` | `secondary` | Nguồn dữ liệu tenant |
| `knowledge` | `BookOpen` | `outline` | FAQ / tài liệu nội bộ |
| `web_search` | `Globe` | `outline` + `border-amber-500/50 text-amber-800 dark:text-amber-200` | Nổi bật — user biết là web |

**Link web:** chip `web_search` click → `window.open(url, '_blank', 'noopener,noreferrer')`; hiển thị hostname (`casso.vn`), không dump full URL dài trong chip.

```jsx
// CopilotSourceChips — rút gọn
{activities.map((a) => (
  <Badge key={...} variant={...} className="gap-1 font-normal">
    <Icon className="size-3" />
    {a.kind === 'web_search' && a.urls?.[0] ? (
      <a href={a.urls[0]} target="_blank" rel="noopener noreferrer">
        {a.source ?? 'Web'}
        <ExternalLink className="size-3 ml-0.5" />
      </a>
    ) : (
      <span>{a.label}</span>
    )}
  </Badge>
))}
```

### 4B.6 Backend — build `meta.activities`

Trong `chatCopilotWithTools` / controller, sau `finalContent()`:

```typescript
const ACTIVITY_LABELS: Record<string, Omit<CopilotActivity, 'urls'>> = {
  get_month_summary: { kind: 'internal_data', label: 'Báo cáo tháng', source: 'X-Cash AI' },
  search_casso_public: { kind: 'web_search', label: 'Tìm trên web', source: 'casso.vn' },
  // ...
};

// Thu thập từ runner.on('functionToolCall') hoặc wrapper execute()
function dedupeActivities(calls: CopilotActivity[]): CopilotActivity[] {
  // Gộp theo kind+label; merge urls web (max 3)
}
```

`search_casso_public` handler trả về `{ snippets, urls }` — controller map `urls` vào activity.

### 4B.7 SSE (Phase 2 — optional)

```
POST /api/v1/ai/copilot/stream
Accept: text/event-stream

event: activity
data: {"kind":"web_search","label":"Đang tìm trên web","source":"casso.vn"}

event: delta
data: {"content":"Tháng 7"}

event: done
data: {"reply":"...","meta":{"activities":[...]}}
```

FE: `CopilotPage` dùng `fetch` + `ReadableStream` hoặc `@microsoft/fetch-event-source`; fallback về `POST /ai/copilot` JSON nếu stream lỗi.

### 4B.8 Gợi ý câu hỏi (chips) — bổ sung Casso

Thêm vào `SUGGESTED_QUESTIONS` (xoay vòng hoặc thay 1 chip):

- `Đã liên kết ngân hàng chưa?` → `internal_data`
- `Sao không thấy giao dịch từ Casso?` → `internal_data` + có thể `knowledge`

*(Chỉ thêm chip Casso khi Phase 1b banking tools đã bật.)*

### 4B.9 QA giao diện

- [ ] Hỏi doanh thu → chip **Báo cáo X-Cash**, không có Globe  
- [ ] Hỏi Cas Link → chip **Liên kết ngân hàng** / **Hướng dẫn tích hợp**, không Globe  
- [ ] Phase 3: hỏi bank Casso → loading có **Đang tìm trên web (casso.vn)…** (SSE) hoặc chip Globe sau reply  
- [ ] Click chip casso.vn → tab mới, `rel=noopener`  
- [ ] Câu "Xin chào" → không dòng Nguồn  
- [ ] Mobile: chips scroll ngang, không tràn bubble  
- [ ] Screen reader đọc được thay đổi trạng thái loading  

### 4B.10 Tham chiếu UI tổng

Chi tiết layout Copilot (bubble, loading, chips gợi ý): [`ui-design.md` §7](./ui-design.md#7--ai-copilot).

---

## 5. Bảo mật & RBAC

| Quy tắc | Chi tiết |
|---------|----------|
| `tenantId` | Chỉ từ `user.tenantId` JWT — inject closure, không có trong tool schema |
| Role | Giữ `@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)` + `@RequiresPlan('starter')` trên controller |
| Viewer | Được dùng Copilot (đọc số liệu) — khớp `rbac.md` |
| Tool không expose | Không có tool liệt kê tenant khác, không raw SQL; **không** trả `accessToken` / `grantId` đầy đủ cho user |
| PII banking | `accountNumber` có thể mask 4 số cuối trong text reply (model format); tool JSON giữ đủ cho kế toán tenant |
| Rate limit | `TenantThrottlerGuard` global vẫn áp dụng — mỗi Copilot message có thể = 2–5 OpenAI calls → cân nhắc giảm `maxChatCompletions` |

---

## 6. Feature flag & rollout

### 6.1 Env mới (đề xuất)

```env
# 0 = prompt stuffing cũ (CopilotContextService), 1 = runTools
COPILOT_USE_FUNCTION_CALLING=1
```

`configuration.ts`:

```typescript
COPILOT_USE_FUNCTION_CALLING: process.env.COPILOT_USE_FUNCTION_CALLING === '1',
```

`copilot.controller.ts`:

```typescript
if (this.config.get('COPILOT_USE_FUNCTION_CALLING')) {
  reply = await this.openAiService.chatCopilotWithTools(...);
} else {
  const ctx = await this.copilotContextService.getFinancialContext(tenantId);
  reply = await this.openAiService.chatCopilot(message, history, ctx);
}
```

### 6.2 Thứ tự triển khai

```
Phase 1a — Backend runTools + 3 tools (summary, review_count, lookup_account)
Phase 1b — Thêm comparison + top_accounts + banking tools + **FE `meta.activities` chips nguồn**
Phase 1c — Bật flag staging → QA (gồm checklist Casso mục 9.3 + UI mục 4B.9) → production
Phase 1d — Gỡ chatCopilot cũ + CopilotContextService (hoặc giữ cache warming)
Phase 2  — SSE streaming (`activity` + `delta`), zod, search_transactions, search_product_help
Phase 3  — search_casso_public + **UI web search** (Globe chip, disclaimer) — env tắt mặc định
```

---

## 7. Cache & Redis keys

| Key | TTL | Thay thế |
|-----|-----|----------|
| `copilot:context:{tenantId}:{y}-{m}` | 300s | Preload summary cũ — **deprecated** sau migrate |
| `copilot:tool:summary:{tenantId}:{y}-{m}` | 300s | Cache per-tool `get_month_summary` |
| `copilot:tool:comparison:...` | 300s | Optional |
| `copilot:tool:top_accounts:...` | 300s | Optional |
| `copilot:tool:banking:{tenantId}` | 60s | `get_banking_status` |

Embedding cache `embedding:hash:*` — không đổi.

---

## 8. Chi phí & latency

| | Trước | Sau |
|--|-------|-----|
| OpenAI calls / message | 1 | 1–5 (trung bình 2 khi cần số liệu) |
| DB queries | 1 summary (cached) mỗi request* | 0–3 tùy tool (cached) |
| Latency UX | ~1–3s | ~2–6s khi gọi tool |

\*Context cache 300s — miss thì query DB.

**Giảm chi phí:**

- Cache kết quả tool  
- `maxChatCompletions: 5`  
- System prompt ngắn hơn (bỏ block summary cố định)  

---

## 9. Testing

### 9.1 Unit

| Test | Mô tả |
|------|--------|
| `copilot-tool.service.spec.ts` | Mock ReportService/Prisma — `execute()` đúng tenant scope |
| `copilot-tools.factory.spec.ts` | Tool names unique, `strict: true` |

### 9.2 Integration (mock OpenAI)

Mock `client.chat.completions.runTools` trả `finalContent` cố định — hoặc e2e với `OPENAI_API_KEY` test tenant.

### 9.3 QA thủ công (checklist)

- [ ] "Doanh thu tháng này?" → gọi `get_month_summary` tháng hiện tại, số khớp Báo cáo  
- [ ] "So với tháng trước?" → `get_month_comparison`  
- [ ] "Chi nhiều nhất vào đâu?" → `get_top_accounts`  
- [ ] "Bao nhiêu GD chờ review?" → khớp badge sidebar `useReviewCount`  
- [ ] "TK 642 là gì?" → `lookup_chart_account`  
- [ ] "Đã liên kết ngân hàng chưa?" → `get_banking_status`, khớp Settings → Ngân hàng  
- [ ] "Sao không thấy giao dịch Casso?" → `get_banking_status` + gợi ý đúng (`source=cas`, chưa link, v.v.)  
- [ ] "Cas Link là gì?" → `get_cas_integration_help(topic=overview)` — không hallucinate giá Casso  
- [ ] "Casso hỗ trợ bank nào?" → Phase 3: search hoặc fallback link casso.vn + không bịa danh sách  
- [ ] "Xin chào" → không gọi tool, trả lời xã giao  
- [ ] Tenant A không thấy data tenant B  
- [ ] Plan Free → 403 (PlanGuard)  
- [ ] Không có `OPENAI_API_KEY` → message lỗi thân thiện  

### 9.4 Regression classify

`pnpm verify` — đảm bảo `AiModule` / `ClassificationService` (ai) không bị ảnh hưởng.

---

## 10. AI Classify — tách biệt (không dùng `runTools`)

Luồng classify **giữ nguyên**:

```
embedding → findSimilarByVector (few-shot) → classifyTransaction (json_object)
→ Human Review → persistLearningEmbedding
```

**Cải tiến riêng (không function calling):**

```typescript
// Sau JSON parse — classification.service.ts (ai)
const valid = await validateAccountsExist(tenantId, debit, credit);
if (!valid) confidenceScore = Math.min(confidenceScore, threshold - 1);
```

---

## 11. Optional: migrate sang `zodFunction`

Khi cần type-safe args:

```bash
pnpm add zod --filter @xcash/backend
```

```typescript
import { zodFunction } from 'openai/helpers/zod';
import { z } from 'zod/v3'; // hoặc v4 — kiểm tra tương thích openai@6.45

tools: [
  zodFunction({
    name: 'get_month_summary',
    description: '...',
    parameters: z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
    }),
    function: (args) => toolService.getMonthSummary(tenantId, args.year, args.month),
  }),
],
```

---

## 12. Docs cần cập nhật sau khi code xong

| File | Nội dung |
|------|----------|
| `agent-docs/00-current-state.md` | Copilot dùng `runTools`, env flag, file mới |
| `agent-docs/reference/business-overview.md` | AI Copilot pipeline (nếu user duyệt sửa reference) |
| `agent-docs/04-environment-setup.md` | `COPILOT_USE_FUNCTION_CALLING`, `COPILOT_CASSO_SEARCH_ENABLED` (Phase 3) |
| `agent-docs/reference/ui-design.md` | §7 Copilot — nguồn tham khảo, web search chip |
| `.env.example` | Biến mới |
| File này | Đổi trạng thái → ✅ Implemented |

---

## 13. Rủi ro & mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Model không gọi tool khi cần | System prompt bắt buộc gọi tool; few-shot trong prompt "khi hỏi doanh thu hãy gọi get_month_summary" |
| Model gọi tool sai tháng | Prompt quy tắc "tháng này"; validate month 1–12 |
| Loop token vô hạn | `maxChatCompletions: 5` |
| Circular module dep | `CopilotToolService` dùng Prisma cho review count, không import `ClassificationModule` |
| Latency cao | Cache tool results; giảm số tool Phase 1 |
| Casso hallucination | FAQ tĩnh + `get_banking_status`; tắt web search đến Phase 3 |
| SDK breaking change | Pin `openai` minor; đọc changelog trước bump |

---

## 14. Tham chiếu code hiện tại

| File | Vai trò |
|------|---------|
| `apps/backend/src/modules/ai/copilot.controller.ts` | Entry `POST /ai/copilot` |
| `apps/backend/src/modules/ai/copilot-context.service.ts` | Preload summary — **thay thế dần** |
| `apps/backend/src/modules/ai/openai.service.ts` | `chatCopilot`, `classifyTransaction` |
| `apps/backend/src/modules/report/report.service.ts` | `getSummary`, `getComparison`, `getTopAccounts` |
| `apps/backend/src/modules/onboarding/onboarding.service.ts` | `getStatus` — `bankingLinked`, `grants` cho Copilot |
| `apps/backend/src/modules/ai/copilot-cas-faq.ts` | **Mới** — FAQ Cas Link / Casso integration |
| `apps/frontend/src/pages/copilot/CopilotPage.tsx` | UI chat |
| `apps/frontend/src/components/copilot/CopilotSourceChips.tsx` | **Mới** — chip nguồn (4B) |
| `apps/frontend/src/components/copilot/CopilotLoadingStatus.tsx` | **Mới** — loading SSE / web search |
| `apps/backend/package.json` | `"openai": "^6.45.0"` |

**OpenAI SDK helpers:** [openai-node helpers.md](https://github.com/openai/openai-node/blob/master/helpers.md) — mục `runTools`.

---

## 15. Tóm tắt 1 dòng

**Migrate Copilot sang `runTools`:** tool tài chính + Casso/Cas Link + **UI minh bạch nguồn** (`meta.activities`, chip web `casso.vn`). Giữ nguyên `reply` cho FE cũ; streaming Phase 2.
