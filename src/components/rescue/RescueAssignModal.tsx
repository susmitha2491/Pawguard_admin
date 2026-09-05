import React, { useState, useEffect, useMemo } from "react";
import Modal from "../common/Modal";
import { useToast } from "../../context/ToastContext";
import rescueService from "../../services/rescueService";
import { notifyDataChanged } from "../../utils/dataSync";
import { normalizeRole } from "../../utils/roleUtils";

export interface RescueAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  rescue: {
    id: string;
    ticket_number?: string;
    coordinator_id?: string | null;
    assigned_agent_id?: string | null;
    assigned_vehicle_id?: string | null;
    rawItem?: Record<string, unknown>;
    raw?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  onRefresh?: () => void | Promise<void>;
  users?: Record<string, unknown>[];
  vehicles?: Record<string, unknown>[];
}

const isUuidString = (val: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

const getUserRoles = (u: unknown): string[] => {
  if (!u || typeof u !== "object") return [];
  const obj = u as Record<string, unknown>;
  const roles: string[] = [];

  if (Array.isArray(obj.roles)) {
    for (const r of obj.roles) {
      if (typeof r === "string") roles.push(r);
      else if (r && typeof r === "object") {
        const name = (r as Record<string, unknown>).name || (r as Record<string, unknown>).role || (r as Record<string, unknown>).slug || (r as Record<string, unknown>).code;
        if (typeof name === "string") roles.push(name);
      }
    }
  }

  if (Array.isArray(obj.role_names)) {
    for (const r of obj.role_names) {
      if (typeof r === "string") roles.push(r);
    }
  }

  if (typeof obj.role === "string" && obj.role) {
    roles.push(obj.role);
  } else if (obj.role && typeof obj.role === "object") {
    const name = (obj.role as Record<string, unknown>).name || (obj.role as Record<string, unknown>).slug || (obj.role as Record<string, unknown>).code;
    if (typeof name === "string") roles.push(name);
  }

  if (typeof obj.user_type === "string" && obj.user_type) roles.push(obj.user_type);
  if (typeof obj.type === "string" && obj.type) roles.push(obj.type);

  return roles;
};

const isRescueAgentUser = (u: unknown): boolean => {
  if (!u || typeof u !== "object") return false;
  const obj = u as Record<string, unknown>;

  const norm = normalizeRole(obj);
  if (norm === "rescue_agent") return true;

  const roles = getUserRoles(obj);
  return roles.some((r) => {
    const rNorm = normalizeRole(r);
    if (rNorm === "rescue_agent") return true;
    const lower = String(r).toLowerCase().trim();
    return (
      lower === "rescue_agent" ||
      lower === "rescue.agent" ||
      lower === "rescueagent" ||
      lower === "rescue_staff" ||
      lower === "field_agent" ||
      lower === "field_responder" ||
      lower.includes("rescue_agent") ||
      lower.includes("rescue agent")
    );
  });
};

const isRescueCoordinatorUser = (u: unknown): boolean => {
  if (!u || typeof u !== "object") return false;
  const obj = u as Record<string, unknown>;

  const norm = normalizeRole(obj);
  if (norm === "rescue_coordinator") return true;

  const roles = getUserRoles(obj);
  return roles.some((r) => {
    const rNorm = normalizeRole(r);
    if (rNorm === "rescue_coordinator") return true;
    const lower = String(r).toLowerCase().trim();
    return (
      lower === "rescue_coordinator" ||
      lower === "rescue.coordinator" ||
      lower === "rescuecoordinator" ||
      lower.includes("rescue_coordinator") ||
      lower.includes("rescue coordinator")
    );
  });
};

const canUserDrive = (u: unknown): boolean => {
  if (!u || typeof u !== "object") return false;
  const obj = u as Record<string, unknown>;

  const checkValue = (val: unknown): boolean => {
    if (val === true || val === 1) return true;
    if (typeof val === "string" && val.toLowerCase().trim() === "true") return true;
    return false;
  };

  if (checkValue(obj.can_drive)) return true;

  for (const key of ["profile", "user_profile", "meta", "metadata", "attributes", "rawUser"]) {
    if (obj[key] && typeof obj[key] === "object") {
      const nested = obj[key] as Record<string, unknown>;
      if (checkValue(nested.can_drive)) return true;
    }
  }

  return false;
};

export const RescueAssignModal: React.FC<RescueAssignModalProps> = ({
  isOpen,
  onClose,
  rescue,
  onRefresh,
  users = [],
  vehicles = [],
}) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignForm, setAssignForm] = useState({
    coordinator_id: "",
    agent_id: "",
    driver_id: "",
    vehicle_id: "",
    notes: "",
  });

  const safeUsersList: Record<string, unknown>[] = useMemo(() => {
    if (!users) return [];
    if (Array.isArray(users)) return users;
    const obj = users as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.items)) return inner.items as Record<string, unknown>[];
      if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[];
    }
    return [];
  }, [users]);

  useEffect(() => {
    if (rescue && isOpen) {
      const preAgentId = rescue.assigned_agent_id || String((rescue.rawItem as any)?.assigned_agent_id || (rescue.raw as any)?.assigned_agent_id || "");
      const agentIsEligible = safeUsersList.some(
        (u) => String((u as any).id || "") === preAgentId && isRescueAgentUser(u)
      );

      const preDriverId = String(
        (rescue.rawItem as any)?.assigned_driver_id || (rescue.raw as any)?.assigned_driver_id || (rescue.rawItem as any)?.dispatch?.assigned_driver_id || (rescue.raw as any)?.dispatch?.assigned_driver_id || ""
      );
      const driverIsEligible = safeUsersList.some(
        (u) => String((u as any).id || "") === preDriverId && canUserDrive(u)
      );

      setAssignForm({
        coordinator_id: rescue.coordinator_id || String((rescue.rawItem as any)?.coordinator_id || (rescue.raw as any)?.coordinator_id || ""),
        agent_id: agentIsEligible ? preAgentId : "",
        driver_id: driverIsEligible ? preDriverId : "",
        vehicle_id: rescue.assigned_vehicle_id || String((rescue.rawItem as any)?.assigned_vehicle_id || (rescue.raw as any)?.assigned_vehicle_id || ""),
        notes: "",
      });
    }
  }, [rescue, isOpen, safeUsersList]);

  if (!rescue || !isOpen) return null;

  // 1. Coordinators dropdown: only actual Rescue Coordinators
  const coordinatorsList = safeUsersList.filter((u) => isRescueCoordinatorUser(u));

  // 2. Field Rescue Agent dropdown: real Rescue Agents from user dataset
  const agentsList = safeUsersList.filter((u) => isRescueAgentUser(u));

  // 3. Authorized Driver dropdown: only users who explicitly have can_drive === true
  const driversList = safeUsersList.filter((u) => canUserDrive(u));

  const selectedDriver = safeUsersList.find(
    (u) => String((u as any).id || "") === assignForm.driver_id.trim()
  );

  const isFormValid = Boolean(
    assignForm.coordinator_id &&
      assignForm.coordinator_id.trim() !== "" &&
      assignForm.agent_id &&
      assignForm.agent_id.trim() !== "" &&
      assignForm.driver_id &&
      assignForm.driver_id.trim() !== "" &&
      selectedDriver &&
      canUserDrive(selectedDriver) &&
      assignForm.vehicle_id &&
      assignForm.vehicle_id.trim() !== ""
  );

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (
      !assignForm.coordinator_id ||
      !assignForm.coordinator_id.trim() ||
      !assignForm.agent_id ||
      !assignForm.agent_id.trim() ||
      !assignForm.driver_id ||
      !assignForm.driver_id.trim() ||
      !assignForm.vehicle_id ||
      !assignForm.vehicle_id.trim()
    ) {
      addToast("Please select a Rescue Coordinator, Field Rescue Agent, Authorized Driver, and Fleet Vehicle.", "error");
      return;
    }

    const selectedDriverObj = safeUsersList.find(
      (u) => String((u as any).id || "") === assignForm.driver_id.trim()
    );

    if (!selectedDriverObj || !canUserDrive(selectedDriverObj)) {
      const driverName = String(
        (selectedDriverObj as any)?.full_name || (selectedDriverObj as any)?.name || (selectedDriverObj as any)?.email || "Selected driver"
      );
      addToast(`User '${driverName}' is not authorized to drive (can_drive=False).`, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const realId = String((rescue.rawItem as any)?.id || (rescue.rawItem as any)?.request_id || (rescue.raw as any)?.id || (rescue.raw as any)?.request_id || rescue.id);

      // 1. Assign Coordinator
      await rescueService.assignCoordinator(realId, assignForm.coordinator_id.trim(), assignForm.notes?.trim() || undefined);

      // 2. Assign Vehicle, Field Agent(s), and Authorized Driver Dispatch
      await rescueService.createDispatch({
        case_id: realId,
        assigned_vehicle_id: assignForm.vehicle_id.trim(),
        agent_ids: [assignForm.agent_id.trim()],
        agent_id: assignForm.agent_id.trim(),
        driver_id: assignForm.driver_id.trim(),
        notes: assignForm.notes?.trim() || undefined,
      });

      addToast("Rescue case assignment saved successfully!", "success");
      onClose();
      notifyDataChanged();
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: {
            detail?: string | Array<{ msg?: string }>;
            message?: string;
            error?: { message?: string; detail?: string };
          };
        };
        message?: string;
      };
      const detail = e?.response?.data?.detail;
      const errMsg = Array.isArray(detail)
        ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
        ? detail
        : e?.response?.data?.error?.message ||
          e?.response?.data?.error?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "Failed to submit assignment";
      addToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Officers & Vehicle — Case #${rescue.ticket_number || rescue.id}`}
    >
      <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 1. Rescue Coordinator Dropdown */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
            Select Rescue Coordinator *
          </label>
          <select
            value={assignForm.coordinator_id}
            onChange={(e) => setAssignForm({ ...assignForm, coordinator_id: e.target.value })}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
          >
            {coordinatorsList.length === 0 ? (
              <option value="" disabled>-- No rescue coordinators available --</option>
            ) : (
              <option value="">-- Select Rescue Coordinator --</option>
            )}
            {coordinatorsList.map((u) => {
              const uId = String((u as any).id || "");
              const rawName = String((u as any).full_name || (u as any).name || (u as any).email || "").trim();
              const displayName = rawName && !isUuidString(rawName) ? rawName : `Coordinator #${uId.substring(0, 8)}`;
              const loc = String((u as any).service_area || (u as any).location || "").trim();
              const extra = loc && !isUuidString(loc) ? ` (${loc})` : "";

              return (
                <option key={uId} value={uId}>
                  {displayName}{extra}
                </option>
              );
            })}
          </select>
        </div>

        {/* 2. Field Rescue Agent Dropdown */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
            Select Field Rescue Agent *
          </label>
          <select
            value={assignForm.agent_id}
            onChange={(e) => setAssignForm({ ...assignForm, agent_id: e.target.value })}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
          >
            {agentsList.length === 0 ? (
              <option value="" disabled>-- No rescue agents available --</option>
            ) : (
              <option value="">-- Select Field Rescue Agent --</option>
            )}
            {agentsList.map((u) => {
              const uId = String((u as any).id || "");
              const rawName = String((u as any).full_name || (u as any).name || (u as any).email || "").trim();
              const displayName = rawName && !isUuidString(rawName) ? rawName : `Agent #${uId.substring(0, 8)}`;
              const isBusy = (u as any).availability === "Busy" || (u as any).status === "busy" || (u as any).is_busy === true;

              const label = isBusy
                ? `✕ ${displayName} (Busy on Rescue)`
                : `✓ ${displayName} (Available)`;

              return (
                <option key={uId} value={uId} disabled={isBusy}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* 3. Authorized Driver Dropdown */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
            Select Authorized Driver *
          </label>
          <select
            value={assignForm.driver_id}
            onChange={(e) => setAssignForm({ ...assignForm, driver_id: e.target.value })}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
          >
            {driversList.length === 0 ? (
              <option value="" disabled>-- No authorized drivers available --</option>
            ) : (
              <option value="">-- Select Authorized Driver --</option>
            )}
            {driversList.map((u) => {
              const uId = String((u as any).id || "");
              const rawName = String((u as any).full_name || (u as any).name || (u as any).email || "").trim();
              const displayName = rawName && !isUuidString(rawName) ? rawName : `Driver #${uId.substring(0, 8)}`;
              const isBusy = (u as any).availability === "Busy" || (u as any).status === "busy" || (u as any).is_busy === true;

              const label = isBusy
                ? `✕ ${displayName} (Busy on Rescue)`
                : `✓ ${displayName} (Authorized Driver)`;

              return (
                <option key={uId} value={uId} disabled={isBusy}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* 4. Fleet Vehicle Dropdown */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
            Select Fleet Vehicle Unit *
          </label>
          <select
            value={assignForm.vehicle_id}
            onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
          >
            <option value="">-- Select Fleet Vehicle --</option>
            {vehicles.map((v) => {
              const vId = String((v as any).id || "");
              const rawReg = (v as any).registration_number || (v as any).vehicle_number || (v as any).license_plate || (v as any).vehicle_code || (v as any).plate;
              const displayReg = rawReg && !isUuidString(String(rawReg)) ? String(rawReg) : `Vehicle Unit #${vId.substring(0, 8)}`;

              const rawModel = String((v as any).make_model || (v as any).model || (v as any).vehicle_type || (v as any).type || "").trim();
              const displayModel = rawModel && !isUuidString(rawModel) ? ` (${rawModel})` : "";

              const rawStatus = String((v as any).status || "").toLowerCase().trim();
              const isAvail = !rawStatus || rawStatus === "active" || rawStatus === "available" || rawStatus === "ready" || rawStatus === "idle";
              const displayStatus = rawStatus ? rawStatus.replace(/_/g, " ") : "available";

              const label = isAvail
                ? `✓ ${displayReg}${displayModel}`
                : `✕ ${displayReg} (${displayStatus})`;

              return (
                <option key={vId} value={vId} disabled={!isAvail}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* 5. Equipment & Instructions / Notes */}
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
            Equipment &amp; Dispatch Instructions / Notes
          </label>
          <textarea
            value={assignForm.notes}
            onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
            placeholder="E.g., Pet carrier required, canine stretcher, urgent field response instructions..."
            rows={3}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
          />
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px", fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              background: isSubmitting || !isFormValid ? "#94A3B8" : "#2563EB",
              color: "#FFF",
              border: "none",
              fontWeight: 700,
              fontSize: "13px",
              cursor: isSubmitting || !isFormValid ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RescueAssignModal;

