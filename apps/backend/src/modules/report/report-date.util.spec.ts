import {
  buildDailyTrendBuckets,
  formatDayKey,
  formatDayLabel,
  periodBounds,
  startOfDay,
} from './report-date.util';

describe('periodBounds', () => {
  it('returns from first day of month and to first day of next month', () => {
    const { from, to } = periodBounds(2026, 7);

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(6);
    expect(from.getDate()).toBe(1);

    expect(to.getFullYear()).toBe(2026);
    expect(to.getMonth()).toBe(7);
    expect(to.getDate()).toBe(1);
  });

  it('handles December to January rollover', () => {
    const { from, to } = periodBounds(2026, 12);

    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(11);

    expect(to.getFullYear()).toBe(2027);
    expect(to.getMonth()).toBe(0);
  });
});

describe('startOfDay', () => {
  it('zeroes hours, minutes, seconds, milliseconds', () => {
    const date = new Date(2026, 6, 15, 10, 30, 45, 123);
    const result = startOfDay(date);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe('formatDayKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 5, 14, 0, 0);
    expect(formatDayKey(date)).toBe('2026-01-05');
  });

  it('pads month and day with zero', () => {
    const date = new Date(2026, 11, 3, 9, 0, 0);
    expect(formatDayKey(date)).toBe('2026-12-03');
  });
});

describe('formatDayLabel', () => {
  it('returns DD/MM from YYYY-MM-DD', () => {
    expect(formatDayLabel('2026-07-15')).toBe('15/07');
  });
});

describe('buildDailyTrendBuckets', () => {
  it('returns correct number of buckets', () => {
    const buckets = buildDailyTrendBuckets(7);
    expect(buckets).toHaveLength(7);
  });

  it('sets all zeros by default in each bucket', () => {
    const buckets = buildDailyTrendBuckets(3);
    for (const bucket of buckets) {
      expect(bucket).toEqual({
        date: expect.any(String),
        label: expect.any(String),
        count: 0,
        amount: 0,
        activityCount: 0,
        classifiedCount: 0,
        revenueAmount: 0,
        expenseAmount: 0,
      });
    }
  });

  it('produces ascending dates', () => {
    const buckets = buildDailyTrendBuckets(5);
    const dates = buckets.map((b) => b.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});
