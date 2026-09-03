import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";

interface ExecutiveSummaryCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  loading?: boolean;
}

const ExecutiveSummaryCard = ({
  title,
  value,
  subtitle,
  icon,
  color = "#1E3A8A",
  path,
  loading,
}: ExecutiveSummaryCardProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "8px",
          padding: "16px",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <div className="dash-shimmer" style={{ height: 26, width: 120, borderRadius: 6 }} />
        <div className="dash-shimmer" style={{ height: 34, width: 70, borderRadius: 6, marginTop: 16 }} />
        <div className="dash-shimmer" style={{ height: 12, width: 150, borderRadius: 6, marginTop: 12 }} />
      </div>
    );
  }

  const formattedValue = typeof value === "number" ? value.toLocaleString("en-IN") : value;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(path)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate(path);
      }}
      style={{
        display: "block",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "8px",
        padding: "16px",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
        height: "100%",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px -2px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.05)";
        e.currentTarget.style.borderColor = "#E2E8F0";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color || "#1E3A8A",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {title}
        </span>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: `${color}15`,
            color: color || "#1E3A8A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ marginTop: "14px", display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "clamp(20px, 5vw, 28px)",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            wordBreak: "break-word",
            maxWidth: "100%",
          }}
        >
          {formattedValue}
        </span>
        <FaArrowRight size={12} style={{ color: "#94A3B8", flexShrink: 0 }} />
      </div>
      {subtitle && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "12px",
            color: "#475569",
            wordBreak: "break-word",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default ExecutiveSummaryCard;
