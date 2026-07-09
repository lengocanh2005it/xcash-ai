import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatSignedTransactionAmount,
  signedTransactionAmountClassName,
} from './transaction-format';

describe('transaction-format', () => {
  describe('formatSignedTransactionAmount', () => {
    it('formats positive amount with + prefix', () => {
      expect(formatSignedTransactionAmount(1500000)).toBe('+1.500.000đ');
    });

    it('formats negative amount with - prefix', () => {
      expect(formatSignedTransactionAmount(-500000)).toBe('-500.000đ');
    });

    it('formats zero without sign', () => {
      expect(formatSignedTransactionAmount(0)).toBe('0đ');
    });

    it('handles string amounts in formatSignedTransactionAmount', () => {
      expect(formatSignedTransactionAmount('1000000')).toBe('+1.000.000đ');
      expect(formatSignedTransactionAmount('-500000')).toBe('-500.000đ');
    });
  });

  describe('signedTransactionAmountClassName', () => {
    it('returns emerald for positive', () => {
      expect(signedTransactionAmountClassName(100)).toContain('emerald');
    });

    it('returns red for negative', () => {
      expect(signedTransactionAmountClassName(-100)).toContain('red');
    });

    it('returns muted for zero', () => {
      expect(signedTransactionAmountClassName(0)).toBe('text-muted-foreground');
    });
  });

  describe('formatCurrency', () => {
    it('formats currency', () => {
      const result = formatCurrency(1500000);
      expect(result).toContain('1.500.000');
    });
  });
});
