import { useNavigate } from "react-router-dom";
import { getCurrentUserRole, getDashboardPathForRole, getRoleTitle } from "../../utils/roleUtils";
import { notifyAuthChanged } from "../../utils/dataSync";
import { clearAuthData } from "../../utils/authStorage";
import { FaShieldAlt, FaArrowLeft, FaSignOutAlt } from "react-icons/fa";

const Unauthorized = () => {
  const navigate = useNavigate();
  const role = getCurrentUserRole() || "super_admin";
  const dashboardPath = getDashboardPathForRole(role);
  const roleTitle = getRoleTitle(role);

  const handleGoToDashboard = () => {
    navigate(dashboardPath);
  };

  const handleLogout = () => {
    clearAuthData();
    notifyAuthChanged();
    navigate("/");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F172A",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "540px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            background: "#FEE2E2",
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "0 auto 24px",
            color: "#DC2626",
            fontSize: "36px",
          }}
        >
          <FaShieldAlt />
        </div>

        <span
          style={{
            background: "#FEF2F2",
            color: "#991B1B",
            padding: "6px 16px",
            borderRadius: "999px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Error 403
        </span>

        <h1
          style={{
            margin: "18px 0 10px",
            fontSize: "32px",
            fontWeight: 800,
            color: "#0F172A",
          }}
        >
          Access Denied
        </h1>

        <p
          style={{
            color: "#64748B",
            fontSize: "16px",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          You do not have permission to view this page. You are currently signed in as{" "}
          <strong style={{ color: "#1E3A8A" }}>{roleTitle}</strong>.
        </p>

        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "32px",
            fontSize: "14px",
            color: "#475569",
          }}
        >
          If you believe this is an error or need higher privileges, please contact your System Administrator.
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleGoToDashboard}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#1E3A8A",
              color: "#FFFFFF",
              border: "none",
              padding: "14px 28px",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <FaArrowLeft /> Return to My Dashboard
          </button>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
              padding: "14px 24px",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
