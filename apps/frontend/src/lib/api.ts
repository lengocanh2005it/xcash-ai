import type { ApiResponse } from '@xcash/shared-types';
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthenticatedUser } from '@/types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface AuthSessionData {
  accessToken: string;
  user: AuthenticatedUser;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

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

function isAuthBypassRoute(url?: string): boolean {
  if (!url) {
    return false;
  }

  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/logout')
  );
}

async function clearStaleRefreshSession() {
  accessToken = null;
  try {
    await axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true });
  } catch {
    // Cookie may already be invalid — ignore.
  }
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
