import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable, { type Column } from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import { FaHome, FaPaw, FaUserPlus, FaCalendarCheck, FaSync, FaUsers, FaCheckCircle, FaTimesCircle, FaEye } from "react-icons/fa";
import dashboardService from "../../../services/dashboardService";
import fosterService from "../../../services/fosterService";
import volunteerService from "../../../services/volunteerService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";

// Helper: identify foster-care volunteers
const isFosterCareVolunteer = (vol: any): boolean => {
  const role = String(vol?.preferred_role || vol?.volunteer_type || vol?.applied_role || "").toLowerCase();
  return role.includes("foster");
};

const isPending = (st?: string) => {
  const s = String(st || "").toLowerCase();
  return s === "applied" || s === "pending" || s === "submitted";
};

const isApproved = (st?: string) => {
  const s = String(st || "").toLowerCase();
  return s === "approved" || s === "active" || s === "onboarded";
};

const VolunteerStatusBadge = ({ status }: { status?: string }) => {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Foster volunteers state
  const [fosterVolunteers, setFosterVolunteers] = useState<any[]>([]);
  const [volLoading, setVolLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details modal
  const [selectedVol, setSelectedVol] = useState<any | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Foster Profile Inspect Modal
  const [selectedFosterProfile, setSelectedFosterProfile] = useState<any | null>(null);
  const [isFosterInspectModalOpen, setIsFosterInspectModalOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, profileRes] = await Promise.allSettled([
        dashboardService.getFosterDashboard(),
        fosterService.getFosterProfiles({ page_size: 500 }),
      ]);

      let dashObj: any = null;
      if (dashRes.status === "fulfilled" && dashRes.value) {
        dashObj = dashRes.value?.data || dashRes.value;
      }

      let profileList: any[] = [];
      if (profileRes.status === "fulfilled" && profileRes.value) {
        profileList = Array.isArray(profileRes.value?.data)
          ? profileRes.value.data
          : Array.isArray(profileRes.value)
          ? profileRes.value
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
          "Failed to load foster metrics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFosterVolunteers = useCallback(async () => {
    try {
      setVolLoading(true);
      let res: any;
      try {
        res = await volunteerService.getVolunteers({ page_size: 500 });
      } catch {
        res = [];
      }
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : [];

      const fosterOnly = list.filter(isFosterCareVolunteer);
      fosterOnly.sort((a, b) => {
        const tA = new Date(a.created_at || a.submitted_at || 0).getTime();
        const tB = new Date(b.created_at || b.submitted_at || 0).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
      setFosterVolunteers(fosterOnly);
    } catch {
      setFosterVolunteers([]);
    } finally {
      setVolLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchFosterVolunteers();
  }, [fetchDashboard, fetchFosterVolunteers]);

  useDataSync(() => {
    fetchDashboard();
    fetchFosterVolunteers();
  });

  const handleApprove = async (vol: any) => {
    const id = vol?.id || vol?.application_id || vol?.profile_id;
    if (!id) { addToast("Invalid volunteer ID.", "error"); return; }
    try {
      setIsSubmitting(true);
      try {
        await volunteerService.approveApplication(id);
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          await volunteerService.updateVolunteerProfile(id, { status: "active" });
        } else throw err;
      }
      addToast(`Foster volunteer approved!`, "success");
      setFosterVolunteers((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: "approved" } : v))
      );
      if (selectedVol?.id === id) setSelectedVol((p: any) => p ? { ...p, status: "approved" } : null);
      fetchFosterVolunteers();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to approve volunteer.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (vol: any) => {
    const id = vol?.id || vol?.application_id || vol?.profile_id;
    if (!id) { addToast("Invalid volunteer ID.", "error"); return; }
    try {
      setIsSubmitting(true);
      try {
        await volunteerService.rejectApplication(id, "Rejected by Foster Coordinator.");
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          await volunteerService.updateVolunteerProfile(id, { status: "rejected" });
        } else throw err;
      }
      addToast("Foster volunteer application rejected.", "info");
      setFosterVolunteers((prev) =>
        prev.map((v) => (v.id === id ? { ...v, status: "rejected" } : v))
      );
      if (selectedVol?.id === id) setSelectedVol((p: any) => p ? { ...p, status: "rejected" } : null);
      fetchFosterVolunteers();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to reject volunteer.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived counts
  const activeHomesCount =
    dashboardData?.active_homes ??
    dashboardData?.activeHomes ??
    profiles.filter((p) => p.is_available || String(p.status).toLowerCase() === "active").length;

  const petsInCareCount =
    dashboardData?.pets_in_care ??
    dashboardData?.petsInCare ??
    profiles.reduce((sum, p) => sum + Number(p.active_count || 0), 0);

  const pendingRequestsCount =
    dashboardData?.pending_requests ??
    dashboardData?.pendingRequests ??
    profiles.filter((p) => String(p.status).toLowerCase() === "pending" || String(p.status).toLowerCase() === "applied").length;

  const availableCapacityCount =
    dashboardData?.available_capacity ??
    dashboardData?.availableCapacity ??
    profiles.reduce((sum, p) => sum + Math.max(0, (Number(p.max_capacity) || 1) - (Number(p.active_count) || 0)), 0);

  const pendingFosterVols = fosterVolunteers.filter((v) => isPending(v.status));
  const approvedFosterVols = fosterVolunteers.filter((v) => isApproved(v.status));

  const stats = [
    { title: "Active Foster Homes", value: loading ? "..." : String(activeHomesCount), trend: "Available Homes", color: "#1E3A8A", icon: <FaHome />, onClick: () => navigate("/fosters") },
    { title: "Pets in Foster Care", value: loading ? "..." : String(petsInCareCount), trend: "Active Placements", color: "#16A34A", icon: <FaPaw />, onClick: () => navigate("/pets") },
    { title: "Pending Foster Applications", value: loading ? "..." : String(pendingRequestsCount), trend: "Requires Review", color: "#F59E0B", icon: <FaUserPlus />, onClick: () => navigate("/fosters") },
    { title: "Total Care Capacity", value: loading ? "..." : String(availableCapacityCount), trend: "Available Slots", color: "#1E3A8A", icon: <FaCalendarCheck />, onClick: () => navigate("/fosters") },
    { title: "Foster Volunteers", value: volLoading ? "..." : String(fosterVolunteers.length), trend: `${approvedFosterVols.length} Approved`, color: "#1E3A8A", icon: <FaUsers /> },
  ];

  const placementColumns: Column<any>[] = [
    {
      key: "id",
      title: "Profile / Placement ID",
      render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748B" }}>{v ? String(v).slice(0, 10) : "-"}</span>,
    },
    {
      key: "foster_family",
      title: "Foster Parent / Family",
      render: (_: string, row: any) => {
        const user = row.user || {};
        const name = user.full_name || user.name || user.email || row.foster_name || row.family || row.id || "Foster Parent";
        return <div style={{ fontWeight: 700, color: "#0F172A" }}>{name}</div>;
      },
    },
    {
      key: "active_count",
      title: "Active Placements",
      render: (v: number) => <span style={{ fontWeight: 700, color: "#1E3A8A" }}>{v ?? 0} Pets</span>,
    },
    {
      key: "max_capacity",
      title: "Capacity",
      render: (v: number) => <span>{v ?? 1} Max</span>,
    },
    {
      key: "created_at",
      title: "Registered / Created",
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
              background: isAvail ? "#D1FAE5" : "#EFF6FF",
              color: isAvail ? "#15803D" : "#1E3A8A",
            }}
          >
            {statusStr}
          </span>
        );
      },
    },
  ];

  const volunteerColumns: Column<any>[] = [
    {
      key: "name",
      title: "Volunteer Name & Contact",
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>
            {row.user?.full_name || row.full_name || row.emergency_contact_name || "Volunteer"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            {row.user?.email || row.email || `ID: ${String(row.id || "").slice(0, 8)}`}
          </div>
        </div>
      ),
    },
    {
      key: "availability",
      title: "Availability",
      render: (v: string) => <span style={{ color: "#475569", fontSize: "13px" }}>{v || "Flexible"}</span>,
    },
    {
      key: "skills",
      title: "Skills / Experience",
      render: (_: string, row: any) => (
        <span style={{ color: "#475569", fontSize: "12px" }}>
          {row.skills || row.animal_handling_experience || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "Applied",
      render: (v: string) => <span style={{ fontSize: "12px", color: "#64748B" }}>{v ? formatDateTime(v) : "—"}</span>,
    },
    {
      key: "status",
      title: "Status",
      render: (v: string) => <VolunteerStatusBadge status={v} />,
    },
    {
      key: "actions",
      title: "Actions",
      render: (_: string, row: any) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedVol(row); setIsViewModalOpen(true); }}
          style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#0F172A", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <FaEye /> Review
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
          Onboard foster caregivers, place animals in temporary homes, and monitor care duration and return logs.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", color: "#B45309", fontSize: "13px", fontWeight: 600 }}>
          ℹ️ {error} — Fallback data loaded directly from active foster records.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaUserPlus />} title="Register Fosterer" subtitle="Onboard new caregiver" color="#1E3A8A" onClick={() => navigate("/fosters?action=apply")} />
        <QuickActionCard icon={<FaPaw />} title="Place Dog in Foster" subtitle="Match dog with family" color="#16A34A" onClick={() => navigate("/fosters?action=place")} />
        <QuickActionCard icon={<FaSync />} title="Refresh Roster" subtitle="Sync latest foster data" color="#1E3A8A" onClick={fetchDashboard} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Foster Placements Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Active Foster Caregivers &amp; Placements (Newest First)
          </h3>
          {loading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading foster data...</span>}
        </div>
        <DataTable
          columns={placementColumns}
          data={profiles}
          loading={loading}
          emptyMessage="No active foster profiles registered."
          onRowClick={(row: any) => {
            setSelectedFosterProfile(row);
            setIsFosterInspectModalOpen(true);
          }}
        />
      </div>

      {/* Foster Volunteer Applicants Table */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
            Foster Volunteer Applications ({pendingFosterVols.length} Pending Review)
          </h3>
          {volLoading && <span style={{ fontSize: "13px", color: "#1E3A8A", fontWeight: 600 }}>Loading volunteers...</span>}
        </div>
        <DataTable columns={volunteerColumns} data={fosterVolunteers} loading={volLoading} emptyMessage="No foster volunteer applications found." onRowClick={(row: any) => { setSelectedVol(row); setIsViewModalOpen(true); }} />
      </div>

      {/* Foster Profile & Placement Inspect Modal */}
      <Modal isOpen={isFosterInspectModalOpen} onClose={() => setIsFosterInspectModalOpen(false)} title="Foster Caregiver Profile & Placements">
        {selectedFosterProfile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontWeight: 800, fontSize: "18px", color: "#0F172A" }}>
                {selectedFosterProfile.user?.full_name || selectedFosterProfile.user?.name || selectedFosterProfile.foster_name || "Foster Family"}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                Email: {selectedFosterProfile.user?.email || "—"} &bull; Profile ID: <span style={{ fontFamily: "monospace" }}>{String(selectedFosterProfile.id || "").slice(0, 8)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Caregiver Status &amp; Availability</div>
                <div style={{ fontWeight: 700, color: selectedFosterProfile.is_available ? "#15803D" : "#1E3A8A", marginTop: "4px" }}>
                  {selectedFosterProfile.is_available ? "✓ Available for Placement" : "Busy / Max Capacity Reached"}
                </div>
              </div>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Capacity &amp; Placements</div>
                <div style={{ fontWeight: 700, color: "#1E3A8A", marginTop: "4px" }}>
                  {selectedFosterProfile.active_count ?? 0} Active Placements / {selectedFosterProfile.max_capacity ?? 1} Max Capacity
                </div>
              </div>
            </div>

            {selectedFosterProfile.preferences && (
              <div style={{ fontSize: "13px", color: "#334155", background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong>Preferences / Experience:</strong> {selectedFosterProfile.preferences}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsFosterInspectModalOpen(false);
                  navigate(`/fosters?action=place&profileId=${encodeURIComponent(selectedFosterProfile.id)}`);
                }}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaPaw /> Place Dog in Home
              </button>
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

      {/* Volunteer Application Review Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Foster Caregiver Application Review">
        {selectedVol && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Name:</strong> {selectedVol.user?.full_name || selectedVol.full_name || selectedVol.emergency_contact_name || "Volunteer"}</div>
              <div><strong>Email:</strong> {selectedVol.user?.email || selectedVol.email || "N/A"}</div>
              <div><strong>Phone:</strong> {selectedVol.user?.phone || selectedVol.phone || "N/A"}</div>
              <div><strong>Status:</strong> <VolunteerStatusBadge status={selectedVol.status} /></div>
              <div><strong>Availability:</strong> {selectedVol.availability || "Flexible"}</div>
              <div><strong>Experience:</strong> {selectedVol.animal_handling_experience || selectedVol.skills || "N/A"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              {isPending(selectedVol.status) && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleApprove(selectedVol)}
                    style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaCheckCircle /> Approve Application
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleReject(selectedVol)}
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
