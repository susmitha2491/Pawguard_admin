import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import Modal from "../../../components/common/Modal";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import {
  FaAmbulance,
  FaPaw,
  FaHome,
  FaChartBar,
  FaUsers,
  FaSync,
  FaEye,
  FaUser,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaClock,
  FaInfoCircle,
  FaTruck,
} from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import rescueService from "../../../services/rescueService";
import dogService from "../../../services/dogService";
import shelterService from "../../../services/shelterService";
import vehicleService from "../../../services/vehicleService";
import { rescueStatusBadge, dispatchStage, dispatchAgentNames } from "../../../utils/rescueStatus";
import { useDataSync } from "../../../utils/dataSync";
import { normalizeRole, getCurrentUser, getRescueCentreId } from "../../../utils/roleUtils";
import { formatDateTime } from "../../../utils/dateUtils";
import { unwrapList } from "../../../utils/chartUtils";
import LocationMapPreview from "../../../components/common/LocationMapPreview";
import type { RescueRequestTableRow } from "../../rescues/RescueRequests";

interface RescueCallRow {
  id: string;
  ticket: string;
  reporter: string;
  animal_count: number;
  status: string;
  dispatch_status: string;
  agent: string;
  created_at: string;
  rawItem: Record<string, unknown>;
}

interface DispatchRow {
  id: string;
  case_id: string;
  ticket_number: string;
  vehicle_number: string;
  driver_name: string;
  agents: string;
  status: string;
  dispatch_time: string;
  rawItem: Record<string, unknown>;
}

interface DogIntakeRow {
  id: string;
  rescue_ticket: string;
  name: string;
  registration_number: string;
  intake_date: string;
  shelter_name: string;
  intake_status: string;
  care_status: string;
  rawItem: Record<string, unknown>;
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: "3px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
  display: "inline-block",
  textTransform: "uppercase",
});

const mapRescueCallRowToDetail = (row: RescueCallRow): RescueRequestTableRow => {
  const raw = row.rawItem;
  const stage = dispatchStage({ status: raw.status as string, dispatch: raw.dispatch as Record<string, unknown> });
  const dispatchObj = (raw.dispatch as Record<string, unknown>) || null;
  const assignedAgentId = String(raw.assigned_agent_id || raw.agent_id || (dispatchObj as any)?.agent_id || "");
  const assignedAgentName = String(raw.assigned_agent_name || raw.assigned_agent || (dispatchObj as any)?.agent_name || (assignedAgentId ? `Agent (${assignedAgentId})` : ""));
  const assignedVehicleId = String(raw.assigned_vehicle_id || (dispatchObj as any)?.vehicle_id || "");
  const assignedVehicleNumber = String(raw.assigned_vehicle_number || raw.assigned_vehicle || (dispatchObj as any)?.vehicle_number || (assignedVehicleId ? `Vehicle (${assignedVehicleId})` : ""));
  const latVal = raw.latitude !== undefined && raw.latitude !== null ? (raw.latitude as number | string) : ((raw.location as any)?.latitude);
  const lngVal = raw.longitude !== undefined && raw.longitude !== null ? (raw.longitude as number | string) : ((raw.location as any)?.longitude);
  const landmarkVal = raw.location_landmark || raw.landmark;

  return {
    id: row.id,
    ticket_number: String(raw.ticket_number || row.ticket || ""),
    reporter: (raw.is_anonymous || raw.anonymous)
      ? "Anonymous Reporter"
      : String(raw.reporter_name || row.reporter || "Unknown Reporter"),
    phone: String(raw.reporter_phone || raw.phone || "Not provided"),
    location: String(raw.location_address || raw.location || "Location not recorded"),
    latitude: latVal !== undefined && latVal !== null ? latVal : undefined,
    longitude: lngVal !== undefined && lngVal !== null ? lngVal : undefined,
    location_landmark: landmarkVal ? String(landmarkVal) : undefined,
    condition: String(raw.physical_condition || "-"),
    severity: String(raw.severity || raw.urgency_level || "medium").toLowerCase(),
    is_urgent: !!raw.is_urgent,
    status: String(raw.status || "reported").toLowerCase(),
    rejection_rationale: String(raw.rejection_rationale || raw.rejection_reason || ""),
    assigned_agent_id: assignedAgentId,
    assigned_agent_name: assignedAgentName,
    assigned_vehicle_id: assignedVehicleId,
    assigned_vehicle_number: assignedVehicleNumber,
    dispatch: dispatchObj,
    dispatch_status: stage.label,
    dispatch_bg: stage.bg,
    dispatch_color: stage.color,
    reports: (raw.reports as Record<string, unknown>[]) || [],
    media_urls: (raw.media_urls as string[]) || [],
    date: String(raw.created_at || raw.date || row.created_at || ""),
    raw,
  };
};

const safeText = (val: any, fallback = "—"): string => {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "object") {
    return String(val.name || val.label || val.title || val.ticket_number || val.id || fallback);
  }
  return String(val);
};

const LIFECYCLE_STEPS = [
  { key: "reported", label: "Reported" },
  { key: "verified", label: "Verified" },
  { key: "dispatched", label: "Dispatched" },
  { key: "en_route", label: "En Route" },
  { key: "located", label: "Located" },
  { key: "secured", label: "Secured" },
  { key: "admitted", label: "Admitted" },
];

const getStepIndex = (statusStr?: string): number => {
  const s = String(statusStr || "").toLowerCase();
  if (s === "submitted" || s === "reported") return 0;
  if (s === "verified") return 1;
  if (s === "dispatched" || s === "accepted") return 2;
  if (s === "en_route" || s === "in_progress") return 3;
  if (s === "located") return 4;
  if (s === "secured" || s === "rescued") return 5;
  if (s === "admitted" || s === "completed") return 6;
  return -1;
};

const RescueCentreAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"rescues" | "dispatches" | "intake" | "agents" | "vehicles">("rescues");
  
  const [selectedCase, setSelectedCase] = useState<RescueRequestTableRow | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchRow | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedIntake, setSelectedIntake] = useState<DogIntakeRow | null>(null);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);

  // Data Stores
  const [rescueCalls, setRescueCalls] = useState<RescueCallRow[]>([]);
  const [dispatchesList, setDispatchesList] = useState<DispatchRow[]>([]);
  const [dogIntakes, setDogIntakes] = useState<DogIntakeRow[]>([]);
  const [rescueAgents, setRescueAgents] = useState<any[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<any[]>([]);

  // Headline Operational Metrics
  const [statsData, setStatsData] = useState({
    totalCalls: 0,
    pendingCalls: 0,
    activeDispatches: 0,
    shelterDogsCount: 0,
    availableAgentsCount: 0,
    totalAgentsCount: 0,
    availableVehiclesCount: 0,
    totalVehiclesCount: 0,
    shelterOccupancy: 0,
    totalShelterCapacity: 0,
  });

  const getSafeVal = (val: any, fallback = "—") => {
    if (val === undefined || val === null || val === "") return fallback;
    return String(val);
  };

  const getVehicleAssignment = (vehicle: any) => {
    if (!vehicle) return "Unassigned";
    const activeCall = rescueCalls.find((c) => {
      const raw = c.rawItem as any;
      const isAssigned =
        String(raw?.assigned_vehicle_id || raw?.dispatch?.vehicle_id || "") === String(vehicle.id) ||
        String(raw?.assigned_vehicle_number || raw?.dispatch?.vehicle_number || "") === String(vehicle.vehicle_number) ||
        String(raw?.assigned_vehicle_number || raw?.dispatch?.vehicle_number || "") === String(vehicle.registration_number);
      const isActive = ["accepted", "dispatched", "in_progress"].includes(String(c.status).toLowerCase());
      return isAssigned && isActive;
    });
    return activeCall ? `Case ${activeCall.ticket || activeCall.id}` : "Unassigned";
  };

  const getVehicleDriver = (vehicle: any) => {
    if (!vehicle) return "Unassigned";
    const activeCall = rescueCalls.find((c) => {
      const raw = c.rawItem as any;
      const isAssigned =
        String(raw?.assigned_vehicle_id || raw?.dispatch?.vehicle_id || "") === String(vehicle.id) ||
        String(raw?.assigned_vehicle_number || raw?.dispatch?.vehicle_number || "") === String(vehicle.vehicle_number) ||
        String(raw?.assigned_vehicle_number || raw?.dispatch?.vehicle_number || "") === String(vehicle.registration_number);
      const isActive = ["accepted", "dispatched", "in_progress"].includes(String(c.status).toLowerCase());
      return isAssigned && isActive;
    });
    if (activeCall) {
      const raw = activeCall.rawItem as any;
      const agentName = raw?.assigned_agent_name || raw?.assigned_agent || raw?.dispatch?.agent_name;
      if (agentName) return String(agentName);
    }
    return vehicle.assigned_driver && vehicle.assigned_driver !== "Unassigned" ? String(vehicle.assigned_driver) : "Unassigned";
  };

  const getVehicleAvailability = (vehicle: any) => {
    if (!vehicle) return "Not Available";
    const statusLower = String(vehicle.status || "").toLowerCase();
    if (statusLower.includes("maintenance") || statusLower.includes("repair")) {
      return "In Maintenance";
    }
    if (statusLower.includes("out") || statusLower.includes("service") || statusLower.includes("offline")) {
      return "Out of Service";
    }
    const assignment = getVehicleAssignment(vehicle);
    return assignment !== "Unassigned" ? "Busy (On Call)" : "Available";
  };

  const getAgentAssignment = (agentId: string) => {
    const activeCall = rescueCalls.find((c) => {
      const raw = c.rawItem as any;
      const isAssigned = String(raw?.assigned_agent_id || raw?.agent_id || raw?.dispatch?.agent_id || "") === String(agentId);
      const isActive = ["accepted", "dispatched", "in_progress"].includes(String(c.status).toLowerCase());
      return isAssigned && isActive;
    });
    return activeCall ? `Case ${activeCall.ticket || activeCall.id}` : "Unassigned";
  };

  const getAgentAvailability = (agent: any) => {
    if (!agent || agent.is_active === false || agent.status === "Inactive") {
      return "Not Available";
    }
    const assignment = getAgentAssignment(agent.id);
    return assignment !== "Unassigned" ? "Busy (On Call)" : "Available";
  };



  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUserObj = getCurrentUser();
      const currentRole = normalizeRole(currentUserObj);
      const isRescueAdmin = currentRole === "rescue_centre_admin";
      const currentCentreId = getRescueCentreId(currentUserObj);

      // Rescue Centre Admin has operational access across ALL locations.
      // Do not restrict queries to a single rescue_centre_id for rescue_centre_admin.
      const scopeParams = !isRescueAdmin && currentCentreId ? { rescue_centre_id: currentCentreId } : {};

      const [
        dashRes,
        casesRes,
        dispatchesRes,
        dogsRes,
        sheltersRes,
        vehiclesRes,
        agentsAvailRes,
        vehiclesAvailRes,
      ] = await Promise.allSettled([
        dashboardService.getRescueCentreDashboard(scopeParams),
        rescueService.getAllRescueCases(scopeParams),
        rescueService.getDispatches({ page_size: 500, ...scopeParams }),
        dogService.getAllDogs(scopeParams),
        shelterService.getShelters(scopeParams),
        vehicleService.getVehicles(scopeParams),
        rescueService.getAgentAvailability(scopeParams),
        rescueService.getVehicleAvailability(scopeParams),
      ]);

      const dashData = dashRes.status === "fulfilled" ? dashRes.value?.data || dashRes.value || {} : {};
      const casesList = casesRes.status === "fulfilled" ? unwrapList(casesRes.value?.data ?? casesRes.value) : [];
      const dispatchesRawList = dispatchesRes.status === "fulfilled" ? unwrapList(dispatchesRes.value) : [];
      const dogsList = dogsRes.status === "fulfilled" ? unwrapList(dogsRes.value) : [];
      const sheltersData = sheltersRes.status === "fulfilled" ? unwrapList(sheltersRes.value) : [];
      const vehiclesList = vehiclesRes.status === "fulfilled" ? unwrapList(vehiclesRes.value) : [];
      const agentsAvailList = agentsAvailRes.status === "fulfilled" ? unwrapList(agentsAvailRes.value) : [];
      const vehiclesAvailList = vehiclesAvailRes.status === "fulfilled" ? unwrapList(vehiclesAvailRes.value) : [];

      // Process Resource Availability from Backend Agent Availability API
      setRescueAgents(agentsAvailList);
      setFleetVehicles(vehiclesList);

      // 1. Process Recent Rescue Calls
      const recentCalls: RescueCallRow[] = casesList.map((item: any) => {
        const rawStatus = String(item.status || "").toLowerCase();
        const dispatchObj = item.dispatch || null;
        const hasAssignment = !!(item.coordinator_id || item.assigned_agent_id || item.assigned_agent || item.agent_id || dispatchObj);
        const displayStatus = (rawStatus === "verified" && hasAssignment) ? "accepted" : rawStatus;

        const stage = dispatchStage({ status: displayStatus, dispatch: dispatchObj });
        const agentsInfo = dispatchAgentNames(dispatchObj);
        return {
          id: item.id || "",
          ticket: item.ticket_number || item.id || "-",
          reporter: item.reporter_name || "-",
          animal_count: item.animal_count ?? 1,
          status: displayStatus,
          dispatch_status: stage.label,
          agent: agentsInfo.agents.length > 0 ? agentsInfo.agents.join(", ") : "-",
          created_at: item.created_at || "",
          rawItem: item,
        };
      });

      // 2. Process Actual Dispatches Backend Data
      const processedDispatches: DispatchRow[] = dispatchesRawList.map((d: any) => ({
        id: String(d.id || d.dispatch_id || "-"),
        case_id: String(d.case_id || d.request_id || d.rescue_case_id || "-"),
        ticket_number: String(d.ticket_number || d.case_ticket || d.case_id || "-"),
        vehicle_number: String(d.assigned_vehicle_number || d.vehicle_number || d.vehicle_id || "Unassigned"),
        driver_name: String(d.assigned_driver_name || d.driver_name || d.driver_id || "Unassigned"),
        agents: Array.isArray(d.assigned_agents)
          ? d.assigned_agents.join(", ")
          : String(d.assigned_agent_name || d.agent_name || d.agent_id || "Unassigned"),
        status: String(d.status || "dispatched").toUpperCase(),
        dispatch_time: String(d.dispatch_time || d.dispatched_at || d.created_at || ""),
        rawItem: d,
      }));

      // 3. Process Shelter Dog Master Intakes
      const intakes: DogIntakeRow[] = dogsList
        .filter((d: any) => String(d.status || "").toLowerCase() === "rescued")
        .map((d: any) => ({
          id: String(d.id || d.dog_id || "-"),
          rescue_ticket: String(d.rescue_case_id || d.rescue_id || d.rescue_case?.ticket_number || d.rescue_case?.id || "—"),
          name: String(d.name || "Unnamed Dog"),
          registration_number: String(d.registration_number || "-"),
          intake_date: String(d.created_at || d.intake_date || ""),
          shelter_name: String(d.shelter_name || d.shelter_id || "Central Shelter"),
          intake_status: String(d.status || "rescued"),
          care_status: String(d.medical_status || "Pending Check"),
          rawItem: d,
        }));

      // 4. Calculate Operational Metrics
      const pendingCases = casesList.filter((c: any) => {
        const s = String(c.status || "").toLowerCase();
        return s === "pending" || s === "reported" || s === "requested";
      }).length;

      const activeDispatchesCount = dispatchesRawList.length > 0
        ? dispatchesRawList.filter((d: any) => !["completed", "cancelled", "returned"].includes(String(d.status || "").toLowerCase())).length
        : casesList.filter((c: any) => ["dispatched", "en_route", "on_site"].includes(String(c.status || "").toLowerCase())).length;

      const availableAgents = agentsAvailList.length;

      const availableVehicles = vehiclesAvailList.length > 0
        ? vehiclesAvailList.length
        : vehiclesList.filter((v: any) => getVehicleAvailability(v) === "Available").length;

      let totalCap = 0;
      let totalOcc = 0;
      sheltersData.forEach((s: any) => {
        totalCap += Number(s.total_capacity || s.capacity || 0);
        totalOcc += Number(s.current_occupancy || s.occupancy || s.dog_count || 0);
      });

      setRescueCalls(recentCalls);
      setDispatchesList(processedDispatches);
      setDogIntakes(intakes);

      setStatsData({
        totalCalls: casesList.length,
        pendingCalls: dashData.pending ?? dashData.pendingCases ?? pendingCases,
        activeDispatches: dashData.dispatched ?? dashData.dispatchedCases ?? activeDispatchesCount,
        shelterDogsCount: intakes.length,
        availableAgentsCount: availableAgents,
        totalAgentsCount: agentsAvailList.length,
        availableVehiclesCount: availableVehicles,
        totalVehiclesCount: vehiclesList.length,
        shelterOccupancy: totalOcc,
        totalShelterCapacity: totalCap > 0 ? totalCap : 100,
      });
    } catch (err: any) {
      console.error("Rescue Centre Admin Dashboard Error:", err);
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load rescue centre metrics. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useDataSync(fetchDashboardData);

  const stats = [
    {
      title: "Total Rescue Requests",
      value: loading ? "..." : String(statsData.totalCalls),
      trend: `${statsData.pendingCalls} Pending Triage`,
      color: "#1E3A8A",
      icon: <FaAmbulance />,
      onClick: () => navigate("/rescue-requests"),
    },
    {
      title: "Active Dispatches",
      value: loading ? "..." : String(statsData.activeDispatches),
      trend: "Units En-Route / On-Site",
      color: "#16A34A",
      icon: <FaTruck />,
      onClick: () => navigate("/rescue-dispatch"),
    },
    {
      title: "Shelter Dog Intakes",
      value: loading ? "..." : String(statsData.shelterDogsCount),
      trend: "Post-Rescue Handover",
      color: "#1E3A8A",
      icon: <FaPaw />,
      onClick: () => setActiveTab("intake"),
    },
    {
      title: "Available Agents",
      value: loading ? "..." : `${statsData.availableAgentsCount} / ${statsData.totalAgentsCount}`,
      trend: "Ready for Dispatch",
      color: "#16A34A",
      icon: <FaUsers />,
      onClick: () => setActiveTab("agents"),
    },
    {
      title: "Fleet Vehicles Available",
      value: loading ? "..." : `${statsData.availableVehiclesCount} / ${statsData.totalVehiclesCount}`,
      trend: "Rescue Vans Ready",
      color: "#16A34A",
      icon: <FaTruck />,
      onClick: () => setActiveTab("vehicles"),
    },
    {
      title: "Shelter Occupancy",
      value: loading ? "..." : `${statsData.shelterOccupancy} / ${statsData.totalShelterCapacity}`,
      trend: "Kennel Capacity",
      color: "#1E3A8A",
      icon: <FaHome />,
      onClick: () => navigate("/shelters"),
    },
  ];

  const rescueColumns = [
    { key: "ticket", header: "Ticket Number" },
    { key: "reporter", header: "Reporter" },
    { key: "animal_count", header: "Dogs" },
    {
      key: "status",
      header: "Rescue Status",
      render: rescueStatusBadge,
    },
    {
      key: "dispatch_status",
      header: "Dispatch Stage",
      render: (_val: string, row: any) => {
        const stage = dispatchStage({ status: row.status });
        return (
          <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: stage.bg, color: stage.color }}>
            {stage.label}
          </span>
        );
      },
    },
    { key: "agent", header: "Assigned Agent" },
    {
      key: "created_at",
      header: "Reported At",
      render: (v: string) => (v ? formatDateTime(v) : "-"),
    },
  ];

  const dispatchColumns = [
    { key: "id", header: "Dispatch ID", render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{v}</span> },
    { key: "ticket_number", header: "Rescue Ticket #" },
    { key: "vehicle_number", header: "Vehicle Assigned" },
    { key: "driver_name", header: "Driver / Lead Agent" },
    { key: "agents", header: "Dispatch Team" },
    {
      key: "status",
      header: "Dispatch Stage",
      render: (v: string) => {
        const s = String(v || "").toLowerCase();
        const isCompleted = s === "completed";
        const isEnRoute = s.includes("route") || s.includes("dispatch");
        return (
          <span style={badgeStyle(isCompleted ? "#ECFDF5" : isEnRoute ? "#EFF6FF" : "#FFFBEB", isCompleted ? "#15803D" : isEnRoute ? "#1E3A8A" : "#D97706")}>
            {v}
          </span>
        );
      },
    },
    { key: "dispatch_time", header: "Dispatched At", render: (v: string) => (v ? formatDateTime(v) : "—") },
  ];

  const intakeColumns = [
    { key: "id", header: "Intake / Record ID", render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{v}</span> },
    { key: "rescue_ticket", header: "Rescue / Ticket Number", render: (v: string) => v || "—" },
    { key: "name", header: "Dog Name" },
    { key: "registration_number", header: "Dog Registration / Master ID", render: (v: string) => v || "—" },
    { key: "intake_date", header: "Intake Date", render: (v: string) => v ? formatDateTime(v) : "—" },
    { key: "shelter_name", header: "Shelter / Facility" },
    {
      key: "intake_status",
      header: "Intake Status",
      render: (v: string) => (
        <span style={badgeStyle("#EFF6FF", "#1E3A8A")}>
          {String(v || "rescued").toUpperCase()}
        </span>
      ),
    },
    {
      key: "care_status",
      header: "Current Care Status",
      render: (v: string) => (
        <span style={badgeStyle("#ECFDF5", "#15803D")}>
          {String(v || "Pending Check").toUpperCase()}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Hero Header */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>
              Rescue Centre Operations &amp; Lifecycle Management Portal
            </h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
              Operational monitoring: rescue cases, dispatch management, dog master profile intake, shelter capacity &amp; fleet readiness.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={fetchDashboardData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FaSync /> Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Navigation Cards — Scoped to Rescue Centre Admin Workspace */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaAmbulance />} title="Rescue Requests" subtitle="Incidents & Triage" color="#1E3A8A" onClick={() => navigate("/rescue-requests")} />
        <QuickActionCard icon={<FaTruck />} title="Dispatch Management" subtitle="Fleet & Field Units" color="#16A34A" onClick={() => navigate("/rescue-dispatch")} />
        <QuickActionCard icon={<FaPaw />} title="Dog Profile" subtitle="Dog Records" color="#1E3A8A" onClick={() => navigate("/pets")} />
        <QuickActionCard icon={<FaHome />} title="Shelter Management" subtitle="Kennel Capacity & Care" color="#1E3A8A" onClick={() => navigate("/shelters")} />
        <QuickActionCard icon={<FaTruck />} title="Vehicle Fleet" subtitle="Rescue Ambulance Fleet" color="#16A34A" onClick={() => navigate("/vehicles")} />
        <QuickActionCard icon={<FaChartBar />} title="Reports & Analytics" subtitle="Operational Insights" color="#1E3A8A" onClick={() => navigate("/reports")} />
      </div>

      {/* Operational Headline Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* MULTI-TAB RESCUE CENTRE OPERATIONAL MONITORING QUEUE */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        {/* Source Navigation Tabs */}
        <div style={{ borderBottom: "2px solid #E2E8F0", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("rescues")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "rescues" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "rescues" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "rescues" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaAmbulance /> Rescue Requests ({rescueCalls.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("dispatches")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "dispatches" ? "2px solid #16A34A" : "1px solid #CBD5E1",
                background: activeTab === "dispatches" ? "#ECFDF5" : "#FFFFFF",
                color: activeTab === "dispatches" ? "#15803D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaTruck /> Active Dispatches ({dispatchesList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("intake")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "intake" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "intake" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "intake" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaPaw /> Shelter Dog Intakes ({dogIntakes.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "agents" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "agents" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "agents" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaUsers /> Rescue Agents ({rescueAgents.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("vehicles")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "vehicles" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "vehicles" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "vehicles" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaTruck /> Vehicle Fleet ({fleetVehicles.length})
            </button>
          </div>
        </div>

        {/* TAB 1: RESCUE REQUESTS */}
        {activeTab === "rescues" && (
          <DataTable
            columns={rescueColumns}
            data={rescueCalls}
            loading={loading}
            emptyMessage="No rescue requests found."
            onRowClick={(row: RescueCallRow) => {
              const detailRow = mapRescueCallRowToDetail(row);
              setSelectedCase(detailRow);
              setIsDetailModalOpen(true);
            }}
            renderRowActions={(row: RescueCallRow) => {
              const detailRow = mapRescueCallRowToDetail(row);
              return (
                <button
                  type="button"
                  onClick={() => { setSelectedCase(detailRow); setIsDetailModalOpen(true); }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #1E3A8A",
                    background: "#EFF6FF",
                    color: "#1E3A8A",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> Case Details
                </button>
              );
            }}
          />
        )}

        {/* TAB 2: ACTIVE DISPATCHES */}
        {activeTab === "dispatches" && (
          <DataTable
            columns={dispatchColumns}
            data={dispatchesList}
            loading={loading}
            emptyMessage="No active vehicle dispatches found for this centre."
            onRowClick={(row: DispatchRow) => {
              setSelectedDispatch(row);
              setIsDispatchModalOpen(true);
            }}
            renderRowActions={(row: DispatchRow) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDispatch(row);
                  setIsDispatchModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #16A34A",
                  background: "#ECFDF5",
                  color: "#15803D",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaEye /> Dispatch Details
              </button>
            )}
          />
        )}

        {/* TAB 3: SHELTER DOG MASTER INTAKES */}
        {activeTab === "intake" && (
          <DataTable
            columns={intakeColumns}
            data={dogIntakes}
            loading={loading}
            emptyMessage="No shelter dog intake records found."
            onRowClick={(row: DogIntakeRow) => {
              setSelectedIntake(row);
              setIsIntakeModalOpen(true);
            }}
            renderRowActions={(row: DogIntakeRow) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIntake(row);
                  setIsIntakeModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #16A34A",
                  background: "#ECFDF5",
                  color: "#15803D",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaEye /> View Details
              </button>
            )}
          />
        )}

        {/* TAB 4: RESCUE AGENTS */}
        {activeTab === "agents" && (
          <DataTable
            columns={[
              { key: "full_name", header: "Agent Name", render: (_v: string, r: any) => r.full_name || r.name || r.email || r.id },
              { key: "email", header: "Email", render: (v: string) => v || "Not provided" },
              { key: "phone", header: "Phone", render: (v: string) => v || "Not provided" },
              {
                key: "availability",
                header: "Availability",
                render: (_v: any, r: any) => {
                  const avail = getAgentAvailability(r);
                  return (
                    <span style={{ fontWeight: 600, color: avail === "Available" ? "#16A34A" : avail === "Busy (On Call)" ? "#D97706" : "#DC2626" }}>
                      {avail}
                    </span>
                  );
                }
              },
              {
                key: "assignment",
                header: "Current Assignment",
                render: (_v: any, r: any) => <span>{getAgentAssignment(r.id)}</span>
              },
              {
                key: "is_active",
                header: "Status",
                render: (_val: boolean, r: any) => {
                  const isActive = r.is_active !== false;
                  return (
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: isActive ? "#ECFDF5" : "#FEF2F2", color: isActive ? "#15803D" : "#DC2626" }}>
                      {isActive ? "ACTIVE AGENT" : "INACTIVE"}
                    </span>
                  );
                },
              },
            ]}
            data={rescueAgents}
            loading={loading}
            emptyMessage="No registered rescue agents found for this centre."
            onRowClick={(row: any) => {
              setSelectedAgent(row);
              setIsAgentModalOpen(true);
            }}
            renderRowActions={(row: any) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAgent(row);
                  setIsAgentModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #1E3A8A",
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaEye /> View Details
              </button>
            )}
          />
        )}

        {/* TAB 5: RESCUE VEHICLES & FLEET */}
        {activeTab === "vehicles" && (
          <DataTable
            columns={[
              { key: "vehicle_number", header: "Vehicle / Registration Number", render: (_v: string, r: any) => r.vehicle_number || r.registration_number || r.license_plate || r.plate || r.id },
              { key: "make_model", header: "Make / Model", render: (_v: string, r: any) => r.make_model || r.model || "Ambulance" },
              { key: "vehicle_type", header: "Vehicle Type", render: (_v: string, r: any) => r.vehicle_type || r.type || "Rescue Van" },
              {
                key: "status",
                header: "Operational Status",
                render: (val: string) => {
                  const lower = String(val || "").toLowerCase();
                  const isReady = lower.includes("ready") || lower === "available" || lower === "active";
                  return (
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: isReady ? "#ECFDF5" : lower.includes("dispatch") || lower.includes("maintenance") ? "#EFF6FF" : "#FEF2F2", color: isReady ? "#15803D" : lower.includes("dispatch") || lower.includes("maintenance") ? "#1E3A8A" : "#DC2626" }}>
                      {val || "Active"}
                    </span>
                  );
                },
              },
              {
                key: "assignment",
                header: "Current Assignment",
                render: (_v: any, r: any) => <span>{getVehicleAssignment(r)}</span>
              },
              {
                key: "driver",
                header: "Assigned Driver / Agent",
                render: (_v: any, r: any) => <span>{getVehicleDriver(r)}</span>
              },
              {
                key: "availability",
                header: "Availability",
                render: (_v: any, r: any) => {
                  const avail = getVehicleAvailability(r);
                  return (
                    <span style={{ fontWeight: 600, color: avail === "Available" ? "#16A34A" : avail === "Busy (On Call)" ? "#D97706" : "#DC2626" }}>
                      {avail}
                    </span>
                  );
                }
              },
            ]}
            data={fleetVehicles}
            loading={loading}
            emptyMessage="No vehicles registered in fleet for this centre."
            onRowClick={(row: any) => {
              setSelectedVehicle(row);
              setIsVehicleModalOpen(true);
            }}
            renderRowActions={(row: any) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedVehicle(row);
                  setIsVehicleModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #1E3A8A",
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaEye /> View Details
              </button>
            )}
          />
        )}
      </div>

      {/* Rescue Request Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Rescue Request Details${selectedCase?.ticket_number ? ` — ${selectedCase.ticket_number}` : ""}`}
        size="xl"
        maxWidth="960px"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
              Case ID: <span style={{ fontFamily: "monospace", color: "#1E3A8A" }}>{selectedCase?.id}</span>
            </div>
            <button
              onClick={() => setIsDetailModalOpen(false)}
              style={{
                padding: "8px 20px",
                background: "#1E293B",
                color: "#FFF",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              Close
            </button>
          </div>
        }
      >
        {selectedCase && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "4px" }}>
            
            {/* 1. TOP RESCUE CASE SUMMARY SECTION */}
            <div
              style={{
                background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)",
                borderRadius: "12px",
                border: "1px solid #BFDBFE",
                padding: "16px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "14px", borderBottom: "1px dashed #CBD5E1", paddingBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#64748B", letterSpacing: "0.5px", display: "block" }}>
                    Rescue Case Summary
                  </span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>Ticket #{safeText(selectedCase.ticket_number || selectedCase.id)}</span>
                    {selectedCase.is_urgent && (
                      <span style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                        🔥 URGENT
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "2px" }}>Current Status</span>
                    {rescueStatusBadge(selectedCase.status)}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "2px" }}>Dispatch Stage</span>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 800,
                        background: selectedCase.dispatch_bg,
                        color: selectedCase.dispatch_color,
                      }}
                    >
                      {safeText(selectedCase.dispatch_status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary Metrics Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Ticket / Case ID</span>
                  <strong style={{ fontFamily: "monospace", color: "#1E3A8A" }}>{safeText(selectedCase.ticket_number || selectedCase.id)}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Current Status</span>
                  <strong style={{ textTransform: "capitalize", color: "#0F172A" }}>{safeText(selectedCase.status)}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Dispatch Status</span>
                  <strong>{safeText(selectedCase.dispatch_status)}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Severity / Priority</span>
                  <strong style={{ color: selectedCase.severity === "critical" ? "#DC2626" : selectedCase.severity === "high" ? "#EA580C" : selectedCase.severity === "medium" ? "#D97706" : "#16A34A", textTransform: "uppercase" }}>
                    {safeText(selectedCase.severity)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Reported Time</span>
                  <strong>{selectedCase.date ? formatDateTime(selectedCase.date) : "—"}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Assigned Agent</span>
                  <strong>{safeText(selectedCase.assigned_agent_name || selectedCase.assigned_agent_id, "Unassigned")}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 700, textTransform: "uppercase" }}>Assigned Vehicle</span>
                  <strong>{safeText(selectedCase.assigned_vehicle_number || selectedCase.assigned_vehicle_id, "Unassigned")}</strong>
                </div>
              </div>
            </div>

            {/* 2. RESCUE LIFECYCLE PROGRESS TIMELINE */}
            {(() => {
              const currentStepIdx = getStepIndex(selectedCase.status);
              const isRejectedOrCancelled = ["rejected", "cancelled"].includes(String(selectedCase.status).toLowerCase());

              if (isRejectedOrCancelled) {
                return (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "12px 16px", color: "#991B1B" }}>
                    <div style={{ fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      ⚠️ Rescue Request {selectedCase.status.toUpperCase()}
                    </div>
                    {selectedCase.rejection_rationale && (
                      <div style={{ fontSize: "13px", marginTop: "4px", color: "#B91C1C" }}>
                        Reason: {safeText(selectedCase.rejection_rationale)}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
                    Rescue Case Lifecycle Status Timeline
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                    {LIFECYCLE_STEPS.map((step, idx) => {
                      const isPassed = currentStepIdx >= idx && currentStepIdx !== -1;
                      const isCurrent = currentStepIdx === idx;
                      return (
                        <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative", zIndex: 1 }}>
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              background: isCurrent ? "#1E3A8A" : isPassed ? "#16A34A" : "#F1F5F9",
                              color: isPassed || isCurrent ? "#FFF" : "#94A3B8",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 800,
                              border: isCurrent ? "2px solid #93C5FD" : isPassed ? "2px solid #86EFAC" : "1px solid #CBD5E1",
                              boxShadow: isCurrent ? "0 0 0 3px rgba(30, 58, 138, 0.2)" : "none",
                            }}
                          >
                            {isPassed && !isCurrent ? "✓" : idx + 1}
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: isCurrent ? 800 : isPassed ? 700 : 500,
                              color: isCurrent ? "#1E3A8A" : isPassed ? "#15803D" : "#94A3B8",
                              marginTop: "6px",
                              textAlign: "center",
                            }}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 3. SEPARATED OPERATIONAL SECTIONS IN 2-COLUMN GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

              {/* LEFT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Rescue / Animal Information */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", marginBottom: "12px", borderBottom: "1px solid #F1F5F9", paddingBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaPaw color="#1E3A8A" /> Rescue / Animal Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Animal Type / Count</span>
                      <strong>{safeText(selectedCase.raw?.animal_type || "Dog")} ({safeText(selectedCase.raw?.animal_count || 1)} animal)</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Physical Condition</span>
                      <strong style={{ textTransform: "capitalize" }}>{safeText(selectedCase.condition).replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Urgency Priority</span>
                      <strong style={{ textTransform: "uppercase", color: selectedCase.is_urgent ? "#DC2626" : "#334155" }}>
                        {selectedCase.is_urgent ? "Urgent Priority" : "Normal"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>System Case ID</span>
                      <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{safeText(selectedCase.id)}</span>
                    </div>
                  </div>
                </div>

                {/* Reporter Information */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", marginBottom: "12px", borderBottom: "1px solid #F1F5F9", paddingBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaUser color="#1E3A8A" /> Reporter Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Reporter Name</span>
                      <strong>{safeText(selectedCase.reporter)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Contact Phone</span>
                      <strong>{safeText(selectedCase.phone)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Reporter Type</span>
                      <span>{selectedCase.raw?.is_anonymous || selectedCase.raw?.anonymous ? "Anonymous Reporter" : "Registered Public Reporter"}</span>
                    </div>
                  </div>
                </div>

                {/* Reporter Description & Notes */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#334155", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaInfoCircle color="#64748B" /> Reporter Description / Notes
                  </div>
                  <div style={{ fontSize: "13px", color: "#475569", background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", lineHeight: 1.5 }}>
                    {safeText(selectedCase.raw?.reporter_notes || selectedCase.raw?.notes || selectedCase.raw?.description, "No additional reporter notes provided for this rescue case.")}
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Rescue Location */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", marginBottom: "12px", borderBottom: "1px solid #F1F5F9", paddingBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaMapMarkerAlt color="#EF4444" /> Rescue Location
                  </div>

                  <div style={{ marginBottom: "10px", fontSize: "13px" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Recorded Address</span>
                    <strong style={{ color: "#0F172A", wordBreak: "break-word" }}>{safeText(selectedCase.location, "Location address not recorded")}</strong>
                  </div>

                  {Boolean(selectedCase.location_landmark || selectedCase.raw?.location_landmark || selectedCase.raw?.landmark) && (
                    <div style={{ marginBottom: "10px", fontSize: "13px" }}>
                      <span style={{ color: "#64748B", fontSize: "11px", display: "block", fontWeight: 600 }}>Landmark / Reference</span>
                      <span>{safeText(selectedCase.location_landmark || selectedCase.raw?.location_landmark || selectedCase.raw?.landmark)}</span>
                    </div>
                  )}

                  {/* Location Map / Compact GPS panel */}
                  {(() => {
                    const latNum = Number(selectedCase.latitude ?? selectedCase.raw?.latitude);
                    const lngNum = Number(selectedCase.longitude ?? selectedCase.raw?.longitude);
                    const hasCoords = !isNaN(latNum) && !isNaN(lngNum) && latNum !== 0 && lngNum !== 0;

                    if (hasCoords) {
                      return (
                        <LocationMapPreview
                          latitude={latNum}
                          longitude={lngNum}
                          locationAddress={selectedCase.location}
                          locationLandmark={selectedCase.location_landmark ?? (selectedCase.raw?.location_landmark as any) ?? (selectedCase.raw?.landmark as any)}
                          height="160px"
                        />
                      );
                    }

                    return (
                      <div style={{ background: "#F8FAFC", border: "1px dashed #CBD5E1", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "10px" }}>
                        <FaMapMarkerAlt color="#94A3B8" size={18} />
                        <div>
                          <strong style={{ color: "#334155", display: "block", marginBottom: "2px" }}>Exact GPS Coordinates Unavailable</strong>
                          <span>Location state panel displaying recorded text address above.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Dispatch & Field Team Information */}
                <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#4C1D95", marginBottom: "12px", borderBottom: "1px solid #EDE9FE", paddingBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaTruck color="#7C3AED" /> Dispatch &amp; Field Team Information
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "#6B21A8", fontSize: "11px", display: "block", fontWeight: 600 }}>Assigned Agent</span>
                      <strong>{safeText(selectedCase.assigned_agent_name || selectedCase.assigned_agent_id, "Unassigned")}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6B21A8", fontSize: "11px", display: "block", fontWeight: 600 }}>Assigned Vehicle</span>
                      <strong>{safeText(selectedCase.assigned_vehicle_number || selectedCase.assigned_vehicle_id, "Unassigned")}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#6B21A8", fontSize: "11px", display: "block", fontWeight: 600 }}>Dispatch Stage</span>
                      <span style={{ fontWeight: 700, color: selectedCase.dispatch_color }}>{safeText(selectedCase.dispatch_status)}</span>
                    </div>
                    {Boolean((selectedCase.dispatch as any)?.dispatched_at) && (
                      <div>
                        <span style={{ color: "#6B21A8", fontSize: "11px", display: "block", fontWeight: 600 }}>Dispatched At</span>
                        <strong>{formatDateTime(String((selectedCase.dispatch as any)?.dispatched_at))}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photos / Media Evidence */}
                {Boolean(selectedCase.media_urls && selectedCase.media_urls.length > 0) && (
                  <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      📷 Photos / Media Evidence
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {selectedCase.media_urls.map((u: string, i: number) => (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "6px 12px",
                            background: "#EFF6FF",
                            color: "#1E3A8A",
                            borderRadius: "6px",
                            border: "1px solid #BFDBFE",
                            fontSize: "12px",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Photo Evidence {i + 1} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        )}
      </Modal>

      {/* Dispatch Detail Modal */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title={`Dispatch Operational Details — ${selectedDispatch?.ticket_number || selectedDispatch?.id || "Dispatch"}`}
        size="lg"
        footer={
          <button
            onClick={() => setIsDispatchModalOpen(false)}
            style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
          >
            Close
          </button>
        }
      >
        {selectedDispatch && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch ID</span>
                <strong style={{ fontFamily: "monospace" }}>{selectedDispatch.id}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Target Rescue Case Ticket</span>
                <strong>{selectedDispatch.ticket_number}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Assigned Vehicle</span>
                <strong>{selectedDispatch.vehicle_number}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Lead Driver / Agent</span>
                <strong>{selectedDispatch.driver_name}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch Team</span>
                <strong>{selectedDispatch.agents}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, background: "#ECFDF5", color: "#15803D" }}>
                  {selectedDispatch.status}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch Time</span>
                <strong>{selectedDispatch.dispatch_time ? formatDateTime(selectedDispatch.dispatch_time) : "—"}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Rescue Agent Detail Modal */}
      <Modal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        title={`Rescue Agent Details — ${selectedAgent?.full_name || selectedAgent?.name || "Agent"}`}
        size="lg"
        footer={
          <button
            onClick={() => setIsAgentModalOpen(false)}
            style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
          >
            Close
          </button>
        }
      >
        {selectedAgent && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Agent Name</span>
                <strong>{selectedAgent.full_name || selectedAgent.name || "Unnamed"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Email Address</span>
                <strong>{selectedAgent.email || "Not provided"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Phone Number</span>
                <strong>{selectedAgent.phone || "Not provided"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Assigned Role</span>
                <strong style={{ textTransform: "capitalize" }}>{selectedAgent.role ? String(selectedAgent.role).replace(/_/g, " ") : "Rescue Agent"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Availability Status</span>
                <strong style={{ color: getAgentAvailability(selectedAgent) === "Available" ? "#16A34A" : getAgentAvailability(selectedAgent) === "Busy (On Call)" ? "#D97706" : "#DC2626" }}>
                  {getAgentAvailability(selectedAgent)}
                </strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Current Assignment</span>
                <strong>{getAgentAssignment(selectedAgent.id)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: selectedAgent.is_active !== false ? "#ECFDF5" : "#FEF2F2", color: selectedAgent.is_active !== false ? "#15803D" : "#DC2626", display: "inline-block" }}>
                  {selectedAgent.is_active !== false ? "ACTIVE AGENT" : "INACTIVE"}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Rescue Vehicle Detail Modal */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        title={`Vehicle Operational Details — ${selectedVehicle?.vehicle_number || selectedVehicle?.registration_number || "Vehicle"}`}
        size="lg"
        footer={
          <button
            onClick={() => setIsVehicleModalOpen(false)}
            style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
          >
            Close
          </button>
        }
      >
        {selectedVehicle && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Vehicle / Registration Number</span>
                <strong>{getSafeVal(selectedVehicle.vehicle_number || selectedVehicle.registration_number || selectedVehicle.license_plate || selectedVehicle.plate)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Make / Model</span>
                <strong>{getSafeVal(selectedVehicle.make_model || selectedVehicle.model)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Vehicle Type</span>
                <strong>{getSafeVal(selectedVehicle.vehicle_type || selectedVehicle.type)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Operational Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#ECFDF5", color: "#15803D", display: "inline-block" }}>
                  {getSafeVal(selectedVehicle.status, "Active")}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Availability Status</span>
                <strong style={{ color: getVehicleAvailability(selectedVehicle) === "Available" ? "#16A34A" : getVehicleAvailability(selectedVehicle) === "Busy (On Call)" ? "#D97706" : "#DC2626" }}>
                  {getVehicleAvailability(selectedVehicle)}
                </strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Current Assignment</span>
                <strong>{getVehicleAssignment(selectedVehicle)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Assigned Driver / Rescue Agent</span>
                <strong>{getVehicleDriver(selectedVehicle)}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Shelter Dog Intake Detail Modal */}
      <Modal
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        title={`Shelter Dog Intake Details — ${selectedIntake?.name || "Dog"}`}
        size="lg"
        footer={
          <button
            onClick={() => setIsIntakeModalOpen(false)}
            style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
          >
            Close
          </button>
        }
      >
        {selectedIntake && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dog Name</span>
                <strong>{selectedIntake.name}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Registration / Master ID</span>
                <strong>{selectedIntake.registration_number}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Rescue / Ticket Number</span>
                <strong>{selectedIntake.rescue_ticket}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Intake Date</span>
                <strong>{selectedIntake.intake_date ? formatDateTime(selectedIntake.intake_date) : "—"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Shelter Facility</span>
                <strong>{selectedIntake.shelter_name}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Intake Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#EFF6FF", color: "#1E3A8A", display: "inline-block", textTransform: "uppercase" }}>
                  {selectedIntake.intake_status}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Current Care Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#ECFDF5", color: "#15803D", display: "inline-block", textTransform: "uppercase" }}>
                  {selectedIntake.care_status}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RescueCentreAdminDashboard;
