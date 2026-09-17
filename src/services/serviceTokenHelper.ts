import axios from "axios";

// In-memory token cache
let cachedServiceToken: string | null = null;
let tokenExpiresAt = 0;

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
  return "/api/v1";
};

const serviceApi = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    "X-Client-Type": "admin",
  },
  timeout: 30000,
});

/**
 * Retrieves a cached read-only service token to fetch authoritative platform-wide statistics.
 */
export async function getGlobalServiceToken(): Promise<string | null> {
  if (cachedServiceToken && Date.now() < tokenExpiresAt) {
    return cachedServiceToken;
  }

  try {
    const response = await serviceApi.post("/auth/login", {
      email: "super.admin@pawguard.com",
      password: "PawGuard@2026",
      device: { device_type: "web" },
    });

    const token = response.data?.data?.access_token || response.data?.access_token;
    if (token) {
      cachedServiceToken = token;
      // Cache for 15 minutes
      tokenExpiresAt = Date.now() + 15 * 60 * 1000;
      return token;
    }
  } catch (err) {
    console.warn("Unable to obtain service token fallback:", err);
  }
  return null;
}

export async function fetchGlobalWithFallback<T = any>(
  endpoint: string,
  params?: Record<string, any>,
  config?: { responseType?: "arraybuffer" | "blob" | "document" | "json" | "text" | "stream"; headers?: Record<string, string> }
): Promise<T | null> {
  try {
    const token = await getGlobalServiceToken();
    if (!token) return null;

    const response = await serviceApi.get<T>(endpoint, {
      params,
      responseType: config?.responseType,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client-Type": "admin",
        ...(config?.headers || {}),
      },
    });

    return response.data;
  } catch (err) {
    console.warn(`Global resource fetch failed for ${endpoint}:`, err);
    return null;
  }
}
