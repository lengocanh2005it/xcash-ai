import { formatVND } from './format-vnd';

export function formatCurrency(amount: number) {
  return formatVND(amount);
}

/** Số tiền giao dịch: + tiền vào, − tiền ra (amount đã có dấu từ webhook). */
export function formatSignedTransactionAmount(amount: number | string) {
  const n = Number(amount);
  const formatted = Math.abs(n).toLocaleString('vi-VN');
  if (n > 0) return `+${formatted}đ`;
  if (n < 0) return `-${formatted}đ`;
  return `${formatted}đ`;
}

export function signedTransactionAmountClassName(amount: number | string) {
  const n = Number(amount);
  if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (n < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}
