/**
 * Centralized auth storage supporting Secure HttpOnly Cookie authentication.
 *
 * - HttpOnly cookies are automatically sent by the browser on cross-origin API requests.
 * - Raw JWT access/refresh tokens are NOT stored in localStorage or sessionStorage.
 * - User session metadata (`user`), preferences (`remember_me`, `remember_email`), and
 *   session inactivity timestamp (`last_activity`) are persisted for UI role context.
 * - Inactivity timeout is dynamically configurable via System Settings (default 30 minutes).
 */

export const AUTH_STORAGE_KEYS = {
  user: "user",
  rememberMe: "remember_me",
  rememberEmail: "remember_email",
  lastActivity: "last_activity",
  accessToken: "access_token",
  refreshToken: "refresh_token",
  sessionTimeoutMinutes: "session_timeout_minutes",
} as const;

export const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
export const MIN_SESSION_TIMEOUT_MINUTES = 5;
export const MAX_SESSION_TIMEOUT_MINUTES = 120;

export type SessionSyncMessage =
  | { type: "ACTIVITY"; timestamp: number }
  | { type: "LOGOUT"; reason?: string }
  | { type: "SETTINGS_UPDATED"; sessionTimeoutMinutes: number };

let sessionChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    sessionChannel = new BroadcastChannel("pawguard_session_sync");
  } catch {
    sessionChannel = null;
  }
}

export const broadcastSessionEvent = (msg: SessionSyncMessage): void => {
  if (sessionChannel) {
    try {
      sessionChannel.postMessage(msg);
    } catch {
      /* ignore channel send error */
    }
  }
};

const read = (key: string): string | null => {
  try {
    const session = sessionStorage.getItem(key);
    if (session && session !== "null" && session !== "undefined") return session;
  } catch {
    /* storage unavailable; ignore */
  }
  try {
    const local = localStorage.getItem(key);
    if (local && local !== "null" && local !== "undefined") return local;
  } catch {
    /* storage unavailable; ignore */
  }
  return null;
};

const write = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable; ignore */
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable; ignore */
  }
};

const remove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable; ignore */
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable; ignore */
  }
};

/**
 * Get configured session inactivity timeout in minutes (from System Settings / storage).
 * Falls back to DEFAULT_SESSION_TIMEOUT_MINUTES (30 mins).
 */
export const getSessionTimeoutMinutes = (): number => {
  const raw = read(AUTH_STORAGE_KEYS.sessionTimeoutMinutes);
  if (!raw) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const num = parseInt(raw, 10);
  if (isNaN(num) || num < 1 || num > 1440) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  return num;
};

/**
 * Persist configured session inactivity timeout (in minutes) and sync across tabs.
 */
export const setSessionTimeoutMinutes = (minutes: number): void => {
  const safe = Math.max(1, Math.min(1440, Math.floor(minutes || DEFAULT_SESSION_TIMEOUT_MINUTES)));
  write(AUTH_STORAGE_KEYS.sessionTimeoutMinutes, safe.toString());
  broadcastSessionEvent({ type: "SETTINGS_UPDATED", sessionTimeoutMinutes: safe });
};

/**
 * Get configured session inactivity timeout in milliseconds.
 */
export const getSessionTimeoutMs = (): number => {
  return getSessionTimeoutMinutes() * 60 * 1000;
};

/** Backward-compatible getter for legacy callers */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Update the timestamp of the last user interaction.
 * Synchronizes across multiple open tabs if broadcast = true.
 */
export const updateLastActivity = (broadcast = true): void => {
  const now = Date.now();
  const nowStr = now.toString();
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.lastActivity, nowStr);
  } catch {
    /* storage unavailable; ignore */
  }
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.lastActivity, nowStr);
  } catch {
    /* storage unavailable; ignore */
  }
  if (broadcast) {
    broadcastSessionEvent({ type: "ACTIVITY", timestamp: now });
  }
};

/**
 * Get the timestamp (ms) of the last recorded user interaction.
 */
export const getLastActivity = (): number | null => {
  const raw = read(AUTH_STORAGE_KEYS.lastActivity);
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return isNaN(num) ? null : num;
};

/**
 * Get remaining milliseconds before the inactivity timeout expires.
 */
