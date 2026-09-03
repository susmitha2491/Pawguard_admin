import React from "react";
import { useNavigate } from "react-router-dom";

interface QuickActionCardProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  color?: string;
  path?: string;
  onClick?: () => void;
}

const QuickActionCard = ({
  icon,
  title,
  subtitle,
  description,
  color = "#1E3A8A",
  path,
  onClick,
}: QuickActionCardProps) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) onClick();
    else if (path) navigate(path);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "all 0.2s ease-in-out",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = "#CBD5E1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.05)";
        e.currentTarget.style.borderColor = "#E2E8F0";
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: `${color}15`,
          color: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 700,
            color: "#0F172A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h4>
        {(subtitle || description) && (
          <p
            style={{
              margin: "2px 0 0",
              fontSize: "12px",
              color: "#64748B",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle || description}
          </p>
        )}
      </div>
    </button>
  );
};

export default QuickActionCard;
