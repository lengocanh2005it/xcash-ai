import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TenantLayout } from '@/components/layout/TenantLayout';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import AccountsPage from '@/pages/accounts/AccountsPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import OnboardingCallbackPage from '@/pages/onboarding/OnboardingCallbackPage';
import OnboardingPage from '@/pages/onboarding/OnboardingPage';
import PartnerPage from '@/pages/partner/PartnerPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import ReviewPage from '@/pages/review/ReviewPage';
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
              path="/partner"
              element={
                <ProtectedRoute>
                  <PartnerPage />
                </ProtectedRoute>
              }
            />

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
              <Route path="/accounts" element={<AccountsPage />} />
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
