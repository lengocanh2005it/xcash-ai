# Current State — Đọc file này ĐẦU TIÊN

> Mục đích: cho biết **chính xác** cái gì đã tồn tại trong repo ngay lúc này, để agent không cần `find`/`grep`/`ls` lại từ đầu mỗi session mới. File này phải được cập nhật mỗi khi có thay đổi cấu trúc đáng kể (thêm module, thêm page, đổi dependency lớn, thêm service hạ tầng). Nếu file này và thực tế code lệch nhau, **tin thực tế code**, và sửa lại file này ngay sau đó.

Cập nhật lần cuối: **Copilot History (Phase 8 hoàn thành — verify + docs)** — `pnpm verify` pass (lint/type-check/test/build); checklist mục 8 trong `copilot-history-spec.md` đánh dấu xong; `copilot-conversation.service.spec.ts` (7 tests). Branch `feat/copilot-history`.

Trước đó — **Phase 7 polish + UX hardening** — Settings tab phân trang server `?page=&limit=&fromDate=&toDate=`; sidebar scroll containment + load-more khi scroll (không prefetch); `ConfirmDialog` xóa conversation; `CopilotQuotaSummary` + copy quota rõ «lượt gửi câu hỏi» vs «tin nhắn bạn+AI»; migration seed `copilot_quota` (`20260707120000`).

---

## Repo đang ở giai đoạn nào

**Trạng thái: Sprint 1–3 HOÀN THÀNH. Sprint 4 code feature HOÀN THÀNH** (Partner, billing, notification, auth security). **Branch `feat/copilot-history`:** Copilot History Phase 1–8 hoàn tất (sidebar, Settings tab, verify, docs). **Branch `feat/excel-import`:** Excel Import hoàn tất (Phase 1–3). **Còn lại:** deploy VPS + SSL/nginx, docker-compose env production đầy đủ, final E2E QA thủ công, test notification Slack/Resend với credential thật.

**Đã xong (Sprint 1–2):**
- Auth, Onboarding (Cas Link), Banking webhook, Transaction module ✅
- AI module: `classification.service` + `classification.processor` (ai-classify job, TT133, pgvector few-shot) ✅
- `chart-of-accounts` module: CRUD + seed TT133 (~60 tài khoản) on tenant register ✅
- `classification` module: Human Review queue (confirm/correct/skip) ✅
- `report` module: tổng hợp thu/chi + export Excel ✅
- Migration `klassi_ai_pivot` (tên lịch sử): bỏ invoices/customers/invoice_matches, thêm chart_of_accounts/transaction_classifications ✅
- Frontend: Dashboard (stat cards X-Cash), Transactions (TK Nợ/Có), ReviewPage, ReportsPage, AccountsPage ✅
- Sidebar: X-Cash AI branding, nav items mới (Human Review / Báo cáo / Danh mục TK) ✅
- shared-types: `MATCHED` → `CLASSIFIED`, thêm `ClassificationType`, `AccountType` ✅

