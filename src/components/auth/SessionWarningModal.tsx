import React from "react";
import { FaClock, FaSignOutAlt, FaCheckCircle } from "react-icons/fa";

interface SessionWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  remainingSeconds,
  onExtend,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "16px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          width: "min(100%, 460px)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            background: "#FFFBEB",
            borderBottom: "1px solid #FDE68A",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D97706",
              flexShrink: 0,
            }}
          >
            <FaClock size={20} />
          </div>
          <div>
            <h3
              id="session-warning-title"
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "#92400E",
              }}
            >
              Session Inactivity Warning
            </h3>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "12.5px",
                color: "#B45309",
              }}
            >
              Your session is about to expire
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", textAlign: "center" }}>
          <p
            style={{
              fontSize: "14px",
              color: "#475569",
              lineHeight: 1.5,
              margin: "0 0 16px 0",
            }}
          >
            You have been inactive for a while. For your security, you will be automatically signed out in:
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: "6px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              padding: "12px 24px",
              borderRadius: "12px",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: remainingSeconds <= 20 ? "#DC2626" : "#D97706",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "monospace",
              }}
            >
              {remainingSeconds}
            </span>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#64748B" }}>
              seconds
            </span>
          </div>

          <p
            style={{
              fontSize: "12.5px",
              color: "#64748B",
              margin: 0,
            }}
          >
            Click &ldquo;Stay Logged In&rdquo; or interact with the screen to keep working.
          </p>
        </div>

        {/* Actions Footer */}
        <div
          style={{
            padding: "14px 20px",
            background: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <FaSignOutAlt size={13} />
            Log Out Now
          </button>

          <button
            type="button"
            onClick={onExtend}
            autoFocus
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#2563EB",
              color: "#FFFFFF",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
              transition: "all 0.15s ease",
            }}
          >
            <FaCheckCircle size={13} />
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;
