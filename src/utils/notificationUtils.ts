import type { NotificationItem } from "../types/auth";

export interface ResolvedNotificationRoute {
  route: string | null;
  isValid: boolean;
  reason?: string;
}

/**
 * Valid client-side route paths defined in App.tsx
 */
const VALID_EXACT_ROUTES = new Set([
  "/dashboard",
  "/dashboard/super-admin",
  "/dashboard/rescue-centre-admin",
  "/dashboard/rescue-coordinator",
  "/dashboard/rescue-agent",
  "/dashboard/veterinarian",
  "/dashboard/shelter-manager",
  "/dashboard/adoption-coordinator",
  "/dashboard/foster-coordinator",
  "/dashboard/volunteer-coordinator",
  "/dashboard/volunteer",
  "/dashboard/foster-family",
  "/dashboard/donor",
  "/dashboard/general-public",
  "/dashboard/inventory-manager",
  "/dashboard/finance",
  "/users",
  "/rescues",
  "/rescue-requests",
  "/rescue-dispatch",
  "/pets",
  "/shelter-dogs",
  "/shelters",
  "/adoptions",
  "/fosters",
  "/volunteers",
  "/lost-and-found",
  "/medical-records",
  "/vet-directory",
  "/medical-reminders",
  "/inventory",
  "/finance",
  "/vehicles",
  "/reports",
  "/roles-permissions",
  "/cms",
  "/audit-logs",
  "/system-settings",
  "/settings",
  "/notifications",
  "/certificates",
]);

/**
 * Map raw backend paths or malformed paths to valid frontend routes
 */
const ROUTE_ALIAS_MAP: Record<string, string> = {
  "/veterinarian-dashboard": "/medical-records",
  "/medical": "/medical-records",
  "/vet-dashboard": "/medical-records",
  "/rescue": "/rescues",
  "/rescue-management": "/rescues",
  "/adoption": "/adoptions",
  "/foster": "/fosters",
  "/volunteer": "/volunteers",
  "/shelter": "/shelters",
  "/vehicle": "/vehicles",
  "/audit": "/audit-logs",
  "/setting": "/system-settings",
  "/role": "/roles-permissions",
  "/roles": "/roles-permissions",
  "/user": "/users",
  "/certificate": "/certificates",
  "/lost-found": "/lost-and-found",
};

/**
 * Resolves a notification item to a valid frontend route or returns null if no valid target exists.
 */
export function resolveNotificationRoute(item: NotificationItem | null | undefined): ResolvedNotificationRoute {
  if (!item) {
    return { route: null, isValid: false, reason: "Notification item is empty" };
  }

  const rawData = item.data || {};
  const rawUrl = String(rawData.action_url || (item as any).action_url || (item as any).target_url || "").trim();

  // 1. Try resolving action_url if provided
  if (rawUrl && rawUrl !== "null" && rawUrl !== "undefined") {
    // Strip protocol & host if full URL
    let path = rawUrl.replace(/^(?:https?:\/\/[^/]+)/i, "");

    // Strip API prefix if present (e.g., /api/v1/rescues/123 -> /rescues/123)
    path = path.replace(/^\/api\/v1/i, "").replace(/^\/api/i, "");

    // Strip trailing slashes
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    // Check exact match
    if (VALID_EXACT_ROUTES.has(path)) {
      return { route: path, isValid: true };
    }

    // Check alias match
    if (ROUTE_ALIAS_MAP[path]) {
      return { route: ROUTE_ALIAS_MAP[path], isValid: true };
    }

    // Handle parameter routes (e.g. /rescues/123 -> /rescues)
    const segments = path.split("?")[0].split("#")[0].split("/").filter(Boolean);
    if (segments.length > 0) {
      const topSegment = "/" + segments[0];

      if (VALID_EXACT_ROUTES.has(topSegment)) {
        return { route: topSegment, isValid: true };
      }

      if (ROUTE_ALIAS_MAP[topSegment]) {
        return { route: ROUTE_ALIAS_MAP[topSegment], isValid: true };
      }
    }
  }

  // 2. Infer route based on notification type, event_type, or module
  const type = String(item.type || "").toLowerCase().trim();
  const eventType = String(item.event_type || "").toLowerCase().trim();
  const moduleName = String(item.module || rawData.module || rawData.category || "").toLowerCase().trim();

  const combinedType = `${type} ${eventType} ${moduleName}`;

  if (/rescue|emergency|dispatch/.test(combinedType)) {
    if (/dispatch/.test(combinedType)) return { route: "/rescue-dispatch", isValid: true };
    if (/request/.test(combinedType)) return { route: "/rescue-requests", isValid: true };
    return { route: "/rescues", isValid: true };
  }

  if (/medical|vaccine|appointment|checkup|vet/.test(combinedType)) {
    if (/reminder/.test(combinedType)) return { route: "/medical-reminders", isValid: true };
    if (/appointment|vet/.test(combinedType)) return { route: "/vet-directory", isValid: true };
    return { route: "/medical-records", isValid: true };
  }

  if (/adoption/.test(combinedType)) {
    return { route: "/adoptions", isValid: true };
  }

  if (/foster|placement/.test(combinedType)) {
    return { route: "/fosters", isValid: true };
  }

  if (/volunteer/.test(combinedType)) {
    return { route: "/volunteers", isValid: true };
  }

  if (/inventory|stock|reorder|expiry/.test(combinedType)) {
    return { route: "/inventory", isValid: true };
  }

  if (/certificate|clearance/.test(combinedType)) {
    return { route: "/certificates", isValid: true };
  }

  if (/shelter/.test(combinedType)) {
    if (/dog/.test(combinedType)) return { route: "/shelter-dogs", isValid: true };
    return { route: "/shelters", isValid: true };
  }

  if (/vehicle|fleet/.test(combinedType)) {
    return { route: "/vehicles", isValid: true };
  }

  if (/finance|donation|payment|receipt|sponsorship|contribution/.test(combinedType)) {
    return { route: "/finance", isValid: true };
  }

  if (/user_created|user_updated|user_deleted|user/.test(combinedType)) {
    return { route: "/users", isValid: true };
  }

  if (/role|permission/.test(combinedType)) {
    return { route: "/roles-permissions", isValid: true };
  }

  if (/lost|found|pet_alert/.test(combinedType)) {
    return { route: "/lost-and-found", isValid: true };
  }

  if (/audit|log/.test(combinedType)) {
    return { route: "/audit-logs", isValid: true };
  }

  if (/setting/.test(combinedType)) {
    return { route: "/system-settings", isValid: true };
  }

  // Return fallback if no route could be inferred
  return {
    route: null,
    isValid: false,
    reason: "No matching destination route found for notification type or action URL.",
  };
}
