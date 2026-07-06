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
import {
  type AuthSessionData,
  api,
  getApiData,
  postApiData,
  resetLogoutState,
  setAccessToken,
} from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { persistLoginPreferences } from '@/lib/remember-me';
import type { AuthenticatedUser } from '@/types/auth';
import type { OnboardingStatus } from '@/types/onboarding';

interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterInput {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResult {
  email: string;
  message: string;
  otpExpiresInSeconds: number;
}

interface VerifyEmailInput {
  email: string;
  otp: string;
}

interface ResendVerificationInput {
  email: string;
}

interface ForgotPasswordInput {
  email: string;
}

export interface ForgotPasswordResult {
  message: string;
  otpExpiresInSeconds?: number;
}

interface ResetPasswordInput {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

interface ResendPasswordResetInput {
  email: string;
}

export interface ResetPasswordResult {
  message: string;
}

interface AcceptInviteInput {
  token: string;
  password: string;
  confirmPassword: string;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  onboardingStatus: OnboardingStatus | undefined;
  isOnboardingLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  verifyEmail: (input: VerifyEmailInput) => Promise<void>;
  resendVerification: (input: ResendVerificationInput) => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<ForgotPasswordResult>;
  resetPassword: (input: ResetPasswordInput) => Promise<ResetPasswordResult>;
  resendPasswordReset: (input: ResendPasswordResetInput) => Promise<void>;
  acceptInvite: (input: AcceptInviteInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthenticatedUser | null>;
  updateUser: (patch: Partial<AuthenticatedUser>) => void;
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
    mutationFn: (input: LoginInput) =>
      postApiData<AuthSessionData>('/auth/login', {
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe !== false,
      }),
    onSuccess: (session, input) => {
      resetLogoutState(); // cho phép phát hiện session hết hạn lần tiếp theo
      applySession(session, setUser);
      persistLoginPreferences(input.email, input.rememberMe !== false);
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => postApiData<RegisterResult>('/auth/register', input),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (input: VerifyEmailInput) =>
      postApiData<AuthSessionData>('/auth/verify-email', input),
    onSuccess: (session) => {
      applySession(session, setUser);
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: (input: ResendVerificationInput) =>
      postApiData<{ message: string; otpExpiresInSeconds: number }>(
        '/auth/resend-verification',
        input,
      ),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      postApiData<ForgotPasswordResult>('/auth/forgot-password', input),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      postApiData<ResetPasswordResult>('/auth/reset-password', input),
  });

  const resendPasswordResetMutation = useMutation({
    mutationFn: (input: ResendPasswordResetInput) =>
      postApiData<{ message: string; otpExpiresInSeconds: number }>(
        '/auth/resend-password-reset',
        input,
      ),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (input: AcceptInviteInput) =>
      postApiData<AuthSessionData>('/auth/accept-invite', input),
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

  const updateUser = useCallback((patch: Partial<AuthenticatedUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading:
        isBootstrapping ||
        loginMutation.isPending ||
        registerMutation.isPending ||
        verifyEmailMutation.isPending ||
        resendVerificationMutation.isPending ||
        forgotPasswordMutation.isPending ||
        resetPasswordMutation.isPending ||
        resendPasswordResetMutation.isPending ||
        acceptInviteMutation.isPending ||
        logoutMutation.isPending,
      isAuthenticated: Boolean(user),
      onboardingStatus,
      isOnboardingLoading,
      login: async (input) => {
        await loginMutation.mutateAsync(input);
      },
      register: async (input) => {
        return registerMutation.mutateAsync(input);
      },
      verifyEmail: async (input) => {
        await verifyEmailMutation.mutateAsync(input);
      },
      resendVerification: async (input) => {
        await resendVerificationMutation.mutateAsync(input);
      },
      forgotPassword: async (input) => {
        return forgotPasswordMutation.mutateAsync(input);
      },
      resetPassword: async (input) => {
        return resetPasswordMutation.mutateAsync(input);
      },
      resendPasswordReset: async (input) => {
        await resendPasswordResetMutation.mutateAsync(input);
      },
      acceptInvite: async (input) => {
        await acceptInviteMutation.mutateAsync(input);
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
      refreshSession,
      updateUser,
    }),
    [
      user,
      isBootstrapping,
      loginMutation,
      registerMutation,
      verifyEmailMutation,
      resendVerificationMutation,
      forgotPasswordMutation,
      resetPasswordMutation,
      resendPasswordResetMutation,
      acceptInviteMutation,
      logoutMutation,
      onboardingStatus,
      isOnboardingLoading,
      refreshSession,
      updateUser,
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
