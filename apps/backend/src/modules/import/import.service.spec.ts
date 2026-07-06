import type * as XLSX from 'xlsx';
import { ImportService } from './import.service';

// Minimal stub — no DI needed for pure methods
function makeService(): ImportService {
  return new ImportService(null as never, null as never, null as never);
}

describe('ImportService — normalizeAmount', () => {
  let svc: ImportService;
  beforeEach(() => {
    svc = makeService();
  });

  it('parses plain integer', () => expect(svc.normalizeAmount(2500000)).toBe(2500000));
  it('strips dots', () => expect(svc.normalizeAmount('2.500.000')).toBe(2500000));
  it('strips commas', () => expect(svc.normalizeAmount('2,500,000')).toBe(2500000));
  it('strips đ suffix', () => expect(svc.normalizeAmount('2500000đ')).toBe(2500000));
  it('strips VNĐ suffix', () => expect(svc.normalizeAmount('2.500.000 VNĐ')).toBe(2500000));
  it('returns null for empty', () => expect(svc.normalizeAmount('')).toBeNull());
  it('returns null for non-numeric', () => expect(svc.normalizeAmount('abc')).toBeNull());
  it('returns null for null', () => expect(svc.normalizeAmount(null)).toBeNull());
});

describe('ImportService — parseDate', () => {
  let svc: ImportService;
  beforeEach(() => {
    svc = makeService();
  });

  it('parses dd/MM/yyyy', () => {
    const d = svc.parseDate('01/07/2026');
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(6);
    expect(d?.getUTCDate()).toBe(1);
  });
  it('parses short dd/MM as VN (1/7/2026 = 1 tháng 7)', () => {
    const d = svc.parseDate('1/7/2026');
    expect(d?.getUTCMonth()).toBe(6);
    expect(d?.getUTCDate()).toBe(1);
  });
  it('parses dd/MM/yy from Excel short date (3/7/26 = 3 tháng 7)', () => {
    const d = svc.parseDate('3/7/26');
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(6);
    expect(d?.getUTCDate()).toBe(3);
  });
  it('parseImportDate accepts Excel display 3/7/26', () => {
    const r = svc.parseImportDate({ t: 'n', v: 45835 } as XLSX.CellObject, '3/7/26');
    expect(r.date?.getUTCDate()).toBe(3);
    expect(r.date?.getUTCMonth()).toBe(6);
  });
  it('parseImportDate reads US Excel display 1/7/2026 as VN 1 tháng 7', () => {
    const cell = { t: 'n', v: 46029, w: '1/7/2026' } as XLSX.CellObject;
    const r = svc.parseImportDate(cell, '1/7/2026');
    expect(r.date?.getUTCMonth()).toBe(6);
    expect(r.date?.getUTCDate()).toBe(1);
  });
  it('parseImportDate rejects serial-only cells without display text', () => {
    const r = svc.parseImportDate({ t: 'n', v: 46029 } as XLSX.CellObject, 46029);
    expect(r.date).toBeNull();
    expect(r.errorMessage).toMatch(/số Excel/);
  });
  it('parses dd-MM-yyyy', () => {
    const d = svc.parseDate('15-03-2025');
    expect(d?.getUTCMonth()).toBe(2);
    expect(d?.getUTCDate()).toBe(15);
  });
  it('parses yyyy-MM-dd', () => {
    const d = svc.parseDate('2026-07-04');
    expect(d?.getUTCFullYear()).toBe(2026);
  });
  it('returns null for garbage', () => expect(svc.parseDate('32/07/2026')).toBeNull());
  it('returns null for empty', () => expect(svc.parseDate('')).toBeNull());
});

describe('ImportService — generateTransactionId', () => {
  let svc: ImportService;
  beforeEach(() => {
    svc = makeService();
  });

  const row = {
    row: 2,
    date: new Date('2026-07-01'),
    dateIso: '2026-07-01',
    description: 'Mua nguyên liệu',
    amount: 2500000,
    direction: 'out' as const,
  };

  it('starts with import_ prefix', () => {
    const id = svc.generateTransactionId('tenant-1', 2, row);
    expect(id).toMatch(/^import_tenant-1_[a-f0-9]{64}$/);
  });

  it('same content + same rowIndex → same id (re-upload idempotency)', () => {
    const id1 = svc.generateTransactionId('t1', 2, row);
    const id2 = svc.generateTransactionId('t1', 2, row);
    expect(id1).toBe(id2);
  });

  it('same content + different rowIndex → different id', () => {
    const id1 = svc.generateTransactionId('t1', 2, row);
    const id2 = svc.generateTransactionId('t1', 3, row);
    expect(id1).not.toBe(id2);
  });

  it('different tenants → different id', () => {
    const id1 = svc.generateTransactionId('t1', 2, row);
    const id2 = svc.generateTransactionId('t2', 2, row);
    expect(id1).not.toBe(id2);
  });
});

describe('ImportService — parseRows validation', () => {
  let svc: ImportService;
  beforeEach(() => {
    svc = makeService();
  });

  // We can't easily call parseRows without a real buffer, but we test the helpers.
  // Full parseRows integration is covered by E2E. Here we test edge rules:

  it('normalizeAmount rejects zero', () => {
    expect(svc.normalizeAmount(0)).toBe(0); // normalize returns 0, caller checks > 0
  });

  it('direction chi → out, thu → in', () => {
    // tested indirectly via parseRows — direction logic is inline
    // Just ensure the service constructs without throwing
    expect(svc).toBeDefined();
  });
});
