import React from "react";

const Loader: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading PawGuard"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "16px",
        color: "#64748B",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid #E2E8F0",
          borderTopColor: "#1E3A8A",
          borderRadius: "50%",
          animation: "pawguardSpin 0.8s linear infinite",
        }}
      />
      <style>{`
        @keyframes pawguardSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <span style={{ fontSize: "14px", fontWeight: 500 }}>Loading PawGuard...</span>
    </div>
  );
};

export default Loader;
