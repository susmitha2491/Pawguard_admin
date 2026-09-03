import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DataTable from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaUserPlus,
  FaUsers,
  FaUserShield,
  FaCheckCircle,
  FaTimesCircle,
  FaKey,
  FaEdit,
  FaBan,
  FaTrash,
  FaHome,
  FaStethoscope,
  FaHeart,
  FaHandHoldingHeart,
  FaUserFriends,
  FaBoxes,
  FaCoins,
  FaTruck,
  FaClipboardList,
} from "react-icons/fa";
import userService, { type UserPayload, extractPermissionCodes } from "../../services/userService";
import authService from "../../services/auth/authService";
import PasswordInput from "../../components/auth/PasswordInput";
import { notifyDataChanged } from "../../utils/dataSync";
import { normalizeRole, getCurrentUserRole, getCurrentUser } from "../../utils/roleUtils";
import { formatDateTime } from "../../utils/dateUtils";
import { describePermission } from "../../utils/permissionsCatalog";

// Application details integration imports
import UserApplicationDetailModal, { type UnifiedUserApplication } from "../../components/users/UserApplicationDetailModal";
import volunteerService from "../../services/volunteerService";
import fosterService from "../../services/fosterService";
import adoptionService from "../../services/adoptionService";
import lostFoundService from "../../services/lostFoundService";
import rescueService from "../../services/rescueService";

interface UserTableRow {
  id: string;
  name: string;
  full_name?: string | null;
  email: string;
  phone: string | null;
  roles: string[];
  role: string;
  isActive: boolean;
  is_active?: boolean;
  isVerified: boolean;
  is_verified?: boolean;
  mfaEnabled: boolean;
  mfa_enabled?: boolean;
  createdAt: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  lastLogin?: string | null;
  last_login?: string | null;
  last_login_at?: string | null;
  last_seen?: string | null;
  direct_permissions?: string[];
  status: string;
  appStatus?: string;
  rejection_reason?: string | null;
  [key: string]: unknown;
}

const getUserApprovalStatus = (user?: Partial<UserTableRow> | null): "pending" | "approved" | "rejected" => {
  if (!user) return "pending";
  const s = String(user.appStatus || user.status || "").toLowerCase().trim();
  if (s === "approved" || s === "active") return "approved";
  if (s === "rejected" || s === "declined") return "rejected";
  if (s === "pending" || s === "applied" || s === "unverified" || s === "in_review") return "pending";
  if (user.is_verified === true) return "approved";
  if (user.is_verified === false && s !== "approved" && s !== "active" && s !== "rejected") return "pending";
  return "pending";
};

const formatDate = (isoString?: string): string => formatDateTime(isoString);

const resolveUserId = (userObj?: Record<string, unknown> | UserPayload | UserTableRow | null): string => {
  if (!userObj || typeof userObj !== "object") return "";

  // 1. Prefer explicit user_id / userId / userUUID / uuid fields if present
  const explicitUserId =
    (userObj as any).user_id ||
    (userObj as any).userId ||
    (userObj as any).userUUID ||
    (userObj as any).uuid;

  if (explicitUserId) {
    const str = String(explicitUserId).trim();
    if (
      str &&
      str !== "-" &&
      str !== "undefined" &&
      str !== "null" &&
      !str.includes("@") &&
      !/^(VOL|FOST|ADOPT|APP|LOST|FOUND)-/i.test(str)
    ) {
      return str;
    }
  }

  // 2. Check primary id field
  const rawId = userObj.id || (userObj as any)._id;
  if (!rawId) return "";
  const strId = String(rawId).trim();
  if (
    strId === "" ||
    strId === "-" ||
    strId === "undefined" ||
    strId === "null" ||
    strId.includes("@") ||
    /^(VOL|FOST|ADOPT|APP|LOST|FOUND)-/i.test(strId)
  ) {
    return "";
  }
  return strId;
};

const formatRole = (role: string): string => {
  if (!role) return "General Public";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatRoles = (roles: string[]): React.ReactNode => {
  if (!roles || roles.length === 0) return <span style={{ color: "#94A3B8" }}>General Public</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {roles.map((role) => (
        <span
          key={role}
          style={{
            background: "#EFF6FF",
            color: "#1E40AF",
            padding: "2px 8px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {formatRole(role)}
        </span>
      ))}
    </div>
  );
};

// Role filter configuration - matches backend role values with display labels
const ROLE_FILTER_OPTIONS: Array<{ value: string; label: string; backendRoles: string[] }> = [
  { value: "all", label: "All Users", backendRoles: [] },
  { value: "super_admin", label: "Super Admin", backendRoles: ["super_admin"] },
  { value: "rescue_centre_admin", label: "Rescue Centre", backendRoles: ["rescue_centre_admin"] },
  { value: "rescue_coordinator", label: "Rescue Coordinator", backendRoles: ["rescue_coordinator"] },
  { value: "rescue_agent", label: "Rescue Agent", backendRoles: ["rescue_agent"] },
  { value: "veterinarian", label: "Veterinarian", backendRoles: ["veterinarian"] },
  { value: "shelter_manager", label: "Shelter", backendRoles: ["shelter_manager"] },
  { value: "adoption_coordinator", label: "Adoption", backendRoles: ["adoption_coordinator"] },
  { value: "foster_coordinator", label: "Foster Care", backendRoles: ["foster_coordinator"] },
  { value: "volunteer_coordinator", label: "Volunteer", backendRoles: ["volunteer_coordinator"] },
  { value: "inventory_manager", label: "Inventory", backendRoles: ["inventory_manager"] },
  { value: "finance_user", label: "Finance", backendRoles: ["finance_user"] },
];

const RESCUE_PERMITTED_ROLES = ["rescue_centre_admin", "rescue_coordinator", "rescue_agent", "rescue_staff"];

const RESCUE_ROLE_FILTER_OPTIONS: Array<{ value: string; label: string; backendRoles: string[] }> = [
  { value: "all", label: "All Rescue Roles", backendRoles: RESCUE_PERMITTED_ROLES },
  { value: "rescue_centre_admin", label: "Rescue Centre Admin", backendRoles: ["rescue_centre_admin"] },
  { value: "rescue_coordinator", label: "Rescue Coordinator", backendRoles: ["rescue_coordinator"] },
  { value: "rescue_agent", label: "Rescue Agent", backendRoles: ["rescue_agent"] },
  { value: "rescue_staff", label: "Rescue Staff", backendRoles: ["rescue_staff"] },
];

const SHELTER_ROLE_FILTER_OPTIONS: Array<{ value: string; label: string; backendRoles: string[] }> = [
  { value: "all", label: "All Shelter Staff", backendRoles: ["shelter_manager"] },
  { value: "shelter_manager", label: "Shelter Manager", backendRoles: ["shelter_manager"] },
];


const INTERNAL_ADMIN_PORTAL_ROLES = [
  "super_admin",
  "rescue_centre_admin",
  "rescue_coordinator",
  "rescue_agent",
  "veterinarian",
  "shelter_manager",
  "adoption_coordinator",
  "foster_coordinator",
  "volunteer_coordinator",
  "inventory_manager",
  "finance_user",
];

/**
 * Checks if any of the user's assigned roles belong to one of the exact 11 internal Admin Portal roles.
 */
const hasAdminPortalAccess = (roles?: string[] | string | null): boolean => {
  if (!roles) return false;
  const rolesArr = Array.isArray(roles) ? roles : [roles];
  return rolesArr.some((r) => {
    const lower = String(r).toLowerCase().trim();
    return INTERNAL_ADMIN_PORTAL_ROLES.some(
      (intRole) =>
        lower === intRole ||
        lower === intRole.replace(/_/g, "-") ||
        lower === intRole.replace(/_/g, " ")
    );
  });
};

interface ApiErrorShape {
  response?: { status?: number; data?: { detail?: string; message?: string } };
  message?: string;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as ApiErrorShape;
  const detail = e?.response?.data?.detail;
  if (detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const msgs: string[] = (detail as any[])
        .map((d: any) =>
          typeof d === "string"
            ? d
            : d?.msg
            ? `${Array.isArray(d.loc) ? d.loc.filter((l: any) => l !== "body" && l !== "query").join(".") : ""}: ${d.msg}`
            : JSON.stringify(d)
        )
        .filter(Boolean);
      if (msgs.length > 0) return `Validation Error: ${msgs.join("; ")}`;
    }
    if (typeof detail === "object") {
      return (detail as any).message || (detail as any).msg || JSON.stringify(detail);
    }
  }
  if (e?.response?.data?.message) return String(e.response.data.message);
  const status = e?.response?.status;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) {
    return "You don't have permission to manage user accounts. Contact a Super Administrator to grant access.";
  }
  if (status === 404) return "User account endpoint not found. Please try again later.";
  if (status === 422) {
    return "Validation error: The request format did not match backend OpenAPI schema.";
  }
  if (status !== undefined && status >= 500) {
    return "The server encountered an error. Please try again later.";
  }
  if (!e?.response && e?.message) return `Network error: ${e.message}`;
  return fallback;
};

