import { useState, useEffect, useMemo, useCallback } from "react";
import type React from "react";
import Modal from "../../components/common/Modal";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import PermissionMatrixEditor from "../../components/rbac/PermissionMatrixEditor";
import { useToast } from "../../context/ToastContext";
import {
  FaPlusCircle,
  FaUserShield,
  FaUsers,
  FaUserPlus,
  FaLock,
  FaTrash,
  FaKey,
  FaBan,
  FaCheckCircle,
  FaSearch,
  FaShieldAlt,
  FaEdit,
  FaEye,
  FaEyeSlash,
  FaIdBadge,
} from "react-icons/fa";
import userService, { type UserPayload } from "../../services/userService";
import { normalizeRole, ALLOWED_INTERNAL_ROLES, getRoleTitle, getCurrentUserRole, isInternalRole } from "../../utils/roleUtils";
import { formatDateTime } from "../../utils/dateUtils";
import {
  setRolePermissionOverrides,
  setRolePermissionOverride,
  notifyPermissionsChanged,
} from "../../utils/rbac";
import {
  buildRolePermissionOverrides,
  normalizePermissionList,
  describePermission,
  matrixPermissionKeys,
  buildPermissionMatrix,
  extractPermissionCodes,
  PERMISSION_MODULES,
} from "../../utils/permissionsCatalog";
import type { PermissionAction, PermissionModule } from "../../utils/permissionsCatalog";
import { notifyDataChanged } from "../../utils/dataSync";
import type { RoleRecord, RoleAssignment } from "../../types/rbac";

const SYSTEM_ROLES: Set<string> = new Set([...ALLOWED_INTERNAL_ROLES]);

const isSystemRole = (roleIdentifier?: unknown): boolean => {
  const normalized = normalizeRole(String(roleIdentifier || ""));
  return normalized !== null && SYSTEM_ROLES.has(normalized);
};

const roleTitle = (name: string): string => {
  const title = getRoleTitle(name);
  return title === "Unknown Role" ? name : title;
};

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as {
      response?: {
        data?: {
          detail?: unknown;
          message?: unknown;
          error?: { message?: unknown; detail?: unknown; details?: unknown };
        };
      };
      message?: unknown;
    };
    const data = r?.response?.data;
    if (data) {
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const msgs = data.detail
          .map((d: { msg?: string; message?: string }) => d?.msg || d?.message)
          .filter(Boolean);
        if (msgs.length > 0) return msgs.join("; ");
      }
      if (typeof data.message === "string" && data.message.trim()) return data.message;
      if (data.error) {
        if (typeof data.error.message === "string" && data.error.message.trim()) return data.error.message;
        if (typeof data.error.detail === "string" && data.error.detail.trim()) return data.error.detail;
        if (typeof data.error.details === "string" && data.error.details.trim()) return data.error.details;
      }
    }
    if (typeof r.message === "string" && r.message.trim()) return r.message;
  }
  return fallback;
};

const asUnknownArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const maybe = (value as Record<string, unknown>).data;
    if (Array.isArray(maybe)) return maybe;
  }
  return [];
};

const mapRole = (r: Record<string, unknown>): RoleRecord => {
  const name = String(r.name || r.roleName || r.title || r.slug || r.role || "");
  const rawId = r.id ?? r.role_id ?? r.uid;
  const id = rawId !== undefined && rawId !== null ? String(rawId) : name || "-";
  const isSystem = isSystemRole(name) || r.is_system === true;
  const count =
    typeof r.userCount === "number"
      ? r.userCount
      : typeof r.users_count === "number"
      ? r.users_count
      : 0;
  return {
    id,
    name: name || "-",
    description: typeof r.description === "string" ? r.description : typeof r.label === "string" ? r.label : "",
    category: typeof r.category === "string" ? r.category : isSystem ? "System Governance" : "Custom Operations",
    permissions: normalizePermissionList(
      r.permission_codes ?? r.permissions ?? r.permissionCodes ?? r.permissionList
    ),
    userCount: count,
    isSystem,
    is_active: r.is_active !== false,
    status: r.is_active === false ? "Inactive" : "Active",
  };
};

const mapUser = (u: Record<string, unknown>): RoleAssignment => {
  const rolesArr = Array.isArray(u.roles) ? u.roles : [];
  const role =
    rolesArr.length > 0 ? String(rolesArr[0]) : String(u.role || "");
  const isActive =
    u.is_active !== undefined
      ? !!u.is_active
      : u.status
      ? String(u.status).toLowerCase() !== "inactive"
      : true;
  return {
    id: String(u.id ?? u.user_id ?? u.uid ?? "-"),
    name: String(u.full_name || u.name || u.username || u.email || "-"),
    email: String(u.email || "-"),
    role,
    department: String(u.department || u.facility || u.organisation || "-"),
    is_active: isActive,
    status: isActive ? "Active" : "Inactive",
  };
};


const statusBadge = (status: string) => {
  const active = status === "Active";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: active ? "#ECFDF5" : "#FEF2F2",
        color: active ? "#10B981" : "#EF4444",
      }}
    >
      {status}
    </span>
  );
};

const typeBadge = (isSystem: boolean) => (
  <span
    style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: isSystem ? "#EFF6FF" : "#ECFDF5",
      color: isSystem ? "#2563EB" : "#059669",
    }}
  >
    {isSystem ? "System" : "Custom"}
  </span>
);

