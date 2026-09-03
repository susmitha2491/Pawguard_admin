import type { UserRole } from "../types/auth";

/**
 * Permission catalog for the RBAC system.
 *
 * The matrix is module × action. Every cell produces a permission key of the
 * form `${action}_${module}` (e.g. `view_users`, `approve_adoptions`,
 * `manage_animals`). A small set of legacy coarse-grained flags is kept as
 * "special permissions" so existing checks (notifications, settings, backups)
 * keep working.
 */

export interface PermissionAction {
  key: string;
  label: string;
}

export interface PermissionModule {
  key: string;
  label: string;
}

export interface SpecialPermission {
  key: string;
  label: string;
}

export interface PermissionModuleGroup {
  key: string;
  label: string;
  modules: string[];
}

/**
 * Logical groupings used to render the permission matrix in labelled
 * sections (grouped modules) instead of one flat list.
 */
export const PERMISSION_MODULE_GROUPS: PermissionModuleGroup[] = [
  {
    key: "governance",
    label: "Governance & Access Control",
    modules: ["dashboard", "users", "roles", "audit_logs", "notifications", "settings"],
  },
  {
    key: "operations",
    label: "Rescue Operations",
    modules: ["rescues", "rescue_requests", "rescue_dispatch", "vehicles"],
  },
  {
    key: "animal_care",
    label: "Animal Care & Medical",
    modules: ["animals", "medical", "certificates"],
  },
  {
    key: "placement",
    label: "Placement & Community",
    modules: ["adoptions", "foster_placements", "volunteers", "lost_found"],
  },
  {
    key: "resources",
    label: "Facilities & Resources",
    modules: ["shelters", "inventory", "finance"],
  },
  {
    key: "insights",
    label: "Analytics & Reporting",
    modules: ["reports"],
  },
];

/** Group label lookup helper for grouping API-driven modules. */
export const groupLabelForModule = (moduleKey: string): string => {
  const group = PERMISSION_MODULE_GROUPS.find((g) => g.modules.includes(moduleKey));
  return group?.label || "Other Modules";
};

export const PERMISSION_ACTIONS: PermissionAction[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "export", label: "Export" },
  { key: "manage", label: "Manage" },
];

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "User Management" },
  { key: "animals", label: "Dogs & Animals" },
  { key: "rescues", label: "Rescue Management" },
  { key: "rescue_requests", label: "Rescue Requests" },
  { key: "rescue_dispatch", label: "Rescue Dispatch" },
  { key: "vehicles", label: "Vehicles & Fleet" },
  { key: "medical", label: "Medical Records" },
  { key: "shelters", label: "Shelter Management" },
  { key: "adoptions", label: "Adoptions" },
  { key: "foster_placements", label: "Foster Management" },
  { key: "volunteers", label: "Volunteers" },
  { key: "lost_found", label: "Lost & Found" },
  { key: "inventory", label: "Inventory" },
  { key: "finance", label: "Donations & Finance" },
  { key: "reports", label: "Reports & Analytics" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "audit_logs", label: "Audit Logs" },
  { key: "certificates", label: "Certificates" },
  { key: "notifications", label: "Notifications" },
  { key: "settings", label: "System Settings" },
];

export const SPECIAL_PERMISSIONS: SpecialPermission[] = [
  { key: "view_shelter_data", label: "View shelter data (read-only)" },
  { key: "view_all_notifications", label: "View all system notifications" },
  { key: "view_emergency_alerts", label: "View emergency alerts" },
  { key: "report_rescue", label: "Report a rescue" },
  { key: "update_animal_status", label: "Update animal status" },
  { key: "create_backup", label: "Create system backup" },
  { key: "manage_permissions", label: "Manage permission policies" },
];

/** Build the standard `${action}_${module}` permission key. */
export const permissionKey = (action: string, moduleKey: string): string =>
  `${action}_${moduleKey}`;

/** All possible permission keys in the matrix (cells + special flags). */
export const matrixPermissionKeys = (): string[] => {
  const keys: string[] = [];
  for (const m of PERMISSION_MODULES) {
    for (const a of PERMISSION_ACTIONS) {
      keys.push(permissionKey(a.key, m.key));
    }
  }
  for (const s of SPECIAL_PERMISSIONS) {
    keys.push(s.key);
  }
  return keys;
};

