import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaUserCheck,
  FaQrcode,
  FaMapMarkerAlt,
  FaEdit,
  FaKey,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
} from "react-icons/fa";
import { getCurrentUser, getCurrentUserRole, getRoleTitle, isScannerAuthorizedRole } from "../../utils/roleUtils";
import authService from "../../services/auth/authService";
import { clearAuthData, getStoredUser, AUTH_STORAGE_KEYS } from "../../utils/authStorage";
import { notifyAuthChanged, notifyDataChanged } from "../../utils/dataSync";
import { useToast } from "../../context/ToastContext";
import NotificationDropdown from "./NotificationDropdown";
import QrScannerModal from "./QrScannerModal";
import Modal from "../common/Modal";

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  isMobileScreen?: boolean;
  isMobileDrawerOpen?: boolean;
}

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

const getPageTitle = (pathname: string): string => {
  const path = pathname.toLowerCase();

  if (path.includes("/dashboard")) {
    if (path.includes("/super-admin")) return "Super Admin Dashboard";
    if (path.includes("/rescue-centre-admin")) return "Rescue Centre Admin Dashboard";
    if (path.includes("/rescue-coordinator")) return "Rescue Coordinator Dashboard";
    if (path.includes("/rescue-agent")) return "Rescue Agent Dashboard";
    if (path.includes("/veterinarian")) return "Veterinarian Dashboard";
    if (path.includes("/shelter-manager")) return "Shelter Manager Dashboard";
    if (path.includes("/adoption-coordinator")) return "Adoption Coordinator Dashboard";
    if (path.includes("/foster-coordinator")) return "Foster Coordinator Dashboard";
    if (path.includes("/volunteer-coordinator")) return "Volunteer Coordinator Dashboard";
    if (path.includes("/inventory-manager")) return "Inventory Manager Dashboard";
    if (path.includes("/finance")) return "Finance Dashboard";
    if (path.includes("/volunteer")) return "Volunteer Dashboard";
    if (path.includes("/foster-family")) return "Foster Family Dashboard";
    if (path.includes("/donor")) return "Donor Dashboard";
    if (path.includes("/public")) return "General Public Dashboard";
    return "Dashboard";
  }

  if (path.includes("/users")) return "User Management";
  if (path.includes("/rescues")) return "Rescue Management";
  if (path.includes("/rescue-requests")) return "Rescue Requests";
  if (path.includes("/rescue-dispatch")) return "Rescue Dispatch";
  if (path.includes("/pets")) return "Dog Management";
  if (path.includes("/shelter-dogs")) return "Shelter Dogs";
  if (path.includes("/shelters")) return "Shelter Management";
  if (path.includes("/adoptions")) return "Adoption Management";
  if (path.includes("/fosters")) return "Foster Care";
  if (path.includes("/volunteers")) return "Volunteer Management";
  if (path.includes("/medical-records")) return "Medical Examinations";
  if (path.includes("/vet-directory")) return "Veterinary Appointments";
  if (path.includes("/medical-reminders")) return "Vaccinations & Medications";
  if (path.includes("/inventory")) return "Inventory Management";
  if (path.includes("/finance")) return "Donations & Financials";
  if (path.includes("/vehicles")) return "Vehicle Fleet";
  if (path.includes("/lost-and-found")) return "Lost & Found Registry";
  if (path.includes("/reports")) return "Reports & Analytics";
  if (path.includes("/roles-permissions")) return "Roles & Permissions";
  if (path.includes("/cms")) return "Website Management (CMS)";
  if (path.includes("/audit-logs")) return "Audit Trail Logs";
  if (path.includes("/certificates")) return "Health Certificates";
  if (path.includes("/notifications")) return "System Notifications";

  return "PawGuard Platform";
};

