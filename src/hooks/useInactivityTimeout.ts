import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  isSessionExpired,
  updateLastActivity,
  clearAuthData,
  getStoredUser,
  getRemainingInactivityMs,
  type SessionSyncMessage,
} from "../utils/authStorage";
import { notifyAuthChanged } from "../utils/dataSync";
import authService from "../services/auth/authService";

const WARNING_THRESHOLD_MS = 60 * 1000; // 60 seconds warning before auto-lockout
const ACTIVITY_THROTTLE_MS = 5 * 1000; // Throttle frequent events (mousemove, scroll) to max once per 5s

export interface UseInactivityTimeoutResult {
  isWarningOpen: boolean;
  remainingSeconds: number;
  extendSession: () => void;
  logoutNow: () => void;
}

/**
 * Custom hook to monitor user inactivity for authenticated Admin sessions.
 * Enforces dynamic inactivity timeout configured via System Settings across all tabs.
 */
export const useInactivityTimeout = (): UseInactivityTimeoutResult => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  const lastThrottleRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);

  const performLogout = useCallback(
    async (reasonMessage = "Your session has expired due to inactivity. Please sign in again.") => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("session_expired_message", reasonMessage);
          } catch {
            /* ignore storage errors */
          }
        }
        await authService.logout("inactivity");
      } catch {
        clearAuthData(true, "inactivity");
        notifyAuthChanged();
      } finally {
        setIsWarningOpen(false);
        navigate("/?expired=true", { replace: true });
      }
    },
    [navigate]
  );

  const extendSession = useCallback(() => {
    updateLastActivity(true);
    setIsWarningOpen(false);
  }, []);

  const logoutNow = useCallback(async () => {
    setIsWarningOpen(false);
    try {
      sessionStorage.removeItem("session_expired_message");
    } catch {
      /* ignore */
    }
    await authService.logout("manual");
    navigate("/", { replace: true });
  }, [navigate]);

  // Route navigation is meaningful user activity
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      updateLastActivity(true);
      setIsWarningOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;

    // Handle user interaction events with throttling
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current > ACTIVITY_THROTTLE_MS) {
        lastThrottleRef.current = now;
        updateLastActivity(true);
        setIsWarningOpen(false);
      }
    };

    const immediateActivity = () => {
      lastThrottleRef.current = Date.now();
      updateLastActivity(true);
      setIsWarningOpen(false);
    };

    const throttledEvents = ["mousemove", "scroll", "wheel", "touchmove"];
    const immediateEvents = ["click", "mousedown", "pointerdown", "keydown", "touchstart"];

    throttledEvents.forEach((ev) =>
      window.addEventListener(ev, handleUserActivity, { passive: true })
    );
    immediateEvents.forEach((ev) =>
      window.addEventListener(ev, immediateActivity, { passive: true })
    );

    // Cross-tab synchronization via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("pawguard_session_sync");
        channel.onmessage = (e: MessageEvent<SessionSyncMessage>) => {
          if (!e.data || typeof e.data !== "object") return;
          if (e.data.type === "ACTIVITY") {
            setIsWarningOpen(false);
          } else if (e.data.type === "LOGOUT") {
            const reason = e.data.reason;
            clearAuthData(false, reason);
            notifyAuthChanged();
            if (reason === "inactivity" || reason === "unauthorized") {
              navigate("/?expired=true", { replace: true });
            } else {
              try {
                sessionStorage.removeItem("session_expired_message");
              } catch {
                /* ignore */
              }
              navigate("/", { replace: true });
            }
          }
        };
      } catch {
        channel = null;
      }
    }

    // Storage event fallback for cross-tab sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "last_activity") {
        setIsWarningOpen(false);
      } else if (e.key === "user" && !e.newValue) {
        clearAuthData(false, "manual");
        notifyAuthChanged();
        let hasExpiredMsg = false;
        try {
          if (sessionStorage.getItem("session_expired_message")) {
            hasExpiredMsg = true;
          }
        } catch {
          // ignore
        }
        if (hasExpiredMsg) {
          navigate("/?expired=true", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // High-resolution interval check (every 500ms)
    const interval = setInterval(() => {
      const currentUser = getStoredUser();
      if (!currentUser) {
        setIsWarningOpen(false);
        return;
      }

      if (isSessionExpired()) {
        void performLogout("Your session has expired due to inactivity. Please sign in again.");
        return;
      }

      const remainingMs = getRemainingInactivityMs();
      if (remainingMs <= WARNING_THRESHOLD_MS && remainingMs > 0) {
        const secs = Math.max(1, Math.ceil(remainingMs / 1000));
        setRemainingSeconds(secs);
        setIsWarningOpen(true);
      } else if (remainingMs > WARNING_THRESHOLD_MS) {
        setIsWarningOpen(false);
      }
    }, 500);

    return () => {
      throttledEvents.forEach((ev) =>
        window.removeEventListener(ev, handleUserActivity)
      );
      immediateEvents.forEach((ev) =>
        window.removeEventListener(ev, immediateActivity)
      );
      window.removeEventListener("storage", handleStorageChange);
      if (channel) {
        channel.close();
      }
      clearInterval(interval);
    };
  }, [navigate, performLogout]);

  return {
    isWarningOpen,
    remainingSeconds,
    extendSession,
    logoutNow,
  };
};

export default useInactivityTimeout;