/**
 * Parse a granular permission key of the form `${action}_${module}`
 * (e.g. `view_users` → `{ action: "view", module: "users" }`).
 * Returns null when the key is not a matrix cell (e.g. special flags).
 */
export const parsePermissionKey = (
  key: string
): { action: string; module: string } | null => {
  if (typeof key !== "string") return null;
  const idx = key.indexOf("_");
  if (idx <= 0 || idx === key.length - 1) return null;
  const action = key.slice(0, idx);
  const module = key.slice(idx + 1);
  const knownAction = PERMISSION_ACTIONS.some((a) => a.key === action);
  const knownModule = PERMISSION_MODULES.some((m) => m.key === module);
  if (!knownAction || !knownModule) return null;
  return { action, module };
};

/** All permission keys (cells) for a single module. */
export const modulePermissionKeys = (moduleKey: string): string[] =>
  PERMISSION_ACTIONS.map((a) => permissionKey(a.key, moduleKey));

/**
 * Backend permission codes use a different vocabulary than the frontend
 * matrix. The backend API stores codes as `${module}:${action}` strings (e.g.
 * `adoption:read`, `adoption:process`, `public:read`) while the frontend RBAC
 * matrix uses `${action}_${module}` keys (e.g. `view_adoptions`). When a live
 * role registry or an embedded user permission set is turned into an override,
 * codes that do not match the frontend format silently fail every
 * `hasPermission()` check — a `rescue_centre_admin` whose overrides carry
 * backend codes loses `view_animals` / `view_medical` / `view_inventory` /
 * `view_reports` and gets redirected to /403.
 *
 * `normalizePermissionCode` re-expresses any supported backend code as the
 * canonical frontend matrix key so overrides loaded from the backend and the
 * frontend checks agree. It never invents permissions: a code that has no
 * frontend-equivalent action/module is dropped, and plain frontend-style keys
 * (including legacy special permissions such as `report_rescue`) pass through
 * untouched.
 */

/** Backend module keys → frontend `PERMISSION_MODULES` keys. */
const MODULE_ALIASES: Record<string, string> = {
  animal: "animals",
  adoption: "adoptions",
  foster: "foster_placements",
  fosters: "foster_placements",
  medical_record: "medical",
  medical_records: "medical",
  "medical-record": "medical",
  "medical-records": "medical",
  rescue: "rescues",
  rescue_request: "rescue_requests",
  rescue_requests: "rescue_requests",
  "rescue-request": "rescue_requests",
  "rescue-requests": "rescue_requests",
  report: "reports",
  "lost-found": "lost_found",
  lost_and_found: "lost_found",
  audit: "audit_logs",
  safety_tag: "animals",
  safety_tags: "animals",
  safetytag: "animals",
  "safety-tag": "animals",
  companion_pet: "animals",
  companion_pets: "animals",
  companionpet: "animals",
  "companion-pet": "animals",
  "companion-pets": "animals",
  dog: "animals",
  dogs: "animals",
  dog_profile: "animals",
  dog_profiles: "animals",
  "dog-profile": "animals",
  "dog-profiles": "animals",
};

/** Backend action keys → frontend `PERMISSION_ACTIONS` keys. */
const ACTION_ALIASES: Record<string, string> = {
  read: "view",
  write: "create",
  update: "edit",
  process: "manage",
};

const toKnownModule = (raw: string): string | null => {
  const key = raw.toLowerCase().trim();
  if (PERMISSION_MODULES.some((m) => m.key === key)) return key;
  return MODULE_ALIASES[key] ?? null;
};

const toKnownAction = (raw: string): string | null => {
  const key = raw.toLowerCase().trim();
  if (PERMISSION_ACTIONS.some((a) => a.key === key)) return key;
  return ACTION_ALIASES[key] ?? null;
};

