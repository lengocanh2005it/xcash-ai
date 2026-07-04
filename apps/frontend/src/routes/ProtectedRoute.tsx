import { Role } from '@xcash/shared-types';
import { Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import NotFoundPage from '@/pages/errors/NotFoundPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

function AuthLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

function OnboardingLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Skeleton className="h-10 w-64" />
    </div>
  );
}

/** Đã đăng nhập — dùng chung cho route cần auth */
export function ProtectedRoute({ children, requireOnboarding = false }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, onboardingStatus, isOnboardingLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role === Role.CAS_PARTNER) {
    return <NotFoundPage />;
  }

  if (requireOnboarding) {
    if (isOnboardingLoading) {
      return <OnboardingLoading />;
    }

    if (!onboardingStatus?.bankingLinked) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}

/** Chỉ Cas Partner — user tenant cố vào /partner/* sẽ thấy 404 */
export function PartnerRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== Role.CAS_PARTNER) {
    return <NotFoundPage />;
  }

  return children;
}

/** Route tenant (onboarding) — Partner không được vào */
export function TenantAuthRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role === Role.CAS_PARTNER) {
    return <NotFoundPage />;
  }

  return children;
}

export function LandingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <OnboardingLoading />;
  }

  if (isAuthenticated) {
    return <NotFoundPage />;
  }

  return children;
}

function AuthenticatedHomeRedirect() {
  const { user, onboardingStatus, isOnboardingLoading } = useAuth();

  if (user?.role === Role.CAS_PARTNER) {
    return <Navigate to="/partner/dashboard" replace />;
  }

  if (isOnboardingLoading) {
    return <OnboardingLoading />;
  }

  if (!onboardingStatus?.bankingLinked) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <OnboardingLoading />;
  }

  if (isAuthenticated) {
    return <AuthenticatedHomeRedirect />;
  }

  return children;
}
