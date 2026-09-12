import { useState, useEffect, useCallback } from "react";
import notificationService from "../services/notificationService";
import type { NotificationItem } from "../types/auth";
import { getCurrentUser } from "../utils/roleUtils";
import { AUTH_CHANGED_EVENT } from "../utils/dataSync";

interface UseNotificationsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
}

// Module-level shared state cache to avoid duplicate request storms across multiple mounted components
let sharedNotificationsCache: NotificationItem[] = [];
let sharedUnreadCountCache = 0;
let sharedLastFetched: number | null = null;
let inFlightNotificationsPromise: Promise<NotificationItem[]> | null = null;

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
};

/**
 * Fetch shared notifications with in-flight deduplication and authentication check
 */
export const fetchSharedNotifications = async (): Promise<NotificationItem[]> => {
  if (inFlightNotificationsPromise) {
    return inFlightNotificationsPromise;
  }

  const user = getCurrentUser();
  if (!user && typeof window !== "undefined" && !localStorage.getItem("pawguard_token") && !localStorage.getItem("token")) {
    return sharedNotificationsCache;
  }

  inFlightNotificationsPromise = (async () => {
    try {
      const list = await notificationService.getNotifications();
      sharedNotificationsCache = list;
      sharedUnreadCountCache = list.filter((n) => !n.read).length;
      sharedLastFetched = Date.now();
      notifySubscribers();
      return list;
    } finally {
      inFlightNotificationsPromise = null;
    }
  })();

  return inFlightNotificationsPromise;
};

/**
 * Force refetch of shared notifications (invalidates cache)
 */
export const refetchNotifications = async (): Promise<NotificationItem[]> => {
  sharedLastFetched = null;
  return fetchSharedNotifications();
};

let globalPollTimer: ReturnType<typeof setInterval> | null = null;

const startGlobalPolling = (interval = 30000) => {
  if (globalPollTimer) return;
  globalPollTimer = setInterval(async () => {
    // Pause polling when browser tab is inactive or hidden
    if (typeof document !== "undefined" && document.hidden) return;
    if (subscribers.size === 0) return;

    // Check user authentication status before polling
    const user = getCurrentUser();
    if (!user && typeof window !== "undefined" && !localStorage.getItem("pawguard_token") && !localStorage.getItem("token")) {
      return;
    }

    try {
      await fetchSharedNotifications();
    } catch {
      /* ignore background poll failures */
    }
  }, interval);
};

const stopGlobalPollingIfUnused = () => {
  if (subscribers.size === 0 && globalPollTimer) {
    clearInterval(globalPollTimer);
    globalPollTimer = null;
  }
};

// Module-level event listeners for tab visibility and auth changes
if (typeof window !== "undefined") {
  window.addEventListener(AUTH_CHANGED_EVENT, () => {
    const user = getCurrentUser();
    if (!user && !localStorage.getItem("pawguard_token") && !localStorage.getItem("token")) {
      sharedNotificationsCache = [];
      sharedUnreadCountCache = 0;
      sharedLastFetched = null;
      notifySubscribers();
      if (globalPollTimer) {
        clearInterval(globalPollTimer);
        globalPollTimer = null;
      }
    } else {
      void refetchNotifications();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && subscribers.size > 0) {
      if (sharedLastFetched === null || Date.now() - sharedLastFetched > 30000) {
        void fetchSharedNotifications();
      }
    }
  });
}

/**
 * Custom hook for managing notifications with shared caching, tab-awareness, and role-based access
 */
export const useNotifications = (options: UseNotificationsOptions = {}) => {
  const { autoRefresh = true, refreshInterval = 30000 } = options;

  const [notifications, setNotifications] = useState<NotificationItem[]>(sharedNotificationsCache);
  const [loading, setLoading] = useState(sharedLastFetched === null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(sharedUnreadCountCache);

  /**
   * Fetch notifications from backend
   */
  const fetchNotifications = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad && sharedLastFetched === null) {
        setLoading(true);
      }
      setError(null);

      const list = await fetchSharedNotifications();
      setNotifications(list);
      setUnreadCount(sharedUnreadCountCache);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notifications");
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const updated = await notificationService.markAsRead(notificationId);
      sharedNotificationsCache = sharedNotificationsCache.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      sharedUnreadCountCache = sharedNotificationsCache.filter((n) => !n.read).length;

      setNotifications(sharedNotificationsCache);
      setUnreadCount(sharedUnreadCountCache);
      notifySubscribers();
      return updated;
    } catch (err) {
      console.error(`Failed to mark notification ${notificationId} as read:`, err);
      throw err;
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      sharedNotificationsCache = sharedNotificationsCache.map((n) => ({ ...n, read: true }));
      sharedUnreadCountCache = 0;

      setNotifications(sharedNotificationsCache);
      setUnreadCount(0);
      notifySubscribers();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
      throw err;
    }
  }, []);

  /**
   * Delete a notification
   */
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      sharedNotificationsCache = sharedNotificationsCache.filter((n) => n.id !== notificationId);
      sharedUnreadCountCache = sharedNotificationsCache.filter((n) => !n.read).length;

      setNotifications(sharedNotificationsCache);
      setUnreadCount(sharedUnreadCountCache);
      notifySubscribers();
    } catch (err) {
      console.error(`Failed to delete notification ${notificationId}:`, err);
      throw err;
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchNotifications(false);
  }, [fetchNotifications]);

  useEffect(() => {
    const subscriber = () => {
      setNotifications(sharedNotificationsCache);
      setUnreadCount(sharedUnreadCountCache);
    };

    subscribers.add(subscriber);

    // Initial fetch if cache is empty or stale (> 30s)
    if (sharedLastFetched === null || Date.now() - sharedLastFetched > refreshInterval) {
      fetchNotifications(true);
    }

    if (autoRefresh) {
      startGlobalPolling(refreshInterval);
    }

    return () => {
      subscribers.delete(subscriber);
      stopGlobalPollingIfUnused();
    };
  }, [fetchNotifications, autoRefresh, refreshInterval]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
};

export default useNotifications;
