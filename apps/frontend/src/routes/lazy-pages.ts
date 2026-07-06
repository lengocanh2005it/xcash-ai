import { lazy } from 'react';

/** Tenant app — tách chunk (recharts, bảng lớn, Settings tabs). */
export const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
export const TransactionsPage = lazy(() => import('@/pages/transactions/TransactionsPage'));
export const ReviewPage = lazy(() => import('@/pages/review/ReviewPage'));
export const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
export const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
export const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));
export const CopilotPage = lazy(() => import('@/pages/copilot/CopilotPage'));
export const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

/** Partner portal — tách chunk riêng. */
export const PartnerDashboardPage = lazy(() => import('@/pages/partner/PartnerDashboardPage'));
export const PartnerTenantsPage = lazy(() => import('@/pages/partner/PartnerTenantsPage'));
export const PartnerPaymentsPage = lazy(() => import('@/pages/partner/PartnerPaymentsPage'));
export const PartnerAuditPage = lazy(() => import('@/pages/partner/PartnerAuditPage'));
export const PartnerPlansPage = lazy(() => import('@/pages/partner/PartnerPlansPage'));

/** Onboarding — ít truy cập sau lần đầu. */
export const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage'));
export const OnboardingCallbackPage = lazy(
  () => import('@/pages/onboarding/OnboardingCallbackPage'),
);