/** Resolve a (action, module) pair to a canonical frontend matrix key, or null. */
const toMatrixKey = (a: string, m: string): string | null => {
  const knownAction = toKnownAction(a);
  const knownModule = toKnownModule(m);
  if (!knownAction || !knownModule) return null;
  return permissionKey(knownAction, knownModule);
};

export const normalizePermissionCode = (code: unknown): string | null => {
  if (typeof code !== "string") return null;
  const trimmed = code.trim();
  if (!trimmed) return null;

  // Already in canonical `${action}_${module}` matrix form.
  if (parsePermissionKey(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();

  // `${module}:${action}` (e.g. `adoption:read`).
  const colon = lower.split(":");
  if (colon.length >= 2) {
    const key = toMatrixKey(colon[1], colon[0]);
    if (key) return key;
  }

  // `${module}.${action}` (e.g. `inventory.read`).
  const dot = lower.split(".");
  if (dot.length >= 2) {
    const key = toMatrixKey(dot[1], dot[0]);
    if (key) return key;
  }

  // `${action}-${module}` (e.g. `view-medical-records`).
  const dash = lower.split("-");
  if (dash.length >= 2) {
    const key = toMatrixKey(dash[0], dash.slice(1).join("_"));
    if (key) return key;
  }

  // `${action} ${module}` (e.g. `view reports`).
  const space = lower.split(/\s+/);
  if (space.length >= 2) {
    const key = toMatrixKey(space[0], space.slice(1).join("_"));
    if (key) return key;
  }

  // Canonical `${action}_${module}` in backend casing (e.g. `READ_ANIMALS`
  // or `view_animals` written with different case).
  const underscore = lower.split("_");
  if (underscore.length >= 2) {
    const key = toMatrixKey(underscore[0], underscore.slice(1).join("_"));
    if (key) return key;
  }

  // Plain frontend-style key (letters, digits, underscores) that is not a
  // matrix cell — e.g. legacy special permissions — passes through untouched.
  if (/^[a-z][a-z0-9_]*$/.test(lower)) return trimmed;

  // Unrecognized foreign code → drop.
  return null;
};

/**
 * Normalize a Permissions API payload into a flat list of permission codes.
 * Accepts bare arrays, wrapped `{ data: [...] }` objects, string codes and
 * objects carrying a code/name/key/permission/permission_code field.
 */
export const extractPermissionCodes = (payload: unknown): string[] => {
  let list: unknown = payload;
  if (list && typeof list === "object") {
    const obj = list as Record<string, unknown>;
    if (obj.data !== undefined) list = obj.data;
    else if (obj.permissions !== undefined) list = obj.permissions;
    else if (obj.permission_codes !== undefined) list = obj.permission_codes;
    else if (obj.items !== undefined) list = obj.items;
  }
  if (!Array.isArray(list)) return [];
  const codes: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const normalized = normalizePermissionCode(item);
      if (normalized) codes.push(normalized);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const code =
        obj.permission_code ??
        obj.permissionCode ??
        obj.code ??
        obj.key ??
        obj.name ??
        obj.permission ??
        obj.slug;
      if (typeof code === "string") {
        const normalized = normalizePermissionCode(code);
        if (normalized) codes.push(normalized);
      }
    }
  }
  return Array.from(new Set(codes));
};

/** Extract permission codes embedded on an authenticated user object. */
export const extractUserPermissions = (user: unknown): string[] => {
  if (!user || typeof user !== "object") return [];
  const obj = user as Record<string, unknown>;
  const sources = [
    obj.permission_codes,
    obj.permissionCodes,
    obj.permissions,
    obj.scopes,
    obj.role_permissions,
  ];
  for (const source of sources) {
    if (source !== undefined && source !== null) {
      const codes = extractPermissionCodes(source);
      if (codes.length > 0) return codes;
    }
  }
  const roleObj = obj.role;
  if (roleObj && typeof roleObj === "object") {
    const nested = extractUserPermissions(roleObj);
    if (nested.length > 0) return nested;
  }
  return [];
};

/**
 * Build the permission matrix (modules + actions) from a Permissions API
 * payload. When entries carry explicit `module`/`action` fields those are used;
 * otherwise codes of the form `${action}_${module}` are parsed. Falls back to
 * the static catalog whenever the payload is empty or malformed so the UI
 * never renders an empty matrix.
 */
