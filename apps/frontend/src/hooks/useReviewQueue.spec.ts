import { describe, expect, it } from 'vitest';
import { ACCOUNT_CODE_PATTERN, CONFIDENCE_OPTIONS } from './useReviewQueue';

describe('useReviewQueue', () => {
  describe('ACCOUNT_CODE_PATTERN', () => {
    it('accepts 3-digit codes', () => {
      expect(ACCOUNT_CODE_PATTERN.test('112')).toBe(true);
      expect(ACCOUNT_CODE_PATTERN.test('642')).toBe(true);
    });

    it('accepts 4-digit codes', () => {
      expect(ACCOUNT_CODE_PATTERN.test('3331')).toBe(true);
    });

    it('rejects codes shorter than 3 digits', () => {
      expect(ACCOUNT_CODE_PATTERN.test('12')).toBe(false);
      expect(ACCOUNT_CODE_PATTERN.test('')).toBe(false);
    });

    it('rejects codes longer than 4 digits', () => {
      expect(ACCOUNT_CODE_PATTERN.test('12345')).toBe(false);
    });

    it('rejects non-numeric codes', () => {
      expect(ACCOUNT_CODE_PATTERN.test('abc')).toBe(false);
      expect(ACCOUNT_CODE_PATTERN.test('12a')).toBe(false);
    });
  });

  describe('CONFIDENCE_OPTIONS', () => {
    it('has "all" option first', () => {
      expect(CONFIDENCE_OPTIONS[0]).toEqual({ value: 'all', label: 'Tất cả độ tin cậy' });
    });

    it('has low band with max=50', () => {
      const low = CONFIDENCE_OPTIONS.find((o) => o.value === 'low');
      expect(low).toBeDefined();
      expect(low?.max).toBe(50);
      expect(low?.min).toBeUndefined();
    });

    it('has mid band with min=50 and max=85', () => {
      const mid = CONFIDENCE_OPTIONS.find((o) => o.value === 'mid');
      expect(mid).toBeDefined();
      expect(mid?.min).toBe(50);
      expect(mid?.max).toBe(85);
    });
  });
});
