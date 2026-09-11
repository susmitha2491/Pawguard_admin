import React, { useState, useEffect, useMemo } from "react";
import Modal from "../common/Modal";
import Select, { type SelectOption } from "../common/Select";
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
  if (norm === "rescue_coordinator") return false;
  if (norm === "rescue_agent") return true;

  const roles = getUserRoles(obj);
  if (roles.some((r) => normalizeRole(r) === "rescue_coordinator")) return false;

  // Agent items from /rescue/agents/availability or availability objects
  if (obj.agent_name || obj.agent_id || obj.is_agent || (obj.availability !== undefined && obj.role !== "rescue_coordinator")) {
    return true;
  }

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
  if (norm === "rescue_coordinator" || norm === "super_admin" || norm === "rescue_centre_admin") return true;

  const roles = getUserRoles(obj);
  return roles.some((r) => {
    const rNorm = normalizeRole(r);
    if (rNorm === "rescue_coordinator" || rNorm === "super_admin" || rNorm === "rescue_centre_admin") return true;
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
        (u) => String((u as any).id || (u as any).user_id || (u as any).userId || (u as any).agent_id || "") === preAgentId && isRescueAgentUser(u)
      );

      setAssignForm({
        coordinator_id: rescue.coordinator_id || String((rescue.rawItem as any)?.coordinator_id || (rescue.raw as any)?.coordinator_id || ""),
        agent_id: agentIsEligible ? preAgentId : "",
        vehicle_id: rescue.assigned_vehicle_id || String((rescue.rawItem as any)?.assigned_vehicle_id || (rescue.raw as any)?.assigned_vehicle_id || ""),
        notes: "",
      });
    }
  }, [rescue, isOpen, safeUsersList]);

  // 1. Coordinators dropdown: actual Rescue Coordinators or Super Admin / Rescue Centre Admin
  const coordinatorsList = safeUsersList.filter((u) => isRescueCoordinatorUser(u));

  // 2. Field Rescue Agent dropdown: real Rescue Agents from availability / user dataset
  const agentsList = safeUsersList.filter((u) => isRescueAgentUser(u));

  const isFormValid = Boolean(
    assignForm.coordinator_id &&
      assignForm.coordinator_id.trim() !== "" &&
      assignForm.agent_id &&
      assignForm.agent_id.trim() !== "" &&
      assignForm.vehicle_id &&
      assignForm.vehicle_id.trim() !== ""
  );

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !rescue) return;

    if (
      !assignForm.coordinator_id ||
      !assignForm.coordinator_id.trim() ||
      !assignForm.agent_id ||
      !assignForm.agent_id.trim() ||
      !assignForm.vehicle_id ||
      !assignForm.vehicle_id.trim()
    ) {
      addToast("Please select a Rescue Coordinator, Field Rescue Agent, and Fleet Vehicle.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const realId = String((rescue.rawItem as any)?.id || (rescue.rawItem as any)?.request_id || (rescue.raw as any)?.id || (rescue.raw as any)?.request_id || rescue.id);

      // 1. Assign Coordinator
      await rescueService.assignCoordinator(realId, assignForm.coordinator_id.trim(), assignForm.notes?.trim() || undefined);

      // 2. Assign Vehicle and Field Agent(s) Dispatch
      await rescueService.createDispatch({
        case_id: realId,
        assigned_vehicle_id: assignForm.vehicle_id.trim(),
        agent_ids: [assignForm.agent_id.trim()],
        agent_id: assignForm.agent_id.trim(),
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

  const coordinatorOptions: SelectOption[] = useMemo(() => {
    return coordinatorsList.map((u) => {
      const uId = String((u as any).id || (u as any).user_id || (u as any).userId || (u as any).agent_id || "");
      const rawName = String((u as any).full_name || (u as any).name || (u as any).agent_name || (u as any).email || "").trim();
      const displayName = rawName && !isUuidString(rawName) ? rawName : `Coordinator #${uId.substring(0, 8)}`;
      const loc = String((u as any).service_area || (u as any).location || "").trim();
      return {
        value: uId,
        label: displayName,
        sublabel: loc && !isUuidString(loc) ? `Area: ${loc}` : undefined,
      };
    });
  }, [coordinatorsList]);

  const agentOptions: SelectOption[] = useMemo(() => {
    return agentsList.map((u) => {
      const uId = String((u as any).id || (u as any).user_id || (u as any).userId || (u as any).agent_id || "");
      const rawName = String((u as any).full_name || (u as any).name || (u as any).agent_name || (u as any).email || "").trim();
      const displayName = rawName && !isUuidString(rawName) ? rawName : `Agent #${uId.substring(0, 8)}`;
      const isBusy = (u as any).availability === "Busy" || (u as any).status === "busy" || (u as any).is_busy === true;
      return {
        value: uId,
        label: displayName,
        sublabel: isBusy ? "Status: Busy on Rescue" : "Status: Available for Dispatch",
        disabled: isBusy,
        badge: {
          text: isBusy ? "Busy" : "Available",
          bg: isBusy ? "#FEF2F2" : "#ECFDF5",
          color: isBusy ? "#DC2626" : "#059669",
        },
      };
    });
  }, [agentsList]);

  const vehicleOptions: SelectOption[] = useMemo(() => {
    return vehicles.map((v) => {
      const vId = String((v as any).id || "");
      const rawReg = (v as any).registration_number || (v as any).vehicle_number || (v as any).license_plate || (v as any).vehicle_code || (v as any).plate;
      const displayReg = rawReg && !isUuidString(String(rawReg)) ? String(rawReg) : `Vehicle #${vId.substring(0, 8)}`;
      const rawModel = String((v as any).make_model || (v as any).model || (v as any).vehicle_type || (v as any).type || "").trim();
      const rawStatus = String((v as any).status || "").toLowerCase().trim();
      const isAvail = !rawStatus || rawStatus === "active" || rawStatus === "available" || rawStatus === "ready" || rawStatus === "idle";
      const displayStatus = rawStatus ? rawStatus.replace(/_/g, " ") : "available";
      return {
        value: vId,
        label: displayReg,
        sublabel: rawModel && !isUuidString(rawModel) ? `Model: ${rawModel}` : undefined,
        disabled: !isAvail,
        badge: {
          text: isAvail ? "Ready" : displayStatus,
          bg: isAvail ? "#ECFDF5" : "#FEF2F2",
          color: isAvail ? "#059669" : "#DC2626",
        },
      };
    });
  }, [vehicles]);

  if (!rescue || !isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Officers & Vehicle — Case #${rescue.ticket_number || rescue.id}`}
    >
      <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 1. Rescue Coordinator Dropdown */}
        <div>
          <Select
            label="Rescue Coordinator"
            required
            placeholder="Select Rescue Coordinator..."
            options={coordinatorOptions}
            value={assignForm.coordinator_id}
            onChange={(val) => setAssignForm({ ...assignForm, coordinator_id: String(val) })}
            searchable={coordinatorOptions.length >= 5}
          />
        </div>

        {/* 2. Field Rescue Agent Dropdown */}
        <div>
          <Select
            label="Field Rescue Agent"
            required
            placeholder="Select Field Rescue Agent..."
            options={agentOptions}
            value={assignForm.agent_id}
            onChange={(val) => setAssignForm({ ...assignForm, agent_id: String(val) })}
            searchable={agentOptions.length >= 5}
          />
        </div>

        {/* 3. Fleet Vehicle Dropdown */}
        <div>
          <Select
            label="Fleet Vehicle Unit"
            required
            placeholder="Select Fleet Vehicle..."
            options={vehicleOptions}
            value={assignForm.vehicle_id}
            onChange={(val) => setAssignForm({ ...assignForm, vehicle_id: String(val) })}
            searchable={vehicleOptions.length >= 5}
          />
        </div>

        {/* 4. Equipment & Instructions / Notes */}
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
