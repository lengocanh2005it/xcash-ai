import type { ApiResponse } from '@xcash/shared-types';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthenticatedUser } from '@/types/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface AuthSessionData {
  accessToken: string;
  user: AuthenticatedUser;
}

class AuthTokenManager {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private logoutInitiated = false;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  /** Lấy access token hợp lệ — tự refresh nếu chưa có hoặc token hiện tại đã expire. */
  async getValidAccessToken(): Promise<string | null> {
    if (this.accessToken) {
      try {
        const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
        const expiresSec = payload.exp as number;
        if (expiresSec && expiresSec * 1000 > Date.now() + 30_000) return this.accessToken;
      } catch {
        // Không parse được → refresh
      }
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken()
        .catch(() => null)
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string | null> {
    const response = await axios.post<ApiResponse<AuthSessionData>>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );

    const token = response.data.data?.accessToken ?? null;
    this.accessToken = token;
    return token;
  }

  async clearStaleRefreshSession() {
    if (this.logoutInitiated) {
      this.accessToken = null;
      return;
    }
    this.logoutInitiated = true;
    this.accessToken = null;
    try {
      await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // Cookie may already be invalid — ignore.
    }
  }

  /** Gọi trước khi tự xử lý logout ở tầng UI để ngăn clearStaleRefreshSession gọi thêm lần nữa. */
  markLogoutInitiated() {
    this.logoutInitiated = true;
  }

  /** Reset sau khi login thành công — cho phép phát hiện session hết hạn lần tiếp theo. */
  resetLogoutState() {
    this.logoutInitiated = false;
  }
}

export const authTokenManager = new AuthTokenManager();

// ─── Convenience re-exports for backward compatibility ────────────────────────

export function setAccessToken(token: string | null) {
  authTokenManager.setAccessToken(token);
}

export function getAccessToken() {
  return authTokenManager.getAccessToken();
}

export async function getValidAccessToken(): Promise<string | null> {
  return authTokenManager.getValidAccessToken();
}

export function markLogoutInitiated() {
  authTokenManager.markLogoutInitiated();
}

export function resetLogoutState() {
  authTokenManager.resetLogoutState();
}

// ─── Axios instance + interceptors ────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = authTokenManager.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isAuthBypassRoute(url?: string): boolean {
  if (!url) {
    return false;
  }

  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/verify-email') ||
    url.includes('/auth/resend-verification') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/resend-password-reset') ||
    url.includes('/auth/reset-password')
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthBypassRoute(originalRequest.url)
    ) {
      originalRequest._retry = true;

      const newToken = await authTokenManager.getValidAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function getApiData<T>(url: string): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url);
  return response.data.data as T;
}

export async function postApiData<T, B = unknown>(url: string, body?: B): Promise<T> {
  const response = await api.post<ApiResponse<T>>(url, body);
  return response.data.data as T;
}

export async function patchApiData<T, B = unknown>(url: string, body?: B): Promise<T> {
  const response = await api.patch<ApiResponse<T>>(url, body);
  return response.data.data as T;
}

export async function putApiData<T, B = unknown>(url: string, body?: B): Promise<T> {
  const response = await api.put<ApiResponse<T>>(url, body);
  return response.data.data as T;
}

export async function deleteApiData<T, B = unknown>(url: string, body?: B): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, body ? { data: body } : undefined);
  return response.data.data as T;
}
