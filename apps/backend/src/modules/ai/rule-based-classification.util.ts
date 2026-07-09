/**
 * Rule-based fallback classification — pure function, no dependencies.
 * Dùng khi AI call thất bại hoặc trả về null.
 */

export interface RuleBasedResult {
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  reason: string;
}

export function ruleBasedClassify(content: string, direction: 'in' | 'out'): RuleBasedResult {
  const upper = content.toUpperCase();

  if (direction === 'in') {
    if (upper.includes('TIEN HANG') || upper.includes('THANH TOAN') || upper.includes('TT HANG')) {
      return {
        debitAccount: '112',
        creditAccount: '511',
        confidenceScore: 55,
        reason: 'Tiền hàng vào — gợi ý doanh thu bán hàng',
      };
    }
    if (upper.includes('LAI') || upper.includes('INTEREST')) {
      return {
        debitAccount: '112',
        creditAccount: '515',
        confidenceScore: 60,
        reason: 'Lãi tiền gửi — gợi ý doanh thu tài chính',
      };
    }
    return {
      debitAccount: '112',
      creditAccount: '131',
      confidenceScore: 30,
      reason: 'Tiền vào chưa xác định — cần xem xét',
    };
  }

  if (upper.includes('LUONG') || upper.includes('SALARY') || upper.includes('TRA LUONG')) {
    return {
      debitAccount: '334',
      creditAccount: '112',
      confidenceScore: 65,
      reason: 'Chi trả lương nhân viên',
    };
  }
  if (upper.includes('HOA DON') || upper.includes('DIEN') || upper.includes('NUOC')) {
    return {
      debitAccount: '627',
      creditAccount: '112',
      confidenceScore: 55,
      reason: 'Chi phí điện nước — gợi ý chi phí sản xuất chung',
    };
  }
  if (upper.includes('VAN PHONG') || upper.includes('OFFICE')) {
    return {
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 55,
      reason: 'Chi phí văn phòng — gợi ý chi phí quản lý',
    };
  }
  if (upper.includes('PHI') || upper.includes('FEE')) {
    return {
      debitAccount: '635',
      creditAccount: '112',
      confidenceScore: 50,
      reason: 'Phí ngân hàng — gợi ý chi phí tài chính',
    };
  }

  return {
    debitAccount: '331',
    creditAccount: '112',
    confidenceScore: 25,
    reason: 'Tiền ra chưa xác định — cần xem xét',
  };
}
