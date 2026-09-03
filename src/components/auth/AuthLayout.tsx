import React from "react";
import {
  FaDog,
  FaHome,
  FaAmbulance,
  FaChartLine,
  FaShieldAlt,
  FaBolt,
  FaLock,
} from "react-icons/fa";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const stats = [
  { icon: <FaDog size={18} />, value: "12,450+", label: "Dogs Rescued" },
  { icon: <FaHome size={18} />, value: "4,280+", label: "Successful Adoptions" },
  { icon: <FaAmbulance size={18} />, value: "128", label: "Active Rescue Cases" },
  { icon: <FaChartLine size={18} />, value: "24/7", label: "Real-Time Monitoring" },
];

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        maxHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(400px, 0.8fr)",
        background: "#F8FAFC",
        overflow: "hidden",
      }}
      className="auth-layout-container"
    >
      {/* Left Panel - Premium Enterprise Visual Section */}
      <div
        style={{
          position: "relative",
          padding: "clamp(24px, 3.5vh, 40px) clamp(32px, 4vw, 56px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `
            radial-gradient(ellipse at 20% 15%, rgba(30, 58, 138, 0.07) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(30, 58, 138, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(30, 58, 138, 0.03) 0%, transparent 70%),
            linear-gradient(180deg, rgba(30, 58, 138, 0.02) 0%, transparent 40%),
            #F8FAFC
          `,
          overflow: "hidden",
          color: "#0F172A",
        }}
      >
        {/* Subtle Paw Print Pattern — evenly distributed, very low opacity */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.04,
            pointerEvents: "none",
          }}
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <pattern id="paw-bg" width="100" height="100" patternUnits="userSpaceOnUse">
            <path
              d="M30 40C27 40 25 42 25 45C25 48 27 50 30 50C33 50 35 48 35 45C35 42 33 40 30 40Z"
              fill="#1E3A8A"
            />
            <circle cx="22" cy="34" r="2.5" fill="#1E3A8A" />
            <circle cx="27" cy="30" r="2.5" fill="#1E3A8A" />
            <circle cx="33" cy="30" r="2.5" fill="#1E3A8A" />
            <circle cx="38" cy="34" r="2.5" fill="#1E3A8A" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#paw-bg)" />
        </svg>

        {/* Large Shield/Dog Watermark — positioned right-center, partially cropped, very low opacity */}
        <svg
          style={{
            position: "absolute",
            top: "50%",
            right: "-80px",
            transform: "translateY(-50%)",
            width: "680px",
            height: "680px",
            opacity: 0.06,
            pointerEvents: "none",
          }}
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Shield body */}
          <path
            d="M300 40 L520 140 L520 320 C520 440 400 540 300 580 C200 540 80 440 80 320 L80 140 Z"
            stroke="#1E3A8A"
            strokeWidth="4"
            fill="none"
          />
          {/* Inner shield line */}
          <path
            d="M300 80 L490 170 L490 310 C490 420 380 510 300 545 C220 510 110 420 110 310 L110 170 Z"
            stroke="#1E3A8A"
            strokeWidth="2"
            fill="none"
            strokeDasharray="8 6"
          />
          {/* Paw center inside shield */}
          <path
            d="M280 320C270 320 262 328 262 338C262 348 270 356 280 356C290 356 298 348 298 338C298 328 290 320 280 320Z"
            fill="#1E3A8A"
          />
          <circle cx="264" cy="305" r="8" fill="#1E3A8A" />
          <circle cx="278" cy="292" r="8" fill="#1E3A8A" />
          <circle cx="298" cy="292" r="8" fill="#1E3A8A" />
          <circle cx="312" cy="305" r="8" fill="#1E3A8A" />
          {/* Decorative arcs */}
          <path
            d="M180 200 Q300 120 420 200"
            stroke="#1E3A8A"
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 4"
          />
          <path
            d="M160 420 Q300 500 440 420"
            stroke="#1E3A8A"
            strokeWidth="2"
            fill="none"
            strokeDasharray="6 4"
          />
          {/* Corner accent circles */}
          <circle cx="150" cy="150" r="30" stroke="#1E3A8A" strokeWidth="2" fill="none" />
          <circle cx="450" cy="150" r="30" stroke="#1E3A8A" strokeWidth="2" fill="none" />
          <circle cx="150" cy="450" r="30" stroke="#1E3A8A" strokeWidth="2" fill="none" />
        </svg>

        {/* Soft geometric accent — top-right area */}
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "10%",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(30, 58, 138, 0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Main Content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: "560px" }}>
          {/* Enterprise Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "999px",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              color: "#1E3A8A",
              fontWeight: 600,
              fontSize: "12px",
              marginBottom: "clamp(12px, 2vh, 20px)",
              letterSpacing: "0.02em",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
            }}
          >
            <FaShieldAlt size={12} color="#1E3A8A" />
            <span>Enterprise Dog Rescue Platform</span>
          </div>

          {/* Hero Heading — 44-48px target */}
          <h1
            style={{
              fontSize: "clamp(32px, 3.2vw, 46px)",
              fontWeight: 800,
              lineHeight: 1.15,
              margin: "0 0 clamp(12px, 1.8vh, 18px) 0",
              letterSpacing: "-0.025em",
              color: "#0F172A",
            }}
          >
            PawGuard
            <br />
            <span style={{ color: "#0F172A" }}>Admin Portal</span>
          </h1>

          {/* Description — controlled width */}
          <p
            style={{
              fontSize: "clamp(13px, 1.15vw, 15px)",
              lineHeight: 1.6,
              color: "#475569",
              margin: "0 0 clamp(14px, 2vh, 22px) 0",
              maxWidth: "480px",
            }}
          >
            A centralized platform for managing rescue operations, shelter administration, veterinary care, adoptions, volunteers, inventory, finance, and analytics across the entire PawGuard ecosystem.
          </p>

          {/* Feature Badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "clamp(14px, 2vh, 22px)",
            }}
          >
            {[
              { icon: <FaShieldAlt size={11} color="#1E3A8A" />, label: "Secure Role Access" },
              { icon: <FaBolt size={11} color="#1E3A8A" />, label: "Real-Time Operations" },
              { icon: <FaLock size={11} color="#1E3A8A" />, label: "Enterprise Security" },
            ].map((badge) => (
              <div
                key={badge.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0F172A",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                }}
              >
                {badge.icon}
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/* Statistics Cards — polished with icon containers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "clamp(10px, 1.4vh, 14px)",
              maxWidth: "500px",
            }}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="auth-stat-card"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "14px",
                  padding: "clamp(14px, 1.8vh, 18px) 16px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(30, 58, 138, 0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "10px",
                    color: "#1E3A8A",
                  }}
                >
                  {stat.icon}
                </div>
                <div
                  style={{
                    fontSize: "clamp(20px, 2.2vw, 24px)",
                    fontWeight: 800,
                    color: "#1E3A8A",
                    lineHeight: 1.2,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#475569",
                    marginTop: "4px",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            borderTop: "1px solid #E2E8F0",
            paddingTop: "14px",
            marginTop: "clamp(16px, 2.5vh, 24px)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            fontSize: "12px",
            color: "#475569",
          }}
        >
          <div style={{ fontWeight: 600, color: "#1E3A8A" }}>
            Trusted by Animal Rescue Organizations
          </div>
          <div style={{ fontSize: "11px", color: "#475569" }}>
            Version 1.0 • © 2026 PawGuard • Powered by VPD Technologies
          </div>
        </div>
      </div>

      {/* Right Section - Login Form Container */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "clamp(20px, 3vh, 40px) 28px",
          background: "#FFFFFF",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