**Đã xong (Sprint 3):**
- Backend: `POST /ai/copilot` — AI Copilot chat có financial context real-time (doanh thu/chi phí/review count tháng hiện tại) ✅
- Backend: `settings` module — threshold (Prisma) + notifications (Redis key `settings:notifications:{tenantId}`) ✅
- Backend: `team` module — invite qua email (link kích hoạt + tự đặt mật khẩu), list/remove member, resend invite, safety check ✅
- Backend: `billing` module — current-plan + usage-history ✅
- Backend: `report` module mở rộng — `GET /reports/comparison` (so tháng trước) + `GET /reports/top-accounts` (top 5 chi/thu) + `GET /reports/daily-trend` (thu/chi/activity theo ngày) + `GET /reports/status-breakdown` + `GET /reports/source-breakdown` (Dashboard charts) ✅
- Backend: `GET /review/count` — đếm số GD đang chờ review, dùng cho polling notification (không dùng SSE vì `EventSource` chuẩn không gửi được header `Authorization: Bearer`) ✅
- Frontend: `SettingsPage` (7 tab: Banking/Threshold/Notifications/Team/**Nhật ký**/Billing/**Lịch sử Copilot**) ✅
- Frontend: hook `useReviewCount` (poll 20s) → Sidebar hiện badge đỏ + toast khi review count tăng ✅
- Frontend: `ReviewPage` — thêm `SwipeableReviewCard` cho mobile (vuốt phải confirm / vuốt trái skip), giữ bảng cũ cho desktop ✅
- Frontend: ShadCN components mới — `progress.tsx`, `separator.tsx`, `switch.tsx`, `tabs.tsx` (dùng `radix-ui` umbrella package, pattern giống `select.tsx` — KHÔNG dùng `@radix-ui/react-*` riêng lẻ) ✅
- Sidebar: bật đủ 8 nav items (`/analytics`, `/copilot`, `/settings`), bỏ block "Sắp ra mắt" ✅

**Đã xong (Sprint 4 — phần code):**
- Backend: `partner` module — `GET /partner/tenants` (danh sách paginated `{ items, page, limit, total, totalPages }` — `?page=&limit=`; không truyền = full list), `GET /partner/stats` (tổng DN/active/suspended/GD tháng/doanh thu/AI accuracy toàn hệ thống), `GET /partner/revenue-trend` (doanh thu 6 tháng, đọc từ `payment_orders` status=paid), `PATCH /partner/tenants/:id/suspend`, `PATCH /partner/tenants/:id/activate` — dùng `PartnerGuard` có sẵn ✅
- Backend: bảng `plan_pricing` (mới) + `GET /partner/plan-pricing`, `PATCH /partner/plan-pricing/:plan` — Cas Partner chỉnh giá/quota Starter trở lên, Free luôn cố định 0đ/50GD. Đây là giá áp dụng cho lần nâng cấp tiếp theo, không hồi tố `subscriptions` đang active (snapshot giá riêng) ✅
- Backend: chặn login nếu subscription của tenant đang `suspended` (`auth.service.ts`) — hoàn thiện edge case đã ghi trong `rbac.md` ✅
- Backend: rate limiting per-tenant/per-phút bằng `@nestjs/throttler` — `TenantThrottlerGuard` (tracker = `tenantId`, fallback `userId`/IP), áp dụng global qua `APP_GUARD`, giới hạn cấu hình qua env `RATE_LIMIT_PER_MINUTE` (default 120) ✅
- Frontend: `PartnerPage` hoàn chỉnh — stat cards (tổng DN/active-suspended/doanh thu/AI accuracy), biểu đồ doanh thu 6 tháng (LineChart), tìm kiếm/lọc theo tên-trạng thái-gói, bảng tenant có nút Khóa/Mở khóa, section "Cài đặt giá gói dịch vụ" (sửa giá/quota/phí vượt Starter trở lên qua Dialog) ✅
- Frontend: `WelcomeTour` — dialog 4 bước giới thiệu luồng (Liên kết NH → AI định khoản → Human Review → Báo cáo/Copilot), hiện 1 lần cho mỗi user (`localStorage` key `xcash_welcome_tour_seen_{userId}`), gắn ở `DashboardPage` ✅
- Backend: `GET /partner/tenants/:id` — chi tiết 1 tenant (thông tin + plan + GD tháng + AI accuracy + members) ✅
- Backend: `POST /billing/upgrade` — tạo PaymentOrder + gọi PayOS tạo link thanh toán (mock fallback khi chưa có keys) ✅
- Backend: `POST /billing/upgrade/:orderCode/mock-confirm` — dev-only, giả lập webhook confirm thanh toán ✅
- Backend: `POST /webhook/payos-billing` — Public, verify chữ ký PayOS, gọi `confirmPayment()` khi `code === '00'` ✅
- Backend: `PayosService` — wrapper PayOS v2 SDK (`@payos/node`), mock mode khi keys không có ✅
- Frontend: Partner refactor sang sidebar layout (logo, collapse/expand, mobile) — 2 route: `/partner/dashboard`, `/partner/plans` ✅
- Frontend: `SettingsPage` BillingTab — luồng nâng cấp đầy đủ: chọn gói → QR thanh toán + polling → auto-close khi plan đổi; dev-only mock button ✅
- **Chặn tính năng theo gói (plan gating):** Backend `PlanGuard` + `@RequiresPlan` — Copilot/comparison/top-accounts cần Starter+, export Excel cần Pro+, thông báo Email/Slack validate trong `settings.service`. JWT/session có field `plan`; FE `PlanGate` + icon khóa sidebar + khóa switch thông báo/xuất Excel ✅
- **Partner đổi gói DN:** `PATCH /partner/tenants/:id/plan` — Cas Partner đặt gói bất kỳ cho bất kỳ tenant (không giới hạn downgrade như user tự nâng cấp); `PartnerTenantsPage.tsx` (page riêng, tách khỏi PartnerPage cũ) với dialog 2 bước (chọn gói → ConfirmDialog) ✅
- **Overage billing:** `planPricing.overagePricePerTransaction` seed Starter=800đ, Pro=600đ/GD (Partner đổi được qua UI); `banking.service` chỉ log overage cho Starter/Pro; `BillingCycleService` cron 2am — tìm subscription hết cycle → tạo PayOS overage order nếu có → reset `transactionUsedThisCycle`; `billing.controller` thêm 3 endpoint overage; `SettingsPage` BillingTab thêm banner cam + dialog QR riêng cho phí vượt quota ✅
- **Partner Dashboard planBreakdown card:** card "Phân bố theo gói dịch vụ" — mỗi gói hiện số DN + doanh thu định kỳ + mini progress bar; data từ `/partner/tenants` (không cần API mới) ✅
- **Dialog thanh toán:** `onInteractOutside` + `onEscapeKeyDown` → `e.preventDefault()` — user không thể vô tình đóng dialog thanh toán khi click ra ngoài hay bấm Escape ✅
- **QR code fix:** thay `<img src={qrCode}>` bằng `<QRCodeSVG value={qrCode} size={176} />` từ `qrcode.react` — PayOS v2 trả về raw VietQR string, không phải URL ảnh ✅
- **Chặn downgrade tự nâng cấp:** `billing.service.upgrade()` so sánh `pricePerMonth` từ `planPricing` table (không hardcode), ném 400 nếu target thấp hơn current; FE disable card + badge "Không khả dụng" cho gói giá thấp hơn ✅
- **In-app notification (Phase 1):** bảng `notifications` + module `notification` — `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/stream` (SSE, token qua query `?token=`), `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `DELETE /notifications/:id`, `DELETE /notifications` (batch theo `ids`), `DELETE /notifications/all`; AI classify tạo `review_needed` khi GD vào queue; FE `NotificationBell` (SSE invalidate + poll fallback 60s) trên Sidebar + mobile header, dropdown portal (không bị clip sidebar), chế độ chọn (checkbox) xóa 1/nhiều/tất cả + toast thành công ✅
- **In-app notification (Phase 2):** trigger thêm `quota_warning` (80% quota), `quota_exceeded`, `overage_started` (webhook banking), `billing_success` (upgrade/overage paid), `billing_payment_due` (cron tạo đơn overage), `tenant_suspended` (partner suspend) — dedup quota theo chu kỳ subscription ✅
- **Email notification (Phase 3 — Resend):** `ResendEmailService` + BullMQ queue `email-delivery` (5 attempts, exponential backoff 3s); sau mỗi in-app notification → `NotificationDeliveryService.enqueueEmailIfEnabled()` nếu tenant bật Email trong Settings (Starter+) ✅
- **Email xác thực đăng ký:** `confirmPassword` khi register; sau đăng ký gửi OTP 6 số qua Resend (BullMQ); `POST /auth/verify-email` mới cấp token; login chặn `EMAIL_NOT_VERIFIED` (403); FE `/verify-email` ✅
- **Quên mật khẩu / đặt lại mật khẩu:** `POST /auth/forgot-password` gửi OTP qua email; `POST /auth/reset-password` (OTP + mật khẩu mới); `POST /auth/resend-password-reset`; FE `/forgot-password`, `/reset-password`, link "Quên mật khẩu?" trên LoginPage ✅
- **Ghi nhớ đăng nhập:** `rememberMe` trên `POST /auth/login` — tick → cookie refresh 7 ngày + lưu email/preference `localStorage`; bỏ tick → session cookie (đóng trình duyệt = hết phiên) + TTL Redis 12h (`JWT_REFRESH_SESSION_EXPIRES_IN`) ✅
- **Mời thành viên qua email:** Admin nhập tên/email/vai trò → tạo user pending (`email_verified_at = null`) + gửi email Resend (BullMQ) chứa link `/accept-invite?token=`; thành viên tự đặt mật khẩu qua `POST /auth/accept-invite` → auto-login; Admin không biết mật khẩu; `POST /team/members/:id/resend-invite` gửi lại link ✅
- **Audit log (tenant):** module `audit-log` — `GET /audit-logs` (admin + accountant, phân trang + lọc action/ngày); label tiếng Việt cho action/actor/entity; tab **Nhật ký** trong Settings ✅
- **Audit log (Partner):** `GET /partner/audit-logs` (cross-tenant, lọc `tenantId`/action); Partner actions ghi `actor = userId` thật (không còn `'cas_partner'`); FE `/partner/audit-logs` ✅
- **UI polish:** font **Be Vietnam Pro** (Google Fonts); auth form rộng hơn (`max-w-lg`); Dashboard banner chào user nổi bật (bỏ card Trạng thái ngân hàng — đã có trong Settings) ✅
- **Hồ sơ tài khoản + avatar Azure Blob:** module `profile` — `GET/PATCH /profile`, `POST /profile/avatar` (multipart, lưu Azure Blob `avatars/{userId}/...`); cột `users.avatar_url`; FE click vùng user ở đáy sidebar → `ProfileDialog` (tab Cá nhân/Doanh nghiệp), cập nhật UI ngay qua `updateUser()` ✅
- **Đổi mật khẩu (đã đăng nhập):** `POST /auth/change-password/request` (xác thực mật khẩu cũ → gửi OTP email), `POST /auth/change-password/resend`, `POST /auth/change-password/confirm` (OTP → đổi mật khẩu + revoke toàn bộ refresh token); FE nút "Đổi mật khẩu" trong tab Cá nhân của `ProfileDialog` → `ChangePasswordPanel` 2 bước (cùng dialog, không lồng modal); thành công → logout + redirect `/login` ✅
- **Bulk reclassify:** `POST /transactions/bulk-reclassify` — enqueue AI hàng loạt (tối đa 50 GD, chỉ `pending`); FE `TransactionsPage` checkbox chọn + nút "Định khoản lại hàng loạt" (Admin/Accountant) ✅
- **Excel Import (Phase 1–3):** migration `add_transaction_source_direction_import_batch` — thêm enum `TransactionSource { cas, import }`, `TransactionDirection { in, out }`, cột `transactions.source`/`direction`/`importBatchId`; `import` module backend (`POST /transactions/import/validate`, `POST /transactions/import`, `GET /transactions/import/template`); `GET /transactions` thêm filter `source`; `GET /billing/current-plan` thêm `usageBreakdown { fromBank, fromImport }`; audit label `transaction_import`; FE `ImportTransactionsDialog` (3 bước: upload → validate/preview → kết quả), nút "Nhập từ Excel" trên `TransactionsPage` (Admin/Accountant), badge amber "Import Excel" trên card/bảng/detail sheet, source filter trên filter bar, breakdown dots trên BillingTab ✅
- **Fix RolesGuard @Public():** `RolesGuard.canActivate` giờ kiểm tra `IS_PUBLIC_KEY` trước — route `@Public()` bypass hoàn toàn, sửa lỗi SSE stream `/notifications/stream?token=` trả 401 ✅

**Đã xong (Copilot Function Calling — Phase 1a–1d):**
- Backend: migrate `POST /ai/copilot` sang OpenAI `runTools` — 7 tools ban đầu (thay `get_cas_integration_help` bằng `search_knowledge_base` + pgvector sau); hiện factory có 8 tool cố định + `search_casso_public` tùy chọn ✅
- Backend: `CopilotToolService` (execute + Redis cache per-tool), `buildCopilotTools` factory, `copilot-cas-faq.ts` (FAQ tĩnh Cas Link), `CopilotContextService` sửa lỗi `formatFinancialContext` không tồn tại ✅
- Backend: `OpenAiService.chatCopilotWithTools()` trả `{ reply, activities }` — track tool calls qua `runner.on('functionToolCall')`, map sang `CopilotActivity[]` với nhãn tiếng Việt ✅
- Backend: Feature flag `COPILOT_USE_FUNCTION_CALLING=1` — khi bật dùng `runTools`, khi tắt fallback về `CopilotContextService` + `chatCopilot()` cũ ✅
- Backend: `ReportModule` export `ReportService` (cần thiết cho `CopilotToolService`); `AiModule` import `ReportModule` + `OnboardingModule` ✅
- Frontend: `CopilotSourceChips.tsx` — chip nguồn (`internal_data`/`knowledge`/`web_search`) với icon Lucide + link `rel=noopener` cho web chip ✅
- Frontend: `CopilotPage.tsx` — handle `meta.activities` từ response, thêm 2 gợi ý câu hỏi Casso, greeting message cập nhật ✅
- Env mới: `COPILOT_USE_FUNCTION_CALLING`, `COPILOT_CONTEXT_CACHE_TTL_SECONDS` (cả `configuration.ts` lẫn `.env.example`) ✅

**Đã xong (Copilot Function Calling — Phase 2):**
- Backend: `POST /ai/copilot/stream` — SSE endpoint, `@Res()` bypass `ResponseInterceptor`, stream `activity`/`delta`/`done` events; fallback về `chatCopilot()` khi flag=0 ✅
- Backend: tool thứ 8 `search_transactions` — Prisma trực tiếp (tránh circular dep), filter keyword (content/senderAccount), source (cas=grantId not null | import=grantId null), limit 1–20 ✅
- Backend: `OpenAiService.buildCopilotSystemPrompt()` + `createCopilotRunner()` (stream=true) + export `buildActivities()` dùng chung cho cả 2 endpoint ✅
- Frontend: `CopilotLoadingStatus.tsx` — dots bounce khi chưa có activity; icon + label khi tool đang chạy ✅
- Frontend: `CopilotPage.tsx` rewrite — `sendViaStream()` dùng `fetch`+`ReadableStream`+`getAccessToken()`; `sendViaJson()` axios fallback; `streamingContent` state cho streaming bubble; `AbortController` để cleanup ✅

**Đã xong (Copilot Function Calling — Phase 3):**
- Backend: tool `search_casso_public` — Tavily API (`@tavily/core`), search `site:casso.vn`, cache Redis 24h theo query hash ✅
- Backend: `COPILOT_CASSO_SEARCH_ENABLED=0` mặc định tắt; chỉ bật khi có `TAVILY_API_KEY` ✅
- Backend: `buildCopilotTools()` nhận `configService` để kiểm tra flag, thêm tool vào danh sách có điều kiện ✅
- Backend: `buildCopilotSystemPrompt(cassoSearchEnabled)` — khi bật thêm quy tắc gọi `search_casso_public` + disclaimer; khi tắt hướng user vào casso.vn ✅
- Env mới: `COPILOT_CASSO_SEARCH_ENABLED`, `TAVILY_API_KEY` (`.env.example` + `configuration.ts`) ✅

**Đã xong (Copilot hardening — reliability):**
- Backend: `streamChat` bọc toàn bộ logic sau `flushHeaders()` trong `try/catch` — lỗi Prisma/Redis vẫn emit SSE `done` với message lỗi (không đóng stream im lặng) ✅
- Backend: `chatCopilotWithTools()` truyền `resultsCapture` Map → `buildActivities()` có snippet + knowledge chips trên cả JSON path (khớp stream path) ✅
- Backend: `TOOL_ACTIVITIES` + `getStreamingActivityMeta()` — một nguồn label streaming vs chip cuối (gồm `search_knowledge_base`) ✅
- Backend: `search_transactions` schema — `source` optional + enum `all`; handler vẫn lọc `cas`/`import`/tất cả ✅
- Backend: `CopilotToolService` inject `OpenAiService.createEmbedding()` (bỏ `import('openai')` mỗi lần); Tavily client singleton trong constructor ✅
- Frontend: `CopilotPage` — SSE buffer giữ frame cắt TCP; throw nếu stream kết thúc không có `done` → fallback `sendViaJson` ✅

**Đã xong (UX polish — tenant + partner):**
- Frontend: `DashboardPage` — stat cards từ `/reports/summary` (AI accuracy tháng), `GET /review/count`, count API `pending`/`classified` hôm nay; `MonthlyOverviewCard` (thu/chi/lãi lỗ tháng); `CashflowTrendChart` từ `GET /reports/daily-trend` (thu+chi+activity 7 ngày); donut trạng thái + nguồn (`status-breakdown`, `source-breakdown`); giao dịch gần đây `limit=5`; stat cards clickable; banner CTA liên kết NH khi `bankingLinked=false` ✅
- Frontend: `AccountsPage` — input tìm mã/tên TK; `TransactionsPage` đọc `?status=` từ URL + badge status tiếng Việt; cột "Độ tin cậy" ✅
- Frontend: `ReviewPage` `refetchInterval: 15_000`; validate TK Nợ/Có `^\d{3,4}$` khi sửa định khoản ✅
- Frontend: `SettingsPage` NotificationsTab sync form qua `useEffect`; tab `title` trên mobile ✅
- Frontend: `LoginPage` bỏ `htmlFor` trên Label bọc Checkbox (tránh double-toggle `rememberMe`) ✅
- Frontend: `NotificationBell` ConfirmDialog trước "Xóa tất cả"; `WelcomeTour` text "Bước n/4" + dot lớn hơn ✅
- Frontend: `ErrorBoundary` bọc `<Routes>`; `useSidebarCollapsed` persist `localStorage` (tenant + partner key riêng) ✅
- Frontend: `ProfileDialog` — báo lỗi riêng khi PATCH ok nhưng upload avatar fail ✅
- Frontend: `lib/plan-labels.ts` + `types/partner.ts` — dùng chung 4 Partner pages ✅
- Frontend: `ReportsPage` dropdown năm động `[year-1, year]` ✅
- Backend + FE: `GET /partner/tenants` trả `{ items, page, limit, total, totalPages }` — query `?page=&limit=` (không truyền = full list cho Partner Dashboard); `PartnerTenantsPage` paginate 20/trang ✅
- Frontend: `PartnerDashboardPage` hint MRR/plan pie "snapshot hiện tại, không theo kỳ lọc ngày"; `PartnerPlansPage` fix confirm khi đóng dialog edit; skeleton dùng `<Skeleton>` ✅
- Frontend: `PartnerLayout` bỏ `ThemeToggle` trùng trên mobile top bar (giữ sidebar footer) ✅

**Đã xong (Copilot History — Phase 1–3):**
- **Phase 1 — Schema:** migration `20260707020628_add_copilot_conversations` — enum `CopilotMessageRole { user, assistant }`; model `copilot_conversations` (id, tenant_id, user_id, title, created_at, updated_at); model `copilot_messages` (id, conversation_id, role, content Text, activities Json?, is_partial Boolean, created_at); quan hệ cascade; index `[tenantId, userId, updatedAt DESC]` và `[conversationId, createdAt]` ✅
- **Phase 2 — Backend CRUD:** `CopilotConversationService` — `findOrCreate()` (validate ownership 404, create if no ID), `saveUserMessage()`, `saveAssistantMessage()` (sanitize activities: max 10, snippet ≤300 ký tự, URLs ≤5), `getHistoryForContext()` (10 messages cuối, exclude current), `triggerAutoTitle()` (fire-and-forget LLM gpt-4o-mini ≤6 từ tiếng Việt, sanitize XSS chars), `listConversations()` — **cursor** `?before=<uuid>&limit=` (sidebar) hoặc **offset** `?page=&limit=&fromDate=&toDate=` (Settings, trả `total/page/totalPages`), `getConversation()`, `renameConversation()`, `deleteConversation()`; DTO `ListConversationsQueryDto`, `GetConversationQueryDto`, `RenameConversationDto`; 4 endpoint mới (`GET/GET :id/PATCH :id/DELETE :id /ai/copilot/conversations`) ✅
- **Phase 3 — Tích hợp + Security:** `chat()` và `streamChat()` gọi `findOrCreate` + `saveUserMessage` → khi `conversationId` có, dùng history từ DB thay vì FE-provided `history[]` (chặn injection); `saveAssistantMessage` + `triggerAutoTitle` fire-and-forget; response thêm `conversationId`; SSE setup (findOrCreate + saveUserMessage) trước `flushHeaders()` để lỗi 404 trả đúng HTTP code; DTO hardening: `ChatMessage.role` `@IsIn`, `content` `@MaxLength(2000)`, `history` `@ArrayMaxSize(20)`, `conversationId` `@IsOptional @IsUUID`; `CopilotQuotaGuard` chuyển từ controller-level sang method-level (chỉ trên `chat()` và `streamChat()`) để CRUD endpoint không bị chặn bởi quota ✅
- **shared-types:** thêm `CopilotActivity` (canonical từ `openai.service.ts`), `CopilotConversationSummary`, `CopilotMessageDto`, `CopilotConversationDetail`, `CopilotConversationsListResponse`; `CopilotSourceChips.tsx` import `CopilotActivity` từ `@xcash/shared-types` thay vì định nghĩa local ✅
- **`openai.service.ts`:** thêm `generateCopilotTitle(firstMessage: string): Promise<string>` — prompt "≤6 từ tiếng Việt", sanitize chars `<>"'\``, fallback `'Cuộc chat mới'` ✅

**Đã xong (Copilot History — Phase 4–5):**
- **Phase 4 — Stop generation (backend):** `streamChat()` thêm `wasAborted` flag + `req.on('close')` → `runnerInstance?.abort()`; toàn bộ `writeEvent('done')` + `saveAssistantMessage` + `triggerAutoTitle` + `incrementAndNotify` đều bọc `if (!wasAborted)`; `finally` block: nếu `wasAborted && accumulatedContent.trim()` → `saveAssistantMessage(..., true)` (isPartial=true) + `triggerAutoTitle` fire-and-forget; `incrementAndNotify` KHÔNG chạy khi abort (quota không tính) ✅
- **Phase 4 — Stop generation (frontend):** Stop button (`Square` icon fill-current) thay thế Send khi `isLoading`; `AbortController` trong `sendViaStream()` — `AbortError` → save partial bubble với `isPartial=true` vào state, trả `null` (không fallback JSON); "Đã dừng" badge (`StopCircle` icon) hiện trên partial messages ✅
- **Phase 5 — `CopilotMessageActions.tsx`:** Copy button hover-reveal trên assistant messages; 1.5s "Đã sao chép" state (Check icon green); `Tooltip` nội bộ đã có `TooltipProvider` ✅
- **Phase 5 — `useCopilotConversations.ts`:** React Query hook — `useQuery` list conversations (staleTime 30s), `invalidateList`, `deleteConversation`, `renameConversation` (đều invalidate), `loadConversation`, `loadOlderMessages(id, before)` ✅
- **Phase 5 — `CopilotSidebar.tsx`:** Conversations grouped by date (Hôm nay/Hôm qua/7 ngày qua/Tháng này/Tháng M/YYYY — native Date, không dùng date-fns); `ConversationItem`: outer `<div>` non-interactive + inner `<button>` title click + sibling `<button>` context menu (a11y compliant, no nested buttons); inline rename (input thay title, blur/Enter = commit, Escape = cancel); delete confirm `Dialog`; usage bar Copilot quota (ẩn khi unlimited) ✅
- **Phase 5 — `CopilotPage.tsx` rewrite:** 2-column layout (`<aside className="hidden md:flex w-64">` + chat area); mobile `<Sheet side="left">` drawer; `activeConversationId` persisted `localStorage` key `xcash_copilot_conv_{userId}`; `handleLoadConversation(id)` fetch full conversation + set messages + scroll to bottom via `requestAnimationFrame`; `IntersectionObserver` on sentinel `<div ref={sentinelRef}>` at top of message list → trigger `handleLoadOlderMessages()`; `useLayoutEffect` capture `prevScrollHeight` before prepend → restore `scrollTop` after DOM update; `conversationId` sent in request body, received from `done` event → `setActiveConversationId` + `persistConversation` + `invalidateList()`; skeleton loading states; `handleNewChat()` abort + clear state; stop button replace send when `isLoading` ✅
- **Phase 5 — `sheet.tsx` extension:** thêm `side?: 'left' | 'right'` prop + `SHEET_SIDE` map với slide-in/out animations theo hướng ✅

**Đã xong (Copilot History — Phase 6 — performance hardening):**
- **9.1 Parallel DB write:** `chat()` và `streamChat()` chạy `Promise.all([findOrCreate(...), getFinancialContext(...)])` song song khi `COPILOT_USE_FUNCTION_CALLING=0` (bỏ qua fetch khi flag=1 vì dùng tools thay preload context) — giảm latency critical path ✅
- **9.8 Per-user throttle:** `CopilotThrottlerGuard` (`common/guards/copilot-throttler.guard.ts`, extends `ThrottlerGuard`, track theo `userId`) áp dụng `@Throttle({ ttl: 60_000, limit: 30 })` trên `POST /ai/copilot` — tách biệt khỏi `TenantThrottlerGuard` global (track theo `tenantId`, có thể bị 1 user chat nhiều làm throttle cả tenant) ✅
- **9.7 SSE concurrent limit:** `POST /ai/copilot/stream` gắn `@SkipThrottle()` (bỏ qua ThrottlerGuard global) + tự implement giới hạn Redis `copilot:sse:active:{userId}` (INCR + EXPIRE 120s, max 3 connection đồng thời) — trả `429` trước khi `flushHeaders()` nếu vượt; `streamChat()` tách thành wrapper (quản lý INCR/DECR) + `streamChatInternal()` (logic chat thật) ✅
- **9.9 Dangling message cleanup:** `CopilotConversationService.deleteMessage(id)` — gọi khi AI call lỗi thật (không phải abort): `chat()` bọc try/catch quanh AI call, xóa `userMsg` rồi rethrow; `streamChat()` trong catch block, chỉ xóa nếu `!accumulatedContent.trim()` (có nội dung → coi như partial, giữ lại theo path abort) ✅

**Đã xong (Copilot History — Phase 7 — Settings history tab):**
- **`CopilotHistoryTab.tsx`:** Card + bảng ShadCN; filter `Từ ngày`/`Đến ngày` debounced (server-side); phân trang 10/trang (`useCopilotHistoryPage` + `?page=&limit=`); cột «Tin nhắn (Bạn + AI)»; `CopilotQuotaSummary` card giải thích lượt vs tin nhắn; click row → `localStorage` + `/copilot` ✅
- **`useCopilotHistoryPage.ts`:** React Query hook riêng cho Settings tab (offset pagination, tách khỏi sidebar infinite query) ✅
- **`SettingsPage.tsx`:** tab `copilot-history` (icon `MessageSquare`), URL `?tab=copilot-history` ✅
- **Privacy:** chỉ conversations của user đăng nhập — không admin audit cross-user (theo spec 7.1) ✅

**Đã xong (Copilot History — Phase 8 — verify + docs):**
- **`pnpm verify`** pass toàn monorepo sau toàn bộ thay đổi Copilot History ✅
- **`copilot-conversation.service.spec.ts`:** ownership 404, create, sanitize activities, cursor list, offset list + date filter, `getHistoryForContext` exclude current message ✅
- **Polish UX (post-Phase-7):** `CopilotSidebar` — `min-h-0` scroll list, quota footer cố định, scroll-near-bottom load-more (`COPILOT_SIDEBAR_PAGE_SIZE=20`), nút «Tải thêm» khi list chưa overflow; `CopilotPage` — `ConfirmDialog` xóa ở page level, sidebar collapse mặc định, theme toggle desktop, skeleton khi đổi conversation; `TenantLayout` `min-h-0` cho full-height pages ✅
- **`listConversations()` mở rộng:** cursor mode (sidebar) + offset mode `?page=&fromDate=&toDate=` (Settings); `CopilotConversationsListResponse` thêm optional `total/page/limit/totalPages` ✅
- **Migration `20260707120000_seed_copilot_quota_by_plan`:** seed đúng quota Free/Starter/Pro/Enterprise (fix Pro unlimited bug) ✅
- **`CopilotQuotaSummary.tsx`:** component dùng chung sidebar + Settings card; Enterprise ẩn bar sidebar (`quota=-1`) ✅
- **`lib/plan.ts`:** `formatCopilotQuota`, `resolveCopilotQuota` fallback khi API thiếu field ✅
- **Docs:** `agent-docs/00-current-state.md` + checklist mục 8 `copilot-history-spec.md` cập nhật ✅

**Đã xong (Copilot Quota — Phase 1–4):**
- **Phase 1 — Schema:** migration `20260706143059_add_copilot_quota` — thêm `NotificationType.copilot_quota_warning` + `copilot_quota_exceeded`; cột `subscriptions.copilot_used_this_cycle` (Int, default 0); cột `plan_pricing.copilot_quota` (Int, default -1 = unlimited); seed `plan_pricing` copilotQuota (Free=0, Starter=200, Pro=1000, Enterprise=-1) ✅
- **Phase 2 — Guard + increment:** `CopilotQuotaGuard` (`common/guards/copilot-quota.guard.ts`) — đọc subscription + planPricing từ DB (no cache), skip nếu quota=-1 (Enterprise), throw 429 nếu đã vượt, store `{ id }` vào `request[COPILOT_SUBSCRIPTION_KEY]`; guard chain trên `CopilotController`: `JwtAuthGuard → RolesGuard → PlanGuard → CopilotQuotaGuard`; `incrementAndNotify()` fire-and-forget sau `writeEvent('done')` — `$increment copilotUsedThisCycle` + gọi `checkCopilotQuotaNotifications()`; `NotificationService.checkCopilotQuotaNotifications()` dedup `copilot_quota_warning` (≥80%) và `copilot_quota_exceeded` (≥100%) mỗi chu kỳ bằng `createOncePerCycle()` ✅
- **Phase 3 — Billing cycle reset + expose:** `BillingCycleService` reset `copilotUsedThisCycle=0` khi hết cycle; `BillingService.getCurrentPlan()` trả thêm `copilotQuota` + `copilotUsed`; `UpdatePlanPricingDto` thêm optional `copilotQuota` (Min -1); `PartnerService.updatePlanPricing()` + `listPlanPricing()` lưu và trả `copilotQuota` ✅
- **Phase 4 — Frontend:** `SettingsPage` BillingTab — progress bar "Lượt chat Copilot" (ẩn khi quota=-1, màu primary/<80%, orange/≥80%, destructive/≥100%); `PartnerPlansPage` — hiện `copilotQuota` trong card + bảng tổng hợp, thêm input field trong dialog với helper text "Nhập -1 để không giới hạn" ✅

**Chưa làm (Sprint 4 — còn lại):**
- Bổ sung env production đầy đủ vào `docker-compose.yml` (OpenAI, Resend, PayOS, v.v.) + deploy lên VPS
- SSL/HTTPS + nginx config production (domain thật, certbot) — template có tại `deploy/nginx/xcash.conf`
- GitHub Actions `deploy.yml` — cần secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`
- Final E2E QA thủ công toàn luồng (register → verify email → Cas Link → nhận GD → AI classify → review → export → billing)
- Test Slack webhook + Resend email trên môi trường có key thật (code đã có; Slack URL cấu hình per-tenant trong Settings Pro+)

---

## Cây file thực tế toàn repo (không tính `node_modules`, `.git`, `.turbo`)

```
paypilot-ai/                                   ← tên folder local có thể khác; repo GitHub: lengocanh2005it/xcash-ai (package npm: x-cash-ai)
├── .claude/skills/                            # 6 skills
├── .env.example
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── .husky/
├── docker-compose.yml                         # postgres + redis
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx-frontend.conf
├── deploy/
│   ├── README.md
│   └── nginx/xcash.conf
├── CLAUDE.md
├── agent-docs/
│   ├── README.md
│   ├── 00-current-state.md                    ← file này
│   ├── 01-monorepo-structure.md
│   ├── 02-backend-conventions.md
│   ├── 03-frontend-conventions.md
│   ├── 04-environment-setup.md
│   └── reference/
│       ├── business-overview.md               ← X-Cash AI ✅
│       ├── rbac.md                            ← X-Cash AI ✅
│       ├── database-schema.md                 ← X-Cash AI ✅
│       ├── user-journey.md                    ← X-Cash AI ✅
│       ├── ui-design.md                       ← X-Cash AI ✅
│       ├── sprint-plan.md                     ← X-Cash AI ✅
│       ├── payos-billing-plan.md              ← PayOS billing (đã hoàn thành) ✅
│       ├── tt133-accounting.md                ← giải thích TT133 theo góc nhìn dev ✅
│       └── copilot-function-calling-migration.md ← spec migrate Copilot → runTools (Phase 1 ✅; Phase 2 ✅; Phase 3 ✅)
├── apps/
│   ├── backend/
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   ├── schema.prisma                  # X-Cash AI schema ✅
│   │   │   └── migrations/
│   │   │       ├── 20260301120000_init_sprint1_week1/
│   │   │       ├── 20260702032642_add_cas_grant_account_holder_name/
│   │   │       ├── 20260702080000_add_cas_grant_bank_logo/
│   │   │       ├── 20260703041453_klassi_ai_pivot/   ← migration đã apply (tên lịch sử) ✅
│   │   │       ├── 20260703091815_add_plan_pricing/  ← thêm bảng plan_pricing + seed giá mặc định ✅
│   │   │       ├── 20260703120000_add_payment_order_type_and_overage_prices/ ← thêm order_type vào payment_orders + seed overagePricePerTransaction (Starter=800, Pro=600) ✅
│   │   │       ├── 20260703140000_add_notifications/ ← bảng notifications + enum NotificationType ✅
│   │   │       ├── 20260703150000_extend_notification_types/ ← thêm quota/billing/suspend types ✅
│   │   │       ├── 20260703160000_add_user_email_verified_at/ ← cột users.email_verified_at + backfill user cũ ✅
│   │   │       ├── 20260704100000_add_user_avatar_url/ ← cột users.avatar_url ✅
│   │   │       ├── 20260704162813_add_transaction_source_direction_import_batch/ ← enum TransactionSource/Direction, cột source/direction/importBatchId trên transactions ✅
│   │   │       ├── 20260706143059_add_copilot_quota/ ← NotificationType enum thêm copilot_quota_warning/exceeded; subscriptions.copilot_used_this_cycle; plan_pricing.copilot_quota ✅
│   │   │       ├── 20260707020628_add_copilot_conversations/ ← enum CopilotMessageRole; model copilot_conversations + copilot_messages ✅
│   │   │       ├── 20260707100000_restore_copilot_conversation_indexes/ ← restore indexes nếu migration trước drop nhầm ✅
│   │   │       └── 20260707120000_seed_copilot_quota_by_plan/ ← seed copilot_quota theo plan (Free=0, Starter=200, Pro=1000, Enterprise=-1) ✅
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── .swcrc
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts                  # imports: Auth, Cas, Health, Onboarding, Banking, Ai, AuditLog, ChartOfAccounts, Classification, Report, Transaction, Settings, Team, Billing, Partner, Notification, Profile; StorageModule; + ThrottlerModule + APP_GUARD (TenantThrottlerGuard)
│   │       ├── config/configuration.ts        # + RATE_LIMIT_PER_MINUTE, AZURE_STORAGE_*, COPILOT_USE_FUNCTION_CALLING, COPILOT_CONTEXT_CACHE_TTL_SECONDS
│   │       ├── common/
│   │       │   ├── decorators/                # @Roles, @RequiresPlan, @Public
│   │       │   ├── guards/auth.guards.ts       # JwtAuthGuard, RolesGuard, PartnerGuard
│   │       │   ├── guards/plan.guard.ts
│   │       │   ├── guards/copilot-quota.guard.ts  # CopilotQuotaGuard — đọc DB, skip quota=-1, throw 429, store subscription id ✅
│   │       │   ├── guards/copilot-throttler.guard.ts  # CopilotThrottlerGuard — per-user rate limit riêng cho Copilot (Phase 6) ✅
│   │       │   ├── guards/tenant-throttler.guard.ts
│   │       │   ├── filters/all-exceptions.filter.ts
│   │       │   ├── interceptors/response.interceptor.ts
│   │       │   ├── middleware/request-id.middleware.ts
│   │       │   └── types/authenticated-user.type.ts
│   │       ├── prisma/
│   │       ├── redis/
│   │       ├── queue/queue.module.ts
│   │       ├── storage/                       # AzureBlobService (avatar upload) ✅
│   │       │   ├── storage.module.ts
│   │       │   └── azure-blob.service.ts
│   │       └── modules/
│   │           ├── auth/                      # register + OTP verify, login (rememberMe), forgot/reset password, change-password, refresh, logout, me ✅
│   │           │   ├── email-verification.service.ts
│   │           │   ├── password-reset.service.ts
│   │           │   └── change-password.service.ts
│   │           ├── banking/                   # POST /webhook/cas → enqueue ai-classify ✅
│   │           ├── ai/                        # openai.service, embedding.service, classification.service, classification.processor, copilot.controller ✅
│   │           │   ├── copilot.controller.ts      # POST /ai/copilot + POST /ai/copilot/stream + 4 conversation CRUD endpoints — CopilotQuotaGuard method-level (chat+stream only); chat() thêm CopilotThrottlerGuard; stream() @SkipThrottle + Redis SSE limit (Phase 6)
│   │           │   ├── copilot-conversation.service.ts  # CRUD conversations + messages, cursor pagination, auto-title fire-and-forget, deleteMessage() dangling cleanup (Phase 6) ✅
│   │           │   ├── copilot-context.service.ts # Fallback: preload summary tháng hiện tại (dùng khi flag=0)
│   │           │   ├── copilot-tool.service.ts    # execute(tenantId, name, args) — 8 tools + Redis cache (+ search_casso_public khi bật)
│   │           │   ├── copilot-tools.factory.ts   # buildCopilotTools() → 8 Tool[] (+ search_casso_public optional)
│   │           │   ├── copilot-cas-faq.ts         # FAQ tĩnh Casso/Cas Link (4 topics)
│   │           │   └── dto/
│   │           │       └── copilot-conversation.dto.ts  # ListConversationsQueryDto, GetConversationQueryDto, RenameConversationDto ✅
│   │           ├── chart-of-accounts/         # CRUD + seedTt133() ✅
│   │           │   ├── chart-of-accounts.controller.ts
│   │           │   ├── chart-of-accounts.service.ts
│   │           │   ├── chart-of-accounts.module.ts
│   │           │   ├── tt133-seed.ts          # ~60 tài khoản TT133
│   │           │   └── dto/account.dto.ts
│   │           ├── classification/            # Human Review queue + review count ✅
│   │           │   ├── classification.controller.ts  # + GET /review/count
│   │           │   ├── classification.service.ts      # + getReviewCount()
│   │           │   ├── classification.module.ts
│   │           │   └── dto/review.dto.ts
│   │           ├── report/                    # Tổng hợp + export Excel + so sánh tháng + top accounts ✅
│   │           │   ├── report.controller.ts   # + GET /reports/comparison, /reports/top-accounts
│   │           │   ├── report.service.ts       # + getComparison(), getTopAccounts()
│   │           │   └── report.module.ts
│   │           ├── settings/                  # Threshold (Prisma) + Notifications (Redis) ✅
│   │           │   ├── settings.controller.ts
│   │           │   ├── settings.service.ts
│   │           │   ├── settings.module.ts
│   │           │   └── dto/settings.dto.ts
│   │           ├── audit-log/                 # GET /audit-logs (tenant scope) ✅
│   │           │   ├── audit-log.controller.ts
│   │           │   ├── audit-log.service.ts
│   │           │   ├── audit-log.labels.ts
│   │           │   └── dto/list-audit-logs.dto.ts
│   │           ├── team/                      # Invite email / list / remove / resend ✅
│   │           │   ├── team.controller.ts
│   │           │   ├── team.service.ts
│   │           │   ├── team-invite.service.ts
│   │           │   ├── team.module.ts
│   │           │   └── dto/team.dto.ts
│   │           ├── billing/                   # Current plan + usage history + PayOS upgrade ✅
│   │           │   ├── billing.controller.ts  # + POST /billing/upgrade, /upgrade/:orderCode/mock-confirm
│   │           │   ├── billing.service.ts      # + upgrade(), confirmPayment()
│   │           │   ├── billing.module.ts
│   │           │   ├── payos.service.ts        # PayOS v2 SDK wrapper, mock fallback
│   │           │   ├── payos-webhook.controller.ts  # POST /webhook/payos-billing
│   │           │   └── dto/upgrade-billing.dto.ts
│   │           ├── partner/                   # /partner/* — chỉ Cas Partner ✅
│   │           │   ├── partner.controller.ts
│   │           │   ├── partner.service.ts
│   │           │   ├── partner.module.ts
│   │           │   └── dto/plan-pricing.dto.ts
│   │           ├── notification/              # In-app + email Resend + SSE stream ✅
│   │           │   ├── notification.controller.ts  # GET list/unread/stream, PATCH read, DELETE 1/nhiều/all
│   │           │   ├── notification.service.ts
│   │           │   ├── notification-delivery.service.ts  # enqueue email/Slack sau publish
│   │           │   ├── resend-email.service.ts
│   │           │   ├── email.processor.ts      # BullMQ queue email-delivery
│   │           │   ├── slack.service.ts        # gửi Slack Incoming Webhook (per-tenant URL từ Settings)
│   │           │   ├── dto/delete-notifications.dto.ts
│   │           │   └── notification.service.spec.ts
│   │           ├── profile/                   # GET/PATCH /profile, POST /profile/avatar ✅
│   │           │   ├── profile.controller.ts
│   │           │   ├── profile.service.ts
│   │           │   ├── profile.module.ts
│   │           │   └── dto/update-profile.dto.ts
│   │           ├── cas/
│   │           ├── health/
│   │           ├── onboarding/
│   │           ├── import/                    # Excel Import — validate, import, download template ✅
│   │           │   ├── import.controller.ts   # POST /transactions/import/validate, /import, GET /import/template
│   │           │   ├── import.service.ts
│   │           │   ├── import.module.ts
│   │           │   ├── import.service.spec.ts
│   │           │   └── dto/import.dto.ts
│   │           └── transaction/               # GET list (+ filter source) + detail + reclassify + bulk-reclassify ✅
│   └── frontend/
│       ├── vite.config.ts
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx                        # routes: dashboard, transactions, review, reports, accounts, analytics, copilot, settings ✅
│           ├── contexts/auth-context.tsx
│           ├── contexts/theme-context.tsx
│           ├── routes/ProtectedRoute.tsx
│           ├── lib/
│           │   ├── api.ts                     # export: api, getApiData, postApiData, patchApiData, deleteApiData
│           │   ├── remember-me.ts             # localStorage rememberMe + email
│           │   ├── plan-labels.ts           # PLAN_LABELS + PLAN_ORDER dùng chung Partner pages ✅
│           │   ├── plan.ts                  # formatCopilotQuota, resolveCopilotQuota ✅
│           │   ├── date-range.ts            # dayIsoRange() cho query theo ngày ✅
│           │   ├── dashboard-transactions.ts  # chart helpers (status breakdown, revenue trend 7 ngày)
│           │   └── ...
│           ├── types/
│           │   ├── transaction.ts
│           │   └── partner.ts               # PartnerTenant, PartnerTenantsResponse ✅
│           ├── hooks/
│           │   ├── useReviewCount.ts
│           │   ├── useSidebarCollapsed.ts      # persist collapse sidebar localStorage ✅
│           │   ├── useCopilotConversations.ts  # infinite query sidebar (cursor, staleTime 30s) + refreshListAfterChat + quota optimistic ✅
│           │   ├── useCopilotHistoryPage.ts    # offset pagination cho Settings CopilotHistoryTab ✅
│           │   └── useNotifications.ts, useDebouncedValue
│           ├── components/
│           │   ├── copilot/
│           │   │   ├── CopilotSourceChips.tsx    # Chip nguồn tham khảo (internal_data/knowledge/web_search) ✅
│           │   │   ├── CopilotLoadingStatus.tsx  # Loading dots / tool activity indicator khi SSE streaming ✅
│           │   │   ├── CopilotMessageActions.tsx # Copy button hover-reveal trên assistant messages (Phase 5) ✅
│           │   │   ├── CopilotQuotaSummary.tsx     # Quota bar sidebar + card Settings (ẩn khi unlimited) ✅
│           │   │   └── CopilotSidebar.tsx        # Sidebar grouped by date, rename/delete menu, scroll load-more ✅
│           │   ├── layout/Sidebar.tsx         # 8 nav item, badge review, NotificationBell, ProfileDialog (click user footer) ✅
│           │   ├── profile/ProfileDialog.tsx  # Dialog hồ sơ cá nhân + doanh nghiệp + upload avatar + đổi mật khẩu ✅
│           │   ├── profile/ChangePasswordPanel.tsx  # Form 2 bước đổi mật khẩu (nhúng trong ProfileDialog) ✅
│           │   ├── dashboard/                 # stat cards, charts (không còn BankStatusCard trên Dashboard) ✅
│           │   ├── shared/                    # NotificationBell, PlanGate, WelcomeTour, UserAvatar, ErrorBoundary ✅
│           │   └── ui/                        # + checkbox.tsx, progress, separator, switch, tabs; sheet.tsx mở rộng side='left'|'right' (Phase 5) ✅
│           ├── pages/
│           │   ├── auth/                      # LoginPage, RegisterPage, VerifyEmailPage, AcceptInvitePage, ForgotPasswordPage, ResetPasswordPage ✅
│           │   ├── onboarding/                # OnboardingPage, OnboardingCallbackPage ✅
│           │   ├── dashboard/DashboardPage.tsx # summary API + stat cards clickable + CTA onboarding ✅
│           │   ├── accounts/AccountsPage.tsx  # Danh mục TK TT133 + tìm mã/tên ✅
│           │   ├── transactions/              # TransactionsPage (filter source, nút Import Excel, badge amber, bulk-reclassify) + TransactionDetailSheet + ImportTransactionsDialog ✅
│           │   ├── review/ReviewPage.tsx      # Human Review queue (confirm/correct/skip) + SwipeableReviewCard mobile ✅
│           │   ├── reports/ReportsPage.tsx    # Báo cáo tháng + export Excel ✅
│           │   ├── analytics/AnalyticsPage.tsx # So sánh tháng, BarChart thu/chi, top 5 danh mục ✅
│           │   ├── copilot/CopilotPage.tsx    # AI Copilot chat — 2-column layout (sidebar+chat), mobile Sheet, localStorage persistence, history from DB, infinite scroll, stop button (Phase 4+5) ✅
│           │   ├── settings/SettingsPage.tsx  # Tabs: Banking/Threshold/Notifications/Team/Nhật ký/Billing/Lịch sử Copilot ✅
│           │   ├── settings/CopilotHistoryTab.tsx  # Phase 7 — bảng lịch sử Copilot trong Settings ✅
│           │   ├── components/audit/AuditLogPanel.tsx  # Bảng nhật ký dùng chung ✅
│           │   └── partner/
│           │       ├── PartnerLayout.tsx          # Sidebar: Dashboard/DN/Thanh toán/Nhật ký/Gói dịch vụ ✅
│           │       ├── PartnerDashboardPage.tsx   # Stat cards + biểu đồ doanh thu theo gói (hint MRR/plan khi lọc ngày) ✅
│           │       ├── PartnerTenantsPage.tsx     # Danh sách tenant paginate 20/trang, filter, dialog chi tiết + đổi gói ✅
│           │       ├── PartnerPaymentsPage.tsx    # Lịch sử thanh toán (bảng payment_orders + filter + summary) ✅
│           │       ├── PartnerAuditPage.tsx       # /partner/audit-logs — audit log toàn hệ thống ✅
│           │       └── PartnerPlansPage.tsx       # 4 plan cards, bảng giá, dialog chỉnh giá ✅
├── packages/shared-types/src/index.ts        # TransactionStatus.CLASSIFIED (bỏ MATCHED), ClassificationType, AccountType ✅
├── biome.json, package.json, turbo.json, pnpm-workspace.yaml
```

---

## API endpoints hiện tại (prefix `/api/v1`)

### Đang chạy ✅

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Tạo tenant + admin + gửi OTP email (chưa cấp token) |
| POST | `/auth/verify-email` | Public | Xác thực OTP → JWT + refresh cookie |
| POST | `/auth/resend-verification` | Public | Gửi lại OTP (cooldown 60s) |
| POST | `/auth/forgot-password` | Public | Gửi OTP đặt lại mật khẩu qua email |
| POST | `/auth/resend-password-reset` | Public | Gửi lại OTP đặt lại mật khẩu |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu bằng OTP |
| POST | `/auth/login` | Public | JWT access + refresh cookie; body `rememberMe` điều khiển TTL cookie/session |
| POST | `/auth/refresh` | Cookie | Rotate tokens |
| POST | `/auth/logout` | Cookie | Revoke refresh |
| GET | `/auth/me` | Bearer JWT | User hiện tại |
| POST | `/auth/change-password/request` | Bearer JWT | Xác thực mật khẩu cũ + gửi OTP email |
| POST | `/auth/change-password/resend` | Bearer JWT | Gửi lại OTP đổi mật khẩu |
| POST | `/auth/change-password/confirm` | Bearer JWT | Xác nhận OTP → đổi mật khẩu + revoke sessions |
| GET | `/profile` | Bearer JWT | Hồ sơ cá nhân + doanh nghiệp (mọi role đã login, kể Cas Partner) |
| PATCH | `/profile` | Bearer JWT | Cập nhật tên cá nhân (mọi role); tên doanh nghiệp (Admin) |
| POST | `/profile/avatar` | Bearer JWT | Upload avatar multipart → Azure Blob |
| GET | `/cas/health` | Public | |
| POST | `/onboarding/banking/grant-token` | Admin, Accountant | |
| POST | `/onboarding/banking/callback` | Admin, Accountant | |
| GET | `/onboarding/status` | Bearer JWT | |
| POST | `/webhook/cas` | Public (signature) | → enqueue `ai-classify` |
| GET | `/transactions` | Bearer JWT | Filter: `status`, `source` (cas\|import), `from_date`, `to_date`, `search` (nội dung/mã GD/người gửi), pagination — kèm `classification` nested |
| GET | `/transactions/import/template` | Admin, Accountant | Download file Excel template (.xlsx) |
| POST | `/transactions/import/validate` | Admin, Accountant | Validate file Excel (multipart) — trả lỗi hoặc preview rows |
| POST | `/transactions/import` | Admin, Accountant | Import giao dịch từ Excel (multipart) — trả `{ imported, skipped, errors }`, ghi audit log |
| GET | `/transactions/:id` | Bearer JWT | Kèm `classification` nested |
| POST | `/transactions/:id/reclassify` | Admin, Accountant | Đẩy lại job AI cho giao dịch `pending` (enqueue `ai-classify` vào `webhook-processing`) |
| POST | `/transactions/bulk-reclassify` | Admin, Accountant | Đẩy lại job AI hàng loạt — body `{ ids: string[] }`, tối đa 50 GD/lần, chỉ `pending` |
| GET | `/transactions/:id/classification` | Bearer JWT | Chi tiết định khoản |
| POST | `/transactions/:id/classification` | Admin, Accountant | Ghi đè thủ công |
| GET | `/review/queue` | Bearer JWT | Hàng chờ Human Review |
| GET | `/review/count` | Bearer JWT | Đếm số GD chờ review — FE poll 20s cho badge/toast |
| POST | `/review/:id/confirm` | Admin, Accountant | Xác nhận |
| POST | `/review/:id/correct` | Admin, Accountant | Sửa TK Nợ/Có |
| POST | `/review/:id/skip` | Admin, Accountant | Bỏ qua |
| GET | `/accounts` | Bearer JWT | Danh mục TT133 |
| POST | `/accounts` | Admin, Accountant | Thêm tài khoản |
| PUT | `/accounts/:id` | Admin, Accountant | Sửa tài khoản |
| DELETE | `/accounts/:id` | Admin | Ẩn tài khoản |
| GET | `/reports/summary` | Bearer JWT | Tổng hợp tháng (thu/chi/stats — không kèm danh sách TK) |
| GET | `/reports/account-breakdown` | Bearer JWT | Chi tiết theo TK — filter `search`, `accountType`, pagination |
| GET | `/reports/by-account` | Bearer JWT | Chi tiết theo TK |
| GET | `/reports/export` | Bearer JWT | Export Excel (.xlsx) |
| GET | `/reports/comparison` | Bearer JWT | So sánh tháng này vs tháng trước |
| GET | `/reports/top-accounts` | Bearer JWT | Top 5 TK chi/thu nhiều nhất |
| GET | `/ai/copilot/conversations` | Bearer JWT (Starter+) | Danh sách conversations của user — **cursor** `?before=<uuid>&limit=` (sidebar, default 20) → `{ items, hasMore, cursorNext }`; **offset** `?page=&limit=&fromDate=&toDate=` (Settings) → `{ items, total, page, limit, totalPages }` |
| GET | `/ai/copilot/conversations/:id` | Bearer JWT (Starter+) | Chi tiết 1 conversation + messages cursor-based `?before=<uuid>&limit=` (default 10, max 50); trả `{ id, title, messages, hasMore, oldestMessageId }` |
| PATCH | `/ai/copilot/conversations/:id` | Bearer JWT (Starter+) | Đổi tên conversation — body `{ title }` (1–100 ký tự, trim); 404 nếu không tìm thấy / không phải của user |
| DELETE | `/ai/copilot/conversations/:id` | Bearer JWT (Starter+) | Xóa conversation + cascade messages; 204 No Content |
| POST | `/ai/copilot` | Bearer JWT | AI Copilot chat — `COPILOT_USE_FUNCTION_CALLING=1`: `runTools` 8 tools (+ `search_casso_public` khi bật) + trả `meta.activities`; =0: prompt stuffing cũ; tích hợp lịch sử: trả `conversationId`, khi gửi `conversationId` thì history đọc từ DB thay vì FE |
| POST | `/ai/copilot/stream` | Bearer JWT | SSE streaming copilot — emit `activity`/`delta`/`done` (done kèm `conversationId`); setup conversation+userMsg trước flushHeaders; `try/catch` sau flushHeaders; flag=0 fallback `chatCopilot()`; `@Res()` bypass ResponseInterceptor |
| GET | `/notifications` | Bearer JWT (mọi role tenant) | Danh sách thông báo in-app (kèm unreadCount) |
| GET | `/notifications/stream` | Public (JWT qua `?token=`) | SSE push thông báo mới — EventSource không gửi được Authorization header |
| GET | `/notifications/unread-count` | Bearer JWT | Số thông báo chưa đọc |
| PATCH | `/notifications/:id/read` | Bearer JWT | Đánh dấu 1 thông báo đã đọc |
| PATCH | `/notifications/read-all` | Bearer JWT | Đánh dấu tất cả đã đọc |
| DELETE | `/notifications/all` | Bearer JWT | Xóa tất cả thông báo (scope tenant + user) |
| DELETE | `/notifications` | Bearer JWT | Xóa nhiều thông báo (body `{ ids: string[] }`) |
| DELETE | `/notifications/:id` | Bearer JWT | Xóa 1 thông báo |
| GET | `/settings/threshold` | Admin, Accountant | Đọc threshold hiện tại |
| PUT | `/settings/threshold` | Admin | Cập nhật threshold (50–99) |
| GET | `/settings/notifications` | Admin | Đọc cấu hình notification (Redis) |
| PUT | `/settings/notifications` | Admin | Cập nhật cấu hình notification |
| POST | `/settings/notifications/test-slack` | Admin | Gửi thử Slack webhook (Pro+) |
| GET | `/team/members` | Admin | Danh sách thành viên tenant (kèm `emailVerifiedAt`) |
| POST | `/team/members` | Admin | Mời thành viên — gửi email link kích hoạt |
| POST | `/team/members/:id/resend-invite` | Admin | Gửi lại email mời (chỉ thành viên chưa kích hoạt) |
| DELETE | `/team/members/:id` | Admin | Xóa thành viên (chặn tự xóa / xóa admin cuối) |
| GET | `/auth/invite?token=` | Public | Xem thông tin lời mời (email, DN, vai trò) |
| POST | `/auth/accept-invite` | Public | Đặt mật khẩu + kích hoạt + cấp JWT |
| GET | `/audit-logs` | Admin, Accountant | Nhật ký hoạt động tenant — phân trang, lọc `action`, `fromDate`, `toDate` |
| GET | `/billing/plans` | Admin, Accountant | Danh sách gói từ `plan_pricing` |
| GET | `/billing/current-plan` | Admin, Accountant | Gói hiện tại — kèm `usageBreakdown { fromBank, fromImport }`, `copilotQuota`, `copilotUsed` |
| GET | `/billing/usage-history` | Admin | Lịch sử sử dụng quota |
| POST | `/billing/upgrade` | Admin | Tạo PaymentOrder + link PayOS (mock fallback khi chưa có keys) |
| POST | `/billing/upgrade/:orderCode/mock-confirm` | Admin | Dev-only — giả lập xác nhận thanh toán upgrade |
| GET | `/billing/overage-orders` | Admin | Đơn phí vượt quota đang chờ |
| POST | `/billing/overage-order` | Admin | Tạo đơn overage + PayOS link |
| POST | `/billing/overage-order/:orderCode/mock-confirm` | Admin | Dev-only — giả lập thanh toán overage |
| POST | `/webhook/payos-billing` | Public (PayOS signature) | Callback thanh toán PayOS → `confirmPayment()` |
| GET | `/partner/tenants` | Cas Partner | Danh sách tenant — filter `search`, `status`, `plan`; `?page=&limit=` → `{ items, page, limit, total, totalPages }` (không truyền page/limit = trả full list) |
| GET | `/partner/stats` | Cas Partner | Tổng DN/active/suspended/GD tháng/doanh thu/AI accuracy toàn hệ thống — `?fromDate=&toDate=` lọc chỉ số theo thời gian (GD, thực thu PayOS, AI accuracy); DN/MRR vẫn snapshot hiện tại |
| GET | `/partner/revenue-trend` | Cas Partner | Doanh thu theo tháng (từ `payment_orders` status=paid) — kèm breakdown theo gói (`free/starter/pro/enterprise`); mặc định 6 tháng, `?fromDate=&toDate=` lọc khoảng (tối đa 24 tháng) |
| GET | `/partner/payments` | Cas Partner | Lịch sử thanh toán toàn hệ thống (`payment_orders` + tên DN) — phân trang server-side (`?page=&limit=&status=&plan=&search=&fromDate=&toDate=`, lọc ngày theo `createdAt`), trả `{ items, page, limit, total, totalPages, summary }` — `summary` cũng tính theo cùng bộ lọc |
| PATCH | `/partner/tenants/:id/suspend` | Cas Partner | Khóa tài khoản doanh nghiệp |
| PATCH | `/partner/tenants/:id/activate` | Cas Partner | Mở khóa tài khoản doanh nghiệp |
| PATCH | `/partner/tenants/:id/plan` | Cas Partner | Đặt gói cho tenant (không chặn downgrade) |
| GET | `/partner/tenants/:id` | Cas Partner | Chi tiết 1 tenant (plan + GD tháng + AI accuracy + members) |
| GET | `/partner/plan-pricing` | Cas Partner | Xem giá/quota từng gói |
| PATCH | `/partner/plan-pricing/:plan` | Cas Partner | Sửa giá/quota/phí vượt/copilotQuota (chặn sửa `free`) |
| GET | `/partner/audit-logs` | Cas Partner | Audit log toàn hệ thống — lọc `tenantId`, `action`, phân trang |

Swagger UI: `http://localhost:3000/api/docs`

---

## Database schema (sau migration `klassi_ai_pivot`)

**Giữ nguyên:** `tenants`, `users`, `transactions`, `cas_grants`, `subscriptions`, `payment_orders`, `audit_logs`

**Đã xóa:** ~~`invoices`~~, ~~`customers`~~, ~~`invoice_matches`~~, ~~enum `InvoiceStatus`~~, ~~enum `MatchType`~~

**Đã thêm:**
```
chart_of_accounts
  id, tenant_id, account_code, account_name, account_type (AccountType enum),
  parent_code, is_active, created_at, updated_at
  unique: (tenant_id, account_code)

transaction_classifications
  id, tenant_id, transaction_id (unique FK → transactions),
  debit_account, credit_account, amount (Decimal),
  confidence_score (Int), classification_type (auto|manual),
  classified_by, reason, embedding (vector 1536),
  status (TransactionStatus), created_at, updated_at
```

**Đổi:**
- `tenants.matching_threshold` → `tenants.classification_threshold` (default 85)
- `TransactionStatus` enum: `matched` → `classified`
- `transactions`: bỏ cột `confidence_score`, thêm relation `classification`; thêm `source (TransactionSource)`, `direction (TransactionDirection)`, `importBatchId (String?)`
- `subscriptions`: thêm `copilot_used_this_cycle (Int, default 0)` — đếm lượt chat Copilot trong chu kỳ hiện tại, reset cùng `transactionUsedThisCycle` khi hết chu kỳ
- `plan_pricing`: thêm `copilot_quota (Int, default -1)` — số lượt Copilot/tháng; -1 = unlimited (Enterprise), 0 = blocked (Free)
- `NotificationType` enum: thêm `copilot_quota_warning`, `copilot_quota_exceeded`
- `CopilotMessageRole` enum (mới): `user`, `assistant`

**Đã thêm (Copilot History):**
```
copilot_conversations
  id (uuid), tenant_id (FK → tenants cascade), user_id (FK → users cascade),
  title (String, default "Cuộc chat mới"), created_at, updated_at
  index: [tenant_id, user_id, updated_at DESC]

copilot_messages
  id (uuid), conversation_id (FK → copilot_conversations cascade),
  role (CopilotMessageRole), content (Text), activities (Json?),
  is_partial (Boolean default false), created_at
  index: [conversation_id, created_at]
```
- `TransactionSource` enum: `cas` (từ webhook Cas Balance Hook), `import` (nhập tay từ Excel)
- `TransactionDirection` enum: `in` (thu), `out` (chi)

---

## Nguyên văn `shared-types/src/index.ts`

```typescript
export enum Role {
  CAS_PARTNER = 'cas_partner',
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CLASSIFIED = 'classified',
  REVIEW = 'review',
  SKIPPED = 'skipped',
}

export enum ClassificationType {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search';
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
}
export interface CopilotConversationSummary {
  id: string; title: string; createdAt: string; updatedAt: string;
  messageCount: number; lastMessage?: string;
}
export interface CopilotMessageDto {
  id: string; role: 'user' | 'assistant'; content: string;
  activities?: CopilotActivity[]; createdAt: string; isPartial: boolean;
}
export interface CopilotConversationDetail {
  id: string; title: string; createdAt: string; updatedAt: string;
  messages: CopilotMessageDto[]; hasMore: boolean; oldestMessageId: string | null;
}
export interface CopilotConversationsListResponse {
  items: CopilotConversationSummary[]; hasMore: boolean; cursorNext: string | null;
}

// + CasGrantStatus, SubscriptionPlan, SubscriptionStatus, PaymentOrderStatus, ApiResponse<T>
```

---

## Scripts thật — root `package.json`

```
prepare      → husky
lint-staged  → biome check --write --no-errors-on-unmatched
```

---

## Scripts thật — `apps/backend/package.json`

```
prisma:generate  → prisma generate
prisma:migrate   → prisma migrate deploy
postinstall      → prisma generate
```

**Dependencies đáng chú ý:** `xlsx` (export Excel), `openai`, `bullmq`, `@nestjs/bullmq`, `@nestjs/throttler`, `@nestjs/schedule`, `@payos/node`, `resend`, `@prisma/client ^6`, `@xcash/shared-types`.

**Build:** NestJS SWC builder. `@Roles()` decorator nhận `Role` từ `@xcash/shared-types` (không phải `@prisma/client`) — quan trọng, dùng sai sẽ lỗi type.

---

## Lưu ý kỹ thuật quan trọng

- **`api` export từ `@/lib/api`** — axios instance tên `api` (không phải `apiClient`). Dùng `api.get()`, `api.post()` trong các page mới.
- **`TableSkeleton` props:** `rows` và `columns` (không phải `cols`).
- **`@Roles()` decorator:** nhận `Role` từ `@xcash/shared-types`, enum value là `Role.ADMIN`, `Role.ACCOUNTANT` (UPPERCASE) — không phải `Role.admin`.
- **AI job name:** `ai-classify` (không còn `ai-matching`). Constant `AI_CLASSIFY_JOB` export từ `classification.processor.ts`.
- **Threshold mặc định:** 85% (config key `AI_CLASSIFICATION_THRESHOLD`). Dưới ngưỡng → status = `review`.
- **TT133 seed:** tự động chạy sau khi tạo tenant (`auth.service.ts` gọi `chartOfAccountsService.seedTt133()` sau `$transaction`). Non-blocking (`.catch(() => {})`).
- **pgvector few-shot:** `embedding.service.ts` → `findSimilarClassifications()` trả về 5 ví dụ gần nhất của tenant để feed vào OpenAI prompt.
- **Review count badge = polling:** `useReviewCount` dùng `refetchInterval: 20_000` gọi `GET /review/count` qua axios (có Bearer header) — không dùng SSE.
- **In-app notification realtime = SSE + fallback poll:** `GET /notifications/stream?token=<accessToken>` — verify JWT thủ công trong service vì `EventSource` không gửi được `Authorization` header. FE `useNotifications` invalidate query khi nhận SSE event; giữ `refetchInterval: 60_000` làm fallback.
- **ShadCN mới (Progress/Separator/Switch/Tabs) dùng `radix-ui` umbrella package**, KHÔNG dùng `@radix-ui/react-progress` v.v. riêng lẻ — dự án chỉ có `radix-ui` (^1.6.1) trong `package.json`, import theo pattern `import { Progress as ProgressPrimitive } from 'radix-ui'` giống `select.tsx` đã có sẵn. Chạy `pnpm dlx shadcn@latest add <name>` có thể ghi nhầm vào thư mục `@/` sai chỗ (alias resolve lỗi) — nếu gặp, viết file thủ công theo pattern của component ShadCN có sẵn trong repo (`select.tsx`) thay vì tin theo output CLI.
- **Team invite:** Admin mời qua email — user pending tự đặt mật khẩu qua link `/accept-invite?token=` (Redis token TTL 7 ngày, env `TEAM_INVITE_TTL_SECONDS`). Login trước khi kích hoạt → `403 INVITE_PENDING`.
- **Audit log actor:** field `actor` trong DB là string — userId (UUID), `'system'`, `'ai'`, hoặc legacy `'cas_partner'`. API đọc map sang label tiếng Việt; Partner mới ghi `userId` thật.
- **`dto.role as unknown as import('@prisma/client').Role`** — cast cần thiết trong `team.service.ts` vì `Role` từ `@xcash/shared-types` (dùng cho DTO/RBAC) không trùng type với `Role` enum của Prisma Client dù cùng giá trị string.
- **Frontend dependencies đáng chú ý:** `qrcode.react` (`QRCodeSVG`) — PayOS v2 trả về raw VietQR string, không phải URL; phải render bằng `QRCodeSVG` thay vì `<img src>`. Import: `import { QRCodeSVG } from 'qrcode.react'`.
- **Copilot function calling:** `COPILOT_USE_FUNCTION_CALLING=1` bật `runTools` — model gọi đúng tool khi cần, không preload context cố định. `tenantId` chỉ từ JWT closure (không expose trong tool schema). Tránh circular dep: `CopilotToolService` dùng Prisma trực tiếp cho `review_count` và `search_transactions`, không import `ClassificationModule`/`TransactionModule`. `AiModule` import `OnboardingModule` (không import `BankingModule`). `maxChatCompletions: 5`, `temperature: 0.3`. Response: `{ reply, meta?: { activities: CopilotActivity[] } }` — FE hiện chip nguồn bằng `CopilotSourceChips`.
- **Copilot SSE streaming (Phase 2 + hardening):** `POST /ai/copilot/stream` dùng `@Res()` bypass `ResponseInterceptor`. Activity label từ `getStreamingActivityMeta()` / `TOOL_ACTIVITIES` (một nguồn với chip cuối). Runner emit `functionToolCall` → SSE `activity`; `content` → `delta`; sau `finalContent()` → `done` (`{ reply, meta }`). Controller bọc logic sau `flushHeaders()` trong `try/catch` — lỗi vẫn emit `done` với message lỗi. FE: `fetch` + `ReadableStream` + SSE buffer (`feedSseChunk`/`flushSsePending`) xử lý frame cắt TCP; throw nếu không nhận `done` → fallback axios `/ai/copilot`.
- **`search_transactions` tool:** Prisma trực tiếp — `content`+`senderAccount` ILIKE keyword; `source` optional (`cas` → `grantId: { not: null }`, `import` → `grantId: null`, `all`/bỏ trống = không lọc source); limit 1–20 (required trong schema).
- **`search_casso_public` tool (Phase 3):** Tavily `@tavily/core` singleton trong `CopilotToolService`, query thêm `site:casso.vn`, cache 24h theo base64(query) key. Chỉ active khi `COPILOT_CASSO_SEARCH_ENABLED=1` + `TAVILY_API_KEY` set. `buildCopilotTools()` nhận `configService?` để kiểm tra flag — nếu không truyền (backward compat) thì tool không xuất hiện. `TOOL_ACTIVITIES` có entry `web_search` cho tool này.
- **Copilot tools cache keys:** `copilot:tool:summary:{tenantId}:{y}-{m}` TTL=300s; `copilot:tool:banking:{tenantId}` TTL=60s. Key cũ `copilot:context:{tenantId}:{y}-{m}` còn dùng khi flag=0 (fallback).
- **Copilot conversation history:** khi `POST /ai/copilot` hoặc `POST /ai/copilot/stream` nhận `conversationId`, backend dùng history từ DB (không dùng FE-provided `history[]`) — chặn injection tấn công qua history. Conversation tự tạo (`findOrCreate`) nếu không có `conversationId`; `saveAssistantMessage` + `triggerAutoTitle` đều fire-and-forget. SSE: setup conversation + saveUserMessage trước `res.flushHeaders()` để lỗi 404 trả đúng HTTP code, không bị nuốt vào SSE stream.
- **Copilot stop generation (Phase 4):** `wasAborted` flag set bởi `req.on('close')` — track sau `res.flushHeaders()` (pre-flush close không trigger). `runnerInstance?.abort()` dừng OpenAI stream runner. `accumulatedContent` tích lũy delta ngay cả khi runner chạy — nếu abort với content > blank → `saveAssistantMessage(..., isPartial=true)`. `incrementAndNotify` bỏ qua khi abort (quota không tính). FE: `sendViaStream()` trả `null` khi `AbortError` (không throw) → `sendMessage()` nhận null = aborted, không fallback JSON, không retry.
- **Copilot `isPartial` bubble:** `Message` interface FE thêm `isPartial?: boolean`. Khi `sendViaStream()` catch `AbortError`, push bubble `{ role: 'assistant', content: accumulatedContent, isPartial: true }` vào state. Khi load từ DB, `mapDto(m)` map `m.isPartial` vào Message. Bubble có `isPartial=true` render badge "Đã dừng" (StopCircle icon) dưới content.
- **Copilot sidebar localStorage key:** `xcash_copilot_conv_{userId}` — lưu `activeConversationId` hiện tại. Khi tải trang, đọc key này để restore conversation cuối. Khi tạo conversation mới (nhận `conversationId` từ server), persist ngay. `handleNewChat()` clear key (persist `null`). Mỗi user có key riêng tránh conflict khi nhiều user trên cùng máy.
- **Copilot infinite scroll upward:** `IntersectionObserver` trên sentinel `<div ref={sentinelRef}>` đặt đầu danh sách messages. Observer tạo lại khi `hasMoreMessages`/`isLoadingOlder`/`activeConversationId`/`oldestMessageId` thay đổi. Khi visible và `!isLoadingOlder && hasMoreMessages` → `handleLoadOlderMessages()`. Scroll position preserve: capture `prevScrollHeight = chatContainerRef.current.scrollHeight` vào ref trước `setState`, sau render dùng `useLayoutEffect` (synchronous trước paint) restore `scrollTop = newHeight - prevHeight`.
- **`SheetContent side` prop:** `sheet.tsx` mở rộng hỗ trợ `side?: 'left' | 'right'` (default `right`). `SHEET_SIDE` map định nghĩa class Tailwind cho từng hướng (slide-in-from-right vs slide-in-from-left). Mobile sidebar Copilot dùng `side="left"`.
- **Copilot performance hardening (Phase 6):** `chat()`/`streamChat()` chạy `Promise.all([findOrCreate, getFinancialContext])` song song khi flag=0 (bỏ qua khi flag=1 vì dùng tools). `streamChat()` tách thành 2 method: `streamChat()` (public, quản lý Redis SSE concurrency INCR/DECR) gọi `streamChatInternal()` (private, chứa toàn bộ logic chat/stream cũ) — giữ nguyên hành vi abort/partial/quota, chỉ bọc thêm layer giới hạn kết nối.
- **`CopilotThrottlerGuard` (Phase 6):** `common/guards/copilot-throttler.guard.ts` — extends `ThrottlerGuard`, override `getTracker()` trả `userId` (khác `TenantThrottlerGuard` global trả `tenantId`). Áp dụng `@UseGuards(CopilotQuotaGuard, CopilotThrottlerGuard)` + `@Throttle({ ttl: 60_000, limit: 30 })` chỉ trên `chat()` (JSON). `ThrottlerModule` đã `@Global()` trong `@nestjs/throttler` nên không cần import lại ở `AiModule`, chỉ cần khai báo guard làm provider.
- **SSE concurrent limit (Phase 6, 8.4):** `streamChat()` gắn `@SkipThrottle()` (bỏ qua `TenantThrottlerGuard` global — theo đúng khuyến nghị spec 9.7, tránh 429 sau khi đã `flushHeaders()` dù thực tế guard luôn chạy trước handler). Redis key `copilot:sse:active:{userId}` — `INCR` + `EXPIRE 120s`, nếu > 3 kết nối đồng thời thì `DECR` lại và trả `res.status(429).json(...)` trước khi set SSE headers. `DECR` luôn chạy trong `finally` của wrapper, không phụ thuộc luồng abort/complete bên trong.
- **Dangling user message cleanup (Phase 6, 9.9):** `CopilotConversationService.deleteMessage(id)` xóa message (nuốt lỗi nếu không tồn tại). `chat()`: bọc AI call trong try/catch, lỗi thật (không phải guard/validation) → xóa `userMsg` rồi `throw err` để exception filter trả lỗi đúng. `streamChat()`: trong catch block hiện có, chỉ xóa `userMsg` nếu `!wasAborted && !accumulatedContent.trim()` — có nội dung dù lỗi giữa chừng vẫn coi là partial (giữ nguyên hành vi Phase 4), tránh xóa nhầm nội dung user đã thấy.
- **`CopilotQuotaGuard` method-level:** guard này đặt tại từng method `@UseGuards(CopilotQuotaGuard)` trên `chat()` và `streamChat()`, KHÔNG phải ở controller-level — để 4 CRUD conversation endpoint không bị chặn khi user vượt quota. Controller vẫn có class-level `@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)`.
- **Copilot Quota guard chain:** `JwtAuthGuard → RolesGuard → PlanGuard → CopilotQuotaGuard` — thứ tự này quan trọng. `CopilotQuotaGuard` luôn đọc DB (no cache) để tránh race condition khi nhiều request đến cùng lúc. Sentinel `-1` (Enterprise) bypass hoàn toàn check quota. Guard store `{ id: subscription.id }` vào `request[COPILOT_SUBSCRIPTION_KEY]` để controller dùng cho `$increment`. Increment là fire-and-forget sau `writeEvent('done')` — lỗi increment không fail request.
- **Copilot Quota notification dedup:** `checkCopilotQuotaNotifications()` trong `NotificationService` dùng `createOncePerCycle(tenantId, type, cycleStart)` để chỉ gửi notification 1 lần/chu kỳ per loại (`copilot_quota_warning` ≥80%, `copilot_quota_exceeded` ≥100%). Nếu quota=-1 (unlimited) thì không gửi gì.
- **Overage billing flow:** (1) webhook banking ghi `usageLog(metric='overage_transaction')` khi Starter/Pro vượt quota; (2) cron `BillingCycleService` 2am daily tìm sub hết `currentCycleEnd` → gọi `createOverageOrder()` nếu có overage → reset `transactionUsedThisCycle=0` và `currentCycleEnd`; (3) tenant thấy banner cam trên BillingTab → click "Thanh toán ngay" → tạo PayOS order `orderType='overage'`; (4) webhook PayOS xác nhận → `confirmPayment()` nhận biết `orderType` → chỉ mark paid + auditLog, không đổi gói. Giá đọc từ `planPricing.overagePricePerTransaction` (không hardcode).
- **`payment_orders.order_type`:** field `orderType` (default `'upgrade'`) — Prisma client typed bình thường, không cần `as any`.
- **Excel Import:** `POST /transactions/import` và `/validate` nhận `multipart/form-data` với field `file`. Backend dùng `xlsx` package đọc file, validate từng row, tạo transaction với `source = TransactionSource.import` và `importBatchId` chung cho cả batch. Template download từ `GET /transactions/import/template` (buffer xlsx trả về).
- **`RolesGuard` + `@Public()`:** `RolesGuard.canActivate` kiểm tra `IS_PUBLIC_KEY` trước — nếu route đánh dấu `@Public()` thì bỏ qua toàn bộ auth check (kể cả cas_partner block). Điều này cho phép `/notifications/stream?token=` (đã `@Public()`) hoạt động bình thường dù `request.user` là undefined.
- **Rate limiting per-tenant:** `TenantThrottlerGuard` override `getTracker()` để dùng `tenantId` (fallback `userId` rồi IP) làm key thay vì mặc định theo IP — vì nhiều user cùng tenant có thể gọi API từ IP khác nhau, và Cas Partner (không có `tenantId`) vẫn cần giới hạn theo user. Áp dụng global qua `APP_GUARD`, bỏ qua `/health`. Giới hạn: `RATE_LIMIT_PER_MINUTE` (default 120 request/phút/tenant).
- **Tenant suspend chặn login:** `auth.service.ts` → `login()` tra `subscription` mới nhất theo `tenantId`, nếu `status === 'suspended'` thì từ chối đăng nhập luôn (không cho vào hệ thống dù JWT hợp lệ) — khớp edge case đã ghi trong `rbac.md`.

---

## Quy tắc giữ file này luôn đúng

- Cập nhật ngay sau khi thêm module mới, thêm page, đổi dependency lớn, migrate schema
- Nếu thực tế code lệch với file này → tin thực tế code, sửa file này
- Đây là file duy nhất agent đọc đầu tiên — phải đủ đọc xong là biết bước tiếp theo
