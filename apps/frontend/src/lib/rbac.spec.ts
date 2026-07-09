import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  canBulkReclassify,
  canImportTransactions,
  canManageBilling,
  canManageTransactions,
  canViewAuditLogs,
  canViewBankingSettings,
  canViewBilling,
  canViewThreshold,
  isAccountant,
  isAdmin,
  isCasPartner,
  isViewer,
} from './rbac';

describe('rbac', () => {
  describe('role checks', () => {
    it('isAdmin returns true for admin', () => {
      expect(isAdmin('admin')).toBe(true);
    });

    it('isAdmin returns false for accountant', () => {
      expect(isAdmin('accountant')).toBe(false);
    });

    it('isAccountant returns true for accountant', () => {
      expect(isAccountant('accountant')).toBe(true);
    });

    it('isViewer returns true for viewer', () => {
      expect(isViewer('viewer')).toBe(true);
    });

    it('isCasPartner returns true for cas_partner', () => {
      expect(isCasPartner('cas_partner')).toBe(true);
    });

    it('handles null/undefined', () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
      expect(isAdmin('')).toBe(false);
    });
  });

  describe('permission checks', () => {
    it('canManageTransactions for admin and accountant', () => {
      expect(canManageTransactions('admin')).toBe(true);
      expect(canManageTransactions('accountant')).toBe(true);
      expect(canManageTransactions('viewer')).toBe(false);
    });

    it('canViewBilling for admin and accountant', () => {
      expect(canViewBilling('admin')).toBe(true);
      expect(canViewBilling('accountant')).toBe(true);
      expect(canViewBilling('viewer')).toBe(false);
    });

    it('canViewBankingSettings for admin and accountant', () => {
      expect(canViewBankingSettings('admin')).toBe(true);
      expect(canViewBankingSettings('accountant')).toBe(true);
      expect(canViewBankingSettings('viewer')).toBe(false);
    });

    it('canViewThreshold delegates to canManageTransactions', () => {
      expect(canViewThreshold('admin')).toBe(true);
      expect(canViewThreshold('accountant')).toBe(true);
      expect(canViewThreshold('viewer')).toBe(false);
    });

    it('canViewAuditLogs for admin and accountant', () => {
      expect(canViewAuditLogs('admin')).toBe(true);
      expect(canViewAuditLogs('accountant')).toBe(true);
      expect(canViewAuditLogs('viewer')).toBe(false);
    });

    it('canManageBilling only for admin', () => {
      expect(canManageBilling('admin')).toBe(true);
      expect(canManageBilling('accountant')).toBe(false);
      expect(canManageBilling('viewer')).toBe(false);
    });

    it('canImportTransactions for admin and accountant', () => {
      expect(canImportTransactions('admin')).toBe(true);
      expect(canImportTransactions('accountant')).toBe(true);
      expect(canImportTransactions('viewer')).toBe(false);
    });

    it('canBulkReclassify for admin and accountant', () => {
      expect(canBulkReclassify('admin')).toBe(true);
      expect(canBulkReclassify('accountant')).toBe(true);
      expect(canBulkReclassify('viewer')).toBe(false);
    });
  });

  describe('canAccessRoute', () => {
    it('allows admin to access all routes', () => {
      expect(canAccessRoute('admin', '/dashboard')).toBe(true);
      expect(canAccessRoute('admin', '/transactions')).toBe(true);
      expect(canAccessRoute('admin', '/settings/banking')).toBe(true);
      expect(canAccessRoute('admin', '/settings/team')).toBe(true);
    });

    it('allows accountant to access most routes', () => {
      expect(canAccessRoute('accountant', '/dashboard')).toBe(true);
      expect(canAccessRoute('accountant', '/transactions')).toBe(true);
      expect(canAccessRoute('accountant', '/settings/banking')).toBe(true);
    });

    it('restricts viewer from admin-only routes', () => {
      expect(canAccessRoute('viewer', '/dashboard')).toBe(true);
      expect(canAccessRoute('viewer', '/transactions')).toBe(true);
      expect(canAccessRoute('viewer', '/settings/banking')).toBe(false);
      expect(canAccessRoute('viewer', '/settings/team')).toBe(false);
    });

    it('blocks cas_partner from all tenant routes', () => {
      expect(canAccessRoute('cas_partner', '/dashboard')).toBe(false);
      expect(canAccessRoute('cas_partner', '/transactions')).toBe(false);
    });

    it('returns true for unknown routes (open by default)', () => {
      expect(canAccessRoute('viewer', '/unknown-route')).toBe(true);
    });

    it('returns true when pathname is undefined', () => {
      expect(canAccessRoute('admin', undefined)).toBe(true);
    });
  });
});
