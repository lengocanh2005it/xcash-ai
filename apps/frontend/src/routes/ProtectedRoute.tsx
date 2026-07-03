import { Role } from '@xcash/shared-types';
import { Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = false }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated, onboardingStatus, isOnboardingLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
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

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.role === Role.CAS_PARTNER) {
    return <Navigate to="/partner" replace />;
  }

  if (requireOnboarding) {
    if (isOnboardingLoading) {
      return (
        <div className="flex min-h-svh items-center justify-center p-6">
          <Skeleton className="h-10 w-64" />
        </div>
      );
    }

    if (!onboardingStatus?.bankingLinked) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return children;
}

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, onboardingStatus, isOnboardingLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (user.role === Role.CAS_PARTNER) {
      return <Navigate to="/partner" replace />;
    }

    if (isOnboardingLoading) {
      return (
        <div className="flex min-h-svh items-center justify-center p-6">
          <Skeleton className="h-10 w-64" />
        </div>
      );
    }

    if (!onboardingStatus?.bankingLinked) {
      return <Navigate to="/onboarding" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
