import React from "react";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle, FaHome, FaBell } from "react-icons/fa";

const NotFoundFallback: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "40px 20px",
        textAlign: "center",
        background: "#FFFFFF",
        borderRadius: "16px",
        border: "1px solid #E2E8F0",
        margin: "20px 0",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "#FEF2F2",
          color: "#DC2626",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          marginBottom: "16px",
        }}
      >
        <FaExclamationTriangle />
      </div>
      <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: 800, color: "#0F172A" }}>
        Page / Record Not Found
      </h2>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#64748B", maxWidth: "460px", lineHeight: 1.5 }}>
        The destination route or referenced record is unavailable or does not exist. Please use the navigation below to return to your workspace.
      </p>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#1E3A8A",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
          }}
        >
          <FaHome /> Return to Dashboard
        </button>
        <button
          onClick={() => navigate("/notifications")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#334155",
            fontWeight: 600,
            fontSize: "13.5px",
            cursor: "pointer",
          }}
        >
          <FaBell /> Notifications Center
        </button>
      </div>
    </div>
  );
};

export default NotFoundFallback;
