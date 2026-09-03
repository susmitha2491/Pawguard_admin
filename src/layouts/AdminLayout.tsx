import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaShieldAlt } from "react-icons/fa";
import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";
import {
  getCurrentUserRole,
  getDashboardRoleFromPath,
  getRoleTitle,
} from "../utils/roleUtils";
import useInactivityTimeout from "../hooks/useInactivityTimeout";

const AdminLayout = () => {
  useInactivityTimeout();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileScreen(mobile);
      if (!mobile) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobileScreen) {
      setIsMobileDrawerOpen(false);
    }
  }, [location.pathname, isMobileScreen]);

  // "Active dashboard" context for Super Admin viewing another role's dashboard.
  const currentRole = getCurrentUserRole();
  const activeDashRole = getDashboardRoleFromPath(location.pathname);
  const viewingRoleDashboard =
    currentRole === "super_admin" && activeDashRole && activeDashRole !== "super_admin";

  const desktopSidebarWidth = isSidebarCollapsed ? 70 : 260;
  const marginLeft = isMobileScreen ? 0 : desktopSidebarWidth;
  const containerWidth = isMobileScreen ? "100%" : `calc(100% - ${desktopSidebarWidth}px)`;

  const handleToggleSidebar = () => {
    if (isMobileScreen) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div
      style={{
        background: "#F8FAFC",
        height: "100vh",
        display: "flex",
        width: "100%",
        maxWidth: "100vw",
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* Sidebar */}
      <Sidebar
        collapsed={isSidebarCollapsed}
        isMobileScreen={isMobileScreen}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Container */}
      <div
        style={{
          marginLeft: `${marginLeft}px`,
          height: "100vh",
          width: containerWidth,
          maxWidth: containerWidth,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <Header
          isSidebarCollapsed={isSidebarCollapsed}
          isMobileScreen={isMobileScreen}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Super Admin module-view context bar */}
        {viewingRoleDashboard && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              padding: isMobileScreen ? "8px 12px" : "10px 24px",
              background: "#EFF6FF",
              borderBottom: "1px solid #BFDBFE",
              fontSize: "13px",
              color: "#1E40AF",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: "12px",
                }}
              >
                <FaShieldAlt size={12} />
                Active: {getRoleTitle(activeDashRole)}
              </span>
            </div>
            <button
              onClick={() => navigate("/dashboard/super-admin")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#1E3A8A",
                color: "#FFFFFF",
                border: "none",
                padding: "6px 12px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              <FaArrowLeft size={11} />
              Super Admin
            </button>
          </div>
        )}

        {/* Dynamic Page Content */}
        <main
          style={{
            flex: 1,
            padding: isMobileScreen ? "12px" : "20px 24px",
            overflowY: "auto",
            overflowX: "hidden",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            margin: "0 auto",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
