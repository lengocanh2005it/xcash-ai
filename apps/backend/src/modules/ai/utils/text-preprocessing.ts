/**
 * Chuẩn hóa nội dung chuyển khoản tiếng Việt trước khi embedding / phân loại AI.
 */
export function preprocessTransactionContent(content: string): string {
  return content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
