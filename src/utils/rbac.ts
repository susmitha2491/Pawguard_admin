import type { UserRole } from "../types/auth";
import { getCurrentUserRole } from "./roleUtils";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ACTIONS,
  parsePermissionKey,
  permissionKey,
  normalizePermissionCode,
} from "./permissionsCatalog";

/** Custom event broadcast whenever a role's permission set changes. */
export const PERMISSIONS_CHANGED_EVENT = "pawguard:permissions-changed";

/** Dispatch an event so every mounted consumer re-evaluates access immediately. */
export const notifyPermissionsChanged = (): void => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PERMISSIONS_CHANGED_EVENT));
  }
};

/**
 * Role-based access control utility
 * Centralized permission checking for features and actions
 */

/**
 * Live permission overrides loaded from the backend (via the Roles &
 * Permissions module). When present they take precedence over the static
 * defaults so permission checks reflect the real database data.
 */
let permissionOverrides: Record<string, string[]> | null = null;

/**
 * Register permission overrides keyed by role name. Pass `null` to reset back
 * to the static default matrix.
 */
export const setRolePermissionOverrides = (
  overrides: Record<string, string[]> | null
): void => {
  permissionOverrides = overrides;
};

/**
 * Override (or revoke) the permission set of a single role. An empty array
 * fully revokes every permission, which is how a Super Admin's "clear all"
 * takes immediate effect for that role.
 */
export const setRolePermissionOverride = (
  roleName: string | null | undefined,
  permissions: string[]
): void => {
  const key = String(roleName || "").toLowerCase().trim();
  if (!key) return;
  const next = permissionOverrides ? { ...permissionOverrides } : {};
  next[key] = [...permissions];
  permissionOverrides = next;
};

/**
 * Expand a raw permission code list into the full implied set:
 * - `manage_<module>` implies every action on that module.
 * - any non-`view` action on a module implies `view_<module>`.
 * This keeps legacy coarse codes (`manage_animals`, ...) fully compatible with
 * the granular matrix checks (`view_animals`, ...).
 */
export const expandPermissions = (codes: string[]): string[] => {
  const set = new Set<string>(codes);
  for (const code of codes) {
    const parsed = parsePermissionKey(code);
    if (parsed && parsed.action === "manage") {
      for (const a of PERMISSION_ACTIONS) {
        set.add(permissionKey(a.key, parsed.module));
      }
    }
  }
  for (const code of Array.from(set)) {
    const parsed = parsePermissionKey(code);
    if (parsed && parsed.action !== "view") {
      set.add(`view_${parsed.module}`);
    }
  }
  return Array.from(set);
};

/**
 * Notification type access control
 * Define which roles can receive specific notification types
 */
const NOTIFICATION_TYPE_ACCESS: Record<string, UserRole[]> = {
  // System-wide notifications (Super Admin only)
  system: ["super_admin"],
  user_created: ["super_admin"],
  user_updated: ["super_admin"],
  user_deleted: ["super_admin"],
  role_permission_changed: ["super_admin"],
  certificate_generated: ["super_admin"],
  finance_action: ["super_admin", "finance_user"],

  // Shelter/Animal notifications
  shelter_added: ["super_admin", "shelter_manager"],
  animal_registered: [
    "super_admin",
    "shelter_manager",
    "rescue_coordinator",
    "veterinarian",
  ],
  animal_updated: [
    "super_admin",
    "shelter_manager",
    "rescue_coordinator",
    "veterinarian",
  ],

  // Medical notifications
  medical_updated: [
    "super_admin",
    "veterinarian",
    "shelter_manager",
  ],

  // Adoption notifications
  adoption_submitted: [
    "super_admin",
    "adoption_coordinator",
    "shelter_manager",
  ],
  adoption_approved: [
    "super_admin",
    "adoption_coordinator",
    "shelter_manager",
  ],
  adoption_rejected: [
    "super_admin",
    "adoption_coordinator",
    "shelter_manager",
  ],

  // Inventory notifications
  inventory_changed: [
    "super_admin",
    "inventory_manager",
    "shelter_manager",
  ],

  // Rescue notifications & sub-types
  emergency: [
    "super_admin",
    "rescue_coordinator",
    "rescue_agent",
    "rescue_centre_admin",
  ],
  rescue: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  dispatch: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_request: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_verification: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_assignment: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_completion: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_escalation: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  rescue_failure: [
    "super_admin",
    "rescue_centre_admin",
    "rescue_coordinator",
    "rescue_agent",
  ],
  shelter_handover: [
    "super_admin",
    "rescue_centre_admin",
    "shelter_manager",
  ],

  // Shelter / placement notifications (module-level "shelter" type + transfer events)
  shelter: ["super_admin", "shelter_manager"],
  shelter_transfer: ["super_admin", "shelter_manager"],
  transfer_requested: ["super_admin", "shelter_manager"],
  placement_requested: ["super_admin", "shelter_manager"],

  // Lost & Found alerts
  lost_found: [
    "super_admin",
    "shelter_manager",
    "adoption_coordinator",
  ],
  lost_pet_alert: [
    "super_admin",
    "shelter_manager",
    "adoption_coordinator",
  ],

  // Fleet / settings / role governance
  vehicle: ["super_admin", "rescue_centre_admin", "rescue_coordinator"],
  settings: ["super_admin"],
  role: ["super_admin"],
  role_permission: ["super_admin"],

  // Volunteer notifications (general)
  volunteer: ["super_admin", "volunteer_coordinator"],

  // Adoption notifications (general)
  adoption: ["super_admin", "adoption_coordinator"],

  // Medical notifications (general)
  medical: [
    "super_admin",
    "veterinarian",
    "shelter_manager",
  ],
};

