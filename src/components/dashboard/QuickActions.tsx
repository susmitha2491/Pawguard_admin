import React from "react";
import {
  FaPaw,
  FaUserPlus,
  FaBuilding,
  FaBoxOpen,
  FaHandHoldingHeart,
  FaBell,
  FaChartPie,
} from "react-icons/fa";
import { FaTruckMedical } from "react-icons/fa6";
import QuickActionCard from "./QuickActionCard";

interface QuickActionsProps {
  onSendNotification?: () => void;
}

const actions: Array<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}> = [
  {
    title: "Register New Dog",
    subtitle: "Add a dog to the database",
    icon: <FaPaw />,
    color: "#16A34A",
    path: "/pets?action=register",
  },
  {
    title: "Create New User",
    subtitle: "Provision an account & role",
    icon: <FaUserPlus />,
    color: "#1E3A8A",
    path: "/users?action=add",
  },
  {
    title: "Add New Shelter",
    subtitle: "Register a facility",
    icon: <FaBuilding />,
    color: "#1E3A8A",
    path: "/shelters?action=add",
  },
  {
    title: "New Rescue Case",
    subtitle: "Log a field rescue incident",
    icon: <FaTruckMedical />,
    color: "#DC2626",
    path: "/rescues?action=add",
  },
  {
    title: "Add Inventory Item",
    subtitle: "Restock supplies",
    icon: <FaBoxOpen />,
    color: "#F59E0B",
    path: "/inventory?action=add",
  },
  {
    title: "Log Donation",
    subtitle: "Record an incoming donation",
    icon: <FaHandHoldingHeart />,
    color: "#1E3A8A",
    path: "/finance?action=donation",
  },
  {
    title: "Send Notification",
    subtitle: "Broadcast to users",
    icon: <FaBell />,
    color: "#1E3A8A",
    path: "/notifications?action=send",
  },
  {
    title: "View Reports",
    subtitle: "Executive analytics & exports",
    icon: <FaChartPie />,
    color: "#64748B",
    path: "/reports",
  },
];

const QuickActions = ({ onSendNotification }: QuickActionsProps) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        gap: "12px",
      }}
    >
      {actions.map((action) => (
        <QuickActionCard
          key={action.title}
          title={action.title}
          subtitle={action.subtitle}
          icon={action.icon}
          color={action.color}
          path={action.path}
          onClick={
            action.path === "/notifications?action=send" && onSendNotification
              ? onSendNotification
              : undefined
          }
        />
      ))}
    </div>
  );
};

export default QuickActions;
