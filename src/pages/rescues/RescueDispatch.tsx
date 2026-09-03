import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaTruck,
  FaAmbulance,
  FaCheckCircle,
  FaClock,
  FaPlus,
  FaMapMarkerAlt,
  FaUserTie,
  FaCarSide,
  FaInfoCircle,
} from "react-icons/fa";
import rescueService from "../../services/rescueService";
import userService from "../../services/userService";
import vehicleService from "../../services/vehicleService";
import petService from "../../services/petService";
import { rescueStatusBadge, dispatchStage } from "../../utils/rescueStatus.tsx";
import { notifyDataChanged, useDataSync } from "../../utils/dataSync";
import { normalizeRole, getCurrentUserRole, getCurrentUser, getRescueCentreId } from "../../utils/roleUtils";
import { formatDateTime } from "../../utils/dateUtils";

const unwrapList = (body: unknown): Record<string, unknown>[] => {
  if (!body) return [];
  const data = Array.isArray(body) ? body : (body as { data?: unknown }).data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
};

export interface EnrichedDispatch {
  id: string;
  dispatch_id: string;
  ticket: string;
  animal_count: string;
  location: string;
  severity: string;
  rescue_status: string;
  dispatch_status: string;
  stage_label: string;
  stage_bg: string;
  stage_color: string;
  agent_names: string;
  agent_ids: string[];
  vehicle_id: string;
  vehicle_label: string;
  reported_at: string;
  dispatched_at: string;
  located_at: string;
  completed_at: string;
  notes: string;
  case_id: string;
  raw: Record<string, unknown>;
  [key: string]: unknown;
}

