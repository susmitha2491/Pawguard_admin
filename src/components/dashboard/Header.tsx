import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaUserCheck,
  FaShieldAlt,
  FaEnvelope,
  FaQrcode,
} from "react-icons/fa";
import { getCurrentUser, getCurrentUserRole, getRoleTitle, isScannerAuthorizedRole } from "../../utils/roleUtils";
import authService from "../../services/auth/authService";
import { clearAuthData } from "../../utils/authStorage";
import NotificationDropdown from "./NotificationDropdown";
import QrScannerModal from "./QrScannerModal";
import Modal from "../common/Modal";

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  isMobileScreen?: boolean;
  isMobileDrawerOpen?: boolean;
}

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
  if (path.includes("/medical-records")) return "Medical Suite";
  if (path.includes("/vet-directory")) return "Vet Directory & Appointments";
  if (path.includes("/medical-reminders")) return "Vaccine & Med Reminders";
  if (path.includes("/inventory")) return "Inventory Management";
  if (path.includes("/finance")) return "Donations & Financials";
  if (path.includes("/vehicles")) return "Vehicle Fleet";
  if (path.includes("/lost-and-found")) return "Lost & Found Registry";
  if (path.includes("/reports")) return "Reports & Analytics";
  if (path.includes("/roles-permissions")) return "Roles & Permissions";
  if (path.includes("/cms")) return "Website Management (CMS)";
  if (path.includes("/audit-logs")) return "Audit Trail Logs";
  if (path.includes("/certificates")) return "Vaccines & Certificates";
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
  const user = getCurrentUser();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const displayName =
    user?.name ||
    user?.email?.split("@")[0] ||
    "Authenticated User";

  const currentRole = getCurrentUserRole();
  const roleTitle = getRoleTitle(currentRole);
  const pageTitle = getPageTitle(location.pathname);

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
            onClick={() => setIsProfileModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "8px",
              transition: "background 0.15s ease",
            }}
            title="View My Profile Details"
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
              <FaUserCircle size={36} style={{ color: "#1E3A8A" }} />
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                {displayName}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#1E3A8A",
                  background: "#EFF6FF",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  marginTop: "2px",
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

      {/* Interactive Profile Details Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Authenticated Staff Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <FaUserCircle size={48} style={{ color: "#1E3A8A" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{displayName}</h3>
              <span style={{ fontSize: "12px", color: "#1E3A8A", fontWeight: 700, background: "#EFF6FF", padding: "2px 8px", borderRadius: "4px", marginTop: "4px", display: "inline-block" }}>
                {roleTitle}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569" }}>
              <FaEnvelope style={{ color: "#64748B" }} /> <strong>Email:</strong> {user?.email || "admin@pawguard.org"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569" }}>
              <FaShieldAlt style={{ color: "#64748B" }} /> <strong>Internal Role Code:</strong> {currentRole || "super_admin"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569" }}>
              <FaUserCheck style={{ color: "#16A34A" }} /> <strong>Session Status:</strong> Active JWT Authenticated Session
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              onClick={() => setIsProfileModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", cursor: "pointer", fontWeight: 600 }}
            >
              Close
            </button>
            <button
              onClick={handleLogout}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFFFFF", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FaSignOutAlt /> Sign Out
            </button>
          </div>
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

export default Header;