import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaHeart,
  FaUserCheck,
  FaClipboardCheck,
  FaPlus,
  FaHome,
  FaDog,
  FaStar,
  FaCheckDouble,
  FaEllipsisV,
  FaExclamationTriangle,
} from "react-icons/fa";
import adoptionService, {
  notifyApplicant,
  type AdoptionScoreCreatePayload,
} from "../../services/adoptionService";
import petService from "../../services/petService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 500,
  color: "#1E293B",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

const extractErrorMessage = (err: any, fallback: string): string => {
  const detail =
    err?.response?.data?.error?.message ||
    err?.response?.data?.error ||
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => (typeof item === "string" ? item : item?.msg || JSON.stringify(item))).join("; ");
  }
  if (typeof detail === "object") {
    return (detail as any).msg || (detail as any).message || JSON.stringify(detail);
  }
  return String(detail);
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = String(status || "").toLowerCase();
  let label = s.toUpperCase();
  let bg = "#F1F5F9";
  let color = "#334155";
  let border = "#CBD5E1";

  if (s === "submitted") {
    label = "Submitted";
    bg = "#F8FAFC";
    color = "#475569";
    border = "#CBD5E1";
  } else if (s === "screening") {
    label = "Screening";
    bg = "#EFF6FF";
    color = "#1D4ED8";
    border = "#93C5FD";
  } else if (s === "interview") {
    label = "Interview";
    bg = "#F3E8FF";
    color = "#7E22CE";
    border = "#D8B4FE";
  } else if (s === "home_check") {
    label = "Home Visit";
    bg = "#FEF3C7";
    color = "#B45309";
    border = "#FDE68A";
  } else if (s === "approved") {
    label = "Approved";
    bg = "#D1FAE5";
    color = "#047857";
    border = "#6EE7B7";
  } else if (s === "completed") {
    label = "Completed";
    bg = "#EEF2FF";
    color = "#4338CA";
    border = "#A5B4FC";
  } else if (s === "rejected") {
    label = "Rejected";
    bg = "#FEE2E2";
    color = "#B91C1C";
    border = "#FCA5A5";
  } else if (s === "vetting") {
    label = "Vetting";
    bg = "#F1F5F9";
    color = "#475569";
    border = "#CBD5E1";
  }

  return (
    <span
      style={{
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
};

const Adoptions = () => {
  const isRescueCentreAdmin = getCurrentUserRole() === "rescue_centre_admin";
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"queue" | "scoring" | "completed">("queue");
  const [adoptions, setAdoptions] = useState<Record<string, unknown>[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { addToast } = useToast();

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#DC2626", fontWeight: 800 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: "600px", margin: "12px auto" }}>
          Adoption Management is reserved for Adoption Coordinators, Shelter Managers, and Super Administrators. Rescue Centre Admin access is restricted to centre rescue operations, dispatch, vehicle fleet, and dog master management.
        </p>
      </div>
    );
  }

  // Search & Pagination & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const statusParam = searchParams.get("status");
    const appIdParam = searchParams.get("appId");

    if (tabParam === "queue" || tabParam === "scoring" || tabParam === "completed") {
      setActiveTab(tabParam);
    }
    if (statusParam) {
      setStatusFilter(statusParam);
    }

    if (appIdParam && adoptions.length > 0) {
      const found = adoptions.find(
        (a) => String(a.id || a.applicationId || "").toLowerCase() === appIdParam.toLowerCase()
      );
      if (found) {
        setSelectedAdoption(found);
        setIsDetailsModalOpen(true);
      }
    }
  }, [searchParams, adoptions]);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Safety Tag QR Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Selection state
  const [selectedAdoption, setSelectedAdoption] = useState<Record<string, unknown> | null>(null);
  const [candidateScores, setCandidateScores] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [newAppForm, setNewAppForm] = useState({
    dog_id: "",
    residential_status: "owned",
    has_landlord_approval: true,
    has_yard_fence: true,
    household_members_count: 2,
    existing_pets_medical_details: "1 neutered dog, vaccinated",
    pet_care_experience: "5+ years of dog ownership",
  });

  const [scheduleForm, setScheduleForm] = useState({
    date: "",
    time: "10:00",
    notes: "",
  });

  const [scoreForm, setScoreForm] = useState<AdoptionScoreCreatePayload>({
    home_environment_score: 5,
    pet_care_knowledge_score: 5,
    financial_readiness_score: 4,
    lifestyle_compatibility_score: 5,
    recommendation: "Highly Recommended for Adoption",
    notes: "Applicant has a secure fenced yard and extensive experience.",
  });

  const fetchAdoptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adoptionService.getAdoptions();
      const list = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      setAdoptions(list);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load adoption applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDogs = useCallback(async () => {
    try {
      const dogsRes = await petService.getPets();
      const list = Array.isArray(dogsRes.data) ? dogsRes.data : Array.isArray(dogsRes) ? dogsRes : [];
      setDogs(
        list.map((d: any) => ({
          id: d.id || d.dog_id || "",
          name: d.name || "Dog",
          label: `${d.name || "Dog"} (${d.registration_number || String(d.id || "").slice(0, 8)})`,
        }))
      );
    } catch {
      setDogs([]);
    }
  }, []);

  useEffect(() => {
    fetchAdoptions();
    fetchDogs();
  }, [fetchAdoptions, fetchDogs]);

  // Derived filtered adoptions
  const filteredAdoptions = useMemo(() => {
    return adoptions.filter((app) => {
      const status = String(app.status || "").toLowerCase();
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();
      if (!matchesStatus) return false;

      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      const searchable = [
        app.id,
        app.applicantName,
        app.applicantEmail,
        app.petName,
        app.status,
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [adoptions, statusFilter, debouncedSearch]);

  const paginatedAdoptions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAdoptions.slice(start, start + pageSize);
  }, [filteredAdoptions, page]);

  // Stats KPI
  const completedCount = adoptions.filter((a) => String(a.status).toLowerCase() === "completed").length;
  const approvedCount = adoptions.filter((a) => String(a.status).toLowerCase() === "approved").length;
  const pendingCount = adoptions.filter((a) => ["submitted", "vetting", "screening", "interview", "home_check"].includes(String(a.status).toLowerCase())).length;

  const stats = [
    { title: "Total Applications", value: `${adoptions.length}`, trend: "Records", color: "#2563EB", icon: <FaClipboardCheck /> },
    { title: "Pending In-Review", value: `${pendingCount}`, trend: "Requires Action", color: "#F59E0B", icon: <FaUserCheck /> },
    { title: "Approved Candidates", value: `${approvedCount}`, trend: "Approved", color: "#10B981", icon: <FaHeart /> },
    { title: "Completed Adoptions", value: `${completedCount}`, trend: "Finalized", color: "#6366F1", icon: <FaCheckDouble /> },
  ];

  // Actions
  const handleNewAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppForm.dog_id) {
      addToast("Please select a dog for the adoption application.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await adoptionService.createAdoption(newAppForm);
      addToast("Adoption application registered successfully!", "success");
      setIsNewModalOpen(false);
      fetchAdoptions();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to submit application.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdoption?.id) return;
    const appId = String(selectedAdoption.id);

    try {
      setIsSubmitting(true);
      const d = scheduleForm.date;
      const t = scheduleForm.time || "10:00";
      let combinedDateTime: string | null = null;
      if (d) {
        const timeStr = t.length === 5 ? `${t}:00` : t;
        const parsed = new Date(`${d}T${timeStr}`);
        if (!isNaN(parsed.getTime())) {
          combinedDateTime = parsed.toISOString();
        }
      }

      if (!combinedDateTime) {
        addToast("Please select a valid date and time for the home visit.", "error");
        setIsSubmitting(false);
        return;
      }

      const notes = scheduleForm.notes?.trim()
        ? `Home Inspection: ${scheduleForm.notes.trim()}`
        : "Home Inspection Scheduled";

      // Update status, scheduled date/time, and inspection notes in a single atomic API call
      await adoptionService.updateAdoptionDetails(appId, {
        status: "home_check",
        home_inspection_scheduled_at: combinedDateTime,
        home_inspection_notes: notes,
      });

      // Send notification to applicant if adopter_id exists
      await notifyApplicant(
        selectedAdoption.adopter_id as string | undefined,
        "Home Inspection Visit Scheduled",
        `Your home verification visit for ${selectedAdoption.petName || "rescue dog"} has been scheduled.`
      );

      addToast("Home verification visit scheduled successfully!", "success");
      setIsScheduleModalOpen(false);
      await fetchAdoptions();

      // Refresh currently selected adoption in review modal so UI immediately displays Home Check stage
      const updatedRow = await adoptionService.getAdoptionById(appId);
      if (updatedRow) {
        setSelectedAdoption(updatedRow);
      }

      notifyDataChanged();
    } catch (err: any) {
      const errorMsg = extractErrorMessage(err, "Failed to schedule visit.");
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteInterview = async (appId: string) => {
    try {
      setIsSubmitting(true);
      await adoptionService.updateAdoptionDetails(appId, {
        interview_completed_at: new Date().toISOString(),
        interview_notes: "Applicant interview call completed.",
      });
      addToast("Interview completed successfully!", "success");
      await fetchAdoptions();
      const updatedRow = await adoptionService.getAdoptionById(appId);
      if (updatedRow) {
        setSelectedAdoption(updatedRow);
      }
      notifyDataChanged();
    } catch (err: any) {
      const errorMsg = extractErrorMessage(err, "Failed to complete interview.");
      addToast(errorMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdoption?.id) return;

    const env = Number(scoreForm.home_environment_score);
    const know = Number(scoreForm.pet_care_knowledge_score);
    const fin = Number(scoreForm.financial_readiness_score);
    const life = Number(scoreForm.lifestyle_compatibility_score);

    if ([env, know, fin, life].some((val) => isNaN(val) || val < 1 || val > 5)) {
      addToast("Please provide valid evaluation scores between 1 and 5 for all criteria.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await adoptionService.addCandidateScore(String(selectedAdoption.id), {
        ...scoreForm,
        home_environment_score: env,
        pet_care_knowledge_score: know,
        financial_readiness_score: fin,
        lifestyle_compatibility_score: life,
      });
      addToast("Candidate evaluation scores saved successfully!", "success");
      setIsScoreModalOpen(false);
      fetchAdoptions();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to save candidate scores.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    const targetApp = adoptions.find((a) => String(a.id) === appId);
    const currentStatus = String(targetApp?.status || selectedAdoption?.status || "").toLowerCase();

    // Valid OpenAPI transition pipeline sequence
    const validTransitions: Record<string, string[]> = {
      submitted: ["screening", "rejected"],
      screening: ["interview", "rejected"],
      interview: ["home_check", "rejected"],
      home_check: ["approved", "rejected"],
      approved: ["completed", "rejected"],
      vetting: ["screening", "interview", "rejected"],
    };

    const allowed = validTransitions[currentStatus];
    if (allowed && !allowed.includes(newStatus)) {
      addToast(
        `Cannot transition application from '${currentStatus || "unknown"}' to '${newStatus}'. Please follow the backend adoption pipeline sequence.`,
        "error"
      );
      return;
    }

    if (newStatus === "approved") {
      const targetDogId = String(targetApp?.dog_id || targetApp?.petId || "");
      if (targetDogId) {
        const existingClaimed = adoptions.find(
          (a) =>
            String(a.dog_id || a.petId) === targetDogId &&
            String(a.id) !== appId &&
            ["approved", "completed"].includes(String(a.status).toLowerCase())
        );
        if (existingClaimed) {
          addToast(
            `Cannot approve: Dog is already claimed by approved application (App ID: ${String(existingClaimed.id).slice(0, 8)}).`,
            "error"
          );
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      await adoptionService.updateAdoptionStatus(appId, newStatus);

      // If application is approved, update dog master profile and automatically provision Companion Pet profile
      if (newStatus === "approved") {
        const dogIdToUpdate = String(targetApp?.dog_id || targetApp?.petId || selectedAdoption?.dog_id || selectedAdoption?.petId || "");
        if (dogIdToUpdate) {
          await petService.updatePet(dogIdToUpdate, {
            status: "adopted",
            is_adoptable: false,
            adoption_status: "Approved",
          }).catch(() => null);
        }

        // Automatically provision Companion Pet record & safety tag in backend upon approval
        try {
          const compRes = await adoptionService.createCompanionPetFromAdoption(appId);
          const compData = compRes?.data || compRes || {};
          const compPetId = compData.id || compData.pet_id || compData.companion_pet_id;
          if (compPetId) {
            await petService.provisionCompanionPetSafetyTag(String(compPetId)).catch(() => null);
          }
        } catch {
          // Ignore if companion pet already exists or backend handles creation automatically
        }
      }

      addToast(`Adoption application approved and completed successfully!`, "success");
      await fetchAdoptions();
      notifyDataChanged();
      setSelectedAdoption((prev) => {
        if (prev && String(prev.id) === appId) {
          return { ...prev, status: newStatus };
        }
        return prev;
      });
      if (newStatus === "approved" || newStatus === "rejected") {
        setIsDetailsModalOpen(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.detail || err?.message || "Failed to update application status.";
      addToast(`⚠️ ${msg}`, "error");
      await fetchAdoptions();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAdoption?.id) return;
    try {
      setIsSubmitting(true);
      await adoptionService.deleteAdoption(String(selectedAdoption.id));
      addToast("Adoption record soft deleted.", "success");
      setIsDeleteModalOpen(false);
      fetchAdoptions();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to delete record.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInspectModal = async (row: Record<string, unknown>) => {
    setSelectedAdoption(row);
    setIsDetailsModalOpen(true);
    try {
      const scoresRes = await adoptionService.getCandidateScores(String(row.id));
      setCandidateScores(scoresRes?.data || scoresRes || []);
    } catch {
      setCandidateScores([]);
    }
  };

  const openQrModal = async (dog: Record<string, unknown> | null) => {
    if (!dog) return;
    const id = String(dog.dog_id || dog.id || "");
    if (!id) return;

    setQrImageUrl(null);
    setIsQrModalOpen(true);

    try {
      setQrLoading(true);
      const qrBlobData = await petService.getDogQrImage(id);
      const qrUrlData = URL.createObjectURL(qrBlobData);
      setQrImageUrl(qrUrlData);
    } catch {
      // Quiet fail for QR generation
    } finally {
      setQrLoading(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "id",
      title: "App ID",
      render: (_v, row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{String(row.id || "").slice(0, 8)}</span>,
    },
    {
      key: "applicantName",
      title: "Applicant",
      render: (_v, row) => (
        <div>
          <strong>{String(row.applicantName || "—")}</strong>
          <div style={{ fontSize: "11px", color: "#64748B" }}>{String(row.applicantEmail || "")}</div>
        </div>
      ),
    },
    {
      key: "petName",
      title: "Rescue Dog",
      render: (_v, row) => (
        <div>
          <strong>{String(row.petName || "—")}</strong>
          <div style={{ fontSize: "11px", color: "#64748B" }}>{String(row.petBreed || "Canine")}</div>
        </div>
      ),
    },
    {
      key: "status",
      title: "Stage & Status",
      render: (_v, row) => <StatusBadge status={String(row.status || "")} />,
    },
    {
      key: "date",
      title: "Applied Date",
      render: (_v, row) => <span>{row.date ? formatDateTime(String(row.date)) : "—"}</span>,
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Adoption Operations Suite</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Process adoption questionnaires, score candidates, verify home environments, execute legal contracts, and convert adopted dogs to companion pets.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="create_adoptions">
          <QuickActionCard icon={<FaPlus />} title="New Application" subtitle="Register applicant" color="#2563EB" onClick={() => setIsNewModalOpen(true)} />
        </Can>
        <Can permission="edit_adoptions">
          <QuickActionCard icon={<FaHome />} title="Schedule Home Inspection" subtitle="Assign field visit" color="#10B981" onClick={() => setActiveTab("queue")} />
        </Can>
        <Can permission="edit_adoptions">
          <QuickActionCard icon={<FaStar />} title="Score Candidates" subtitle="Evaluate match" color="#F59E0B" onClick={() => setActiveTab("scoring")} />
        </Can>
        <Can permission="approve_adoptions">
          <QuickActionCard icon={<FaCheckDouble />} title="Completed Roster" subtitle="View finalized adoptions" color="#6366F1" onClick={() => setActiveTab("completed")} />
        </Can>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #E2E8F0" }}>
        <button
          onClick={() => setActiveTab("queue")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "queue" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "queue" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Applications Queue &amp; Review ({adoptions.length})
        </button>
        <button
          onClick={() => setActiveTab("scoring")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "scoring" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "scoring" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Candidate Evaluation &amp; Scoring
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "completed" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "completed" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Completed Adoptions &amp; Companion Pets ({completedCount})
        </button>
      </div>

      {activeTab === "queue" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Adoption Applications Directory
            </h3>
            {loading && <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>Loading...</span>}
          </div>

          <DataTable
            columns={columns}
            data={paginatedAdoptions}
            module="adoptions"
            serverMode={true}
            totalCount={filteredAdoptions.length}
            page={page}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            searchValue={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            leftHeaderControls={
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="all">All Stages</option>
                <option value="submitted">Submitted</option>
                <option value="vetting">Vetting</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="home_check">Home Visit</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            }
            onRowClick={(row) => void openInspectModal(row)}
            onDelete={(row) => {
              setSelectedAdoption(row);
              setIsDeleteModalOpen(true);
            }}
            renderRowActions={(row: Record<string, unknown>) => {
              const rowId = String(row.id);
              const isOpen = activeMenuId === rowId;
              const statusStr = String(row.status || "").toLowerCase();

              return (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isOpen ? null : rowId);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      color: "#64748B",
                      cursor: "pointer",
                      fontSize: "15px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Actions"
                  >
                    <FaEllipsisV />
                  </button>

                  {isOpen && (
                    <>
                      <div
                        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          marginTop: "4px",
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
                          zIndex: 100,
                          minWidth: "150px",
                          padding: "4px 0",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusStr === "submitted" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              void handleStatusChange(rowId, "screening");
                            }}
                            style={menuItemStyle}
                          >
                            <FaUserCheck style={{ marginRight: "8px", color: "#2563EB" }} /> Start Screening
                          </button>
                        )}

                        {statusStr === "screening" && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                void handleStatusChange(rowId, "interview");
                              }}
                              style={menuItemStyle}
                            >
                              <FaUserCheck style={{ marginRight: "8px", color: "#2563EB" }} /> Start Interview
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                setSelectedAdoption(row);
                                setIsScoreModalOpen(true);
                              }}
                              style={menuItemStyle}
                            >
                              <FaStar style={{ marginRight: "8px", color: "#64748B" }} /> Score
                            </button>
                          </>
                        )}

                        {statusStr === "interview" && (
                          <>
                            {!row.interview_completed_at ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  void handleCompleteInterview(rowId);
                                }}
                                style={menuItemStyle}
                              >
                                <FaUserCheck style={{ marginRight: "8px", color: "#2563EB" }} /> Complete Interview
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                  setSelectedAdoption(row);
                                  setIsScheduleModalOpen(true);
                                }}
                                style={menuItemStyle}
                              >
                                <FaHome style={{ marginRight: "8px", color: "#10B981" }} /> Schedule Home Visit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                setSelectedAdoption(row);
                                setIsScoreModalOpen(true);
                              }}
                              style={menuItemStyle}
                            >
                              <FaStar style={{ marginRight: "8px", color: "#64748B" }} /> Score
                            </button>
                          </>
                        )}

                        {statusStr === "home_check" && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                void handleStatusChange(rowId, "approved");
                              }}
                              style={{ ...menuItemStyle, color: "#059669" }}
                            >
                              <FaCheckDouble style={{ marginRight: "8px", color: "#059669" }} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                setSelectedAdoption(row);
                                setIsScoreModalOpen(true);
                              }}
                              style={menuItemStyle}
                            >
                              <FaStar style={{ marginRight: "8px", color: "#64748B" }} /> Score
                            </button>
                          </>
                        )}

                        {statusStr !== "approved" && statusStr !== "completed" && statusStr !== "rejected" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              void handleStatusChange(rowId, "rejected");
                            }}
                            style={{ ...menuItemStyle, color: "#DC2626" }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            }}
          />
        </div>
      )}

      {activeTab === "scoring" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Candidate Readiness &amp; Scoring Station
          </h3>
          <p style={{ color: "#64748B", fontSize: "14px", marginBottom: "20px" }}>
            Score applicants on home environment safety, pet care knowledge, financial readiness, and lifestyle compatibility.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {adoptions.map((app) => (
              <div key={String(app.id)} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: "#0F172A" }}>
                    {String(app.applicantName)} &bull; Pet: {String(app.petName)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                    Housing: {String(app.residential_status)} &bull; Yard Fence: {app.has_yard_fence ? "Yes" : "No"} &bull; Landlord Approval: {app.has_landlord_approval ? "Yes" : "No"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedAdoption(app);
                    setIsScoreModalOpen(true);
                  }}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#F59E0B", color: "#FFF", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <FaStar /> Score Candidate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "completed" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Completed Adoptions &amp; Companion Pets Roster
          </h3>

          {adoptions.filter((a) => String(a.status).toLowerCase() === "completed").length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B" }}>
              <FaDog size={36} color="#CBD5E1" style={{ marginBottom: "12px" }} />
              <div>No finalized companion pet adoptions logged.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {adoptions.filter((a) => String(a.status).toLowerCase() === "completed").map((app) => (
                <div key={String(app.id)} style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "16px", color: "#065F46" }}>
                      {String(app.petName)} &bull; Adopted by {String(app.applicantName)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#047857", marginTop: "4px" }}>
                      Completed Date: {app.completed_at ? formatDateTime(String(app.completed_at)) : "Finalized"} &bull; Fee Amount: ${String(app.fee_amount || 150)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => void openQrModal(app.dog as any)}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #059669", background: "#FFF", color: "#059669", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                    >
                      Safety Tag QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Application Modal */}
      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Register Adoption Application">
        <form onSubmit={handleNewAppSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Select Rescue Dog *</label>
            <select required value={newAppForm.dog_id} onChange={(e) => setNewAppForm({ ...newAppForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Residential Status</label>
              <select value={newAppForm.residential_status} onChange={(e) => setNewAppForm({ ...newAppForm, residential_status: e.target.value })} style={inputStyle}>
                <option value="owned">Owned Home</option>
                <option value="rented">Rented Apartment / House</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Household Members</label>
              <input type="number" min="1" max="15" value={newAppForm.household_members_count} onChange={(e) => setNewAppForm({ ...newAppForm, household_members_count: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Landlord Approval</label>
              <select value={newAppForm.has_landlord_approval ? "true" : "false"} onChange={(e) => setNewAppForm({ ...newAppForm, has_landlord_approval: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Yes (Approved)</option>
                <option value="false">No / N/A</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Fenced Yard</label>
              <select value={newAppForm.has_yard_fence ? "true" : "false"} onChange={(e) => setNewAppForm({ ...newAppForm, has_yard_fence: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Yes (Secure Fence)</option>
                <option value="false">No Fence</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Pet Care Experience</label>
            <textarea value={newAppForm.pet_care_experience} onChange={(e) => setNewAppForm({ ...newAppForm, pet_care_experience: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsNewModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Registering..." : "Submit Application"}</button>
          </div>
        </form>
      </Modal>

      {/* Details Inspect Modal */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Adoption Application Review — ${selectedAdoption?.applicantName || "Applicant"}`} maxWidth="720px" zIndex={1000}>
        {selectedAdoption && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  {String(selectedAdoption.applicantName)} &bull; {String(selectedAdoption.petName)}
                </h2>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  App ID: <span style={{ fontFamily: "monospace" }}>{String(selectedAdoption.id)}</span> &bull; Submitted: {formatDateTime(String(selectedAdoption.date || selectedAdoption.created_at))}
                </div>
              </div>
              <StatusBadge status={String(selectedAdoption.status || "")} />
            </div>

            {/* Double-Approval Concurrency Safeguard Warning */}
            {(() => {
              const dogId = String(selectedAdoption.dog_id || selectedAdoption.petId || "");
              const existingClaimed = dogId
                ? adoptions.find(
                    (a) =>
                      String(a.dog_id || a.petId) === dogId &&
                      String(a.id) !== String(selectedAdoption.id) &&
                      ["approved", "completed"].includes(String(a.status).toLowerCase())
                  )
                : null;
              if (existingClaimed) {
                return (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "12px", color: "#991B1B", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FaExclamationTriangle size={18} />
                    <div>
                      <strong>Concurrency Notice:</strong> This dog is already claimed by an approved/completed application (App ID: <code>{String(existingClaimed.id).slice(0, 8)}</code>, Adopter: {String(existingClaimed.applicantName)}). Double approval is restricted.
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Applicant Details</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  Name: {String(selectedAdoption.applicantName)}
                </div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  Email: {String(selectedAdoption.applicantEmail || "—")} &bull; Phone: {String(selectedAdoption.applicantPhone || "—")}
                </div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>Selected Dog</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                  {String(selectedAdoption.petName || "Rescue Dog")} &bull; {String(selectedAdoption.petBreed || "Canine")}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                  Dog ID: <span style={{ fontFamily: "monospace" }}>{String(selectedAdoption.dog_id || selectedAdoption.petId || "—").slice(0, 8).toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Submitted Application Questionnaire</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  Housing Status: {String(selectedAdoption.residential_status || "Owned")}
                </div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  Yard / Fence: {selectedAdoption.has_yard_fence ? "✓ Fenced Yard Available" : "No Fenced Yard"} &bull; Landlord Approval: {selectedAdoption.has_landlord_approval ? "✓ Approved" : "N/A"}
                </div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                  Household Members: {String(selectedAdoption.household_members_count ?? 1)} person(s)
                </div>
              </div>

              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Pet Care Experience &amp; Background</div>
                <div style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                  Experience: <strong>{String(selectedAdoption.pet_care_experience || "None specified")}</strong>
                </div>
                {Boolean(selectedAdoption.existing_pets_medical_details) && (
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                    Existing Pets: {String(selectedAdoption.existing_pets_medical_details)}
                  </div>
                )}
              </div>
            </div>

            {Boolean(selectedAdoption.interview_completed_at) && (
              <div style={{ background: "#F0FDF4", padding: "12px", borderRadius: "8px", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Applicant Interview Record</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#14532D", marginTop: "4px" }}>
                  ✓ Interview Completed: {formatDateTime(String(selectedAdoption.interview_completed_at))}
                </div>
                {Boolean(selectedAdoption.interview_notes) && String(selectedAdoption.interview_notes) !== "—" && (
                  <div style={{ fontSize: "12px", color: "#15803D", marginTop: "4px" }}>
                    Notes: {String(selectedAdoption.interview_notes)}
                  </div>
                )}
              </div>
            )}

            {Boolean(selectedAdoption.home_inspection_scheduled_at) && String(selectedAdoption.status).toLowerCase() !== "submitted" && (
              <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Home Visit Inspection</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  Date: {formatDateTime(String(selectedAdoption.home_inspection_scheduled_at))}
                </div>
                {Boolean(selectedAdoption.home_inspection_notes) && (
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", fontStyle: "italic" }}>
                    Notes: {String(selectedAdoption.home_inspection_notes)}
                  </div>
                )}
              </div>
            )}

            {candidateScores.length > 0 && (
              <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>Logged Candidate Scores &amp; Evaluation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {candidateScores.map((sc, idx) => (
                    <div key={idx} style={{ background: "#FFF", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                      Score: Env({sc.home_environment_score}/5), Knowledge({sc.pet_care_knowledge_score}/5), Finance({sc.financial_readiness_score}/5) &bull; Rec: <strong>{sc.recommendation}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const currentStatus = String(selectedAdoption.status || "").toLowerCase();
              if (currentStatus === "completed" || currentStatus === "rejected") {
                return null;
              }

              return (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                  {currentStatus === "submitted" && (
                    <Can permission={["edit_adoptions", "create_adoptions", "manage_adoptions", "approve_adoptions"]}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleStatusChange(String(selectedAdoption.id), "screening")}
                        style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                      >
                        {isSubmitting ? "Processing..." : "Start Screening"}
                      </button>
                    </Can>
                  )}
                  {currentStatus === "screening" && (
                    <Can permission={["edit_adoptions", "manage_adoptions", "approve_adoptions"]}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleStatusChange(String(selectedAdoption.id), "interview")}
                        style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                      >
                        {isSubmitting ? "Processing..." : "Start Interview"}
                      </button>
                    </Can>
                  )}
                  {currentStatus === "interview" && (
                    <Can permission={["edit_adoptions", "manage_adoptions", "approve_adoptions"]}>
                      {!selectedAdoption.interview_completed_at ? (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleCompleteInterview(String(selectedAdoption.id))}
                          style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                        >
                          {isSubmitting ? "Completing..." : "Complete Interview"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setIsScheduleModalOpen(true);
                          }}
                          style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                        >
                          Schedule Home Visit
                        </button>
                      )}
                    </Can>
                  )}
                  {currentStatus === "home_check" && (
                    <Can permission={["approve_adoptions", "manage_adoptions"]}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleStatusChange(String(selectedAdoption.id), "approved")}
                        style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                      >
                        {isSubmitting ? "Approving..." : "Approve Application"}
                      </button>
                    </Can>
                  )}
                  {currentStatus !== "approved" && currentStatus !== "completed" && (
                    <Can permission={["edit_adoptions", "manage_adoptions", "approve_adoptions"]}>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleStatusChange(String(selectedAdoption.id), "rejected")}
                        style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
                      >
                        {isSubmitting ? "Rejecting..." : "Reject"}
                      </button>
                    </Can>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Schedule Home Visit Modal */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="Schedule Home Visit (Home Verification)" zIndex={1100}>
        <form onSubmit={handleScheduleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            Schedule a home visit (home verification / inspection) for applicant <strong>{String(selectedAdoption?.applicantName || "Applicant")}</strong>.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Preferred Date *</label>
              <input type="date" required value={scheduleForm.date} onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Preferred Time *</label>
              <input type="time" required value={scheduleForm.time} onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Session Notes (Optional)</label>
            <textarea placeholder="e.g. Verify yard fencing, family interaction, or landlord approval..." value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsScheduleModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background: isSubmitting ? "#94A3B8" : "#2563EB",
                color: "#FFF",
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Scheduling..." : "Confirm Schedule"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Score Candidate Modal */}
      <Modal isOpen={isScoreModalOpen} onClose={() => setIsScoreModalOpen(false)} title="Score Candidate Evaluation" zIndex={1100}>
        <form onSubmit={handleScoreSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>
            Log evaluation scores (1 to 5) for candidate <strong>{String(selectedAdoption?.applicantName || "Applicant")}</strong>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Home Environment (1-5)</label>
              <input type="number" min="1" max="5" required value={scoreForm.home_environment_score} onChange={(e) => setScoreForm({ ...scoreForm, home_environment_score: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Pet Care Knowledge (1-5)</label>
              <input type="number" min="1" max="5" required value={scoreForm.pet_care_knowledge_score} onChange={(e) => setScoreForm({ ...scoreForm, pet_care_knowledge_score: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Financial Readiness (1-5)</label>
              <input type="number" min="1" max="5" required value={scoreForm.financial_readiness_score} onChange={(e) => setScoreForm({ ...scoreForm, financial_readiness_score: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Lifestyle Match (1-5)</label>
              <input type="number" min="1" max="5" required value={scoreForm.lifestyle_compatibility_score} onChange={(e) => setScoreForm({ ...scoreForm, lifestyle_compatibility_score: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Recommendation</label>
            <input type="text" placeholder="e.g. Recommended for placement after visit" value={scoreForm.recommendation} onChange={(e) => setScoreForm({ ...scoreForm, recommendation: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Evaluation Notes</label>
            <textarea placeholder="Additional evaluator observations (optional)..." value={scoreForm.notes || ""} onChange={(e) => setScoreForm({ ...scoreForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsScoreModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}>{isSubmitting ? "Saving..." : "Save Scores"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Application Record" zIndex={1100}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to soft delete adoption application <strong>{selectedAdoption?.id ? String(selectedAdoption.id).slice(0, 8) : ""}</strong>?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={handleDelete} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600 }}>Delete</button>
          </div>
        </div>
      </Modal>

      {/* Safety Tag QR Modal */}
      <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Safety Tag QR Code" zIndex={1100}>
        <div style={{ textAlign: "center", padding: "16px" }}>
          {qrLoading ? (
            <div>Generating Safety Tag QR Code...</div>
          ) : qrImageUrl ? (
            <div>
              <img src={qrImageUrl} alt="Safety Tag QR" style={{ width: "200px", height: "200px", borderRadius: "8px", margin: "0 auto 16px" }} />
            </div>
          ) : (
            <div>Could not generate QR code.</div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Adoptions;