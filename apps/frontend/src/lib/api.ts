import type { ApiResponse } from '@xcash/shared-types';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthenticatedUser } from '@/types/auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface AuthSessionData {
  accessToken: string;
  user: AuthenticatedUser;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
// Guard to prevent concurrent logout calls from different code paths (e.g., SSE hook
// and axios interceptor both detecting an expired session at the same time).
let logoutInitiated = false;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  const response = await axios.post<ApiResponse<AuthSessionData>>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );

  const token = response.data.data?.accessToken ?? null;
  accessToken = token;
  return token;
}

/** Lấy access token hợp lệ — tự refresh nếu chưa có hoặc token hiện tại đã expire. */
export async function getValidAccessToken(): Promise<string | null> {
  if (accessToken) {
    // Kiểm tra token còn hạn không (decode phần payload, không cần verify signature)
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expiresSec = payload.exp as number;
      // Còn >30s → dùng luôn
      if (expiresSec && expiresSec * 1000 > Date.now() + 30_000) return accessToken;
    } catch {
      // Không parse được → refresh
    }
  }

  // Token hết hạn hoặc không có → refresh, deduplicate nhiều caller cùng lúc
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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

async function clearStaleRefreshSession() {
  if (logoutInitiated) {
    accessToken = null;
    return;
  }
  logoutInitiated = true;
  accessToken = null;
  try {
    await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
  } catch {
    // Cookie may already be invalid — ignore.
  }
}

/** Gọi trước khi tự xử lý logout ở tầng UI (vd: useNotifications) để ngăn clearStaleRefreshSession gọi thêm lần nữa. */
export function markLogoutInitiated() {
  logoutInitiated = true;
}

/** Reset sau khi login thành công — cho phép phát hiện session hết hạn lần tiếp theo. */
export function resetLogoutState() {
  logoutInitiated = false;
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

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken()
          .catch(async () => {
            await clearStaleRefreshSession();
            return null;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

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

export async function deleteApiData<T, B = unknown>(url: string, body?: B): Promise<T> {
  const response = await api.delete<ApiResponse<T>>(url, body ? { data: body } : undefined);
  return response.data.data as T;
}