const RescueDispatch = () => {
  const currentUser = getCurrentUser();
  const currentUserRole = getCurrentUserRole();
  const isRescueCentreAdmin = currentUserRole === "rescue_centre_admin";
  const isSuperAdmin = currentUserRole === "super_admin";
  const isRescueCoordinator = currentUserRole === "rescue_coordinator";
  const isRescueAgent = currentUserRole === "rescue_agent";

  const canManageDispatch = isSuperAdmin || isRescueCoordinator;
  const canUpdateStatus = isSuperAdmin || isRescueCoordinator || isRescueAgent;

  const currentRescueCentreId = getRescueCentreId(currentUser);

  const [dispatches, setDispatches] = useState<EnrichedDispatch[]>([]);
  const [rescueCases, setRescueCases] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAssignAgentModalOpen, setIsAssignAgentModalOpen] = useState(false);
  const [isAssignVehicleModalOpen, setIsAssignVehicleModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [selectedDispatch, setSelectedDispatch] = useState<EnrichedDispatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Specialized Capture Equipment Options
  const CAPTURE_EQUIPMENT_OPTIONS = [
    "Catch Poles & Graspers",
    "Heavy Duty Animal Cages & Crates",
    "Net Gun & Catch Nets",
    "Tranquilizer Dart Kit (Veterinary Controlled)",
    "Heavy Kevlar Bite Shield Gloves & Helmets",
    "Emergency Veterinary First Aid Kit",
  ];

  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  // Form states
  const [newDispatchForm, setNewDispatchForm] = useState({
    case_id: "",
    agent_ids: [] as string[],
    vehicle_id: "",
    notes: "",
  });

  const [reassignAgentId, setReassignAgentId] = useState("");
  const [reassignVehicleId, setReassignVehicleId] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");

  // Main Data Fetcher with Scope Enforcement
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isRescueCentreAdmin && !currentRescueCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator.");
        setDispatches([]);
        setRescueCases([]);
        setUsers([]);
        setVehicles([]);
        setLoading(false);
        return;
      }

      const queryParams: Record<string, unknown> = {};
      if (isRescueCentreAdmin && currentRescueCentreId) {
        queryParams.rescue_centre_id = currentRescueCentreId;
      }

      const [dispatchRes, caseRes, userRes, vehicleRes] = await Promise.allSettled([
        rescueService.getDispatches(queryParams),
        rescueService.getRescueCases(queryParams),
        userService.getUsers(queryParams),
        vehicleService.getVehicles(queryParams),
      ]);

      const dispatchList = dispatchRes.status === "fulfilled" ? unwrapList(dispatchRes.value) : [];
      const caseList = caseRes.status === "fulfilled" ? unwrapList(caseRes.value) : [];
      const userList = userRes.status === "fulfilled" ? unwrapList(userRes.value) : [];
      const vehicleList = vehicleRes.status === "fulfilled" ? unwrapList(vehicleRes.value) : [];

      // Filter by Rescue Centre Scope if applicable
      const scopedUserList = isRescueCentreAdmin && currentRescueCentreId
        ? userList.filter((u) => {
            const uId = u.rescue_centre_id || (u as any).rescue_center_id || (u as any).facility_id || (u as any).organization_id;
            return !uId || String(uId) === String(currentRescueCentreId);
          })
        : userList;

      const scopedVehicleList = isRescueCentreAdmin && currentRescueCentreId
        ? vehicleList.filter((v) => {
            const vId = v.rescue_centre_id || (v as any).rescue_center_id || (v as any).facility_id || (v as any).organization_id;
            return !vId || String(vId) === String(currentRescueCentreId);
          })
        : vehicleList;

      const scopedCaseList = isRescueCentreAdmin && currentRescueCentreId
        ? caseList.filter((c) => {
            const cId = c.rescue_centre_id || (c as any).rescue_center_id || (c as any).facility_id || (c as any).organization_id;
            return !cId || String(cId) === String(currentRescueCentreId);
          })
        : caseList;

      const scopedDispatchList = isRescueCentreAdmin && currentRescueCentreId
        ? dispatchList.filter((d) => {
            const dId = d.rescue_centre_id || (d as any).rescue_center_id || (d as any).facility_id || (d as any).organization_id;
            return !dId || String(dId) === String(currentRescueCentreId);
          })
        : dispatchList;

      setRescueCases(scopedCaseList);
      setUsers(scopedUserList);
      setVehicles(scopedVehicleList);

      const caseById = new Map(scopedCaseList.map((c: Record<string, unknown>) => [String(c.id), c]));

      const formatted: EnrichedDispatch[] = scopedDispatchList.map((d: Record<string, unknown>) => {
        const req = d.rescue_request_id ? caseById.get(String(d.rescue_request_id)) : undefined;
        const stage = dispatchStage({ status: req?.status as string || d.status as string, dispatch: d });
        const agents = Array.isArray(d.agents) ? (d.agents as Record<string, unknown>[]) : [];
        const agentIds = agents.map((a: Record<string, unknown>) => String(a.agent_id || a.id || "")).filter(Boolean);
        const vehicleId = String(d.assigned_vehicle_id || d.vehicle_id || "");
        const vehicle = vehicleId
          ? scopedVehicleList.find((v: Record<string, unknown>) => String(v.id) === vehicleId)
          : undefined;

        const rawStatus = String(d.status || req?.status || "awaiting_dispatch").toLowerCase();

        return {
          id: String(d.id),
          dispatch_id: String(d.id),
          case_id: String(d.rescue_request_id || req?.id || ""),
          ticket: String(req?.ticket_number || d.ticket_number || d.id || "-"),
          animal_count: req?.animal_count != null ? String(req.animal_count) : "-",
          location: String(req?.location_address || d.location || "Location recorded"),
          severity: String(req?.severity || d.severity || "medium").toLowerCase(),
          rescue_status: String(req?.status || "active").toLowerCase(),
          dispatch_status: rawStatus,
          stage_label: stage.label,
          stage_bg: stage.bg,
          stage_color: stage.color,
          agent_ids: agentIds,
          agent_names:
            agentIds.length > 0
              ? agentIds.map((id) => {
                  const u = scopedUserList.find((x) => String(x.id) === id);
                  return u ? String(u.full_name || u.name || u.email || id) : id;
                }).join(", ")
              : "-",
          vehicle_id: vehicleId,
          vehicle_label:
            String(vehicle?.vehicle_number || vehicle?.registration_number || vehicle?.vehicle_code || vehicleId || "-"),
          reported_at: req?.created_at ? formatDateTime(req.created_at as string) : "-",
          dispatched_at: d.dispatched_at ? formatDateTime(d.dispatched_at as string) : "-",
          located_at: d.located_at ? formatDateTime(d.located_at as string) : "-",
          completed_at: d.completed_at ? formatDateTime(d.completed_at as string) : "-",
          notes: String(d.equipment_details || d.notes || "-"),
          raw: d,
        };
      });

      const sortedFormatted = formatted.sort((a, b) => {
        const timeA = new Date(a.dispatched_at || a.reported_at).getTime();
        const timeB = new Date(b.dispatched_at || b.reported_at).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setDispatches(sortedFormatted);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load rescue dispatches.");
    } finally {
      setLoading(false);
    }
  }, [isRescueCentreAdmin, currentRescueCentreId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const caseParam = params.get("case_id");
    if (caseParam) {
      setNewDispatchForm((prev) => ({ ...prev, case_id: caseParam }));
      setIsAddModalOpen(true);
    }
    void fetchAll();
  }, [fetchAll]);

  useDataSync(() => {
    void fetchAll();
  });

  // Rescue Agents belonging to current Rescue Centre
  const agentCandidates = useMemo(() => {
    return users.filter((u) => {
      if (u.is_active === false) return false;
      const r = String(normalizeRole(u) || u.role || "").toLowerCase();
      return r.includes("agent") || r.includes("coordinator") || r.includes("staff");
    });
  }, [users]);

  // Rescue Vehicles belonging to current Rescue Centre
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const status = String(v.status || "").toLowerCase();
      return status !== "maintenance" && status !== "out_of_service";
    });
  }, [vehicles]);

  // Dispatchable Rescue Cases (verified / awaiting dispatch)
  const dispatchableCases = useMemo(() => {
    return rescueCases.filter((c: Record<string, unknown>) => {
      const st = String(c.status || "").toLowerCase();
      return st === "verified" || st === "reported" || st === "dispatched" || st === "pending";
    });
  }, [rescueCases]);

  // Create New Dispatch Action
  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRescueCentreAdmin) {
      addToast("Dispatch creation and team assignment are reserved for Rescue Coordinators.", "error");
      return;
    }
    if (!newDispatchForm.case_id) {
      addToast("Please select a verified rescue case to dispatch.", "error");
      return;
    }
    if (!newDispatchForm.vehicle_id) {
      addToast("Please select an available rescue vehicle.", "error");
      return;
    }
    if (isRescueCentreAdmin && !currentRescueCentreId) {
      addToast("Cannot create dispatch: No Rescue Centre is assigned to your account.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const equipmentNotes = selectedEquipment.length > 0
        ? `Equipment: ${selectedEquipment.join("; ")}.${newDispatchForm.notes ? ` Notes: ${newDispatchForm.notes}` : ""}`
        : newDispatchForm.notes;

      const payload: Record<string, unknown> = {
        case_id: newDispatchForm.case_id,
        assigned_vehicle_id: newDispatchForm.vehicle_id,
        agent_ids: newDispatchForm.agent_ids,
        notes: equipmentNotes || undefined,
      };
      if (isRescueCentreAdmin && currentRescueCentreId) {
        payload.rescue_centre_id = currentRescueCentreId;
      }
      await rescueService.createDispatch(payload as any);
      addToast("Rescue team & equipment dispatched successfully!", "success");
      setIsAddModalOpen(false);
      setNewDispatchForm({ case_id: "", agent_ids: [], vehicle_id: "", notes: "" });
      setSelectedEquipment([]);
      fetchAll();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to create dispatch", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change Action (Start, En Route, Arrived, Complete)
  const handleStatusChange = async (dispatchId: string, nextStatus: string, successMessage: string) => {
    if (isRescueCentreAdmin) {
      addToast("Field operation status updates are performed by Rescue Agents and Rescue Coordinators.", "error");
      return;
    }
    try {
      const res = await rescueService.updateDispatchStatus(dispatchId, nextStatus);
      const resObj = res?.data || res || {};
      const dogId = resObj.dog_id || resObj.id || resObj.pet_id;

      if (dogId && (nextStatus === "completed" || nextStatus === "admitted" || nextStatus === "rescued")) {
        try {
          await petService.provisionSafetyTag(String(dogId));
          addToast(`${successMessage} Safety Tag provisioned for Dog UUID: ${dogId}.`, "success");
        } catch {
          addToast(`⚠️ ${successMessage} (Safety Tag provisioning pending for Dog UUID: ${dogId}).`, "info");
        }
      } else {
        addToast(successMessage, "success");
      }

      fetchAll();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to update dispatch status", "error");
    }
  };

  // Reassign Agent Action
  const handleReassignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRescueCentreAdmin) {
      addToast("Agent reassignment is reserved for Rescue Coordinators.", "error");
      return;
    }
    if (!selectedDispatch || !reassignAgentId) {
      addToast("Select an agent to assign.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await rescueService.updateDispatch(selectedDispatch.id, {
        assigned_agent_ids: [reassignAgentId],
      });
      addToast("Rescue agent reassigned successfully!", "success");
      setIsAssignAgentModalOpen(false);
      setSelectedDispatch(null);
      setReassignAgentId("");
      fetchAll();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to reassign agent", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reassign Vehicle Action
  const handleReassignVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRescueCentreAdmin) {
      addToast("Vehicle reassignment is reserved for Rescue Coordinators.", "error");
      return;
    }
    if (!selectedDispatch || !reassignVehicleId) {
      addToast("Select a vehicle to assign.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await rescueService.updateDispatch(selectedDispatch.id, {
        assigned_vehicle_id: reassignVehicleId,
      });
      addToast("Rescue vehicle reassigned successfully!", "success");
      setIsAssignVehicleModalOpen(false);
      setSelectedDispatch(null);
      setReassignVehicleId("");
      fetchAll();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to reassign vehicle", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Dispatch Action
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRescueCentreAdmin) {
      addToast("Cancelling a dispatch is reserved for Rescue Coordinators.", "error");
      return;
    }
    if (!selectedDispatch) return;
    try {
      setIsSubmitting(true);
      await rescueService.updateDispatchStatus(selectedDispatch.id, "cancelled");
      addToast("Dispatch cancelled successfully.", "info");
      setIsCancelModalOpen(false);
      setSelectedDispatch(null);
      setCancelNotes("");
      fetchAll();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to cancel dispatch", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Summary Metrics (4 Cards ONLY)
  const stats = useMemo(() => {
    const total = dispatches.length;
    const awaiting = dispatches.filter((d) =>
      ["awaiting_dispatch", "pending", "created", "assigned"].includes(d.dispatch_status)
    ).length;
    const inProgress = dispatches.filter((d) =>
      ["dispatched", "en_route", "arrived", "located", "secured", "in_progress", "on_scene"].includes(d.dispatch_status)
    ).length;
    const completed = dispatches.filter((d) =>
      ["completed", "rescued", "admitted"].includes(d.dispatch_status) || ["completed", "rescued", "admitted"].includes(d.rescue_status)
    ).length;

    return { total, awaiting, inProgress, completed };
  }, [dispatches]);

  // Combined 4-Filter Logic (Status, Priority, Agent, Vehicle)
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      // 1. Status Filter
      if (statusFilter !== "all") {
        const st = String(d.dispatch_status || "").toLowerCase();
        if (statusFilter === "awaiting_dispatch") {
          if (!["awaiting_dispatch", "pending", "created", "assigned"].includes(st)) return false;
        } else if (statusFilter === "dispatched") {
          if (st !== "dispatched") return false;
        } else if (statusFilter === "in_progress") {
          if (!["en_route", "arrived", "located", "secured", "in_progress", "on_scene"].includes(st)) return false;
        } else if (statusFilter === "completed") {
          if (!["completed", "rescued", "admitted"].includes(st) && !["completed", "rescued", "admitted"].includes(d.rescue_status)) return false;
        } else if (statusFilter === "cancelled") {
          if (!["cancelled", "rejected", "failed"].includes(st)) return false;
        } else {
          if (st !== statusFilter) return false;
        }
      }

      // 2. Priority Filter
      if (severityFilter !== "all") {
        const sev = String(d.severity || "").toLowerCase();
        if (sev !== severityFilter) return false;
      }

      // 3. Agent Filter
      if (agentFilter !== "all") {
        const targetAg = String(agentFilter).toLowerCase();
        const matchesAgent =
          d.agent_ids.some((id) => id === agentFilter) ||
          d.agent_names.toLowerCase().includes(targetAg);
        if (!matchesAgent) return false;
      }

      // 4. Vehicle Filter
      if (vehicleFilter !== "all") {
        const targetVeh = String(vehicleFilter).toLowerCase();
        const matchesVeh =
          String(d.vehicle_id) === vehicleFilter ||
          d.vehicle_label.toLowerCase().includes(targetVeh);
        if (!matchesVeh) return false;
      }

      return true;
    });
  }, [dispatches, statusFilter, severityFilter, agentFilter, vehicleFilter]);

  // Table Columns
  const columns = [
    { key: "ticket", title: "Ticket / Case ID" },
    { key: "location", title: "Location" },
    {
      key: "severity",
      title: "Priority",
      render: (val: string) => {
        const norm = String(val || "").toLowerCase();
        const color = norm === "critical" ? "#DC2626" : norm === "high" ? "#EA580C" : norm === "medium" ? "#D97706" : "#16A34A";
        return <span style={{ textTransform: "uppercase", fontWeight: 700, fontSize: "12px", color }}>{val || "-"}</span>;
      },
    },
    { key: "agent_names", title: "Rescue Agent" },
    { key: "vehicle_label", title: "Vehicle" },
    {
      key: "dispatch_status",
      title: "Dispatch Status",
      render: (_val: string, row: EnrichedDispatch) => (
        <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: row.stage_bg, color: row.stage_color }}>
          {row.stage_label}
        </span>
      ),
    },
    {
      key: "rescue_status",
      title: "Rescue Status",
      render: rescueStatusBadge,
    },
    { key: "dispatched_at", title: "Dispatch Time" },
    {
      key: "actions",
      title: "Actions",
      render: (_val: unknown, row: EnrichedDispatch) => (
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setSelectedDispatch(row);
              setIsViewModalOpen(true);
            }}
            style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            View Details
          </button>

          {/* Operational Status Actions */}
          {canUpdateStatus && ["awaiting_dispatch", "pending", "created"].includes(row.dispatch_status) && (
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, "dispatched", "Dispatch started! Team notified.")}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFFFFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Start Dispatch
            </button>
          )}

          {canUpdateStatus && row.dispatch_status === "dispatched" && (
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, "en_route", "Team marked as En Route.")}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#7C3AED", color: "#FFFFFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Mark En Route
            </button>
          )}

          {canUpdateStatus && row.dispatch_status === "en_route" && (
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, "arrived", "Team marked as Arrived at Scene.")}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#0891B2", color: "#FFFFFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Mark Arrived
            </button>
          )}

          {canUpdateStatus && ["arrived", "located", "secured", "in_progress", "on_scene"].includes(row.dispatch_status) && (
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, "completed", "Rescue operation marked Completed!")}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#10B981", color: "#FFFFFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
            >
              Mark Completed
            </button>
          )}

          {/* Reassign Agent / Vehicle */}
          {canManageDispatch && row.dispatch_status !== "completed" && row.dispatch_status !== "cancelled" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedDispatch(row);
                  setReassignAgentId(row.agent_ids[0] || "");
                  setIsAssignAgentModalOpen(true);
                }}
                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
              >
                Reassign Agent
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDispatch(row);
                  setReassignVehicleId(row.vehicle_id || "");
                  setIsAssignVehicleModalOpen(true);
                }}
                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
              >
                Reassign Vehicle
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDispatch(row);
                  setIsCancelModalOpen(true);
                }}
                style={{ padding: "5px 8px", borderRadius: "6px", border: "none", background: "#FEF2F2", color: "#DC2626", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#FFF" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, margin: 0 }}>
            Rescue Dispatch
          </h1>
          <p style={{ color: "#94A3B8", margin: "6px 0 0 0", fontSize: "14px" }}>
            Assign rescue agents and vehicles to verified rescue cases.
          </p>
        </div>

        {canManageDispatch && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <FaPlus size={14} />
            <span>New Dispatch</span>
          </button>
        )}
      </div>

      {/* Summary Cards (4 Cards ONLY) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard
          title="Total Dispatches"
          value={stats.total}
          icon={<FaTruck />}
          color="#2563EB"
          onClick={() => setStatusFilter("all")}
          selected={statusFilter === "all"}
        />
        <StatCard
          title="Awaiting Dispatch"
          value={stats.awaiting}
          icon={<FaClock />}
          color="#D97706"
          onClick={() => setStatusFilter("awaiting_dispatch")}
          selected={statusFilter === "awaiting_dispatch"}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<FaAmbulance />}
          color="#7C3AED"
          onClick={() => setStatusFilter("in_progress")}
          selected={statusFilter === "in_progress"}
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<FaCheckCircle />}
          color="#10B981"
          onClick={() => setStatusFilter("completed")}
          selected={statusFilter === "completed"}
        />
      </div>

      {/* Search & Filters Section */}
      <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF", fontWeight: 500 }}
          >
            <option value="all">All Statuses</option>
            <option value="awaiting_dispatch">Awaiting Dispatch</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Priority</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF", fontWeight: 500 }}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Agent</label>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF", fontWeight: 500 }}
          >
            <option value="all">All Agents</option>
            {agentCandidates.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>{String(a.full_name || a.name || a.email)}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Vehicle</label>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF", fontWeight: 500 }}
          >
            <option value="all">All Vehicles</option>
            {availableVehicles.map((v) => (
              <option key={String(v.id)} value={String(v.id)}>{String(v.vehicle_number || v.registration_number || v.vehicle_code || v.id)}</option>
            ))}
          </select>
        </div>

        {(statusFilter !== "all" || severityFilter !== "all" || agentFilter !== "all" || vehicleFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setSeverityFilter("all");
              setAgentFilter("all");
              setVehicleFilter("all");
            }}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F1F5F9",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              height: "38px",
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Dispatch Table */}
      <div className="soft-card" style={{ padding: "20px" }}>
        <DataTable
          data={filteredDispatches}
          columns={columns}
          loading={loading}
          error={error}
          onRetry={fetchAll}
          emptyMessage="No dispatch records found."
          module="rescue_dispatch"
          searchMaxWidth="480px"
          onRowClick={(item: EnrichedDispatch) => {
            setSelectedDispatch(item);
            setIsViewModalOpen(true);
          }}
        />
      </div>

      {/* New Dispatch Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Create New Rescue Dispatch">
        <form onSubmit={handleCreateDispatch} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Verified Rescue Case *</label>
            <select
              required
              value={newDispatchForm.case_id}
              onChange={(e) => setNewDispatchForm({ ...newDispatchForm, case_id: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", background: "#FFF" }}
            >
              <option value="">Select a verified rescue case...</option>
              {dispatchableCases.map((c: Record<string, unknown>) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.ticket_number || c.id)} — {String(c.location_address || c.location || "Location")} ({String(c.severity || "medium").toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Assign Rescue Agent *</label>
            <select
              required
              value={newDispatchForm.agent_ids[0] || ""}
              onChange={(e) => setNewDispatchForm({ ...newDispatchForm, agent_ids: [e.target.value] })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", background: "#FFF" }}
            >
              <option value="">Select an available rescue agent...</option>
              {agentCandidates.map((a: Record<string, unknown>) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.full_name || a.name || a.email)} ({String(a.role || "Rescue Agent")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Assign Rescue Vehicle *</label>
            <select
              required
              value={newDispatchForm.vehicle_id}
              onChange={(e) => setNewDispatchForm({ ...newDispatchForm, vehicle_id: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", background: "#FFF" }}
            >
              <option value="">Select an available rescue vehicle...</option>
              {availableVehicles.map((v: Record<string, unknown>) => (
                <option key={String(v.id)} value={String(v.id)}>
                  {String(v.vehicle_number || v.registration_number || v.vehicle_code || v.id)} — {String(v.type || v.vehicle_type || "Ambulance")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
              Specialized Capture Equipment Required
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#F8FAFC", padding: "10px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              {CAPTURE_EQUIPMENT_OPTIONS.map((item) => {
                const isChecked = selectedEquipment.includes(item);
                return (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEquipment([...selectedEquipment, item]);
                        } else {
                          setSelectedEquipment(selectedEquipment.filter((x) => x !== item));
                        }
                      }}
                    />
                    {item}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Dispatch Notes / Special Instructions</label>
            <textarea
              rows={2}
              placeholder="Add optional dispatch notes or operational context..."
              value={newDispatchForm.notes}
              onChange={(e) => setNewDispatchForm({ ...newDispatchForm, notes: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569", fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 700, cursor: "pointer" }}>
              {isSubmitting ? "Dispatching..." : "Create Dispatch"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Dispatch Details${selectedDispatch?.ticket ? ` — ${selectedDispatch.ticket}` : ""}`}
        size="lg"
      >
        {selectedDispatch && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch ID</span>
                <strong>{selectedDispatch.dispatch_id}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Rescue Case / Ticket ID</span>
                <strong>{selectedDispatch.ticket}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaMapMarkerAlt size={10} style={{ marginRight: "4px" }} /> Location</span>
                <strong style={{ wordBreak: "break-word" }}>{selectedDispatch.location}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Priority</span>
                <strong style={{ textTransform: "uppercase", color: selectedDispatch.severity === "critical" ? "#DC2626" : selectedDispatch.severity === "high" ? "#EA580C" : selectedDispatch.severity === "medium" ? "#D97706" : "#16A34A" }}>
                  {selectedDispatch.severity || "-"}
                </strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaUserTie size={10} style={{ marginRight: "4px" }} /> Assigned Agent</span>
                <strong>{selectedDispatch.agent_names}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaCarSide size={10} style={{ marginRight: "4px" }} /> Assigned Vehicle</span>
                <strong>{selectedDispatch.vehicle_label}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch Status</span>
                <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: selectedDispatch.stage_bg, color: selectedDispatch.stage_color }}>
                  {selectedDispatch.stage_label}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Rescue Case Status</span>
                {rescueStatusBadge(selectedDispatch.rescue_status)}
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaClock size={10} style={{ marginRight: "4px" }} /> Dispatch Time</span>
                <strong>{selectedDispatch.dispatched_at}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaClock size={10} style={{ marginRight: "4px" }} /> Arrival Time</span>
                <strong>{selectedDispatch.located_at}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaClock size={10} style={{ marginRight: "4px" }} /> Completion Time</span>
                <strong>{selectedDispatch.completed_at}</strong>
              </div>
            </div>

            {Boolean(selectedDispatch.notes && selectedDispatch.notes !== "-") && (
              <div style={{ background: "#F1F5F9", padding: "12px 14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                <strong style={{ color: "#334155", display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  <FaInfoCircle size={12} style={{ marginRight: "6px" }} /> Dispatch Notes / Equipment:
                </strong>
                <span style={{ fontSize: "13px", color: "#475569" }}>{selectedDispatch.notes}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reassign Agent Modal */}
      <Modal isOpen={isAssignAgentModalOpen} onClose={() => setIsAssignAgentModalOpen(false)} title="Reassign Rescue Agent">
        <form onSubmit={handleReassignAgent} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Select Rescue Agent *</label>
            <select
              required
              value={reassignAgentId}
              onChange={(e) => setReassignAgentId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", background: "#FFF" }}
            >
              <option value="">Select agent...</option>
              {agentCandidates.map((a: Record<string, unknown>) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.full_name || a.name || a.email)} ({String(a.role || "Rescue Agent")})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsAssignAgentModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 700 }}>
              {isSubmitting ? "Reassigning..." : "Confirm Reassign"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reassign Vehicle Modal */}
      <Modal isOpen={isAssignVehicleModalOpen} onClose={() => setIsAssignVehicleModalOpen(false)} title="Reassign Rescue Vehicle">
        <form onSubmit={handleReassignVehicle} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Select Rescue Vehicle *</label>
            <select
              required
              value={reassignVehicleId}
              onChange={(e) => setReassignVehicleId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", background: "#FFF" }}
            >
              <option value="">Select vehicle...</option>
              {availableVehicles.map((v: Record<string, unknown>) => (
                <option key={String(v.id)} value={String(v.id)}>
                  {String(v.vehicle_number || v.registration_number || v.vehicle_code || v.id)} — {String(v.type || v.vehicle_type || "Ambulance")}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsAssignVehicleModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 700 }}>
              {isSubmitting ? "Reassigning..." : "Confirm Reassign"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Dispatch Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Rescue Dispatch">
        <form onSubmit={handleCancelSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Are you sure you want to cancel dispatch <strong>{selectedDispatch?.ticket}</strong>? This action will recall the assigned field team.
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>Cancellation Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Enter reason for cancelling dispatch..."
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", marginTop: "4px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={() => setIsCancelModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", background: "#EF4444", color: "#FFF", border: "none", fontWeight: 700 }}>
              {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RescueDispatch;