export const getRemainingInactivityMs = (): number => {
  const last = getLastActivity();
  const timeoutMs = getSessionTimeoutMs();
  if (!last) return timeoutMs;
  const elapsed = Date.now() - last;
  return Math.max(0, timeoutMs - elapsed);
};

/**
 * Check whether the active session has exceeded the configured inactivity timeout.
 */
export const isSessionExpired = (): boolean => {
  const user = getStoredUser();
  if (!user) return false;

  const lastActivity = getLastActivity();
  if (!lastActivity) {
    updateLastActivity(false);
    return false;
  }

  return Date.now() - lastActivity >= getSessionTimeoutMs();
};

export const getStoredUser = <T = unknown>(): T | null => {
  const raw = read(AUTH_STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Whether "Remember Me" was previously enabled by the user. */
export const getRememberMe = (): boolean => {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.rememberMe) === "true";
  } catch {
    return false;
  }
};

export const setRememberMe = (value: boolean): void => {
  try {
    if (value) {
      localStorage.setItem(AUTH_STORAGE_KEYS.rememberMe, "true");
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.rememberMe);
    }
  } catch {
    /* storage unavailable; ignore */
  }
};

/** Email remembered for convenience on the login form (not a credential). */
export const getRememberedEmail = (): string => {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.rememberEmail) ?? "";
  } catch {
    return "";
  }
};

export const setRememberedEmail = (email: string): void => {
  try {
    if (email) {
      localStorage.setItem(AUTH_STORAGE_KEYS.rememberEmail, email);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.rememberEmail);
    }
  } catch {
    /* storage unavailable; ignore */
  }
};

let memoryAccessToken: string | null = null;

export const getAccessToken = (): string | null => {
  if (memoryAccessToken) return memoryAccessToken;
  
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(AUTH_STORAGE_KEYS.accessToken) ||
          sessionStorage.getItem("access_token") ||
          sessionStorage.getItem("auth_token");
  } catch {
    /* storage unavailable */
  }

  if (!raw) {
    const user = getStoredUser<Record<string, unknown>>();
    if (user && typeof user === "object") {
      if (typeof user.access_token === "string" && user.access_token) raw = user.access_token;
      else if (typeof user.token === "string" && user.token) raw = user.token;
      else if (typeof user.accessToken === "string" && user.accessToken) raw = user.accessToken;
    }
  }

  if (!raw) return null;

  const clean = raw.trim().replace(/^["']|["']$/g, "").trim();
  memoryAccessToken = clean || null;
  return memoryAccessToken;
};

export const getRefreshToken = (): string | null => {
  // Refresh token is handled exclusively via secure HttpOnly cookie (pg_refresh_token).
  // Raw refresh tokens are never persisted in localStorage or sessionStorage.
  return null;
};

export interface AuthData {
  user: unknown;
  access_token?: string;
  refresh_token?: string;
}

/**
 * Persist user session metadata required for UI role context.
 * Access token is scoped to sessionStorage/in-memory. Refresh token is kept in HttpOnly cookie.
 */
export const setAuthData = (data: AuthData, rememberMe: boolean, isInitialLogin = true): void => {
  setRememberMe(rememberMe);

  if (data.user) {
    write(AUTH_STORAGE_KEYS.user, JSON.stringify(data.user));
  }
  if (data.access_token) {
    memoryAccessToken = data.access_token.trim();
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEYS.accessToken, memoryAccessToken);
    } catch {
      /* storage unavailable */
    }
  }
  // Explicitly purge any legacy stored refresh tokens to enforce HttpOnly cookie security
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem("refresh_token");
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    sessionStorage.removeItem("refresh_token");
  } catch {
    /* ignore storage errors */
  }

  if (isInitialLogin || !getLastActivity()) {
    updateLastActivity(true);
  }
};

/** Remove session user metadata and tokens from browser storage. */
export const clearAuthData = (broadcast = true): void => {
  memoryAccessToken = null;
  remove(AUTH_STORAGE_KEYS.user);
  remove(AUTH_STORAGE_KEYS.lastActivity);
  remove(AUTH_STORAGE_KEYS.accessToken);
  remove(AUTH_STORAGE_KEYS.refreshToken);
  remove("access_token");
  remove("refresh_token");
  remove("auth_token");
  remove("token");
  if (broadcast) {
    broadcastSessionEvent({ type: "LOGOUT", reason: "session_cleared" });
  }
};