const RolesPermissions = () => {
  const { addToast } = useToast();

  // Check current user role for privilege escalation guards
  const currentUserRole = getCurrentUserRole();
  const isSuperAdmin = currentUserRole === "super_admin";

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<RoleAssignment[]>([]);
  const [matrixTotal, setMatrixTotal] = useState(0);
  const [matrixModules, setMatrixModules] = useState<PermissionModule[]>([]);
  const [matrixActions, setMatrixActions] = useState<PermissionAction[]>([]);
  const [roleDetailLoading, setRoleDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");

  const [roleSearch, setRoleSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Role create/edit modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"create" | "edit">("create");
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "Custom organizational role",
    category: "Custom Operations",
  });
  const [matrixPerms, setMatrixPerms] = useState<string[]>([]);
  const [copyFromRole, setCopyFromRole] = useState("");

  // Delete / assign / revoke
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null);
  const [assignTarget, setAssignTarget] = useState<RoleAssignment | null>(null);
  const [assignRole, setAssignRole] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<RoleAssignment | null>(null);

  // Selected Account Profile Modal State
  const [selectedAccountModalOpen, setSelectedAccountModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<RoleAssignment | null>(null);
  const [accountDetail, setAccountDetail] = useState<Record<string, unknown> | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);

  // Selected Account Edit Sub-state
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountEditForm, setAccountEditForm] = useState({
    full_name: "",
    phone: "",
    role: "",
    is_active: true,
  });

  // Selected Account Password Change Sub-state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // User Permission Overrides State
  const [userPermModalOpen, setUserPermModalOpen] = useState(false);
  const [userPermTarget, setUserPermTarget] = useState<RoleAssignment | null>(null);
  const [userDirectPerms, setUserDirectPerms] = useState<string[]>([]);
  const [userPermLoading, setUserPermLoading] = useState(false);
  const [customPermCode, setCustomPermCode] = useState("");

  const openUserPermModal = async (user: RoleAssignment) => {
    setUserPermTarget(user);
    setUserPermModalOpen(true);
    setUserPermLoading(true);
    try {
      const res = await userService.getUserPermissions(user.id);
      const codes = extractPermissionCodes(res);
      setUserDirectPerms(codes);
    } catch {
      setUserDirectPerms([]);
    } finally {
      setUserPermLoading(false);
    }
  };

  const handleGrantUserPerm = async (code: string) => {
    if (!userPermTarget || !code.trim()) return;
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can grant direct permission overrides.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.grantUserPermission(userPermTarget.id, code.trim());
      addToast(`Granted permission "${code}" to ${userPermTarget.name}`, "success");
      const res = await userService.getUserPermissions(userPermTarget.id);
      setUserDirectPerms(extractPermissionCodes(res));
      setCustomPermCode("");
      notifyPermissionsChanged();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to grant user permission."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeUserPerm = async (code: string) => {
    if (!userPermTarget || !code) return;
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can revoke direct permission overrides.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.revokeUserPermission(userPermTarget.id, code);
      addToast(`Revoked permission "${code}" from ${userPermTarget.name}`, "success");
      const res = await userService.getUserPermissions(userPermTarget.id);
      setUserDirectPerms(extractPermissionCodes(res));
      notifyPermissionsChanged();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to revoke user permission."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRolesAndPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesRes, permsRes] = await Promise.allSettled([
        userService.getRoles(),
        userService.getPermissions(),
      ]);

      if (rolesRes.status === "rejected") {
        setError(getErrorMsg(rolesRes.reason, "Failed to load roles from backend API."));
        setRoles([]);
      } else {
        const value = rolesRes.value;
        const list = asUnknownArray(value);
        const nextRoles = list.map((r) => mapRole((r as Record<string, unknown>) ?? {}));
        setRoles(nextRoles);
        setRolePermissionOverrides(
          buildRolePermissionOverrides(
            nextRoles.map((r) => ({ name: r.name, permissions: r.permissions }))
          )
        );
      }

      if (permsRes.status === "fulfilled") {
        const value = permsRes.value;
        const matrix = buildPermissionMatrix(value);
        setMatrixModules(matrix.modules);
        setMatrixActions(matrix.actions);
        const codes = extractPermissionCodes(value);
        setMatrixTotal(codes.length > 0 ? codes.length : matrixPermissionKeys().length);
      } else {
        const matrix = buildPermissionMatrix(null);
        setMatrixModules(matrix.modules);
        setMatrixActions(matrix.actions);
        setMatrixTotal(matrixPermissionKeys().length);
      }
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load roles and permissions matrix."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUserError(null);
      const res = await userService.getUsers({ page_size: 100 });
      const rawBody = res as unknown;
      const rawData = (rawBody as { data?: unknown })?.data;
      const rawItems = (rawData as { items?: unknown })?.items;
      const list = Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>[])
        : Array.isArray(rawData)
        ? (rawData as Record<string, unknown>[])
        : Array.isArray(rawItems)
        ? (rawItems as Record<string, unknown>[])
        : [];
      const mappedUsers = list.map(mapUser);
      setUsers(mappedUsers);

      // Dynamically calculate user counts per role across authoritative user dataset
      const counts: Record<string, number> = {};
      mappedUsers.forEach((u) => {
        const rName = u.role || "general_public";
        const norm = normalizeRole(rName) || rName;
        counts[norm] = (counts[norm] || 0) + 1;
        if (rName && counts[rName] === undefined) {
          counts[rName] = (counts[rName] || 0) + 1;
        }
      });

      setRoles((prevRoles) =>
        prevRoles.map((r) => {
          const normName = normalizeRole(r.name) || r.name;
          const realCount = counts[normName] ?? counts[r.name] ?? 0;
          return { ...r, userCount: realCount };
        })
      );
    } catch (err: unknown) {
      setUserError(getErrorMsg(err, "Failed to load users."));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        await fetchRolesAndPermissions();
        await fetchUsers();
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchRolesAndPermissions, fetchUsers]);

  const openCreateRole = () => {
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can create custom roles.", "error");
      return;
    }
    setRoleModalMode("create");
    setEditingRole(null);
    setRoleForm({ name: "", description: "Custom organizational role", category: "Custom Operations" });
    setMatrixPerms([]);
    setCopyFromRole("");
    setRoleModalOpen(true);
  };

  const openEditRole = async (role: RoleRecord) => {
    if (!isSuperAdmin && role.name === "super_admin") {
      addToast("Access Denied: Only a Super Administrator can edit Super Admin permissions.", "error");
      return;
    }
    setRoleModalMode("edit");
    setEditingRole(role);
    setRoleForm({ name: role.name, description: role.description || "", category: role.category || "" });
    setMatrixPerms(role.permissions || []);
    setCopyFromRole("");
    setRoleModalOpen(true);

    setRoleDetailLoading(true);
    try {
      const detail = await userService.getRoleById(role.id);
      const codes = extractPermissionCodes(detail);
      if (codes.length > 0) {
        setMatrixPerms(codes);
        setRolePermissionOverride(role.name, codes);
      }
    } catch (err: unknown) {
      addToast(
        getErrorMsg(err, `Could not refresh permissions for "${roleTitle(role.name)}"; showing cached set.`),
        "error"
      );
    } finally {
      setRoleDetailLoading(false);
    }
  };

  const handleCopyFrom = (roleName: string) => {
    setCopyFromRole(roleName);
    const role = roles.find((r) => r.name === roleName);
    if (role) setMatrixPerms(role.permissions || []);
  };

  const handleSaveRole = async () => {
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can manage role policies.", "error");
      return;
    }

    if (roleModalMode === "create") {
      const name = roleForm.name.trim();
      if (!name) {
        addToast("Role name is required.", "error");
        return;
      }
      if (isSystemRole(name)) {
        addToast(`"${name}" is a system role and cannot be redefined.`, "error");
        return;
      }
      try {
        setIsSubmitting(true);
        await userService.createRole({
          name,
          description: roleForm.description.trim(),
          category: roleForm.category.trim(),
          permission_codes: matrixPerms,
        });
        addToast(`Role "${name}" created with ${matrixPerms.length} permissions.`, "success");
        setRoleModalOpen(false);
        await fetchRolesAndPermissions();
        setRolePermissionOverride(name, matrixPerms);
        notifyPermissionsChanged();
        notifyDataChanged();
      } catch (err: unknown) {
        addToast(getErrorMsg(err, "Failed to create role."), "error");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const role = editingRole;
    if (!role) return;
    const name = role.isSystem ? role.name : roleForm.name.trim();
    if (!name) {
      addToast("Role name cannot be empty.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.updateRole(
        role.id,
        role.isSystem
          ? { permission_codes: matrixPerms }
          : { name, description: roleForm.description.trim(), permission_codes: matrixPerms }
      );
      addToast(`Role "${name}" policy updated (${matrixPerms.length} permissions).`, "success");
      setRoleModalOpen(false);
      await fetchRolesAndPermissions();
      setRolePermissionOverride(name, matrixPerms);
      notifyPermissionsChanged();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update role."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    const role = deleteTarget;
    if (!role) return;
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can delete roles.", "error");
      setDeleteTarget(null);
      return;
    }
    if (role.isSystem) {
      addToast("System-defined roles cannot be deleted.", "error");
      setDeleteTarget(null);
      return;
    }
    if (role.userCount && role.userCount > 0) {
      addToast(
        `Cannot delete "${role.name}" — ${role.userCount} user(s) are still assigned. Reassign them first.`,
        "error"
      );
      setDeleteTarget(null);
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.deleteRole(role.id);
      addToast(`Deleted role "${role.name}".`, "success");
      setDeleteTarget(null);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      await fetchRolesAndPermissions();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete role."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAssignModal = (user: RoleAssignment) => {
    if (!isSuperAdmin && String(user.role).toLowerCase().includes("super_admin")) {
      addToast("Access Denied: Only a Super Administrator can reassign Super Admin accounts.", "error");
      return;
    }
    setAssignTarget(user);
    setAssignRole(user.role || "");
  };

  const handleAssignRole = async () => {
    if (!assignTarget || !assignRole) return;
    if (!isSuperAdmin && assignRole === "super_admin") {
      addToast("Access Denied: Only a Super Administrator can grant Super Admin privileges.", "error");
      return;
    }
    if (String(assignTarget.role).toLowerCase().includes("super_admin") && assignRole !== "super_admin") {
      addToast("A Super Admin cannot be demoted to a lower role.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.updateUser(assignTarget.id, { role: assignRole });
      addToast(`Role assigned to ${assignTarget.name}: ${roleTitle(assignRole)}`, "success");
      setAssignTarget(null);
      fetchUsers();
      fetchRolesAndPermissions();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to assign role."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInlineRoleChange = async (user: RoleAssignment, newRole: string) => {
    if (newRole === user.role) return;
    if (!isSuperAdmin && newRole === "super_admin") {
      addToast("Access Denied: Only a Super Administrator can grant Super Admin privileges.", "error");
      return;
    }
    if (String(user.role).toLowerCase().includes("super_admin") && newRole !== "super_admin") {
      addToast("A Super Admin cannot be demoted to a lower role.", "error");
      return;
    }
    try {
      await userService.updateUser(user.id, { role: newRole });
      addToast(`Role updated for ${user.name}: ${roleTitle(newRole)}`, "success");
      fetchUsers();
      fetchRolesAndPermissions();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update role."), "error");
    }
  };

  const handleRevokeAccess = async () => {
    const target = revokeTarget;
    if (!target) return;
    if (String(target.role).toLowerCase().includes("super_admin")) {
      addToast("Super Admin access cannot be revoked here.", "error");
      setRevokeTarget(null);
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.updateUser(target.id, { is_active: false });
      addToast(`Access revoked for ${target.name}.`, "success");
      setRevokeTarget(null);
      fetchUsers();
      fetchRolesAndPermissions();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to revoke access."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReinstate = async (user: RoleAssignment) => {
    try {
      await userService.updateUser(user.id, { is_active: true });
      addToast(`Access reinstated for ${user.name}.`, "success");
      fetchUsers();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to reinstate access."), "error");
    }
  };

  const openRolePermissionsFromUser = (user: RoleAssignment) => {
    const role = roles.find((r) => r.name === user.role);
    if (role) {
      openEditRole(role);
    } else {
      addToast(`No role record found for "${user.role}".`, "info");
    }
  };

  const openAccountProfileModal = async (user: RoleAssignment) => {
    setSelectedAccount(user);
    setSelectedAccountModalOpen(true);
    setIsEditingAccount(false);
    setIsChangingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setAccountEditForm({
      full_name: user.name,
      phone: "",
      role: user.role || "",
      is_active: user.is_active ?? true,
    });
    setAccountDetailLoading(true);
    try {
      const data = await userService.getUserById(user.id);
      const detail = (data?.data || data) as Record<string, unknown>;
      setAccountDetail(detail);
      setAccountEditForm({
        full_name: String(detail.full_name || detail.name || user.name || ""),
        phone: String(detail.phone || ""),
        role: Array.isArray(detail.roles) && detail.roles.length > 0 ? String(detail.roles[0]) : user.role || "",
        is_active: detail.is_active !== undefined ? Boolean(detail.is_active) : user.is_active ?? true,
      });
    } catch {
      setAccountDetail(null);
    } finally {
      setAccountDetailLoading(false);
    }
  };

  const handleSaveAccountEdit = async () => {
    if (!selectedAccount) return;
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can edit user profiles.", "error");
      return;
    }
    if (!isSuperAdmin && String(selectedAccount.role).toLowerCase().includes("super_admin")) {
      addToast("Access Denied: Only a Super Administrator can edit Super Admin accounts.", "error");
      return;
    }
    if (!accountEditForm.full_name.trim()) {
      addToast("Full name is required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<UserPayload> = {
        full_name: accountEditForm.full_name.trim(),
        phone: accountEditForm.phone.trim() || null,
        is_active: accountEditForm.is_active,
        role_names: accountEditForm.role ? [accountEditForm.role] : [],
      };
      await userService.updateUser(selectedAccount.id, payload);
      addToast(`Account details for ${accountEditForm.full_name} updated successfully.`, "success");
      setIsEditingAccount(false);

      // Refresh account details and list
      const updatedData = await userService.getUserById(selectedAccount.id);
      const detail = (updatedData?.data || updatedData) as Record<string, unknown>;
      setAccountDetail(detail);
      setSelectedAccount((prev) =>
        prev
          ? {
              ...prev,
              name: accountEditForm.full_name.trim(),
              role: accountEditForm.role,
              is_active: accountEditForm.is_active,
              status: accountEditForm.is_active ? "Active" : "Inactive",
            }
          : null
      );
      await fetchUsers();
      await fetchRolesAndPermissions();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update account information."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeAccountPassword = async () => {
    if (!selectedAccount) return;
    if (!isSuperAdmin) {
      addToast("Access Denied: Only a Super Administrator can reset account passwords.", "error");
      return;
    }
    if (!newPassword) {
      addToast("Password is required.", "error");
      return;
    }
    if (newPassword.length < 10) {
      addToast("Password must be at least 10 characters long.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await userService.updateUser(selectedAccount.id, { password: newPassword });
      addToast(`Password updated successfully for ${selectedAccount.name}.`, "success");
      setIsChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to change user password."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const [userCategoryFilter, setUserCategoryFilter] = useState<"all" | "staff" | "public">("all");

  const staffUsers = useMemo(
    () => users.filter((u) => isInternalRole(u.role)),
    [users]
  );

  const categoryUsers = useMemo(() => {
    if (userCategoryFilter === "staff") return staffUsers;
    if (userCategoryFilter === "public") return users.filter((u) => !isInternalRole(u.role));
    return users;
  }, [users, staffUsers, userCategoryFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return categoryUsers;
    return categoryUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q) ||
        (u.id || "").toLowerCase().includes(q)
    );
  }, [categoryUsers, userSearch]);

  const activeStaffUsers = staffUsers.filter((u) => u.is_active).length;

  const stats = [
    {
      title: "System & Custom Roles",
      value: loading ? "..." : `${roles.length} Roles`,
      trend: `${roles.filter((r) => r.isSystem).length} System · ${roles.filter((r) => !r.isSystem).length} Custom`,
      color: "#2563EB",
      icon: <FaUserShield />,
      onClick: () => {
        setActiveTab("roles");
        document.getElementById("roles-tab-section")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Permission Matrix Grants",
      value: loading ? "..." : `${matrixTotal} Grants`,
      trend: `${matrixModules.length || PERMISSION_MODULES.length} Active System Modules`,
      color: "#EF4444",
      icon: <FaLock />,
      onClick: () => {
        setActiveTab("roles");
        document.getElementById("roles-tab-section")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Staff Personnel Coverage",
      value: usersLoading ? "..." : `${activeStaffUsers} Active`,
      trend: `${staffUsers.length} Internal Staff Accounts`,
      color: "#10B981",
      icon: <FaUsers />,
      onClick: () => {
        setActiveTab("users");
        document.getElementById("users-tab-section")?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ];

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid #CBD5E1",
    background: active ? "#2563EB" : "#FFFFFF",
    color: active ? "#FFFFFF" : "#334155",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
  });

  const thStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontWeight: 700,
    color: "#475569",
    textAlign: "left",
    whiteSpace: "nowrap",
    background: "#F8FAFC",
    position: "sticky",
    top: 0,
    zIndex: 10,
    borderBottom: "1px solid #E2E8F0",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    verticalAlign: "middle",
    color: "#0F172A",
    borderBottom: "1px solid #F1F5F9",
  };
  const actionButtonStyle = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div>
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
          Roles, Permissions & Access Control
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Define module-wise permissions (View, Create, Edit, Delete, Approve, Export, Manage),
          assign roles to every user, and revoke access — all enforced against live data.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button style={tabButtonStyle(activeTab === "roles")} onClick={() => setActiveTab("roles")}>
          Role Policies
        </button>
        <button style={tabButtonStyle(activeTab === "users")} onClick={() => setActiveTab("users")}>
          User Assignments
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <QuickActionCard
          icon={<FaPlusCircle />}
          title="Create Custom Role"
          subtitle="Define a new permission set"
          color="#2563EB"
          onClick={openCreateRole}
        />
        <QuickActionCard
          icon={<FaUserPlus />}
          title="Provision New User"
          subtitle="Onboard & assign role"
          color="#10B981"
          onClick={() => (window.location.href = "/users?action=add")}
        />
        <QuickActionCard
          icon={<FaUserShield />}
          title="Permission Matrix"
          subtitle="Review module-wise grants"
          color="#6366F1"
          onClick={() => setActiveTab("roles")}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {activeTab === "roles" ? (
        <div id="roles-tab-section" className="soft-card" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Role Definitions & Permission Sets
            </h3>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <FaSearch
                size={13}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                }}
              />
              <input
                type="text"
                placeholder="Search roles..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 34px",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto", width: "100%", border: "1px solid #E2E8F0", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#F8FAFC" }}>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Assigned Users</th>
                  <th style={thStyle}>Permissions</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#2563EB" }}>
                      Loading roles from server...
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}>
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openEditRole(r)}
                      title={`Edit permissions for ${roleTitle(r.name)}`}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F0F6FF")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700 }}>{roleTitle(r.name)}</div>
                        {r.description && (
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{r.category}</td>
                      <td style={tdStyle}>{typeBadge(r.isSystem || false)}</td>
                      <td style={tdStyle}>{r.userCount || 0}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#F1F5F9",
                            color: "#334155",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          <FaKey size={10} />
                          {r.permissions?.length ?? 0}
                        </span>
                      </td>
                      <td style={tdStyle}>{statusBadge(r.status || "Active")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div id="users-tab-section" className="soft-card" style={{ padding: "20px" }}>
          {/* Category Filter Tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setUserCategoryFilter("all")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                background: userCategoryFilter === "all" ? "#2563EB" : "transparent",
                color: userCategoryFilter === "all" ? "#FFFFFF" : "#64748B",
                boxShadow: userCategoryFilter === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              All Users ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setUserCategoryFilter("staff")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                background: userCategoryFilter === "staff" ? "#2563EB" : "transparent",
                color: userCategoryFilter === "staff" ? "#FFFFFF" : "#64748B",
                boxShadow: userCategoryFilter === "staff" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Internal Staff ({staffUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setUserCategoryFilter("public")}
              style={{
                padding: "6px 14px",
                borderRadius: "7px",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                background: userCategoryFilter === "public" ? "#2563EB" : "transparent",
                color: userCategoryFilter === "public" ? "#FFFFFF" : "#64748B",
                boxShadow: userCategoryFilter === "public" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Public &amp; Community ({users.length - staffUsers.length})
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Assign &amp; Revoke Roles for Every User
            </h3>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <FaSearch
                size={13}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                }}
              />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 34px",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {userError && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: 10,
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠️ {userError}
            </div>
          )}

          <div style={{ overflowX: "auto", width: "100%", border: "1px solid #E2E8F0", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#F8FAFC" }}>
                <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Department</th>
                  <th style={{ ...thStyle, minWidth: 200 }}>Assigned Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#2563EB" }}>
                      Loading users from server...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#94A3B8" }}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={tdStyle}>
                        <div
                          onClick={() => openAccountProfileModal(u)}
                          title={`View Profile & Details for ${u.name}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: isInternalRole(u.role) ? "#EFF6FF" : "#F1F5F9",
                              color: isInternalRole(u.role) ? "#1D4ED8" : "#475569",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: 12.5,
                              border: "1px solid #CBD5E1",
                              flexShrink: 0,
                            }}
                          >
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#1D4ED8",
                                textDecoration: "none",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                              {u.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#94A3B8" }}>
                              {u.id && u.id !== "-" ? `ID: ${u.id.slice(0, 8)}...` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>{u.department}</td>
                      <td style={tdStyle}>
                        <select
                          key={`${u.id}-${u.role}`}
                          defaultValue={roles.some((r) => r.name === u.role) ? u.role : ""}
                          disabled={isSubmitting}
                          onChange={(e) => handleInlineRoleChange(u, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #CBD5E1",
                            fontSize: 12.5,
                            background: "#FFFFFF",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">None</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {roleTitle(r.name)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>{statusBadge(u.status || "Active")}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => openAccountProfileModal(u)}
                            style={actionButtonStyle("#0F766E", "#F0FDFA")}
                            title="View account profile & details"
                          >
                            <FaIdBadge /> Profile
                          </button>
                          <button
                            onClick={() => openAssignModal(u)}
                            style={actionButtonStyle("#1D4ED8", "#EFF6FF")}
                            title="Assign role"
                          >
                            <FaUserShield /> Assign
                          </button>
                          <button
                            onClick={() => openRolePermissionsFromUser(u)}
                            style={actionButtonStyle("#6D28D9", "#F5F3FF")}
                            title="Edit this role's permission matrix"
                          >
                            <FaKey /> Role Policy
                          </button>
                          <button
                            onClick={() => openUserPermModal(u)}
                            style={actionButtonStyle("#0284C7", "#E0F2FE")}
                            title="Direct User Permission Overrides"
                          >
                            <FaKey /> User Overrides
                          </button>
                          {u.is_active ? (
                            <button
                              onClick={() => setRevokeTarget(u)}
                              style={actionButtonStyle("#B91C1C", "#FEF2F2")}
                              title="Revoke role & access"
                            >
                              <FaBan /> Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReinstate(u)}
                              style={actionButtonStyle("#059669", "#ECFDF5")}
                              title="Reinstate access"
                            >
                              <FaCheckCircle /> Reinstate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Role Modal */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={
          roleModalMode === "create"
            ? "Define New Custom Role"
            : editingRole?.isSystem
            ? `Edit Permissions — ${roleTitle(editingRole.name)}`
            : `Edit Role Policy — ${editingRole ? roleTitle(editingRole.name) : ""}`
        }
        maxWidth="800px"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveRole();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {roleModalMode === "create" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Role Identifier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. senior_triage_officer"
                    value={roleForm.name}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input
                    type="text"
                    value={roleForm.category}
                    onChange={(e) => setRoleForm({ ...roleForm, category: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Copy permissions from an existing role</label>
                <select
                  value={copyFromRole}
                  onChange={(e) => handleCopyFrom(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Start empty</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {roleTitle(r.name)} ({r.permissions?.length ?? 0} permissions)
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : editingRole?.isSystem ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#1E40AF",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <FaUserShield style={{ marginRight: 6 }} />
              System role <strong>{roleTitle(editingRole.name)}</strong> — the name and category
              are fixed, but you can customize its permission set below.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Role Name *</label>
                <input
                  type="text"
                  required
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input
                  type="text"
                  value={roleForm.category}
                  onChange={(e) => setRoleForm({ ...roleForm, category: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {roleModalMode === "edit" && roleDetailLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
                color: "#1E40AF",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span className="dash-spin" style={{ width: 14, height: 14, border: "2px solid #BFDBFE", borderTopColor: "#2563EB", borderRadius: "50%" }} />
              Loading current permission codes for this role...
            </div>
          )}
          <PermissionMatrixEditor
            value={matrixPerms}
            onChange={setMatrixPerms}
            modules={matrixModules}
            actions={matrixActions}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              {roleModalMode === "edit" && editingRole && !editingRole.isSystem && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(editingRole);
                    setRoleModalOpen(false);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "1px solid #FCA5A5",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <FaTrash /> Delete Role
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                style={cancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={primaryButtonStyle}
              >
                {isSubmitting
                  ? "Saving..."
                  : roleModalMode === "create"
                  ? "Create Role"
                  : "Save Policy"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Role Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Custom Role"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to delete custom role{" "}
            <strong>{deleteTarget ? roleTitle(deleteTarget.name) : ""}</strong>? This action
            cannot be undone.
          </p>
          {deleteTarget && (deleteTarget.userCount || 0) > 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#B91C1C",
                fontSize: 13,
              }}
            >
              <FaBan style={{ marginRight: 6 }} />
              This role has {deleteTarget.userCount} assigned user(s). Deletion is blocked until
              they are reassigned.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              style={cancelButtonStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDeleteRole}
              style={{ ...primaryButtonStyle, background: "#EF4444", display: "flex", alignItems: "center", gap: 6 }}
            >
              <FaTrash /> {isSubmitting ? "Deleting..." : "Delete Role"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Role Modal */}
      <Modal
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title="Assign Role to User"
      >
        {assignTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "#334155", margin: 0, fontSize: 14 }}>
              Assign a role to <strong>{assignTarget.name}</strong> ({assignTarget.email}).
              The role's permission set determines their access across all modules.
            </p>
            <div>
              <label style={labelStyle}>Role *</label>
              <select
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {roleTitle(r.name)} ({r.permissions?.length ?? 0} permissions)
                  </option>
                ))}
              </select>
            </div>
            {assignRole && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  Permission preview
                </div>
                {(() => {
                  const role = roles.find((r) => r.name === assignRole);
                  const perms = role?.permissions || [];
                  const preview = perms.slice(0, 8).map(describePermission);
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {preview.map((p) => (
                        <span
                          key={p}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#EFF6FF",
                            color: "#1D4ED8",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {p}
                        </span>
                      ))}
                      {perms.length > 8 && (
                        <span style={{ fontSize: 11, color: "#64748B", alignSelf: "center" }}>
                          +{perms.length - 8} more
                        </span>
                      )}
                      {perms.length === 0 && (
                        <span style={{ fontSize: 12, color: "#64748B" }}>No permissions.</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setAssignTarget(null)}
                style={cancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !assignRole}
                onClick={handleAssignRole}
                style={primaryButtonStyle}
              >
                {isSubmitting ? "Assigning..." : "Assign Role"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Access Modal */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Role & Access"
      >
        {revokeTarget && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "#334155", margin: 0 }}>
              Revoke the <strong>{roleTitle(revokeTarget.role)}</strong> role and access for{" "}
              <strong>{revokeTarget.name}</strong> ({revokeTarget.email})? The account will be
              deactivated and they will no longer be able to sign in.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                style={cancelButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleRevokeAccess}
                style={{ ...primaryButtonStyle, background: "#EF4444", display: "flex", alignItems: "center", gap: 6 }}
              >
                <FaBan /> {isSubmitting ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Direct User Permission Overrides Modal */}
      <Modal
        isOpen={userPermModalOpen}
        onClose={() => setUserPermModalOpen(false)}
        title={`Direct User Permission Overrides — ${userPermTarget?.name || "Staff Member"}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, color: "#64748B", fontSize: "13px" }}>
            Grant or revoke specific permission overrides directly for <strong>{userPermTarget?.name}</strong> (`{userPermTarget?.email}`), overriding default role policy (`{roleTitle(userPermTarget?.role || "")}`).
          </p>

          <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Permission code (e.g. inventory:create, foster:update)"
              value={customPermCode}
              onChange={(e) => setCustomPermCode(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12.5px" }}
            />
            <button
              onClick={() => handleGrantUserPerm(customPermCode)}
              disabled={isSubmitting || !customPermCode.trim()}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Grant
            </button>
          </div>

          <div>
            <h4 style={{ margin: "0 0 8px", color: "#0F172A", fontSize: "13.5px", fontWeight: 700 }}>
              Active Direct Overrides ({userDirectPerms.length})
            </h4>

            {userPermLoading ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#2563EB" }}>Loading permissions...</div>
            ) : userDirectPerms.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "12.5px" }}>
                No direct user permission overrides granted. User operates strictly under assigned role defaults.
              </div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                {userDirectPerms.map((code) => (
                  <div key={code} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A", fontFamily: "monospace", fontSize: "12px" }}>{code}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>{describePermission(code)}</div>
                    </div>
                    <button
                      onClick={() => handleRevokeUserPerm(code)}
                      disabled={isSubmitting}
                      style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setUserPermModalOpen(false)}
              style={cancelButtonStyle}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
      {/* Selected Account Profile & Details Modal */}
      <Modal
        isOpen={selectedAccountModalOpen}
        onClose={() => {
          setSelectedAccountModalOpen(false);
          setIsEditingAccount(false);
          setIsChangingPassword(false);
        }}
        title={
          isEditingAccount
            ? `Edit Account Profile — ${selectedAccount?.name || "User"}`
            : isChangingPassword
            ? `Change Password — ${selectedAccount?.name || "User"}`
            : `Account Details & Profile — ${selectedAccount?.name || "Staff Member"}`
        }
        maxWidth="680px"
      >
        {selectedAccount && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Account Header Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px",
                background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: isInternalRole(selectedAccount.role) ? "#2563EB" : "#475569",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 22,
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
                }}
              >
                {(selectedAccount.name || "U").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                    {selectedAccount.name}
                  </h3>
                  {statusBadge(selectedAccount.status || "Active")}
                  {accountDetail && accountDetail.is_verified === true && (
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#ECFDF5",
                        color: "#059669",
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      <FaCheckCircle size={10} style={{ marginRight: 4 }} /> Verified
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px", fontSize: "13px", color: "#64748B", flexWrap: "wrap" }}>
                  <span>{selectedAccount.email}</span>
                  <span>•</span>
                  <span style={{ fontWeight: 700, color: "#2563EB" }}>{roleTitle(selectedAccount.role)}</span>
                </div>
              </div>
            </div>

            {accountDetailLoading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#2563EB", fontWeight: 600 }}>
                Loading live account details from server...
              </div>
            ) : isEditingAccount ? (
              /* Edit Account Information Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveAccountEdit();
                }}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={accountEditForm.full_name}
                    onChange={(e) => setAccountEditForm({ ...accountEditForm, full_name: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    type="tel"
                    value={accountEditForm.phone}
                    onChange={(e) => setAccountEditForm({ ...accountEditForm, phone: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. +1-555-0199"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Assigned Role</label>
                  <select
                    value={accountEditForm.role}
                    onChange={(e) => setAccountEditForm({ ...accountEditForm, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">None / General Public</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {roleTitle(r.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <input
                    type="checkbox"
                    id="account-active-checkbox"
                    checked={accountEditForm.is_active}
                    onChange={(e) => setAccountEditForm({ ...accountEditForm, is_active: e.target.checked })}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="account-active-checkbox" style={{ fontSize: "13.5px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    Account Active (permit system login and operations)
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingAccount(false)}
                    style={cancelButtonStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={primaryButtonStyle}
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : isChangingPassword ? (
              /* Change Password Form */
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChangeAccountPassword();
                }}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div style={{ padding: "12px 14px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE", fontSize: "13px", color: "#1E40AF" }}>
                  Administrative Password Reset: Set a new secure password for <strong>{selectedAccount.name}</strong>. Password must be at least 10 characters long.
                </div>

                <div>
                  <label style={labelStyle}>New Password * (min 10 characters)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={10}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: "40px" }}
                      placeholder="Enter new password (at least 10 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#64748B",
                      }}
                    >
                      {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Confirm New Password *</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                    placeholder="Re-enter new password"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    style={cancelButtonStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newPassword || newPassword.length < 10}
                    style={{ ...primaryButtonStyle, background: "#10B981" }}
                  >
                    {isSubmitting ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            ) : (
              /* Default Account Details Overview */
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "12px",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      User ID (UUID)
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-all", fontFamily: "monospace" }}>
                      {String(accountDetail?.id || selectedAccount.id || "-")}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Email Address
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                      {String(accountDetail?.email || selectedAccount.email || "-")}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Phone
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                      {String(accountDetail?.phone || "Not provided")}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Department / Facility
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                      {selectedAccount.department || "General Operations"}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Internal Role Code
                    </div>
                    <div style={{ fontWeight: 700, color: "#2563EB", marginTop: "2px", fontFamily: "monospace" }}>
                      {selectedAccount.role || "None"}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Two-Factor MFA
                    </div>
                    <div style={{ fontWeight: 600, color: accountDetail?.mfa_enabled ? "#16A34A" : "#64748B", marginTop: "2px" }}>
                      {accountDetail?.mfa_enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Account Created
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                      {formatDateTime(accountDetail?.created_at as string)}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}>
                      Last Updated
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                      {formatDateTime(accountDetail?.updated_at as string)}
                    </div>
                  </div>
                </div>

                {/* Direct Permissions Preview if any */}
                {Array.isArray(accountDetail?.direct_permissions) && (accountDetail.direct_permissions as string[]).length > 0 && (
                  <div style={{ marginTop: "14px", padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ color: "#64748B", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px" }}>
                      Direct User Permission Overrides ({ (accountDetail.direct_permissions as string[]).length })
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(accountDetail.direct_permissions as string[]).map((code) => (
                        <span
                          key={code}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#EFF6FF",
                            color: "#1D4ED8",
                            fontSize: "11px",
                            fontWeight: 600,
                            fontFamily: "monospace",
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {isSuperAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingAccount(true)}
                          style={{
                            ...primaryButtonStyle,
                            background: "#2563EB",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            padding: "8px 14px",
                          }}
                        >
                          <FaEdit size={13} /> Edit Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(true)}
                          style={{
                            ...primaryButtonStyle,
                            background: "#0F766E",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "13px",
                            padding: "8px 14px",
                          }}
                        >
                          <FaKey size={13} /> Change Password
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountModalOpen(false);
                        openRolePermissionsFromUser(selectedAccount);
                      }}
                      style={{
                        ...cancelButtonStyle,
                        background: "#F5F3FF",
                        color: "#6D28D9",
                        borderColor: "#DDD6FE",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        padding: "8px 14px",
                      }}
                    >
                      <FaShieldAlt size={13} /> Role Policy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountModalOpen(false);
                        openUserPermModal(selectedAccount);
                      }}
                      style={{
                        ...cancelButtonStyle,
                        background: "#E0F2FE",
                        color: "#0284C7",
                        borderColor: "#BAE6FD",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        padding: "8px 14px",
                      }}
                    >
                      <FaKey size={13} /> Direct Overrides
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAccountModalOpen(false)}
                    style={cancelButtonStyle}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#FFFFFF",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  background: "#F1F5F9",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  background: "#2563EB",
  color: "#FFFFFF",
  fontWeight: 600,
  cursor: "pointer",
};

export default RolesPermissions;
