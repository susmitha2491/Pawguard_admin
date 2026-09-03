import {
  FaTachometerAlt,
  FaUsers,
  FaPaw,
  FaHome,
  FaHeart,
  FaChartBar,
  FaCog,
  FaSignOutAlt,
  FaAmbulance,
  FaStethoscope,
  FaBoxes,
  FaCoins,
  FaClipboardList,
  FaShieldAlt,
  FaCertificate,
  FaLifeRing,
  FaHandHoldingHeart,
  FaUserFriends,
  FaSearchLocation,
  FaTruck,
  FaBell,
  FaGlobe,
} from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  getCurrentUserRole,
  getMenusForRole,
  getMenuViewPermission,
  getSidebarRole,
} from "../../utils/roleUtils";
import type { RoleMenuItem } from "../../utils/roleUtils";
import { DEFAULT_ROLE_PERMISSIONS } from "../../utils/permissionsCatalog";
import { usePermissions } from "../../context/PermissionContext";
import { notifyAuthChanged } from "../../utils/dataSync";
import { clearAuthData } from "../../utils/authStorage";
import PawGuardLogo from "../common/PawGuardLogo";

interface SidebarProps {
  collapsed?: boolean;
  isMobileScreen?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const renderIcon = (iconType: RoleMenuItem["iconType"]) => {
  switch (iconType) {
    case "dashboard":
      return <FaTachometerAlt />;
    case "users":
      return <FaUsers />;
    case "pets":
      return <FaPaw />;
    case "shelters":
      return <FaHome />;
    case "adoptions":
      return <FaHeart />;
    case "reports":
      return <FaChartBar />;
    case "settings":
      return <FaCog />;
    case "ambulance":
      return <FaAmbulance />;
    case "medical":
      return <FaStethoscope />;
    case "inventory":
      return <FaBoxes />;
    case "finance":
      return <FaCoins />;
    case "heart":
      return <FaHeart />;
    case "tasks":
      return <FaClipboardList />;
    case "audit":
      return <FaShieldAlt />;
    case "certificates":
      return <FaCertificate />;
    case "rescues":
      return <FaLifeRing />;
    case "fosters":
      return <FaHandHoldingHeart />;
    case "volunteers":
      return <FaUserFriends />;
    case "lostfound":
      return <FaSearchLocation />;
    case "vehicles":
      return <FaTruck />;
    case "notifications":
      return <FaBell />;
    case "cms":
      return <FaGlobe />;
    default:
      return <FaTachometerAlt />;
  }
};

const Sidebar = ({
  collapsed = false,
  isMobileScreen = false,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentRole = getCurrentUserRole() || "super_admin";
  const sidebarRole = getSidebarRole(currentRole, location.pathname);
  const { has, loading } = usePermissions();

  const hasPermission = (permission: string): boolean => {
    if (sidebarRole === "super_admin") return true;
    if (loading && sidebarRole) {
      const defaults = DEFAULT_ROLE_PERMISSIONS[sidebarRole] || [];
      return defaults.includes(permission);
    }
    return has(permission);
  };

  const menus = getMenusForRole(sidebarRole).filter((menu) => {
    const required = getMenuViewPermission(menu.path);
    return !required || hasPermission(required);
  });

  const navContainerRef = useRef<HTMLDivElement>(null);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    clearAuthData();
    notifyAuthChanged();
    navigate("/");
  };

  const isPathActive = (menuPath: string): boolean => {
    const current = location.pathname;
    if (menuPath.startsWith("/dashboard")) {
      if (current === "/dashboard") return true;
      return current === menuPath || current.startsWith(`${menuPath}/`);
    }
    if (current === menuPath) return true;
    return current.startsWith(`${menuPath}/`);
  };

  useEffect(() => {
    if (!navContainerRef.current) return;
    const activeElement = navContainerRef.current.querySelector('[data-active="true"]');
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [location.pathname, menus.length]);

  const isMobile = Boolean(isMobileScreen);
  const showCollapsed = collapsed && !isMobile;
  const sidebarWidth = isMobile ? "280px" : showCollapsed ? "70px" : "260px";
  const transform = isMobile ? (isMobileOpen ? "translateX(0)" : "translateX(-100%)") : "none";

  const handleNavClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {isMobile && isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            zIndex: 1050,
            transition: "opacity 0.2s ease",
          }}
        />
      )}

      <aside
        style={{
          width: sidebarWidth,
          height: "100vh",
          background: "#0F172A",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: isMobile ? 1100 : 1000,
          transform: transform,
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "4px 0 25px rgba(15, 23, 42, 0.2)",
          overflowX: "hidden",
          overflowY: "hidden",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: "64px",
            padding: showCollapsed ? "0 14px" : "0 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: showCollapsed ? "center" : "flex-start",
            gap: "12px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(15, 23, 42, 0.95)",
            flexShrink: 0,
          }}
        >
          <PawGuardLogo size={34} />
          {!showCollapsed && (
            <span
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              PawGuard
            </span>
          )}
        </div>

        {/* Role Permitted Navigation Items - Scrollable area */}
        <div
          ref={navContainerRef}
          style={{
            padding: showCollapsed ? "14px 8px" : "14px 14px",
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {menus.map((menu) => {
            const active = isPathActive(menu.path);
            return (
              <NavLink
                key={menu.name}
                to={menu.path}
                title={menu.name}
                onClick={handleNavClick}
                data-active={active}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: showCollapsed ? "12px" : "10px 14px",
                  justifyContent: showCollapsed ? "center" : "flex-start",
                  marginBottom: "4px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: active ? "#FFFFFF" : "#94A3B8",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 500,
                  background: active ? "#1E3A8A" : "transparent",
                  borderLeft: active ? "3px solid #FFFFFF" : "3px solid transparent",
                  boxShadow: active ? "0 4px 12px rgba(30, 58, 138, 0.3)" : "none",
                  transition: "background-color 0.15s ease, color 0.15s ease",
                }}
              >
                <span style={{ fontSize: "17px", display: "flex", alignItems: "center", flexShrink: 0 }}>
                  {renderIcon(menu.iconType)}
                </span>
                {!showCollapsed && (
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {menu.name}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Logout Footer - Fixed at bottom */}
        <div
          style={{
            padding: showCollapsed ? "14px 8px" : "14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            flexShrink: 0,
          }}
        >
          <a
            href="/"
            onClick={handleLogout}
            title="Logout"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: showCollapsed ? "12px" : "10px 14px",
              justifyContent: showCollapsed ? "center" : "flex-start",
              borderRadius: "8px",
              textDecoration: "none",
              color: "#FCA5A5",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              background: "rgba(220, 38, 38, 0.12)",
              transition: "background-color 0.15s ease",
            }}
          >
            <FaSignOutAlt size={16} style={{ flexShrink: 0 }} />
            {!showCollapsed && <span>Logout</span>}
          </a>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;