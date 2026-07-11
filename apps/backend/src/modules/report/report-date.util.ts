export interface DailyTrendPoint {
  date: string;
  label: string;
  count: number;
  amount: number;
  activityCount: number;
  classifiedCount: number;
  revenueAmount: number;
  expenseAmount: number;
}

export function periodBounds(year: number, month: number) {
  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1),
  };
}

export function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function formatDayKey(date: Date) {
  const day = startOfDay(date);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

export function formatDayLabel(dayKey: string) {
  const [, month, day] = dayKey.split('-');
  return `${day}/${month}`;
}

export function buildDailyTrendBuckets(days: number): DailyTrendPoint[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const dayKey = formatDayKey(date);
    return {
      date: dayKey,
      label: formatDayLabel(dayKey),
      count: 0,
      amount: 0,
      activityCount: 0,
      classifiedCount: 0,
      revenueAmount: 0,
      expenseAmount: 0,
    };
  });
}
