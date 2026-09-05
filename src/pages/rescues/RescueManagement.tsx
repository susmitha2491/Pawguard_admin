import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaLifeRing,
  FaAmbulance,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaEye,
  FaUser,
  FaTruck,
  FaClipboardList,
  FaSearch,
  FaClock,
  FaMedkit,
  FaDog,
  FaUserTie,
  FaTimes,
  FaArrowRight,
  FaUserCheck,
  FaCarSide,
} from "react-icons/fa";
import rescueService from "../../services/rescueService";
import lostFoundService from "../../services/lostFoundService";
import LocationMapPreview from "../../components/common/LocationMapPreview";
import RescueDetailModal from "../../components/rescue/RescueDetailModal";
import RescueAssignModal from "../../components/rescue/RescueAssignModal";
import userService from "../../services/userService";
import vehicleService from "../../services/vehicleService";
import { rescueStatusBadge, dispatchStage } from "../../utils/rescueStatus";
import { notifyDataChanged } from "../../utils/dataSync";
import { getCurrentUserRole, normalizeRole } from "../../utils/roleUtils";
import { formatDateTime } from "../../utils/dateUtils";
import { unwrapList } from "../../utils/chartUtils";

// --- HELPER FUNCTIONS FOR TYPE-SAFE STRING OPERATIONS ---
const toSafeStr = (val: unknown): string => (val !== undefined && val !== null ? String(val) : "");
const toSafeLower = (val: unknown): string => toSafeStr(val).toLowerCase();

// --- SEVERITY & CONDITION CONSTANTS ---
const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PHYSICAL_CONDITION_OPTIONS = [
  { value: "critical_life_threatening", label: "Critical / Life Threatening" },
  { value: "fractured_injured", label: "Fractured / Injured" },
  { value: "contagious_sick", label: "Contagious / Sick" },
  { value: "malnourished", label: "Malnourished" },
  { value: "abandoned_stray", label: "Abandoned / Stray" },
  { value: "unknown", label: "Unknown" },
];

// --- INTERFACES ---
export interface RescueCaseTableRow {
  id: string;
  ticket_number: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_alternate_phone: string;
  reporter_email: string;
  is_anonymous: string;
  location_address: string;
  location_landmark: string;
  latitude: string;
  longitude: string;
  animal_count: string;
  physical_condition: string;
  behavioral_indicators: string;
  severity: string;
  is_urgent: string;
  coordinator_id: string | null;
  media_evidence: string;
  environmental_factors: string;
  reporter_notes: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  stage_label: string;
  stage_bg: string;
  stage_color: string;
  dispatch_driver: string;
  dispatch_agents: string;
  dispatch_vehicle: string;
  dispatch_equipment: string;
  dispatched_at: string;
  located_at: string;
  rescued_at: string;
  admitted_at: string;
  escalation_type: string;
  escalation_notes: string;
  has_dispatch: boolean;
  reports: Record<string, unknown>[];
  rawItem: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AgentRosterItem {
  id: string;
  agent_code: string;
  full_name: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  service_area: string;
  availability: "Available" | "Busy" | "Offline" | "On Leave" | "Inactive";
  active_cases_count: number;
  completed_rescues_count: number;
  assigned_vehicle: string;
  avatar_url?: string;
  shift: string;
  experience_years: number;
  specializations: string[];
  certifications: string[];
  current_assignment?: RescueCaseTableRow | null;
  rawUser: Record<string, unknown>;
}

export interface VehicleFleetItem {
  id: string;
  vehicle_code: string;
  registration_number: string;
  vehicle_type: string;
  model: string;
  assigned_driver: string;
  assigned_agent_name: string;
  location: string;
  capacity: number;
  capacity_used: number;
  status: "Available" | "Assigned" | "On Route" | "On Rescue" | "Maintenance" | "Offline";
  current_rescue_id?: string;
  current_rescue_case?: RescueCaseTableRow | null;
  fuel_level: string;
  last_service_date: string;
  next_service_date: string;
  insurance_expiry: string;
  equipment: {
    pet_carriers: boolean;
    first_aid_kit: boolean;
    oxygen_support: boolean;
    animal_restraint: boolean;
    stretcher_nets: boolean;
  };
  rawVehicle: Record<string, unknown>;
}

// Map backend case to standardized row
const formatCaseRow = (raw: Record<string, unknown>): RescueCaseTableRow => {
  const item = raw && typeof raw === "object" ? raw : {};
  const stage = dispatchStage({ status: item.status as string, dispatch: item.dispatch as Record<string, unknown> });
  const d = (item.dispatch as Record<string, unknown>) || null;
  const agentsList = Array.isArray(d?.agents) ? (d.agents as Record<string, unknown>[]) : [];
  
  const rawId = toSafeStr(item.id || item.request_id || item.ticket_number || "");
  const formattedTicket = item.ticket_number 
    ? toSafeStr(item.ticket_number)
    : item.case_number
    ? toSafeStr(item.case_number)
    : rawId.length > 8
    ? `RES-20260821-${rawId.slice(0, 4).toUpperCase()}`
    : `RES-${rawId || "UNKNOWN"}`;

  return {
    id: rawId,
    ticket_number: formattedTicket,
    reporter_name: toSafeStr(item.reporter_name ?? item.reporter ?? "-"),
    reporter_phone: toSafeStr(item.reporter_phone ?? "-"),
    reporter_alternate_phone: toSafeStr(item.reporter_alternate_phone ?? "-"),
    reporter_email: toSafeStr(item.reporter_email ?? "-"),
    is_anonymous: item.is_anonymous !== undefined && item.is_anonymous !== null ? (item.is_anonymous ? "Yes" : "No") : "-",
    location_address: toSafeStr(item.location_address ?? item.location ?? "-"),
    location_landmark: toSafeStr(item.location_landmark ?? "-"),
    latitude: item.latitude !== undefined && item.latitude !== null ? toSafeStr(item.latitude) : "-",
    longitude: item.longitude !== undefined && item.longitude !== null ? toSafeStr(item.longitude) : "-",
    animal_count: item.animal_count !== undefined && item.animal_count !== null ? toSafeStr(item.animal_count) : "-",
    physical_condition: toSafeStr(item.physical_condition ?? "-"),
    behavioral_indicators: toSafeStr(item.behavioral_indicators ?? "-"),
    severity: toSafeStr(item.severity ?? item.urgency_level ?? item.urgency ?? "-"),
    is_urgent: item.is_urgent !== undefined && item.is_urgent !== null ? (item.is_urgent ? "Yes" : "No") : "-",
    coordinator_id: item.coordinator_id ? toSafeStr(item.coordinator_id) : null,
    media_evidence: Array.isArray(item.media_evidence)
      ? item.media_evidence.join(", ")
      : toSafeStr(item.media_evidence ?? item.media_urls ?? "-"),
    environmental_factors: toSafeStr(item.environmental_factors ?? "-"),
    reporter_notes: toSafeStr(item.reporter_notes ?? item.notes ?? "-"),
    status: toSafeStr(item.status ?? "-"),
    ...(item.rejection_rationale ? { rejection_reason: toSafeStr(item.rejection_rationale) } : {}),
    created_at: item.created_at ? formatDateTime(item.created_at as string) : "-",
    updated_at: item.updated_at ? formatDateTime(item.updated_at as string) : "-",
    stage_label: stage.label,
    stage_bg: stage.bg,
    stage_color: stage.color,
    dispatch_driver: toSafeStr(d?.assigned_driver_id || d?.driver_name || "-"),
    dispatch_agents: agentsList.length > 0
      ? agentsList.map((a: Record<string, unknown>) => toSafeStr(a.agent_name || a.name || a.agent_id || a.id || "")).join(", ")
      : toSafeStr(d?.assigned_agent_names || d?.agent_name || "-"),
    dispatch_vehicle: toSafeStr(d?.assigned_vehicle_id || d?.vehicle_number || d?.vehicle_id || "-"),
    dispatch_equipment: toSafeStr(d?.equipment_details || "-"),
    dispatched_at: d?.dispatched_at ? formatDateTime(d.dispatched_at as string) : "-",
    located_at: d?.located_at ? formatDateTime(d.located_at as string) : "-",
    rescued_at: d?.rescued_at ? formatDateTime(d.rescued_at as string) : "-",
    admitted_at: d?.admitted_at ? formatDateTime(d.admitted_at as string) : "-",
    escalation_type: toSafeStr(d?.escalation_type || "-"),
    escalation_notes: toSafeStr(d?.escalation_notes || "-"),
    has_dispatch: Boolean(d),
    reports: Array.isArray(item.reports) ? (item.reports as Record<string, unknown>[]) : [],
    rawItem: item,
  };
};


// --- MAIN RESCUE MANAGEMENT COMPONENT ---
const RescueManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserRole = getCurrentUserRole();
  const isRescueCentreAdmin = currentUserRole === "rescue_centre_admin";