const Header = ({
  onToggleSidebar,
  isSidebarCollapsed = false,
  isMobileScreen = false,
}: HeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const user = getCurrentUser();

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Authenticated User Live Profile State
  const [myProfile, setMyProfile] = useState<Record<string, unknown> | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Profile Sub-state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    state: "",
    country: "",
    address: "",
  });

  // Change Password Sub-state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const displayName =
    (myProfile?.full_name as string) ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "Authenticated User";

  const currentRole = getCurrentUserRole();
  const roleTitle = getRoleTitle(currentRole);
  const pageTitle = getPageTitle(location.pathname);

  const handleOpenProfileModal = async () => {
    setIsProfileModalOpen(true);
    setIsEditingProfile(false);
    setIsChangingPassword(false);
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setIsProfileLoading(true);

    try {
      const res = await authService.getMe();
      const profileData = ((res?.data || res) ?? {}) as Record<string, unknown>;
      setMyProfile(profileData);
      setEditProfileForm({
        full_name: String(profileData.full_name || user?.name || ""),
        phone: String(profileData.phone || ""),
        city: String(profileData.city || ""),
        state: String(profileData.state || ""),
        country: String(profileData.country || ""),
        address: String(profileData.address || profileData.address_line || ""),
      });
    } catch {
      setMyProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileForm.full_name.trim()) {
      addToast("Full name is required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: Record<string, unknown> = {
        full_name: editProfileForm.full_name.trim(),
        phone: editProfileForm.phone.trim() || null,
        city: editProfileForm.city.trim() || null,
        state: editProfileForm.state.trim() || null,
        country: editProfileForm.country.trim() || null,
        address: editProfileForm.address.trim() || null,
      };

      const res = await authService.updateProfile(payload);
      const updated = ((res?.data || res) ?? {}) as Record<string, unknown>;
      setMyProfile(updated);

      // Update stored user in storage
      const stored = getStoredUser<Record<string, unknown>>();
      if (stored) {
        const nextUser = {
          ...stored,
          full_name: editProfileForm.full_name.trim(),
          name: editProfileForm.full_name.trim(),
          phone: editProfileForm.phone.trim() || null,
        };
        try {
          sessionStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(nextUser));
          localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(nextUser));
        } catch {
          // Ignore storage errors
        }
      }

      addToast("Profile updated successfully.", "success");
      setIsEditingProfile(false);
      notifyAuthChanged();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update profile."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current_password) {
      addToast("Current password is required.", "error");
      return;
    }
    if (!passwordForm.new_password) {
      addToast("New password is required.", "error");
      return;
    }
    if (passwordForm.new_password.length < 10) {
      addToast("New password must be at least 10 characters long.", "error");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      addToast("New passwords do not match.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.changePassword(
        passwordForm.current_password,
        passwordForm.new_password
      );
      addToast("Password changed successfully.", "success");
      setIsChangingPassword(false);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to change password. Please verify current password."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthData();
      navigate("/");
    }
  };

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: "var(--header-height, 64px)",
          background: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobileScreen ? "0 12px" : "0 24px",
          borderBottom: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        }}
      >
        {/* Left: Sidebar Toggle + Current Page Title ONLY */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobileScreen ? "8px" : "16px", minWidth: 0 }}>
          <button
            onClick={onToggleSidebar}
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            title={isMobileScreen ? "Open Menu" : isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isMobileScreen ? (
              <FaBars size={18} />
            ) : isSidebarCollapsed ? (
              <FaChevronRight size={16} />
            ) : (
              <FaChevronLeft size={16} />
            )}
          </button>

          {/* Clean Page Title */}
          <h2
            style={{
              margin: 0,
              fontSize: isMobileScreen ? "14px" : "16px",
              fontWeight: 700,
              color: "#0F172A",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: isMobileScreen ? "150px" : "320px",
            }}
          >
            {pageTitle}
          </h2>
        </div>

        {/* Right Controls: QR Scanner, Notifications, Settings, Profile & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* QR Scanner Button (Authorized Roles Only) */}
          {isScannerAuthorizedRole(currentRole) && (
            <button
              onClick={() => setIsScannerOpen(true)}
              style={{
                position: "relative",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                transition: "all 0.2s ease",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
              title="Safety Tag QR Scanner"
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#F8FAFC")}
            >
              <FaQrcode size={18} />
            </button>
          )}

          {/* Role-Specific Notifications */}
          <NotificationDropdown />

          <div style={{ width: "1px", height: "24px", background: "#E2E8F0" }} />

          {/* Authenticated User Profile Badge (Clickable) */}
          <div
            onClick={handleOpenProfileModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "8px",
              transition: "background 0.15s ease",
            }}
            title="View My Account & Profile"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              >
                {(displayName || "U").charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#1E3A8A",
                  background: "#EFF6FF",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  display: "inline-block",
                  width: "fit-content",
                }}
              >
                {roleTitle}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: "8px",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#DC2626",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Sign Out"
          >
            <FaSignOutAlt size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Authenticated User Account & Profile Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setIsEditingProfile(false);
          setIsChangingPassword(false);
        }}
        title={
          isEditingProfile
            ? "Edit My Profile"
            : isChangingPassword
            ? "Change My Password"
            : "My Account & Profile"
        }
        maxWidth="620px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Banner */}
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
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#2563EB",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 20,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
              }}
            >
              {(displayName || "U").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  {displayName}
                </h3>
                {myProfile?.is_verified !== false && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#ECFDF5",
                      color: "#059669",
                      border: "1px solid #A7F3D0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <FaCheckCircle size={10} /> Verified
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", fontSize: "12.5px", color: "#64748B", flexWrap: "wrap" }}>
                <span>{String(myProfile?.email || user?.email || "admin@pawguard.org")}</span>
                <span>•</span>
                <span style={{ fontWeight: 700, color: "#2563EB" }}>{roleTitle}</span>
              </div>
            </div>
          </div>

          {isProfileLoading ? (
            <div style={{ padding: "32px", textAlign: "center", color: "#2563EB", fontWeight: 600 }}>
              Loading my account details...
            </div>
          ) : isEditingProfile ? (
            /* Edit Profile Form */
            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={editProfileForm.full_name}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, full_name: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input
                    type="tel"
                    value={editProfileForm.phone}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. +1-555-0100"
                  />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    type="text"
                    value={editProfileForm.city}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, city: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. Hyderabad"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>State / Region</label>
                  <input
                    type="text"
                    value={editProfileForm.state}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, state: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. Telangana"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    type="text"
                    value={editProfileForm.country}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, country: e.target.value })}
                    style={inputStyle}
                    placeholder="e.g. India"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Address Line</label>
                <input
                  type="text"
                  value={editProfileForm.address}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, address: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Sector 4, Rescue Centre Road"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
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
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE", fontSize: "12.5px", color: "#1E40AF" }}>
                Change your account password. The new password must be at least 10 characters long.
              </div>

              <div>
                <label style={labelStyle}>Current Password *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    style={{ ...inputStyle, paddingRight: "40px" }}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                    {showCurrentPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>New Password * (min 10 characters)</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={10}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    style={{ ...inputStyle, paddingRight: "40px" }}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
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
                    {showNewPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Confirm New Password *</label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={10}
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  style={inputStyle}
                  placeholder="Re-enter new password"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
                  }}
                  style={cancelButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordForm.current_password || !passwordForm.new_password || passwordForm.new_password.length < 10}
                  style={{ ...primaryButtonStyle, background: "#10B981" }}
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          ) : (
            /* Default Profile Details Overview */
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                  fontSize: "13px",
                }}
              >
                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Email Address
                  </div>
                  <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {String(myProfile?.email || user?.email || "-")}
                  </div>
                </div>

                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Phone Number
                  </div>
                  <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {String(myProfile?.phone || "Not provided")}
                  </div>
                </div>

                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    User ID (UUID)
                  </div>
                  <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-all", fontFamily: "monospace", fontSize: "12px" }}>
                    {String(myProfile?.id || user?.id || "-")}
                  </div>
                </div>

                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Internal Role Code
                  </div>
                  <div style={{ fontWeight: 700, color: "#2563EB", marginTop: "2px", fontFamily: "monospace" }}>
                    {currentRole || "super_admin"}
                  </div>
                </div>

                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Session Status
                  </div>
                  <div style={{ fontWeight: 600, color: "#16A34A", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaUserCheck size={12} /> Active JWT Session
                  </div>
                </div>

                <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    Two-Factor Auth (MFA)
                  </div>
                  <div style={{ fontWeight: 600, color: myProfile?.mfa_enabled ? "#16A34A" : "#64748B", marginTop: "2px" }}>
                    {myProfile?.mfa_enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>

                {Boolean(myProfile?.city || myProfile?.state || myProfile?.country) && (
                  <div style={{ padding: "10px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", gridColumn: "span 2" }}>
                    <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                      Location
                    </div>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FaMapMarkerAlt size={12} style={{ color: "#EF4444" }} />
                      {[String(myProfile?.address || myProfile?.address_line || ""), String(myProfile?.city || ""), String(myProfile?.state || ""), String(myProfile?.country || "")].filter(Boolean).join(", ")}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
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
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    style={cancelButtonStyle}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      ...primaryButtonStyle,
                      background: "#DC2626",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      padding: "8px 14px",
                    }}
                  >
                    <FaSignOutAlt /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* PawGuard Safety Tag QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  fontSize: 13.5,
  boxSizing: "border-box",
  background: "#FFFFFF",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  background: "#F1F5F9",
  color: "#334155",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#2563EB",
  color: "#FFFFFF",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

export default Header;