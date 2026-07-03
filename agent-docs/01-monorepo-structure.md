# Monorepo Structure — Turborepo + pnpm

## Vì sao Turborepo + pnpm

- **pnpm workspaces** quản lý dependency giữa các package nội bộ (`@xcash/backend`, `@xcash/frontend`, `@xcash/shared-types`) bằng symlink, không duplicate `node_modules`.
- **Turborepo** điều phối chạy task (`dev`, `build`, `lint`, `test`, `type-check`) song song trên nhiều package, cache kết quả task chưa đổi input để tránh build lại không cần thiết.
- Repo hiện **chưa bật Remote Caching** (cần tài khoản Vercel) — chỉ dùng local cache. Có thể bật sau nếu cần cache dùng chung giữa máy dev / CI.

## Cây thư mục thực tế

```
x-cash-ai/
├── apps/
│   ├── backend/                 # NestJS — @xcash/backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── modules/         # (tạo mới) — mỗi domain 1 module, xem 02-backend-conventions.md
│   │   ├── test/
│   │   ├── nest-cli.json
│   │   ├── .swcrc                 # SWC compiler (nest build / dev watch)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── frontend/                # React + Vite — @xcash/frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/           # (tạo mới) — 1 file/thư mục / route, xem 03-frontend-conventions.md
│       │   ├── components/      # (tạo mới)
│       │   └── lib/             # (tạo mới) — api client, utils
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   └── shared-types/             # @xcash/shared-types — enum & type dùng chung BE/FE
│       ├── src/index.ts
│       └── package.json
│
├── agent-docs/                   # tài liệu cho AI agent — xem agent-docs/README.md
├── .env.example                  # tham chiếu đầy đủ biến môi trường — split per-app khi setup
├── .github/workflows/ci.yml      # CI: pnpm verify trên push/PR
├── .husky/                       # pre-commit, pre-push
├── pnpm-workspace.yaml
├── turbo.json                    # định nghĩa task pipeline
├── package.json                  # root — chỉ chứa script điều phối + devDependency turbo
└── CLAUDE.md                     # entry point cho AI agent
```

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Mọi thư mục mới muốn tham gia workspace (BE, FE, package dùng chung) phải nằm dưới `apps/` hoặc `packages/` và có `package.json` với field `name` dạng `@xcash/<tên>`.

## `turbo.json` — task pipeline hiện tại

```jsonc
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "type-check": { "dependsOn": ["^build"] }
  }
}
```

- `dependsOn: ["^build"]` nghĩa là: trước khi build/lint/test 1 package, Turborepo build trước các package nó phụ thuộc (vd: build `@xcash/backend` sẽ build `@xcash/shared-types` trước nếu backend import nó).
- `dev` không cache và chạy liên tục (`persistent: true`) — đúng bản chất dev server.
- Nếu 1 package không có script tương ứng trong `package.json` (vd: `@xcash/shared-types` chưa có `dev`), Turborepo tự bỏ qua package đó cho task đó — không lỗi.

## Package hiện có

| Package | Đường dẫn | Vai trò |
|---|---|---|
| `@xcash/backend` | `apps/backend` | NestJS API — xem [`02-backend-conventions.md`](./02-backend-conventions.md) |
| `@xcash/frontend` | `apps/frontend` | React SPA (Vite) — xem [`03-frontend-conventions.md`](./03-frontend-conventions.md) |
| `@xcash/shared-types` | `packages/shared-types` | Enum (`Role`, `TransactionStatus`, `ClassificationType`, `AccountType`...) + type response dùng chung |

## Lệnh chạy (từ thư mục root)

```bash
pnpm install                              # cài toàn bộ, phải chạy lại mỗi khi thêm package mới hoặc đổi dependency
pnpm dev                                  # turbo run dev — chạy BE + FE song song
pnpm dev:backend                          # chỉ BE (--filter=@xcash/backend)
pnpm dev:frontend                         # chỉ FE (--filter=@xcash/frontend)
pnpm build                                # build toàn bộ theo đúng thứ tự phụ thuộc
pnpm lint / pnpm test / pnpm type-check   # tương tự, chạy trên toàn bộ package có script tương ứng
pnpm format                               # format toàn bộ bằng Biome (không lint, chỉ format)
pnpm verify                               # lint + type-check + test + build — chạy sau MỌI lần sửa code, xem skill verify
```

