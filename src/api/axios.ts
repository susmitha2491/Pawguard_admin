import axios from "axios";
import { notifyAuthChanged } from "../utils/dataSync";
import { clearAuthData, isSessionExpired, getStoredUser, getAccessToken } from "../utils/authStorage";

// Base API configuration: use relative /api/v1 in Vite dev mode (proxied to backend), or environment-configured URL
const getBaseUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (import.meta.env.DEV) {
    return "/api/v1";
  }
  if (envApiUrl && envApiUrl.trim() !== "" && envApiUrl.trim() !== "/api/v1") {
    const trimmed = envApiUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed.replace(/\/+$/, "")}/api/v1`;
    }
    return trimmed;
  }
  return "https://pawguard-backend-dev.onrender.com/api/v1";
};

const API_BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 45000,
  withCredentials: true,
});

// Request Interceptor: Attach Bearer token and enforce 15-minute session inactivity timeout
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      if (config.headers && typeof config.headers.set === "function") {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
    }

    const isAuthEndpoint =
      typeof config.url === "string" &&
      (config.url.includes("/auth/login") || config.url.includes("/auth/register"));

    if (!isAuthEndpoint) {
      const user = getStoredUser();
      if (user) {
        if (isSessionExpired()) {
          clearAuthData();
          notifyAuthChanged();
          window.location.href = "/";
          return Promise.reject(new axios.Cancel("Session expired due to 15 minutes of inactivity."));
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRedirectingToLogin = false;

// Response Interceptor: Global response handler for HTTP 401 session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const requestUrl = typeof error.config?.url === "string" ? error.config.url : "";
      const isAuthEndpoint =
        requestUrl.includes("/auth/login") ||
        requestUrl.includes("/auth/register") ||
        requestUrl.includes("/auth/password/reset");

      if (!isAuthEndpoint) {
        clearAuthData();
        notifyAuthChanged();

        if (!isRedirectingToLogin) {
          isRedirectingToLogin = true;
          if (typeof window !== "undefined" && window.location.pathname !== "/") {
            try {
              sessionStorage.setItem("session_expired_message", "Your session has expired. Please sign in again.");
            } catch {
              // Ignore storage errors
            }
            window.location.href = "/?expired=true";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;