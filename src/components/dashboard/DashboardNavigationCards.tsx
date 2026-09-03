import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";
import {
  FaTruckMedical,
  FaHeart,
  FaBuilding,
  FaHouse,
  FaHandsHolding,
  FaStethoscope,
  FaBoxesStacked,
  FaDollarSign,
} from "react-icons/fa6";

const modules: Array<{
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badgeBg?: string;
  badgeColor?: string;
}> = [
  { title: "Rescue Operations", description: "Cases, requests & dispatch", icon: <FaTruckMedical />, path: "/rescues", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Adoptions", description: "Pending applications & matches", icon: <FaHeart />, path: "/adoptions", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Shelters", description: "Facilities, occupancy & kennels", icon: <FaBuilding />, path: "/shelters", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Foster Care", description: "Placements & coordinator view", icon: <FaHouse />, path: "/fosters", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Volunteers", description: "Applications, shifts & attendance", icon: <FaHandsHolding />, path: "/volunteers", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Medical Records", description: "Exams, vaccinations & surgery", icon: <FaStethoscope />, path: "/medical-records", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Inventory", description: "Stock levels, alerts & purchases", icon: <FaBoxesStacked />, path: "/inventory", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
  { title: "Finance", description: "Transactions, donations & expenses", icon: <FaDollarSign />, path: "/finance", badgeBg: "#EFF6FF", badgeColor: "#1E3A8A" },
];

const DashboardNavigationCards = () => {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "12px",
      }}
    >
      {modules.map((mod) => (
        <div
          key={mod.title}
          role="button"
          tabIndex={0}
          onClick={() => navigate(mod.path)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate(mod.path);
          }}
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            padding: "16px",
            cursor: "pointer",
            transition: "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
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
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: mod.badgeBg || "#EFF6FF",
              color: mod.badgeColor || "#1E3A8A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              marginBottom: "12px",
            }}
          >
            {mod.icon}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>
              {mod.title}
            </h4>
            <FaArrowRight size={11} style={{ color: "#94A3B8", flexShrink: 0 }} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12px", lineHeight: "16px", color: "#475569" }}>
            {mod.description}
          </p>
        </div>
      ))}
    </div>
  );
};

export default DashboardNavigationCards;
