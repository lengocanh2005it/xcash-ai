export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Tính skip và totalPages cho offset pagination.
 * Dùng khi service tự gọi findMany + count riêng.
 *
 * @example
 * ```ts
 * const { skip, totalPages } = paginateParams(page, limit, total);
 * const [items, total] = await Promise.all([
 *   prisma.foo.findMany({ skip, take: limit }),
 *   prisma.foo.count({ where }),
 * ]);
 * return paginateResult(items, total, page, limit);
 * ```
 */
export function paginateParams(page: number, limit: number) {
  return { skip: (page - 1) * limit };
}

/** Tính totalPages từ total và limit. Luôn trả về >= 1. */
export function totalPagesFromTotal(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

/** Gộp kết quả query thành response chuẩn. */
export function paginateResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: totalPagesFromTotal(total, limit),
  };
}
