import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaExclamationTriangle, FaHeart, FaUserPlus } from "react-icons/fa";
import {
  isCritical,
  isCriticalStock,
  isFailed,
  isLowStockItem,
  isOverCapacity,
  isPending,
  vaccinationDue,
} from "../../utils/chartUtils";
import type { AlertItem, AnyRecord } from "../../types/dashboard";
import { getCurrentUser, getCurrentUserRole } from "../../utils/roleUtils";

interface SystemAlertsProps {
  inventory: AnyRecord[];
  medical: AnyRecord[];
  shelters: AnyRecord[];
  rescues: AnyRecord[];
  finance: AnyRecord[];
  adoptions: AnyRecord[];
  volunteers: AnyRecord[];
}

const severityColors: Record<AlertItem["severity"], { bg: string; border: string; text: string; label: string }> = {
  danger: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C", label: "Critical" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", label: "Warning" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E3A8A", label: "Info" },
  success: { bg: "#ECFDF5", border: "#A7F3D0", text: "#15803D", label: "Good" },
};

const severityIcon: Record<AlertItem["severity"], React.ReactNode> = {
  danger: <FaExclamationTriangle />,
  warning: <FaExclamationTriangle />,
  info: <FaUserPlus />,
  success: <FaHeart />,
};

const SystemAlerts = ({
  inventory,
  medical,
  shelters,
  rescues,
  finance,
  adoptions,
  volunteers,
}: SystemAlertsProps) => {
  const navigate = useNavigate();

  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];
    const user = getCurrentUser();
    const userRole = getCurrentUserRole();

    // Inventory Low Stock alert role gating:
    // Authorized: super_admin, rescue_centre_admin, inventory_manager, shelter_manager
    // Prohibited: veterinarian, rescue_coordinator, rescue_agent, adoption_coordinator, foster_coordinator, volunteer_coordinator, finance_user, public/adopter
    const isAuthorizedForInventory =
      userRole === "super_admin" ||
      userRole === "rescue_centre_admin" ||
      userRole === "inventory_manager" ||
      userRole === "shelter_manager";

    if (isAuthorizedForInventory) {
      let filteredInventory = inventory;
      if (userRole === "shelter_manager") {
        const userShelterId = String((user as any)?.shelter_id || (user as any)?.shelterId || (user as any)?.facility_id || "").trim().toLowerCase();
        const userShelterName = String((user as any)?.shelter || (user as any)?.shelter_name || (user as any)?.department || "").trim().toLowerCase();
        if (userShelterId || userShelterName) {
          filteredInventory = inventory.filter((item) => {
            const itemShelterId = String(item.shelter_id || item.shelterId || "").trim().toLowerCase();
            const itemShelterName = String(item.shelter || item.shelter_name || "").trim().toLowerCase();
            if (userShelterId && itemShelterId) return userShelterId === itemShelterId;
            if (userShelterName && itemShelterName) return userShelterName === itemShelterName;
            return true;
          });
        }
      }

      const criticalStock = filteredInventory.filter(isCriticalStock);
      const lowStock = filteredInventory.filter((i) => isLowStockItem(i) && !isCriticalStock(i));

      if (criticalStock.length > 0) {
        list.push({
          id: "stock-critical",
          severity: "danger",
          title: `${criticalStock.length} inventory item${criticalStock.length > 1 ? "s" : ""} out of stock`,
          description: "Essential supplies have hit zero stock and need immediate reordering.",
          module: "Inventory",
          path: "/inventory",
          count: criticalStock.length,
        });
      } else if (lowStock.length > 0) {
        list.push({
          id: "stock-low",
          severity: "warning",
          title: `${lowStock.length} inventory item${lowStock.length > 1 ? "s" : ""} below reorder threshold`,
          description: "Stock levels are running low and should be replenished soon.",
          module: "Inventory",
          path: "/inventory",
          count: lowStock.length,
        });
      }
    }

    const dueVaccines = medical.filter(vaccinationDue);
    const fullShelters = shelters.filter(isOverCapacity);
    const pendingRescues = rescues.filter((r) => isPending(r));
    const criticalMedical = medical.filter((m) => isCritical(m));
    const failedPayments = finance.filter((f) => isFailed(f));
    const pendingAdoptions = adoptions.filter((a) => isPending(a));
    const pendingVolunteers = volunteers.filter((v) => isPending(v));

    if (dueVaccines.length > 0) {
      list.push({
        id: "vaccination-due",
        severity: "warning",
        title: `${dueVaccines.length} vaccination${dueVaccines.length > 1 ? "s" : ""} due within 7 days`,
        description: "Vaccinations are approaching their due date and need scheduling.",
        module: "Medical",
        path: "/medical-records",
        count: dueVaccines.length,
      });
    }

    if (fullShelters.length > 0) {
      list.push({
        id: "shelter-full",
        severity: "danger",
        title: `${fullShelters.length} shelter${fullShelters.length > 1 ? "s" : ""} at or over capacity`,
        description: "Facilities are full and cannot accept additional animals safely.",
        module: "Shelters",
        path: "/shelters",
        count: fullShelters.length,
      });
    }

    if (pendingRescues.length > 0) {
      list.push({
        id: "rescue-pending",
        severity: "warning",
        title: `${pendingRescues.length} active rescue case${pendingRescues.length > 1 ? "s" : ""} awaiting response`,
        description: "Rescue incidents are in progress and need coordinator attention.",
        module: "Rescue",
        path: "/rescues",
        count: pendingRescues.length,
      });
    }

    if (criticalMedical.length > 0) {
      list.push({
        id: "medical-critical",
        severity: "danger",
        title: `${criticalMedical.length} critical medical case${criticalMedical.length > 1 ? "s" : ""}`,
        description: "Animals in critical condition require urgent veterinary review.",
        module: "Medical",
        path: "/medical-records",
        count: criticalMedical.length,
      });
    }

    if (failedPayments.length > 0) {
      list.push({
        id: "finance-failed",
        severity: "warning",
        title: `${failedPayments.length} failed transaction${failedPayments.length > 1 ? "s" : ""} recorded`,
        description: "Recent transactions failed and may require reconciliation.",
        module: "Finance",
        path: "/finance",
        count: failedPayments.length,
      });
    }

    if (pendingAdoptions.length > 0) {
      list.push({
        id: "adoption-pending",
        severity: "info",
        title: `${pendingAdoptions.length} adoption application${pendingAdoptions.length > 1 ? "s" : ""} pending review`,
        description: "Applications are waiting for approval decisions.",
        module: "Adoptions",
        path: "/adoptions",
        count: pendingAdoptions.length,
      });
    }

    if (pendingVolunteers.length > 0) {
      list.push({
        id: "volunteer-pending",
        severity: "info",
        title: `${pendingVolunteers.length} volunteer application${pendingVolunteers.length > 1 ? "s" : ""} awaiting review`,
        description: "Volunteer applications are pending coordinator approval.",
        module: "Volunteers",
        path: "/volunteers",
        count: pendingVolunteers.length,
      });
    }

    return list.slice(0, 6);
  }, [inventory, medical, shelters, rescues, finance, adoptions, volunteers]);

  if (alerts.length === 0) {
    return (
      <div
        style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#15803D",
        }}
      >
        <FaHeart size={20} />
        <div>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>All systems healthy</p>
          <p style={{ margin: "2px 0 0", fontSize: "12.5px", opacity: 0.85 }}>
            No outstanding alerts across rescue, shelters, medical, inventory or finance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "12px",
      }}
    >
      {alerts.map((alert) => {
        const colors = severityColors[alert.severity];
        return (
          <button
            key={alert.id}
            onClick={() => navigate(alert.path)}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "14px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 16px -8px rgba(15, 23, 42, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "#FFFFFF",
                color: colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              {severityIcon[alert.severity]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: colors.text }}>
                  {alert.title}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: "#FFFFFF",
                    color: colors.text,
                    flexShrink: 0,
                  }}
                >
                  {colors.label}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "11.5px", color: "#475569", lineHeight: 1.4 }}>
                {alert.description}
              </p>
              <span style={{ fontSize: "10.5px", fontWeight: 600, color: colors.text, opacity: 0.8 }}>
                {alert.module} →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SystemAlerts;