/**
 * Check if the current user has a specific permission
 */
export const hasPermission = (permission: string, role?: UserRole): boolean => {
  const currentRole = role || getCurrentUserRole();
  if (!currentRole) return false;

  // super_admin and system:admin have unrestricted full access to all permissions
  const roleStr = String(currentRole).toLowerCase();
  if (roleStr === "super_admin" || roleStr === "system:admin" || roleStr.includes("super_admin") || roleStr.includes("system_admin")) {
    return true;
  }

  const permissions = getPermissionsForRole(currentRole);
  if (permissions.includes(permission)) return true;

  // Also check normalized colon/matrix format
  const norm = normalizePermissionCode(permission);
  return norm ? permissions.includes(norm) : false;
};

/**
 * Check if the current user can view notifications
 */
export const canViewNotifications = (role?: UserRole): boolean => {
  return hasPermission("view_notifications", role);
};

/**
 * Check if the current user can view and manage notification governance (Super Admin only)
 */
export const canManageNotificationGovernance = (role?: UserRole): boolean => {
  if (!role) return false;
  return (
    role === "super_admin" ||
    hasPermission("approve_notifications", role) ||
    hasPermission("manage_notifications", role) ||
    hasPermission("notification_governance", role)
  );
};

/**
 * Check if the current user can view audit logs
 */
export const canViewAuditLogs = (role?: UserRole): boolean => {
  return hasPermission("view_audit_logs", role);
};

/**
 * Check if the current user can trigger backups
 */
export const canCreateBackup = (role?: UserRole): boolean => {
  return hasPermission("create_backup", role);
};

/**
 * Get all roles that can receive a specific notification type
 */
export const getRolesForNotificationType = (
  notificationType: string
): UserRole[] => {
  return NOTIFICATION_TYPE_ACCESS[notificationType] || [];
};

/**
 * Check if a specific role can receive a specific notification type
 */
export const canReceiveNotification = (
  notificationType: string,
  role?: UserRole
): boolean => {
  const currentRole = role || getCurrentUserRole();
  if (!currentRole) return false;

  const allowedRoles = getRolesForNotificationType(notificationType);
  return allowedRoles.includes(currentRole);
};

/**
 * Filter notifications based on current user's role
 */
export const filterNotificationsByRole = (
  notifications: Array<{ type: string; [key: string]: unknown }>,
  role?: UserRole
): Array<{ type: string; [key: string]: unknown }> => {
  const currentRole = role || getCurrentUserRole();
  if (!currentRole) return [];

  // Super admin sees all notifications
  if (currentRole === "super_admin") {
    return notifications;
  }

  // Other roles only see notifications they're allowed to receive
  return notifications.filter((notif) =>
    canReceiveNotification(notif.type as string, currentRole)
  );
};

/**
 * Check multiple permissions (all must be true)
 */
export const hasAllPermissions = (
  permissions: string[],
  role?: UserRole
): boolean => {
  return permissions.every((permission) => hasPermission(permission, role));
};

/**
 * Check multiple permissions (at least one must be true)
 */
export const hasAnyPermission = (
  permissions: string[],
  role?: UserRole
): boolean => {
  return permissions.some((permission) => hasPermission(permission, role));
};

/**
 * Get all permissions for a specific role.
 * Live overrides (from the backend) take precedence over the static defaults,
 * and the result is expanded so `manage_X`/action codes imply `view_X`.
 */
export const getPermissionsForRole = (role: UserRole): string[] => {
  const base =
    permissionOverrides && permissionOverrides[role]
      ? permissionOverrides[role]
      : DEFAULT_ROLE_PERMISSIONS[role] || [];
  return expandPermissions(base);
};

/**
 * Get the effective permission code list for the current (or given) user.
 */
export const getCurrentUserPermissions = (role?: UserRole): string[] => {
  const currentRole = role || getCurrentUserRole();
  if (!currentRole) return [];
  return getPermissionsForRole(currentRole);
};

/**
 * Check a granular permission, e.g. `can("create", "adoptions")`.
 */
export const can = (
  action: string,
  module: string,
  role?: UserRole
): boolean => hasPermission(permissionKey(action, module), role);

export const canView = (module: string, role?: UserRole): boolean =>
  can("view", module, role);

export const canManage = (module: string, role?: UserRole): boolean =>
  can("manage", module, role);

/**
 * Get notification types accessible by a role
 */
export const getNotificationTypesForRole = (role: UserRole): string[] => {
  return Object.entries(NOTIFICATION_TYPE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([type]) => type);
};

export default {
  hasPermission,
  can,
  canView,
  canManage,
  getCurrentUserPermissions,
  expandPermissions,
  canViewNotifications,
  canViewAuditLogs,
  canCreateBackup,
  setRolePermissionOverrides,
  setRolePermissionOverride,
  getRolesForNotificationType,
  canReceiveNotification,
  filterNotificationsByRole,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  getNotificationTypesForRole,
  notifyPermissionsChanged,
  PERMISSIONS_CHANGED_EVENT,
};
