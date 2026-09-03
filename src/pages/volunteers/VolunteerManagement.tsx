import { useState, useEffect, useCallback } from "react";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaClipboardList,
  FaPlus,
  FaUserCheck,
  FaClock,
  FaSignInAlt,
  FaSignOutAlt,
  FaAward,
  FaFilter,
  FaSync,
  FaEye,
  FaExclamationCircle,
  FaBan,
  FaFileAlt,
  FaHistory,
  FaPhoneAlt,
  FaEnvelope,
  FaCheckCircle,
} from "react-icons/fa";
import volunteerService from "../../services/volunteerService";
import shelterService from "../../services/shelterService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";

type TabKey = "applications" | "active" | "shifts";

const STATUS_OPTIONS = [
  { value: "", label: "All Application Statuses" },
  { value: "pending", label: "Pending (Action Required)" },
  { value: "applied", label: "Applied / Pending" },
  { value: "approved", label: "Approved / Active" },
  { value: "active", label: "Active Roster" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" },
];

const VolunteerManagement = () => {
  const isRescueCentreAdmin = getCurrentUserRole() === "rescue_centre_admin";
  const [activeTab, setActiveTab] = useState<TabKey>("applications");

  // Applications & Volunteer Profiles Roster State
  const [applications, setApplications] = useState<any[]>([]);
  const [volLoading, setVolLoading] = useState(true);
  const [volError, setVolError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appPage, setAppPage] = useState(1);

  useEffect(() => {
    setAppPage(1);
  }, [statusFilter, searchQuery]);

  // Shifts & Attendance State
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Facilities List
  const [facilities, setFacilities] = useState<any[]>([]);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const [selectedVolunteer, setSelectedVolunteer] = useState<any | null>(null);
  const [rejectTargetApp, setRejectTargetApp] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [serviceSummaryData, setServiceSummaryData] = useState<any | null>(null);

  const [attLoading, setAttLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();

  // Application Form
  const [applyForm, setApplyForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    preferred_role: "Foster Care",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    skills: "Dog Handling, Sanitation, Animal Rescue",
    availability: "Weekends & Morning Shifts",
    notes: "",
    medical_conditions: "None",
    animal_handling_experience: "2 years volunteer experience at local shelter",
    legal_consent: false,
  });

  // Shift Form
  const [shiftForm, setShiftForm] = useState({
    shelter_facility_id: "",
    role_name: "Dog Walking & Socialization",
    start_at: "",
    end_at: "",
    capacity: 5,
  });

  // Fetch Applications / Roster
  const fetchApplications = useCallback(async () => {
    try {
      setVolLoading(true);
      setVolError(null);
      const params: Record<string, unknown> = { page_size: 500 };
      if (statusFilter) params.status = statusFilter;

      let res: any;
      try {
        res = await volunteerService.getApplications(params);
      } catch {
        res = await volunteerService.getVolunteers(params);
      }

      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : [];

      const sorted = [...list].sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.submitted_at || a.applied_at || a.date || 0).getTime();
        const timeB = new Date(b.created_at || b.submitted_at || b.applied_at || b.date || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setApplications(sorted);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load volunteer applications.";
      setVolError(`[HTTP ${status || "Error"}] ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    } finally {
      setVolLoading(false);
    }
  }, [statusFilter]);

  // Fetch Shifts
  const fetchShifts = useCallback(async () => {
    try {
      setShiftLoading(true);
      setShiftError(null);
      const response = await volunteerService.getShifts({ page_size: 500 });
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.items)
        ? response.items
        : [];
      const sortedShifts = [...list].sort((a: any, b: any) => {
        const timeA = new Date(a.start_at || a.created_at || a.date || 0).getTime();
        const timeB = new Date(b.start_at || b.created_at || b.date || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
      setShifts(sortedShifts);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to load scheduled shifts.";
      setShiftError(`[HTTP ${status || "Error"}] ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  // Fetch Facilities
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await shelterService.getShelters();
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setFacilities(list);
    } catch {
      // Quiet fail if shelter facilities cannot be loaded
    }
  }, []);

  useEffect(() => {
    void fetchApplications();
    void fetchShifts();
    void fetchFacilities();
  }, [fetchApplications, fetchShifts, fetchFacilities]);

  // Submit Application
  const handleApplyVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.emergency_contact_name || !applyForm.emergency_contact_phone) {
      addToast("Emergency contact name and phone are required.", "error");
      return;
    }
    if (!applyForm.legal_consent) {
      addToast("You must review and accept the Volunteer Legal Agreement and Liability Release before applying.", "error");
      return;
    }

    const duplicate = applications.find((app) => {
      const em = String(app.user?.email || app.email || "").toLowerCase();
      const st = String(app.status || "").toLowerCase();
      return applyForm.email && em === applyForm.email.toLowerCase() && ["applied", "pending"].includes(st);
    });
    if (duplicate) {
      addToast(`A pending volunteer application already exists for ${applyForm.email}.`, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await volunteerService.applyVolunteer(applyForm);
      addToast("Volunteer application registered successfully!", "success");
      setIsApplyModalOpen(false);
      fetchApplications();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to register application.";
      addToast(`[HTTP ${err?.response?.status || 422}] ${errorMsg}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Shift Schedule
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.role_name || !shiftForm.start_at || !shiftForm.end_at) {
      addToast("Role name, start time, and end time are required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await volunteerService.createShift({
        shelter_facility_id: shiftForm.shelter_facility_id || null,
        role_name: shiftForm.role_name,
        start_at: new Date(shiftForm.start_at).toISOString(),
        end_at: new Date(shiftForm.end_at).toISOString(),
        capacity: Number(shiftForm.capacity || 5),
      });
      addToast("Volunteer shift schedule created successfully!", "success");
      setIsShiftModalOpen(false);
      fetchShifts();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to create shift schedule.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // APPROVE Application: POST /api/v1/volunteers/applications/{id}/approve
  const handleApproveApplication = async (appRow: any) => {
    const appId = appRow?.id || appRow?.application_id || appRow?.profile_id;
    if (!appId) {
      addToast("Invalid application ID.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      let result: any;
      try {
        // Standard backend endpoint: POST /api/v1/volunteers/applications/{id}/approve
        result = await volunteerService.approveApplication(appId);
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          result = await volunteerService.updateVolunteerProfile(appId, { status: "active" });
        } else {
          throw err;
        }
      }

      const updated = result?.volunteer_profile || result?.profile || result?.data || result || {};
      addToast(`Application #${String(appId).slice(0, 8)} approved! Volunteer profile active.`, "success");

      setApplications((prev) =>
        prev.map((app) => {
          const curId = app?.id || app?.application_id || app?.profile_id;
          if (curId === appId) {
            return { ...app, ...updated, status: "approved" };
          }
          return app;
        })
      );

      if (selectedVolunteer && (selectedVolunteer.id || selectedVolunteer.profile_id) === appId) {
        setSelectedVolunteer((prev: any) => (prev ? { ...prev, ...updated, status: "approved" } : null));
      }

      fetchApplications();
      fetchShifts();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to approve application.";
      addToast(`[HTTP ${err?.response?.status || 500}] ${errorMsg}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // REJECT Application Modal Trigger
  const handleOpenRejectModal = (appRow: any) => {
    setRejectTargetApp(appRow);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  // REJECT Application Submit: POST /api/v1/volunteers/applications/{id}/reject
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetApp) return;

    const appId = rejectTargetApp.id || rejectTargetApp.application_id || rejectTargetApp.profile_id;
    if (!appId) {
      addToast("Invalid application ID.", "error");
      return;
    }

    if (!rejectionReason.trim()) {
      addToast("Rejection reason is required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      let result: any;
      try {
        // Standard backend endpoint: POST /api/v1/volunteers/applications/{id}/reject
        result = await volunteerService.rejectApplication(appId, rejectionReason.trim());
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.response?.status === 405) {
          result = await volunteerService.updateVolunteerProfile(appId, {
            status: "inactive",
            notes: `Rejected: ${rejectionReason.trim()}`,
          });
        } else {
          throw err;
        }
      }

      addToast(`Application #${String(appId).slice(0, 8)} rejected. Reason recorded.`, "info");
      setIsRejectModalOpen(false);
      setRejectTargetApp(null);
      setRejectionReason("");

      setApplications((prev) =>
        prev.map((app) => {
          const curId = app?.id || app?.application_id || app?.profile_id;
          if (curId === appId) {
            return {
              ...app,
              status: "rejected",
              rejection_reason: rejectionReason.trim(),
              ...result,
            };
          }
          return app;
        })
      );

      if (selectedVolunteer && (selectedVolunteer.id || selectedVolunteer.profile_id) === appId) {
        setSelectedVolunteer((prev: any) =>
          prev ? { ...prev, status: "rejected", rejection_reason: rejectionReason.trim(), ...result } : null
        );
      }

      fetchApplications();
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to reject application.";
      addToast(`[HTTP ${err?.response?.status || 500}] ${errorMsg}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join or Assign Active Volunteer to Shift
  const handleJoinShift = async (shiftId: string, volunteerId?: string) => {
    try {
      const targetShift = shifts.find((s) => String(s.id) === String(shiftId));
      if (targetShift) {
        const enrolled = Number(targetShift.enrolled_count ?? targetShift.attendance_count ?? 0);
        const cap = Number(targetShift.capacity ?? 5);
        if (enrolled >= cap) {
          addToast(`Cannot assign volunteer: Shift capacity is full (${enrolled}/${cap} enrolled).`, "error");
          return;
        }
      }

      const activeVols = applications.filter((v) =>
        ["active", "approved", "onboarded"].includes(String(v.status || "").toLowerCase())
      );
      const targetVol = applications.find(
        (v) => String(v.id || v.application_id || v.profile_id) === String(volunteerId)
      );

      if (volunteerId && targetVol) {
        const st = String(targetVol.status || "").toLowerCase();
        if (!["active", "approved", "onboarded"].includes(st)) {
          addToast(`Cannot assign volunteer: Status is '${st}'. Only approved/active volunteers may be assigned.`, "error");
          return;
        }
      }

      const targetVolId = volunteerId || activeVols[0]?.id || activeVols[0]?.profile_id;

      if (!targetVolId) {
        addToast("No active or approved volunteers available to assign to shift.", "error");
        return;
      }

      await volunteerService.joinShift(shiftId, targetVolId);
      addToast("Volunteer assigned to shift successfully!", "success");
      fetchShifts();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to assign volunteer to shift.", "error");
    }
  };

  // Shift Attendance Roster
  const handleOpenAttendance = async (shift: any) => {
    setSelectedShift(shift);
    setIsAttendanceModalOpen(true);
    try {
      setAttLoading(true);
      const res = await volunteerService.getShiftAttendance(shift.id);
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setAttendanceList(list);
    } catch {
      setAttendanceList([]);
    } finally {
      setAttLoading(false);
    }
  };

  // Attendance Check-In
  const handleCheckIn = async (attendanceId: string) => {
    try {
      await volunteerService.checkInAttendance(attendanceId);
      addToast("Volunteer checked in to duty!", "success");
      if (selectedShift?.id) void handleOpenAttendance(selectedShift);
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Check-in failed.", "error");
    }
  };

  // Attendance Check-Out
  const handleCheckOut = async (attendanceId: string) => {
    try {
      await volunteerService.checkOutAttendance(attendanceId, "Duty shift completed");
      addToast("Volunteer checked out & hours logged!", "success");
      if (selectedShift?.id) void handleOpenAttendance(selectedShift);
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Check-out failed.", "error");
    }
  };

  // Service Summary View
  const handleOpenServiceSummary = async (profileId: string) => {
    if (!profileId) {
      addToast("Invalid volunteer profile ID.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await volunteerService.getServiceSummary(profileId);
      setServiceSummaryData(res?.data || res || {});
      setIsSummaryModalOpen(true);
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to load volunteer service summary.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Issue Verified Service Certificate
  const handleIssueCertificate = async (profileId: string) => {
    if (!profileId) {
      addToast("Invalid volunteer profile ID.", "error");
      return;
    }
    try {
      addToast("Generating verified volunteer service certificate...", "info");
      const cert = await volunteerService.getCertificate(profileId);

      const certUrl =
        cert?.certificate_url ||
        cert?.download_url ||
        cert?.url ||
        cert?.pdf_url ||
        cert?.data?.certificate_url ||
        cert?.data?.download_url ||
        cert?.data?.url;

      if (certUrl) {
        window.open(certUrl, "_blank");
        addToast("Service Certificate opened in a new tab.", "success");
        return;
      }

      const htmlContent = cert?.certificate_html || cert?.html || cert?.content;
      const base64Pdf = cert?.pdf_base64 || cert?.base64;

      if (base64Pdf) {
        const blob = new Blob([Uint8Array.from(atob(base64Pdf), (c) => c.charCodeAt(0))], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        addToast("Service Certificate generated & opened!", "success");
        return;
      }

      if (htmlContent) {
        const blob = new Blob([htmlContent], { type: "text/html" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        addToast("Service Certificate opened successfully.", "success");
        return;
      }

      if (cert instanceof Blob) {
        const blobUrl = URL.createObjectURL(cert);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `volunteer_certificate_${String(profileId).slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addToast("Service Certificate downloaded successfully!", "success");
        return;
      }

      addToast("Volunteer Service Certificate generated!", "success");
    } catch (err: any) {
      const errorMsg =
        typeof err?.response?.data?.detail === "string"
          ? err.response.data.detail
          : Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ")
          : err?.response?.data?.message || err?.message || "Failed to issue certificate.";
      addToast(errorMsg, "error");
    }
  };

  // Helper status check
  const isPendingStatus = (st?: string) => {
    const s = String(st || "").toLowerCase().trim();
    return s === "submitted" || s === "pending" || s === "applied";
  };

  const isApprovedStatus = (st?: string) => {
    const s = String(st || "").toLowerCase().trim();
    return s === "approved" || s === "active" || s === "onboarded";
  };

  const isRejectedStatus = (st?: string) => {
    const s = String(st || "").toLowerCase().trim();
    return s === "rejected";
  };

  // Filtered Roster & Applications
  const filteredApplications = applications.filter((app) => {
    if (activeTab === "active" && !isApprovedStatus(app.status)) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = String(app.full_name || app.applicant_name || app.user?.full_name || app.emergency_contact_name || "").toLowerCase();
      const email = String(app.email || app.user?.email || "").toLowerCase();
      const role = String(app.preferred_role || app.applied_role || app.role_name || "").toLowerCase();
      const skills = String(app.skills || "").toLowerCase();
      const appId = String(app.id || app.application_id || app.profile_id || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !role.includes(q) && !skills.includes(q) && !appId.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pendingApps = applications.filter((a) => isPendingStatus(a.status));
  const activeVolunteersList = applications.filter((a) => isApprovedStatus(a.status));

  // Dashboard Stats (No fake data - derived directly from backend responses)
  const stats = [
    {
      title: "Total Applications",
      value: String(applications.length),
      trend: "Received Roster",
      color: "#2563EB",
      icon: <FaFileAlt />,
    },
    {
      title: "Pending Review",
      value: String(pendingApps.length),
      trend: pendingApps.length > 0 ? "Action Required" : "All Clear",
      color: pendingApps.length > 0 ? "#DC2626" : "#10B981",
      icon: <FaExclamationCircle />,
    },
    {
      title: "Active Volunteers",
      value: String(activeVolunteersList.length),
      trend: "Duty Ready",
      color: "#10B981",
      icon: <FaUserCheck />,
    },
    {
      title: "Scheduled Shifts",
      value: String(shifts.length),
      trend: "Shelter Operations",
      color: "#6366F1",
      icon: <FaClipboardList />,
    },
  ];

  // Applications Table Columns
  const appColumns = [
    {
      key: "applicant_info",
      title: "Applicant Name & Contact",
      render: (_: string, row: any) => {
        const name = row.full_name || row.applicant_name || row.user?.full_name || row.emergency_contact_name || "Applicant Profile";
        const email = row.email || row.user?.email || "N/A";
        const phone = row.phone || row.emergency_contact_phone || row.user?.phone || "N/A";
        const appId = row.id || row.application_id || row.profile_id;
        const isPending = isPendingStatus(row.status);

        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <strong style={{ color: "#0F172A", fontSize: "14px" }}>{name}</strong>
              {isPending && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "#FEF2F2",
                    color: "#DC2626",
                    border: "1px solid #FCA5A5",
                    textTransform: "uppercase",
                  }}
                >
                  Action Required
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#64748B", display: "flex", gap: "10px", marginTop: "3px" }}>
              <span><FaEnvelope size={10} style={{ marginRight: "3px" }} />{email}</span>
              <span><FaPhoneAlt size={10} style={{ marginRight: "3px" }} />{phone}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
              ID: <code style={{ fontSize: "11px" }}>{String(appId).slice(0, 8)}</code>
            </div>
          </div>
        );
      },
    },
    {
      key: "preferred_role",
      title: "Role & Skills",
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#2563EB" }}>
            {row.preferred_role || row.applied_role || row.role_name || "General Volunteer"}
          </div>
          <div style={{ fontSize: "12px", color: "#334155" }}>
            <strong>Skills:</strong> {row.skills || "Not specified"}
          </div>
          {row.animal_handling_experience && (
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
              Exp: {row.animal_handling_experience}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "availability",
      title: "Availability & Emergency",
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#0F172A" }}>
            {row.availability || "Flexible"}
          </div>
          <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
            Emergency: {row.emergency_contact_name || "N/A"} ({row.emergency_contact_phone || "N/A"})
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "Current Status",
      render: (v: string, row: any) => {
        const isPending = isPendingStatus(v);
        const isApproved = isApprovedStatus(v);
        const isRejected = isRejectedStatus(v);

        let bg = "#F1F5F9";
        let color = "#475569";
        let label = String(v || "PENDING").toUpperCase();

        if (isApproved) {
          bg = "#D1FAE5";
          color = "#047857";
          label = "APPROVED / ACTIVE";
        } else if (isPending) {
          bg = "#FEF3C7";
          color = "#B45309";
          label = "PENDING REVIEW";
        } else if (isRejected) {
          bg = "#FEE2E2";
          color = "#B91C1C";
          label = "REJECTED";
        }

        return (
          <div>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                padding: "4px 8px",
                borderRadius: "999px",
                background: bg,
                color,
                display: "inline-block",
              }}
            >
              {label}
            </span>
            {isRejected && (row.rejection_reason || row.reason) && (
              <div style={{ fontSize: "11px", color: "#991B1B", marginTop: "4px", fontStyle: "italic" }}>
                Reason: {row.rejection_reason || row.reason}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "created_at",
      title: "Submitted Date",
      render: (v: string, row: any) => formatDateTime(v || row.submitted_at || row.applied_at || row.date),
    },
    {
      key: "actions",
      title: "Admin Decision Actions",
      render: (_: string, row: any) => {
        const isPending = isPendingStatus(row.status);
        const isApproved = isApprovedStatus(row.status);
        const isRejected = isRejectedStatus(row.status);

        return (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => {
                setSelectedVolunteer(row);
                setIsProfileModalOpen(true);
              }}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#2563EB",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaEye /> View Details
            </button>

            {/* Approve Action: POST /api/v1/volunteers/applications/{id}/approve */}
            {isPending && (
              <button
                onClick={() => void handleApproveApplication(row)}
                disabled={isSubmitting}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#10B981",
                  color: "#FFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaCheckCircle /> Approve
              </button>
            )}

            {/* Reject Action: POST /api/v1/volunteers/applications/{id}/reject */}
            {isPending && (
              <button
                onClick={() => handleOpenRejectModal(row)}
                disabled={isSubmitting}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#EF4444",
                  color: "#FFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaBan /> Reject
              </button>
            )}

            {isApproved && (
              <button
                onClick={() => void handleIssueCertificate(row.id || row.profile_id)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#6366F1",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaAward /> Certificate
              </button>
            )}

            {isRejected && (
              <span style={{ fontSize: "11px", color: "#94A3B8", fontStyle: "italic" }}>Decision Finalized</span>
            )}
          </div>
        );
      },
    },
  ];

  // Active Volunteers Roster Columns
  const activeVolColumns = [
    {
      key: "volunteer_name",
      title: "Volunteer Name & Contact",
      render: (_: string, row: any) => {
        const name = row.full_name || row.applicant_name || row.user?.full_name || row.emergency_contact_name || "Active Volunteer";
        const email = row.email || row.user?.email || "N/A";
        const phone = row.phone || row.emergency_contact_phone || row.user?.phone || "N/A";

        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>{name}</div>
            <div style={{ fontSize: "12px", color: "#64748B" }}>
              {email} &bull; {phone}
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      title: "Assigned Role & Skills",
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#16A34A" }}>
            {row.preferred_role || row.applied_role || row.role_name || "General Volunteer"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>{row.skills || "General Support"}</div>
        </div>
      ),
    },
    {
      key: "hours_and_shifts",
      title: "Verified Hours & Shifts",
      render: (_: string, row: any) => {
        const hours = row.volunteer_hours || row.hours_served || row.total_hours || 0;
        const shiftsCount = row.completed_shifts || row.shifts_completed || 0;

        return (
          <div>
            <div style={{ fontWeight: 700, color: "#2563EB", fontSize: "13px" }}>
              {hours} Hours Served
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>
              {shiftsCount} Completed Shifts
            </div>
          </div>
        );
      },
    },
    {
      key: "emergency_contact",
      title: "Emergency Contact",
      render: (_: string, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155", fontSize: "12px" }}>
            {row.emergency_contact_name || "N/A"}
          </div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>{row.emergency_contact_phone || "N/A"}</div>
        </div>
      ),
    },
    {
      key: "recent_activity",
      title: "Recent Activity",
      render: (_: string, row: any) =>
        formatDateTime(row.last_active_at || row.updated_at || row.created_at || row.date),
    },
    {
      key: "actions",
      title: "Actions & Certificate",
      render: (_: string, row: any) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => void handleOpenServiceSummary(row.id || row.profile_id)}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#2563EB",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaHistory /> Summary
          </button>

          <button
            onClick={() => void handleIssueCertificate(row.id || row.profile_id)}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#FFF",
              color: "#6366F1",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaAward /> Certificate
          </button>
        </div>
      ),
    },
  ];

  // Shift Columns
  const shiftColumns = [
    {
      key: "role_name",
      title: "Shift Role / Task",
      render: (v: string, row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{v || row.title || "Shelter Assistance"}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            Facility: {row.facility_name || row.shelter_name || row.facility?.name || (row.shelter_facility_id ? `Facility (${String(row.shelter_facility_id).slice(0, 8)})` : "Central Shelter")}
          </div>
        </div>
      ),
    },
    {
      key: "start_at",
      title: "Start Time",
      render: (v: string) => formatDateTime(v),
    },
    {
      key: "end_at",
      title: "End Time",
      render: (v: string) => formatDateTime(v),
    },
    {
      key: "capacity",
      title: "Capacity Limit",
      render: (v: number) => <strong style={{ color: "#2563EB" }}>{v ?? 5} Volunteers</strong>,
    },
    {
      key: "actions",
      title: "Shift Actions",
      render: (_: string, row: any) => (
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => void handleJoinShift(row.id)}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "none",
              background: "#10B981",
              color: "#FFF",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Assign Volunteer
          </button>
          <button
            onClick={() => void handleOpenAttendance(row)}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#2563EB",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaClock /> Attendance Check-In
          </button>
        </div>
      ),
    },
  ];

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#DC2626", fontWeight: 800 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: "600px", margin: "12px auto" }}>
          Volunteer Management is reserved for Volunteer Coordinators, Shelter Managers, and Super Administrators. Rescue Centre Admin access is restricted to centre rescue operations, dispatch, vehicle fleet, and dog master management.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto", boxSizing: "border-box" }}>
      {/* Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Volunteer Lifecycle &amp; Roster Management</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Admin review, approval/rejection workflows, active volunteer management, shift scheduling, and verified attendance tracking.
        </p>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="create_volunteers">
          <button
            onClick={() => setIsApplyModalOpen(true)}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #BFDBFE",
              background: "#EFF6FF",
              color: "#1D4ED8",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <FaPlus size={18} color="#2563EB" />
            <div>
              <div>Submit New Application</div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "#3B82F6" }}>Register applicant profile</div>
            </div>
          </button>
        </Can>

        <Can permission="create_volunteers">
          <button
            onClick={() => setIsShiftModalOpen(true)}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #A7F3D0",
              background: "#ECFDF5",
              color: "#047857",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textAlign: "left",
            }}
          >
            <FaClipboardList size={18} color="#10B981" />
            <div>
              <div>Create Volunteer Shift</div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "#059669" }}>Schedule shift &amp; capacity</div>
            </div>
          </button>
        </Can>
      </div>

      {/* Real Summary Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Main Feature Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid #E2E8F0", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("applications")}
          style={{
            padding: "10px 22px",
            borderRadius: "10px 10px 0 0",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 700,
            background: activeTab === "applications" ? "#0F172A" : "transparent",
            color: activeTab === "applications" ? "#FFFFFF" : "#64748B",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FaFileAlt /> Volunteer Applications {pendingApps.length > 0 && <span style={{ background: "#EF4444", color: "#FFF", fontSize: "11px", borderRadius: "999px", padding: "1px 6px" }}>{pendingApps.length}</span>}
        </button>

        <button
          onClick={() => setActiveTab("active")}
          style={{
            padding: "10px 22px",
            borderRadius: "10px 10px 0 0",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 700,
            background: activeTab === "active" ? "#0F172A" : "transparent",
            color: activeTab === "active" ? "#FFFFFF" : "#64748B",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FaUserCheck /> Active Volunteers ({activeVolunteersList.length})
        </button>

        <button
          onClick={() => setActiveTab("shifts")}
          style={{
            padding: "10px 22px",
            borderRadius: "10px 10px 0 0",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 700,
            background: activeTab === "shifts" ? "#0F172A" : "transparent",
            color: activeTab === "shifts" ? "#FFFFFF" : "#64748B",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FaClipboardList /> Shift Scheduling &amp; Attendance
        </button>
      </div>

      {/* APPLICATIONS TAB */}
      {activeTab === "applications" && (
        <div className="soft-card" style={{ padding: "20px", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                Submitted Volunteer Applications
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Review submitted applications. Admin action required for pending submissions.
              </p>
            </div>
          </div>
          {volError && (
            <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
              ⚠️ {volError}
            </div>
          )}

          {volLoading ? (
            <p style={{ color: "#64748B", padding: "20px 0" }}>Loading volunteer applications from backend...</p>
          ) : (
            <DataTable
              columns={appColumns}
              data={filteredApplications.slice((appPage - 1) * 5, appPage * 5)}
              module="volunteers"
              serverMode={true}
              totalCount={filteredApplications.length}
              page={appPage}
              pageSize={5}
              onPageChange={setAppPage}
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              onRowClick={(row: any) => {
                setSelectedVolunteer(row);
                setIsProfileModalOpen(true);
              }}
              leftHeaderControls={
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaFilter size={12} color="#64748B" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => void fetchApplications()}
                    disabled={volLoading}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaSync style={{ animation: volLoading ? "spin 1s linear infinite" : "none" }} /> Refresh
                  </button>
                </>
              }
            />
          )}
        </div>
      )}

      {/* ACTIVE VOLUNTEERS TAB */}
      {activeTab === "active" && (
        <div className="soft-card" style={{ padding: "20px", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                Active Volunteer Roster
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Approved volunteers available for shelter assignments, shift scheduling, and verified hours.
              </p>
            </div>

            <button
              onClick={() => void fetchApplications()}
              disabled={volLoading}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FaSync style={{ animation: volLoading ? "spin 1s linear infinite" : "none" }} /> Refresh Active Roster
            </button>
          </div>

          {volLoading ? (
            <p style={{ color: "#64748B", padding: "20px 0" }}>Loading active volunteers roster...</p>
          ) : (
            <DataTable columns={activeVolColumns} data={activeVolunteersList} module="volunteers" onRowClick={(row: any) => void handleOpenServiceSummary(row.id || row.profile_id)} />
          )}
        </div>
      )}

      {/* SHIFTS TAB */}
      {activeTab === "shifts" && (
        <div className="soft-card" style={{ padding: "20px", overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                Scheduled Shifts &amp; Attendance Tracking
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Manage shelter shifts, assign active volunteers, track attendance check-in &amp; check-out.
              </p>
            </div>

            <button
              onClick={() => void fetchShifts()}
              disabled={shiftLoading}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FaSync style={{ animation: shiftLoading ? "spin 1s linear infinite" : "none" }} /> Refresh Shifts
            </button>
          </div>

          {shiftError && (
            <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
              ⚠️ {shiftError}
            </div>
          )}

          {shiftLoading ? (
            <p style={{ color: "#64748B", padding: "20px 0" }}>Loading scheduled shifts from backend...</p>
          ) : (
            <DataTable columns={shiftColumns} data={shifts} module="volunteers" onRowClick={(row: any) => void handleOpenAttendance(row)} />
          )}
        </div>
      )}

      {/* Submit Application Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Register Volunteer Application">
        <form onSubmit={handleApplyVolunteer} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Full Name</label>
              <input type="text" placeholder="e.g. John Doe" value={applyForm.full_name} onChange={(e) => setApplyForm({ ...applyForm, full_name: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Preferred Role</label>
              <select value={applyForm.preferred_role} onChange={(e) => setApplyForm({ ...applyForm, preferred_role: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>
                <option value="Foster Care">Foster Care</option>
                <option value="Transport">Transport</option>
                <option value="Events & Outreach">Events &amp; Outreach</option>
                <option value="Shelter Support">Shelter Support</option>
                <option value="Dog Walking & Socialization">Dog Walking &amp; Socialization</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Emergency Contact Name *</label>
              <input type="text" required placeholder="e.g. Jane Doe" value={applyForm.emergency_contact_name} onChange={(e) => setApplyForm({ ...applyForm, emergency_contact_name: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Emergency Contact Phone *</label>
              <input type="text" required placeholder="e.g. +91-9876543210" value={applyForm.emergency_contact_phone} onChange={(e) => setApplyForm({ ...applyForm, emergency_contact_phone: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Skills &amp; Specialties</label>
              <input type="text" placeholder="e.g. Grooming, Dog Walking" value={applyForm.skills} onChange={(e) => setApplyForm({ ...applyForm, skills: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Availability</label>
              <input type="text" placeholder="e.g. Weekends, Morning Shift" value={applyForm.availability} onChange={(e) => setApplyForm({ ...applyForm, availability: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Animal Handling Experience</label>
            <input type="text" placeholder="e.g. 2 years experience with large dogs" value={applyForm.animal_handling_experience} onChange={(e) => setApplyForm({ ...applyForm, animal_handling_experience: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Message</label>
            <textarea rows={2} placeholder="Any notes or message" value={applyForm.notes} onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", resize: "vertical" }} />
          </div>

          <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#334155", cursor: "pointer" }}>
              <input
                type="checkbox"
                required
                checked={applyForm.legal_consent}
                onChange={(e) => setApplyForm({ ...applyForm, legal_consent: e.target.checked })}
                style={{ marginTop: "3px" }}
              />
              <span>
                <strong>Volunteer Legal Agreement &amp; Liability Release *</strong>
                <br />
                <span style={{ fontSize: "11px", color: "#64748B" }}>
                  I confirm that I am applying in good faith, meet physical requirement standards for animal care, agree to PawGuard Code of Conduct, and accept liability waiver conditions.
                </span>
              </span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsApplyModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Submitting..." : "Submit Application"}</button>
          </div>
        </form>
      </Modal>

      {/* Create Shift Modal */}
      <Modal isOpen={isShiftModalOpen} onClose={() => setIsShiftModalOpen(false)} title="Create Volunteer Shift Schedule">
        <form onSubmit={handleCreateShift} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Role / Activity Name *</label>
            <input type="text" required placeholder="e.g. Dog Walking & Socialization" value={shiftForm.role_name} onChange={(e) => setShiftForm({ ...shiftForm, role_name: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
          </div>

          {facilities.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Shelter Facility</label>
              <select value={shiftForm.shelter_facility_id} onChange={(e) => setShiftForm({ ...shiftForm, shelter_facility_id: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>
                <option value="">Central Shelter Facility</option>
                {facilities.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Start Date &amp; Time *</label>
              <input type="datetime-local" required value={shiftForm.start_at} onChange={(e) => setShiftForm({ ...shiftForm, start_at: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>End Date &amp; Time *</label>
              <input type="datetime-local" required value={shiftForm.end_at} onChange={(e) => setShiftForm({ ...shiftForm, end_at: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Volunteer Capacity Limit *</label>
            <input type="number" min="1" required value={shiftForm.capacity} onChange={(e) => setShiftForm({ ...shiftForm, capacity: Number(e.target.value) })} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsShiftModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Creating..." : "Save Shift Schedule"}</button>
          </div>
        </form>
      </Modal>

      {/* REJECT Application Modal (Requires Admin Reason) */}
      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Volunteer Application">
        <form onSubmit={handleConfirmReject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#FEF2F2", padding: "14px", borderRadius: "10px", border: "1px solid #FCA5A5" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#991B1B", fontWeight: 700 }}>
              Confirm Rejection for {rejectTargetApp?.full_name || rejectTargetApp?.applicant_name || rejectTargetApp?.user?.full_name || "Applicant"}
            </h3>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#7F1D1D" }}>
              Please provide an explicit rejection reason for backend record and public web status transparency.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Position requirements not met / Insufficient availability for scheduled shelter shifts..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsRejectModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Volunteer Application / Profile Details Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Volunteer Application Record">
        {selectedVolunteer && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                {selectedVolunteer.full_name || selectedVolunteer.applicant_name || selectedVolunteer.user?.full_name || selectedVolunteer.emergency_contact_name || "Applicant Record"}
              </h2>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                Email: {selectedVolunteer.email || selectedVolunteer.user?.email || "N/A"} &bull; Phone: {selectedVolunteer.phone || selectedVolunteer.emergency_contact_phone || "N/A"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "6px" }}>
                Status: <strong style={{ textTransform: "uppercase", color: isApprovedStatus(selectedVolunteer.status) ? "#10B981" : isRejectedStatus(selectedVolunteer.status) ? "#EF4444" : "#F59E0B" }}>{selectedVolunteer.status || "PENDING"}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Application Details</div>
                <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                  Role: {selectedVolunteer.preferred_role || selectedVolunteer.applied_role || selectedVolunteer.role_name || "General"}
                </div>
                <div style={{ color: "#64748B" }}>ID: {selectedVolunteer.id || selectedVolunteer.application_id || selectedVolunteer.profile_id}</div>
                <div style={{ color: "#94A3B8", fontSize: "11px", marginTop: "2px" }}>
                  Submitted: {formatDateTime(selectedVolunteer.created_at || selectedVolunteer.submitted_at || selectedVolunteer.applied_at)}
                </div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Emergency Contact</div>
                <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedVolunteer.emergency_contact_name || "N/A"}</div>
                <div style={{ color: "#2563EB" }}>{selectedVolunteer.emergency_contact_phone || "N/A"}</div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Skills &amp; Availability</div>
                <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedVolunteer.skills || "Not specified"}</div>
                <div style={{ color: "#64748B" }}>{selectedVolunteer.availability || "Flexible"}</div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Animal Handling Experience</div>
                <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedVolunteer.animal_handling_experience || "None specified"}</div>
              </div>
            </div>

            {(selectedVolunteer.notes || selectedVolunteer.message) && (
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "13px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Notes / Message</div>
                <div style={{ color: "#334155", marginTop: "4px" }}>{selectedVolunteer.notes || selectedVolunteer.message}</div>
              </div>
            )}

            {isRejectedStatus(selectedVolunteer.status) && (selectedVolunteer.rejection_reason || selectedVolunteer.reason) && (
              <div style={{ background: "#FEF2F2", padding: "12px", borderRadius: "8px", border: "1px solid #FCA5A5", fontSize: "13px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", textTransform: "uppercase" }}>Rejection Reason</div>
                <div style={{ color: "#7F1D1D", marginTop: "4px" }}>{selectedVolunteer.rejection_reason || selectedVolunteer.reason}</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                {isPendingStatus(selectedVolunteer.status) && (
                  <button
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      void handleApproveApplication(selectedVolunteer);
                    }}
                    disabled={isSubmitting}
                    style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <FaCheckCircle /> Approve Application
                  </button>
                )}

                {isPendingStatus(selectedVolunteer.status) && (
                  <button
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      handleOpenRejectModal(selectedVolunteer);
                    }}
                    disabled={isSubmitting}
                    style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <FaBan /> Reject Application
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Service Summary Modal */}
      <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="Volunteer Service Summary">
        {serviceSummaryData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                Official Service Summary
              </h3>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                Total Verified Volunteer Hours: <strong style={{ color: "#2563EB" }}>{serviceSummaryData.total_hours || serviceSummaryData.hours_served || 0} Hours</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Completed Shifts</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                  {serviceSummaryData.completed_shifts || serviceSummaryData.shifts_completed || 0}
                </div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Status</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#10B981", marginTop: "2px", textTransform: "uppercase" }}>
                  {serviceSummaryData.status || "ACTIVE"}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Attendance & Check-In / Check-Out Modal */}
      <Modal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} title="Shift Attendance & Check-In Control" maxWidth="680px">
        {selectedShift && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "#0F172A" }}>{selectedShift.role_name || "Shift Activity"}</div>
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                Start: {formatDateTime(selectedShift.start_at)} &bull; End: {formatDateTime(selectedShift.end_at)}
              </div>
            </div>

            {attLoading ? (
              <p style={{ color: "#64748B" }}>Fetching attendance roster from backend...</p>
            ) : attendanceList.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", color: "#64748B" }}>
                No active volunteers currently enrolled for this shift.
              </div>
            ) : (
              <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {attendanceList.map((att: any) => (
                  <div key={att.id} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>Volunteer ID: {String(att.volunteer_id).slice(0, 8)}</div>
                      <div style={{ fontSize: "11px", color: "#64748B" }}>
                        Check-In: {att.check_in_at ? formatDateTime(att.check_in_at) : "Not Checked In"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {!att.check_in_at && (
                        <button
                          onClick={() => void handleCheckIn(att.id)}
                          style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#10B981", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaSignInAlt /> Check In
                        </button>
                      )}

                      {att.check_in_at && !att.check_out_at && (
                        <button
                          onClick={() => void handleCheckOut(att.id)}
                          style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <FaSignOutAlt /> Check Out
                        </button>
                      )}

                      {att.check_out_at && (
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#047857", background: "#D1FAE5", padding: "4px 8px", borderRadius: "999px" }}>
                          SHIFT COMPLETED ({att.hours_served || 0} hrs)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VolunteerManagement;