const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 14; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const parseRoleNames = (value: string): string[] =>
  value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

const fetchApplicationsForUser = async (user: UserTableRow): Promise<UnifiedUserApplication[]> => {
  if (!user) return [];
  const uId = String(user.id || "").toLowerCase();
  const uEmail = String(user.email || "").toLowerCase();
  const uPhone = String(user.phone || "").toLowerCase();
  const uName = String(user.full_name || user.name || "").toLowerCase();

  const results: UnifiedUserApplication[] = [];

  // 1. Volunteer Applications
  try {
    const volRes = await volunteerService.getApplications();
    const volList = Array.isArray(volRes) ? volRes : Array.isArray(volRes?.data) ? volRes.data : [];
    volList.forEach((v: any) => {
      const vUserId = String(v.user_id || "").toLowerCase();
      const vEmail = String(v.email || v.applicant_email || "").toLowerCase();
      if ((uId && vUserId === uId) || (uEmail && vEmail === uEmail)) {
        const rawStatus = String(v.status || "applied").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Pending Approval";
        if (rawStatus === "onboarded" || rawStatus === "active" || rawStatus === "approved") {
          statusKey = "approved";
          statusLabel = "Approved";
        } else if (rawStatus === "rejected") {
          statusKey = "rejected";
          statusLabel = "Rejected";
        }
        results.push({
          id: String(v.id || v.application_id || `VOL-${Math.random()}`),
          type: "volunteer",
          title: `Volunteer Application — ${v.preferred_role || "General Volunteer"}`,
          subtitle: `Role Preference: ${v.preferred_role || "General"} | Emergency Contact: ${v.emergency_contact_name || "—"}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(v.created_at || v.submitted_at || new Date().toISOString()),
          updatedAt: v.updated_at ? String(v.updated_at) : undefined,
          rawRecord: v,
          rejectionReason: v.rejection_reason || v.notes || null,
          applicantName: v.full_name || v.name || user.full_name || user.name,
          applicantEmail: v.email || user.email,
          applicantPhone: v.phone || user.phone,
        });
      }
    });
  } catch {
    // Ignore individual fetch failure
  }

  // 2. Foster Applications
  try {
    const fosterRes = await fosterService.getFosterProfiles();
    const fosterList = Array.isArray(fosterRes) ? fosterRes : Array.isArray(fosterRes?.data) ? fosterRes.data : [];
    fosterList.forEach((f: any) => {
      const fUserId = String(f.user_id || f.user?.id || "").toLowerCase();
      const fEmail = String(f.email || f.user?.email || "").toLowerCase();
      if ((uId && fUserId === uId) || (uEmail && fEmail === uEmail)) {
        const rawStatus = String(f.status || "applied").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Pending Approval";
        if (rawStatus === "approved") {
          statusKey = "approved";
          statusLabel = "Approved";
        } else if (rawStatus === "rejected") {
          statusKey = "rejected";
          statusLabel = "Rejected";
        }
        results.push({
          id: String(f.id || `FOST-${Math.random()}`),
          type: "foster",
          title: "Foster Family Application",
          subtitle: `Max Capacity: ${f.max_capacity ?? 1} dogs | Preferences: ${f.preferences || "Any"}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(f.created_at || new Date().toISOString()),
          updatedAt: f.updated_at ? String(f.updated_at) : undefined,
          rawRecord: f,
          rejectionReason: f.vetting_notes || f.notes || null,
          applicantName: f.full_name || f.user?.full_name || user.full_name || user.name,
          applicantEmail: f.email || f.user?.email || user.email,
          applicantPhone: f.phone || f.user?.phone || user.phone,
        });
      }
    });
  } catch {
    // Ignore individual fetch failure
  }

  // 3. Adoption Applications
  try {
    const adoptRes = await adoptionService.getAdoptions();
    const adoptList = Array.isArray(adoptRes) ? adoptRes : Array.isArray(adoptRes?.data) ? adoptRes.data : [];
    adoptList.forEach((a: any) => {
      const aAdopterId = String(a.adopter_id || a.adopter?.id || "").toLowerCase();
      const aEmail = String(a.applicantEmail || a.adopter_email || a.adopter?.email || "").toLowerCase();
      if ((uId && aAdopterId === uId) || (uEmail && aEmail === uEmail)) {
        const rawStatus = String(a.status || "submitted").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Pending Review";
        if (rawStatus === "approved") {
          statusKey = "approved";
          statusLabel = "Approved";
        } else if (rawStatus === "completed") {
          statusKey = "completed";
          statusLabel = "Completed";
        } else if (rawStatus === "rejected") {
          statusKey = "rejected";
          statusLabel = "Rejected";
        }
        results.push({
          id: String(a.id || a.applicationId || `ADOPT-${Math.random()}`),
          type: "adoption",
          title: `Adoption Application — ${a.petName || a.dog_name || "Pet"}`,
          subtitle: `Pet: ${a.petName || "Canine"} (${a.petBreed || "Dog"}) | Status: ${rawStatus}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(a.created_at || a.date || new Date().toISOString()),
          updatedAt: a.updated_at ? String(a.updated_at) : undefined,
          completedAt: a.completed_at ? String(a.completed_at) : undefined,
          rawRecord: a,
          rejectionReason: a.vetting_officer_notes || null,
          applicantName: a.applicantName || user.full_name || user.name,
          applicantEmail: a.applicantEmail || user.email,
          applicantPhone: a.applicantPhone || user.phone,
        });
      }
    });
  } catch {
    // Ignore individual fetch failure
  }

  // 4. Lost / Found Pet Reports
  try {
    const [lostRes, foundRes] = await Promise.all([
      lostFoundService.getLostReports().catch(() => ({ data: [] })),
      lostFoundService.getFoundReports().catch(() => ({ data: [] })),
    ]);

    const lostList = Array.isArray((lostRes as any)?.data) ? (lostRes as any).data : Array.isArray(lostRes) ? lostRes : [];
    const foundList = Array.isArray((foundRes as any)?.data) ? (foundRes as any).data : Array.isArray(foundRes) ? foundRes : [];

    lostList.forEach((l: any) => {
      const lUserId = String(l.user_id || l.user?.id || "").toLowerCase();
      const lEmail = String(l.user?.email || "").toLowerCase();
      if ((uId && lUserId === uId) || (uEmail && lEmail === uEmail)) {
        const rawStatus = String(l.status || "active").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Active Report";
        if (rawStatus === "resolved") {
          statusKey = "approved";
          statusLabel = "Resolved";
        }
        results.push({
          id: String(l.id || `LOST-${Math.random()}`),
          type: "lost_found",
          title: `Lost Pet Report — ${l.pet_name || "Dog"}`,
          subtitle: `Breed: ${l.breed || "Dog"} | Location: ${l.location_address || "Field"}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(l.created_at || l.lost_at || new Date().toISOString()),
          updatedAt: l.updated_at ? String(l.updated_at) : undefined,
          rawRecord: l,
          applicantName: l.user?.full_name || user.full_name || user.name,
          applicantEmail: l.user?.email || user.email,
          applicantPhone: l.user?.phone || user.phone,
          address: l.location_address,
        });
      }
    });

    foundList.forEach((f: any) => {
      const fUserId = String(f.user_id || f.user?.id || "").toLowerCase();
      const fEmail = String(f.user?.email || "").toLowerCase();
      if ((uId && fUserId === uId) || (uEmail && fEmail === uEmail)) {
        const rawStatus = String(f.status || "active").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Active Report";
        if (rawStatus === "resolved") {
          statusKey = "approved";
          statusLabel = "Resolved";
        }
        results.push({
          id: String(f.id || `FOUND-${Math.random()}`),
          type: "lost_found",
          title: `Found Pet Report — ${f.breed_observed || "Canine"}`,
          subtitle: `Color: ${f.color_observed || "Observed"} | Location: ${f.location_address || "Field"}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(f.created_at || f.found_at || new Date().toISOString()),
          updatedAt: f.updated_at ? String(f.updated_at) : undefined,
          rawRecord: f,
          applicantName: f.user?.full_name || user.full_name || user.name,
          applicantEmail: f.user?.email || user.email,
          applicantPhone: f.user?.phone || user.phone,
          address: f.location_address,
        });
      }
    });
  } catch {
    // Ignore individual fetch failure
  }

  // 5. Rescue Requests
  try {
    const rescueRes = await rescueService.getRescueRequests();
    const rescueList = Array.isArray(rescueRes) ? rescueRes : Array.isArray(rescueRes?.data) ? rescueRes.data : [];
    rescueList.forEach((r: any) => {
      const rUserId = String(r.user_id || "").toLowerCase();
      const rPhone = String(r.reporter_phone || "").toLowerCase();
      const rName = String(r.reporter_name || "").toLowerCase();
      if (
        (uId && rUserId === uId) ||
        (uPhone && rPhone === uPhone) ||
        (uName && rName && rName === uName)
      ) {
        const rawStatus = String(r.status || "reported").toLowerCase();
        let statusKey = "pending";
        let statusLabel = "Pending Dispatch";
        if (rawStatus === "verified" || rawStatus === "approved" || rawStatus === "resolved") {
          statusKey = rawStatus === "resolved" ? "completed" : "approved";
          statusLabel = rawStatus === "resolved" ? "Resolved" : "Verified / Approved";
        } else if (rawStatus === "failed" || rawStatus === "rejected") {
          statusKey = "rejected";
          statusLabel = "Rejected";
        }
        results.push({
          id: String(r.id || `RESC-${Math.random()}`),
          type: "rescue",
          title: `Rescue Emergency Request — ${r.dog_name || "Dog Incident"}`,
          subtitle: `Location: ${r.location || "Field"} | Severity: ${r.urgency_level || r.severity || "Normal"}`,
          status: statusKey,
          statusLabel,
          submittedAt: String(r.created_at || new Date().toISOString()),
          updatedAt: r.updated_at ? String(r.updated_at) : undefined,
          rawRecord: r,
          rejectionReason: r.rejection_rationale || r.failure_reason || null,
          applicantName: r.reporter_name || user.full_name || user.name,
          applicantPhone: r.reporter_phone || user.phone,
          address: r.location,
        });
      }
    });
  } catch {
    // Ignore individual fetch failure
  }

  results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  return results;
};

const Users = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Check current user role and Rescue Centre assignment for scope enforcement
  const currentUser = getCurrentUser();
  const currentUserRole = getCurrentUserRole();
  const isRescueCentreAdmin = currentUserRole === "rescue_centre_admin";
  const isSuperAdmin = currentUserRole === "super_admin";
  const isShelterManager = currentUserRole === "shelter_manager";
  const currentRescueCentreId = (currentUser as any)?.rescue_centre_id || (currentUser as any)?.rescue_center_id || (currentUser as any)?.rescue_facility_id || (currentUser as any)?.facility_id || (currentUser as any)?.organization_id || (currentUser as any)?.id;
  const currentShelterId = (currentUser as any)?.shelter_id || (currentUser as any)?.shelterId || (currentUser as any)?.facility_id || (currentUser as any)?.facilityId || (currentUser as any)?.organization_id;


  // Filter state for summary cards: "all" (master directory), "staff" (internal accounts), or "public" (community registrations)
  const [activeFilter, setActiveFilter] = useState<"all" | "staff" | "public">(isSuperAdmin ? "all" : "staff");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeFilter, roleFilter, statusFilter, searchTerm]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(() => searchParams.get("action") === "add");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserTableRow | null>(null);

  // User Profile Modal State
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserTableRow | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);



  // User Applications and Requests state
  const [userApplications, setUserApplications] = useState<UnifiedUserApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<UnifiedUserApplication | null>(null);
  const [isAppDetailModalOpen, setIsAppDetailModalOpen] = useState(false);

  // Password Reset State inside Profile Modal
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isResetTokenFormOpen, setIsResetTokenFormOpen] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Direct User Permission Overrides State
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [permUserId, setPermUserId] = useState<string>("");
  const [permUserName, setPermUserName] = useState<string>("");
  const [permUserRole, setPermUserRole] = useState<string>("");
  const [userDirectPerms, setUserDirectPerms] = useState<string[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [customPermCode, setCustomPermCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit User
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "rescue_agent",
    password: "",
  });

  /**
   * Fetch complete user profile from backend API to ensure exact field matching
   * without stale state or hardcoded fallbacks.
   */
  const handleOpenUserProfile = async (userRow: UserTableRow) => {
    setSelectedUserProfile(null);
    setIsProfileModalOpen(true);
    setProfileLoading(true);
    setUserApplications([]);
    setApplicationsLoading(true);

    let targetProfile: UserTableRow;

    try {
      const userRes = await userService.getUserById(userRow.id);
      const userPayload = ((userRes as any)?.data || userRes) as Record<string, unknown>;

      let perms: string[] = [];
      try {
        const permRes = await userService.getUserPermissions(userRow.id);
        perms = extractPermissionCodes(permRes);
      } catch {
        perms = Array.isArray(userPayload.direct_permissions) ? (userPayload.direct_permissions as string[]) : [];
      }

      const rolesArr = Array.isArray(userPayload.roles)
        ? (userPayload.roles as string[])
        : Array.isArray(userPayload.role_names)
        ? (userPayload.role_names as string[])
        : userPayload.role
        ? [String(userPayload.role)]
        : userRow.roles;

      const rawStatusStr = String(userPayload.status || userRow.appStatus || userRow.status || "").toLowerCase().trim();
      const computedAppStatus: "pending" | "approved" | "rejected" =
        (rawStatusStr === "approved" || rawStatusStr === "active" || userPayload.is_verified === true)
          ? "approved"
          : (rawStatusStr === "rejected" || rawStatusStr === "declined" ? "rejected" : "pending");

      const fullObj: UserTableRow = {
        id: resolveUserId(userPayload) || resolveUserId(userRow) || String(userRow.id || ""),
        name: String(userPayload.full_name || userPayload.name || userRow.name || "Not provided"),
        full_name: (userPayload.full_name as string) || (userPayload.name as string) || userRow.full_name || null,
        email: String(userPayload.email || userRow.email || ""),
        phone: userPayload.phone !== undefined && userPayload.phone !== null ? String(userPayload.phone) : userRow.phone,
        roles: rolesArr,
        role: rolesArr.length > 0 ? rolesArr.join(", ") : String(userPayload.role || userRow.role || "general_public"),
        isActive: userPayload.is_active !== undefined ? Boolean(userPayload.is_active) : userRow.isActive,
        is_active: userPayload.is_active !== undefined ? Boolean(userPayload.is_active) : userRow.isActive,
        isVerified: userPayload.is_verified !== undefined ? Boolean(userPayload.is_verified) : userRow.isVerified,
        is_verified: userPayload.is_verified !== undefined ? Boolean(userPayload.is_verified) : userRow.isVerified,
        mfaEnabled: userPayload.mfa_enabled !== undefined ? Boolean(userPayload.mfa_enabled) : userRow.mfaEnabled,
        mfa_enabled: userPayload.mfa_enabled !== undefined ? Boolean(userPayload.mfa_enabled) : userRow.mfaEnabled,
        createdAt: (userPayload.created_at as string) || userRow.createdAt,
        created_at: (userPayload.created_at as string) || userRow.createdAt,
        updatedAt: (userPayload.updated_at as string) || userRow.updatedAt,
        updated_at: (userPayload.updated_at as string) || userRow.updatedAt,
        direct_permissions: perms,
        status: (userPayload.is_active ?? userRow.isActive) ? "Active" : "Inactive",
        appStatus: computedAppStatus,
        rejection_reason: (userPayload.rejection_reason as string) || (userRow.rejection_reason as string) || null,
      };

      targetProfile = fullObj;
      setSelectedUserProfile(fullObj);
    } catch {
      const rawStatusStr = String(userRow.appStatus || userRow.status || "").toLowerCase().trim();
      const computedAppStatus: "pending" | "approved" | "rejected" =
        (rawStatusStr === "approved" || rawStatusStr === "active" || userRow.isVerified || userRow.is_verified)
          ? "approved"
          : (rawStatusStr === "rejected" || rawStatusStr === "declined" ? "rejected" : "pending");

      const fullObj: UserTableRow = {
        ...userRow,
        phone: userRow.phone ?? null,
        is_active: userRow.isActive,
        is_verified: userRow.isVerified,
        mfa_enabled: userRow.mfaEnabled,
        created_at: userRow.createdAt,
        updated_at: userRow.updatedAt,
        direct_permissions: [],
        appStatus: computedAppStatus,
        rejection_reason: userRow.rejection_reason || null,
      };
      targetProfile = fullObj;
      setSelectedUserProfile(fullObj);
    } finally {
      setProfileLoading(false);
    }

    // Load applications asynchronously
    try {
      const apps = await fetchApplicationsForUser(targetProfile);
      setUserApplications(apps);
    } catch {
      setUserApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!selectedUserProfile?.email) return;
    try {
      setIsResettingPassword(true);
      await authService.requestPasswordReset(selectedUserProfile.email);
      addToast(`Password reset initialized for ${selectedUserProfile.email}. Check reset token to finalize.`, "success");
      setIsResetTokenFormOpen(true);
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to request password reset."), "error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      addToast("Please enter both reset token and new password.", "error");
      return;
    }
    if (newPassword.length < 10) {
      addToast("New password must be at least 10 characters long.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await authService.confirmPasswordReset(resetToken.trim(), newPassword);
      addToast(`Login password updated successfully for ${selectedUserProfile?.email || "user"}!`, "success");
      setIsResetTokenFormOpen(false);
      setResetToken("");
      setNewPassword("");
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to confirm password reset."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUserDirectPermissions = async (user: UserTableRow) => {
    setPermUserId(user.id);
    setPermUserName(user.full_name || user.name);
    setPermUserRole(user.roles?.[0] || user.role || "");
    setIsPermModalOpen(true);
    setLoadingPerms(true);
    try {
      const res = await userService.getUserPermissions(user.id);
      const codes = extractPermissionCodes(res);
      setUserDirectPerms(codes);
    } catch {
      setUserDirectPerms([]);
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleGrantUserPerm = async (code: string) => {
    if (!permUserId || !code.trim()) return;
    try {
      setIsSubmitting(true);
      await userService.grantUserPermission(permUserId, code.trim());
      addToast(`Granted direct permission "${code.trim()}" to ${permUserName}`, "success");
      const res = await userService.getUserPermissions(permUserId);
      setUserDirectPerms(extractPermissionCodes(res));
      setCustomPermCode("");
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to grant user permission."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeUserPerm = async (code: string) => {
    if (!permUserId || !code) return;
    try {
      setIsSubmitting(true);
      await userService.revokeUserPermission(permUserId, code);
      addToast(`Revoked direct permission "${code}" from ${permUserName}`, "success");
      const res = await userService.getUserPermissions(permUserId);
      setUserDirectPerms(extractPermissionCodes(res));
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to revoke user permission."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserActiveStatus = async (user: UserTableRow) => {
    try {
      setIsSubmitting(true);
      const currentActive = user.is_active ?? user.isActive;
      const newStatus = !currentActive;
      await userService.updateUser(user.id, { is_active: newStatus });
      addToast(`Account status for ${user.full_name || user.name} set to ${newStatus ? "Active" : "Inactive"}.`, "success");
      setSelectedUserProfile((prev) => (prev ? { ...prev, isActive: newStatus, is_active: newStatus, status: newStatus ? "Active" : "Inactive" } : null));
      fetchUsers();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to update account status."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch users function
  const fetchUsers = useCallback(async () => {
    try {
      setError(null);

      const response = await userService.getUsers();
      const rawBody = response as unknown;
      const rawData = (rawBody as { data?: unknown })?.data;
      const rawItems = (rawData as { items?: unknown })?.items;
      let userList = Array.isArray(rawBody)
        ? (rawBody as UserPayload[])
        : Array.isArray(rawData)
        ? (rawData as UserPayload[])
        : Array.isArray(rawItems)
        ? (rawItems as UserPayload[])
        : [];

      // Enforce Rescue Centre scope when accessed by Rescue Centre Admin
      if (isRescueCentreAdmin) {
        userList = userList.filter((user: UserPayload) => {
          const roles = Array.isArray(user.roles)
            ? user.roles
            : Array.isArray(user.role_names)
            ? user.role_names
            : user.role
            ? [user.role]
            : [];

          const hasRescueRole = roles.some((r) => {
            const norm = normalizeRole(r) || String(r).toLowerCase().trim();
            return RESCUE_PERMITTED_ROLES.includes(norm);
          });

          if (!hasRescueRole) return false;

          const uCentreId = user.rescue_centre_id || (user as any).rescue_center_id || (user as any).facility_id || (user as any).organization_id;
          if (uCentreId && currentRescueCentreId && String(uCentreId) !== String(currentRescueCentreId)) {
            return false;
          }

          return true;
        });
      }

      // Enforce Shelter Manager scope when accessed by Shelter Manager
      if (isShelterManager) {
        userList = userList.filter((user: UserPayload) => {
          const roles = Array.isArray(user.roles)
            ? user.roles
            : Array.isArray(user.role_names)
            ? user.role_names
            : user.role
            ? [user.role]
            : [];

          const hasShelterRole = roles.some((r) => {
            const norm = normalizeRole(r) || String(r).toLowerCase().trim();
            // Exclude unrelated system roles
            const isUnrelated = [
              "super_admin",
              "rescue_centre_admin",
              "rescue_coordinator",
              "rescue_agent",
              "veterinarian",
              "adoption_coordinator",
              "foster_coordinator",
              "volunteer_coordinator",
              "inventory_manager",
              "finance_user",
              "volunteer"
            ].includes(norm);
            return !isUnrelated;
          });

          if (!hasShelterRole) return false;

          const uShelterId = user.rescue_centre_id || (user as any).rescue_center_id || (user as any).shelter_id || (user as any).shelterId || (user as any).facility_id || (user as any).facilityId || (user as any).organization_id;
          if (uShelterId && currentShelterId && String(uShelterId) !== String(currentShelterId)) {
            return false;
          }

          return true;
        });
      }

      const formattedUsers = userList.map((user: UserPayload): UserTableRow => {
        const roles = Array.isArray(user.roles)
          ? user.roles
          : Array.isArray(user.role_names)
          ? user.role_names
          : user.role
          ? [user.role]
          : [];

        const rawStatusStr = String(user.status || "").toLowerCase().trim();
        const computedAppStatus: "pending" | "approved" | "rejected" =
          (rawStatusStr === "approved" || rawStatusStr === "active" || user.is_verified === true)
            ? "approved"
            : (rawStatusStr === "rejected" || rawStatusStr === "declined" ? "rejected" : "pending");

        const computedLastLogin =
          user.last_login ||
          user.last_login_at ||
          user.lastLogin ||
          user.lastLoginAt ||
          user.last_seen ||
          user.last_authenticated_at ||
          (user.updated_at && user.created_at && user.updated_at !== user.created_at ? user.updated_at : null);

        return {
          id: resolveUserId(user as unknown as Record<string, unknown>) || user.id || "-",
          name: user.full_name || user.name || "Not provided",
          full_name: user.full_name || user.name || null,
          email: user.email || "Not provided",
          phone: user.phone !== undefined && user.phone !== null && String(user.phone).trim() ? String(user.phone) : null,
          roles,
          role: roles.length > 0 ? roles.join(", ") : user.role || "general_public",
          isActive: user.is_active !== undefined ? user.is_active : (user.status === "Active"),
          is_active: user.is_active !== undefined ? user.is_active : (user.status === "Active"),
          isVerified: user.is_verified !== undefined ? user.is_verified : false,
          is_verified: user.is_verified !== undefined ? user.is_verified : false,
          mfaEnabled: user.mfa_enabled !== undefined ? user.mfa_enabled : false,
          mfa_enabled: user.mfa_enabled !== undefined ? user.mfa_enabled : false,
          createdAt: user.created_at || "",
          created_at: user.created_at || "",
          updatedAt: user.updated_at || "",
          updated_at: user.updated_at || "",
          lastLogin: computedLastLogin,
          last_login: computedLastLogin,
          direct_permissions: user.direct_permissions || [],
          status: user.is_active !== undefined ? (user.is_active ? "Active" : "Inactive") : (user.status === "Active" ? "Active" : "Inactive"),
          appStatus: computedAppStatus,
          rejection_reason: user.rejection_reason || null,
        };
      });

      const sortedFormattedUsers = formattedUsers.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setUsers(sortedFormattedUsers);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load registered users. Please check permissions."));
    } finally {
      setLoading(false);
    }
  }, [isRescueCentreAdmin, currentRescueCentreId, isShelterManager, currentShelterId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) {
      addToast("Please fill in required fields (Full Name & Email)", "error");
      return;
    }
    if (isRescueCentreAdmin) {
      if (!RESCUE_PERMITTED_ROLES.includes(formData.role)) {
        addToast("Access Denied: Rescue Centre Admins can only onboard rescue personnel.", "error");
        return;
      }
    } else if (isShelterManager) {
      if (formData.role !== "shelter_manager") {
        addToast("Access Denied: Shelter Managers can only onboard shelter manager staff.", "error");
        return;
      }
    } else if (!isSuperAdmin && formData.role === "super_admin") {
      addToast("Access Denied: Only a Super Administrator can assign Super Admin privileges.", "error");
      return;
    }
    if (formData.password && formData.password.length < 10) {
      addToast("Password must be at least 10 characters long.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const password = formData.password || generatePassword();
      const createPayload: UserPayload = {
        full_name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        password,
      };
      if (isRescueCentreAdmin && currentRescueCentreId) {
        createPayload.rescue_centre_id = currentRescueCentreId;
      } else if (isShelterManager && currentShelterId) {
        createPayload.rescue_centre_id = currentShelterId;
        (createPayload as any).facility_id = currentShelterId;
        (createPayload as any).shelter_id = currentShelterId;
      }
      await userService.createUser(createPayload);
      addToast(`User ${formData.name} provisioned successfully!`, "success");
      setIsAddModalOpen(false);
      setFormData({ name: "", email: "", role: "rescue_agent", password: "" });
      fetchUsers();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to provision user."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!isSuperAdmin && (formData.role.includes("super_admin") || selectedUser.roles.includes("super_admin"))) {
      addToast("Access Denied: Only a Super Administrator can modify Super Admin accounts or roles.", "error");
      return;
    }
    if (isShelterManager) {
      if (formData.role !== "shelter_manager") {
        addToast("Access Denied: Shelter Managers can only assign shelter manager staff role.", "error");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await userService.updateUser(selectedUser.id, {
        full_name: formData.name.trim(),
        role_names: parseRoleNames(formData.role),
      });
      addToast(`User ${formData.name} updated successfully!`, "success");
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to update user."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const targetUserId = resolveUserId(selectedUser);
    if (!targetUserId) {
      addToast("Cannot delete user account: Valid user UUID not found.", "error");
      return;
    }
    if (!isSuperAdmin && selectedUser.roles.includes("super_admin")) {
      addToast("Access Denied: Super Admin accounts cannot be deleted by non-Super Admins.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await userService.deleteUser(targetUserId);
      addToast(`User ${selectedUser.name || "account"} deleted successfully!`, "success");
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      setSelectedUserProfile(null);
      fetchUsers();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to delete user."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRoleFilterOptions = isRescueCentreAdmin
    ? RESCUE_ROLE_FILTER_OPTIONS
    : isShelterManager
    ? SHELTER_ROLE_FILTER_OPTIONS
    : ROLE_FILTER_OPTIONS;

  const matchesRoleFilter = useCallback(
    (userRoles: string[], filterValue: string): boolean => {
      if (filterValue === "all") return true;
      const option = activeRoleFilterOptions.find((opt) => opt.value === filterValue);
      if (!option || option.backendRoles.length === 0) return true;
      return userRoles.some((role) => option.backendRoles.includes(normalizeRole(role) || role));
    },
    [activeRoleFilterOptions]
  );

  // Partition users into legitimate internal staff vs public website users
  const staffUsers = useMemo(() => {
    if (isRescueCentreAdmin) {
      return users.filter((u) => u.roles.some((r) => RESCUE_PERMITTED_ROLES.includes(normalizeRole(r) || String(r).toLowerCase().trim())));
    }
    if (isShelterManager) {
      return users.filter((u) => u.roles.some((r) => {
        const norm = normalizeRole(r) || String(r).toLowerCase().trim();
        return norm === "shelter_manager";
      }));
    }
    return users.filter((u) => hasAdminPortalAccess(u.roles));
  }, [users, isRescueCentreAdmin, isShelterManager]);

  const publicUsers = useMemo(() => {
    if (isRescueCentreAdmin || isShelterManager) return [];
    return users.filter((u) => !hasAdminPortalAccess(u.roles));
  }, [users, isRescueCentreAdmin, isShelterManager]);

  // Statistics cards dynamically calculated from backend data
  const stats = useMemo(() => {
    if (isRescueCentreAdmin) {
      return [
        {
          title: "Total Rescue Staff",
          value: loading ? "..." : `${staffUsers.length} Staff`,
          trend: "Rescue Centre Personnel",
          color: "#1E3A8A",
          icon: <FaUsers />,
          onClick: () => {
            setActiveFilter("staff");
            setRoleFilter("all");
            setStatusFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && roleFilter === "all" && statusFilter === "all" && !searchTerm,
        },
        {
          title: "Active Rescue Staff",
          value: loading ? "..." : `${staffUsers.filter((u) => u.isActive).length} Active`,
          trend: "Operational Access Enabled",
          color: "#15803D",
          icon: <FaCheckCircle />,
          onClick: () => {
            setActiveFilter("staff");
            setStatusFilter("active");
            setRoleFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && statusFilter === "active",
        },
        {
          title: "Inactive Rescue Staff",
          value: loading ? "..." : `${staffUsers.filter((u) => !u.isActive).length} Inactive`,
          trend: "Access Suspended",
          color: "#DC2626",
          icon: <FaTimesCircle />,
          onClick: () => {
            setActiveFilter("staff");
            setStatusFilter("inactive");
            setRoleFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && statusFilter === "inactive",
        },
        {
          title: "Rescue Admins",
          value: loading ? "..." : `${staffUsers.filter((u) => u.roles.some((r) => normalizeRole(r) === "rescue_centre_admin")).length} Admins`,
          trend: "Centre Administrators",
          color: "#1E3A8A",
          icon: <FaUserShield />,
          onClick: () => {
            setActiveFilter("staff");
            setRoleFilter("rescue_centre_admin");
            setStatusFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && roleFilter === "rescue_centre_admin",
        },
      ];
    }

    if (isShelterManager) {
      return [
        {
          title: "Total Shelter Staff",
          value: loading ? "..." : `${staffUsers.length} Staff`,
          trend: "Shelter Personnel",
          color: "#1E3A8A",
          icon: <FaUsers />,
          onClick: () => {
            setActiveFilter("staff");
            setRoleFilter("all");
            setStatusFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && roleFilter === "all" && statusFilter === "all" && !searchTerm,
        },
        {
          title: "Active Shelter Staff",
          value: loading ? "..." : `${staffUsers.filter((u) => u.isActive).length} Active`,
          trend: "Operational Access Enabled",
          color: "#15803D",
          icon: <FaCheckCircle />,
          onClick: () => {
            setActiveFilter("staff");
            setStatusFilter("active");
            setRoleFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && statusFilter === "active",
        },
        {
          title: "Inactive Shelter Staff",
          value: loading ? "..." : `${staffUsers.filter((u) => !u.isActive).length} Inactive`,
          trend: "Access Suspended",
          color: "#DC2626",
          icon: <FaTimesCircle />,
          onClick: () => {
            setActiveFilter("staff");
            setStatusFilter("inactive");
            setRoleFilter("all");
            setSearchTerm("");
            document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          selected: activeFilter === "staff" && statusFilter === "inactive",
        },
      ];
    }

    return [
      {
        title: "Total Users",
        value: loading ? "..." : `${users.length} Total Users`,
        trend: "Master Identity Directory",
        color: "#1E3A8A",
        icon: <FaUsers />,
        onClick: () => {
          setActiveFilter("all");
          setRoleFilter("all");
          setStatusFilter("all");
          setSearchTerm("");
          document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        selected: activeFilter === "all" && roleFilter === "all" && statusFilter === "all" && !searchTerm,
      },
      {
        title: "Admin Portal Users",
        value: loading ? "..." : `${staffUsers.length} Staff`,
        trend: "Authorized Internal Staff Roles",
        color: "#1E3A8A",
        icon: <FaUserShield />,
        onClick: () => {
          setActiveFilter("staff");
          setRoleFilter("all");
          setStatusFilter("all");
          setSearchTerm("");
          document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        selected: activeFilter === "staff" && roleFilter === "all" && statusFilter === "all" && !searchTerm,
      },
      {
        title: "Public Users",
        value: loading ? "..." : `${publicUsers.length} Users`,
        trend: "Community & External Accounts",
        color: "#475569",
        icon: <FaUsers />,
        onClick: () => {
          setActiveFilter("public");
          setRoleFilter("all");
          setStatusFilter("all");
          setSearchTerm("");
          document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        selected: activeFilter === "public" && roleFilter === "all" && statusFilter === "all" && !searchTerm,
      },
      {
        title: "Inactive Users",
        value: loading ? "..." : `${users.filter((u) => !u.isActive && !u.is_active).length} Inactive`,
        trend: "Deactivated Accounts",
        color: "#DC2626",
        icon: <FaTimesCircle />,
        onClick: () => {
          setStatusFilter("inactive");
          setSearchTerm("");
          document.getElementById("users-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        selected: statusFilter === "inactive",
      },
    ];
  }, [users, staffUsers, publicUsers, loading, activeFilter, roleFilter, statusFilter, searchTerm, isRescueCentreAdmin, isShelterManager]);

  // Table rows filtered according to active filter tab, role filter, status filter, and search
  const filteredUsers = useMemo(() => {
    const baseList =
      activeFilter === "public"
        ? publicUsers
        : activeFilter === "all"
        ? users
        : staffUsers;

    return baseList.filter((u) => {
      if (!matchesRoleFilter(u.roles, roleFilter)) {
        return false;
      }
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !u.isActive) return false;
        if (statusFilter === "inactive" && u.isActive) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = (u.name || "").toLowerCase().includes(term);
        const emailMatch = (u.email || "").toLowerCase().includes(term);
        const idMatch = (u.id || "").toLowerCase().includes(term);
        const phoneMatch = Boolean(u.phone && String(u.phone).toLowerCase().includes(term));
        const roleMatch = u.roles.some((r) => r.toLowerCase().includes(term));
        return nameMatch || emailMatch || idMatch || phoneMatch || roleMatch;
      }
      return true;
    });
  }, [users, staffUsers, publicUsers, activeFilter, roleFilter, statusFilter, searchTerm, matchesRoleFilter]);

  const getTableTitle = () => {
    if (isRescueCentreAdmin) {
      if (roleFilter !== "all") {
        const option = RESCUE_ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter);
        if (option) return `${option.label} Personnel`;
      }
      if (statusFilter === "active") return "Active Rescue Centre Personnel";
      if (statusFilter === "inactive") return "Inactive Rescue Centre Personnel";
      return "Rescue Centre Personnel & Staff";
    }

    if (isShelterManager) {
      if (roleFilter !== "all") {
        const option = SHELTER_ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter);
        if (option) return `${option.label} Staff`;
      }
      if (statusFilter === "active") return "Active Shelter Staff";
      if (statusFilter === "inactive") return "Inactive Shelter Staff";
      return "Shelter Staff Accounts";
    }

    if (activeFilter === "all") {
      if (roleFilter !== "all") {
        const option = ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter);
        if (option) return `${option.label} Accounts (Master Directory)`;
      }
      if (statusFilter === "active") return "Active User Accounts (Master Directory)";
      if (statusFilter === "inactive") return "Inactive User Accounts (Master Directory)";
      return "All User Accounts";
    }

    if (activeFilter === "public") {
      if (roleFilter !== "all") {
        const option = ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter);
        if (option) return `${option.label} Public Accounts`;
      }
      if (statusFilter === "active") return "Active Public & Community Accounts";
      if (statusFilter === "inactive") return "Inactive Public & Community Accounts";
      return "Public & Community Accounts";
    }

    if (roleFilter !== "all") {
      const option = ROLE_FILTER_OPTIONS.find((opt) => opt.value === roleFilter);
      if (option) return `${option.label} Staff Accounts`;
    }
    if (statusFilter === "active") return "Active Internal Staff Accounts";
    if (statusFilter === "inactive") return "Inactive Internal Staff Accounts";
    return "Internal Admin & Staff Accounts";
  };

  const columns = [
    { key: "id", title: "User ID" },
    { key: "name", title: "Full Name" },
    { key: "email", title: "Email Address" },
    {
      key: "phone",
      title: "Phone",
      render: (val: string | null) => (val && val.trim() ? val : "Not provided"),
    },
    {
      key: "roles",
      title: "Assigned Role",
      render: (_val: string, row: UserTableRow) => formatRoles(row.roles),
    },
    {
      key: "isActive",
      title: "Account Status",
      render: (val: boolean) => (
        <span
          style={{
            background: val ? "#EFF6FF" : "#FEF2F2",
            color: val ? "#1E40AF" : "#991B1B",
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
            display: "inline-block",
            textTransform: "capitalize",
          }}
        >
          {val ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "createdAt",
      title: "Created At",
      render: (val: string) => (val ? formatDate(val) : "Not available"),
    },
    {
      key: "lastLogin",
      title: "Last Login",
      render: (_val: unknown, row: UserTableRow) => {
        const val = row.lastLogin || row.last_login || row.last_login_at || row.last_seen;
        return val && String(val).trim() ? (
          formatDate(String(val))
        ) : (
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>Not available</span>
        );
      },
    },
  ];

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "24px", borderRadius: "12px", maxWidth: "600px", margin: "0 auto" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700 }}>Access Restricted</h3>
          <p style={{ margin: 0, fontSize: "14px", color: "#7F1D1D" }}>
            Rescue Centre Admin users are not authorized to access Staff & Users management. Contact a Super Administrator to manage user accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header Banner */}
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
          {isRescueCentreAdmin ? "Staff & Users" : isShelterManager ? "Shelter Staff" : "User Management & Personnel"}
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          {isRescueCentreAdmin
            ? "Manage Rescue Centre personnel, roles, and access."
            : isShelterManager
            ? "Manage shelter personnel, roles, and access."
            : "Manage PawGuard internal user accounts, staff roles, permissions, and Admin Portal access."}
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

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <Can permission="create_users">
          <QuickActionCard
            icon={<FaUserPlus />}
            title="Provision User Account"
            subtitle="Onboard new staff member"
            color="#2563EB"
            onClick={() => {
              setFormData({ name: "", email: "", role: "rescue_agent", password: "" });
              setIsAddModalOpen(true);
            }}
          />
        </Can>

        <Can permission="manage_permissions">
          <QuickActionCard
            icon={<FaUserShield />}
            title="Manage Role Access"
            subtitle="Update user permissions"
            color="#6366F1"
            onClick={() => {
              addToast("Opening role permission management matrix", "info");
              window.location.href = "/roles-permissions";
            }}
          />
        </Can>
      </div>

      {/* Dynamic Statistics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* Main Table Card */}
      <div className="soft-card" style={{ padding: "20px" }}>
        {/* Segmented Control Tabs for Super Admin */}
        {isSuperAdmin && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "18px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => { setActiveFilter("all"); setPage(1); }}
              style={{
                padding: "8px 18px",
                borderRadius: "7px",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                background: activeFilter === "all" ? "#2563EB" : "transparent",
                color: activeFilter === "all" ? "#FFFFFF" : "#64748B",
                boxShadow: activeFilter === "all" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              All User Accounts ({users.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveFilter("staff"); setPage(1); }}
              style={{
                padding: "8px 18px",
                borderRadius: "7px",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                background: activeFilter === "staff" ? "#2563EB" : "transparent",
                color: activeFilter === "staff" ? "#FFFFFF" : "#64748B",
                boxShadow: activeFilter === "staff" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Internal Admin &amp; Staff ({staffUsers.length})
            </button>
            <button
              type="button"
              onClick={() => { setActiveFilter("public"); setPage(1); }}
              style={{
                padding: "8px 18px",
                borderRadius: "7px",
                border: "none",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                background: activeFilter === "public" ? "#2563EB" : "transparent",
                color: activeFilter === "public" ? "#FFFFFF" : "#64748B",
                boxShadow: activeFilter === "public" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Public &amp; Community ({publicUsers.length})
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              {getTableTitle()}
            </h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Status Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#0F172A",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Role Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setSearchTerm("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#0F172A",
                  cursor: "pointer",
                  minWidth: "180px",
                }}
              >
                {activeRoleFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {(roleFilter !== "all" || statusFilter !== "all" || searchTerm || activeFilter !== (isSuperAdmin ? "all" : "staff")) && (
              <button
                onClick={() => {
                  setActiveFilter(isSuperAdmin ? "all" : "staff");
                  setRoleFilter("all");
                  setStatusFilter("all");
                  setSearchTerm("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F1F5F9",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reset Filters
              </button>
            )}

            {loading && (
              <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>
                Loading...
              </span>
            )}
          </div>
        </div>

        <div id="users-table">
          <DataTable
            columns={columns}
            data={filteredUsers.slice((page - 1) * 15, page * 15)}
            module="users"
            serverMode={true}
            totalCount={filteredUsers.length}
            page={page}
            pageSize={15}
            onPageChange={setPage}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            onRowClick={(row) => {
              void handleOpenUserProfile(row as UserTableRow);
            }}
            onView={(row) => {
              void handleOpenUserProfile(row as UserTableRow);
            }}
            onEdit={(row) => {
              const target = row as UserTableRow;
              if (!isSuperAdmin && target.roles.includes("super_admin")) {
                addToast("Access Denied: Only a Super Administrator can edit Super Admin accounts.", "error");
                return;
              }
              if (isShelterManager) {
                const uShelterId = target.rescue_centre_id || (target as any).rescue_center_id || target.shelter_id || (target as any).shelterId || (target as any).facility_id || (target as any).facilityId || (target as any).organization_id;
                if (uShelterId && currentShelterId && String(uShelterId) !== String(currentShelterId)) {
                  addToast("Access Denied: You can only edit staff from your own shelter.", "error");
                  return;
                }
              }
              setSelectedUser(target);
              setFormData({
                name: target.full_name || target.name || "",
                email: target.email || "",
                role: target.roles?.[0] || target.role || "rescue_agent",
                password: "",
              });
              setIsEditModalOpen(true);
            }}
            onDelete={(row) => {
              const target = row as UserTableRow;
              if (!isSuperAdmin && target.roles.includes("super_admin")) {
                addToast("Access Denied: Only a Super Administrator can delete Super Admin accounts.", "error");
                return;
              }
              if (isShelterManager) {
                const uShelterId = target.rescue_centre_id || (target as any).rescue_center_id || target.shelter_id || (target as any).shelterId || (target as any).facility_id || (target as any).facilityId || (target as any).organization_id;
                if (uShelterId && currentShelterId && String(uShelterId) !== String(currentShelterId)) {
                  addToast("Access Denied: You can only delete staff from your own shelter.", "error");
                  return;
                }
              }
              setSelectedUser(target);
              setIsDeleteModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* User Profile & Credentials Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedUserProfile(null);
          setIsResetTokenFormOpen(false);
          setResetToken("");
          setNewPassword("");
        }}
        title={`User Profile — ${selectedUserProfile?.full_name || selectedUserProfile?.name || "Details"}`}
      >
        {profileLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "#64748B" }}>
            Loading user profile from API...
          </div>
        ) : selectedUserProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header Badge Card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                padding: "16px",
                borderRadius: "12px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(selectedUserProfile.full_name || selectedUserProfile.name || "U").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                  {selectedUserProfile.full_name || selectedUserProfile.name || "Not provided"}
                </h3>
                <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "#EFF6FF",
                      color: "#1E40AF",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {formatRole(selectedUserProfile.roles?.[0] || selectedUserProfile.role || "general_public")}
                  </span>
                  <span
                    style={{
                      background: (selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#DCFCE7" : "#FEE2E2",
                      color: (selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#166534" : "#991B1B",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {(selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "Active" : "Inactive"}
                  </span>
                  {(() => {
                    const statusKey = getUserApprovalStatus(selectedUserProfile);
                    const badgeStyle =
                      statusKey === "approved"
                        ? { bg: "#DCFCE7", color: "#166534", label: "Approved" }
                        : statusKey === "rejected"
                        ? { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" }
                        : { bg: "#FEF3C7", color: "#B45309", label: "Pending Approval" };
                    return (
                      <span
                        style={{
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          padding: "2px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {badgeStyle.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>



            {/* Profile Details Grid */}
            <div>
              <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Account Overview &amp; API Details
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Full Name</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {selectedUserProfile.full_name || selectedUserProfile.name || "Not provided"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Email Address</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563EB", marginTop: "2px" }}>
                    {selectedUserProfile.email || "Not provided"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Phone Number</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {selectedUserProfile.phone && String(selectedUserProfile.phone).trim() ? selectedUserProfile.phone : "Not provided"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Assigned Role</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {selectedUserProfile.roles && selectedUserProfile.roles.length > 0
                      ? selectedUserProfile.roles.map(formatRole).join(", ")
                      : formatRole(selectedUserProfile.role || "general_public")}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Account Status</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: (selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#16A34A" : "#DC2626", marginTop: "2px" }}>
                    {(selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "Active" : "Inactive"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Verification</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: (selectedUserProfile.is_verified ?? selectedUserProfile.isVerified) ? "#16A34A" : "#64748B", marginTop: "2px" }}>
                    {(selectedUserProfile.is_verified ?? selectedUserProfile.isVerified) ? "Verified" : "Unverified"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>MFA</label>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: (selectedUserProfile.mfa_enabled ?? selectedUserProfile.mfaEnabled) ? "#16A34A" : "#64748B", marginTop: "2px" }}>
                    {(selectedUserProfile.mfa_enabled ?? selectedUserProfile.mfaEnabled) ? "Enabled" : "Disabled"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>User ID (UUID)</label>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#475569", marginTop: "2px", wordBreak: "break-all" }}>
                    {selectedUserProfile.id || "Not available"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Created Date</label>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#334155", marginTop: "2px" }}>
                    {(selectedUserProfile.created_at || selectedUserProfile.createdAt) ? formatDateTime(String(selectedUserProfile.created_at || selectedUserProfile.createdAt)) : "Not available"}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Last Login</label>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#94A3B8", marginTop: "2px" }}>
                    Not available
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Direct Permissions</label>
                  {selectedUserProfile.direct_permissions && selectedUserProfile.direct_permissions.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                      {selectedUserProfile.direct_permissions.map((code) => (
                        <span key={code} style={{ background: "#F1F5F9", color: "#334155", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontFamily: "monospace" }}>
                          {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#94A3B8", fontStyle: "italic", marginTop: "2px" }}>
                      None (Role default permissions apply)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* APPLICATIONS & REQUESTS Section */}
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaClipboardList size={14} color="#2563EB" /> APPLICATIONS &amp; REQUESTS ({userApplications.length})
                </h4>
                <button
                  type="button"
                  onClick={() => selectedUserProfile && void handleOpenUserProfile(selectedUserProfile)}
                  disabled={applicationsLoading}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {applicationsLoading ? "Refreshing..." : "Refresh List"}
                </button>
              </div>

              {applicationsLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  Searching volunteer, foster, adoption, lost/found, and rescue databases...
                </div>
              ) : userApplications.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1", color: "#64748B", fontSize: "13px" }}>
                  No applications or requests have been submitted by this user.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {userApplications.map((app) => {
                    const isPending = app.status === "pending";
                    const isApproved = app.status === "approved";
                    const isCompleted = app.status === "completed";
                    return (
                      <div
                        key={app.id}
                        style={{
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", background: "#E2E8F0", color: "#334155", padding: "2px 8px", borderRadius: "4px" }}>
                              {app.type.replace("_", " ")}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: "2px 10px",
                                borderRadius: "999px",
                                background: isPending ? "#FEF3C7" : isApproved ? "#DCFCE7" : isCompleted ? "#DBEAFE" : "#FEE2E2",
                                color: isPending ? "#B45309" : isApproved ? "#15803D" : isCompleted ? "#1E40AF" : "#B91C1C",
                              }}
                            >
                              {app.statusLabel}
                            </span>
                          </div>
                          <h5 style={{ margin: "6px 0 2px", fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                            {app.title}
                          </h5>
                          {app.subtitle && <div style={{ fontSize: "12px", color: "#475569" }}>{app.subtitle}</div>}
                          <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                            Submitted: {formatDateTime(app.submittedAt)}
                            {app.updatedAt && <span> &bull; Last Updated: {formatDateTime(app.updatedAt)}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApplicationDetail(app);
                            setIsAppDetailModalOpen(true);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            background: "#2563EB",
                            color: "#FFFFFF",
                            border: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          View Application
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account Operations Section */}
            <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "12px", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                Account Operations &amp; Resource Access
              </h4>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleRequestPasswordReset}
                  disabled={isResettingPassword}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isResettingPassword ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaKey size={13} /> {isResettingPassword ? "Initializing Reset..." : "Set / Reset Login Password"}
                </button>

                <button
                  type="button"
                  onClick={() => openUserDirectPermissions(selectedUserProfile)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    background: "#F5F3FF",
                    color: "#6D28D9",
                    border: "1px solid #DDD6FE",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaUserShield size={13} /> Direct Permission Overrides
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isSuperAdmin && selectedUserProfile.roles.includes("super_admin")) {
                      addToast("Access Denied: Only a Super Administrator can edit Super Admin accounts.", "error");
                      return;
                    }
                    setSelectedUser(selectedUserProfile);
                    setFormData({
                      name: selectedUserProfile.full_name || selectedUserProfile.name || "",
                      email: selectedUserProfile.email || "",
                      role: selectedUserProfile.roles?.[0] || selectedUserProfile.role || "rescue_agent",
                      password: "",
                    });
                    setIsProfileModalOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    border: "1px solid #BFDBFE",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaEdit size={13} /> Edit User Profile
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleUserActiveStatus(selectedUserProfile)}
                  disabled={isSubmitting}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    background: (selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#FEF2F2" : "#ECFDF5",
                    color: (selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#991B1B" : "#047857",
                    border: `1px solid ${(selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "#FCA5A5" : "#A7F3D0"}`,
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaBan size={13} /> {(selectedUserProfile.is_active ?? selectedUserProfile.isActive) ? "Deactivate Account" : "Activate Account"}
                </button>

                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetRoles = selectedUserProfile.roles || (selectedUserProfile.role ? [selectedUserProfile.role] : []);
                      const isTargetSuperAdmin = targetRoles.some((r: string) => String(r).toLowerCase().includes("super_admin"));
                      if (isTargetSuperAdmin) {
                        addToast("Access Denied: Only a Super Administrator can delete accounts, but Super Admin accounts cannot be deleted directly.", "error");
                        return;
                      }
                      const targetUserId = resolveUserId(selectedUserProfile);
                      if (!targetUserId) {
                        addToast("Cannot delete user account: Valid user UUID not found.", "error");
                        return;
                      }
                      setSelectedUser({ ...selectedUserProfile, id: targetUserId });
                      setIsProfileModalOpen(false);
                      setIsDeleteModalOpen(true);
                    }}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "8px",
                      background: "#FEF2F2",
                      color: "#DC2626",
                      border: "1px solid #FCA5A5",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FaTrash size={13} /> Delete Account
                  </button>
                )}

                {/* Dynamic Role-Specific Navigation Actions */}
                {(() => {
                  const roleStr = String(selectedUserProfile.roles?.[0] || selectedUserProfile.role || "").toLowerCase().trim();

                  const navBtn = (label: string, path: string, icon: React.ReactNode, bg = "#F1F5F9", fg = "#0F172A", border = "#CBD5E1") => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => {
                        setIsProfileModalOpen(false);
                        navigate(path);
                      }}
                      style={{
                        padding: "9px 16px",
                        borderRadius: "8px",
                        background: bg,
                        color: fg,
                        border: `1px solid ${border}`,
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {icon} {label}
                    </button>
                  );

                  const roleBtns: React.ReactNode[] = [];

                  if (/veterinarian/.test(roleStr)) {
                    roleBtns.push(navBtn("Open Vet Dashboard", "/dashboard/veterinarian", <FaStethoscope size={13} />, "#ECFDF5", "#047857", "#A7F3D0"));
                  } else if (/shelter/.test(roleStr)) {
                    roleBtns.push(navBtn("Open Shelter Manager Dashboard", "/dashboard/shelter-manager", <FaHome size={13} />, "#EFF6FF", "#1D4ED8", "#BFDBFE"));
                  } else if (/rescue_agent|rescue_coordinator|rescue_centre/.test(roleStr)) {
                    roleBtns.push(navBtn("View Rescue Dispatches", "/rescue-dispatch", <FaTruck size={13} />, "#F5F3FF", "#6D28D9", "#DDD6FE"));
                  } else if (/adoption/.test(roleStr)) {
                    roleBtns.push(navBtn("View Adoption Applications", "/adoptions", <FaHeart size={13} />, "#FDF2F8", "#BE185D", "#FBCFE8"));
                  } else if (/foster/.test(roleStr)) {
                    roleBtns.push(navBtn("View Foster Placements", "/fosters", <FaHandHoldingHeart size={13} />, "#FFF7ED", "#C2410C", "#FFEDD5"));
                  } else if (/volunteer/.test(roleStr)) {
                    roleBtns.push(navBtn("View Volunteer Roster", "/volunteers", <FaUserFriends size={13} />, "#FEFCE8", "#A16207", "#FEF08A"));
                  } else if (/inventory/.test(roleStr)) {
                    roleBtns.push(navBtn("View Inventory Suite", "/inventory", <FaBoxes size={13} />, "#F0FDF4", "#15803D", "#BBF7D0"));
                  } else if (/finance/.test(roleStr)) {
                    roleBtns.push(navBtn("View Finance Dashboard", "/dashboard/finance", <FaCoins size={13} />, "#F0FDF4", "#15803D", "#BBF7D0"));
                  }

                  return roleBtns;
                })()}
              </div>

              {/* Confirm Password Reset Form inline if token is generated */}
              {isResetTokenFormOpen && (
                <form onSubmit={handleConfirmPasswordReset} style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E40AF" }}>
                    Enter Password Reset Confirmation Token
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Reset Token (from email / dev log) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Paste reset token string..."
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>New Password (min 10 characters) *</label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setIsResetTokenFormOpen(false)}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#10B981", color: "#FFFFFF", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                    >
                      {isSubmitting ? "Updating Password..." : "Finalize Password Update"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Provision New User Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={isRescueCentreAdmin ? "Provision Rescue Staff Account" : "Provision User Account"}>
        <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Sarah Jenkins"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="sarah.j@pawguard.org"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Assigned System Role *
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#FFFFFF" }}
            >
              {isRescueCentreAdmin ? (
                <>
                  <option value="rescue_agent">Rescue Agent</option>
                  <option value="rescue_coordinator">Rescue Coordinator</option>
                  <option value="rescue_staff">Rescue Staff</option>
                  <option value="rescue_centre_admin">Rescue Centre Admin</option>
                </>
              ) : isShelterManager ? (
                <>
                  <option value="shelter_manager">Shelter Manager</option>
                </>
              ) : (
                <>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Full System Privileges)</option>}
                  <option value="rescue_centre_admin">Rescue Centre Admin</option>
                  <option value="rescue_coordinator">Rescue Coordinator</option>
                  <option value="rescue_agent">Rescue Agent</option>
                  <option value="veterinarian">Veterinarian</option>
                  <option value="shelter_manager">Shelter Manager</option>
                  <option value="adoption_coordinator">Adoption Coordinator</option>
                  <option value="foster_coordinator">Foster Coordinator</option>
                  <option value="volunteer_coordinator">Volunteer Coordinator</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="finance_user">Finance Officer</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Initial Password (Optional — min 10 chars, auto-generated if left empty)
            </label>
            <PasswordInput
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Provisioning..." : "Provision Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Account Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User Account Details">
        <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Assigned System Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#FFFFFF" }}
            >
              {isRescueCentreAdmin ? (
                <>
                  <option value="rescue_agent">Rescue Agent</option>
                  <option value="rescue_coordinator">Rescue Coordinator</option>
                  <option value="rescue_staff">Rescue Staff</option>
                  <option value="rescue_centre_admin">Rescue Centre Admin</option>
                </>
              ) : isShelterManager ? (
                <>
                  <option value="shelter_manager">Shelter Manager</option>
                </>
              ) : (
                <>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Full System Privileges)</option>}
                  <option value="rescue_centre_admin">Rescue Centre Admin</option>
                  <option value="rescue_coordinator">Rescue Coordinator</option>
                  <option value="rescue_agent">Rescue Agent</option>
                  <option value="veterinarian">Veterinarian</option>
                  <option value="shelter_manager">Shelter Manager</option>
                  <option value="adoption_coordinator">Adoption Coordinator</option>
                  <option value="foster_coordinator">Foster Coordinator</option>
                  <option value="volunteer_coordinator">Volunteer Coordinator</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="finance_user">Finance Officer</option>
                </>
              )}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Deprovision Account">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the user account for <strong>{selectedUser?.name}</strong> (<code>{selectedUser?.email}</code>)? This action cannot be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontWeight: 600 }}>
              Cancel
            </button>
            <button type="button" onClick={handleDeleteUser} disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              {isSubmitting ? "Deleting..." : "Permanently Delete Account"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Direct Permission Overrides Modal */}
      <Modal isOpen={isPermModalOpen} onClose={() => setIsPermModalOpen(false)} title={`Direct Permissions — ${permUserName}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px 14px", borderRadius: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>{permUserName}</div>
            <div style={{ fontSize: "12px", color: "#64748B" }}>Role: {formatRole(permUserRole)} &bull; User ID: <code>{permUserId}</code></div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>Active Direct Permissions ({userDirectPerms.length})</h4>
            {loadingPerms ? (
              <p style={{ color: "#64748B", fontSize: "13px" }}>Loading direct permissions...</p>
            ) : userDirectPerms.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: "13px", fontStyle: "italic" }}>No direct permission overrides assigned. User inherits role default permissions.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                {userDirectPerms.map((code) => (
                  <li key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F1F5F9", padding: "8px 12px", borderRadius: "6px" }}>
                    <div>
                      <code style={{ fontSize: "12px", fontWeight: 700, color: "#1E293B" }}>{code}</code>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>{describePermission(code)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeUserPerm(code)}
                      disabled={isSubmitting}
                      style={{ border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Grant New Direct Permission Code</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="e.g. create_rescue, view_finance"
                value={customPermCode}
                onChange={(e) => setCustomPermCode(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
              <button
                type="button"
                onClick={() => handleGrantUserPerm(customPermCode)}
                disabled={isSubmitting || !customPermCode.trim()}
                style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#6D28D9", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
              >
                Grant Permission
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* User Application Detail Modal */}
      <UserApplicationDetailModal
        isOpen={isAppDetailModalOpen}
        onClose={() => setIsAppDetailModalOpen(false)}
        application={selectedApplicationDetail}
        userProfile={selectedUserProfile}
        onApplicationUpdated={() => {
          if (selectedUserProfile) {
            void handleOpenUserProfile(selectedUserProfile);
          }
          void fetchUsers();
        }}
      />
    </div>
  );
};

export default Users;