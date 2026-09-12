import api from "../api/axios";
import type { NotificationItem, UserRole } from "../types/auth";
import { getCurrentUser, getCurrentUserRole } from "../utils/roleUtils";
import { formatDateTime } from "../utils/dateUtils";

export interface NotificationResponse {
  id: string;
  title: string;
  body: string;
  notification_type?: string | null;
  module?: string | null;
  role?: string | null;
  is_read?: boolean;
  is_broadcast?: boolean;
  created_at?: string;
  sent_at?: string;
  action_url?: string | null;
  user_id?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NotificationsListResponse {
  data: NotificationResponse[];
  total: number;
  unread_count: number;
}

export interface NotificationGovernanceOverview {
  pending_approvals?: number;
  pending?: number;
  sent_today?: number;
  sent?: number;
  total_sent?: number;
  blocked?: number;
  paused?: number;
  failed?: number;
  delivery_rate?: number;
  active_triggers?: number;
  is_paused?: boolean;
}

export interface GlobalNotificationEngineStatus {
  is_paused: boolean;
  paused_reason?: string | null;
  channels?: Record<string, boolean>;
  rate_limit_per_minute?: number;
}

export interface NotificationApprovalItem {
  id: string;
  title: string;
  body?: string;
  message?: string;
  module?: string;
  trigger?: string;
  recipient_count?: number;
  recipients?: number;
  priority?: "high" | "normal" | "urgent" | string;
  created_at?: string;
  submitted_at?: string;
  status: "pending" | "approved" | "rejected" | "paused" | string;
  rejection_reason?: string | null;
  paused_reason?: string | null;
  reason?: string | null;
  [key: string]: unknown;
}

export interface NotificationDispatchLog {
  id: string;
  notification_title?: string;
  title?: string;
  module?: string;
  trigger?: string;
  status: "delivered" | "sent" | "failed" | "queued" | string;
  recipient_count?: number;
  created_at?: string;
  sent_at?: string;
  failure_reason?: string | null;
  error?: string | null;
  [key: string]: unknown;
}

export interface NotificationAuditLog {
  id: string;
  actor?: string;
  actor_email?: string;
  user?: string;
  action: string;
  approval_id?: string;
  notification_id?: string;
  module?: string;
  trigger?: string;
  timestamp?: string;
  created_at?: string;
  result?: string;
  reason?: string | null;
  [key: string]: unknown;
}

/**
 * Check if a notification is an Inventory / Low Stock alert
 */
export const isInventoryNotification = (notif: NotificationItem): boolean => {
  const type = String(notif.type || "").toLowerCase();
  const title = String(notif.title || "").toLowerCase();
  const message = String(notif.message || "").toLowerCase();

  return (
    type === "inventory" ||
    type === "inventory_changed" ||
    type === "inventory_low_stock" ||
    type === "inventory_alert" ||
    type === "expiry_alert" ||
    title.includes("inventory") ||
    title.includes("stock") ||
    title.includes("reorder") ||
    title.includes("requisition") ||
    message.includes("inventory") ||
    message.includes("stock level") ||
    message.includes("below reorder threshold")
  );
};

/**
 * Check if a notification is related to rescue operations
 */
export const isRescueNotification = (notif: NotificationItem): boolean => {
  const type = String(notif.type || "").toLowerCase().trim();
  const eventType = String(notif.event_type || "").toLowerCase().trim();
  const notifData = notif.data || {};
  const moduleName = String(
    notifData.module || notifData.category || notif.module || (notif as any).category || ""
  ).toLowerCase().trim();

  // Known rescue operation types, event types, or modules
  const rescueIdentifiers = new Set([
    "rescue",
    "emergency",
    "dispatch",
    "vehicle",
    "rescue_request",
    "rescue_verification",
    "rescue_assignment",
    "rescue_completion",
    "rescue_escalation",
    "rescue_failure",
    "shelter_handover",
  ]);

  if (rescueIdentifiers.has(type) || rescueIdentifiers.has(eventType) || rescueIdentifiers.has(moduleName)) {
    return true;
  }

  // Prefix matching for rescue_, dispatch_, emergency_
  if (
    type.startsWith("rescue") ||
    type.startsWith("dispatch") ||
    type.startsWith("emergency") ||
    eventType.startsWith("rescue") ||
    eventType.startsWith("dispatch") ||
    eventType.startsWith("emergency") ||
    moduleName.startsWith("rescue") ||
    moduleName.startsWith("dispatch") ||
    moduleName.startsWith("emergency")
  ) {
    return true;
  }

  // Metadata check for explicit rescue links
  if (
    Boolean(notifData.rescue_id) ||
    Boolean(notifData.rescueId) ||
    Boolean(notifData.dispatch_id) ||
    Boolean(notifData.dispatchId) ||
    Boolean(notifData.is_rescue)
  ) {
    return true;
  }

  return false;
};

/**
 * Check if a notification is strictly relevant to the authenticated Donor.
 * Enforces strict donor isolation:
 * - Allows: donations, sponsorships, 80G tax receipts, contributions, donor profile updates,
 *   sponsored dog updates, and broadcasts explicitly targeted to donors.
 * - Prohibits: rescue dispatches, shelter operations, inventory alerts, internal veterinary reminders,
 *   admin governance alerts, volunteer shifts, and untargeted internal staff broadcasts.
 */
export const isDonorNotification = (notif: NotificationItem, user: any): boolean => {
  // 1. Hard exclusions for non-donor operational domains
  if (isRescueNotification(notif)) return false;
  if (isInventoryNotification(notif)) return false;

  const type = String(notif.type || "").toLowerCase().trim();
  const eventType = String(notif.event_type || "").toLowerCase().trim();
  const notifData = notif.data || {};
  const moduleName = String(
    notifData.module || notifData.category || notif.module || (notif as any).category || ""
  ).toLowerCase().trim();
  const actionUrl = String(notifData.action_url || notif.action_url || "").toLowerCase().trim();
  const title = String(notif.title || "").toLowerCase().trim();
  const message = String(notif.message || "").toLowerCase().trim();

  // Internal staff routes
  if (
    actionUrl.startsWith("/dashboard/rescue") ||
    actionUrl.startsWith("/dashboard/shelter") ||
    actionUrl.startsWith("/shelter") ||
    actionUrl.startsWith("/inventory") ||
    actionUrl.startsWith("/admin") ||
    actionUrl.startsWith("/settings")
  ) {
    return false;
  }

  // Internal shelter/kennel operations
  if (
    type === "shelter" ||
    type === "shelter_transfer" ||
    type === "transfer_requested" ||
    type === "placement_requested" ||
    type === "kennel" ||
    moduleName === "shelter"
  ) {
    return false;
  }

  // Internal administrative & staff governance
  const adminStaffTypes = new Set([
    "system",
    "user_created",
    "user_updated",
    "user_deleted",
    "role_permission_changed",
    "certificate_generated",
    "governance_push",
    "settings",
    "backup",
    "volunteer",
    "volunteer_shift",
  ]);
  if (adminStaffTypes.has(type) || adminStaffTypes.has(eventType)) {
    return false;
  }

  // Internal medical/veterinary reminders: only allow if explicitly linked to a sponsored animal
  const medicalTypes = new Set(["medical", "medical_reminder", "medical_updated", "medical_checkup"]);
  if (medicalTypes.has(type) || medicalTypes.has(eventType) || moduleName === "medical") {
    const isSponsored = Boolean(
      notifData.is_sponsored ||
      notifData.sponsored ||
      notifData.sponsorship_id ||
      (notifData.donor_id && String(notifData.donor_id) === String(user?.id))
    );
    if (!isSponsored) {
      return false;
    }
    return true;
  }

  // Broadcasts: must be explicitly targeted to donors
  const isBroadcast = Boolean(notif.is_broadcast || type === "broadcast" || type === "info");
  if (isBroadcast) {
    const targetRoles = Array.isArray(notif.role_required)
      ? notif.role_required
      : Array.isArray(notifData.target_roles)
      ? notifData.target_roles
      : typeof (notif as any).role === "string" && (notif as any).role
      ? [(notif as any).role]
      : [];
    const audience = String(notifData.audience || notifData.target_role || "").toLowerCase();
    const hasDonorTarget =
      targetRoles.some(
        (r) => String(r).toLowerCase() === "donor" || String(r).toLowerCase() === "all"
      ) ||
      audience === "donor" ||
      audience === "all" ||
      audience === "donors";

    return hasDonorTarget;
  }

  // Check if it's explicitly a donor/donation/sponsorship/tax/profile notification
  const donorAllowedTypes = new Set([
    "donation",
    "donation_completed",
    "donation_received",
    "donation_pending",
    "donation_failed",
    "donation_refunded",
    "donation_receipt",
    "receipt",
    "80g_receipt",
    "tax_receipt",
    "tax",
    "sponsorship",
    "sponsorship_created",
    "sponsorship_payment",
    "sponsorship_reminder",
    "sponsorship_renewal",
    "sponsorship_cancelled",
    "sponsorship_expired",
    "sponsored_dog_update",
    "sponsored_dog_medical",
    "donor_profile",
    "contribution",
    "contribution_update",
  ]);

  if (donorAllowedTypes.has(type) || donorAllowedTypes.has(eventType)) return true;
  if (["donations", "donor", "sponsorship", "sponsorships", "contributions"].includes(moduleName)) return true;
  if (
    notifData.donation_id ||
    notifData.sponsorship_id ||
    notifData.receipt_id ||
    notifData.tax_id ||
    notifData["80g_number"] ||
    notifData.is_sponsored
  ) {
    return true;
  }

  // Title / semantic check for donor events
  if (
    title.includes("donation") ||
    title.includes("sponsorship") ||
    title.includes("80g") ||
    title.includes("tax receipt") ||
    title.includes("contribution") ||
    title.includes("donor profile")
  ) {
    return true;
  }

  // If general message has staff content, reject
  if (
    message.includes("rescues") ||
    message.includes("medical logs") ||
    message.includes("cleaning shift") ||
    message.includes("kennel") ||
    message.includes("stock level")
  ) {
    return false;
  }

  return false;
};

/**
 * Filter notifications based on role and shelter operational assignment.
 * Enforces strict recipient rules:
 * - Super Admin receives all notifications.
 * - Donor receives ONLY donor-scoped notifications (donations, sponsorships, 80G, contributions, sponsored dogs).
 * - Rescue Centre Admin MUST receive ONLY rescue-operation-related notifications.
 * - Inventory Low Stock alerts MUST NOT be sent/displayed to Vets, Rescue Team, or Adopter/Public users.
 * - Primary recipients: Shelter Manager for the specific shelter, Inventory Manager, Admin.
 * - One shelter's inventory alerts MUST NOT be exposed to another shelter's manager.
 */
export const shouldUserReceiveNotification = (
  notif: NotificationItem,
  user: any,
  role: UserRole | null
): boolean => {
  if (!role) return false;

  // Super Admin receives all notifications
  if (role === "super_admin") {
    return true;
  }

  // Strict role scoping for Donor: only donor-relevant notifications
  if (role === "donor") {
    return isDonorNotification(notif, user);
  }

  // Strict role scoping for Rescue Centre Admin: only rescue-operation-related notifications
  if (role === "rescue_centre_admin") {
    return isRescueNotification(notif);
  }

  if (isInventoryNotification(notif)) {
    // 1. Role-based gating:
    // Authorized: super_admin, rescue_centre_admin, inventory_manager, shelter_manager
    // Prohibited: veterinarian, rescue_coordinator, rescue_agent, adoption_coordinator, foster_coordinator, volunteer_coordinator, finance_user, public/adopter
    const allowedRoles: UserRole[] = [
      "super_admin",
      "rescue_centre_admin",
      "inventory_manager",
      "shelter_manager",
    ];

    if (!allowedRoles.includes(role)) {
      return false;
    }

    // 2. Shelter isolation gating for Shelter Managers / Shelter Staff:
    if (role === "shelter_manager") {
      const userShelterId = String(user?.shelter_id || user?.shelterId || user?.facility_id || user?.facilityId || "").trim().toLowerCase();
      const userShelterName = String(user?.shelter || user?.shelter_name || user?.department || "").trim().toLowerCase();

      const notifData = notif.data || {};
      const notifShelterId = String(notifData.shelter_id || notifData.shelterId || (notif as any).shelter_id || "").trim().toLowerCase();
      const notifShelterName = String(notifData.shelter_name || notifData.shelterName || (notif as any).shelter_name || "").trim().toLowerCase();

      if (userShelterId && notifShelterId && userShelterId !== notifShelterId) {
        return false;
      }
      if (userShelterName && notifShelterName && !notifShelterName.includes(userShelterName) && !userShelterName.includes(notifShelterName)) {
        return false;
      }

      // Check text in title/message for explicit shelter mentions (e.g. "Shelter A", "Shelter B")
      const text = `${notif.title} ${notif.message}`.toLowerCase();
      const shelterMatch = text.match(/shelter\s+([a-z0-9_-]+)/i);
      if (userShelterName && shelterMatch) {
        const mentioned = shelterMatch[0].toLowerCase();
        if (!mentioned.includes(userShelterName) && !userShelterName.includes(mentioned)) {
          return false;
        }
      }
    }
  }

  return true;
};

/**
 * Deduplicate notifications to prevent duplicate alerts
 */
export const deduplicateNotifications = (list: NotificationItem[]): NotificationItem[] => {
  const seen = new Set<string>();
  const result: NotificationItem[] = [];

  for (const item of list) {
    const key = `${String(item.title).trim().toLowerCase()}|${String(item.message).trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
};

/**
 * Transform backend notification response to frontend NotificationItem format
 */
const transformNotification = (notif: NotificationResponse & Record<string, any>): NotificationItem => {
  const createdTime = notif.created_at
    ? formatDateTime(notif.created_at)
    : "Just now";

  const rawData = typeof notif.data === "object" && notif.data !== null ? notif.data : {};
  const mergedData = notif.action_url
    ? { ...rawData, action_url: notif.action_url }
    : Object.keys(rawData).length > 0
    ? rawData
    : undefined;

  const targetRoles = Array.isArray(notif.role_required)
    ? notif.role_required
    : Array.isArray(notif.target_roles)
    ? notif.target_roles
    : typeof notif.role === "string" && notif.role
    ? [notif.role]
    : undefined;

  return {
    id: notif.id,
    title: notif.title,
    message: notif.body || notif.message || "",
    type: (notif.notification_type || notif.type || "system") as NotificationItem["type"],
    read: Boolean(notif.is_read ?? notif.read),
    created_at: notif.created_at,
    user_id: notif.user_id,
    time: createdTime,
    event_type: notif.event_type || notif.trigger || notif.action,
    role_required: targetRoles,
    data: mergedData,
    module: notif.module || undefined,
    is_broadcast: Boolean(notif.is_broadcast),
    action_url: notif.action_url || null,
  };
};

/**
 * Notification service - handles all notification API interactions matching OpenAPI specification exactly
 */
export const notificationService = {
  sendBroadcastNotification: async (payload: {
    title: string;
    message: string;
    type?: string;
    targetRoles?: string[];
    actionUrl?: string;
  }): Promise<void> => {
    const user = getCurrentUser();
    const userId = (user as any)?.id;
    if (payload.targetRoles && payload.targetRoles.length > 0) {
      await api.post("/notifications/send", {
        title: payload.title,
        body: payload.message,
        notification_type: payload.type || "general",
        action_url: payload.actionUrl || null,
        send_email: false,
        target_roles: payload.targetRoles,
      });
      return;
    }
    if (!userId) {
      throw new Error("No active user session to deliver notification to.");
    }
    await api.post("/notifications/send", {
      user_id: userId,
      title: payload.title,
      body: payload.message,
      notification_type: payload.type || "general",
      action_url: payload.actionUrl || null,
      send_email: false,
    });
  },

  // GET /api/v1/notifications (paginated: page + page_size)
  getNotifications: async (page: number = 1, pageSize: number = 50): Promise<NotificationItem[]> => {
    const response = await api.get<NotificationsListResponse>("/notifications", {
      params: { page, page_size: pageSize },
    });

    let notifications: NotificationResponse[] = [];
    if (Array.isArray(response.data)) {
      notifications = response.data;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      notifications = response.data.data;
    }

    const transformed = notifications.map(transformNotification);
    const currentUser = getCurrentUser();
    const currentRole = getCurrentUserRole();

    const filtered = transformed.filter((item) => shouldUserReceiveNotification(item, currentUser, currentRole));
    const sorted = deduplicateNotifications(filtered).sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    return sorted;
  },

  // GET /api/v1/notifications/unread-count
  getUnreadCount: async (): Promise<number> => {
    try {
      const notifications = await notificationService.getNotifications();
      return notifications.filter((n) => !n.read).length;
    } catch {
      return 0;
    }
  },

  // PUT /api/v1/notifications/{notification_id}/read
  markAsRead: async (notificationId: string): Promise<NotificationItem> => {
    const response = await api.put<NotificationResponse>(`/notifications/${notificationId}/read`);
    if (response?.data) {
      return transformNotification(response.data);
    }
    return {
      id: notificationId,
      title: "Notification",
      message: "",
      type: "system",
      read: true,
      time: "Just now",
    };
  },

  // PUT /api/v1/notifications/read-all
  markAllAsRead: async (): Promise<{ success: boolean }> => {
    await api.put("/notifications/read-all");
    return { success: true };
  },

  // DELETE /api/v1/notifications/{notification_id}
  deleteNotification: async (notificationId: string): Promise<{ success: boolean }> => {
    await api.delete(`/notifications/${notificationId}`);
    return { success: true };
  },

  // POST /api/v1/notifications/bulk/delete
  bulkDeleteNotifications: async (ids: string[]): Promise<{ success: boolean }> => {
    await api.post("/notifications/bulk/delete", { ids });
    return { success: true };
  },

  // Alias for backward compatibility using valid GET /notifications
  getSystemNotifications: async (): Promise<NotificationItem[]> => {
    return await notificationService.getNotifications();
  },

  // GET /api/v1/admin/notifications/overview
  getGovernanceOverview: async (): Promise<NotificationGovernanceOverview> => {
    const response = await api.get("/admin/notifications/overview");
    return response.data;
  },

  // GET /api/v1/admin/notifications/global
  getGlobalEngineStatus: async (): Promise<GlobalNotificationEngineStatus> => {
    const response = await api.get("/admin/notifications/global");
    return response.data;
  },

  // PUT /api/v1/admin/notifications/global
  updateGlobalEngineStatus: async (payload: { is_paused: boolean; paused_reason?: string; channels?: Record<string, boolean> }) => {
    const response = await api.put("/admin/notifications/global", payload);
    return response.data;
  },

  // GET /api/v1/admin/notifications/approvals
  getApprovalQueue: async (params?: Record<string, unknown>): Promise<NotificationApprovalItem[]> => {
    const response = await api.get("/admin/notifications/approvals", { params });
    return Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data?.items)
      ? response.data.items
      : [];
  },

  // POST /api/v1/admin/notifications/approvals/{id}/approve
  approveNotification: async (id: string) => {
    const response = await api.post(`/admin/notifications/approvals/${id}/approve`);
    return response.data;
  },

  // POST /api/v1/admin/notifications/approvals/{id}/reject
  rejectNotification: async (id: string, reason: string) => {
    const response = await api.post(`/admin/notifications/approvals/${id}/reject`, { reason });
    return response.data;
  },

  // POST /api/v1/admin/notifications/approvals/{id}/pause
  pauseNotification: async (id: string, reason: string) => {
    const response = await api.post(`/admin/notifications/approvals/${id}/pause`, { reason });
    return response.data;
  },

  // POST /api/v1/admin/notifications/approvals/{id}/resume
  resumeNotification: async (id: string) => {
    const response = await api.post(`/admin/notifications/approvals/${id}/resume`);
    return response.data;
  },

  // GET /api/v1/admin/notifications/dispatch-logs
  getDispatchLogs: async (params?: Record<string, unknown>): Promise<NotificationDispatchLog[]> => {
    const response = await api.get("/admin/notifications/dispatch-logs", { params });
    return Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data?.items)
      ? response.data.items
      : [];
  },

  // GET /api/v1/admin/notifications/audit-logs
  getGovernanceAuditLogs: async (params?: Record<string, unknown>): Promise<NotificationAuditLog[]> => {
    const response = await api.get("/admin/notifications/audit-logs", { params });
    return Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data?.items)
      ? response.data.items
      : [];
  },

  // GET /api/v1/admin/notifications/modules
  getModulesConfig: async (): Promise<any[]> => {
    const response = await api.get("/admin/notifications/modules");
    return Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : [];
  },

  // PUT /api/v1/admin/notifications/modules/{module_name}
  updateModuleConfig: async (moduleName: string, payload: Record<string, unknown>) => {
    const response = await api.put(`/admin/notifications/modules/${moduleName}`, payload);
    return response.data;
  },

  // GET /api/v1/admin/notifications/triggers
  getTriggersConfig: async (): Promise<any[]> => {
    const response = await api.get("/admin/notifications/triggers");
    return Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : [];
  },

  // PUT /api/v1/admin/notifications/triggers/{id}
  updateTriggerConfig: async (triggerId: string, payload: Record<string, unknown>) => {
    const response = await api.put(`/admin/notifications/triggers/${triggerId}`, payload);
    return response.data;
  },
};

export default notificationService;
