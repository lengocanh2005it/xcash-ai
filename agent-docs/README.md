# Agent Docs — Mục lục

Tài liệu này dành cho AI coding agent (Claude Code) và developer làm việc trên monorepo X-Cash AI. Đọc theo thứ tự dưới đây tùy việc bạn đang làm.

## Bắt đầu từ đâu

**Luôn đọc [`00-current-state.md`](./00-current-state.md) trước tiên** — file đó chụp chính xác trạng thái repo ngay lúc này (cây file thật, script thật, cái gì đã có/chưa có). Đọc xong file đó thường là đủ để biết bước tiếp theo, không cần `find`/`grep`/`ls` lại từ đầu.

| Bạn đang làm gì | Đọc file nào |
|---|---|
| **Bất kỳ việc gì** — đọc trước tiên | [`00-current-state.md`](./00-current-state.md) |
| Mới vào repo, cần hiểu tổng quan nghiệp vụ | [`reference/business-overview.md`](./reference/business-overview.md) |
| Setup môi trường dev lần đầu | [`04-environment-setup.md`](./04-environment-setup.md) |
| Thêm app/package mới vào monorepo | [`01-monorepo-structure.md`](./01-monorepo-structure.md) |
| Viết code backend (NestJS module, controller, service) | [`02-backend-conventions.md`](./02-backend-conventions.md) |
| Viết code frontend (React component, page, hook) | [`03-frontend-conventions.md`](./03-frontend-conventions.md) — **gồm palette Casso/payOS, responsive, dark mode, [ShadCN components](https://ui.shadcn.com/docs/components)** |
| Viết Prisma schema / migration | [`reference/database-schema.md`](./reference/database-schema.md) |
| Thêm API endpoint mới, cần biết role nào được gọi | [`reference/rbac.md`](./reference/rbac.md) |
| Cần hiểu 1 luồng nghiệp vụ cụ thể (onboarding, webhook, billing...) | [`reference/user-journey.md`](./reference/user-journey.md) |
| **Không hiểu định khoản / Nợ-Có / TT133 / báo cáo thu chi** | [`reference/tt133-accounting.md`](./reference/tt133-accounting.md) — giải thích dễ hiểu + tham chiếu code |
| Build UI 1 màn hình cụ thể | [`reference/ui-design.md`](./reference/ui-design.md) — mục **Brand palette (Casso/payOS)** |
| Biết task nào thuộc sprint nào, ai phụ trách | [`reference/sprint-plan.md`](./reference/sprint-plan.md) |
| Luồng nâng cấp gói qua PayOS (đã triển khai) | [`reference/payos-billing-plan.md`](./reference/payos-billing-plan.md) |
| Implement import giao dịch từ Excel (Sprint 5) | [`reference/manual-import-spec.md`](./reference/manual-import-spec.md) — spec đầy đủ API, schema, AI direction, quota |
| Implement giới hạn lượt chat Copilot theo gói | [`reference/copilot-quota-spec.md`](./reference/copilot-quota-spec.md) — schema, guard, reset cron, FE billing tab |
| Implement lịch sử chat Copilot (sidebar + Settings) | [`reference/copilot-history-spec.md`](./reference/copilot-history-spec.md) — schema, CRUD API, sidebar UX, Settings tab, checklist mục 8 |

## Cấu trúc `agent-docs/`

```
agent-docs/
├── README.md                      ← file này
├── 00-current-state.md            ← ĐỌC TRƯỚC TIÊN — trạng thái repo chính xác lúc này
├── 01-monorepo-structure.md       ← cấu trúc Turborepo, lệnh, quy tắc thêm package
├── 02-backend-conventions.md      ← quy ước code NestJS (module, DTO, guard...)
├── 03-frontend-conventions.md     ← quy ước code React (component, hook, API client)
├── 04-environment-setup.md        ← setup local dev (Docker, DB, env vars, Cas sandbox)
└── reference/                     ← tài liệu nghiệp vụ GỐC — nguồn sự thật, không tự diễn giải khác đi
    ├── business-overview.md       ← tổng quan X-Cash AI, bài toán, tech stack, AI pipeline, API design
    ├── rbac.md                    ← 4 role, ma trận phân quyền, pricing model, Cas Partner
    ├── database-schema.md         ← schema đầy đủ (chart_of_accounts, transaction_classifications...)
    ├── user-journey.md            ← hành trình người dùng thực tế
    ├── tt133-accounting.md        ← giải thích định khoản, Nợ/Có, TT133, báo cáo (dễ hiểu)
    ├── ui-design.md               ← spec chi tiết màn hình (kèm JSX mẫu)
    ├── sprint-plan.md             ← kế hoạch sprint, phân việc 2 thành viên
    ├── payos-billing-plan.md      ← kế hoạch PayOS billing (đã hoàn thành)
    ├── copilot-history-spec.md    ← lịch sử chat Copilot (sidebar, Settings, Phase 1–8 ✅)
    └── manual-import-spec.md      ← Sprint 5: import GD tiền mặt / sao kê Excel (chưa implement)
```

## Skills sẵn có (`.claude/skills/`)

Gọi qua `/tên-skill` hoặc để agent tự nhận diện lúc làm task tương ứng:

| Skill | Dùng khi |
|---|---|
| `new-module` | Tạo NestJS module mới (controller/service/DTO + guard + tenant scoping) |
| `new-page` | Tạo page React mới (route + layout đúng + TanStack Query + RBAC UI) |
| `db-migrate` | Sửa/thêm Prisma schema |
| `add-endpoint` | Thêm 1 route mới vào controller có sẵn (checklist RBAC + tenant scoping + test) |
| `verify` | **Chạy sau mọi lần sửa code**, trước khi báo task xong — `pnpm verify` |
| `sync-agent-docs` | **Chạy sau `verify`** nếu thay đổi ảnh hưởng cấu trúc/convention — đồng bộ lại `agent-docs/` và skills để không bị lệch thực tế |

Quy trình chuẩn đầy đủ (đọc → code → verify → sync docs) xem tại [`../CLAUDE.md`](../CLAUDE.md).

## Quy tắc đọc tài liệu `reference/`

- Đây là các file đã được đội dự án (Lê Ngọc Anh, Lưu Nguyễn Thế Vinh) rà soát kỹ và **thống nhất** — từng có mâu thuẫn ở các bản nháp trước, nay đã gộp lại một chuẩn duy nhất trong `database-schema.md`.
- Khi 2 file `reference/` có vẻ nói khác nhau về cùng 1 thứ, **ưu tiên bản mới nhất được note rõ là "đã gộp"/"đã chuẩn hóa"** — cụ thể: `database-schema.md` là nguồn chuẩn cho schema.
- Không sửa các file trong `reference/` khi code — nếu phát hiện nghiệp vụ cần thay đổi, hỏi lại người dùng trước, vì đây là tài liệu đồ án đã được duyệt.

## Thông tin nhanh (tóm tắt cực ngắn)

- **Stack:** NestJS + TypeScript + Prisma + PostgreSQL (pgvector) + Redis + BullMQ (backend) · React + Vite + TypeScript + Tailwind + [ShadCN/UI](https://ui.shadcn.com/docs/components) + TanStack Query + Recharts (frontend) · Turborepo + pnpm (monorepo tooling)
- **AI:** OpenAI API only (`gpt-4o-mini` chat, `text-embedding-3-small` embedding) + pgvector — không tự train model. Phân loại theo chuẩn **TT133**.
- **Banking:** Cas SDK (sandbox thật) — Grant/Link/Exchange flow để liên kết ngân hàng, Balance Hook để nhận giao dịch real-time.
- **Billing:** PayOS — nâng cấp gói + overage (đã triển khai; mock fallback khi thiếu keys).
- **RBAC:** `cas_partner` (system-level) / `admin` / `accountant` / `viewer` (3 role sau thuộc 1 tenant).
- **Team:** Lê Ngọc Anh (23520048) — Backend & AI · Lưu Nguyễn Thế Vinh (22521653) — Frontend, Backend Modules, DevOps.
