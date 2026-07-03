/** Định dạng VND đầy đủ số, phân tách hàng nghìn bằng dấu chấm (vd 2.500.000đ). */
export function formatVND(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0đ';
  return `${Math.round(n).toLocaleString('vi-VN')}đ`;
}

function formatCompactUnit(value: number, maxDecimals = 1): string {
  return Number(value.toFixed(maxDecimals)).toLocaleString('vi-VN', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  });
}

/** Nhãn viết tắt cho trục biểu đồ (tỷ / tr / n) để tránh chật. */
export function formatVNDAxis(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) {
    return `${sign}${formatCompactUnit(abs / 1_000_000_000)} tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${formatCompactUnit(abs / 1_000_000)} tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${formatCompactUnit(abs / 1_000)} n`;
  }
  return `${sign}${abs.toLocaleString('vi-VN')}`;
}
