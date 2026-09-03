import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaAmbulance,
  FaUserPlus,
  FaMapMarkerAlt,
  FaClipboardList,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaTruck,
  FaSearch,
  FaExternalLinkAlt,
  FaTimesCircle,
  FaEye,
  FaBus,
} from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import rescueService from "../../../services/rescueService";
import volunteerService from "../../../services/volunteerService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { rescueStatusBadge } from "../../../utils/rescueStatus.tsx";
import { formatDateTime } from "../../../utils/dateUtils";

// ── Transport volunteer helpers ──
const isTransportVol = (vol: any): boolean =>
  String(vol?.preferred_role || vol?.volunteer_type || vol?.applied_role || "").toLowerCase().includes("transport");

const isVolPending = (st?: string) => { const s = String(st || "").toLowerCase(); return s === "applied" || s === "pending" || s === "submitted"; };
const isVolApproved = (st?: string) => { const s = String(st || "").toLowerCase(); return s === "approved" || s === "active" || s === "onboarded"; };

const VolBadge = ({ status }: { status?: string }) => {
  const s = String(status || "applied").toLowerCase();
  const color = isVolApproved(s) ? "#15803D" : isVolPending(s) ? "#D97706" : s === "rejected" ? "#DC2626" : "#64748B";
  const bg   = isVolApproved(s) ? "#ECFDF5" : isVolPending(s) ? "#FEF3C7" : s === "rejected" ? "#FEE2E2" : "#F1F5F9";
  return <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: bg, color, textTransform: "uppercase" }}>{s}</span>;
};

interface RescueDashboardData {
  total_calls: number;
  pending: number;
  dispatched: number;
  rescued: number;
  recent_calls: Record<string, unknown>[];
}

type CardTab = "all" | "assigned" | "pending" | "rescued";

const unwrapList = (v: unknown): Record<string, unknown>[] => {
  if (!v || typeof v !== "object") return [];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const obj = v as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as Record<string, unknown>).data)) {
    return (obj.data as Record<string, unknown>).data as Record<string, unknown>[];
  }
  if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[];
  if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as Record<string, unknown>).items)) {
    return (obj.data as Record<string, unknown>).items as Record<string, unknown>[];
  }
  return [];
};

const formatCase = (c: Record<string, unknown>) => {
  const rawStatus = String(c.status || "-").toLowerCase();
  const dispatchObj = (c.dispatch as Record<string, unknown>) || null;
  const assignedAgentId = String(c.assigned_agent_id || c.agent_id || dispatchObj?.assigned_driver_id || dispatchObj?.agent_id || c.assigned_agent || "");
  const hasAssignment = !!(c.coordinator_id || assignedAgentId || dispatchObj);
  const displayStatus = (rawStatus === "verified" && hasAssignment) ? "accepted" : rawStatus;

  return {
    id: String(c.id || c.ticket_number || ""),
    ticket: String(c.ticket_number || c.id || "-"),
    reporter: String(c.reporter_name || c.reporter || "-"),
    phone: String(c.reporter_phone || c.phone || "-"),
    animal_count: (c.animal_count ?? "-") as string | number,
    status: displayStatus,
    location: String(c.location_address || c.location || "-"),
    severity: String(c.severity || "-"),
    is_urgent: !!c.is_urgent,
    rejection_rationale: String(c.rejection_rationale || ""),
    dispatch: dispatchObj,
    created_at: c.created_at ? formatDateTime(c.created_at as string) : "-",
    raw: c,
  };
};

const RescueCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeCard, setActiveCard] = useState<CardTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // GPS Tracking & Agent Suggestion State
  const [agentGpsLocations, setAgentGpsLocations] = useState<any[]>([]);
  const [isSuggestingAgents, setIsSuggestingAgents] = useState(false);
  const [suggestedAgents, setSuggestedAgents] = useState<any[]>([]);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);

  // Rejection & Rationale State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionRationale, setRejectionRationale] = useState("");

  // Severity & Priority Edit State
  const [editSeverity, setEditSeverity] = useState("medium");
  const [editIsUrgent, setEditIsUrgent] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  const [dashboardData, setDashboardData] = useState<RescueDashboardData>({
    total_calls: 0,
    pending: 0,
    dispatched: 0,
    rescued: 0,
    recent_calls: [],
  });

  const [allCases, setAllCases] = useState<Record<string, unknown>[]>([]);
  const [assignedCases, setAssignedCases] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Transport Volunteers ──
  const [transportVols, setTransportVols] = useState<any[]>([]);
  const [volLoading, setVolLoading] = useState(true);
  const [isVolSubmitting, setIsVolSubmitting] = useState(false);
  const [selectedVol, setSelectedVol] = useState<any | null>(null);
  const [isVolModalOpen, setIsVolModalOpen] = useState(false);

  const fetchCasesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, allRes, assignedRes, gpsRes] = await Promise.allSettled([
        dashboardService.getRescueDashboard(),
        rescueService.getRescueCases({ page_size: 500 }),
        rescueService.getRescueCases({ page_size: 500, assigned_to_me: true }),
        rescueService.getAgentLocations(),
      ]);

      if (gpsRes.status === "fulfilled") {
        setAgentGpsLocations(unwrapList(gpsRes.value));
      }

      if (dashRes.status === "fulfilled") {
        const data = (dashRes.value as { data?: Record<string, unknown> })?.data || (dashRes.value as Record<string, unknown>) || {};
        setDashboardData({
          total_calls: Number(data.total_calls ?? data.totalCalls ?? 0),
          pending: Number(data.pending ?? data.pendingCases ?? 0),
          dispatched: Number(data.dispatched ?? data.dispatchedCases ?? 0),
          rescued: Number(data.rescued ?? data.rescuedAnimals ?? 0),
          recent_calls: Array.isArray(data.recent_calls) ? (data.recent_calls as Record<string, unknown>[]) : Array.isArray(data.recentCalls) ? (data.recentCalls as Record<string, unknown>[]) : [],
        });
      }

      if (allRes.status === "fulfilled") {
        setAllCases(unwrapList(allRes.value).map(formatCase));
      } else {
        setAllCases([]);
      }

      if (assignedRes.status === "fulfilled") {
        setAssignedCases(unwrapList(assignedRes.value).map(formatCase));
      } else {
        setAssignedCases([]);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load rescue coordinator metrics. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTransportVols = useCallback(async () => {
    try {
      setVolLoading(true);
      let res: any;
      try { res = await volunteerService.getVolunteers(); } catch { res = []; }
      const list: any[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : [];
      const transport = list.filter(isTransportVol);
      transport.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setTransportVols(transport);
    } catch {
      setTransportVols([]);
    } finally {
      setVolLoading(false);
    }
  }, []);

  const handleVolApprove = async (vol: any) => {
    const id = vol?.id || vol?.application_id || vol?.profile_id;
    if (!id) { addToast("Invalid volunteer ID.", "error"); return; }
    try {
      setIsVolSubmitting(true);
      try { await volunteerService.approveApplication(id); }
      catch (e: any) {
        if (e?.response?.status === 404 || e?.response?.status === 405) { await volunteerService.updateVolunteerProfile(id, { status: "active" }); }
        else throw e;
      }
      addToast("Transport volunteer approved!", "success");
      setTransportVols((prev) => prev.map((v) => v.id === id ? { ...v, status: "approved" } : v));
      if (selectedVol?.id === id) setSelectedVol((p: any) => p ? { ...p, status: "approved" } : null);
      fetchTransportVols();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to approve.", "error");
    } finally { setIsVolSubmitting(false); }
  };

  const handleVolReject = async (vol: any) => {
    const id = vol?.id || vol?.application_id || vol?.profile_id;
    if (!id) { addToast("Invalid volunteer ID.", "error"); return; }
    try {
      setIsVolSubmitting(true);
      try { await volunteerService.rejectApplication(id, "Rejected by Rescue Coordinator."); }
      catch (e: any) {
        if (e?.response?.status === 404 || e?.response?.status === 405) { await volunteerService.updateVolunteerProfile(id, { status: "rejected" }); }
        else throw e;
      }
      addToast("Transport volunteer application rejected.", "info");
      setTransportVols((prev) => prev.map((v) => v.id === id ? { ...v, status: "rejected" } : v));
      if (selectedVol?.id === id) setSelectedVol((p: any) => p ? { ...p, status: "rejected" } : null);
      fetchTransportVols();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to reject.", "error");
    } finally { setIsVolSubmitting(false); }
  };

  useEffect(() => {
    void fetchCasesData();
    void fetchTransportVols();
  }, [fetchTransportVols]);

  useDataSync(() => {
    void fetchCasesData();
    void fetchTransportVols();
  });

  // Calculate dynamic card counts
  const totalCount = allCases.length || dashboardData.total_calls;
  const pendingCount = allCases.filter((c) => /reported|pending|new|verified/i.test(String(c.status || ""))).length || dashboardData.pending;
  const rescuedCount = allCases.filter((c) => /rescued|located|secured|admitted|completed/i.test(String(c.status || ""))).length || dashboardData.rescued;

  // Filter current active dataset
  const getDisplayData = () => {
    let list: Record<string, unknown>[];
    if (activeCard === "assigned") {
      list = assignedCases;
    } else if (activeCard === "pending") {
      list = allCases.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "reported" || s === "pending" || s === "new" || s === "verified";
      });
    } else if (activeCard === "rescued") {
      list = allCases.filter((c) => {
        const s = String(c.status || "").toLowerCase();
        return s === "rescued" || s === "located" || s === "secured" || s === "admitted" || s === "completed";
      });
    } else {
      list = allCases;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((r) =>
      String(r.ticket || "").toLowerCase().includes(q) ||
      String(r.reporter || "").toLowerCase().includes(q) ||
      String(r.location || "").toLowerCase().includes(q) ||
      String(r.severity || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  };

  const displayData = getDisplayData();

  const getTableTitle = () => {
    switch (activeCard) {
      case "assigned":
        return "My Assigned Cases";
      case "pending":
        return "Pending Rescue Cases";
      case "rescued":
        return "Rescued Dogs / Completed Cases";
      default:
        return "All Rescue Calls";
    }
  };

  const getEmptyMessage = () => {
    switch (activeCard) {
      case "assigned":
        return "No cases are currently assigned to you.";
      case "pending":
        return "No pending rescue cases found.";
      case "rescued":
        return "No rescued dogs or completed cases found.";
      default:
        return "No rescue calls found.";
    }
  };

  const handleRowClick = (row: Record<string, unknown>) => {
    setSelectedRequest(row);
    setIsViewModalOpen(true);
  };

  // Status Action Handlers for Modal
  const handleVerifyRequest = async (id: string) => {
    try {
      setIsActionLoading(true);
      await rescueService.updateRescueCase(id, { status: "verified" });
      addToast("Rescue incident verified successfully!", "success");
      setIsViewModalOpen(false);
      fetchCasesData();
    } catch {
      addToast("Failed to verify rescue incident.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEscalateRequest = async (id: string) => {
    try {
      setIsActionLoading(true);
      await rescueService.escalateRescue(id, "high_priority", "Urgent escalation from coordinator dashboard.");
      addToast("Rescue case escalated to high priority!", "info");
      setIsViewModalOpen(false);
      fetchCasesData();
    } catch {
      addToast("Failed to escalate rescue case.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLocatedRequest = async (id: string) => {
    try {
      setIsActionLoading(true);
      await rescueService.markRescueLocated(id);
      addToast("Animal marked as located by field team!", "info");
      setIsViewModalOpen(false);
      fetchCasesData();
    } catch {
      addToast("Failed to update status to located.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSecuredRequest = async (id: string) => {
    try {
      setIsActionLoading(true);
      await rescueService.markRescueSecured(id);
      addToast("Animal marked as secured!", "info");
      setIsViewModalOpen(false);
      fetchCasesData();
    } catch {
      addToast("Failed to update status to secured.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAdmittedRequest = async (id: string) => {
    try {
      setIsActionLoading(true);
      await rescueService.markRescueAdmitted(id);
      addToast("Animal successfully admitted to rescue centre!", "success");
      setIsViewModalOpen(false);
      fetchCasesData();
    } catch {
      addToast("Failed to admit animal to rescue centre.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id) return;
    if (!rejectionRationale.trim()) {
      addToast("Please provide a rejection rationale.", "error");
      return;
    }
    try {
      setIsActionLoading(true);
      await rescueService.rejectRescueRequest(String(selectedRequest.id), rejectionRationale.trim());
      addToast("Rescue report rejected and closed.", "info");
      setIsRejectModalOpen(false);
      setIsViewModalOpen(false);
      setRejectionRationale("");
      fetchCasesData();
    } catch {
      addToast("Failed to reject rescue report.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdatePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id) return;
    try {
      setIsUpdatingPriority(true);
      await rescueService.updateRescueCase(String(selectedRequest.id), {
        severity: editSeverity,
        is_urgent: editIsUrgent,
      });
      addToast(`Rescue case priority updated to ${editSeverity.toUpperCase()}${editIsUrgent ? " (URGENT)" : ""}.`, "success");
      fetchCasesData();
    } catch {
      addToast("Failed to update case priority.", "error");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const handleSuggestNearestAgents = async (requestId: string) => {
    try {
      setIsSuggestingAgents(true);
      const res = await rescueService.suggestNearestAgents(requestId);
      const agentsList = unwrapList(res);
      setSuggestedAgents(agentsList);
      setIsSuggestModalOpen(true);
    } catch {
      addToast("Could not fetch GPS agent suggestions.", "error");
    } finally {
      setIsSuggestingAgents(false);
    }
  };

  const approvedTransportVols = transportVols.filter((v) => isVolApproved(v.status));
  const pendingTransportVols = transportVols.filter((v) => isVolPending(v.status));

  const stats = [
    {
      title: "Total Rescue Calls",
      value: loading ? "..." : String(totalCount),
      trend: "All Rescue Requests",
      color: "#DC2626",
      icon: <FaExclamationTriangle />,
      selected: activeCard === "all",
      onClick: () => {
        setActiveCard("all");
        const el = document.getElementById("rescue-table-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "My Assigned Cases",
      value: loading ? "..." : String(assignedCases.length),
      trend: "Assigned to You",
      color: "#1E3A8A",
      icon: <FaClipboardList />,
      selected: activeCard === "assigned",
      onClick: () => {
        setActiveCard("assigned");
        const el = document.getElementById("rescue-table-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Pending Cases",
      value: loading ? "..." : String(pendingCount),
      trend: "Awaiting Dispatch",
      color: "#F59E0B",
      icon: <FaClock />,
      selected: activeCard === "pending",
      onClick: () => {
        setActiveCard("pending");
        const el = document.getElementById("rescue-table-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Dogs Rescued",
      value: loading ? "..." : String(rescuedCount),
      trend: "Successfully Completed",
      color: "#16A34A",
      icon: <FaCheckCircle />,
      selected: activeCard === "rescued",
      onClick: () => {
        setActiveCard("rescued");
        const el = document.getElementById("rescue-table-section");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Transport Volunteers",
      value: volLoading ? "..." : String(transportVols.length),
      trend: `${approvedTransportVols.length} Available`,
      color: "#1E3A8A",
      icon: <FaBus />,
    },
  ];

  const columns = [
    { key: "ticket", title: "Ticket / ID" },
    { key: "reporter", title: "Reporter" },
    { key: "animal_count", title: "Dogs" },
    { key: "location", title: "Location" },
    {
      key: "severity",
      title: "Priority",
      render: (val: string) => (
        <span style={{ textTransform: "uppercase", fontWeight: 600, fontSize: "12px", color: val === "critical" ? "#DC2626" : val === "high" ? "#EA580C" : val === "medium" ? "#F59E0B" : "#16A34A" }}>
          {val || "-"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (val: string) => (
        <span style={{ textTransform: "capitalize", fontWeight: 600, fontSize: "12px" }}>{val || "-"}</span>
      ),
    },
    { key: "created_at", title: "Reported At" },
  ];

  const rowActions = (row: Record<string, unknown>) => {
    const status = String(row.status || "").toLowerCase();
    const isVerified = status === "verified";
    const canAssign = ["verified", "dispatched", "located"].includes(status);
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/rescue-dispatch?case_id=${encodeURIComponent(String(row.id || ""))}`);
        }}
        disabled={!canAssign}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "none",
          background: isVerified ? "#16A34A" : "#1E3A8A",
          color: "#FFF",
          fontSize: "12px",
          fontWeight: 600,
          cursor: canAssign ? "pointer" : "not-allowed",
          opacity: canAssign ? 1 : 0.45,
        }}
      >
        <FaTruck /> {isVerified ? "Accept & Assign Team" : "Assign Team"}
      </button>
    );
  };

  return (
    <div>
      {/* Hero Banner */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "20px 24px",
          borderRadius: "14px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
          Rescue Coordinator Control Center
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Emergency response management: dispatch field agents, monitor rescue requests and coordinate rescue operations.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <QuickActionCard
          icon={<FaAmbulance />}
          title="New Emergency"
          subtitle="Log Distress Call"
          color="#DC2626"
          onClick={() => navigate("/rescue-requests?action=new")}
        />

        <QuickActionCard
          icon={<FaUserPlus />}
          title="Assign Agent"
          subtitle="Dispatch Field Agent"
          color="#1E3A8A"
          onClick={() => navigate("/rescue-dispatch")}
        />

        <QuickActionCard
          icon={<FaMapMarkerAlt />}
          title="Track Agents"
          subtitle="Live Tracking"
          color="#16A34A"
          onClick={() => navigate("/rescue-dispatch")}
        />

        <QuickActionCard
          icon={<FaClipboardList />}
          title="Shelter Directory"
          subtitle="Handover Destination"
          color="#1E3A8A"
          onClick={() => navigate("/shelters")}
        />
      </div>

      {/* Dynamic Interactive Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* Live Field Agent GPS Locations & Roster */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <FaMapMarkerAlt style={{ color: "#16A34A" }} /> Live Field Agent GPS Locations &amp; Dispatch Radar
            </h3>
            <p style={{ margin: "2px 0 0", color: "#64748B", fontSize: "12.5px" }}>
              Real-time telemetry and coordinates fetched directly from backend OpenAPI location stream.
            </p>
          </div>
          <span style={{ fontSize: "12px", background: "#ECFDF5", color: "#15803D", padding: "4px 10px", borderRadius: "999px", fontWeight: 700 }}>
            {agentGpsLocations.length} Active GPS Transmitters Connected
          </span>
        </div>

        {agentGpsLocations.length === 0 ? (
          <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
            No active agent GPS signals broadcasted in the last reporting window. Active agents automatically broadcast location during dispatches.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            {agentGpsLocations.map((agent: any, idx: number) => {
              const statusLower = String(agent.status || agent.dispatch_status || "available").toLowerCase();
              const isBusy = statusLower.includes("dispatch") || statusLower.includes("busy") || statusLower.includes("active");
              return (
                <div key={agent.agent_id || agent.id || idx} style={{ padding: "12px 14px", borderRadius: "10px", background: "#FFFFFF", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <strong style={{ fontSize: "13.5px", color: "#0F172A" }}>{agent.agent_name || agent.full_name || agent.name || `Agent #${idx + 1}`}</strong>
                    <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: isBusy ? "#FEF3C7" : "#ECFDF5", color: isBusy ? "#D97706" : "#15803D", textTransform: "uppercase" }}>
                      {isBusy ? "ON DISPATCH" : "AVAILABLE"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div>📍 <strong>GPS:</strong> {agent.latitude ? `${Number(agent.latitude).toFixed(4)}, ${Number(agent.longitude).toFixed(4)}` : agent.location || "Sector Radar"}</div>
                    {agent.battery_level !== undefined && <div>🔋 <strong>Battery:</strong> {agent.battery_level}%</div>}
                    {agent.last_ping && <div>⏱️ <strong>Last Ping:</strong> {formatDateTime(agent.last_ping)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynamic Rescue Operations Table */}
      <div id="rescue-table-section" className="soft-card" style={{ padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
              {getTableTitle()}
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Showing {displayData.length} records matching {activeCard} filter
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: "13px" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, reporter, location..."
                style={{
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none",
                  width: "240px",
                }}
              />
            </div>
            {loading && (
              <span style={{ color: "#1E3A8A", fontSize: "12px", fontWeight: 600 }}>
                Loading...
              </span>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={displayData}
          loading={loading}
          error={error}
          onRetry={() => {
            fetchCasesData();
          }}
          emptyMessage={getEmptyMessage()}
          renderRowActions={rowActions}
          onRowClick={(row) => handleRowClick(row)}
        />
      </div>

      {/* Rescue Request Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Rescue Request Details${selectedRequest?.ticket ? ` — ${selectedRequest.ticket}` : ""}`}
        size="lg"
        footer={
          selectedRequest ? (
            <>
              {["reported", "pending"].includes(String(selectedRequest.status || "").toLowerCase()) && (
                <>
                  <button
                    disabled={isActionLoading}
                    onClick={() => handleVerifyRequest(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#16A34A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Verify Incident
                  </button>
                  <button
                    disabled={isActionLoading}
                    onClick={() => setIsRejectModalOpen(true)}
                    style={{ padding: "8px 16px", background: "#DC2626", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Reject Report
                  </button>
                  <button
                    disabled={isActionLoading || isSuggestingAgents}
                    onClick={() => handleSuggestNearestAgents(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    {isSuggestingAgents ? "Finding Agents..." : "📍 Suggest Nearest Agents (GPS)"}
                  </button>
                  <button
                    disabled={isActionLoading}
                    onClick={() => handleEscalateRequest(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Escalate
                  </button>
                </>
              )}

              {String(selectedRequest.status || "").toLowerCase() === "verified" && (
                <>
                  <button
                    disabled={isActionLoading}
                    onClick={() => {
                      setIsViewModalOpen(false);
                      navigate(`/rescue-dispatch?case_id=${encodeURIComponent(String(selectedRequest.id || ""))}`);
                    }}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaTruck size={12} /> Accept Case & Dispatch Team
                  </button>
                  <button
                    disabled={isActionLoading}
                    onClick={() => handleEscalateRequest(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Escalate
                  </button>
                </>
              )}

              {String(selectedRequest.status || "").toLowerCase() === "dispatched" && (
                <>
                  <button
                    disabled={isActionLoading}
                    onClick={() => handleLocatedRequest(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Mark Located
                  </button>
                  <button
                    disabled={isActionLoading}
                    onClick={() => handleEscalateRequest(String(selectedRequest.id || ""))}
                    style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    Escalate
                  </button>
                </>
              )}

              {String(selectedRequest.status || "").toLowerCase() === "located" && (
                <button
                  disabled={isActionLoading}
                  onClick={() => handleSecuredRequest(String(selectedRequest.id || ""))}
                  style={{ padding: "8px 16px", background: "#F59E0B", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                >
                  Mark Secured
                </button>
              )}

              {String(selectedRequest.status || "").toLowerCase() === "rescued" && (
                <button
                  disabled={isActionLoading}
                  onClick={() => handleAdmittedRequest(String(selectedRequest.id || ""))}
                  style={{ padding: "8px 16px", background: "#15803D", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                >
                  Admit to Centre
                </button>
              )}

              {String(selectedRequest.status || "").toLowerCase() === "admitted" && (
                <button
                  onClick={() => window.open(`/public-scan/${(selectedRequest.raw as Record<string, unknown>)?.dog_id || selectedRequest.id}`, "_blank")}
                  style={{ padding: "8px 16px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaExternalLinkAlt size={12} /> View Dog Profile
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                style={{ padding: "8px 16px", background: "#64748B", color: "#FFF", borderRadius: "6px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
              >
                Close
              </button>
            </>
          ) : null
        }
      >
        {selectedRequest && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <strong style={{ color: "#475569" }}>Reporter:</strong> {String(selectedRequest.reporter || "-")}
              {selectedRequest.phone ? ` (${selectedRequest.phone})` : ""}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Location:</strong> {String(selectedRequest.location || "-")}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Priority / Severity:</strong>{" "}
              <span
                style={{
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color:
                    selectedRequest.severity === "critical"
                      ? "#DC2626"
                      : selectedRequest.severity === "high"
                      ? "#EA580C"
                      : selectedRequest.severity === "medium"
                      ? "#F59E0B"
                      : "#16A34A",
                }}
              >
                {String(selectedRequest.severity || "-")}
              </span>
              {Boolean(selectedRequest.is_urgent) && (
                <span style={{ marginLeft: "8px", background: "#FEF2F2", color: "#DC2626", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 700 }}>
                  URGENT
                </span>
              )}
            </div>
            <form onSubmit={handleUpdatePrioritySubmit} style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ color: "#475569", fontSize: "13px" }}>Update Priority:</strong>
              <select
                value={editSeverity}
                onChange={(e) => setEditSeverity(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12.5px" }}
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="critical">CRITICAL</option>
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12.5px", color: "#DC2626", fontWeight: 700, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editIsUrgent}
                  onChange={(e) => setEditIsUrgent(e.target.checked)}
                />
                Is Urgent Emergency
              </label>
              <button
                type="submit"
                disabled={isUpdatingPriority}
                style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
              >
                {isUpdatingPriority ? "Saving..." : "Save Priority"}
              </button>
            </form>
            <div>
              <strong style={{ color: "#475569" }}>Current Status:</strong> {rescueStatusBadge(String(selectedRequest.status || ""))}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Reported At:</strong> {String(selectedRequest.created_at || "-")}
            </div>

            {selectedRequest.rejection_rationale ? (
              <div style={{ background: "#FEF2F2", padding: "10px 14px", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
                <strong style={{ color: "#DC2626" }}>Rejection Rationale:</strong> {String(selectedRequest.rejection_rationale)}
              </div>
            ) : null}

            {selectedRequest.dispatch ? (
              <div style={{ background: "#F5F3FF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #DDD6FE" }}>
                <strong style={{ color: "#1E3A8A" }}>Dispatch & Field Operations</strong>
                <div style={{ marginTop: "6px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {(selectedRequest.dispatch as Record<string, unknown>).assigned_vehicle_id || (selectedRequest.dispatch as Record<string, unknown>).vehicle_id ? (
                    <div><strong>Vehicle:</strong> {String((selectedRequest.dispatch as Record<string, unknown>).assigned_vehicle_id || (selectedRequest.dispatch as Record<string, unknown>).vehicle_id)}</div>
                  ) : null}
                  {(selectedRequest.dispatch as Record<string, unknown>).assigned_driver_id ? (
                    <div><strong>Driver:</strong> {String((selectedRequest.dispatch as Record<string, unknown>).assigned_driver_id)}</div>
                  ) : null}
                  {(selectedRequest.dispatch as Record<string, unknown>).dispatched_at ? (
                    <div><strong>Dispatched:</strong> {formatDateTime((selectedRequest.dispatch as Record<string, unknown>).dispatched_at as string)}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
      {/* Transport Volunteer Roster & Review Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Transport Response Volunteers ({approvedTransportVols.length} Active, {pendingTransportVols.length} Pending Review)
          </h3>
          {volLoading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading volunteers...</span>}
        </div>
        <DataTable
          columns={[
            {
              key: "name",
              title: "Volunteer Name & Contact",
              render: (_: unknown, row: any) => (
                <div>
                  <div style={{ fontWeight: 700, color: "#0F172A" }}>{row.user?.full_name || row.full_name || row.emergency_contact_name || "Volunteer"}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>{row.user?.email || row.email || `ID: ${String(row.id || "").slice(0, 8)}`}</div>
                </div>
              ),
            },
            {
              key: "vehicle_type",
              title: "Vehicle / Equipment",
              render: (v: string, row: any) => <span style={{ color: "#475569", fontSize: "13px" }}>{v || row.vehicle || "Standard Rescue Transport"}</span>,
            },
            {
              key: "status",
              title: "Status",
              render: (v: string) => <VolBadge status={v} />,
            },
            {
              key: "actions",
              title: "Actions",
              render: (_: unknown, row: any) => (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedVol(row); setIsVolModalOpen(true); }}
                  style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#0F172A", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <FaEye /> Review
                </button>
              ),
            },
          ]}
          data={transportVols}
          loading={volLoading}
          emptyMessage="No transport volunteers registered."
          onRowClick={(row: any) => { setSelectedVol(row); setIsVolModalOpen(true); }}
        />
      </div>

      {/* Transport Volunteer Review Modal */}
      <Modal isOpen={isVolModalOpen} onClose={() => setIsVolModalOpen(false)} title="Transport Volunteer Application Review">
        {selectedVol && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Name:</strong> {selectedVol.user?.full_name || selectedVol.full_name || selectedVol.emergency_contact_name || "Volunteer"}</div>
              <div><strong>Email:</strong> {selectedVol.user?.email || selectedVol.email || "N/A"}</div>
              <div><strong>Phone:</strong> {selectedVol.user?.phone || selectedVol.phone || "N/A"}</div>
              <div><strong>Status:</strong> <VolBadge status={selectedVol.status} /></div>
              <div><strong>Vehicle Type:</strong> {selectedVol.vehicle_type || selectedVol.vehicle || "N/A"}</div>
              <div><strong>License #:</strong> {selectedVol.driver_license_number || selectedVol.license || "N/A"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              {isVolPending(selectedVol.status) && (
                <>
                  <button
                    type="button"
                    disabled={isVolSubmitting}
                    onClick={() => handleVolApprove(selectedVol)}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaCheckCircle /> Approve Volunteer
                  </button>
                  <button
                    type="button"
                    disabled={isVolSubmitting}
                    onClick={() => handleVolReject(selectedVol)}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaTimesCircle /> Reject Volunteer
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Rejection Rationale Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title={`Reject Rescue Report${selectedRequest?.ticket ? ` — ${selectedRequest.ticket}` : ""}`}
      >
        <form onSubmit={handleRejectSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
            Rejecting this rescue report will close the case and notify the reporting party. Please provide an explicit operational rationale.
          </p>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#991B1B", marginBottom: "4px" }}>
              Rejection Rationale / Explanation *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Duplicate report, invalid location, animal not found, handled by public owner..."
              value={rejectionRationale}
              onChange={(e) => setRejectionRationale(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #FCA5A5", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isActionLoading}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isActionLoading ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Nearest Agent GPS Suggestions Modal */}
      <Modal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        title="📍 Nearest Available Field Agents (GPS Radar)"
        size="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
            Calculated nearest active agents based on live GPS coordinates and proximity to incident location.
          </p>
          {suggestedAgents.length === 0 ? (
            <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
              No nearby agents found within 50km radius.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {suggestedAgents.map((ag: any, i: number) => (
                <div key={ag.agent_id || ag.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#0F172A" }}>{ag.agent_name || ag.full_name || ag.name || `Agent #${i + 1}`}</strong>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      📍 Proximity: <strong>{ag.distance_km != null ? `${Number(ag.distance_km).toFixed(1)} km` : "Nearby"}</strong> | Status: <span style={{ textTransform: "uppercase", fontWeight: 700, color: "#16A34A" }}>{ag.status || "Active"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSuggestModalOpen(false);
                      setIsViewModalOpen(false);
                      navigate(`/rescue-dispatch?case_id=${encodeURIComponent(String(selectedRequest?.id || ""))}&agent_id=${encodeURIComponent(String(ag.agent_id || ag.id || ""))}`);
                    }}
                    style={{ padding: "6px 14px", background: "#1E3A8A", color: "#FFF", borderRadius: "6px", border: "none", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    Select &amp; Dispatch
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RescueCoordinatorDashboard;