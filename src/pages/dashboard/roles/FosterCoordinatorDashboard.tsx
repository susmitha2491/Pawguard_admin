import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable, { type Column } from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import { FaHome, FaPaw, FaUserPlus, FaCalendarCheck, FaSync, FaUsers, FaCheckCircle, FaTimesCircle, FaEye } from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import fosterService from "../../../services/fosterService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";

const isPending = (st?: string) => {
  const s = String(st || "").toLowerCase();
  return s === "applied" || s === "pending" || s === "submitted";
};

const isApproved = (st?: string) => {
  const s = String(st || "").toLowerCase();
  return s === "approved" || s === "active" || s === "onboarded";
};

const ApplicationStatusBadge = ({ status }: { status?: string }) => {
  const s = String(status || "applied").toLowerCase();
  const color =
    isApproved(s) ? "#15803D" :
    isPending(s) ? "#D97706" :
    s === "rejected" ? "#DC2626" : "#64748B";
  const bg =
    isApproved(s) ? "#ECFDF5" :
    isPending(s) ? "#FEF3C7" :
    s === "rejected" ? "#FEE2E2" : "#F1F5F9";
  return (
    <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: bg, color, textTransform: "uppercase" }}>
      {s}
    </span>
  );
};

const FosterCoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Pending Application modal
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);

  // Foster Profile Inspect Modal
  const [selectedFosterProfile, setSelectedFosterProfile] = useState<any | null>(null);
  const [isFosterInspectModalOpen, setIsFosterInspectModalOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, profileRes] = await Promise.allSettled([
        dashboardService.getFosterDashboard(),
        fosterService.getFosterProfiles({ page_size: 50 }),
      ]);

      let dashObj: any = null;
      if (dashRes.status === "fulfilled" && dashRes.value) {
        dashObj = dashRes.value?.data || dashRes.value;
      }

      let profileList: any[] = [];
      if (profileRes.status === "fulfilled" && profileRes.value) {
        const val = profileRes.value;
        profileList = Array.isArray(val?.data)
          ? val.data
          : Array.isArray(val?.items)
          ? val.items
          : Array.isArray(val)
          ? val
          : [];
      } else if (dashObj) {
        profileList = Array.isArray(dashObj?.placements)
          ? dashObj.placements
          : Array.isArray(dashObj?.fosters)
          ? dashObj.fosters
          : Array.isArray(dashObj?.items)
          ? dashObj.items
          : [];
      }

      if (dashRes.status === "rejected" && profileRes.status === "rejected") {
        const errObj: any = dashRes.reason || profileRes.reason;
        throw errObj;
      }

      profileList.sort((a, b) => {
        const timeA = new Date(a.created_at || a.date || a.updated_at || 0).getTime();
        const timeB = new Date(b.created_at || b.date || b.updated_at || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setDashboardData(dashObj);
      setProfiles(profileList);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load foster metrics from backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useDataSync(() => {
    fetchDashboard();
  });

  const handleApproveApplication = async (prof: any) => {
    const id = prof?.id || prof?.profile_id;
    if (!id) { addToast("Invalid profile ID.", "error"); return; }
    try {
      setIsSubmitting(true);
      await fosterService.approveProfile(id, {
        status: "approved",
        is_available: true,
        background_check_passed: true,
        home_inspection_passed: true,
      });
      addToast("Foster caregiver application approved successfully!", "success");
      setIsAppModalOpen(false);
      setSelectedApplication(null);
      await fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to approve application.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectApplication = async (prof: any) => {
    const id = prof?.id || prof?.profile_id;
    if (!id) { addToast("Invalid profile ID.", "error"); return; }
    try {
      setIsSubmitting(true);
      await fosterService.rejectProfile(id, {
        reason: "Application rejected by coordinator",
        status: "rejected",
      });
      addToast("Foster caregiver application rejected.", "info");
      setIsAppModalOpen(false);
      setSelectedApplication(null);
      await fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to reject application.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived counts
  const activeHomesCount =
    dashboardData?.active_homes ??
    dashboardData?.active_foster_homes ??
    dashboardData?.activeHomes ??
    profiles.filter((p) => p.is_available || String(p.status).toLowerCase() === "approved" || String(p.status).toLowerCase() === "active").length;

  const petsInCareCount =
    dashboardData?.pets_in_care ??
    dashboardData?.pets_in_foster ??
    dashboardData?.petsInCare ??
    profiles.reduce((sum, p) => sum + Number(p.active_count ?? p.placements_count ?? 0), 0);

  const pendingRequestsCount =
    dashboardData?.pending_requests ??
    dashboardData?.pending_applications ??
    dashboardData?.pendingRequests ??
    profiles.filter((p) => isPending(p.status)).length;

  const availableCapacityCount =
    dashboardData?.available_capacity ??
    dashboardData?.availableCapacity ??
    profiles.reduce((sum, p) => sum + Math.max(0, (Number(p.max_capacity) || 1) - (Number(p.active_count ?? p.placements_count) || 0)), 0);

  const pendingApplicationsList = profiles.filter((p) => isPending(p.status));

  const filteredProfiles = useMemo(() => {
    if (statusFilter === "all") return profiles;
    const filterLower = statusFilter.toLowerCase();
    return profiles.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      if (filterLower === "approved" || filterLower === "active") {
        return isApproved(s) || (p.is_available && !isPending(s) && s !== "rejected");
      }
      if (filterLower === "applied" || filterLower === "pending") {
        return isPending(s);
      }
      if (filterLower === "rejected") {
        return s === "rejected";
      }
      if (filterLower === "inactive") {
        return s === "inactive" || s === "busy" || (!p.is_available && isApproved(s));
      }
      return s === filterLower;
    });
  }, [profiles, statusFilter]);

  const stats = [
    { title: "Active Foster Homes", value: loading ? "..." : error ? "-" : String(activeHomesCount), trend: "Available Homes", color: "#1E3A8A", icon: <FaHome />, onClick: () => navigate("/fosters") },
    { title: "Pets in Foster Care", value: loading ? "..." : error ? "-" : String(petsInCareCount), trend: "Active Placements", color: "#16A34A", icon: <FaPaw />, onClick: () => navigate("/pets") },
    { title: "Pending Applications", value: loading ? "..." : error ? "-" : String(pendingRequestsCount), trend: "Requires Review", color: "#F59E0B", icon: <FaUserPlus />, onClick: () => navigate("/fosters") },
    { title: "Total Care Capacity", value: loading ? "..." : error ? "-" : String(availableCapacityCount), trend: "Available Slots", color: "#1E3A8A", icon: <FaCalendarCheck />, onClick: () => navigate("/fosters") },
    { title: "Registered Profiles", value: loading ? "..." : error ? "-" : String(profiles.length), trend: `${profiles.filter((p) => String(p.status).toLowerCase() === "approved").length} Approved`, color: "#1E3A8A", icon: <FaUsers />, onClick: () => navigate("/fosters") },
  ];

  const placementColumns: Column<any>[] = [
    {
      key: "id",
      title: "Profile ID",
      render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>{v ? String(v).slice(0, 8) : "-"}</span>,
    },
    {
      key: "foster_family",
      title: "Foster Parent / Family",
      render: (_: string, row: any) => {
        const user = row.user || {};
        const name = user.full_name || user.name || user.email || row.foster_name || row.family || row.id || "Foster Parent";
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{name}</div>
            {user.email && <div style={{ fontSize: "12px", color: "#64748B" }}>{user.email}</div>}
          </div>
        );
      },
    },
    {
      key: "active_count",
      title: "Active Placements",
      render: (v: number, row: any) => <span style={{ fontWeight: 700, color: "#1E3A8A" }}>{v ?? row.placements_count ?? 0} Pets</span>,
    },
    {
      key: "max_capacity",
      title: "Capacity",
      render: (v: number) => <span>{v ?? 1} Max</span>,
    },
    {
      key: "created_at",
      title: "Registered Date",
      render: (v: string, row: any) => {
        const dateStr = v || row.date || row.updated_at;
        return <span style={{ fontSize: "12px", color: "#64748B" }}>{dateStr ? formatDateTime(dateStr) : "N/A"}</span>;
      },
    },
    {
      key: "status",
      title: "Status",
      render: (v: string, row: any) => {
        const isAvail = !!row.is_available;
        const statusStr = String(v || (isAvail ? "active" : "busy")).toUpperCase();
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              background: isAvail || statusStr === "APPROVED" ? "#D1FAE5" : "#EFF6FF",
              color: isAvail || statusStr === "APPROVED" ? "#15803D" : "#1E3A8A",
            }}
          >
            {statusStr}
          </span>
        );
      },
    },
    {
      key: "actions",
      title: "Actions",
      render: (_: string, row: any) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFosterProfile(row);
            setIsFosterInspectModalOpen(true);
          }}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "1px solid #CBD5E1",
            background: "#FFF",
            color: "#0F172A",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <FaEye /> View Profile
        </button>
      ),
    },
  ];

  const pendingAppColumns: Column<any>[] = [
    {
      key: "foster_family",
      title: "Applicant Name & Contact",
      render: (_: string, row: any) => {
        const user = row.user || {};
        const name = user.full_name || user.name || user.email || row.foster_name || row.id || "Applicant";
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{name}</div>
            <div style={{ fontSize: "12px", color: "#64748B" }}>
              {user.email || `Profile ID: ${String(row.id || "").slice(0, 8)}`}
            </div>
          </div>
        );
      },
    },
    {
      key: "max_capacity",
      title: "Capacity",
      render: (v: number) => <span style={{ fontWeight: 600, color: "#1E3A8A" }}>{v ?? 1} Max Slots</span>,
    },
    {
      key: "preferences",
      title: "Preferences",
      render: (v: string) => <span style={{ color: "#475569", fontSize: "12px" }}>{v || "Dogs only"}</span>,
    },
    {
      key: "created_at",
      title: "Applied Date",
      render: (v: string, row: any) => {
        const d = v || row.date || row.updated_at;
        return <span style={{ fontSize: "12px", color: "#64748B" }}>{d ? formatDateTime(d) : "—"}</span>;
      },
    },
    {
      key: "status",
      title: "Status",
      render: (v: string) => <ApplicationStatusBadge status={v} />,
    },
    {
      key: "actions",
      title: "Actions",
      render: (_: string, row: any) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/fosters?action=review&profileId=${encodeURIComponent(row.id || row.profile_id)}`);
          }}
          style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#0F172A", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <FaEye /> Review Application
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: "20px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "20px 24px", borderRadius: "14px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Foster Care Administration Station</h1>
        <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Onboard foster caregivers, process placement applications, match animals with temporary homes, and monitor care duration.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>⚠️ {error}</div>
          <button type="button" onClick={fetchDashboard} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#DC2626", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaUserPlus />} title="Register Fosterer" subtitle="Onboard new caregiver" color="#1E3A8A" onClick={() => navigate("/fosters?action=apply")} />
        <QuickActionCard icon={<FaPaw />} title="Place Dog in Foster" subtitle="Match dog with family" color="#16A34A" onClick={() => navigate("/fosters?action=place")} />
        <QuickActionCard icon={<FaSync />} title="Refresh Foster Data" subtitle="Sync latest backend data" color="#1E3A8A" onClick={fetchDashboard} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Foster Caregiver Roster Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Active Foster Caregivers &amp; Placements
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading foster data...</span>}
        </div>
        <DataTable
          columns={placementColumns}
          data={filteredProfiles}
          loading={loading}
          emptyMessage="No active foster profiles registered in backend."
          leftHeaderControls={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                fontWeight: 600,
                color: "#0F172A",
                background: "#FFFFFF",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved &amp; Active</option>
              <option value="applied">Applied (Pending Review)</option>
              <option value="rejected">Rejected</option>
              <option value="inactive">Inactive</option>
            </select>
          }
          onRowClick={(row: any) => {
            setSelectedFosterProfile(row);
            setIsFosterInspectModalOpen(true);
          }}
        />
      </div>

      {/* Pending Foster Applications Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Pending Foster Caregiver Applications ({pendingApplicationsList.length} Pending Review)
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading applications...</span>}
        </div>
        <DataTable
          columns={pendingAppColumns}
          data={pendingApplicationsList}
          loading={loading}
          emptyMessage="No pending foster caregiver applications requiring review."
          onRowClick={(row: any) => {
            navigate(`/fosters?action=review&profileId=${encodeURIComponent(row.id || row.profile_id)}`);
          }}
        />
      </div>

      {/* Foster Profile & Placement Inspect Modal */}
      <Modal isOpen={isFosterInspectModalOpen} onClose={() => setIsFosterInspectModalOpen(false)} title="Foster Caregiver Profile & Placements">
        {selectedFosterProfile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontWeight: 800, fontSize: "18px", color: "#0F172A" }}>
                {selectedFosterProfile.user?.full_name || selectedFosterProfile.user?.name || selectedFosterProfile.user?.email || selectedFosterProfile.foster_name || "Foster Family"}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                Email: {selectedFosterProfile.user?.email || "—"} &bull; Profile ID: <span style={{ fontFamily: "monospace" }}>{String(selectedFosterProfile.id || "").slice(0, 8)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Caregiver Availability</div>
                <div style={{ fontWeight: 700, color: selectedFosterProfile.is_available ? "#15803D" : "#1E3A8A", marginTop: "4px" }}>
                  {selectedFosterProfile.is_available ? "✓ Available for Placement" : "Busy / Max Capacity Reached"}
                </div>
              </div>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Capacity</div>
                <div style={{ fontWeight: 700, color: "#1E3A8A", marginTop: "4px" }}>
                  {selectedFosterProfile.active_count ?? selectedFosterProfile.placements_count ?? 0} Active Placements / {selectedFosterProfile.max_capacity ?? 1} Max Capacity
                </div>
              </div>
            </div>

            {selectedFosterProfile.preferences && (
              <div style={{ fontSize: "13px", color: "#334155", background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong>Preferences / Experience:</strong> {selectedFosterProfile.preferences}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsFosterInspectModalOpen(false);
                  navigate("/fosters");
                }}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#0F172A", fontWeight: 700, cursor: "pointer" }}
              >
                Go to Foster Workspace
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Foster Application Review Modal */}
      <Modal isOpen={isAppModalOpen} onClose={() => setIsAppModalOpen(false)} title="Foster Caregiver Application Review">
        {selectedApplication && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontWeight: 800, fontSize: "18px", color: "#0F172A" }}>
                {selectedApplication.user?.full_name || selectedApplication.user?.name || selectedApplication.user?.email || selectedApplication.foster_name || "Applicant"}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                Application ID: <span style={{ fontFamily: "monospace" }}>{String(selectedApplication.id || "").slice(0, 8)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Email:</strong> {selectedApplication.user?.email || "N/A"}</div>
              <div><strong>Phone:</strong> {selectedApplication.user?.phone || "N/A"}</div>
              <div><strong>Requested Capacity:</strong> {selectedApplication.max_capacity || 1} Animals</div>
              <div><strong>Status:</strong> <ApplicationStatusBadge status={selectedApplication.status} /></div>
            </div>

            {selectedApplication.preferences && (
              <div style={{ fontSize: "13px", color: "#334155", background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong>Preferences:</strong> {selectedApplication.preferences}
              </div>
            )}

            {selectedApplication.notes && (
              <div style={{ fontSize: "13px", color: "#334155", background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong>Notes / Experience:</strong> {selectedApplication.notes}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              {isPending(selectedApplication.status) && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleApproveApplication(selectedApplication)}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaCheckCircle /> Approve Application
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleRejectApplication(selectedApplication)}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaTimesCircle /> Reject Application
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FosterCoordinatorDashboard;
