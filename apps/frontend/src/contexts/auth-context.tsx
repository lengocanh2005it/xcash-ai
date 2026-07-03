import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@xcash/shared-types';
import { Role } from '@xcash/shared-types';
import axios from 'axios';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type AuthSessionData, api, getApiData, postApiData, setAccessToken } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { AuthenticatedUser } from '@/types/auth';
import type { OnboardingStatus } from '@/types/onboarding';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  businessName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingStatus: OnboardingStatus | undefined;
  isOnboardingLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthenticatedUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<AuthSessionData | null> {
  try {
    const response = await axios.post<ApiResponse<AuthSessionData>>(
      `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const session = response.data.data ?? null;
    if (session?.accessToken) {
      setAccessToken(session.accessToken);
      return session;
    }
    return null;
  } catch {
    setAccessToken(null);
    try {
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'}/auth/logout`,
        {},
        { withCredentials: true },
      );
    } catch {
      // Stale cookie — already invalid.
    }
    return null;
  }
}

function applySession(
  session: AuthSessionData | null,
  setUser: (user: AuthenticatedUser | null) => void,
) {
  if (session) {
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }

  setAccessToken(null);
  setUser(null);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshSession = useCallback(async () => {
    const session = await fetchSession();
    return applySession(session, setUser);
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setIsBootstrapping(false));
  }, [refreshSession]);

  const { data: onboardingStatus, isLoading: isOnboardingLoading } = useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: () => getApiData<OnboardingStatus>('/onboarding/status'),
    enabled: Boolean(user && user.role !== Role.CAS_PARTNER),
    staleTime: 10_000,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => postApiData<AuthSessionData>('/auth/login', input),
    onSuccess: (session) => {
      applySession(session, setUser);
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => postApiData<AuthSessionData>('/auth/register', input),
    onSuccess: (session) => {
      applySession(session, setUser);
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading:
        isBootstrapping ||
        loginMutation.isPending ||
        registerMutation.isPending ||
        logoutMutation.isPending,
      isAuthenticated: Boolean(user),
      onboardingStatus,
      isOnboardingLoading,
      login: async (input) => {
        await loginMutation.mutateAsync(input);
      },
      register: async (input) => {
        await registerMutation.mutateAsync(input);
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
      refreshSession,
    }),
    [
      user,
      isBootstrapping,
      loginMutation,
      registerMutation,
      logoutMutation,
      onboardingStatus,
      isOnboardingLoading,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

export { getErrorMessage };