  // Navigation tab: 'cases' | 'agents' | 'vehicles'
  const activeTab = (searchParams.get("tab") as "cases" | "agents" | "vehicles") || "cases";

  // Data states
  const [cases, setCases] = useState<RescueCaseTableRow[]>([]);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Filter states for Rescue Cases
  const [caseSearch, setCaseSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [severityFilter, setSeverityFilter] = useState(searchParams.get("severity") || "all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");

  // Filter & Pagination states for Agents & Vehicles
  const [agentSearch, setAgentSearch] = useState("");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentPage, setAgentPage] = useState(1);

  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("all");
  const [vehiclePage, setVehiclePage] = useState(1);

  // Selected Detail Modals
  const [selectedCase, setSelectedCase] = useState<RescueCaseTableRow | null>(null);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "tracking">("details");

  const [selectedAgent, setSelectedAgent] = useState<AgentRosterItem | null>(null);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleFleetItem | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);

  // Action Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(() => searchParams.get("action") === "add");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isStatusUpdateOpen, setIsStatusUpdateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);



  // Status Form State
  const [statusForm, setStatusForm] = useState({
    status: "",
    notes: "",
  });

  // Create Case Form State
  const [formData, setFormData] = useState({
    location_address: "",
    location_landmark: "",
    severity: "high",
    is_urgent: true,
    animal_count: 1,
    physical_condition: "unknown",
    reporter_name: "",
    reporter_phone: "",
    reporter_notes: "",
  });

  // --- FETCH DATA ---
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const isAgentRole = getCurrentUserRole() === "rescue_agent";
      const [casesRes, usersRes, vehiclesRes] = await Promise.allSettled([
        rescueService.getAllRescueCases(isAgentRole ? { assigned_to_me: true } : undefined),
        userService.getUsers(),
        vehicleService.getVehicles(),
      ]);

      // Process Cases
      if (casesRes.status === "fulfilled") {
        const rawCases = unwrapList(casesRes.value?.data ?? casesRes.value);
        setCases((rawCases as Record<string, unknown>[]).map(formatCaseRow));
      } else {
        setCases([]);
      }

      // Process Users
      if (usersRes.status === "fulfilled") {
        const rawUsers = unwrapList(usersRes.value?.data ?? usersRes.value);
        setUsers(rawUsers as Record<string, unknown>[]);
      } else {
        setUsers([]);
      }

      // Process Vehicles
      if (vehiclesRes.status === "fulfilled") {
        const rawVehicles = unwrapList(vehiclesRes.value?.data ?? vehiclesRes.value);
        setVehicles(rawVehicles as Record<string, unknown>[]);
      } else {
        setVehicles([]);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(e?.response?.data?.detail || e?.response?.data?.message || "Failed to load rescue operations data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- TAB SWITCHING ---
  const handleTabChange = (tab: "cases" | "agents" | "vehicles") => {
    searchParams.set("tab", tab);
    setSearchParams(searchParams);
  };

  // --- DYNAMIC CALCULATIONS ---
  // Stat Card Counts (Calculated dynamically)
  const stats = useMemo(() => {
    const total = cases.length;
    const pending = cases.filter((c) => {
      const st = toSafeLower(c.status);
      return st.includes("pending") || st.includes("reported") || st.includes("requested");
    }).length;
    const active = cases.filter((c) => {
      const st = toSafeLower(c.status);
      return (
        st.includes("verified") ||
        st.includes("assigned") ||
        st.includes("dispatched") ||
        st.includes("en_route") ||
        st.includes("arrived") ||
        st.includes("progress") ||
        st.includes("located") ||
        st.includes("secured")
      );
    }).length;
    const urgent = cases.filter((c) => c.is_urgent === "Yes" || String(c.is_urgent) === "true").length;
    const critical = cases.filter((c) => toSafeLower(c.severity).includes("critical")).length;
    const dispatched = cases.filter(
      (c) => toSafeLower(c.status).includes("dispatched") || toSafeLower(c.stage_label).includes("dispatched")
    ).length;
    const completed = cases.filter((c) => {
      const st = toSafeLower(c.status);
      return st.includes("completed") || st.includes("admitted") || st.includes("rescued") || st.includes("transferred");
    }).length;
    const cancelled = cases.filter((c) => {
      const st = toSafeLower(c.status);
      return st.includes("cancelled") || st.includes("rejected") || st.includes("failed");
    }).length;

    return { total, pending, active, urgent, critical, dispatched, completed, cancelled };
  }, [cases]);

  // Roster of Rescue Personnel (Coordinators & Agents)
  const agentRoster: AgentRosterItem[] = useMemo(() => {
    const filteredUsers = users.filter((u) => {
      const r = normalizeRole(u as any);
      return r === "rescue_agent" || r === "rescue_coordinator" || r === "super_admin" || r === "rescue_centre_admin";
    });

    return filteredUsers.map((u, idx) => {
      const uId = toSafeStr(u.id || `RA-${idx + 1}`);
      const uName = toSafeStr(u.full_name || u.name || u.email || "Rescue Officer");
      const uRole = normalizeRole(u as any) === "rescue_coordinator" ? "Rescue Coordinator" : "Rescue Agent";

      // Find active cases assigned to this user
      const assignedCases = cases.filter((c) => {
        const ags = toSafeLower(c.dispatch_agents);
        const crd = toSafeLower(c.coordinator_id);
        const drv = toSafeLower(c.dispatch_driver);
        const targetName = toSafeLower(uName);
        const targetId = toSafeLower(uId);
        return ags.includes(targetName) || crd.includes(targetId) || drv.includes(targetName);
      });

      const activeAssigned = assignedCases.filter((c) => {
        const st = toSafeLower(c.status);
        return (
          st.includes("assigned") ||
          st.includes("dispatched") ||
          st.includes("en_route") ||
          st.includes("arrived") ||
          st.includes("progress") ||
          st.includes("located")
        );
      });

      const completedAssigned = assignedCases.filter((c) => {
        const st = toSafeLower(c.status);
        return st.includes("completed") || st.includes("admitted") || st.includes("rescued");
      });

      const isBusy = activeAssigned.length > 0;
      const currentActiveCase = activeAssigned[0] || null;

      return {
        id: uId,
        agent_code: `RA-00${idx + 1}`,
        full_name: uName,
        role: uRole,
        email: toSafeStr(u.email || `${uName.toLowerCase().replace(/\s+/g, ".")}@pawguard.org`),
        phone: toSafeStr(u.phone || "+91 98765 00000"),
        location: toSafeStr(u.service_area || u.location || "Kurnool"),
        service_area: toSafeStr(u.service_area || "Kurnool Rescue Sector"),
        availability: isBusy ? "Busy" : ("Available" as const),
        active_cases_count: activeAssigned.length,
        completed_rescues_count: completedAssigned.length,
        assigned_vehicle: currentActiveCase?.dispatch_vehicle && currentActiveCase.dispatch_vehicle !== "-" ? currentActiveCase.dispatch_vehicle : "Unassigned",
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : undefined,
        shift: toSafeStr(u.shift || "Field Operations Shift"),
        experience_years: 3 + (idx % 4),
        specializations: idx % 2 === 0 ? ["High-risk Extraction", "Canine First Aid"] : ["Aggressive Animal Handling", "Ambulance Driver"],
        certifications: ["PawGuard Certified Field Responder", "Emergency Canine Rescue Level 2"],
        current_assignment: currentActiveCase,
        rawUser: u,
      };
    });
  }, [users, cases]);

  // Fleet of Rescue Vehicles
  const vehicleFleet: VehicleFleetItem[] = useMemo(() => {
    return vehicles.map((v, idx) => {
      const vCode = toSafeStr(v.vehicle_number || v.plate || `PGV-00${idx + 1}`);
      const vId = toSafeStr(v.id || vCode);

      // Find active rescue assigned to this vehicle
      const activeCase = cases.find((c) => {
        const veh = toSafeLower(c.dispatch_vehicle);
        const st = toSafeLower(c.status);
        const isActiveCase =
          st.includes("assigned") ||
          st.includes("dispatched") ||
          st.includes("en_route") ||
          st.includes("arrived") ||
          st.includes("progress") ||
          st.includes("located");
        return veh.includes(toSafeLower(vCode)) && isActiveCase;
      });

      const isAssigned = Boolean(activeCase);
      const isMaintenance = toSafeLower(v.status).includes("service") || toSafeLower(v.status).includes("maintenance");

      const statusVal: VehicleFleetItem["status"] = isMaintenance
        ? "Maintenance"
        : isAssigned
        ? "On Rescue"
        : "Available";

      const capacity = Number(v.capacity || 4);
      const capacityUsed = isAssigned ? Math.min(Number(activeCase?.animal_count || 1), capacity) : 0;

      return {
        id: vId,
        vehicle_code: vCode,
        registration_number: toSafeStr(v.plate || v.registration_number || `AP 21 EX 100${idx + 1}`),
        vehicle_type: toSafeStr(v.type || v.vehicle_type || "Rescue Ambulance"),
        model: toSafeStr(v.model || "Toyota Operations Van"),
        assigned_driver: activeCase && activeCase.dispatch_driver !== "-" ? activeCase.dispatch_driver : toSafeStr(v.assigned_driver || "Unassigned"),
        assigned_agent_name: activeCase && activeCase.dispatch_agents !== "-" ? activeCase.dispatch_agents : toSafeStr(v.assigned_driver || "Unassigned"),
        location: toSafeStr(v.location || "Kurnool Central Depot"),
        capacity,
        capacity_used: capacityUsed,
        status: statusVal,
        current_rescue_id: activeCase?.id,
        current_rescue_case: activeCase || null,
        fuel_level: toSafeStr(v.fuel_level || "85%"),
        last_service_date: "2026-08-01",
        next_service_date: "2026-11-01",
        insurance_expiry: "2027-05-15",
        equipment: {
          pet_carriers: true,
          first_aid_kit: true,
          oxygen_support: idx % 2 === 0,
          animal_restraint: true,
          stretcher_nets: true,
        },
        rawVehicle: v,
      };
    });
  }, [vehicles, cases]);

  // Vehicle Stats
  const vehicleStats = useMemo(() => {
    const total = vehicleFleet.length;
    const available = vehicleFleet.filter((v) => v.status === "Available").length;
    const onRescue = vehicleFleet.filter((v) => v.status === "On Rescue" || v.status === "On Route" || v.status === "Assigned").length;
    const maintenance = vehicleFleet.filter((v) => v.status === "Maintenance").length;
    return { total, available, onRescue, maintenance };
  }, [vehicleFleet]);

  // --- FILTERED LISTS ---
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // 0. Search term filter
      if (caseSearch.trim()) {
        const q = toSafeLower(caseSearch);
        const matchTicket = toSafeLower(c.ticket_number).includes(q);
        const matchReporter = toSafeLower(c.reporter_name).includes(q);
        const matchLoc = toSafeLower(c.location_address).includes(q) || toSafeLower(c.location_landmark).includes(q);
        const matchCondition = toSafeLower(c.physical_condition).includes(q);
        const matchNotes = toSafeLower(c.reporter_notes).includes(q);
        if (!matchTicket && !matchReporter && !matchLoc && !matchCondition && !matchNotes) return false;
      }

      // 1. Status filter
      if (statusFilter !== "all") {
        const st = toSafeLower(c.status);
        if (statusFilter === "pending" && !st.includes("pending") && !st.includes("reported") && !st.includes("requested")) return false;
        if (statusFilter === "active" && (st.includes("pending") || st.includes("reported") || st.includes("requested") || st.includes("completed") || st.includes("cancelled") || st.includes("rejected") || st.includes("admitted") || st.includes("rescued"))) return false;
        if (statusFilter === "urgent" && c.is_urgent !== "Yes" && String(c.is_urgent) !== "true" && !st.includes("urgent")) return false;
        if (statusFilter === "dispatched" && !st.includes("dispatched") && !toSafeLower(c.stage_label).includes("dispatched")) return false;
        if (statusFilter === "completed" && (!st.includes("completed") && !st.includes("admitted") && !st.includes("rescued") && !st.includes("transferred"))) return false;
        if (statusFilter === "cancelled" && (!st.includes("cancelled") && !st.includes("rejected") && !st.includes("failed"))) return false;
      }

      // 2. Severity filter
      if (severityFilter !== "all") {
        const sev = toSafeLower(c.severity);
        const targetSev = toSafeLower(severityFilter);
        if (!sev.includes(targetSev)) return false;
      }

      // 3. Agent filter
      if (agentFilter !== "all") {
        const agStr = toSafeLower(c.dispatch_agents);
        const crdStr = toSafeLower(c.coordinator_id);
        const targetAg = toSafeLower(agentFilter);
        if (!agStr.includes(targetAg) && !crdStr.includes(targetAg)) return false;
      }

      // 4. Vehicle filter
      if (vehicleFilter !== "all") {
        const vehStr = toSafeLower(c.dispatch_vehicle);
        const targetVeh = toSafeLower(vehicleFilter);
        if (!vehStr.includes(targetVeh)) return false;
      }

      return true;
    });
  }, [cases, caseSearch, statusFilter, severityFilter, agentFilter, vehicleFilter]);

  const filteredAgents = useMemo(() => {
    return agentRoster.filter((a) => {
      if (agentSearch.trim()) {
        const q = toSafeLower(agentSearch);
        if (
          !toSafeLower(a.full_name).includes(q) &&
          !toSafeLower(a.email).includes(q) &&
          !toSafeLower(a.phone).includes(q)
        ) return false;
      }
      if (agentStatusFilter !== "all") {
        if (toSafeLower(a.availability) !== toSafeLower(agentStatusFilter)) return false;
      }
      return true;
    });
  }, [agentRoster, agentSearch, agentStatusFilter]);

  const totalAgentPages = Math.ceil(filteredAgents.length / 9) || 1;
  const paginatedAgents = useMemo(() => {
    const start = (agentPage - 1) * 9;
    return filteredAgents.slice(start, start + 9);
  }, [filteredAgents, agentPage]);

  const filteredVehicles = useMemo(() => {
    return vehicleFleet.filter((v) => {
      if (vehicleSearch.trim()) {
        const q = toSafeLower(vehicleSearch);
        if (
          !toSafeLower(v.vehicle_code).includes(q) &&
          !toSafeLower(v.registration_number).includes(q) &&
          !toSafeLower(v.model).includes(q)
        ) return false;
      }
      if (vehicleStatusFilter !== "all") {
        if (toSafeLower(v.status) !== toSafeLower(vehicleStatusFilter)) return false;
      }
      return true;
    });
  }, [vehicleFleet, vehicleSearch, vehicleStatusFilter]);

  const totalVehiclePages = Math.ceil(filteredVehicles.length / 9) || 1;
  const paginatedVehicles = useMemo(() => {
    const start = (vehiclePage - 1) * 9;
    return filteredVehicles.slice(start, start + 9);
  }, [filteredVehicles, vehiclePage]);

  // --- ACTIONS & HANDLERS ---
  const handleOpenCaseDetails = async (row: RescueCaseTableRow, tab: "details" | "tracking" = "details") => {
    setSelectedCase(row);
    setDetailTab(tab);
    setIsCaseModalOpen(true);

    const caseId = String(row.rawItem?.id || row.id || "");
    if (!caseId) return;

    try {
      const res = await rescueService.getRescueCaseById(caseId);
      const rawData = res?.data || res;
      if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
        setSelectedCase(formatCaseRow(rawData));
      }
    } catch {
      /* Keep existing row */
    }
  };

  const handleOpenAssignModal = (c: RescueCaseTableRow) => {
    setSelectedCase(c);
    setIsCaseModalOpen(false);
    setIsAssignModalOpen(true);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_address) {
      addToast("Location address is required for rescue case", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await rescueService.createRescueCase({
        location_address: formData.location_address,
        location_landmark: formData.location_landmark,
        severity: formData.severity,
        is_urgent: formData.is_urgent,
        animal_count: Number(formData.animal_count),
        physical_condition: formData.physical_condition,
        reporter_name: formData.reporter_name,
        reporter_phone: formData.reporter_phone,
        reporter_notes: formData.reporter_notes,
      });
      addToast("New rescue case created successfully!", "success");
      setIsAddModalOpen(false);
      setFormData({
        location_address: "",
        location_landmark: "",
        severity: "high",
        is_urgent: true,
        animal_count: 1,
        physical_condition: "unknown",
        reporter_name: "",
        reporter_phone: "",
        reporter_notes: "",
      });
      fetchAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to create rescue case", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCaseRow = async (row: RescueCaseTableRow) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const realId = String(row.rawItem?.id || row.rawItem?.request_id || row.id);
      await rescueService.approveRescueRequest(realId, {
        status: "verified",
        severity: row.severity,
        is_urgent: row.is_urgent === "Yes" || String(row.is_urgent) === "true",
      });
      addToast(`Rescue case #${row.ticket_number || row.id} verified successfully!`, "success");
      notifyDataChanged();
      await fetchAllData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to verify rescue case", "error");
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !statusForm.status) return;

    try {
      setIsSubmitting(true);
      await rescueService.updateRescueStatus(selectedCase.id, statusForm.status);
      const newStatus = statusForm.status.toLowerCase();
      addToast(`Status updated to ${statusForm.status}!`, "success");
      setIsStatusUpdateOpen(false);
      fetchAllData();
      notifyDataChanged();

      if (isCaseModalOpen) {
        const refreshed = await rescueService.getRescueCaseById(selectedCase.id);
        if (refreshed) setSelectedCase(formatCaseRow(refreshed?.data || refreshed));
      }

      // If rescue is completed/rescued/admitted, trigger workflow bridge to Register Rescued Dog
      if (["completed", "rescued", "admitted"].includes(newStatus)) {
        const caseId = selectedCase.id;
        setTimeout(() => {
          if (window.confirm(`Rescue mission completed! Would you like to register the rescued dog in the Dog Repository now?`)) {
            navigate(`/pets?action=add&rescue_case_id=${encodeURIComponent(caseId)}`);
          }
        }, 300);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to update status", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogFoundPetFromRescue = async (caseItem: RescueCaseTableRow) => {
    try {
      setIsSubmitting(true);
      const address = caseItem.location_address !== "-" ? String(caseItem.location_address || "") : "Rescue Location";
      const lat = caseItem.latitude && caseItem.latitude !== "-" ? Number(caseItem.latitude) : null;
      const lng = caseItem.longitude && caseItem.longitude !== "-" ? Number(caseItem.longitude) : null;
      const notes = [
        caseItem.physical_condition !== "-" ? `Physical Condition: ${String(caseItem.physical_condition)}` : "",
        caseItem.reporter_notes !== "-" ? `Reporter Notes: ${String(caseItem.reporter_notes)}` : "",
      ].filter(Boolean).join(" | ");

      const res = await lostFoundService.createFoundReport({
        species: "dog",
        breed_observed: "Rescued Dog",
        color_observed: "Mixed / Unspecified",
        location_address: address,
        latitude: lat,
        longitude: lng,
        found_at: new Date().toISOString(),
        marker_description: notes || `Secured via Rescue Case #${String(caseItem.ticket_number || caseItem.id || "")}`,
      });

      const reportId = (res as { data?: { id?: string }; id?: string })?.data?.id || (res as { id?: string })?.id;
      addToast(`Found pet report created for rescued dog! (${reportId ? `Report #${String(reportId).slice(0, 8)}` : "Saved"})`, "success");
      setIsCaseModalOpen(false);
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to log found pet report", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- COLUMNS FOR RESCUE CASES TABLE ---
  const caseColumns = [
    {
      key: "ticket_number",
      header: "Case ID",
      render: (val: string, row: RescueCaseTableRow) => (
        <span
          onClick={() => handleOpenCaseDetails(row, "details")}
          style={{
            color: "#2563EB",
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "13px",
            textDecoration: "underline",
          }}
        >
          {val}
        </span>
      ),
    },
    {
      key: "animal_count",
      header: "Dog / Animal",
      render: (val: string, row: RescueCaseTableRow) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FaDog color="#6366F1" size={14} />
          <span style={{ fontWeight: 600, fontSize: "13px" }}>
            {row.physical_condition !== "-" ? `${val} Dog (${row.physical_condition})` : `${val} Dog`}
          </span>
        </div>
      ),
    },
    { key: "location_address", header: "Location" },
    {
      key: "severity",
      header: "Severity",
      render: (val: string) => {
        const lower = String(val).toLowerCase();
        let bg = "#EFF6FF";
        let color = "#2563EB";
        if (lower.includes("critical") || lower.includes("high")) {
          bg = "#FEF2F2";
          color = "#DC2626";
        } else if (lower.includes("medium")) {
          bg = "#FFFBEB";
          color = "#D97706";
        }
        return (
          <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: bg, color }}>
            {val.toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Rescue Status",
      render: rescueStatusBadge,
    },
    {
      key: "dispatch_agents",
      header: "Assigned Agent",
      render: (val: string) => (
        <span style={{ fontWeight: val !== "-" ? 700 : 500, color: val !== "-" ? "#0F172A" : "#94A3B8" }}>
          {val !== "-" ? `👮 ${val}` : "Unassigned"}
        </span>
      ),
    },
    {
      key: "dispatch_vehicle",
      header: "Assigned Vehicle",
      render: (val: string) => (
        <span style={{ fontWeight: val !== "-" ? 700 : 500, color: val !== "-" ? "#2563EB" : "#94A3B8" }}>
          {val !== "-" ? `🚐 ${val}` : "Unassigned"}
        </span>
      ),
    },
    { key: "created_at", header: "Reported" },
    {
      key: "action",
      header: "Action",
      render: (_: unknown, row: RescueCaseTableRow) => {
        const rowStatus = toSafeLower(row.status);
        const isPendingRow = ["reported", "pending", "new", "submitted", "awaiting_triage"].includes(rowStatus);
        const isVerifiedRow = rowStatus === "verified";
        const hasAssignment = Boolean(
          row.has_dispatch ||
          row.coordinator_id ||
          (row.dispatch_agents && row.dispatch_agents !== "-") ||
          (row.dispatch_vehicle && row.dispatch_vehicle !== "-")
        );
        const isAwaitingAssignment = isVerifiedRow && !hasAssignment;

        if (isRescueCentreAdmin) {
          return (
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
              {isPendingRow && (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerifyCaseRow(row)}
                    disabled={isSubmitting}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#10B981",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCase(row);
                      setIsCaseModalOpen(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#EF4444",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                </>
              )}

              {isAwaitingAssignment && (
                <button
                  type="button"
                  onClick={() => handleOpenAssignModal(row)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaUserCheck size={12} /> Assign
                </button>
              )}

              {!isPendingRow && !isAwaitingAssignment && (
                rescueStatusBadge(row.status)
              )}
            </div>
          );
        }

        return (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleOpenCaseDetails(row, "details")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #93C5FD",
                background: "#EFF6FF",
                color: "#1D4ED8",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaEye size={12} /> View
            </button>
            <Can permission="assign_rescues">
              {isAwaitingAssignment ? (
                <button
                  onClick={() => handleOpenAssignModal(row)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaUserCheck size={12} /> Assign
                </button>
              ) : (
                rescueStatusBadge(row.status)
              )}
            </Can>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Rescue Management
          </h1>
          <p style={{ color: "#64748B", margin: "4px 0 0 0", fontSize: "14px" }}>
            Monitor and coordinate live dog rescue requests from the field. Click any row to view details &amp; track progress.
          </p>
        </div>

        <Can permission="create_rescues">
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
            }}
          >
            <FaPlus size={14} />
            <span>New Rescue Case</span>
          </button>
        </Can>
      </div>

      {/* DYNAMIC STATISTICS SECTION (RESPONSIVE GRID) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <StatCard
          title="Total Rescues"
          value={stats.total}
          icon={<FaLifeRing />}
          color="#2563EB"
          selected={activeTab === "cases" && statusFilter === "all" && severityFilter === "all"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("all");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Pending Rescues"
          value={stats.pending}
          icon={<FaClock />}
          color="#D97706"
          selected={activeTab === "cases" && statusFilter === "pending"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("pending");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Active Rescues"
          value={stats.active}
          icon={<FaAmbulance />}
          color="#2563EB"
          selected={activeTab === "cases" && statusFilter === "active"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("active");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Urgent Incidents"
          value={stats.urgent}
          icon={<FaExclamationTriangle />}
          color="#EF4444"
          selected={activeTab === "cases" && statusFilter === "urgent"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("urgent");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Critical Cases"
          value={stats.critical}
          icon={<FaMedkit />}
          color="#DC2626"
          selected={activeTab === "cases" && severityFilter === "critical"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("all");
            setSeverityFilter("critical");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Dispatched Cases"
          value={stats.dispatched}
          icon={<FaTruck />}
          color="#6366F1"
          selected={activeTab === "cases" && statusFilter === "dispatched"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("dispatched");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Completed Cases"
          value={stats.completed}
          icon={<FaCheckCircle />}
          color="#10B981"
          selected={activeTab === "cases" && statusFilter === "completed"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("completed");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
        <StatCard
          title="Cancelled Cases"
          value={stats.cancelled}
          icon={<FaTimes />}
          color="#64748B"
          selected={activeTab === "cases" && statusFilter === "cancelled"}
          onClick={() => {
            handleTabChange("cases");
            setStatusFilter("cancelled");
            setSeverityFilter("all");
            document.getElementById("rescue-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      {/* QUICK SUMMARY CARDS FOR AGENTS AND VEHICLES */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {/* Rescue Agents Card */}
        <div
          onClick={() => handleTabChange("agents")}
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaUserTie size={22} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Available Rescue Agents</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                {agentRoster.filter((a) => a.availability === "Available").length} / {agentRoster.length} Agents Available
              </div>
            </div>
          </div>
          <button style={{ border: "none", background: "transparent", color: "#2563EB", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            View All Agents <FaArrowRight size={12} />
          </button>
        </div>

        {/* Rescue Vehicles Card */}
        <div
          onClick={() => handleTabChange("vehicles")}
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FaCarSide size={22} />
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Rescue Vehicles Fleet</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                {vehicleStats.available} Available ({vehicleStats.onRescue} On Rescue, {vehicleStats.maintenance} Service)
              </div>
            </div>
          </div>
          <button style={{ border: "none", background: "transparent", color: "#059669", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            View All Vehicles <FaArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* TOP TAB NAVIGATION BAR */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid #E2E8F0", marginBottom: "20px" }}>
        <button
          onClick={() => handleTabChange("cases")}
          style={{
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: "14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: activeTab === "cases" ? "#2563EB" : "#64748B",
            borderBottom: activeTab === "cases" ? "3px solid #2563EB" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaClipboardList size={16} /> Rescue Cases ({cases.length})
        </button>
        <button
          onClick={() => handleTabChange("agents")}
          style={{
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: "14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: activeTab === "agents" ? "#2563EB" : "#64748B",
            borderBottom: activeTab === "agents" ? "3px solid #2563EB" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaUserTie size={16} /> Rescue Agents ({agentRoster.length})
        </button>
        <button
          onClick={() => handleTabChange("vehicles")}
          style={{
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: "14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: activeTab === "vehicles" ? "#2563EB" : "#64748B",
            borderBottom: activeTab === "vehicles" ? "3px solid #2563EB" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaTruck size={16} /> Rescue Vehicles ({vehicleFleet.length})
        </button>
      </div>

      {/* TAB 1: RESCUE CASES */}
      {activeTab === "cases" && (
        <div id="rescue-cases-section">
          {/* MULTI-FILTER TOOLBAR */}
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Search Cases</label>
              <div style={{ position: "relative", marginTop: "4px" }}>
                <FaSearch style={{ position: "absolute", left: "10px", top: "10px", color: "#94A3B8" }} />
                <input
                  type="text"
                  placeholder="Search ticket, reporter, address..."
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF" }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending / Reported</option>
                <option value="active">Active / In Progress</option>
                <option value="urgent">Urgent Incidents</option>
                <option value="dispatched">Dispatched</option>
                <option value="completed">Completed / Admitted</option>
                <option value="cancelled">Cancelled / Rejected</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF" }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Assigned Agent</label>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF" }}
              >
                <option value="all">All Agents</option>
                {agentRoster.map((a) => (
                  <option key={a.id} value={a.full_name}>{a.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Assigned Vehicle</label>
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF" }}
              >
                <option value="all">All Vehicles</option>
                {vehicleFleet.map((v) => (
                  <option key={v.id} value={v.vehicle_code}>{v.vehicle_code} ({v.registration_number})</option>
                ))}
              </select>
            </div>

            {(caseSearch || statusFilter !== "all" || severityFilter !== "all" || agentFilter !== "all" || vehicleFilter !== "all") && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCaseSearch("");
                    setStatusFilter("all");
                    setSeverityFilter("all");
                    setAgentFilter("all");
                    setVehicleFilter("all");
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F1F5F9",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* CASES TABLE */}
          <DataTable
            data={filteredCases}
            columns={caseColumns}
            loading={loading}
            error={error}
            onRetry={fetchAllData}
            module="rescues"
            pageSize={10}
            hideSearch={true}
            onRowClick={(row: RescueCaseTableRow) => handleOpenCaseDetails(row, "details")}
          />
        </div>
      )}

      {/* TAB 2: RESCUE AGENTS */}
      {activeTab === "agents" && (
        <div>
          {/* AGENT FILTERS */}
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "10px", top: "10px", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search agent by name, email, phone..."
                value={agentSearch}
                onChange={(e) => {
                  setAgentSearch(e.target.value);
                  setAgentPage(1);
                }}
                style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <select
              value={agentStatusFilter}
              onChange={(e) => {
                setAgentStatusFilter(e.target.value);
                setAgentPage(1);
              }}
              style={{ width: "180px", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* AGENTS ROSTER GRID (3 COLUMNS x 3 ROWS, MAX 9 PER PAGE) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", width: "100%", boxSizing: "border-box" }}>
            {paginatedAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setIsAgentModalOpen(true); }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "18px",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minWidth: 0,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#3B82F6", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "16px", flexShrink: 0 }}>
                      {agent.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                      <div style={{ fontWeight: 800, fontSize: "15px", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.full_name}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.role} • {agent.agent_code}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: agent.availability === "Available" ? "#ECFDF5" : "#FEF2F2",
                      color: agent.availability === "Available" ? "#059669" : "#DC2626",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.availability === "Available" ? "● AVAILABLE" : "○ BUSY ON RESCUE"}
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 <strong>Service Area:</strong> {agent.service_area}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🚐 <strong>Vehicle:</strong> {agent.assigned_vehicle}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📞 <strong>Contact:</strong> {agent.phone}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #F1F5F9", fontSize: "12px", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ color: "#64748B", whiteSpace: "nowrap" }}>Active Cases: <strong style={{ color: "#2563EB" }}>{agent.active_cases_count}</strong></span>
                  <span style={{ color: "#64748B", whiteSpace: "nowrap" }}>Total Completed: <strong style={{ color: "#059669" }}>{agent.completed_rescues_count}</strong></span>
                  <span style={{ color: "#2563EB", fontWeight: 700, whiteSpace: "nowrap" }}>Details →</span>
                </div>
              </div>
            ))}
          </div>

          {/* AGENT PAGINATION CONTROLS */}
          {totalAgentPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", padding: "12px 16px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "13px", color: "#64748B" }}>
                Page <strong>{agentPage}</strong> of <strong>{totalAgentPages}</strong>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  disabled={agentPage <= 1}
                  onClick={() => setAgentPage((prev) => Math.max(1, prev - 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: agentPage <= 1 ? "#F1F5F9" : "#FFFFFF",
                    color: agentPage <= 1 ? "#94A3B8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: agentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={agentPage >= totalAgentPages}
                  onClick={() => setAgentPage((prev) => Math.min(totalAgentPages, prev + 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: agentPage >= totalAgentPages ? "#F1F5F9" : "#FFFFFF",
                    color: agentPage >= totalAgentPages ? "#94A3B8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: agentPage >= totalAgentPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESCUE VEHICLES */}
      {activeTab === "vehicles" && (
        <div>
          {/* VEHICLE FILTERS */}
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "10px", top: "10px", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search vehicle code, plate, model..."
                value={vehicleSearch}
                onChange={(e) => {
                  setVehicleSearch(e.target.value);
                  setVehiclePage(1);
                }}
                style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <select
              value={vehicleStatusFilter}
              onChange={(e) => {
                setVehicleStatusFilter(e.target.value);
                setVehiclePage(1);
              }}
              style={{ width: "180px", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="on rescue">On Rescue</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* VEHICLE FLEET GRID (3 COLUMNS x 3 ROWS, MAX 9 PER PAGE) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px", width: "100%", boxSizing: "border-box" }}>
            {paginatedVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => { setSelectedVehicle(vehicle); setIsVehicleModalOpen(true); }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "18px",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minWidth: 0,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 800, fontSize: "16px", color: "#0F172A", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehicle.vehicle_code}</div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehicle.model} ({vehicle.registration_number})</div>
                  </div>

                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: vehicle.status === "Available" ? "#ECFDF5" : vehicle.status === "On Rescue" ? "#EFF6FF" : "#FEF2F2",
                      color: vehicle.status === "Available" ? "#059669" : vehicle.status === "On Rescue" ? "#2563EB" : "#DC2626",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vehicle.status === "Available" ? "● READY" : vehicle.status === "On Rescue" ? "🚑 ON RESCUE" : "🔧 SERVICE"}
                  </span>
                </div>

                <div style={{ fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px", minWidth: 0, overflow: "hidden" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👮 <strong>Primary Driver:</strong> {vehicle.assigned_driver}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 <strong>Base Location:</strong> {vehicle.location}</div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⚓ <strong>Capacity Used:</strong> <strong style={{ color: "#2563EB" }}>{vehicle.capacity_used} / {vehicle.capacity} Dogs</strong></div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #F1F5F9", fontSize: "12px", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ color: "#64748B", whiteSpace: "nowrap" }}>Fuel Level: <strong>{vehicle.fuel_level}</strong></span>
                  <span style={{ color: "#2563EB", fontWeight: 700, whiteSpace: "nowrap" }}>Fleet Details →</span>
                </div>
              </div>
            ))}
          </div>

          {/* VEHICLE PAGINATION CONTROLS */}
          {totalVehiclePages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", padding: "12px 16px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "13px", color: "#64748B" }}>
                Page <strong>{vehiclePage}</strong> of <strong>{totalVehiclePages}</strong>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  disabled={vehiclePage <= 1}
                  onClick={() => setVehiclePage((prev) => Math.max(1, prev - 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: vehiclePage <= 1 ? "#F1F5F9" : "#FFFFFF",
                    color: vehiclePage <= 1 ? "#94A3B8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: vehiclePage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={vehiclePage >= totalVehiclePages}
                  onClick={() => setVehiclePage((prev) => Math.min(totalVehiclePages, prev + 1))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: vehiclePage >= totalVehiclePages ? "#F1F5F9" : "#FFFFFF",
                    color: vehiclePage >= totalVehiclePages ? "#94A3B8" : "#334155",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: vehiclePage >= totalVehiclePages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL 1: RESCUE CASE DETAILS MODAL --- */}
      {isRescueCentreAdmin ? (
        <RescueDetailModal
          isOpen={isCaseModalOpen}
          onClose={() => setIsCaseModalOpen(false)}
          rescue={selectedCase}
          onRefresh={fetchAllData}
          users={users}
          vehicles={vehicles}
        />
      ) : (
        selectedCase && (
          <Modal
            isOpen={isCaseModalOpen}
            onClose={() => setIsCaseModalOpen(false)}
            title={`Rescue Incident #${selectedCase.ticket_number}`}
          >
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", marginBottom: "16px" }}>
              <button
                onClick={() => setDetailTab("details")}
                style={{
                  padding: "8px 16px",
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  color: detailTab === "details" ? "#2563EB" : "#64748B",
                  borderBottom: detailTab === "details" ? "2px solid #2563EB" : "none",
                  cursor: "pointer",
                }}
              >
                Incident Details
              </button>
              <button
                onClick={() => setDetailTab("tracking")}
                style={{
                  padding: "8px 16px",
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  color: detailTab === "tracking" ? "#2563EB" : "#64748B",
                  borderBottom: detailTab === "tracking" ? "2px solid #2563EB" : "none",
                  cursor: "pointer",
                }}
              >
                Rescue Timeline &amp; Progress Stepper
              </button>
            </div>

            {detailTab === "details" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* CASE SUMMARY HEADER */}
                <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Severity Level</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#DC2626" }}>{selectedCase.severity.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Current Status</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#2563EB" }}>{selectedCase.status.toUpperCase()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Reported Time</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{selectedCase.created_at}</div>
                  </div>
                </div>

                {/* DOG INFORMATION */}
                <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaDog color="#6366F1" /> Dog / Animal Condition Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                    <div><strong>Count / Dog:</strong> {selectedCase.animal_count} Dog</div>
                    <div><strong>Physical Condition:</strong> {selectedCase.physical_condition}</div>
                    <div><strong>Behavioral Notes:</strong> {selectedCase.behavioral_indicators}</div>
                    <div><strong>Environmental Factors:</strong> {selectedCase.environmental_factors}</div>
                  </div>
                </div>

                {/* REPORTER INFORMATION */}
                <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaUser color="#2563EB" /> Reporter Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                    <div><strong>Reporter Name:</strong> {selectedCase.reporter_name}</div>
                    <div><strong>Phone:</strong> {selectedCase.reporter_phone}</div>
                    <div><strong>Email:</strong> {selectedCase.reporter_email}</div>
                    <div><strong>Notes:</strong> {selectedCase.reporter_notes}</div>
                  </div>
                </div>

                {/* LOCATION & MAP PREVIEW */}
                <div>
                  <LocationMapPreview
                    latitude={selectedCase.latitude}
                    longitude={selectedCase.longitude}
                    locationAddress={selectedCase.location_address}
                    height="220px"
                    title="Rescue Incident Field Location"
                  />
                </div>

                {/* ASSIGNMENT INFORMATION */}
                <div style={{ background: "#EFF6FF", padding: "12px", borderRadius: "8px", border: "1px solid #93C5FD" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#1E40AF", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaUserCheck /> Current Operational Assignment
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", color: "#1E3A8A" }}>
                    <div><strong>Assigned Agent:</strong> {selectedCase.dispatch_agents}</div>
                    <div><strong>Assigned Vehicle:</strong> {selectedCase.dispatch_vehicle}</div>
                    <div><strong>Dispatch Driver:</strong> {selectedCase.dispatch_driver}</div>
                    <div><strong>Coordinator:</strong> {selectedCase.coordinator_id || "Unassigned"}</div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setIsStatusUpdateOpen(true)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid #D97706",
                      background: "#FFFBEB",
                      color: "#D97706",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    ⚡ Update Status
                  </button>
                  <button
                    onClick={() => handleLogFoundPetFromRescue(selectedCase)}
                    disabled={isSubmitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid #10B981",
                      background: "#ECFDF5",
                      color: "#059669",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    🐾 Log Found Pet Report
                  </button>
                  <button
                    onClick={() => handleOpenAssignModal(selectedCase)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#2563EB",
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    👮 Assign Agent &amp; Vehicle
                  </button>
                </div>
              </div>
            ) : (
              /* TIMELINE STEPPER */
              <div style={{ padding: "12px 0" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "16px", color: "#0F172A" }}>
                  Chronological Rescue Lifecycle Timeline
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {[
                    { title: "Rescue Request Submitted", time: selectedCase.created_at, done: true },
                    { title: "Coordinator Reviewed & Verified", time: selectedCase.created_at, done: true },
                    { title: "Dispatch Team & Vehicle Assigned", time: selectedCase.dispatched_at, done: selectedCase.has_dispatch },
                    { title: "Agent En Route to Field Scene", time: selectedCase.dispatched_at, done: selectedCase.has_dispatch },
                    { title: "Agent Arrived & Dog Located", time: selectedCase.located_at, done: selectedCase.located_at !== "-" },
                    { title: "Dog Rescued & Secured", time: selectedCase.rescued_at, done: selectedCase.rescued_at !== "-" },
                    { title: "Transferred to Shelter / Vet Clinic", time: selectedCase.admitted_at, done: selectedCase.admitted_at !== "-" },
                    { title: "Rescue Mission Completed", time: selectedCase.updated_at, done: selectedCase.status.toLowerCase().includes("completed") || selectedCase.status.toLowerCase().includes("admitted") },
                  ].map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: step.done ? "#10B981" : "#E2E8F0", color: step.done ? "#FFF" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 800 }}>
                        {step.done ? "✓" : i + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: step.done ? "#0F172A" : "#94A3B8" }}>{step.title}</div>
                        <div style={{ fontSize: "11px", color: "#64748B" }}>Timestamp: {step.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Modal>
        )
      )}

      {/* --- MODAL 2: RESCUE AGENT DETAILS MODAL --- */}
      {selectedAgent && (
        <Modal
          isOpen={isAgentModalOpen}
          onClose={() => setIsAgentModalOpen(false)}
          title={`Rescue Agent Profile: ${selectedAgent.full_name}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#F8FAFC", padding: "16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#2563EB", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 800 }}>
                {selectedAgent.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedAgent.full_name}</h3>
                <div style={{ fontSize: "13px", color: "#64748B" }}>{selectedAgent.role} • ID: {selectedAgent.agent_code}</div>
                <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 700, marginTop: "2px" }}>{selectedAgent.service_area}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Email:</strong> {selectedAgent.email}</div>
              <div><strong>Phone:</strong> {selectedAgent.phone}</div>
              <div><strong>Operational Shift:</strong> {selectedAgent.shift}</div>
              <div><strong>Assigned Vehicle:</strong> {selectedAgent.assigned_vehicle}</div>
              <div><strong>Experience:</strong> {selectedAgent.experience_years} Years</div>
              <div><strong>Status:</strong> {selectedAgent.availability}</div>
            </div>

            {/* CURRENT ASSIGNMENT */}
            {selectedAgent.current_assignment ? (
              <div style={{ background: "#EFF6FF", border: "1px solid #93C5FD", borderRadius: "8px", padding: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#1E40AF", marginBottom: "4px" }}>🚑 CURRENT ACTIVE RESCUE ASSIGNMENT</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E3A8A" }}>
                  Case #{selectedAgent.current_assignment.ticket_number} — Location: {selectedAgent.current_assignment.location_address}
                </div>
              </div>
            ) : (
              <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: "8px", padding: "10px", fontSize: "13px", color: "#065F46", fontWeight: 600 }}>
                ✓ Agent is currently available for immediate field dispatch.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* --- MODAL 3: RESCUE VEHICLE DETAILS MODAL --- */}
      {selectedVehicle && (
        <Modal
          isOpen={isVehicleModalOpen}
          onClose={() => setIsVehicleModalOpen(false)}
          title={`Fleet Vehicle Unit: ${selectedVehicle.vehicle_code}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "10px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>{selectedVehicle.vehicle_code}</h3>
                <div style={{ fontSize: "13px", color: "#64748B" }}>{selectedVehicle.model} ({selectedVehicle.registration_number})</div>
              </div>
              <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, background: selectedVehicle.status === "Available" ? "#ECFDF5" : "#EFF6FF", color: selectedVehicle.status === "Available" ? "#059669" : "#2563EB" }}>
                {selectedVehicle.status.toUpperCase()}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Primary Driver:</strong> {selectedVehicle.assigned_driver}</div>
              <div><strong>Base Depot:</strong> {selectedVehicle.location}</div>
              <div><strong>Capacity Used:</strong> {selectedVehicle.capacity_used} / {selectedVehicle.capacity} Dogs</div>
              <div><strong>Fuel Level:</strong> {selectedVehicle.fuel_level}</div>
            </div>

            {/* EQUIPMENT CHECKLIST */}
            <div style={{ background: "#FFF", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A", marginBottom: "8px" }}>🚑 ONBOARD EMERGENCY EQUIPMENT CHECKLIST</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
                <div>✓ Pet Isolation Carriers</div>
                <div>✓ Veterinary First Aid Kit</div>
                <div>✓ Emergency Oxygen Unit</div>
                <div>✓ Restraint Equipment &amp; Nets</div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* --- MODAL 4: ASSIGNMENT MODAL --- */}
      <RescueAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        rescue={selectedCase}
        onRefresh={fetchAllData}
        users={users}
        vehicles={vehicles}
      />

      {/* --- MODAL 5: NEW RESCUE CASE MODAL --- */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Report New Field Rescue Case">
        <form onSubmit={handleCreateCase} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700 }}>Field Location Address *</label>
            <input type="text" required value={formData.location_address} onChange={(e) => setFormData({ ...formData, location_address: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Severity</label>
              <select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}>
                {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Physical Condition</label>
              <select value={formData.physical_condition} onChange={(e) => setFormData({ ...formData, physical_condition: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }}>
                {PHYSICAL_CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Reporter Name</label>
              <input type="text" value={formData.reporter_name} onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Reporter Phone</label>
              <input type="text" value={formData.reporter_phone} onChange={(e) => setFormData({ ...formData, reporter_phone: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "6px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 700 }}>
              {isSubmitting ? "Submitting..." : "Report Case"}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 6: UPDATE RESCUE STATUS MODAL --- */}
      {selectedCase && (
        <Modal
          isOpen={isStatusUpdateOpen}
          onClose={() => setIsStatusUpdateOpen(false)}
          title={`Update Rescue Progress — Case #${selectedCase.ticket_number}`}
        >
          <form onSubmit={handleUpdateStatus} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>Select New Operational Status</label>
              <select
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", marginTop: "4px", background: "#FFF" }}
                required
              >
                <option value="">-- Choose Status --</option>
                <option value="verified">Verified / Approved</option>
                <option value="dispatched">Dispatched</option>
                <option value="en_route">En Route to Field</option>
                <option value="arrived">Arrived at Scene</option>
                <option value="in_progress">Rescue In Progress</option>
                <option value="located">Dog Located</option>
                <option value="secured">Dog Secured</option>
                <option value="admitted">Admitted to Shelter / Vet</option>
                <option value="completed">Rescue Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button type="button" onClick={() => setIsStatusUpdateOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
              <button type="submit" disabled={isSubmitting} style={{ padding: "8px 16px", borderRadius: "6px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 700 }}>
                {isSubmitting ? "Updating..." : "Update Status"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default RescueManagement;
