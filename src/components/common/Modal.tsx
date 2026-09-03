import React, { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  footer?: React.ReactNode;
  zIndex?: number;
}

const SIZE_MAP = {
  sm: "480px",
  md: "620px",
  lg: "760px",
  xl: "900px",
  full: "1100px",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth,
  size = "lg",
  footer,
  zIndex = 1000,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const resolvedMaxWidth = maxWidth || SIZE_MAP[size] || "760px";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          width: "min(100%, calc(100vw - 32px))",
          maxWidth: resolvedMaxWidth,
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Header (Fixed at top) */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
            gap: "16px",
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 700,
              color: "#0F172A",
              wordBreak: "break-word",
              lineHeight: 1.3,
            }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              fontSize: "18px",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            title="Close Modal"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E2E8F0";
              e.currentTarget.style.color = "#0F172A";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748B";
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content Body (Single Scrollbar) */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            wordBreak: "break-word",
          }}
        >
          {children}
        </div>

        {/* Optional Fixed Footer (Pinned at bottom) */}
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
