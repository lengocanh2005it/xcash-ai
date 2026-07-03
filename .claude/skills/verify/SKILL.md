---
name: verify
description: Chạy bộ kiểm tra đầy đủ (lint, type-check, test, build) trên toàn monorepo X-Cash AI sau khi sửa code. BẮT BUỘC dùng skill này trước khi báo cáo task hoàn thành, hoặc khi user gõ "/verify".
---

# Verify — Kiểm tra toàn bộ trước khi coi là xong

## Khi nào dùng

**Sau mọi lần sửa code** (backend, frontend, hoặc package dùng chung) — trước khi báo với user là task đã xong. Không tự cho rằng code "chắc đúng" chỉ vì không thấy lỗi khi đọc lại — luôn chạy verify thật.

## Lệnh chính

```bash
pnpm verify
```

Đây là alias cho `turbo run lint type-check test build` — chạy cả 4 bước, Turborepo tự xử lý thứ tự phụ thuộc giữa các package (`@xcash/shared-types` build/check trước `@xcash/backend`/`@xcash/frontend` nếu có phụ thuộc) và cache kết quả không đổi.

## Nếu chỉ sửa 1 package, có thể verify nhanh hơn bằng `--filter`

```bash
pnpm exec turbo run lint type-check test build --filter=@xcash/backend
pnpm exec turbo run lint type-check test build --filter=@xcash/frontend
```

Dùng cách này khi task rõ ràng chỉ đụng 1 app, để tiết kiệm thời gian — nhưng nếu có sửa `packages/shared-types`, luôn verify **cả 2 app** vì cả backend lẫn frontend đều import từ đó.

## Đọc kết quả

- **`lint`** (Biome `check --write`) — tự động fix được phần lớn lỗi style/import order; nếu vẫn còn lỗi sau khi fix, đó là lỗi cần sửa tay (thường là a11y trên JSX hoặc logic rõ ràng sai).
  - ⚠️ Gotcha đã biết: Biome có thể tự đổi `import { XService }` thành `import type { XService }` trong code backend nếu chỉ thấy dùng ở vị trí type — với NestJS constructor injection, việc này làm vỡ DI runtime (lỗi `Nest can't resolve dependencies`). Rule `useImportType` đã tắt cho `apps/backend/**` trong `biome.json`, nhưng nếu thấy lỗi DI lạ sau khi lint tự fix, kiểm tra lại import đó trước tiên.
- **`type-check`** — không được bỏ qua lỗi kiểu dữ liệu bằng `any`/`@ts-ignore` để né lỗi, trừ khi thật sự cần thiết và giải thích rõ trong 1 dòng comment.
- **`test`** — nếu vừa thêm endpoint mới, đảm bảo đã có test case tương ứng (xem skill `add-endpoint` bước 7) trước khi coi verify là đủ — verify pass không có nghĩa là đã test đúng chỗ, chỉ nghĩa là test hiện có không đỏ.
- **`build`** — lỗi build thường là do thiếu export, sai path import giữa package (`@xcash/shared-types` chưa `pnpm install` lại sau khi thêm dependency mới — xem `agent-docs/01-monorepo-structure.md` mục "Cách package nội bộ import lẫn nhau").

## Sau khi verify xong

Dọn cache/artifact sinh ra trong lúc test nếu không cần giữ lại (không bắt buộc, `.turbo/`, `dist/`, `coverage/` đã có trong `.gitignore` nên không ảnh hưởng git, nhưng dọn cho môi trường sạch nếu vừa chạy build thử nghiệm không phải để deploy).

## Không bỏ qua bước này khi

- Task được coi là "chỉ sửa nhỏ" — biome/tsc bắt được nhiều lỗi tưởng chừng vô hại (vd import type sai như trên).
- Đang trong lúc chạy nhiều task song song — luôn verify riêng phần mình vừa đổi trước khi báo cáo, không gộp chung "để cuối cùng verify 1 thể" rồi quên.