## Git hooks (Husky)

Sau `pnpm install`, script `prepare` tự chạy `husky` và gắn hook vào `.git/hooks`.

| Hook | Chạy gì | Mục đích |
|---|---|---|
| **pre-commit** | `lint-staged` (Biome trên file staged) + `pnpm type-check` | Bắt lỗi format/lint/kiểu sớm, nhanh |
| **pre-push** | `pnpm verify` | Đảm bảo test + build pass trước khi đẩy lên remote |

Bỏ qua tạm (khẩn cấp): `git commit --no-verify` / `git push --no-verify`.

```bash
# Chạy 1 lệnh cho đúng 1 package cụ thể (không qua turbo):
pnpm --filter @xcash/backend add <package>       # thêm dependency cho backend
pnpm --filter @xcash/frontend add <package>       # thêm dependency cho frontend
pnpm --filter @xcash/backend exec <command>       # chạy lệnh bất kỳ trong context backend
```

## Lint & Format — Biome (không dùng ESLint/Prettier/oxlint)

Toàn repo dùng **1 tool duy nhất** cho cả lint và format: [Biome](https://biomejs.dev), cấu hình tại `biome.json` ở root, áp dụng chung mọi package (mỗi package chỉ có script `lint`/`format` gọi `biome check --write .` / `biome format --write .` trong context thư mục của nó).

Vì sao chọn Biome thay vì ESLint (NestJS mặc định) + oxlint (Vite mặc định) + Prettier: 1 config duy nhất, 1 tool binary duy nhất, nhanh hơn nhiều, không phải đồng bộ rule giữa 2 hệ thống lint khác nhau cho 2 app trong cùng 1 repo.

**Gotcha cần nhớ:** rule `useImportType` của Biome bị tắt cho `apps/backend/**` (xem `overrides` trong `biome.json`) — vì NestJS constructor injection cần import runtime thật, Biome tự động đổi thành `import type` sẽ làm vỡ Dependency Injection (lỗi `Nest can't resolve dependencies`). Xem thêm tại `agent-docs/02-backend-conventions.md` mục "Lint gotcha".

**Lưu ý quan trọng:** không chạy `npm install` hoặc `yarn` trong bất kỳ thư mục con nào — repo dùng pnpm workspaces thống nhất, trộn package manager sẽ phá lockfile.

## Cách package nội bộ import lẫn nhau

`@xcash/backend` hoặc `@xcash/frontend` muốn dùng `@xcash/shared-types`:

1. Thêm vào `dependencies` trong `package.json` của app đó: `"@xcash/shared-types": "workspace:*"`
2. Chạy `pnpm install` lại ở root để pnpm tạo symlink.
3. Import bình thường: `import { Role, TransactionStatus } from '@xcash/shared-types'`

`workspace:*` đảm bảo luôn resolve về version trong monorepo (không phải bản publish trên npm — package này không publish public).

## Khi nào tạo package mới trong `packages/`

Chỉ tách thành package riêng khi code thực sự dùng chung giữa ≥ 2 app (BE và FE), ví dụ:
- Enum/type nghiệp vụ (đã có `shared-types`)
- Zod schema validate dùng chung cho DTO backend và form frontend (nếu sau này cần)
- ESLint/TSConfig base dùng chung (chưa cần ở quy mô hiện tại — 2 app, không đáng tách)

Không tạo package cho code chỉ 1 app dùng — giữ trong `apps/<app>/src` như bình thường.

## CI/CD

**Đã có (Sprint 1 tuần 1):** `.github/workflows/ci.yml` — trigger trên `push`/`pull_request` tới `main` hoặc `develop`, chạy `pnpm verify`. `.github/workflows/deploy.yml` — `workflow_dispatch`, SSH deploy lên VPS (cần secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`). Hướng dẫn: `deploy/README.md`.

**Chưa có / hoãn Sprint 4:** affected-package filter (`turbo --filter=...[origin/main]`), Docker image push registry, **deploy VPS thật** (secrets + VPS + HTTPS — template workflow/docs đã sẵn, chưa chạy production).