export const buildPermissionMatrix = (payload: unknown): { modules: PermissionModule[]; actions: PermissionAction[] } => {
  const codes = extractPermissionCodes(payload);
  const moduleSet = new Map<string, string>();
  const actionSet = new Map<string, string>();

  for (const code of codes) {
    const parsed = parsePermissionKey(code);
    if (!parsed) continue;
    moduleSet.set(parsed.module, parsed.module);
    actionSet.set(parsed.action, parsed.action);
  }

  // Prefer explicit object metadata when available.
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>).data : undefined;
  const rawList = Array.isArray(raw) ? raw : Array.isArray(payload) ? payload : [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.module === "string" && obj.module) moduleSet.set(obj.module, obj.module);
    if (typeof obj.action === "string" && obj.action) actionSet.set(obj.action, obj.action);
  }

  const modules: PermissionModule[] = [];
  for (const key of moduleSet.keys()) {
    const known = PERMISSION_MODULES.find((m) => m.key === key);
    modules.push({ key, label: known?.label || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) });
  }
  modules.sort((a, b) => {
    const aIdx = PERMISSION_MODULES.findIndex((m) => m.key === a.key);
    const bIdx = PERMISSION_MODULES.findIndex((m) => m.key === b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  const actions: PermissionAction[] = [];
  for (const key of actionSet.keys()) {
    const known = PERMISSION_ACTIONS.find((a) => a.key === key);
    actions.push({ key, label: known?.label || key });
  }
  actions.sort((a, b) => {
    const aIdx = PERMISSION_ACTIONS.findIndex((x) => x.key === a.key);
    const bIdx = PERMISSION_ACTIONS.findIndex((x) => x.key === b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return {
    modules: modules.length > 0 ? modules : PERMISSION_MODULES,
    actions: actions.length > 0 ? actions : PERMISSION_ACTIONS,
  };
};

/** Human-readable label for a permission key. */
export const describePermission = (key: string): string => {
  const actionKey = key.split("_")[0];
  const moduleKey = key.slice(key.indexOf("_") + 1);
  const module = PERMISSION_MODULES.find((m) => m.key === moduleKey);
  const action = PERMISSION_ACTIONS.find((a) => a.key === actionKey);
  if (module && action) return `${action.label} ${module.label}`;
  const special = SPECIAL_PERMISSIONS.find((s) => s.key === key);
  if (special) return special.label;
  return key;
};

/**
 * Normalize a raw permissions value coming from the API into a flat string
 * array (handles `string[]` and `{ name | key | code | permission }[]`).
 */
export const normalizePermissionList = (list: unknown): string[] => {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const normalized = normalizePermissionCode(item);
      if (normalized) out.push(normalized);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const val = obj.name ?? obj.key ?? obj.code ?? obj.permission ?? obj.slug;
      if (typeof val === "string") {
        const normalized = normalizePermissionCode(val);
        if (normalized) out.push(normalized);
      }
    }
  }
  return Array.from(new Set(out));
};

/**
 * Build a role-name → permissions override map from the live roles payload.
 * The backend `RoleResponse` carries the permission set on `permission_codes`
 * (colon-format strings such as `adoption:read`), while other consumers pass
 * pre-mapped `permissions`. Both are normalized to the frontend matrix format
 * so the resulting overrides line up with `hasPermission()`.
 * Empty permission sets on known system roles are ignored so the static
 * defaults still apply as a fallback.
 */
export const buildRolePermissionOverrides = (
  roles: Array<{
    name?: unknown;
    permissions?: unknown;
    permission_codes?: unknown;
    permissionCodes?: unknown;
  }>
): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  for (const role of roles) {
    const key = String(role.name || "").toLowerCase().trim();
    if (!key) continue;
    const perms = normalizePermissionList(
      role.permissions ?? role.permission_codes ?? role.permissionCodes
    );
    if (perms.length === 0 && DEFAULT_ROLE_PERMISSIONS[key as UserRole]) {
      continue;
    }
    map[key] = perms;
  }
  return map;
};

/** Shorthand for building `${action}_${module}` permission codes. */
const perm = (module: string, ...actions: string[]): string[] =>
  actions.map((a) => permissionKey(a, module));

/**
 * Default permission set per system role. Used as a safe fallback whenever the
 * backend does not return an authoritative permission list for a role. The
 * sets use the same granular `${action}_${module}` codes that power the
 * permission matrix, so every default stays fully compatible with the RBAC
 * checks and with `hasPermission()`.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: matrixPermissionKeys(),
  rescue_centre_admin: [
    "view_dashboard",
    ...perm("animals", "view", "create", "edit", "delete", "approve", "export", "manage"),
    ...perm("rescues", "view", "create", "edit", "delete", "approve", "export", "manage"),
    ...perm("rescue_requests", "view", "create", "edit", "approve", "manage"),
    ...perm("rescue_dispatch", "view", "create", "edit", "manage"),
    ...perm("vehicles", "view", "create", "edit", "delete", "manage"),
    ...perm("shelters", "view", "create", "edit", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
    "view_shelter_data",
    "view_emergency_alerts",
    "report_rescue",
  ],
  rescue_coordinator: [
    "view_dashboard",
    ...perm("animals", "view", "create", "edit"),
    ...perm("rescues", "view", "create", "edit", "approve", "manage"),
    ...perm("rescue_requests", "view", "create", "edit", "approve"),
    ...perm("rescue_dispatch", "view", "create", "edit", "manage"),
    ...perm("shelters", "view"),
    ...perm("notifications", "view"),
    "view_emergency_alerts",
    "report_rescue",
  ],
  rescue_agent: [
    "view_dashboard",
    ...perm("animals", "view", "create", "edit"),
    ...perm("rescues", "view", "edit"),
    ...perm("rescue_requests", "view", "create"),
    ...perm("rescue_dispatch", "view", "edit"),
    ...perm("notifications", "view"),
    "report_rescue",
    "update_animal_status",
    "view_emergency_alerts",
  ],
  veterinarian: [
    "view_dashboard",
    ...perm("animals", "view", "edit"),
    ...perm("medical", "view", "create", "edit", "delete", "approve", "export", "manage"),
    ...perm("certificates", "view", "create", "export"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
    "update_animal_status",
  ],
  shelter_manager: [
    "view_dashboard",
    ...perm("users", "view"),
    ...perm("animals", "view", "create", "edit", "delete", "approve", "export", "manage"),
    ...perm("medical", "view", "create", "edit", "manage"),
    ...perm("shelters", "view", "create", "edit", "manage"),
    ...perm("rescues", "view", "create", "edit", "manage"),
    ...perm("rescue_requests", "view", "create", "edit", "manage"),
    ...perm("adoptions", "view", "create", "edit"),
    ...perm("lost_found", "view", "create", "delete", "manage"),
    ...perm("inventory", "view", "create", "edit", "export", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
    "view_shelter_data",
    "update_animal_status",
  ],
  adoption_coordinator: [
    "view_dashboard",
    ...perm("animals", "view"),
    ...perm("adoptions", "view", "create", "edit", "approve", "export"),
    ...perm("lost_found", "view", "create", "delete", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
  ],
  foster_coordinator: [
    "view_dashboard",
    ...perm("animals", "view"),
    ...perm("foster_placements", "view", "create", "edit", "approve", "export", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
  ],
  volunteer_coordinator: [
    "view_dashboard",
    ...perm("volunteers", "view", "create", "edit", "approve", "export", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
  ],
  inventory_manager: [
    "view_dashboard",
    ...perm("shelters", "view"),
    ...perm("inventory", "view", "create", "edit", "delete", "approve", "export", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
  ],
  finance_user: [
    "view_dashboard",
    ...perm("finance", "view", "create", "edit", "delete", "export", "manage"),
    ...perm("reports", "view", "export"),
    ...perm("notifications", "view"),
  ],
  volunteer: [
    "view_dashboard",
    "view_volunteers",
  ],
  foster_family: [
    "view_dashboard",
  ],
  donor: [
    "view_dashboard",
  ],
  general_public_user: [
    "view_dashboard",
  ],
};
