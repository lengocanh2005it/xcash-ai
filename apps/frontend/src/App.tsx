import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { PartnerLayout } from '@/components/layout/PartnerLayout';
import { TenantLayout } from '@/components/layout/TenantLayout';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import AccountsPage from '@/pages/accounts/AccountsPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import CopilotPage from '@/pages/copilot/CopilotPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import OnboardingCallbackPage from '@/pages/onboarding/OnboardingCallbackPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import PartnerDashboardPage from '@/pages/partner/PartnerDashboardPage';
import PartnerPaymentsPage from '@/pages/partner/PartnerPaymentsPage';
import PartnerPlansPage from '@/pages/partner/PartnerPlansPage';
import PartnerTenantsPage from '@/pages/partner/PartnerTenantsPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import ReviewPage from '@/pages/review/ReviewPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import { GuestRoute, ProtectedRoute } from '@/routes/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

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

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/callback"
              element={
                <ProtectedRoute>
                  <OnboardingCallbackPage />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <PartnerLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/partner" element={<Navigate to="/partner/dashboard" replace />} />
              <Route path="/partner/dashboard" element={<PartnerDashboardPage />} />
              <Route path="/partner/tenants" element={<PartnerTenantsPage />} />
              <Route path="/partner/payments" element={<PartnerPaymentsPage />} />
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

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
