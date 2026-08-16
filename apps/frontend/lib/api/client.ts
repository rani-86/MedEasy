import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send/receive the httpOnly refresh cookie across origins (Vercel <-> Render)
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints where a 401 means "wrong credentials", not "expired access token" —
// retrying these through the refresh flow would be meaningless (there's no session yet)
// or would recurse on the refresh call itself.
const AUTH_ENDPOINTS_EXEMPT_FROM_REFRESH = ['/otp/request', '/otp/verify', '/login/doctor', '/login/admin', '/refresh'];

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const res = await axios.post(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const token = res.data.data.accessToken as string;
  useAuthStore.getState().setAccessToken(token);
  return token;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isExempt = AUTH_ENDPOINTS_EXEMPT_FROM_REFRESH.some((path) => originalRequest?.url?.includes(path));

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isExempt) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // The refresh token itself is invalid/expired — there's no session to recover.
      // Clearing accessToken flips every page's `if (!accessToken)` guard, which sends
      // the user back to a login screen without each page needing its own logout logic.
      useAuthStore.getState().setAccessToken(null);
      return Promise.reject(refreshError);
    }
  },
);
