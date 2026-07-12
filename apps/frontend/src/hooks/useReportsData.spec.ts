import { SubscriptionPlan } from '@xcash/shared-types';
import { describe, expect, it } from 'vitest';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';

describe('useReportsData', () => {
  describe('plan access for export', () => {
    it('allows export for PRO plan', () => {
      expect(hasPlanAccess(SubscriptionPlan.PRO, SubscriptionPlan.PRO)).toBe(true);
    });

    it('allows export for ENTERPRISE plan above PRO', () => {
      expect(hasPlanAccess(SubscriptionPlan.ENTERPRISE, SubscriptionPlan.PRO)).toBe(true);
    });

    it('denies export for FREE plan', () => {
      expect(hasPlanAccess(SubscriptionPlan.FREE, SubscriptionPlan.PRO)).toBe(false);
    });
  });

  describe('PLAN_LABEL', () => {
    it('has labels for all plans', () => {
      expect(PLAN_LABEL[SubscriptionPlan.FREE]).toBeDefined();
      expect(PLAN_LABEL[SubscriptionPlan.PRO]).toBeDefined();
      expect(PLAN_LABEL[SubscriptionPlan.ENTERPRISE]).toBeDefined();
    });
  });
});
