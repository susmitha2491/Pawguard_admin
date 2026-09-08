import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaAmbulance,
  FaClipboardList,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaTruck,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaArrowRight,
  FaChartBar,
} from "react-icons/fa";
import rescueService from "../../../services/rescueService";
import { useDataSync } from "../../../utils/dataSync";
import { rescueStatusBadge } from "../../../utils/rescueStatus.tsx";
import { formatDateTime } from "../../../utils/dateUtils";
import { getCurrentUser } from "../../../utils/roleUtils";
import LocationMapPreview from "../../../components/common/LocationMapPreview";
import RescueLifecycleTimeline from "../../../components/rescue/RescueLifecycleTimeline";


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

  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Rejection State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionRationale, setRejectionRationale] = useState("");

  // Priority Edit State
  const [editSeverity, setEditSeverity] = useState("medium");
  const [editIsUrgent, setEditIsUrgent] = useState(false);
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  const [allCases, setAllCases] = useState<Record<string, unknown>[]>([]);
  const [assignedCases, setAssignedCases] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCasesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // SINGLE authorized request: GET /rescue (page_size=50)
      // page_size=50 confirmed to return HTTP 200 in browser.
      // page_size=100 returns HTTP 422 — backend does not accept it.
      // Removed: /dashboards/rescue → HTTP 500 (restricted to rescue_centre_admin only)
      // Removed: assigned_to_me=true → HTTP 403 (only authorized for rescue_agent role)
      // Removed: /rescue/agents/location → HTTP 422 (requires lat/lng/radius params;
      //   GPS tracking is a dedicated per-case workflow, not a dashboard summary)
      const allRes = await rescueService.getAllRescueCases({ page_size: 50 });

      if (allRes.success) {
        // allRes.data is already a flat array (getAllRescueCases internally calls unwrapList)
        const rawCases: Record<string, unknown>[] = Array.isArray(allRes.data) ? allRes.data : [];
        const formatted = rawCases.map(formatCase);
        setAllCases(formatted);

        // "My Assigned Cases" — filter client-side using coordinator_id from the backend response.
        // Backend field confirmed: `coordinator_id` (RescueCaseTableRow line 123, formatCaseRow line 261).
        // User ID: User.id (string|number|undefined); also stored as user_id/userId at login.
        // We must NOT send assigned_to_me=true; the backend returns 403 for coordinator role.
        const currentUser = getCurrentUser();
        const rawUserId = currentUser?.id ?? (currentUser as Record<string, unknown> | null)?.user_id ?? (currentUser as Record<string, unknown> | null)?.userId;
        const myIdStr = rawUserId !== undefined && rawUserId !== null ? String(rawUserId).trim().toLowerCase() : "";

        const myAssigned = myIdStr
          ? formatted.filter((c) => {
              // Read coordinator_id from the raw backend object (before formatCase remapping)
              const raw = c.raw as Record<string, unknown>;
              const coordId = raw?.coordinator_id;
              return coordId !== undefined && coordId !== null && String(coordId).trim().toLowerCase() === myIdStr;
            })
          : [];
        setAssignedCases(myAssigned);
      } else {
        // getAllRescueCases swallows HTTP errors and returns success:false.
        // Do NOT silently show all-zero KPIs — surface the failure so the user knows
        // the data could not be loaded rather than believing there are 0 rescue cases.
        setAllCases([]);
        setAssignedCases([]);
        setError(
          "Rescue cases could not be loaded. The server may be temporarily unavailable or your session may have expired. Please refresh or contact support."
        );
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        "Failed to load rescue cases. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCasesData();
  }, [fetchCasesData]);

  useDataSync(() => {
    void fetchCasesData();
  });

  useEffect(() => {
    if (selectedRequest && isViewModalOpen && allCases.length > 0) {
      const targetId = String(selectedRequest.id || (selectedRequest.raw as Record<string, unknown>)?.id || "");
      const updated = allCases.find((c) => {
        const cId = String(c.id || (c.raw as Record<string, unknown>)?.id || "");
        return cId === targetId || String(c.ticket) === targetId;
      });
      if (updated) {
        setSelectedRequest(updated);
      }
    }
  }, [allCases, isViewModalOpen]);

  // ── KPI counts ────────────────────────────────────────────────────────────
  // IMPORTANT: use c.raw.status (the raw backend status) rather than c.status
  // (the display status), because formatCase remaps "verified+assigned → accepted".
  // Using c.raw.status ensures "Awaiting Dispatch" counts all verified cases accurately,
  // and "Active Field" counts all dispatched/accepted/en_route/located/secured cases.
  // Valid backend statuses per formatCaseRow statusPriority map:
  //   submitted/reported → triage
  //   verified           → awaiting dispatch
  //   dispatched/accepted/en_route/in_progress/located/secured → active field
  //   rescued/admitted/completed → rescued & admitted
  //   rejected/cancelled → closed (not counted in active KPIs)

  const triageCount = allCases.filter((c) => {
    const raw = c.raw as Record<string, unknown>;
    const s = String(raw?.status || "").toLowerCase();
    return s === "reported" || s === "submitted" || s === "new";
  }).length;

  const awaitingDispatchCount = allCases.filter((c) => {
    const raw = c.raw as Record<string, unknown>;
    const s = String(raw?.status || "").toLowerCase();
    return s === "verified";
  }).length;

  const activeFieldCount = allCases.filter((c) => {
    const raw = c.raw as Record<string, unknown>;
    const s = String(raw?.status || "").toLowerCase();
    return ["dispatched", "accepted", "en_route", "located", "secured", "in_progress"].includes(s);
  }).length;

  const completedCount = allCases.filter((c) => {
    const raw = c.raw as Record<string, unknown>;
    const s = String(raw?.status || "").toLowerCase();
    return ["admitted", "completed", "rescued"].includes(s);
  }).length;

  // Strict 5-row preview of most recent / priority cases (newest first)
  const recentPreviewCases = allCases.slice(0, 5);

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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to verify rescue incident.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to escalate rescue case.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to update status to located.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to update status to secured.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to admit animal to rescue centre.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to reject rescue report.", "error");
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
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to update case priority.", "error");
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  const stats = [
    {
      title: "Pending Triage",
      value: loading ? "..." : String(triageCount),
      trend: "Needs Verification",
      color: "#DC2626",
      icon: <FaExclamationTriangle />,
      onClick: () => navigate("/rescue-requests?status=reported"),
    },
    {
      title: "Awaiting Dispatch",
      value: loading ? "..." : String(awaitingDispatchCount),
      trend: "Verified & Ready",
      color: "#F59E0B",
      icon: <FaClock />,
      onClick: () => navigate("/rescue-dispatch"),
    },
    {
      title: "Active Field Operations",
      value: loading ? "..." : String(activeFieldCount),
      trend: "In-Progress Rescues",
      color: "#7C3AED",
      icon: <FaTruck />,
      onClick: () => navigate("/rescue-dispatch"),
    },
    {
      title: "My Assigned Cases",
      value: loading ? "..." : String(assignedCases.length),
      trend: "Assigned to You",
      color: "#1E3A8A",
      icon: <FaShieldAlt />,
      onClick: () => navigate("/rescue-requests"),
    },
    {
      title: "Rescued & Admitted",
      value: loading ? "..." : String(completedCount),
      trend: "Safely Admitted",
      color: "#16A34A",
      icon: <FaCheckCircle />,
      onClick: () => navigate("/rescue-requests"),
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
    const canAssign = ["verified", "dispatched", "located", "accepted", "en_route"].includes(status);
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
        <FaTruck /> {isVerified ? "Dispatch" : "Manage"}
      </button>
    );
  };

  return (
    <div>
      {/* High-Level Overview Header */}
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
          Rescue Coordinator Dashboard
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          High-level operational summary of emergency intakes, pending dispatches, and active field rescues.
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

      {/* Useful Operational Quick Action Shortcuts */}
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
          title="Log Emergency Call"
          subtitle="New Incident Intake"
          color="#DC2626"
          onClick={() => navigate("/rescue-requests?action=new")}
        />

        <QuickActionCard
          icon={<FaClipboardList />}
          title="Review Rescue Requests"
          subtitle="Triage & Verification"
          color="#F59E0B"
          onClick={() => navigate("/rescue-requests")}
        />

        <QuickActionCard
          icon={<FaTruck />}
          title="Manage Dispatch Console"
          subtitle="Assign Team & Vehicle"
          color="#1E3A8A"
          onClick={() => navigate("/rescue-dispatch")}
        />

        <QuickActionCard
          icon={<FaChartBar />}
          title="Reports & Analytics"
          subtitle="Operational Efficiency Audit"
          color="#7C3AED"
          onClick={() => navigate("/reports")}
        />
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* Compact Field Operations Indicator */}
      <div style={{ background: "#F8FAFC", padding: "12px 18px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "12.5px", color: "#64748B", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <span>
          📍 <strong>Field Operations Status:</strong> {activeFieldCount > 0 ? `${activeFieldCount} Active Field Rescue${activeFieldCount !== 1 ? "s" : ""} In Progress` : "No Active Field Operations"}
        </span>
        <button
          type="button"
          onClick={() => navigate("/rescue-dispatch")}
          style={{ border: "none", background: "transparent", color: "#1E3A8A", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          Open Dispatch Radar <FaArrowRight size={10} />
        </button>
      </div>


      {/* Concise 5-Row Recent & Priority Rescue Cases Preview */}
      <div className="soft-card" style={{ padding: "20px" }}>
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
              Recent &amp; Priority Rescue Cases
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Showing top 5 recent emergency cases requiring attention
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/rescue-requests")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#1E3A8A",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            View All Requests <FaArrowRight size={11} />
          </button>
        </div>

        <DataTable
          columns={columns}
          data={recentPreviewCases}
          loading={loading}
          error={error}
          onRetry={() => {
            fetchCasesData();
          }}
          emptyMessage="No recent rescue requests found."
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
                    <FaTruck size={12} /> Accept Case &amp; Dispatch Team
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
            <RescueLifecycleTimeline rescue={selectedRequest} />
            <div>
              <strong style={{ color: "#475569" }}>Reporter:</strong> {String(selectedRequest.reporter || "-")}
              {selectedRequest.phone ? ` (${selectedRequest.phone})` : ""}
            </div>
            <div>
              <strong style={{ color: "#475569" }}>Location:</strong> {String(selectedRequest.location || "-")}
            </div>
            <LocationMapPreview
              latitude={(selectedRequest as any).latitude ?? ((selectedRequest as any).raw?.latitude as any)}
              longitude={(selectedRequest as any).longitude ?? ((selectedRequest as any).raw?.longitude as any)}
              locationAddress={String(selectedRequest.location || "")}
              locationLandmark={(selectedRequest as any).location_landmark ?? ((selectedRequest as any).raw?.location_landmark as any) ?? ((selectedRequest as any).raw?.landmark as any)}
              height="200px"
            />
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
                <strong style={{ color: "#1E3A8A" }}>Dispatch &amp; Field Operations</strong>
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
    </div>
  );
};

export default RescueCoordinatorDashboard;