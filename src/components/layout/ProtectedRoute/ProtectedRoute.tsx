import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import type { UserRole } from "../../../types/auth";
import { getCurrentUser, getCurrentUserRole, isInternalRole, normalizeRole } from "../../../utils/roleUtils";
import { hasPermission, hasAnyPermission } from "../../../utils/rbac";
import { clearAuthData, getRememberMe, isSessionExpired, setAuthData } from "../../../utils/authStorage";
import { notifyAuthChanged } from "../../../utils/dataSync";
import authService from "../../../services/auth/authService";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  /** Permission code(s) required to access this route (any-of). */
  permission?: string | string[];
}

const ProtectedRoute = ({ allowedRoles, permission }: ProtectedRouteProps) => {
  const user = getCurrentUser();

  // Validate live session via GET /auth/me on route entry (browser automatically sends HttpOnly cookies)
  useEffect(() => {
    if (user) {
      authService
        .getMe()
        .then((meResponse) => {
          const meData = meResponse?.data || meResponse;
          const fetchedUser =
            meData?.user || (typeof meData === "object" && meData.email ? meData : null);
          if (fetchedUser) {
            const userRole = normalizeRole(fetchedUser) || getCurrentUserRole();
            if (userRole) {
              fetchedUser.role = userRole;
              setAuthData({ user: fetchedUser }, getRememberMe(), false);
            }
          }
        })
        .catch(() => {
          // Automatic 401 handling in axios interceptor will trigger /auth/refresh or redirect to login
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforce session inactivity timeout
  if (isSessionExpired()) {
    clearAuthData(true, "inactivity");
    notifyAuthChanged();
    try {
      sessionStorage.setItem(
        "session_expired_message",
        "Your session has expired due to inactivity. Please sign in again."
      );
    } catch {
      /* ignore storage errors */
    }
    return <Navigate to="/?expired=true" replace />;
  }

  // If user is not authenticated or not an internal staff role, redirect to Login page
  if (!user || !isInternalRole(user)) {
    return <Navigate to="/" replace />;
  }

  const currentRole = getCurrentUserRole();

  if (!currentRole) {
    return <Navigate to="/" replace />;
  }

  // Super Admin has unrestricted access to all routes
  if (currentRole === "super_admin") {
    return <Outlet />;
  }

  // If allowedRoles is specified, ensure user has authorization
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentRole)) {
      return <Navigate to="/403" replace />;
    }
  }

  // Permission-based enforcement: revoking a permission must block the page.
  if (permission) {
    const allowed = Array.isArray(permission)
      ? hasAnyPermission(permission)
      : hasPermission(permission);
    if (!allowed) {
      return <Navigate to="/403" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
