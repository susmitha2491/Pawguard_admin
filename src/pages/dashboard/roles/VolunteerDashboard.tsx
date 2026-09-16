import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaClipboardList,
  FaClock,
  FaCalendarCheck,
  FaAward,
  FaSignInAlt,
  FaSignOutAlt,
  FaBell,
  FaSync,
  FaSearch,
  FaUserCheck,
  FaStar,
  FaEdit,
  FaTimesCircle,
  FaCommentDots,
  FaUser,
  FaPhoneAlt,
  FaEnvelope,
  FaShieldAlt,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaTachometerAlt,
} from "react-icons/fa";
import volunteerService, { getVolunteerProfileId } from "../../../services/volunteerService";
import { fetchSharedNotifications } from "../../../hooks/useNotifications";
import { getCurrentUser } from "../../../utils/roleUtils";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";
import { extractErrorMessage } from "../../../utils/errorUtils";

type TabKey = "overview" | "shifts" | "attendance" | "activities" | "feedback" | "profile" | "notifications";

const VolunteerDashboard: React.FC = () => {
  const { addToast } = useToast();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Tab Synchronization
  const rawTab = searchParams.get("tab")?.toLowerCase().trim();
  const activeTab: TabKey = useMemo(() => {
    if (rawTab === "shifts" || rawTab === "available_shifts") return "shifts";
    if (rawTab === "attendance" || rawTab === "my_shifts") return "attendance";
    if (rawTab === "activities" || rawTab === "summary") return "activities";
    if (rawTab === "feedback") return "feedback";
    if (rawTab === "profile") return "profile";
    if (rawTab === "notifications") return "notifications";
    return "overview";
  }, [rawTab]);

  const setActiveTab = (tab: TabKey) => {
    if (tab === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data states
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [serviceSummary, setServiceSummary] = useState<any>(null);
  const [myStatusInfo, setMyStatusInfo] = useState<any>(null);
  const [myApplication, setMyApplication] = useState<any>(null);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [shiftViewMode, setShiftViewMode] = useState<"available" | "claimed">("available");

  // Modals & form states
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any | null>(null);
  const [checkOutNotes, setCheckOutNotes] = useState<string>("Shift tasks completed");

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [attendanceToCancel, setAttendanceToCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComments, setFeedbackComments] = useState<string>("");

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    emergency_contact_name: "",
    emergency_contact_phone: "",
    skills: "",
    availability: "",
    animal_handling_experience: "",
    medical_conditions: "",
    notes: "",
  });

  const fetchVolunteerPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [shiftRes, attRes, notifRes, statusRes, appRes, feedbackRes, dashRes] =
        await Promise.allSettled([
          volunteerService.getShifts(),
          volunteerService.getMyAttendance().catch(() => []),
          fetchSharedNotifications().catch(() => []),
          volunteerService.getMyStatus().catch(() => null),
          volunteerService.getMyApplication().catch(() => null),
          volunteerService.getMyFeedback().catch(() => []),
          volunteerService.getVolunteerDashboard().catch(() => null),
        ]);

      const rawShifts =
        shiftRes.status === "fulfilled"
          ? Array.isArray(shiftRes.value)
            ? shiftRes.value
            : (shiftRes.value as any)?.data || (shiftRes.value as any)?.items || []
          : [];

      let rawAttendance =
        attRes.status === "fulfilled"
          ? Array.isArray(attRes.value)
            ? attRes.value
            : (attRes.value as any)?.data || (attRes.value as any)?.items || []
          : [];

      // Fallback: if getMyAttendance returned empty array, hydrate shift attendance
      if (rawAttendance.length === 0 && rawShifts.length > 0) {
        try {
          const sampleShifts = rawShifts.slice(0, 10);
          const attPromises = sampleShifts.map((s: any) =>
            volunteerService.getShiftAttendance(s.id).catch(() => [])
          );
          const attSettled = await Promise.allSettled(attPromises);
          const collected: any[] = [];
          attSettled.forEach((res, idx) => {
            if (res.status === "fulfilled") {
              const val = res.value;
              const items = Array.isArray(val) ? val : (val as any)?.data || [];
              items.forEach((item: any) => {
                collected.push({ ...item, shift: sampleShifts[idx] });
              });
            }
          });
          if (collected.length > 0) {
            rawAttendance = collected;
          }
        } catch {
          // Ignore fallback errors
        }
      }

      const rawNotifs =
        notifRes.status === "fulfilled"
          ? Array.isArray(notifRes.value)
            ? notifRes.value
            : (notifRes.value as any)?.data || []
          : [];

      const statusObj =
        statusRes.status === "fulfilled" ? statusRes.value?.data || statusRes.value : null;

      const appObj = appRes.status === "fulfilled" ? appRes.value?.data || appRes.value : null;

      const dashObj =
        dashRes.status === "fulfilled" ? dashRes.value?.data || dashRes.value : null;

      const rawFeedbacks =
        feedbackRes.status === "fulfilled"
          ? Array.isArray(feedbackRes.value)
            ? feedbackRes.value
            : (feedbackRes.value as any)?.data || (feedbackRes.value as any)?.items || []
          : [];

      // Resolve canonical volunteer profile ID
      const canonicalProfileId =
        statusObj?.profile?.id ||
        statusObj?.data?.profile?.id ||
        statusObj?.profile_id ||
        appObj?.profile_id ||
        (currentUser as any)?.volunteer_profile_id ||
        "";

      let summaryObj: any = dashObj?.service_summary || dashObj?.summary || null;
      if (!summaryObj && canonicalProfileId) {
        try {
          const sRes = await volunteerService.getServiceSummary(canonicalProfileId);
          if (sRes) summaryObj = sRes?.data || sRes;
        } catch {
          // Graceful fallback
        }
      }

      if (shiftRes.status === "rejected") {
        setError(extractErrorMessage(shiftRes.reason, "Failed to load shifts from server."));
      }

      setAvailableShifts(rawShifts);
      setMyAttendance(rawAttendance);
      setNotifications(rawNotifs);
      setServiceSummary(summaryObj || {});
      if (statusObj) setMyStatusInfo(statusObj);
      if (appObj) setMyApplication(appObj);
      setFeedbackList(rawFeedbacks);
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to load volunteer portal data."));
    } finally {
      setLoading(false);
    }
  }, []); // Stable empty dependency array prevents continuous re-render cycles

  useEffect(() => {
    fetchVolunteerPortalData();
  }, [fetchVolunteerPortalData]);

  useDataSync(fetchVolunteerPortalData);

  // Determine current active volunteer account status
  const currentVolunteerStatus = useMemo(() => {
    // 1. Check if profile exists and has an explicit status
    const profileStatus =
      myStatusInfo?.profile?.status ||
      myStatusInfo?.data?.profile?.status;
    if (profileStatus) return String(profileStatus).toLowerCase().trim();

    // 2. Check if application exists and has an explicit status
    const appStatus =
      myStatusInfo?.application?.status ||
      myApplication?.status;
    if (appStatus) return String(appStatus).toLowerCase().trim();

    // 3. Check lifecycle status from GET /volunteers/me/status
    const lifecycleStatus =
      myStatusInfo?.status ||
      myStatusInfo?.data?.status;
    if (lifecycleStatus) return String(lifecycleStatus).toLowerCase().trim();

    // 4. Check user object in session
    const userVolunteerStatus =
      (currentUser as any)?.volunteer_status ||
      (currentUser as any)?.volunteer_profile?.status ||
      (currentUser as any)?.status;
    if (userVolunteerStatus) return String(userVolunteerStatus).toLowerCase().trim();

    return "not_applied";
  }, [myStatusInfo, myApplication, currentUser]);

  const isApprovedVolunteer = useMemo(() => {
    return ["active", "onboarded", "approved"].includes(currentVolunteerStatus);
  }, [currentVolunteerStatus]);

  // Populate edit profile modal state from application / status
  const openEditProfileModal = () => {
    const profile = myStatusInfo?.profile || myApplication || {};
    setEditProfileForm({
      emergency_contact_name: profile.emergency_contact_name || (currentUser as any)?.emergency_contact_name || "",
      emergency_contact_phone: profile.emergency_contact_phone || (currentUser as any)?.emergency_contact_phone || "",
      skills: profile.skills || "",
      availability: profile.availability || "",
      animal_handling_experience: profile.animal_handling_experience || "",
      medical_conditions: profile.medical_conditions || "",
      notes: profile.notes || "",
    });
    setIsEditProfileModalOpen(true);
  };

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profileId =
      getVolunteerProfileId(myStatusInfo) ||
      getVolunteerProfileId(myApplication) ||
      (currentUser as any)?.volunteer_profile_id ||
      "";

    if (!profileId) {
      addToast("Cannot update profile: Volunteer Profile ID not found.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await volunteerService.updateVolunteerProfile(profileId, {
        emergency_contact_name: editProfileForm.emergency_contact_name.trim() || null,
        emergency_contact_phone: editProfileForm.emergency_contact_phone.trim() || null,
        skills: editProfileForm.skills.trim() || null,
        availability: editProfileForm.availability.trim() || null,
        animal_handling_experience: editProfileForm.animal_handling_experience.trim() || null,
        medical_conditions: editProfileForm.medical_conditions.trim() || null,
        notes: editProfileForm.notes.trim() || null,
      });
      addToast("Volunteer profile updated successfully!", "success");
      setIsEditProfileModalOpen(false);
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Failed to update profile."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Accept / Join Shift
  const handleJoinShift = async (shiftId: string) => {
    if (!isApprovedVolunteer) {
      addToast(
        `Cannot join shift: Your volunteer account status is currently '${currentVolunteerStatus.replace(/_/g, " ")}'. Only approved and active volunteers may claim open shifts.`,
        "error"
      );
      return;
    }

    const targetShift = availableShifts.find((s) => s.id === shiftId);
    if (targetShift) {
      const enrolled = targetShift.enrolled_count ?? targetShift.attendance_count ?? 0;
      const capacity = targetShift.capacity ?? 5;
      if (enrolled >= capacity) {
        addToast("Cannot join shift: Shift capacity has been reached.", "error");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await volunteerService.joinShift(shiftId);
      addToast("Shift accepted & joined successfully! View it under 'Attendance & Check-in'.", "success");
      setActiveTab("attendance");
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Failed to accept shift."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to obtain GPS coordinates if browser allows
  const getGpsLocation = (): Promise<{ latitude: number | null; longitude: number | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  };

  // Handle Check-In
  const handleCheckIn = async (attendanceId: string) => {
    try {
      setIsSubmitting(true);
      const coords = await getGpsLocation();
      await volunteerService.checkInAttendance(attendanceId, coords.latitude, coords.longitude);
      addToast("Check-in confirmed! Thank you for beginning your volunteer duty.", "success");
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Check-in failed."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Check-Out
  const handleCheckOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendance?.id) return;
    if (!selectedAttendance?.check_in_at) {
      addToast("Check-in is required before checking out of a shift.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const coords = await getGpsLocation();
      await volunteerService.checkOutAttendance(
        selectedAttendance.id,
        checkOutNotes.trim(),
        coords.latitude,
        coords.longitude
      );
      addToast("Check-out completed! Your volunteer hours have been recorded.", "success");
      setIsCheckOutModalOpen(false);
      setSelectedAttendance(null);
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Check-out failed."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel Shift Claim
  const handleCancelAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceToCancel?.id) return;
    try {
      setIsSubmitting(true);
      await volunteerService.cancelAttendance(attendanceToCancel.id, cancelReason.trim());
      addToast("Shift duty registration cancelled successfully.", "info");
      setIsCancelModalOpen(false);
      setAttendanceToCancel(null);
      setCancelReason("");
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Failed to cancel shift registration."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Feedback Submission
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComments.trim()) {
      addToast("Please provide comments or observations for your feedback.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await volunteerService.submitFeedback({
        rating: feedbackRating,
        comments: feedbackComments.trim(),
      });
      addToast("Shelter feedback submitted successfully! Thank you for helping improve our operations.", "success");
      setIsFeedbackModalOpen(false);
      setFeedbackComments("");
      setFeedbackRating(5);
      fetchVolunteerPortalData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Failed to submit feedback."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Certificate Download
  const handleDownloadCertificate = async () => {
    const totalHrs = Number(serviceSummary?.total_hours || serviceSummary?.hours_served || 0);
    const completedShifts = Number(
      serviceSummary?.completed_shifts || myAttendance.filter((a) => a.check_out_at).length || 0
    );

    if (totalHrs === 0 && completedShifts === 0) {
      addToast(
        "Official Service Certificate becomes available after completing your first verified volunteer shift.",
        "info"
      );
      return;
    }

    const profileId =
      getVolunteerProfileId(myStatusInfo) ||
      getVolunteerProfileId(myApplication) ||
      (currentUser as any)?.volunteer_profile_id ||
      "";

    try {
      addToast("Fetching official volunteer service certificate...", "info");
      const cert = profileId
        ? await volunteerService.getCertificate(profileId)
        : await volunteerService.getMyCertificate();

      const downloadUrl = cert?.certificate_url || cert?.download_url || cert?.url;
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
        addToast("Service Certificate opened in a new tab.", "success");
      } else {
        addToast("Service Certificate record verified successfully!", "success");
      }
    } catch (err: any) {
      addToast(extractErrorMessage(err, "Failed to generate certificate."), "error");
    }
  };

  // Filtered Open Shifts
  const filteredShifts = useMemo(() => {
    return availableShifts.filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const role = String(s.role_name || s.title || "").toLowerCase();
      const facility = String(s.facility_name || s.location_name || s.shelter_facility_id || "").toLowerCase();
      return role.includes(q) || facility.includes(q);
    });
  }, [availableShifts, searchQuery]);

  // Calculations for stats & active duties
  const totalHours = Number(serviceSummary?.total_hours || serviceSummary?.hours_served || 0);
  const completedAttendanceCount = myAttendance.filter((a) => a.check_out_at || a.status === "checked_out").length;
  const activeDuty = myAttendance.find((a) => a.check_in_at && !a.check_out_at && a.status === "checked_in");
  const upcomingShift = myAttendance.find(
    (a) => !a.check_in_at && a.status !== "cancelled" && a.status !== "no_show" && a.status !== "checked_out"
  );
  const activeAttendanceCount = activeDuty ? 1 : 0;

  const statCards = [
    {
      title: "Available Shifts",
      value: loading ? "..." : String(availableShifts.length),
      trend: "Open Roster Duties",
      color: "#1E3A8A",
      icon: <FaClipboardList />,
      onClick: () => setActiveTab("shifts"),
    },
    {
      title: "My Claimed Shifts",
      value: loading ? "..." : String(myAttendance.length),
      trend: `${activeAttendanceCount} Active / ${completedAttendanceCount} Completed`,
      color: "#16A34A",
      icon: <FaCalendarCheck />,
      onClick: () => setActiveTab("attendance"),
    },
    {
      title: "Volunteer Service Hours",
      value: loading ? "..." : `${totalHours} Hrs`,
      trend: `${completedAttendanceCount} Verified Duties`,
      color: "#1E3A8A",
      icon: <FaClock />,
      onClick: () => setActiveTab("activities"),
    },
    {
      title: "Official Certificate",
      value: totalHours > 0 || completedAttendanceCount > 0 ? "Eligible" : "Pending Duty",
      trend: "PawGuard Recognition",
      color: "#1E3A8A",
      icon: <FaAward />,
      onClick: () => void handleDownloadCertificate(),
    },
  ];

  // Table Columns
  const shiftColumns = [
    {
      key: "role_name",
      header: "Duty / Role Name",
      render: (v: string, r: any) => (
        <div style={{ wordBreak: "break-word" }}>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>
            {v || r.title || "Shelter Support Duty"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
            <FaMapMarkerAlt size={10} color="#94A3B8" />
            <span>
              {r.location_name ||
                r.facility_name ||
                r.shelter_name ||
                (r.shelter_facility_id ? `Facility (${String(r.shelter_facility_id).slice(0, 8)})` : "Central Facility")}
            </span>
          </div>
          {(r.notes || r.message || r.instructions) && (
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", fontStyle: "italic", background: "#F8FAFC", padding: "4px 8px", borderRadius: "4px" }}>
              Notes: {r.notes || r.message || r.instructions}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "start_at",
      header: "Start Time",
      render: (v: string) => (
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
          {v ? formatDateTime(v) : "-"}
        </span>
      ),
    },
    {
      key: "end_at",
      header: "End Time",
      render: (v: string) => (
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
          {v ? formatDateTime(v) : "-"}
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Open Capacity",
      render: (v: number, r: any) => {
        const enrolled = r.enrolled_count ?? r.attendance_count ?? 0;
        const cap = v ?? 5;
        const isFull = enrolled >= cap;
        return (
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                background: isFull ? "#FEE2E2" : "#DCFCE7",
                color: isFull ? "#991B1B" : "#166534",
              }}
            >
              {enrolled} / {cap} Enrolled {isFull ? "(FULL)" : ""}
            </span>
          </div>
        );
      },
    },
  ];

  const attendanceColumns = [
    {
      key: "shift",
      header: "Shift & Facility",
      render: (_: any, r: any) => (
        <div style={{ wordBreak: "break-word" }}>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>
            {r.shift?.role_name || r.role_name || "Volunteer Shift Duty"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
            Facility: {r.shift?.location_name || r.shift?.facility_name || "Assigned Shelter Facility"}
          </div>
          {(r.notes || r.shift?.notes || r.completion_notes) && (
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", fontStyle: "italic", background: "#F1F5F9", padding: "4px 8px", borderRadius: "4px" }}>
              Duty Notes: {r.notes || r.shift?.notes || r.completion_notes}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Attendance Status",
      render: (v: string, r: any) => {
        const status = String(v || "").toLowerCase();
        if (status === "checked_out" || r.check_out_at) {
          return (
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534", background: "#DCFCE7", padding: "4px 10px", borderRadius: "999px" }}>
              COMPLETED
            </span>
          );
        }
        if (status === "checked_in" || r.check_in_at) {
          return (
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#1E3A8A", background: "#DBEAFE", padding: "4px 10px", borderRadius: "999px" }}>
              ACTIVE ON DUTY
            </span>
          );
        }
        if (status === "cancelled") {
          return (
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", background: "#F1F5F9", padding: "4px 10px", borderRadius: "999px" }}>
              CANCELLED
            </span>
          );
        }
        if (status === "no_show") {
          return (
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#991B1B", background: "#FEE2E2", padding: "4px 10px", borderRadius: "999px" }}>
              NO-SHOW
            </span>
          );
        }
        return (
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#92400E", background: "#FEF3C7", padding: "4px 10px", borderRadius: "999px" }}>
            CLAIMED (PENDING CHECK-IN)
          </span>
        );
      },
    },
    {
      key: "check_in_at",
      header: "Check-In / Out Times",
      render: (_: any, r: any) => (
        <div style={{ fontSize: "12px", color: "#334155" }}>
          <div><strong>In:</strong> {r.check_in_at ? formatDateTime(r.check_in_at) : "Not yet"}</div>
          <div style={{ marginTop: "2px" }}><strong>Out:</strong> {r.check_out_at ? formatDateTime(r.check_out_at) : "Not yet"}</div>
        </div>
      ),
    },
    {
      key: "hours_logged",
      header: "Hours Logged",
      render: (v: number, r: any) => {
        const hrs = v ?? r.hours_served ?? (r.check_out_at && r.check_in_at ? ((new Date(r.check_out_at).getTime() - new Date(r.check_in_at).getTime()) / 3600000).toFixed(1) : 0);
        return <strong style={{ color: "#1E3A8A", fontSize: "13px" }}>{hrs} Hours</strong>;
      },
    },
  ];

  const activityColumns = [
    {
      key: "shift",
      header: "Completed Volunteer Duty",
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>
            {r.shift?.role_name || r.role_name || "Shelter Assistance"}
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
            {r.shift?.location_name || r.shift?.facility_name || "Central Shelter"}
          </div>
        </div>
      ),
    },
    {
      key: "check_out_at",
      header: "Date Completed",
      render: (v: string, r: any) => (
        <span style={{ fontSize: "13px", color: "#334155", fontWeight: 600 }}>
          {v ? formatDateTime(v) : r.check_in_at ? formatDateTime(r.check_in_at) : "-"}
        </span>
      ),
    },
    {
      key: "hours_logged",
      header: "Service Hours",
      render: (v: number, r: any) => {
        const hrs = v ?? r.hours_served ?? 0;
        return <span style={{ fontWeight: 700, color: "#15803D" }}>+{hrs} Hrs</span>;
      },
    },
    {
      key: "notes",
      header: "Completion Summary",
      render: (v: string, r: any) => (
        <span style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>
          {v || r.shift?.notes || "Duty completed according to shelter safety guidelines."}
        </span>
      ),
    },
  ];

  return (
    <div style={{ width: "100%", boxSizing: "border-box", maxWidth: "100%", overflowX: "hidden" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
                Volunteer Self-Service Portal
              </h1>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "3px 9px",
                  borderRadius: "999px",
                  background: isApprovedVolunteer
                    ? "#10B981"
                    : currentVolunteerStatus === "not_applied"
                    ? "#3B82F6"
                    : "#F59E0B",
                  color: "#FFF",
                }}
              >
                {currentVolunteerStatus.replace(/_/g, " ")}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
              Welcome back, {(currentUser as any)?.full_name || (currentUser as any)?.name || "Volunteer"}. Browse open shelter shifts, manage attendance, log duties, and view verified certificates.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
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
              <FaCommentDots /> Give Feedback
            </button>
            <button
              type="button"
              onClick={fetchVolunteerPortalData}
              disabled={loading}
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
              <FaSync className={loading ? "spin-animate" : ""} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Volunteer Status Alert Banner */}
      {!isApprovedVolunteer && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor:
              currentVolunteerStatus === "applied" || currentVolunteerStatus === "pending"
                ? "#FEF3C7"
                : currentVolunteerStatus === "not_applied"
                ? "#EFF6FF"
                : "#FEF2F2",
            border: `1px solid ${
              currentVolunteerStatus === "applied" || currentVolunteerStatus === "pending"
                ? "#F59E0B"
                : currentVolunteerStatus === "not_applied"
                ? "#93C5FD"
                : "#FCA5A5"
            }`,
            color:
              currentVolunteerStatus === "applied" || currentVolunteerStatus === "pending"
                ? "#92400E"
                : currentVolunteerStatus === "not_applied"
                ? "#1E40AF"
                : "#991B1B",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {currentVolunteerStatus === "not_applied"
            ? "Volunteer Application Required: Your account does not yet have an active volunteer profile. Browse available shifts below; shift claiming will unlock once your volunteer application is approved."
            : currentVolunteerStatus === "applied" || currentVolunteerStatus === "pending"
            ? "Volunteer Application In Review: Your volunteer profile is awaiting coordinator orientation and verification. You can review your profile details below; shift claiming will unlock once approved."
            : currentVolunteerStatus === "rejected"
            ? "Application Status Update: Your volunteer registration has not been approved. If you have questions, please reach out to your Volunteer Coordinator."
            : `Volunteer Account Status (${currentVolunteerStatus.replace(/_/g, " ")}): Shift claiming is disabled for inactive profiles. Please contact your administrator.`}
        </div>
      )}

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
          {error}
        </div>
      )}

      {/* Active On-Duty Spotlight Box (if currently checked in) */}
      {activeDuty && (
        <div
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#4ADE80",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
              <strong style={{ fontSize: "15px", letterSpacing: "0.5px" }}>ACTIVE VOLUNTEER DUTY IN PROGRESS</strong>
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", opacity: 0.9 }}>
              <strong>{activeDuty.shift?.role_name || activeDuty.role_name || "Volunteer Shift"}</strong> &bull; Checked in at {activeDuty.check_in_at ? formatDateTime(activeDuty.check_in_at) : "Today"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedAttendance(activeDuty);
              setCheckOutNotes("Shift tasks completed according to safety protocols.");
              setIsCheckOutModalOpen(true);
            }}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#FFFFFF",
              color: "#1E3A8A",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaSignOutAlt /> Check Out &amp; Log Hours
          </button>
        </div>
      )}

      {/* Quick Action Navigation Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <QuickActionCard
          icon={<FaTachometerAlt />}
          title="Overview"
          subtitle="Volunteer Dashboard"
          color="#1E3A8A"
          onClick={() => setActiveTab("overview")}
        />
        <QuickActionCard
          icon={<FaClipboardList />}
          title="Browse Shifts"
          subtitle="Available Opportunities"
          color="#1E3A8A"
          onClick={() => setActiveTab("shifts")}
        />
        <QuickActionCard
          icon={<FaCalendarCheck />}
          title="My Attendance"
          subtitle="Check-in &amp; Check-out"
          color="#16A34A"
          onClick={() => setActiveTab("attendance")}
        />
        <QuickActionCard
          icon={<FaAward />}
          title="Service Certificate"
          subtitle="Verified hours record"
          color="#1E3A8A"
          onClick={() => setActiveTab("activities")}
        />
        <QuickActionCard
          icon={<FaCommentDots />}
          title="Shelter Feedback"
          subtitle="Submit operational review"
          color="#1E3A8A"
          onClick={() => setActiveTab("feedback")}
        />
        <QuickActionCard
          icon={<FaUser />}
          title="My Profile"
          subtitle="Skills &amp; Emergency Contact"
          color="#1E3A8A"
          onClick={() => setActiveTab("profile")}
        />
      </div>

      {/* Key Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {statCards.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* TABBED WORKSPACE */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px", background: "#FFFFFF", borderRadius: "14px", border: "1px solid #E2E8F0" }}>
        {/* Navigation Tabs Header */}
        <div style={{ borderBottom: "2px solid #E2E8F0", paddingBottom: "12px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "overview" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "overview" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "overview" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaTachometerAlt /> Overview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shifts")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "shifts" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "shifts" ? "#EFF6FF" : "#FFFFFF",
                color: activeTab === "shifts" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaClipboardList /> Available Shifts ({availableShifts.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "attendance" ? "2px solid #16A34A" : "1px solid #CBD5E1",
                background: activeTab === "attendance" ? "#ECFDF5" : "#FFFFFF",
                color: activeTab === "attendance" ? "#15803D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaCalendarCheck /> My Attendance ({myAttendance.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("activities")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "activities" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "activities" ? "#EEF2FF" : "#FFFFFF",
                color: activeTab === "activities" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaAward /> Activity History &amp; Certificate
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("feedback")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "feedback" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "feedback" ? "#FFFBEB" : "#FFFFFF",
                color: activeTab === "feedback" ? "#B45309" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaCommentDots /> Shelter Feedback ({feedbackList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "profile" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "profile" ? "#F5F3FF" : "#FFFFFF",
                color: activeTab === "profile" ? "#6D28D9" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaUser /> Volunteer Profile &amp; Skills
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeTab === "notifications" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeTab === "notifications" ? "#FCE7F3" : "#FFFFFF",
                color: activeTab === "notifications" ? "#BE185D" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaBell /> Notifications ({notifications.length})
            </button>
          </div>
        </div>

        {/* TAB 0: OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "20px" }}>
              {/* Upcoming Shift Spotlight */}
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaClock color="#1E3A8A" /> Next Scheduled Duty
                </h3>
                {upcomingShift ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E3A8A" }}>
                      {upcomingShift.shift?.role_name || upcomingShift.role_name || "Volunteer Shift"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <FaMapMarkerAlt size={11} color="#94A3B8" />
                      <span>{upcomingShift.shift?.location_name || upcomingShift.shift?.facility_name || "Central Shelter"}</span>
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "13px", color: "#334155" }}>
                      Scheduled: <strong>{upcomingShift.shift?.start_at ? formatDateTime(upcomingShift.shift.start_at) : "Assigned"}</strong>
                    </div>
                    <div style={{ marginTop: "14px" }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab("attendance")}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#16A34A",
                          color: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <FaSignInAlt /> Go to Check-In
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#64748B", fontSize: "13px" }}>
                    No upcoming shifts currently scheduled. Browse open shifts to join upcoming shelter duties.
                    <div style={{ marginTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab("shifts")}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          background: "#FFF",
                          color: "#1E3A8A",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Browse Available Shifts
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Standing & Certificate Card */}
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaAward color="#1E3A8A" /> Volunteer Service Record
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Total Verified Hours:</span>{" "}
                    <strong style={{ color: "#1E3A8A", fontSize: "14px" }}>{totalHours} Hours</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Completed Duties:</span>{" "}
                    <strong>{completedAttendanceCount} Shifts</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Recognition Certificate:</span>{" "}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: totalHours > 0 || completedAttendanceCount > 0 ? "#DCFCE7" : "#F1F5F9",
                        color: totalHours > 0 || completedAttendanceCount > 0 ? "#166534" : "#64748B",
                      }}
                    >
                      {totalHours > 0 || completedAttendanceCount > 0 ? "ELIGIBLE" : "PENDING DUTIES"}
                    </span>
                  </div>
                  <div style={{ marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => void handleDownloadCertificate()}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#1E3A8A",
                        color: "#FFF",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaAward /> Download Certificate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                  Recent Volunteer Attendance &amp; Shift History
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("attendance")}
                  style={{ background: "none", border: "none", color: "#1E3A8A", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >
                  View All &rarr;
                </button>
              </div>
              <DataTable
                columns={attendanceColumns}
                data={myAttendance.slice(0, 5)}
                loading={loading}
                error={error}
                onRetry={fetchVolunteerPortalData}
                hideSearch={true}
                emptyMessage="No volunteer shift registrations yet."
              />
            </div>
          </div>
        )}

        {/* TAB 1: AVAILABLE & CLAIMED SHIFTS */}
        {activeTab === "shifts" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                  Volunteer Duty Shifts Roster
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Browse open shelter &amp; community shifts, inspect capacity, and accept duties to join the roster.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", borderRadius: "8px", border: "1px solid #CBD5E1", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setShiftViewMode("available")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: shiftViewMode === "available" ? "#1E3A8A" : "#FFF",
                      color: shiftViewMode === "available" ? "#FFF" : "#475569",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Open Shifts ({filteredShifts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftViewMode("claimed")}
                    style={{
                      padding: "6px 12px",
                      border: "none",
                      background: shiftViewMode === "claimed" ? "#1E3A8A" : "#FFF",
                      color: shiftViewMode === "claimed" ? "#FFF" : "#475569",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    My Claimed ({myAttendance.length})
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <FaSearch style={{ position: "absolute", left: "10px", top: "11px", color: "#94A3B8" }} size={12} />
                  <input
                    type="text"
                    placeholder="Search shifts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: "8px 12px 8px 30px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13px",
                      width: "200px",
                      maxWidth: "100%",
                    }}
                  />
                </div>
              </div>
            </div>

            {shiftViewMode === "available" ? (
              <DataTable
                columns={shiftColumns}
                data={filteredShifts}
                loading={loading}
                error={error}
                onRetry={fetchVolunteerPortalData}
                hideSearch={true}
                emptyMessage="No available shifts matching your criteria."
                renderRowActions={(row: any) => {
                  const enrolled = row.enrolled_count ?? row.attendance_count ?? 0;
                  const cap = row.capacity ?? 5;
                  const isFull = enrolled >= cap;
                  const alreadyJoined = myAttendance.some(
                    (a) => (a.shift_id === row.id || a.shift?.id === row.id) && a.status !== "cancelled"
                  );

                  if (alreadyJoined) {
                    return (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#15803D",
                          background: "#DCFCE7",
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        Joined
                      </span>
                    );
                  }

                  if (!isApprovedVolunteer) {
                    return (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748B",
                          fontWeight: 600,
                          background: "#F1F5F9",
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        Approval Required
                      </span>
                    );
                  }

                  if (isFull) {
                    return (
                      <button
                        type="button"
                        disabled
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#94A3B8",
                          color: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "not-allowed",
                        }}
                      >
                        Capacity Full
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleJoinShift(row.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#1E3A8A",
                        color: "#FFF",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaUserCheck /> Accept &amp; Join Shift
                    </button>
                  );
                }}
              />
            ) : (
              <DataTable
                columns={attendanceColumns}
                data={myAttendance}
                loading={loading}
                error={error}
                onRetry={fetchVolunteerPortalData}
                hideSearch={true}
                emptyMessage="You have not claimed any shifts yet."
              />
            )}
          </div>
        )}

        {/* TAB 2: ATTENDANCE & CHECK-IN */}
        {activeTab === "attendance" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                  My Shift Registrations &amp; Attendance Actions ({myAttendance.length})
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Check in upon arrival at the facility, record completion notes at check-out, or cancel if unavailable.
                </p>
              </div>
            </div>

            <DataTable
              columns={attendanceColumns}
              data={myAttendance}
              loading={loading}
              error={error}
              onRetry={fetchVolunteerPortalData}
              hideSearch={true}
              emptyMessage="You have not joined any shifts yet. Browse 'Available Shifts' to claim an open duty."
              renderRowActions={(row: any) => {
                const isCheckedOut = Boolean(row.check_out_at || row.status === "checked_out");
                const isCheckedIn = Boolean(row.check_in_at && !isCheckedOut);
                const isCancelled = row.status === "cancelled";
                const isNoShow = row.status === "no_show";

                if (isCancelled) {
                  return (
                    <span style={{ fontSize: "11px", color: "#64748B", fontStyle: "italic" }}>
                      Cancelled
                    </span>
                  );
                }

                if (isNoShow) {
                  return (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B" }}>
                      Marked No-Show
                    </span>
                  );
                }

                return (
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {!isCheckedIn && !isCheckedOut && (
                      <>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleCheckIn(row.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            background: "#16A34A",
                            color: "#FFF",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FaSignInAlt /> Check In
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setAttendanceToCancel(row);
                            setCancelReason("");
                            setIsCancelModalOpen(true);
                          }}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#64748B",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FaTimesCircle /> Cancel
                        </button>
                      </>
                    )}

                    {isCheckedIn && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setSelectedAttendance(row);
                          setCheckOutNotes("Shift tasks completed according to safety protocols.");
                          setIsCheckOutModalOpen(true);
                        }}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#1E3A8A",
                          color: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <FaSignOutAlt /> Check Out &amp; Log Hours
                      </button>
                    )}

                    {isCheckedOut && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: "#15803D",
                          background: "#D1FAE5",
                          padding: "4px 10px",
                          borderRadius: "999px",
                        }}
                      >
                        COMPLETED
                      </span>
                    )}
                  </div>
                );
              }}
            />
          </div>
        )}

        {/* TAB 3: ACTIVITY HISTORY & CERTIFICATES */}
        {activeTab === "activities" && (
          <div>
            <div
              style={{
                background: "#F8FAFC",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                    Verified Service Record &amp; Milestones
                  </h3>
                  <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
                    PawGuard verified service summary and official service certificate generator.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadCertificate()}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaAward size={14} /> Download Service Certificate
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginTop: "16px",
                }}
              >
                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Total Hours Contributed
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#1E3A8A", marginTop: "4px" }}>
                    {totalHours} Hours
                  </div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Completed Shifts
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#16A34A", marginTop: "4px" }}>
                    {completedAttendanceCount} Shifts
                  </div>
                </div>

                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                    Volunteer Standing
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: isApprovedVolunteer ? "#15803D" : "#D97706", marginTop: "4px" }}>
                    {isApprovedVolunteer ? "VERIFIED ACTIVE" : "ORIENTATION REQUIRED"}
                  </div>
                </div>
              </div>
            </div>

            <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
              Completed Duties Log
            </h4>
            <DataTable
              columns={activityColumns}
              data={myAttendance.filter((a) => a.check_out_at || a.status === "checked_out")}
              loading={loading}
              error={error}
              onRetry={fetchVolunteerPortalData}
              hideSearch={true}
              emptyMessage="No completed volunteer duties recorded yet."
            />
          </div>
        )}

        {/* TAB 4: SHELTER FEEDBACK */}
        {activeTab === "feedback" && (
          <div>
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
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                  Shelter Operations &amp; Safety Feedback
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Share your observations, facility suggestions, or support requests with the shelter management team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1E3A8A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaCommentDots /> Submit New Feedback
              </button>
            </div>

            {feedbackList.length === 0 ? (
              <div
                style={{
                  padding: "36px 20px",
                  textAlign: "center",
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  border: "1px dashed #CBD5E1",
                }}
              >
                <FaCommentDots size={32} color="#94A3B8" style={{ marginBottom: "8px" }} />
                <div style={{ fontWeight: 700, color: "#0F172A" }}>No Feedback Submitted Yet</div>
                <p style={{ color: "#64748B", fontSize: "13px", margin: "4px 0 14px 0" }}>
                  Your insights and safety notes help improve our shelter and volunteer programs.
                </p>
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1E3A8A",
                    color: "#FFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Write First Feedback
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {feedbackList.map((fb) => (
                  <div
                    key={fb.id || fb.created_at}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FaStar
                            key={star}
                            size={14}
                            color={star <= (fb.rating || 5) ? "#F59E0B" : "#CBD5E1"}
                          />
                        ))}
                        <span style={{ fontSize: "12px", fontWeight: 700, marginLeft: "6px", color: "#0F172A" }}>
                          {fb.rating || 5} / 5 Stars
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748B" }}>
                        {fb.created_at ? formatDateTime(fb.created_at) : "Recently submitted"}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginTop: "8px", lineHeight: 1.5 }}>
                      {fb.comments || fb.message || fb.description || "Feedback logged without specific notes."}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: VOLUNTEER PROFILE */}
        {activeTab === "profile" && (
          <div>
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
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                  Volunteer Profile &amp; Skills Record
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748B" }}>
                  Self-service profile details, emergency contact information, and special handling skills.
                </p>
              </div>
              <button
                type="button"
                onClick={openEditProfileModal}
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
                <FaEdit /> Edit Profile Details
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {/* Account Details Card */}
              <div style={{ padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaUser color="#1E3A8A" /> Account Information
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Full Name:</span>{" "}
                    <strong>{(currentUser as any)?.full_name || (currentUser as any)?.name || myApplication?.full_name || "Volunteer"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaEnvelope size={12} color="#64748B" />
                    <span>{(currentUser as any)?.email || myApplication?.email || "-"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaPhoneAlt size={12} color="#64748B" />
                    <span>{(currentUser as any)?.phone || myApplication?.phone || "-"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Account Status:</span>{" "}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: isApprovedVolunteer
                          ? "#DCFCE7"
                          : currentVolunteerStatus === "not_applied"
                          ? "#DBEAFE"
                          : "#FEF3C7",
                        color: isApprovedVolunteer
                          ? "#166534"
                          : currentVolunteerStatus === "not_applied"
                          ? "#1E40AF"
                          : "#92400E",
                      }}
                    >
                      {currentVolunteerStatus.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Card */}
              <div style={{ padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaShieldAlt color="#1E3A8A" /> Emergency Contact
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Contact Person:</span>{" "}
                    <strong>{myStatusInfo?.emergency_contact_name || myApplication?.emergency_contact_name || (currentUser as any)?.emergency_contact_name || "Not provided"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Emergency Phone:</span>{" "}
                    <strong>{myStatusInfo?.emergency_contact_phone || myApplication?.emergency_contact_phone || (currentUser as any)?.emergency_contact_phone || "Not provided"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Availability:</span>{" "}
                    <span>{myStatusInfo?.availability || myApplication?.availability || "Flexible"}</span>
                  </div>
                </div>
              </div>

              {/* Skills & Experience Card */}
              <div style={{ padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaCheckCircle color="#16A34A" /> Skills &amp; Qualifications
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Registered Skills:</span>{" "}
                    <span>{myStatusInfo?.skills || myApplication?.skills || "General Animal Care, Dog Walking"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Animal Handling Experience:</span>{" "}
                    <span>{myStatusInfo?.animal_handling_experience || myApplication?.animal_handling_experience || "Domestic Pets"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Medical / Allergy Notes:</span>{" "}
                    <span>{myStatusInfo?.medical_conditions || myApplication?.medical_conditions || "None declared"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Volunteer Notifications &amp; Broadcasts ({notifications.length})
            </h3>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", color: "#64748B" }}>
                No active notifications found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {notifications.map((n) => (
                  <div key={n.id || n.created_at} style={{ padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0", background: "#FFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#0F172A" }}>{n.title}</div>
                      <span style={{ fontSize: "11px", color: "#64748B" }}>{n.time || (n.created_at ? formatDateTime(n.created_at) : "")}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check-Out Confirmation Modal */}
      <Modal isOpen={isCheckOutModalOpen} onClose={() => setIsCheckOutModalOpen(false)} title="Confirm Shift Check-Out & Log Hours">
        <form onSubmit={handleCheckOutSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Duty Completion Remarks &amp; Observations
            </label>
            <textarea
              rows={3}
              placeholder="Detail your completed duties, kennel socialization observations, or any special incidents..."
              value={checkOutNotes}
              onChange={(e) => setCheckOutNotes(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsCheckOutModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Processing Check-Out..." : "Confirm Check-Out & Complete"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Shift Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Shift Duty Registration">
        <form onSubmit={handleCancelAttendanceSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>
            Are you sure you want to cancel your registration for this shift? This will reopen the capacity slot for another volunteer.
          </p>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Reason for Cancellation (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Schedule conflict, transportation issue..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", cursor: "pointer" }}
            >
              Keep Registration
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Feedback Modal */}
      <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Submit Shelter & Operations Feedback">
        <form onSubmit={handleFeedbackSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
              Overall Experience Rating
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    color: star <= feedbackRating ? "#F59E0B" : "#CBD5E1",
                  }}
                >
                  <FaStar size={24} />
                </button>
              ))}
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E3A8A", marginLeft: "8px" }}>
                {feedbackRating} of 5 Stars
              </span>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Feedback Observations &amp; Suggestions *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe your shelter experience, facility cleaniness, tool availability, staff support, or animal handling suggestions..."
              value={feedbackComments}
              onChange={(e) => setFeedbackComments(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Submitting..." : "Send Feedback"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditProfileModalOpen} onClose={() => setIsEditProfileModalOpen(false)} title="Update Volunteer Profile Details">
        <form onSubmit={handleEditProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Emergency Contact Name
              </label>
              <input
                type="text"
                value={editProfileForm.emergency_contact_name}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, emergency_contact_name: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                Emergency Phone
              </label>
              <input
                type="text"
                value={editProfileForm.emergency_contact_phone}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, emergency_contact_phone: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Specialized Skills &amp; Qualifications
            </label>
            <input
              type="text"
              placeholder="e.g. Dog Walking, Bathing/Grooming, Transport, Photography, Public Outreach"
              value={editProfileForm.skills}
              onChange={(e) => setEditProfileForm({ ...editProfileForm, skills: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Availability Schedule
            </label>
            <input
              type="text"
              placeholder="e.g. Weekends (mornings), Tuesdays 2pm-6pm"
              value={editProfileForm.availability}
              onChange={(e) => setEditProfileForm({ ...editProfileForm, availability: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Animal Handling Experience
            </label>
            <input
              type="text"
              placeholder="e.g. 3 years dog foster care, shelter dog walking experience"
              value={editProfileForm.animal_handling_experience}
              onChange={(e) => setEditProfileForm({ ...editProfileForm, animal_handling_experience: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Medical Conditions / Allergies (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Mild pet dander allergy, none"
              value={editProfileForm.medical_conditions}
              onChange={(e) => setEditProfileForm({ ...editProfileForm, medical_conditions: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsEditProfileModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Saving..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default VolunteerDashboard;
