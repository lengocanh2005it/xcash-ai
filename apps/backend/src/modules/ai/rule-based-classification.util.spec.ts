import { ruleBasedClassify } from './rule-based-classification.util';

describe('ruleBasedClassify', () => {
  describe('direction === in', () => {
    it('classifies TIEN HANG as revenue', () => {
      const result = ruleBasedClassify('TIEN HANG KHACH', 'in');
      expect(result.debitAccount).toBe('112');
      expect(result.creditAccount).toBe('511');
      expect(result.confidenceScore).toBe(55);
    });

    it('classifies THANH TOAN as revenue', () => {
      const result = ruleBasedClassify('THANH TOAN DON HANG', 'in');
      expect(result.creditAccount).toBe('511');
    });

    it('classifies LAI as financial revenue', () => {
      const result = ruleBasedClassify('LAI TIEN GUI', 'in');
      expect(result.creditAccount).toBe('515');
      expect(result.confidenceScore).toBe(60);
    });

    it('classifies unknown inbound as 131', () => {
      const result = ruleBasedClassify('CHUYEN KHOAN TU NOI BO', 'in');
      expect(result.debitAccount).toBe('112');
      expect(result.creditAccount).toBe('131');
      expect(result.confidenceScore).toBe(30);
    });
  });

  describe('direction === out', () => {
    it('classifies LUONG as salary', () => {
      const result = ruleBasedClassify('TRA LUONG THANG 6', 'out');
      expect(result.debitAccount).toBe('334');
      expect(result.creditAccount).toBe('112');
      expect(result.confidenceScore).toBe(65);
    });

    it('classifies DIEN as utility expense', () => {
      const result = ruleBasedClassify('HOA DON DIEN', 'out');
      expect(result.debitAccount).toBe('627');
      expect(result.confidenceScore).toBe(55);
    });

    it('classifies VAN PHONG as office expense', () => {
      const result = ruleBasedClassify('CHI VAN PHONG', 'out');
      expect(result.debitAccount).toBe('642');
    });

    it('classifies PHI as bank fee', () => {
      const result = ruleBasedClassify('PHI NGAN HANG', 'out');
      expect(result.debitAccount).toBe('635');
    });

    it('classifies unknown outbound as 331', () => {
      const result = ruleBasedClassify('CHUYEN KHOAN DI', 'out');
      expect(result.debitAccount).toBe('331');
      expect(result.confidenceScore).toBe(25);
    });
  });

  describe('case insensitivity', () => {
    it('handles mixed case', () => {
      const result = ruleBasedClassify('Tra Luong Nhan Vien', 'out');
      expect(result.debitAccount).toBe('334');
    });
  });
});
