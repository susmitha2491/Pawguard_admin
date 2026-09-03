import React from "react";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";

interface StatCardProps {
  title: string;
  value?: string | number | null;
  trend?: string;
  trendUp?: boolean;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

const StatCard = ({
  title,
  value,
  trend,
  trendUp = true,
  description,
  icon,
  color = "#1E3A8A",
  compact = true,
  onClick,
  selected = false,
}: StatCardProps) => {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: selected ? `2px solid ${color}` : "1px solid #E2E8F0",
        borderRadius: compact ? "8px" : "12px",
        padding: compact ? "14px 16px" : "20px 22px",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
        height: "100%",
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 16px -4px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = selected ? color : "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.05)";
        e.currentTarget.style.borderColor = selected ? color : "#E2E8F0";
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compact ? "10px" : "14px" }}>
        <span style={{ fontSize: compact ? "12px" : "14px", fontWeight: 600, color: "#475569" }}>
          {title}
        </span>

        {icon && (
          <div
            style={{
              width: compact ? "32px" : "38px",
              height: compact ? "32px" : "38px",
              borderRadius: compact ? "8px" : "10px",
              background: `${color}15`,
              color: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: compact ? "15px" : "18px",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Main Value & Trend */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <h3
            style={{
              margin: 0,
              fontSize: compact ? "22px" : "28px",
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {value}
          </h3>

          {trend && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                fontSize: "11px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "999px",
                background: trendUp ? "#F0FDF4" : "#FEF2F2",
                color: trendUp ? "#15803D" : "#DC2626",
              }}
            >
              {trendUp ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />}
              {trend}
            </span>
          )}
        </div>

        {description && (
          <p style={{ margin: "6px 0 0", fontSize: compact ? "12px" : "13px", color: "#475569" }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;