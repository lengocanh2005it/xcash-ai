import type { PartnerTenant } from '@xcash/shared-types';
import { describe, expect, it } from 'vitest';
import {
  computeMrr,
  computePlanBreakdown,
  computePlanDistribution,
  computeTopRevenue,
} from './usePartnerDashboardData';

function makeTenant(overrides: Partial<PartnerTenant>): PartnerTenant {
  return {
    id: 'tenant-1',
    businessName: 'Công ty TNHH Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    plan: 'starter',
    status: 'active',
    transactionsThisMonth: 0,
    revenuePerMonth: 0,
    ...overrides,
  };
}

describe('usePartnerDashboardData', () => {
  describe('computePlanDistribution', () => {
    it('returns empty array for undefined tenants', () => {
      expect(computePlanDistribution(undefined)).toEqual([]);
    });

    it('counts tenants per plan, defaulting null plan to free', () => {
      const tenants = [
        makeTenant({ id: '1', plan: 'starter' }),
        makeTenant({ id: '2', plan: 'starter' }),
        makeTenant({ id: '3', plan: null }),
      ];
      const result = computePlanDistribution(tenants);
      expect(result.find((r) => r.plan === 'starter')?.count).toBe(2);
      expect(result.find((r) => r.plan === 'free')?.count).toBe(1);
    });

    it('omits plans with zero tenants', () => {
      const tenants = [makeTenant({ id: '1', plan: 'pro' })];
      const result = computePlanDistribution(tenants);
      expect(result.some((r) => r.plan === 'enterprise')).toBe(false);
      expect(result.some((r) => r.plan === 'starter')).toBe(false);
    });
  });

  describe('computePlanBreakdown', () => {
    it('returns zeroed rows for every plan when tenants is undefined', () => {
      const result = computePlanBreakdown(undefined);
      expect(result.every((r) => r.count === 0 && r.revenue === 0 && r.pct === 0)).toBe(true);
    });

    it('only counts revenue from active tenants', () => {
      const tenants = [
        makeTenant({ id: '1', plan: 'pro', status: 'active', revenuePerMonth: 500_000 }),
        makeTenant({ id: '2', plan: 'pro', status: 'suspended', revenuePerMonth: 500_000 }),
      ];
      const result = computePlanBreakdown(tenants);
      const pro = result.find((r) => r.plan === 'pro');
      expect(pro?.count).toBe(2);
      expect(pro?.activeCount).toBe(1);
      expect(pro?.revenue).toBe(500_000);
    });

    it('rounds percentage of total tenants per plan', () => {
      const tenants = [
        makeTenant({ id: '1', plan: 'starter' }),
        makeTenant({ id: '2', plan: 'starter' }),
        makeTenant({ id: '3', plan: 'pro' }),
      ];
      const result = computePlanBreakdown(tenants);
      expect(result.find((r) => r.plan === 'starter')?.pct).toBe(67);
      expect(result.find((r) => r.plan === 'pro')?.pct).toBe(33);
    });
  });

  describe('computeMrr', () => {
    it('sums revenue across all plan breakdown rows', () => {
      const breakdown = computePlanBreakdown([
        makeTenant({ id: '1', plan: 'starter', status: 'active', revenuePerMonth: 200_000 }),
        makeTenant({ id: '2', plan: 'pro', status: 'active', revenuePerMonth: 500_000 }),
      ]);
      expect(computeMrr(breakdown)).toBe(700_000);
    });

    it('is zero when there is no active paid tenant', () => {
      const breakdown = computePlanBreakdown([
        makeTenant({ id: '1', plan: 'starter', status: 'suspended', revenuePerMonth: 200_000 }),
      ]);
      expect(computeMrr(breakdown)).toBe(0);
    });
  });

  describe('computeTopRevenue', () => {
    it('excludes inactive tenants and zero-revenue tenants', () => {
      const tenants = [
        makeTenant({ id: '1', status: 'active', revenuePerMonth: 0 }),
        makeTenant({ id: '2', status: 'suspended', revenuePerMonth: 500_000 }),
        makeTenant({ id: '3', status: 'active', revenuePerMonth: 300_000 }),
      ];
      const result = computeTopRevenue(tenants);
      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(300_000);
    });

    it('sorts descending by revenue and caps at 5', () => {
      const tenants = Array.from({ length: 7 }, (_, i) =>
        makeTenant({
          id: String(i),
          businessName: `Tenant ${i}`,
          status: 'active',
          revenuePerMonth: (i + 1) * 100_000,
        }),
      );
      const result = computeTopRevenue(tenants);
      expect(result).toHaveLength(5);
      expect(result[0].revenue).toBe(700_000);
      expect(result[4].revenue).toBe(300_000);
    });

    it('truncates business names longer than 15 characters', () => {
      const tenants = [
        makeTenant({
          id: '1',
          businessName: 'Công ty TNHH Thương Mại Dịch Vụ Rất Dài',
          status: 'active',
          revenuePerMonth: 100_000,
        }),
      ];
      const result = computeTopRevenue(tenants);
      expect(result[0].name.endsWith('…')).toBe(true);
      expect(result[0].name.length).toBe(16);
    });
  });
});
