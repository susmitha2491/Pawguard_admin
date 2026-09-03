import React from "react";

interface DashboardSectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
}

const DashboardSectionHeader = ({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
}: DashboardSectionHeaderProps) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "17px",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#94A3B8" }}>{subtitle}</p>
        )}
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid #E2E8F0",
            background: "#FFFFFF",
            color: "#1E3A8A",
            fontWeight: 600,
            fontSize: "12.5px",
            padding: "8px 14px",
            borderRadius: "9px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#EFF6FF";
            e.currentTarget.style.borderColor = "#BFDBFE";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#FFFFFF";
            e.currentTarget.style.borderColor = "#E2E8F0";
          }}
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default DashboardSectionHeader;
