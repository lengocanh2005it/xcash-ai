import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PartnerLayout } from '@/components/layout/PartnerLayout';
import { TenantLayout } from '@/components/layout/TenantLayout';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import AccountsPage from '@/pages/accounts/AccountsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import AcceptInvitePage from '@/pages/auth/AcceptInvitePage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage';
import CopilotPage from '@/pages/copilot/CopilotPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import NotFoundPage from '@/pages/errors/NotFoundPage';
import LandingPage from '@/pages/landing/LandingPage';
import OnboardingCallbackPage from '@/pages/onboarding/OnboardingCallbackPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import PartnerAuditPage from '@/pages/partner/PartnerAuditPage';
import PartnerDashboardPage from '@/pages/partner/PartnerDashboardPage';
import PartnerPaymentsPage from '@/pages/partner/PartnerPaymentsPage';
import PartnerPlansPage from '@/pages/partner/PartnerPlansPage';
import PartnerTenantsPage from '@/pages/partner/PartnerTenantsPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import ReviewPage from '@/pages/review/ReviewPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import {
  GuestRoute,
  LandingRoute,
  PartnerRoute,
  ProtectedRoute,
  TenantAuthRoute,
} from '@/routes/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <LandingRoute>
                    <LandingPage />
                  </LandingRoute>
                }
              />

              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <LoginPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <RegisterPage />
                  </GuestRoute>
                }
              />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route
                path="/forgot-password"
                element={
                  <GuestRoute>
                    <ForgotPasswordPage />
                  </GuestRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <GuestRoute>
                    <ResetPasswordPage />
                  </GuestRoute>
                }
              />

              <Route
                path="/onboarding"
                element={
                  <TenantAuthRoute>
                    <OnboardingPage />
                  </TenantAuthRoute>
                }
              />
              <Route
                path="/onboarding/callback"
                element={
                  <TenantAuthRoute>
                    <OnboardingCallbackPage />
                  </TenantAuthRoute>
                }
              />

              <Route
                element={
                  <PartnerRoute>
                    <PartnerLayout />
                  </PartnerRoute>
                }
              >
                <Route path="/partner" element={<Navigate to="/partner/dashboard" replace />} />
                <Route path="/partner/dashboard" element={<PartnerDashboardPage />} />
                <Route path="/partner/tenants" element={<PartnerTenantsPage />} />
                <Route path="/partner/payments" element={<PartnerPaymentsPage />} />
                <Route path="/partner/audit-logs" element={<PartnerAuditPage />} />
                <Route path="/partner/plans" element={<PartnerPlansPage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute requireOnboarding>
                    <TenantLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
