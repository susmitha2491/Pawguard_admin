import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import Modal from "../../../components/common/Modal";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import {
  FaAmbulance,
  FaPaw,
  FaStethoscope,
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
  FaExclamationTriangle,
  FaTruck,
} from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import rescueService from "../../../services/rescueService";
import dogService from "../../../services/dogService";
import shelterService from "../../../services/shelterService";
import inventoryService from "../../../services/inventoryService";
import userService from "../../../services/userService";
import vehicleService from "../../../services/vehicleService";
import grievanceService from "../../../services/grievanceService";
import { useToast } from "../../../context/ToastContext";
import { rescueStatusBadge, dispatchStage, dispatchAgentNames } from "../../../utils/rescueStatus";
import { useDataSync } from "../../../utils/dataSync";
import { normalizeRole, getCurrentUser, getRescueCentreId } from "../../../utils/roleUtils";
import { formatDateTime } from "../../../utils/dateUtils";
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

const unwrapList = (res: any): any[] => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
};

const mapRescueCallRowToDetail = (row: RescueCallRow): RescueRequestTableRow => {
  const raw = row.rawItem;
  const stage = dispatchStage({ status: raw.status as string, dispatch: raw.dispatch as Record<string, unknown> });
  const dispatchObj = (raw.dispatch as Record<string, unknown>) || null;
  const assignedAgentId = String(raw.assigned_agent_id || raw.agent_id || (dispatchObj as any)?.agent_id || "");
  const assignedAgentName = String(raw.assigned_agent_name || raw.assigned_agent || (dispatchObj as any)?.agent_name || (assignedAgentId ? `Agent (${assignedAgentId})` : ""));
  const assignedVehicleId = String(raw.assigned_vehicle_id || (dispatchObj as any)?.vehicle_id || "");
  const assignedVehicleNumber = String(raw.assigned_vehicle_number || raw.assigned_vehicle || (dispatchObj as any)?.vehicle_number || (assignedVehicleId ? `Vehicle (${assignedVehicleId})` : ""));
  return {
    id: row.id,
    ticket_number: String(raw.ticket_number || row.ticket || ""),
    reporter: (raw.is_anonymous || raw.anonymous)
      ? "Anonymous Reporter"
      : String(raw.reporter_name || row.reporter || "Unknown Reporter"),
    phone: String(raw.reporter_phone || raw.phone || "Not provided"),
    location: String(raw.location_address || raw.location || "Location not recorded"),
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

const RescueCentreAdminDashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"rescues" | "intake" | "agents" | "vehicles" | "complaints">("rescues");
  const [selectedCase, setSelectedCase] = useState<RescueRequestTableRow | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedIntake, setSelectedIntake] = useState<DogIntakeRow | null>(null);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);

  // Rescued Animal Intake Registration State
  const [isRegisterIntakeModalOpen, setIsRegisterIntakeModalOpen] = useState(false);
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);
  const [registerIntakeForm, setRegisterIntakeForm] = useState({
    name: "",
    breed: "Mixed Breed",
    gender: "male",
    shelter_id: "",
    rescue_case_id: "",
    notes: "Newly arrived rescued animal intake.",
  });

  // Complaints & Escalations State
  const [grievanceTickets, setGrievanceTickets] = useState<any[]>([]);
  const [selectedGrievance, setSelectedGrievance] = useState<any | null>(null);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [isEscalating, setIsEscalating] = useState(false);

  // Centre Configuration State
  const [isCentreConfigOpen, setIsCentreConfigOpen] = useState(false);
  const [centreForm, setCentreForm] = useState({
    name: "Central Rescue Operations Centre",
    phone: "+91 1800-RESCUE",
    address: "Sector 14, Main Emergency Complex",
    operating_hours: "24/7 Rapid Response",
    capacity: 100,
    status: "active",
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

  const handleEscalateGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrievance?.id || !escalateReason.trim()) {
      addToast("Please provide a reason for escalation to Super Admin.", "error");
      return;
    }

    try {
      setIsEscalating(true);
      await grievanceService.escalateGrievance(selectedGrievance.id, escalateReason.trim());
      addToast(`Complaint ticket #${selectedGrievance.ticket_number || selectedGrievance.id} escalated to Super Admin successfully!`, "success");
      setIsGrievanceModalOpen(false);
      setEscalateReason("");
      fetchDashboardData();
    } catch {
      addToast("Failed to escalate ticket.", "error");
    } finally {
      setIsEscalating(false);
    }
  };

  const handleUpdateGrievanceStatusSubmit = async (status: string) => {
    if (!selectedGrievance?.id) return;
    try {
      await grievanceService.updateGrievanceStatus(selectedGrievance.id, status);
      addToast(`Complaint ticket status updated to ${status}.`, "success");
      setIsGrievanceModalOpen(false);
      fetchDashboardData();
    } catch {
      addToast("Failed to update complaint status.", "error");
    }
  };

  const handleRegisterIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerIntakeForm.name.trim()) {
      addToast("Please provide the animal / dog name for intake registration.", "error");
      return;
    }

    try {
      setIsSubmittingIntake(true);
      const targetShelterId = registerIntakeForm.shelter_id || getRescueCentreId(getCurrentUser()) || "";
      await dogService.createDog({
        name: registerIntakeForm.name.trim(),
        breed: registerIntakeForm.breed || "Mixed Breed",
        gender: registerIntakeForm.gender || "male",
        status: "rescued",
        is_adoptable: false,
        shelter_id: targetShelterId || undefined,
        description: registerIntakeForm.notes,
        medical_status: "Pending Check",
      });
      addToast(`Rescued animal '${registerIntakeForm.name.trim()}' intake logged successfully!`, "success");
      setIsRegisterIntakeModalOpen(false);
      setRegisterIntakeForm({
        name: "",
        breed: "Mixed Breed",
        gender: "male",
        shelter_id: "",
        rescue_case_id: "",
        notes: "Newly arrived rescued animal intake.",
      });
      fetchDashboardData();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to register animal intake.", "error");
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  // Lifecycle Data States
  const [rescueCalls, setRescueCalls] = useState<RescueCallRow[]>([]);
  const [dogIntakes, setDogIntakes] = useState<DogIntakeRow[]>([]);
  const [rescueAgents, setRescueAgents] = useState<any[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<any[]>([]);

  // Metric Totals
  const [statsData, setStatsData] = useState({
    totalCalls: 0,
    pendingCalls: 0,
    activeDispatches: 0,
    shelterDogsCount: 0,
    medicallyClearedCount: 0,
    lowStockAlertsCount: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUserObj = getCurrentUser();
      const currentRole = normalizeRole(currentUserObj);
      const isRescueAdmin = currentRole === "rescue_centre_admin";
      const currentCentreId = getRescueCentreId(currentUserObj);

      if (isRescueAdmin && !currentCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator to assign your Rescue Centre.");
        setLoading(false);
        setRescueCalls([]);
        setDogIntakes([]);
        setRescueAgents([]);
        setFleetVehicles([]);
        setGrievanceTickets([]);
        setStatsData({
          totalCalls: 0,
          pendingCalls: 0,
          activeDispatches: 0,
          shelterDogsCount: 0,
          medicallyClearedCount: 0,
          lowStockAlertsCount: 0,
        });
        return;
      }

      const scopeParams = currentCentreId ? { rescue_centre_id: currentCentreId } : {};

      const [
        dashRes,
        casesRes,
        dogsRes,
        _sheltersRes,
        inventoryRes,
        usersRes,
        vehiclesRes,
        grievanceRes,
      ] = await Promise.allSettled([
        dashboardService.getRescueCentreDashboard(scopeParams),
        rescueService.getRescueCases({ page_size: 500, ...scopeParams }),
        dogService.getAllDogs(scopeParams),
        shelterService.getShelters(scopeParams),
        inventoryService.getInventory(),
        userService.getUsers(scopeParams),
        vehicleService.getVehicles(scopeParams),
        grievanceService.getGrievances(scopeParams),
      ]);

      const dashData = dashRes.status === "fulfilled" ? dashRes.value?.data || dashRes.value || {} : {};
      const casesList = casesRes.status === "fulfilled" ? unwrapList(casesRes.value) : [];
      const dogsList = dogsRes.status === "fulfilled" ? unwrapList(dogsRes.value) : [];
      const inventoryList = inventoryRes.status === "fulfilled" ? unwrapList(inventoryRes.value) : [];
      const usersList = usersRes.status === "fulfilled" ? unwrapList(usersRes.value) : [];
      const vehiclesList = vehiclesRes.status === "fulfilled" ? unwrapList(vehiclesRes.value) : [];
      const grievancesList = grievanceRes.status === "fulfilled" ? unwrapList(grievanceRes.value) : [];

      setGrievanceTickets(grievancesList);

      // Process Resource Availability
      const agents = usersList.filter((u: any) => {
        const r = normalizeRole(u);
        return r === "rescue_agent" || r === "rescue_coordinator" || String(u.role || "").toLowerCase().includes("agent");
      });
      setRescueAgents(agents);
      setFleetVehicles(vehiclesList);

      // 1. Process Recent Rescue Calls & Dispatches
      const recentCalls: RescueCallRow[] = casesList.map((item: any) => {
        const rawStatus = String(item.status || "").toLowerCase();
        const dispatchObj = item.dispatch || null;
        const hasAssignment = !!(item.coordinator_id || item.assigned_agent_id || item.assigned_agent || item.agent_id || dispatchObj);
        const displayStatus = (rawStatus === "verified" && hasAssignment) ? "accepted" : rawStatus;

        const stage = dispatchStage({ status: displayStatus, dispatch: dispatchObj });
        const agents = dispatchAgentNames(dispatchObj);
        return {
          id: item.id || "",
          ticket: item.ticket_number || item.id || "-",
          reporter: item.reporter_name || "-",
          animal_count: item.animal_count ?? 1,
          status: displayStatus,
          dispatch_status: stage.label,
          agent: agents.agents.length > 0 ? agents.agents.join(", ") : "-",
          created_at: item.created_at || "",
          rawItem: item,
        };
      });

      // 2. Process Shelter Dog Master Intakes
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

      // 3. Calculate Aggregate Metrics
      const pendingCases = casesList.filter((c: any) => {
        const s = String(c.status || "").toLowerCase();
        return s === "pending" || s === "reported" || s === "requested";
      }).length;

      const dispatchedCases = casesList.filter((c: any) => {
        const s = String(c.status || "").toLowerCase();
        return s === "dispatched" || s === "en_route" || s === "on_site";
      }).length;

      const clearedDogs = dogsList.filter((d: any) => {
        const ms = String(d.medical_status || "").toLowerCase();
        return ms.includes("clear") || ms.includes("fit") || Boolean(d.is_fit_for_adoption || d.is_adoptable);
      }).length;

      const lowStockItems = inventoryList.filter((inv: any) => {
        const qty = Number(inv.quantity ?? inv.current_stock ?? 0);
        const minQty = Number(inv.min_quantity ?? inv.reorder_level ?? 10);
        return qty <= minQty;
      }).length;

      setRescueCalls(recentCalls);
      setDogIntakes(intakes);

      setStatsData({
        totalCalls: dashData.total_calls ?? dashData.totalCalls ?? casesList.length,
        pendingCalls: dashData.pending ?? dashData.pendingCases ?? pendingCases,
        activeDispatches: dashData.dispatched ?? dashData.dispatchedCases ?? dispatchedCases,
        shelterDogsCount: dogsList.length,
        medicallyClearedCount: clearedDogs,
        lowStockAlertsCount: lowStockItems,
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
      icon: <FaUsers />,
      onClick: () => navigate("/rescue-dispatch"),
    },
    {
      title: "Shelter Intakes",
      value: loading ? "..." : String(dogIntakes.length),
      trend: `${statsData.medicallyClearedCount} Medically Cleared`,
      color: "#1E3A8A",
      icon: <FaPaw />,
      onClick: () => setActiveTab("intake"),
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
              Rescue Centre Operations & Lifecycle Management Portal
            </h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
              Complete operational monitoring: rescue cases, agent dispatch, medical intake, shelter capacity & inventory alerts.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setIsRegisterIntakeModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 16px",
                borderRadius: "10px",
                border: "none",
                background: "#10B981",
                color: "#FFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FaPaw /> + Log Animal Intake
            </button>
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

      {/* Quick Action Navigation Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaAmbulance />} title="Rescue Requests" subtitle="Incidents & Triage" color="#1E3A8A" onClick={() => navigate("/rescue-requests")} />
        <QuickActionCard icon={<FaUsers />} title="Dispatch Unit" subtitle="Agent Fleet" color="#16A34A" onClick={() => navigate("/rescue-dispatch")} />
        <QuickActionCard icon={<FaPaw />} title="Dog Management" subtitle="Dog Master Profiles" color="#1E3A8A" onClick={() => navigate("/pets")} />
        <QuickActionCard icon={<FaHome />} title="Shelter Facilities" subtitle="Kennel Capacity" color="#1E3A8A" onClick={() => navigate("/shelters")} />
        <QuickActionCard icon={<FaPaw />} title="Shelter Dogs" subtitle="Post-Rescue Handover" color="#15803D" onClick={() => navigate("/shelter-dogs")} />
        <QuickActionCard icon={<FaStethoscope />} title="Medical Suite" subtitle="Medical Records" color="#1E3A8A" onClick={() => navigate("/medical-records")} />
        <QuickActionCard icon={<FaChartBar />} title="Reports & Analytics" subtitle="Operational Insights" color="#1E3A8A" onClick={() => navigate("/reports")} />
      </div>

      {/* Operational Headline Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* MULTI-TAB LIFECYCLE MONITORING QUEUE */}
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
              <FaAmbulance /> Rescue Requests & Dispatch Stage ({rescueCalls.length})
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
              <FaPaw /> Shelter Dog Master Intakes ({dogIntakes.length})
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
              <FaAmbulance /> Rescue Vehicles &amp; Fleet ({fleetVehicles.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("complaints")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "complaints" ? "2px solid #DC2626" : "1px solid #CBD5E1",
                background: activeTab === "complaints" ? "#FEF2F2" : "#FFFFFF",
                color: activeTab === "complaints" ? "#991B1B" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaExclamationTriangle /> Complaints &amp; Escalations ({grievanceTickets.length})
            </button>
          </div>
        </div>

        {/* TAB 1: RESCUE REQUESTS & DISPATCH */}
        {activeTab === "rescues" && (
          <DataTable
            columns={rescueColumns}
            data={rescueCalls}
            loading={loading}
            emptyMessage="No recent rescue requests logged."
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

        {/* TAB 2: SHELTER DOG MASTER INTAKES */}
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
            emptyMessage="No registered rescue agents found."
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
            emptyMessage="No vehicles registered in fleet."
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

        {/* TAB 6: COMPLAINTS & ESCALATIONS */}
        {activeTab === "complaints" && (
          <DataTable
            columns={[
              { key: "ticket_number", header: "Ticket #", render: (_v: string, r: any) => r.ticket_number || r.id || "—" },
              { key: "title", header: "Complaint Title / Issue", render: (_v: string, r: any) => r.title || r.subject || "Operational Complaint" },
              { key: "reporter_name", header: "Reporter / Contact", render: (_v: string, r: any) => r.reporter_name || r.reporter || r.email || "Public Feedback" },
              {
                key: "priority",
                header: "Priority",
                render: (val: string) => {
                  const p = String(val || "medium").toLowerCase();
                  return (
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: p === "urgent" || p === "high" ? "#FEF2F2" : "#FFFBEB", color: p === "urgent" || p === "high" ? "#DC2626" : "#D97706" }}>
                      {p.toUpperCase()}
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                render: (val: string) => {
                  const s = String(val || "open").toLowerCase();
                  return (
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: s === "resolved" ? "#ECFDF5" : s === "escalated" ? "#FEF2F2" : "#EFF6FF", color: s === "resolved" ? "#15803D" : s === "escalated" ? "#DC2626" : "#1E3A8A" }}>
                      {s.toUpperCase()}
                    </span>
                  );
                },
              },
              { key: "created_at", header: "Date Filed", render: (v: string) => (v ? formatDateTime(v) : "—") },
            ]}
            data={grievanceTickets}
            loading={loading}
            emptyMessage="No complaints or escalation tickets logged for this centre."
            onRowClick={(row: any) => {
              setSelectedGrievance(row);
              setIsGrievanceModalOpen(true);
            }}
            renderRowActions={(row: any) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGrievance(row);
                  setIsGrievanceModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #DC2626",
                  background: "#FEF2F2",
                  color: "#991B1B",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaExclamationTriangle /> Manage Escalation
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
        size="lg"
        footer={
          <button
            onClick={() => setIsDetailModalOpen(false)}
            style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
          >
            Close
          </button>
        }
      >
        {selectedCase && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Information Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Ticket Information</span>
                <strong>{selectedCase.ticket_number || selectedCase.id}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaUser size={10} style={{ marginRight: "4px" }} /> Reporter Information</span>
                <strong>{selectedCase.reporter}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaPhoneAlt size={10} style={{ marginRight: "4px" }} /> Contact Phone</span>
                <strong>{selectedCase.phone}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaMapMarkerAlt size={10} style={{ marginRight: "4px" }} /> Rescue Location</span>
                <strong style={{ wordBreak: "break-word" }}>{selectedCase.location}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Animal / Physical Condition</span>
                <strong style={{ textTransform: "capitalize" }}>{String(selectedCase.condition || "-").replace(/_/g, " ")}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Severity &amp; Urgency</span>
                <strong style={{ textTransform: "uppercase", color: selectedCase.severity === "critical" ? "#DC2626" : selectedCase.severity === "high" ? "#EA580C" : selectedCase.severity === "medium" ? "#D97706" : "#16A34A" }}>
                  {selectedCase.severity || "-"}
                </strong>
                {selectedCase.is_urgent && (
                  <span style={{ marginLeft: "8px", background: "#FEF2F2", color: "#DC2626", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 800 }}>
                    URGENT
                  </span>
                )}
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Current Status</span>
                {rescueStatusBadge(selectedCase.status)}
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Dispatch Status</span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, background: selectedCase.dispatch_bg, color: selectedCase.dispatch_color }}>
                  {selectedCase.dispatch_status}
                </span>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Assigned Rescue Agent</span>
                <strong>{selectedCase.assigned_agent_name || selectedCase.assigned_agent_id || "Unassigned"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Assigned Vehicle</span>
                <strong>{selectedCase.assigned_vehicle_number || selectedCase.assigned_vehicle_id || "Unassigned"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}><FaClock size={10} style={{ marginRight: "4px" }} /> Created / Reported Time</span>
                <strong>{selectedCase.date ? formatDateTime(selectedCase.date) : "-"}</strong>
              </div>
            </div>

            {/* Reporter Notes */}
            {Boolean(selectedCase.raw?.reporter_notes) && (
              <div style={{ background: "#F1F5F9", padding: "12px 14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                <strong style={{ color: "#334155", display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  <FaInfoCircle size={12} style={{ marginRight: "6px" }} /> Reporter Description / Notes:
                </strong>
                <span style={{ fontSize: "13px", color: "#475569" }}>{String(selectedCase.raw.reporter_notes)}</span>
              </div>
            )}

            {/* Rejection Rationale */}
            {Boolean(selectedCase.rejection_rationale) && (
              <div style={{ background: "#FEF2F2", padding: "12px 14px", borderRadius: "10px", border: "1px solid #FCA5A5" }}>
                <strong style={{ color: "#DC2626", display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  <FaExclamationTriangle size={12} style={{ marginRight: "6px" }} /> Rejection Rationale:
                </strong>
                <span style={{ fontSize: "13px", color: "#991B1B" }}>{selectedCase.rejection_rationale}</span>
              </div>
            )}

            {/* Dispatch & Team Info */}
            {Boolean(selectedCase.dispatch || selectedCase.assigned_vehicle_number || selectedCase.assigned_agent_name) && (
              <div style={{ background: "#F5F3FF", padding: "14px 16px", borderRadius: "10px", border: "1px solid #DDD6FE" }}>
                <strong style={{ color: "#1E3A8A", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  <FaTruck size={14} style={{ marginRight: "6px" }} /> Dispatch &amp; Field Team Info
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                  <div><span style={{ color: "#1E3A8A", fontWeight: 600 }}>Assigned Agent:</span> <strong>{selectedCase.assigned_agent_name || selectedCase.assigned_agent_id || "Unassigned"}</strong></div>
                  <div><span style={{ color: "#1E3A8A", fontWeight: 600 }}>Assigned Vehicle:</span> <strong>{selectedCase.assigned_vehicle_number || selectedCase.assigned_vehicle_id || "Unassigned"}</strong></div>
                  {Boolean((selectedCase.dispatch as any)?.dispatched_at) && (
                    <div><span style={{ color: "#1E3A8A", fontWeight: 600 }}>Dispatched At:</span> <strong>{formatDateTime(String((selectedCase.dispatch as any)?.dispatched_at))}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Photos / Media Evidence */}
            {Boolean(selectedCase.media_urls && selectedCase.media_urls.length > 0) && (
              <div>
                <strong style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>Photos / Media Evidence:</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {selectedCase.media_urls.map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" style={{ padding: "6px 12px", background: "#EFF6FF", color: "#1E3A8A", borderRadius: "6px", border: "1px solid #BFDBFE", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}>
                      Photo Evidence {i + 1} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
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
            {/* Operational Information Grid */}
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
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Verification Status</span>
                <strong>{selectedAgent.is_verified ? "Verified" : "Pending"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>MFA Enabled</span>
                <strong>{selectedAgent.mfa_enabled ? "Yes" : "No"}</strong>
              </div>
            </div>

            {/* Account Information Metadata Section */}
            <div style={{ background: "#F1F5F9", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <strong style={{ color: "#475569", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Account Information
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "12px", color: "#475569" }}>
                <div><span>User ID:</span> <strong style={{ fontFamily: "monospace" }}>{selectedAgent.id}</strong></div>
                {selectedAgent.created_at && (
                  <div><span>Created At:</span> <strong>{formatDateTime(selectedAgent.created_at)}</strong></div>
                )}
                {selectedAgent.updated_at && (
                  <div><span>Updated At:</span> <strong>{formatDateTime(selectedAgent.updated_at)}</strong></div>
                )}
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
            {/* Operational Information Grid */}
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
              <div>
                <span style={{ color: "#64748B", fontSize: "12px", display: "block", fontWeight: 600 }}>Mileage</span>
                <strong>{selectedVehicle.mileage !== undefined && selectedVehicle.mileage !== null ? `${selectedVehicle.mileage} miles` : "—"}</strong>
              </div>
            </div>

            {/* Vehicle & Compliance Information Section */}
            <div style={{ background: "#FFF", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <strong style={{ color: "#475569", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Vehicle &amp; Compliance Information
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "12px", color: "#475569" }}>
                <div><span>Insurance Provider:</span> <strong>{getSafeVal(selectedVehicle.insurance_provider || selectedVehicle.insuranceProvider)}</strong></div>
                <div><span>Policy Number:</span> <strong>{getSafeVal(selectedVehicle.insurance_policy_number || selectedVehicle.insurancePolicyNumber)}</strong></div>
                <div><span>Insurance Expiry:</span> <strong>{selectedVehicle.insurance_expiry ? formatDateTime(String(selectedVehicle.insurance_expiry)) : "—"}</strong></div>
                <div><span>Contact Phone:</span> <strong>{getSafeVal(selectedVehicle.insurance_contact_phone || selectedVehicle.insuranceContactPhone)}</strong></div>
              </div>
            </div>

            {/* System Metadata Section */}
            <div style={{ background: "#F1F5F9", padding: "10px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "11px", color: "#64748B" }}>
                <div><span>System ID:</span> <strong style={{ fontFamily: "monospace" }}>{selectedVehicle.id}</strong></div>
                {selectedVehicle.created_at && (
                  <div><span>Created At:</span> <strong>{formatDateTime(String(selectedVehicle.created_at))}</strong></div>
                )}
                {selectedVehicle.updated_at && (
                  <div><span>Updated At:</span> <strong>{formatDateTime(String(selectedVehicle.updated_at))}</strong></div>
                )}
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
            {/* Operational Intake Information */}
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

            {/* Additional Info from rawItem if exists */}
            <div style={{ background: "#FFF", padding: "14px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <strong style={{ color: "#475569", fontSize: "13px", display: "block", marginBottom: "8px" }}>
                Dog Details
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "12px", color: "#475569" }}>
                <div><span>Breed:</span> <strong>{getSafeVal(selectedIntake.rawItem?.breed)}</strong></div>
                <div><span>Gender:</span> <strong style={{ textTransform: "capitalize" }}>{getSafeVal(selectedIntake.rawItem?.gender)}</strong></div>
                <div><span>Estimated Age:</span> <strong>{getSafeVal(selectedIntake.rawItem?.estimated_age || selectedIntake.rawItem?.age)}</strong></div>
                <div><span>Weight:</span> <strong>{selectedIntake.rawItem?.weight ? `${selectedIntake.rawItem.weight} kg` : "—"}</strong></div>
              </div>
            </div>

            {/* System Metadata Section */}
            <div style={{ background: "#F1F5F9", padding: "10px 16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "11px", color: "#64748B" }}>
                <div><span>Record ID:</span> <strong style={{ fontFamily: "monospace" }}>{selectedIntake.id}</strong></div>
                {Boolean((selectedIntake.rawItem as any)?.created_at) && (
                  <div><span>Created At:</span> <strong>{formatDateTime(String((selectedIntake.rawItem as any).created_at))}</strong></div>
                )}
                {Boolean((selectedIntake.rawItem as any)?.updated_at) && (
                  <div><span>Updated At:</span> <strong>{formatDateTime(String((selectedIntake.rawItem as any).updated_at))}</strong></div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Grievance Complaint & Escalation Modal */}
      <Modal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        title={`Complaint / Escalation Ticket — ${selectedGrievance?.ticket_number || selectedGrievance?.id || "Details"}`}
        size="lg"
      >
        {selectedGrievance && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                <div><span style={{ color: "#64748B", display: "block" }}>Issue / Title</span><strong>{selectedGrievance.title || "Operational Complaint"}</strong></div>
                <div><span style={{ color: "#64748B", display: "block" }}>Reporter</span><strong>{selectedGrievance.reporter_name || "Public Feedback"}</strong></div>
                <div><span style={{ color: "#64748B", display: "block" }}>Priority</span><strong style={{ textTransform: "uppercase", color: "#DC2626" }}>{selectedGrievance.priority || "Medium"}</strong></div>
                <div><span style={{ color: "#64748B", display: "block" }}>Status</span><strong style={{ textTransform: "uppercase", color: "#1E3A8A" }}>{selectedGrievance.status || "Open"}</strong></div>
              </div>
              {selectedGrievance.description && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #E2E8F0", fontSize: "13px", color: "#334155" }}>
                  <strong>Description:</strong> {selectedGrievance.description}
                </div>
              )}
            </div>

            {/* Quick Status Action Buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleUpdateGrievanceStatusSubmit("in_progress")}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #1E3A8A", background: "#EFF6FF", color: "#1E3A8A", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                Mark In Progress
              </button>
              <button
                type="button"
                onClick={() => handleUpdateGrievanceStatusSubmit("resolved")}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #16A34A", background: "#ECFDF5", color: "#15803D", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                Mark Resolved
              </button>
            </div>

            {/* Escalation Form */}
            <form onSubmit={handleEscalateGrievanceSubmit} style={{ marginTop: "12px", background: "#FEF2F2", padding: "16px", borderRadius: "12px", border: "1px solid #FCA5A5", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#991B1B" }}>
                ⚠️ Escalate Ticket to Super Administrator
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#7F1D1D", marginBottom: "4px" }}>
                  Escalation Reason &amp; Operational Context *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe why top-level Super Admin intervention is required..."
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #FCA5A5", fontSize: "13px" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={isEscalating}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFFFFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                >
                  {isEscalating ? "Escalating..." : "Submit Escalation"}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Centre Profile & Configuration Modal */}
      <Modal
        isOpen={isCentreConfigOpen}
        onClose={() => setIsCentreConfigOpen(false)}
        title="Rescue Centre Profile & Configuration"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addToast("Centre operational configuration updated successfully!", "success");
            setIsCentreConfigOpen(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Centre Name</label>
            <input type="text" value={centreForm.name} onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Emergency Phone Hotline</label>
            <input type="text" value={centreForm.phone} onChange={(e) => setCentreForm({ ...centreForm, phone: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Operating Hours</label>
            <input type="text" value={centreForm.operating_hours} onChange={(e) => setCentreForm({ ...centreForm, operating_hours: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Operating Address</label>
            <input type="text" value={centreForm.address} onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }} required />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsCentreConfigOpen(false)} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "12.5px" }}>Cancel</button>
            <button type="submit" style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>Save Config</button>
          </div>
        </form>
      </Modal>

      {/* Rescued Animal Intake Registration Modal */}
      <Modal
        isOpen={isRegisterIntakeModalOpen}
        onClose={() => setIsRegisterIntakeModalOpen(false)}
        title="Register Rescued Animal Arrival & Shelter Intake"
      >
        <form onSubmit={handleRegisterIntakeSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Animal / Dog Name *
            </label>
            <input
              type="text"
              value={registerIntakeForm.name}
              onChange={(e) => setRegisterIntakeForm({ ...registerIntakeForm, name: e.target.value })}
              placeholder="e.g. Buddy (or Rescue Tag Name)"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Breed / Description
              </label>
              <input
                type="text"
                value={registerIntakeForm.breed}
                onChange={(e) => setRegisterIntakeForm({ ...registerIntakeForm, breed: e.target.value })}
                placeholder="e.g. Mixed Breed / Indie"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Gender
              </label>
              <select
                value={registerIntakeForm.gender}
                onChange={(e) => setRegisterIntakeForm({ ...registerIntakeForm, gender: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Intake Notes & Physical Condition
            </label>
            <textarea
              rows={3}
              value={registerIntakeForm.notes}
              onChange={(e) => setRegisterIntakeForm({ ...registerIntakeForm, notes: e.target.value })}
              placeholder="Initial physical assessment notes upon arrival..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsRegisterIntakeModalOpen(false)}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "12.5px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingIntake}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}
            >
              {isSubmittingIntake ? "Registering..." : "Submit Animal Intake"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RescueCentreAdminDashboard;
