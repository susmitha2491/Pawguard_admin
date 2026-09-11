import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaHandHoldingHeart,
  FaHome,
  FaDog,
  FaUndo,
  FaClipboardList,
  FaUserPlus,
  FaHeart,
  FaBoxOpen,
  FaHistory,
  FaStethoscope,
  FaInfoCircle,
  FaCalendarAlt,
  FaEnvelope,
  FaExclamationTriangle,
  FaSync,
  FaSearch,
  FaEllipsisV,
  FaClock,
  FaCheckCircle,
  FaArrowRight,
  FaArrowLeft,
} from "react-icons/fa";
import fosterService, {
  type FosterProfileUpdatePayload,
  type FosterPlacementPayload,
  type FosterProgressLogPayload,
  type FosterSupplyDispatchPayload,
} from "../../services/fosterService";
import petService from "../../services/petService";
import vetService from "../../services/vetService";
import storageService from "../../services/storageService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";

export interface FosterProfileRow {
  id: string;
  foster_family: string;
  status: string;
  active_count: number;
  max_capacity: number;
  is_available: boolean;
  preferences?: string;
  notes?: string;
  background_check_passed?: boolean;
  home_inspection_passed?: boolean;
  created_at?: string;
  user?: any;
  raw: any;
  [key: string]: unknown;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
};

const unwrapList = (v: any) =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : [];

const getDurationInCare = (placedAt?: string | null): string | null => {
  if (!placedAt) return null;
  const start = new Date(placedAt).getTime();
  if (isNaN(start)) return null;
  const now = Date.now();
  const diffMs = now - start;
  if (diffMs < 0) return "Placed recently";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Placed today";
  if (days === 1) return "1 day in foster care";
  return `${days} days in foster care`;
};

const getPetPhoto = (dog?: any): string | null => {
  if (!dog) return null;
  if (typeof dog.photo_url === "string" && dog.photo_url.trim()) return dog.photo_url.trim();
  if (Array.isArray(dog.image_urls) && dog.image_urls.length > 0 && typeof dog.image_urls[0] === "string" && dog.image_urls[0].trim()) {
    return dog.image_urls[0].trim();
  }
  if (Array.isArray(dog.photo_gallery_urls) && dog.photo_gallery_urls.length > 0 && typeof dog.photo_gallery_urls[0] === "string" && dog.photo_gallery_urls[0].trim()) {
    return dog.photo_gallery_urls[0].trim();
  }
  return null;
};

const extractBackendErrorMessage = (err: any, fallbackMessage: string): string => {
  if (!err) return fallbackMessage;
  const resData = err?.response?.data;
  if (resData) {
    if (typeof resData.detail === "string" && resData.detail.trim()) {
      return resData.detail.trim();
    }
    if (Array.isArray(resData.detail) && resData.detail.length > 0) {
      return resData.detail
        .map((d: any) => (typeof d === "string" ? d : d?.msg || d?.message || JSON.stringify(d)))
        .join("; ");
    }
    if (typeof resData.message === "string" && resData.message.trim()) {
      return resData.message.trim();
    }
    if (typeof resData.error === "string" && resData.error.trim()) {
      return resData.error.trim();
    }
    if (typeof resData.error?.message === "string" && resData.error.message.trim()) {
      const mainMsg = resData.error.message.trim();
      const extraDetails = typeof resData.error?.details === "string" ? resData.error.details.trim() : "";
      return extraDetails && extraDetails !== mainMsg ? `${mainMsg} (${extraDetails})` : mainMsg;
    }
    if (typeof resData.error?.details === "string" && resData.error.details.trim()) {
      return resData.error.details.trim();
    }
    if (typeof resData.details === "string" && resData.details.trim()) {
      return resData.details.trim();
    }
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return fallbackMessage;
};

interface PlacementActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "normal" | "accent" | "danger";
}

const PlacementActionMenu: React.FC<{ actions: PlacementActionItem[] }> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "6px 12px",
          borderRadius: "6px",
          border: "1px solid #CBD5E1",
          background: isOpen ? "#F1F5F9" : "#FFFFFF",
          color: "#334155",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span>Actions</span> <FaEllipsisV size={11} />
      </button>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            padding: "4px 0",
            minWidth: "185px",
            zIndex: 100,
          }}
        >
          {actions.map((act, idx) => {
            const isDanger = act.variant === "danger";
            const isAccent = act.variant === "accent";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  act.onClick();
                }}
                style={{
                  width: "100%",
                  padding: "8px 14px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: isDanger ? "#DC2626" : isAccent ? "#DB2777" : "#334155",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDanger ? "#FEF2F2" : isAccent ? "#FDF2F8" : "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                {act.icon && <span style={{ fontSize: "13px" }}>{act.icon}</span>}
                {act.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const FosterManagement = () => {
  const isRescueCentreAdmin = getCurrentUserRole() === "rescue_centre_admin";
  const [activeTab, setActiveTab] = useState<"profiles" | "placements">("profiles");
  const [fosters, setFosters] = useState<FosterProfileRow[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Search & Pagination & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(() => searchParams.get("action") === "apply");
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(() => searchParams.get("action") === "place");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnReason, setReturnReason] = useState("Foster Term Completed");

  // Vet Check Modal State
  const [isVetCheckModalOpen, setIsVetCheckModalOpen] = useState(false);
  const [selectedPlacementForVetCheck, setSelectedPlacementForVetCheck] = useState<any | null>(null);
  const [vetCheckForm, setVetCheckForm] = useState({
    urgency: "routine" as "routine" | "urgent" | "emergency",
    reason: "Routine Health Check",
    preferred_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedPlacementForConvert, setSelectedPlacementForConvert] = useState<any | null>(null);
  const [convertNotes, setConvertNotes] = useState("");
  const [convertLegalConfirmed, setConvertLegalConfirmed] = useState(false);
  const [convertConflictError, setConvertConflictError] = useState<string | null>(null);
  const [selectedFoster, setSelectedFoster] = useState<FosterProfileRow | null>(null);

  // Background Check Management State (for Review Modal)
  const [bgCheckProvider, setBgCheckProvider] = useState("PawGuard Registry");
  const [bgCheckInitiateNotes, setBgCheckInitiateNotes] = useState("");
  const [bgCheckOutcome, setBgCheckOutcome] = useState<"cleared" | "flagged" | "rejected" | "">("");
  const [bgCheckOutcomeNotes, setBgCheckOutcomeNotes] = useState("");
  const [isInitiatingBgCheck, setIsInitiatingBgCheck] = useState(false);
  const [bgCheckInitiateError, setBgCheckInitiateError] = useState<string | null>(null);

  // Home Inspection Management State (for Review Modal)
  const [inspectionSubStep, setInspectionSubStep] = useState<"schedule" | "checklist" | "decision">("schedule");
  const [inspectionScheduleForm, setInspectionScheduleForm] = useState({
    scheduled_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    inspector_name: "",
    inspection_type: "physical" as "physical" | "virtual" | string,
    address: "",
    notes: "",
  });
  const [inspectionAuditForm, setInspectionAuditForm] = useState({
    yard_condition: "Secure & Escape-Proof",
    fencing_condition: "High Fence (6ft+)",
    household_info: "Spacious & Pet-Proofed",
    existing_pets_info: "Friendly & Vaccinated",
    hazards: "None identified",
    rating: 5,
    notes: "",
  });
  const [inspectionEvidenceList, setInspectionEvidenceList] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [inspectionOutcomeForm, setInspectionOutcomeForm] = useState({
    outcome: "approved" as "approved" | "rejected",
    notes: "",
  });

  // Application Review Modal State (Sequential 4-Step Flow)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewActiveStep, setReviewActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [rejectReasonText, setRejectReasonText] = useState("");
  const [reviewForm, setReviewForm] = useState({
    max_capacity: 2,
    preferences: "",
    notes: "",
    background_check_passed: false,
    background_check_status: "pending",
    background_check_notes: "",
    references_checked: false,
    reference_notes: "",
    home_inspection_passed: false,
    home_inspection_status: "pending",
    home_inspection_notes: "",
    home_inspection_address: "",
    vetting_notes: "",
    rejection_reason: "",
  });

  const syncReviewStateFromProfile = useCallback((raw: any, existingRow?: FosterProfileRow | null) => {
    if (!raw) return;
    const user = raw.user || existingRow?.user || {};
    const bgPassed =
      raw.background_check_passed !== undefined && raw.background_check_passed !== null
        ? Boolean(raw.background_check_passed)
        : (existingRow?.background_check_passed ?? false);
    const homePassed =
      raw.home_inspection_passed !== undefined && raw.home_inspection_passed !== null
        ? Boolean(raw.home_inspection_passed)
        : (existingRow?.home_inspection_passed ?? false);

    const updatedFoster: FosterProfileRow = {
      ...(existingRow || ({} as any)),
      id: raw.id || existingRow?.id || "",
      foster_family:
        user.full_name ||
        user.name ||
        (user.email ? user.email.split("@")[0] : (existingRow?.foster_family || "Caregiver Applicant")),
      status: String(raw.status || existingRow?.status || "applied"),
      active_count: Number(raw.active_count ?? raw.placements_count ?? existingRow?.active_count ?? 0),
      max_capacity: Number(raw.max_capacity ?? existingRow?.max_capacity ?? 1),
      is_available: raw.is_available !== undefined ? Boolean(raw.is_available) : (existingRow?.is_available ?? true),
      background_check_passed: bgPassed,
      home_inspection_passed: homePassed,
      preferences: raw.preferences || existingRow?.preferences || "",
      notes: raw.notes || existingRow?.notes || "",
      created_at: raw.created_at || existingRow?.created_at,
      user,
      raw,
    };
    setSelectedFoster(updatedFoster);

    setReviewForm({
      max_capacity: Number(raw.max_capacity ?? existingRow?.max_capacity ?? 1),
      preferences: raw.preferences || existingRow?.preferences || "",
      notes: raw.notes || existingRow?.notes || "",
      background_check_passed: bgPassed,
      background_check_status: String(raw.background_check_status || (bgPassed ? "cleared" : "pending")),
      background_check_notes: raw.background_check_notes || "",
      references_checked: Boolean(raw.references_checked),
      reference_notes: raw.reference_notes || "",
      home_inspection_passed: homePassed,
      home_inspection_status: String(raw.home_inspection_status || (homePassed ? "approved" : "pending")),
      home_inspection_notes: raw.home_inspection_notes || "",
      home_inspection_address: raw.home_inspection_address || "",
      vetting_notes: raw.vetting_notes || "",
      rejection_reason: "",
    });

    const details = raw.home_inspection_details || {};
    setInspectionAuditForm({
      yard_condition: details.yard_condition || "Secure & Escape-Proof",
      fencing_condition: details.fencing_condition || "High Fence (6ft+)",
      household_info: details.household_info || "",
      existing_pets_info: details.existing_pets_info || "",
      hazards: details.hazards || "None identified",
      rating: typeof details.rating === "number" ? details.rating : 5,
      notes: details.notes || "",
    });

    const evidence = Array.isArray(details.evidence_urls)
      ? details.evidence_urls
      : Array.isArray(raw.evidence_urls)
      ? raw.evidence_urls
      : [];
    setInspectionEvidenceList(evidence);

    const bgStatusLower = String(raw.background_check_status || "").toLowerCase();
    if (bgStatusLower === "flagged") {
      setBgCheckOutcome("flagged");
    } else if (bgStatusLower === "rejected" || bgStatusLower === "failed") {
      setBgCheckOutcome("rejected");
    } else if (bgPassed || bgStatusLower === "cleared" || bgStatusLower === "passed") {
      setBgCheckOutcome("cleared");
    } else {
      setBgCheckOutcome("");
    }
    setBgCheckOutcomeNotes(raw.background_check_notes || "");

    const homeStatusLower = String(raw.home_inspection_status || "").toLowerCase();
    setInspectionOutcomeForm({
      outcome:
        homePassed || homeStatusLower === "approved" || homeStatusLower === "passed"
          ? "approved"
          : homeStatusLower === "rejected" || homeStatusLower === "failed"
          ? "rejected"
          : "approved",
      notes: raw.home_inspection_notes || "",
    });
  }, []);

  const handleOpenReview = useCallback(async (foster: FosterProfileRow) => {
    setIsDetailModalOpen(false);
    setIsRejectConfirmOpen(false);
    setRejectReasonText("");
    setReviewActiveStep(1);
    setBgCheckInitiateError(null);
    let raw = foster.raw || {};
    try {
      const res = await fosterService.getFosterProfile(foster.id);
      if (res) {
        raw = res.data || res;
      }
    } catch {
      // fallback to row data if single fetch fails
    }
    syncReviewStateFromProfile(raw, foster);
    setBgCheckProvider("PawGuard Registry");
    setBgCheckInitiateNotes("");
    setInspectionScheduleForm({
      scheduled_at: raw.inspected_at
        ? new Date(raw.inspected_at).toISOString().slice(0, 16)
        : new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      inspector_name: "PawGuard Field Officer",
      inspection_type: "physical",
      address: raw.home_inspection_address || "",
      notes: raw.home_inspection_notes || "",
    });

    const homePassed = Boolean(raw.home_inspection_passed ?? foster.home_inspection_passed);
    const homeStatusLower = String(raw.home_inspection_status || "").toLowerCase();
    if (homePassed || homeStatusLower === "approved" || homeStatusLower === "rejected") {
      setInspectionSubStep("decision");
    } else if (homeStatusLower === "scheduled" || homeStatusLower === "in_progress") {
      setInspectionSubStep("checklist");
    } else {
      setInspectionSubStep("schedule");
    }
    setIsReviewModalOpen(true);
  }, [syncReviewStateFromProfile]);

  const handleInitiateBackgroundCheck = async () => {
    if (!selectedFoster) return;
    try {
      setIsInitiatingBgCheck(true);
      setIsSubmitting(true);
      setBgCheckInitiateError(null);
      const res = await fosterService.initiateBackgroundCheck(selectedFoster.id, {
        provider: bgCheckProvider,
        notes: bgCheckInitiateNotes.trim() || undefined,
      });
      // 1. Refetch GET /api/v1/fosters/{profile_id}
      let rawProfile = res?.data || res;
      try {
        const refreshed = await fosterService.getFosterProfile(selectedFoster.id);
        if (refreshed) {
          rawProfile = refreshed.data || refreshed;
        }
      } catch {
        // Fallback to res if getFosterProfile fails
      }
      // 2. Update UI strictly from backend profile response
      syncReviewStateFromProfile(rawProfile, selectedFoster);
      addToast(`Background check initiated with ${bgCheckProvider}!`, "success");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Background check could not be initiated. Please try again.");
      setBgCheckInitiateError(msg);
      addToast(msg, "error");
    } finally {
      setIsInitiatingBgCheck(false);
      setIsSubmitting(false);
    }
  };

  const handleSaveBackgroundCheckOutcome = async () => {
    if (!selectedFoster) return;
    if (!bgCheckOutcome) {
      addToast("Please select a verification outcome (Cleared, Flagged, or Rejected).", "error");
      return;
    }
    if ((bgCheckOutcome === "flagged" || bgCheckOutcome === "rejected") && !bgCheckOutcomeNotes.trim()) {
      addToast("Notes are mandatory when marking Background Check as Flagged or Rejected.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fosterService.recordBackgroundCheckOutcome(selectedFoster.id, {
        outcome: bgCheckOutcome,
        notes: bgCheckOutcomeNotes.trim() || "Background check outcome recorded.",
        references_checked: reviewForm.references_checked,
        reference_notes: reviewForm.reference_notes || undefined,
      });
      // 1. Refetch GET /api/v1/fosters/{profile_id}
      let rawProfile = res?.data || res;
      try {
        const refreshed = await fosterService.getFosterProfile(selectedFoster.id);
        if (refreshed) {
          rawProfile = refreshed.data || refreshed;
        }
      } catch {
        // Fallback to res if getFosterProfile fails
      }
      // 2. Update UI strictly from backend profile response
      syncReviewStateFromProfile(rawProfile, selectedFoster);
      addToast(`Background check outcome recorded as: ${bgCheckOutcome.toUpperCase()}`, "success");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to record background check outcome.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleHomeInspection = async () => {
    if (!selectedFoster) return;
    if (!inspectionScheduleForm.scheduled_at) {
      addToast("Inspection scheduled date/time is required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fosterService.scheduleHomeInspection(selectedFoster.id, {
        scheduled_at: new Date(inspectionScheduleForm.scheduled_at).toISOString(),
        inspector_name: inspectionScheduleForm.inspector_name.trim() || undefined,
        inspection_type: inspectionScheduleForm.inspection_type,
        address: inspectionScheduleForm.address.trim() || reviewForm.home_inspection_address || undefined,
        notes: inspectionScheduleForm.notes.trim() || undefined,
      });
      const updatedData = res?.data || res;
      syncReviewStateFromProfile(updatedData, selectedFoster);
      addToast("Home inspection successfully scheduled!", "success");
      setInspectionSubStep("checklist");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to schedule home inspection.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveHomeInspectionAudit = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      const res = await fosterService.logHomeInspectionAudit(selectedFoster.id, {
        yard_condition: inspectionAuditForm.yard_condition,
        fencing_condition: inspectionAuditForm.fencing_condition,
        household_info: inspectionAuditForm.household_info,
        existing_pets_info: inspectionAuditForm.existing_pets_info,
        hazards: inspectionAuditForm.hazards,
        rating: inspectionAuditForm.rating,
        evidence_urls: inspectionEvidenceList,
        notes: inspectionAuditForm.notes,
      });
      const updatedData = res?.data || res;
      syncReviewStateFromProfile(updatedData, selectedFoster);
      addToast("Home inspection audit checklist saved!", "success");
      setInspectionSubStep("decision");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to save inspection audit.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadInspectionEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFoster) return;
    const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowed.includes(file.type)) {
      addToast("Invalid file type. Only JPEG, PNG, and PDF are allowed.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast("File size exceeds 10MB limit.", "error");
      return;
    }
    try {
      setIsUploadingEvidence(true);
      const url = await storageService.uploadFile(file, {
        folder: "foster_inspections",
        entity_type: "foster_profile",
        entity_id: selectedFoster.id,
      });
      const updatedEvidence = [...inspectionEvidenceList, url];
      setInspectionEvidenceList(updatedEvidence);

      // Save updated evidence array to backend audit log
      const res = await fosterService.logHomeInspectionAudit(selectedFoster.id, {
        yard_condition: inspectionAuditForm.yard_condition,
        fencing_condition: inspectionAuditForm.fencing_condition,
        household_info: inspectionAuditForm.household_info,
        existing_pets_info: inspectionAuditForm.existing_pets_info,
        hazards: inspectionAuditForm.hazards,
        rating: inspectionAuditForm.rating,
        evidence_urls: updatedEvidence,
        notes: inspectionAuditForm.notes,
      });
      const updatedData = res?.data || res;
      syncReviewStateFromProfile(updatedData, selectedFoster);

      addToast("Inspection evidence file uploaded and saved!", "success");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to upload inspection evidence.");
      addToast(msg, "error");
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = "";
    }
  };

  const handleSaveHomeInspectionOutcome = async () => {
    if (!selectedFoster) return;
    if (inspectionOutcomeForm.outcome === "rejected" && !inspectionOutcomeForm.notes.trim()) {
      addToast("Notes/Reason are mandatory when rejecting a Home Inspection.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await fosterService.recordHomeInspectionOutcome(selectedFoster.id, {
        outcome: inspectionOutcomeForm.outcome,
        notes: inspectionOutcomeForm.notes.trim() || "Home inspection completed.",
        address: reviewForm.home_inspection_address || undefined,
      });
      const updatedData = res?.data || res;
      syncReviewStateFromProfile(updatedData, selectedFoster);
      addToast(`Home inspection outcome recorded: ${inspectionOutcomeForm.outcome.toUpperCase()}!`, "success");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to save inspection outcome.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenVetCheckModal = (placement: any) => {
    setSelectedPlacementForVetCheck(placement);
    setVetCheckForm({
      urgency: "routine",
      reason: "Routine Health Check",
      preferred_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setIsVetCheckModalOpen(true);
  };

  const handleConfirmVetCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacementForVetCheck) return;
    const placementId = String(selectedPlacementForVetCheck.id || selectedPlacementForVetCheck.placement_id || "");
    const dogId = String(selectedPlacementForVetCheck.dog_id || selectedPlacementForVetCheck.dog?.id || "");
    if (!placementId) {
      addToast("Invalid placement ID for vet check request.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.requestVetCheck(placementId, {
        urgency: vetCheckForm.urgency,
        reason: vetCheckForm.reason,
        preferred_date: vetCheckForm.preferred_date ? new Date(vetCheckForm.preferred_date).toISOString() : new Date().toISOString(),
        notes: vetCheckForm.notes,
      });
      if (dogId) {
        await vetService.bookAppointment({
          pet_id: dogId,
          appointment_type: `Foster Vet Check: ${vetCheckForm.reason} (${vetCheckForm.urgency.toUpperCase()})`,
          notes: vetCheckForm.notes || `Requested by Foster Coordinator for caregiver ${selectedPlacementForVetCheck.foster_family || ""}.`,
          scheduled_at: vetCheckForm.preferred_date ? new Date(vetCheckForm.preferred_date).toISOString() : new Date().toISOString(),
        }).catch(() => null);
      }
      addToast("Veterinary check request registered and dispatched to Veterinary Clinic!", "success");
      setIsVetCheckModalOpen(false);
      setSelectedPlacementForVetCheck(null);
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to register veterinary check request.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReturnModal = (placement: any) => {
    setSelectedPlacement(placement);
    setReturnReason("Foster Term Completed");
    setReturnNotes(`Foster stay completed successfully. Returning animal to shelter facility.`);
    setIsReturnModalOpen(true);
  };

  const handleSaveVettingProgress = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      const res = await fosterService.updateProfile(selectedFoster.id, {
        max_capacity: Number(reviewForm.max_capacity),
        preferences: reviewForm.preferences,
        notes: reviewForm.notes,
        background_check_passed: reviewForm.background_check_passed,
        background_check_notes: reviewForm.background_check_notes,
        references_checked: reviewForm.references_checked,
        reference_notes: reviewForm.reference_notes,
        home_inspection_passed: reviewForm.home_inspection_passed,
        home_inspection_notes: reviewForm.home_inspection_notes,
        home_inspection_address: reviewForm.home_inspection_address,
        vetting_notes: reviewForm.vetting_notes,
      });
      const updatedData = res?.data || res;
      syncReviewStateFromProfile(updatedData, selectedFoster);
      addToast("Vetting progress saved successfully!", "success");
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to save vetting progress.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      // Persist latest review fields to profile
      await fosterService.updateProfile(selectedFoster.id, {
        max_capacity: Number(reviewForm.max_capacity),
        preferences: reviewForm.preferences,
        notes: reviewForm.notes,
        background_check_passed: reviewForm.background_check_passed,
        background_check_notes: reviewForm.background_check_notes,
        references_checked: reviewForm.references_checked,
        reference_notes: reviewForm.reference_notes,
        home_inspection_passed: reviewForm.home_inspection_passed,
        home_inspection_notes: reviewForm.home_inspection_notes,
        home_inspection_address: reviewForm.home_inspection_address,
        vetting_notes: reviewForm.vetting_notes,
      }).catch(() => null);

      await fosterService.approveProfile(selectedFoster.id);
      addToast(`Approved ${selectedFoster.foster_family} as an active Foster Caregiver!`, "success");
      setIsReviewModalOpen(false);
      setSelectedFoster(null);
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to approve foster profile.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      const reasonText =
        rejectReasonText.trim() ||
        reviewForm.rejection_reason.trim() ||
        reviewForm.vetting_notes.trim() ||
        reviewForm.notes.trim() ||
        "Application rejected by coordinator";
      await fosterService.rejectProfile(selectedFoster.id, {
        reason: reasonText,
        rejection_reason: reasonText,
        notes: reviewForm.notes || reviewForm.vetting_notes,
        vetting_notes: reviewForm.vetting_notes,
        status: "rejected",
      });
      addToast(`Rejected application for ${selectedFoster.foster_family}.`, "info");
      setIsReviewModalOpen(false);
      setIsRejectConfirmOpen(false);
      setSelectedFoster(null);
      await fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to reject foster application.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  const [selectedPlacement, setSelectedPlacement] = useState<any | null>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [suppliesList, setSuppliesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [applyForm, setApplyForm] = useState({
    preferences: "Dogs only, Medium size",
    max_capacity: 2,
    notes: "",
  });

  const [placeForm, setPlaceForm] = useState<FosterPlacementPayload>({
    dog_id: "",
    notes: "",
  });
  const [placeTargetProfileId, setPlaceTargetProfileId] = useState("");

  const [editForm, setEditForm] = useState<FosterProfileUpdatePayload & { id: string }>({
    id: "",
    status: "approved",
    is_available: true,
    max_capacity: 2,
    preferences: "",
    notes: "",
    background_check_passed: true,
    home_inspection_passed: true,
  });

  const [progressForm, setProgressForm] = useState<FosterProgressLogPayload>({
    weight_kg: undefined,
    behavior_notes: "",
    feeding_notes: "",
    medication_notes: "",
    mood_rating: 5,
    notes: "",
  });

  const openLogProgressModal = (placement: any) => {
    setSelectedPlacement(placement);
    setProgressForm({
      weight_kg: undefined,
      behavior_notes: "",
      feeding_notes: "",
      medication_notes: "",
      mood_rating: 5,
      notes: "",
    });
    setIsProgressModalOpen(true);
  };

  const [supplyForm, setSupplyForm] = useState<FosterSupplyDispatchPayload>({
    item_type: "food",
    description: "20lb Bag of Canine Food",
    quantity: 1,
  });

  const [dogsMap, setDogsMap] = useState<Map<string, any>>(new Map());
  const [activePlacements, setActivePlacements] = useState<any[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);
  const [placementSearchQuery, setPlacementSearchQuery] = useState("");

  const [isPlacementDetailModalOpen, setIsPlacementDetailModalOpen] = useState(false);
  const [selectedPlacementDetail, setSelectedPlacementDetail] = useState<any | null>(null);
  const [placementProgressLogs, setPlacementProgressLogs] = useState<any[]>([]);
  const [placementSuppliesList, setPlacementSuppliesList] = useState<any[]>([]);
  const [placementDetailLoading, setPlacementDetailLoading] = useState(false);

  const fostersRef = useRef<FosterProfileRow[]>([]);
  useEffect(() => {
    fostersRef.current = fosters;
  }, [fosters]);

  const fetchPlacements = useCallback(async (fosterProfiles?: FosterProfileRow[]) => {
    try {
      setPlacementsLoading(true);
      setPlacementsError(null);
      const res = await fosterService.getFosterPlacements({ page_size: 100 });
      const list = unwrapList(res);
      const currentProfiles = fosterProfiles && fosterProfiles.length > 0 ? fosterProfiles : fostersRef.current;
      const profilesMap = new Map<string, FosterProfileRow>();
      currentProfiles.forEach((f) => profilesMap.set(f.id, f));

      const allPlacements: any[] = [];
      list.forEach((p: any) => {
        if (p.is_active || p.status === "active" || (!p.returned_at && p.status !== "converted_to_adopt" && p.status !== "returned")) {
          const fosterObj = p.foster || {};
          const fId = String(p.foster_id || p.profile_id || fosterObj.id || "");
          const matchingProfile = profilesMap.get(fId);
          const fosterUser = matchingProfile?.user || fosterObj.user || {};
          const familyName =
            matchingProfile?.foster_family ||
            p.foster_name ||
            fosterUser.full_name ||
            fosterUser.name ||
            fosterUser.email ||
            "Foster Caregiver";

          allPlacements.push({
            ...p,
            foster_family: familyName,
            profile_id: fId,
            background_check_passed: matchingProfile ? matchingProfile.background_check_passed : Boolean(fosterObj.background_check_passed),
            home_inspection_passed: matchingProfile ? matchingProfile.home_inspection_passed : Boolean(fosterObj.home_inspection_passed),
            caregiver_email: fosterUser.email || "",
            caregiver_phone: fosterUser.phone || "",
            caregiver_raw: matchingProfile?.raw || fosterObj,
          });
        }
      });
      setActivePlacements(allPlacements);
    } catch (err: any) {
      setPlacementsError(
        err?.response?.data?.detail || err?.response?.data?.message || "Failed to load active foster placements."
      );
    } finally {
      setPlacementsLoading(false);
    }
  }, []);

  const fetchFosters = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await fosterService.getFosterProfiles();
      const list = unwrapList(response);

      const formatted: FosterProfileRow[] = list.map((item: any) => {
        const user = item.user || {};
        const name = user.full_name || user.name || user.email || item.foster_name || item.id || "Foster Parent";
        return {
          id: String(item.id || item.profile_id || ""),
          foster_family: String(name),
          status: String(item.status || "applied"),
          active_count: Number(item.active_count ?? item.placements_count ?? 0),
          max_capacity: Number(item.max_capacity ?? 1),
          is_available: item.is_available !== undefined ? Boolean(item.is_available) : true,
          preferences: item.preferences || "",
          notes: item.notes || "",
          background_check_passed: Boolean(item.background_check_passed),
          home_inspection_passed: Boolean(item.home_inspection_passed),
          created_at: item.created_at || item.date || item.updated_at || "",
          user,
          raw: item,
        };
      });

      formatted.sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setFosters(formatted);
      await fetchPlacements(formatted);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load foster profiles.");
    } finally {
      setLoading(false);
    }
  }, [fetchPlacements]);

  const openPlacementDetailModal = async (placement: any) => {
    setSelectedPlacementDetail(placement);
    setIsPlacementDetailModalOpen(true);
    setPlacementDetailLoading(true);
    setPlacementProgressLogs([]);
    setPlacementSuppliesList([]);

    try {
      const placementId = String(placement.id || "");
      const [logsRes, suppRes] = await Promise.allSettled([
        fosterService.getProgressLogs(placementId),
        fosterService.getSupplyDispatches(placementId),
      ]);

      if (logsRes.status === "fulfilled" && logsRes.value) {
        setPlacementProgressLogs(unwrapList(logsRes.value));
      }
      if (suppRes.status === "fulfilled" && suppRes.value) {
        setPlacementSuppliesList(unwrapList(suppRes.value));
      }

      const dogId = String(placement.dog_id || placement.dog?.id || "");
      if (dogId && !placement.dog && !dogsMap.has(dogId)) {
        try {
          const dogData = await petService.getPetById(dogId);
          if (dogData) {
            setDogsMap((prev) => new Map(prev).set(dogId, dogData));
          }
        } catch {
          /* ignore single dog fetch failure */
        }
      }
    } catch {
      /* ignore modal details fetch failure */
    } finally {
      setPlacementDetailLoading(false);
    }
  };

  const fetchDogs = useCallback(async () => {
    try {
      const dogsRes = await petService.getPets({ page_size: 100 });
      const list = unwrapList(dogsRes);
      const map = new Map<string, any>();
      const dogOptions: any[] = [];
      list.forEach((d: any) => {
        const id = String(d.id || d.dog_id || "");
        if (id) map.set(id, d);
        const name = d.name || "Unnamed";
        const parts = [name];
        if (d.rescue_reference) parts.push(`(${d.rescue_reference})`);
        if (d.registration_number) parts.push(`(${d.registration_number})`);
        else if (id) parts.push(`(${id.slice(0, 8)})`);
        dogOptions.push({
          ...d,
          id,
          name,
          label: d.label || parts.join(" "),
        });
      });
      setDogsMap(map);
      setDogs(dogOptions);
    } catch {
      setDogs([]);
    }
  }, []);

  const filteredPlacements = useMemo(() => {
    if (!placementSearchQuery.trim()) return activePlacements;
    const q = placementSearchQuery.toLowerCase();
    return activePlacements.filter((p) => {
      const dogId = String(p.dog_id || p.dog?.id || "");
      const dogObj = p.dog || dogsMap.get(dogId);
      const dogName = String(dogObj?.name || "").toLowerCase();
      const breed = String(dogObj?.breed || "").toLowerCase();
      const family = String(p.foster_family || "").toLowerCase();
      const notes = String(p.notes || "").toLowerCase();
      const pId = String(p.id || "").toLowerCase();
      return (
        dogName.includes(q) ||
        breed.includes(q) ||
        dogId.toLowerCase().includes(q) ||
        family.includes(q) ||
        notes.includes(q) ||
        pId.includes(q)
      );
    });
  }, [activePlacements, placementSearchQuery, dogsMap]);

  const initialMountDone = useRef(false);
  useEffect(() => {
    if (!initialMountDone.current) {
      initialMountDone.current = true;
      fetchFosters();
      fetchDogs();
    }
  }, [fetchFosters, fetchDogs]);

  useEffect(() => {
    const action = searchParams.get("action");
    const profileId = searchParams.get("profileId");
    if (action === "review" && profileId) {
      if (fosters.length > 0) {
        const found = fosters.find((f) => f.id === profileId);
        if (found) {
          handleOpenReview(found);
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
      }
      fosterService.getFosterProfile(profileId).then((res) => {
        const raw = res?.data || res;
        if (raw) {
          const user = raw.user || {};
          handleOpenReview({
            id: profileId,
            foster_family: user.full_name || user.name || user.email || "Caregiver Applicant",
            status: raw.status || "applied",
            active_count: Number(raw.active_count ?? 0),
            max_capacity: Number(raw.max_capacity ?? 1),
            is_available: raw.is_available ?? true,
            raw,
          } as any);
        }
        window.history.replaceState({}, "", window.location.pathname);
      }).catch(() => null);
    } else if (action) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams, fosters, handleOpenReview]);

  // Derived metrics
  const totalActiveHomes = fosters.filter((f) => f.is_available || f.status === "approved").length;
  const totalPetsInFoster = activePlacements.length;
  const totalAvailableSlots = fosters.reduce((sum, f) => sum + Math.max(0, (f.max_capacity || 1) - (f.active_count || 0)), 0);
  const pendingApplicationsCount = fosters.filter((f) => f.status === "applied" || f.status === "pending").length;

  const filteredFosters = useMemo(() => {
    return fosters.filter((f) => {
      const matchesStatus = statusFilter === "all" || f.status.toLowerCase() === statusFilter.toLowerCase();
      if (!matchesStatus) return false;

      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      const searchable = [
        f.id,
        f.foster_family,
        f.status,
        f.preferences || "",
        f.notes || "",
        f.user?.email || "",
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [fosters, statusFilter, debouncedSearch]);

  const paginatedFosters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFosters.slice(start, start + pageSize);
  }, [filteredFosters, page]);

  // Handlers
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await fosterService.apply(applyForm);
      addToast("Registered new foster profile!", "success");
      setIsApplyModalOpen(false);
      setApplyForm({ preferences: "Dogs only, Medium size", max_capacity: 2, notes: "" });
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to register foster profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeTargetProfileId || !placeForm.dog_id) {
      addToast("Foster family and dog selection are required.", "error");
      return;
    }

    const targetFoster = fosters.find((f) => f.id === placeTargetProfileId);
    if (targetFoster && targetFoster.active_count >= targetFoster.max_capacity) {
      addToast(`Cannot place dog: Foster family "${targetFoster.foster_family}" is at maximum capacity (${targetFoster.active_count}/${targetFoster.max_capacity}).`, "error");
      return;
    }

    if (targetFoster) {
      if (targetFoster.status !== "approved") {
        addToast(`Cannot place dog: Foster family "${targetFoster.foster_family}" is not approved (Current status: ${targetFoster.status}).`, "error");
        return;
      }
      if (!targetFoster.background_check_passed) {
        addToast(`Cannot place dog: Foster family "${targetFoster.foster_family}" background check is not Cleared.`, "error");
        return;
      }
      if (!targetFoster.home_inspection_passed) {
        addToast(`Cannot place dog: Foster family "${targetFoster.foster_family}" home inspection is not Approved.`, "error");
        return;
      }
    }

    const existingPlacement = activePlacements.find(
      (p) => String(p.dog_id || p.dog?.id) === placeForm.dog_id && (p.is_active || !p.returned_at)
    );
    if (existingPlacement) {
      addToast(`Cannot place dog: This animal is already placed in active foster care with family "${existingPlacement.foster_family}".`, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await fosterService.placeDog(placeTargetProfileId, placeForm);
      await petService.updatePet(placeForm.dog_id, {
        status: "fostered",
        shelter_status: "In Foster Care",
        is_adoptable: true,
      }).catch(() => null);

      addToast("Animal placed in foster home & Dog Master Profile updated!", "success");
      setIsPlaceModalOpen(false);
      setPlaceForm({ dog_id: "", notes: "" });
      setPlaceTargetProfileId("");
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to place dog in foster care.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    try {
      setIsSubmitting(true);
      await fosterService.updateProfile(editForm.id, {
        status: editForm.status,
        is_available: editForm.is_available,
        max_capacity: Number(editForm.max_capacity),
        preferences: editForm.preferences,
        notes: editForm.notes,
        background_check_passed: editForm.background_check_passed,
        home_inspection_passed: editForm.home_inspection_passed,
      });
      addToast("Updated foster profile details!", "success");
      setIsEditModalOpen(false);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
    try {
      setIsSubmitting(true);
      await fosterService.returnDog(selectedPlacement.id, {
        reason: returnReason,
        notes: returnNotes || `Concluded foster stay (${returnReason}). Returned animal to shelter facility.`,
      });
      if (dogId) {
        await petService.updatePet(dogId, {
          status: "shelter_care",
          shelter_status: "In Shelter",
          is_adoptable: true,
        }).catch(() => null);
      }
      addToast("Dog returned from foster care to shelter & Shelter Management roster updated!", "success");
      setIsReturnModalOpen(false);
      setSelectedPlacement(null);
      setReturnNotes("");
      setReturnReason("Foster Term Completed");
      fetchFosters();
      fetchDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to return dog.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;

    const payload: FosterProgressLogPayload = {};
    if (progressForm.weight_kg !== undefined && progressForm.weight_kg !== null && !isNaN(Number(progressForm.weight_kg))) {
      payload.weight_kg = Number(progressForm.weight_kg);
    }
    if (progressForm.mood_rating !== undefined && progressForm.mood_rating !== null) {
      payload.mood_rating = Number(progressForm.mood_rating);
    }
    if (progressForm.behavior_notes?.trim()) {
      payload.behavior_notes = progressForm.behavior_notes.trim();
    }
    if (progressForm.feeding_notes?.trim()) {
      payload.feeding_notes = progressForm.feeding_notes.trim();
    }
    if (progressForm.medication_notes?.trim()) {
      payload.medication_notes = progressForm.medication_notes.trim();
    }
    if (progressForm.notes?.trim()) {
      payload.notes = progressForm.notes.trim();
    }

    try {
      setIsSubmitting(true);
      const placementId = String(selectedPlacement.id || selectedPlacement.placement_id || "");
      await fosterService.logProgress(placementId, payload);
      addToast("Logged foster progress report!", "success");
      setIsProgressModalOpen(false);

      if (isPlacementDetailModalOpen && selectedPlacementDetail && String(selectedPlacementDetail.id) === placementId) {
        try {
          const logsRes = await fosterService.getProgressLogs(placementId);
          setPlacementProgressLogs(unwrapList(logsRes));
        } catch {
          /* ignore refresh log failure */
        }
      }

      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to log progress.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    try {
      setIsSubmitting(true);
      const placementId = String(selectedPlacement.id || selectedPlacement.placement_id || "");
      await fosterService.logSupplyDispatch(placementId, supplyForm);
      addToast("Supply dispatch recorded!", "success");
      setIsSupplyModalOpen(false);

      if (isPlacementDetailModalOpen && selectedPlacementDetail && String(selectedPlacementDetail.id) === placementId) {
        try {
          const suppRes = await fosterService.getSupplyDispatches(placementId);
          setPlacementSuppliesList(unwrapList(suppRes));
        } catch {
          /* ignore refresh failure */
        }
      }

      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to log supply dispatch.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenConvertModal = async (placement: any) => {
    setSelectedPlacementForConvert(placement);
    setConvertConflictError(null);
    setConvertLegalConfirmed(false);
    setConvertNotes("");
    const dogId = String(placement?.dog_id || placement?.dog?.id || "");
    if (dogId) {
      try {
        const dogData = await petService.getPetById(dogId);
        if (dogData) {
          setDogsMap((prev) => new Map(prev).set(dogId, dogData));
        }
      } catch {
        /* ignore single dog fetch failure */
      }
    }
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvertToAdopt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlacementForConvert) return;

    const placementId = String(
      selectedPlacementForConvert.id || selectedPlacementForConvert.placement_id || ""
    );
    const dogId = String(
      selectedPlacementForConvert.dog_id || selectedPlacementForConvert.dog?.id || ""
    );

    if (!placementId) {
      addToast("Invalid placement ID for adoption conversion.", "error");
      return;
    }

    if (!convertLegalConfirmed) {
      addToast("Please confirm that the caregiver has signed the legal adoption agreement.", "error");
      return;
    }

    setConvertConflictError(null);

    try {
      setIsSubmitting(true);
      // Execute REAL backend conversion workflow
      await fosterService.convertToAdopt(placementId, convertNotes);

      // Only after backend confirms success:
      addToast("Foster placement successfully converted into permanent adoption! Legal adoption workflow complete.", "success");
      setIsConvertModalOpen(false);
      setIsPlacementDetailModalOpen(false);
      setSelectedPlacementForConvert(null);
      setConvertNotes("");
      setConvertConflictError(null);
      await Promise.all([fetchFosters(), fetchDogs()]);
      notifyDataChanged();
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = extractBackendErrorMessage(err, "Failed to convert foster placement to adoption.");
      if (status === 409) {
        // Honest 409 handling: display real reason, refresh actual placement and dog state from backend
        setConvertConflictError(errMsg || "Conflict: This dog has already been adopted or has a conflicting adoption record.");
        addToast(`409 Conflict: ${errMsg}`, "error");
        fetchFosters();
        fetchDogs();
        if (dogId) {
          petService.getPetById(dogId).then((freshDog) => {
            if (freshDog) {
              setDogsMap((prev) => new Map(prev).set(dogId, freshDog));
            }
          }).catch(() => null);
        }
      } else {
        addToast(errMsg, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      await fosterService.deleteProfile(selectedFoster.id);
      addToast(`Deleted foster profile ${selectedFoster.foster_family}`, "success");
      setIsDeleteModalOpen(false);
      setSelectedFoster(null);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to delete profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFosterDetail = async (foster: FosterProfileRow) => {
    setSelectedFoster(foster);
    setIsDetailModalOpen(true);
    try {
      const placementsRes = await fosterService.getProfilePlacements(foster.id);
      const list = unwrapList(placementsRes);
      if (list.length > 0 && list[0].id) {
        const [logsRes, suppRes] = await Promise.allSettled([
          fosterService.getProgressLogs(list[0].id),
          fosterService.getSupplyDispatches(list[0].id),
        ]);
        setProgressLogs(logsRes.status === "fulfilled" ? unwrapList(logsRes.value) : []);
        setSuppliesList(suppRes.status === "fulfilled" ? unwrapList(suppRes.value) : []);
      }
    } catch {
      setProgressLogs([]);
      setSuppliesList([]);
    }
  };

  const stats = [
    { title: "Total Foster Families", value: `${fosters.length} Registered`, trend: `${pendingApplicationsCount} Pending Applications`, color: "#2563EB", icon: <FaHome /> },
    { title: "Active Foster Homes", value: `${totalActiveHomes} Active`, trend: "Available", color: "#10B981", icon: <FaHandHoldingHeart /> },
    { title: "Pets in Foster Care", value: `${totalPetsInFoster} Fostered`, trend: "In Homes", color: "#F59E0B", icon: <FaDog /> },
    { title: "Available Care Slots", value: `${totalAvailableSlots} Capacity`, trend: "Open Slots", color: "#6366F1", icon: <FaClipboardList /> },
  ];

  const columns: Column<FosterProfileRow>[] = [
    {
      key: "id",
      title: "Profile ID",
      render: (_v, row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{row.id.slice(0, 8)}</span>,
    },
    {
      key: "foster_family",
      title: "Foster Family / Parent",
      render: (_v, row) => (
        <div>
          <strong>{row.foster_family}</strong>
          {row.user?.email && <div style={{ fontSize: "11px", color: "#64748B" }}>{row.user.email}</div>}
        </div>
      ),
    },
    {
      key: "status",
      title: "Status & Vetting",
      render: (_v, row) => {
        const bgStatus = String(row.raw?.background_check_status || (row.background_check_passed ? "cleared" : "pending")).toLowerCase();
        const homeStatus = String(row.raw?.home_inspection_status || (row.home_inspection_passed ? "approved" : "pending")).toLowerCase();
        const bgLabel = row.background_check_passed || bgStatus === "cleared" ? "✓ Clear" : bgStatus === "rejected" ? "✕ Rejected" : bgStatus === "flagged" ? "⚠ Flagged" : "Pending";
        const homeLabel = row.home_inspection_passed || homeStatus === "approved" ? "✓ Passed" : homeStatus === "rejected" ? "✕ Rejected" : homeStatus === "scheduled" ? "📅 Scheduled" : "Pending";

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 800,
                display: "inline-block",
                width: "fit-content",
                textTransform: "uppercase",
                background: row.status === "approved" ? "#ECFDF5" : row.status === "applied" ? "#FEF3C7" : row.status === "rejected" ? "#FEF2F2" : "#F1F5F9",
                color: row.status === "approved" ? "#047857" : row.status === "applied" ? "#B45309" : row.status === "rejected" ? "#DC2626" : "#475569",
              }}
            >
              {row.status}
            </span>
            <div style={{ fontSize: "11px", color: "#64748B", display: "flex", gap: "6px" }}>
              <span style={{ color: bgStatus === "rejected" ? "#DC2626" : bgStatus === "flagged" ? "#D97706" : undefined }}>Bg Check: {bgLabel}</span>
              <span style={{ color: homeStatus === "rejected" ? "#DC2626" : undefined }}>Home Insp: {homeLabel}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "active_count",
      title: "Capacity & Placements",
      render: (_v, row) => (
        <div>
          <strong style={{ color: "#2563EB" }}>{row.active_count} Fostered</strong> / {row.max_capacity} Max
        </div>
      ),
    },
    {
      key: "preferences",
      title: "Preferences",
      render: (_v, row) => <span>{row.preferences || "Any"}</span>,
    },
    {
      key: "created_at",
      title: "Registered Date",
      render: (_v, row) => <span>{row.created_at ? formatDateTime(row.created_at) : "-"}</span>,
    },
  ];

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#DC2626", fontWeight: 800 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: "600px", margin: "12px auto" }}>
          Foster Management is reserved for Foster Coordinators and Super Administrators. Rescue Centre Admin access is restricted to centre rescue operations, dispatch, vehicle fleet, and dog master management.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Foster Management Ecosystem</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Onboard temporary foster caregivers, place rescued animals in loving homes, track progress &amp; supply dispatches, and convert placements to permanent adoption.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="create_foster">
          <QuickActionCard icon={<FaUserPlus />} title="Register Fosterer" subtitle="Onboard caregiver" color="#2563EB" onClick={() => setIsApplyModalOpen(true)} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaHandHoldingHeart />} title="Place Animal" subtitle="Assign dog to foster home" color="#10B981" onClick={() => setIsPlaceModalOpen(true)} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaClipboardList />} title="Progress Logs" subtitle="Track health & behavior" color="#F59E0B" onClick={() => setActiveTab("placements")} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaBoxOpen />} title="Supply Dispatch" subtitle="Log food & medical supplies" color="#6366F1" onClick={() => setActiveTab("placements")} />
        </Can>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Workspace Navigation Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #E2E8F0" }}>
        <button
          onClick={() => setActiveTab("profiles")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "profiles" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "profiles" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Foster Caregivers &amp; Applications ({fosters.length})
        </button>
        <button
          onClick={() => setActiveTab("placements")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "placements" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "placements" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Active Foster Placements ({activePlacements.length})
        </button>
      </div>

      {activeTab === "profiles" ? (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Foster Caregivers Directory
            </h3>
            {loading && <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>Loading...</span>}
          </div>

          <DataTable
            columns={columns}
            data={paginatedFosters}
            module="foster"
            serverMode={true}
            totalCount={filteredFosters.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
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
                <option value="all">All Statuses</option>
                <option value="applied">Applied (Pending Review)</option>
                <option value="approved">Approved &amp; Active</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
              </select>
            }
            onRowClick={(row) => openFosterDetail(row)}
            renderRowActions={(row: FosterProfileRow) => {
              const isPending =
                row.status === "applied" ||
                row.status === "pending" ||
                row.status === "under_review" ||
                row.status === "submitted";
              const isApproved = row.status === "approved";
              const hasCapacity = (row.active_count || 0) < (row.max_capacity || 1);

              return (
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => handleOpenReview(row)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#2563EB",
                        color: "#FFF",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                      }}
                    >
                      <FaClipboardList /> Review Application
                    </button>
                  )}
                  {isApproved && hasCapacity && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlaceTargetProfileId(row.id);
                        setIsPlaceModalOpen(true);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#047857",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <FaHandHoldingHeart /> Place Dog
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openFosterDetail(row)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC",
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Inspect Profile
                  </button>
                </div>
              );
            }}
          />
        </div>
      ) : (
        <div className="soft-card" style={{ padding: "24px" }}>
          {/* Header & Controls Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "14px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                Active Foster Placements
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Operational roster of animals currently residing with approved foster families.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Placement Search */}
              <div style={{ position: "relative", minWidth: "240px" }}>
                <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: "13px" }} />
                <input
                  type="text"
                  placeholder="Search pet, breed, caregiver..."
                  value={placementSearchQuery}
                  onChange={(e) => setPlacementSearchQuery(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "34px", fontSize: "13px", width: "100%" }}
                />
              </div>

              <button
                type="button"
                disabled={placementsLoading}
                onClick={() => fetchFosters()}
                title="Refresh Active Placements"
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: placementsLoading ? "#94A3B8" : "#475569",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: placementsLoading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaSync className={placementsLoading ? "animate-spin" : ""} /> {placementsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Loading State: Only show full loader on first load when no placements are loaded yet */}
          {placementsLoading && activePlacements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748B", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <FaSync className="animate-spin" size={28} color="#2563EB" style={{ marginBottom: "12px" }} />
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E293B" }}>Loading active foster placements...</div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Retrieving active caregiver placement records</div>
            </div>
          ) : placementsError && activePlacements.length === 0 ? (
            /* Explicit Error State with Retry */
            <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 700, fontSize: "15px" }}>
                <FaExclamationTriangle size={18} color="#DC2626" />
                Failed to load active placements
              </div>
              <p style={{ margin: "6px 0 14px", fontSize: "13px", color: "#7F1D1D" }}>{placementsError}</p>
              <button
                type="button"
                onClick={() => fetchFosters()}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaSync /> Retry Loading
              </button>
            </div>
          ) : filteredPlacements.length === 0 ? (
            /* Clean Empty State */
            <div style={{ textAlign: "center", padding: "48px 20px", background: "#F8FAFC", borderRadius: "12px", border: "1px dashed #CBD5E1", color: "#64748B" }}>
              <FaDog size={40} color="#CBD5E1" style={{ marginBottom: "12px" }} />
              <div style={{ fontWeight: 700, fontSize: "16px", color: "#0F172A" }}>
                {placementSearchQuery ? "No matching active placements found" : "No active foster placements."}
              </div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", maxWidth: "460px", margin: "4px auto 0" }}>
                {placementSearchQuery ? "Try searching with a different pet name, breed, or caregiver." : "There are currently no animals placed in temporary foster homes."}
              </div>
            </div>
          ) : (
            /* Operational Card Roster Grid - Stays visible during background refresh */
            <div>
              {placementsError && (
                <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "8px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>⚠️ {placementsError}</span>
                  <button type="button" onClick={() => fetchFosters()} style={{ border: "none", background: "none", color: "#DC2626", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Retry</button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
              {filteredPlacements.map((p, idx) => {
                const dogId = String(p.dog_id || p.dog?.id || "");
                const dogObj = p.dog || dogsMap.get(dogId);
                const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal Placement");
                const breed = dogObj?.breed || dogObj?.breed_classification || null;
                const photoUrl = getPetPhoto(dogObj);
                const placedAt = p.placed_at || p.start_date || p.created_at;
                const durationStr = getDurationInCare(placedAt);
                const expectedReturn = p.expected_return_date || p.expected_return || p.end_date;

                return (
                  <div
                    key={p.id || idx}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "12px",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}
                  >
                    {/* Pet Information Header */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={dogName}
                              style={{ width: "48px", height: "48px", borderRadius: "10px", objectFit: "cover", border: "1px solid #E2E8F0" }}
                            />
                          ) : (
                            <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                              <FaDog />
                            </div>
                          )}
                          <div>
                            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{dogName}</h4>
                            <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                              {breed ? `${breed} • ` : ""}
                              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748B" }}>Ref: {dogId ? dogId.slice(0, 8) : "-"}</span>
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            background: "#ECFDF5",
                            color: "#047857",
                            border: "1px solid #A7F3D0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.status || "Active Placement"}
                        </span>
                      </div>

                      {/* Divider */}
                      <div style={{ borderBottom: "1px solid #F1F5F9", marginBottom: "12px" }} />

                      {/* Caregiver & Placement Metadata */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#334155", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FaHome color="#2563EB" size={14} />
                          <span>Foster Family: <strong>{p.foster_family}</strong></span>
                        </div>
                        {p.caregiver_email && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748B", paddingLeft: "22px" }}>
                            <FaEnvelope size={11} /> <span>{p.caregiver_email}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <FaCalendarAlt color="#6366F1" size={14} />
                          <span>
                            Placed Date: <strong>{placedAt ? formatDateTime(placedAt) : "N/A"}</strong>
                            {durationStr && <span style={{ color: "#2563EB", fontWeight: 700, marginLeft: "6px" }}>({durationStr})</span>}
                          </span>
                        </div>
                        {expectedReturn && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#B45309" }}>
                            <FaClock size={14} />
                            <span>Expected Return: <strong>{formatDateTime(expectedReturn)}</strong></span>
                          </div>
                        )}
                        {p.notes && (
                          <div style={{ fontSize: "12px", color: "#475569", background: "#F8FAFC", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E2E8F0", marginTop: "4px" }}>
                            <strong>Placement Notes:</strong> {p.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar Footer */}
                    <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => openLogProgressModal(p)}
                          style={{
                            padding: "7px 14px",
                            borderRadius: "6px",
                            border: "none",
                            background: "#2563EB",
                            color: "#FFF",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                          }}
                        >
                          <FaClipboardList /> Log Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => openPlacementDetailModal(p)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#334155",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FaInfoCircle /> Details
                        </button>
                      </div>

                      {/* Dropdown Action Menu */}
                      <PlacementActionMenu
                        actions={[
                          {
                            label: "Log Supply Dispatch",
                            icon: <FaBoxOpen />,
                            onClick: () => {
                              setSelectedPlacement(p);
                              setIsSupplyModalOpen(true);
                            },
                          },
                          {
                            label: "Request Vet Check",
                            icon: <FaStethoscope />,
                            onClick: () => handleOpenVetCheckModal(p),
                          },
                          {
                            label: "Convert to Adopt",
                            icon: <FaHeart />,
                            variant: "accent",
                            onClick: () => handleOpenConvertModal(p),
                          },
                          {
                            label: "Return to Shelter",
                            icon: <FaUndo />,
                            variant: "danger",
                            onClick: () => handleOpenReturnModal(p),
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apply Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Register Foster Caregiver Profile">
        <form onSubmit={handleApplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Preferences</label>
            <input type="text" placeholder="e.g. Medium dogs, Medical Recovery" value={applyForm.preferences} onChange={(e) => setApplyForm({ ...applyForm, preferences: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Maximum Capacity</label>
            <input type="number" min="1" max="10" value={applyForm.max_capacity} onChange={(e) => setApplyForm({ ...applyForm, max_capacity: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Experience</label>
            <textarea placeholder="e.g. Fenced backyard, prior fostering experience" value={applyForm.notes} onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsApplyModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Registering..." : "Register Profile"}</button>
          </div>
        </form>
      </Modal>

      {/* Place Dog Modal */}
      <Modal isOpen={isPlaceModalOpen} onClose={() => setIsPlaceModalOpen(false)} title="Place Dog in Foster Home">
        <form onSubmit={handlePlaceSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Foster Caregiver Family *</label>
            <select required value={placeTargetProfileId} onChange={(e) => setPlaceTargetProfileId(e.target.value)} style={inputStyle}>
              <option value="">Select foster caregiver...</option>
              {fosters
                .filter((f) => f.is_available)
                .map((f) => {
                  const isApproved = f.status === "approved";
                  const isVetted = Boolean(f.background_check_passed && f.home_inspection_passed);
                  const hasCapacity = f.active_count < f.max_capacity;
                  const isEligible = isApproved && isVetted && hasCapacity;
                  let badge = "✓ [Eligible - Approved]";
                  if (!isApproved) {
                    badge = `⚠️ [INELIGIBLE — Status: ${(f.status || "applied").toUpperCase()}]`;
                  } else if (!isVetted) {
                    badge = "⚠️ [INELIGIBLE — Vetting Incomplete]";
                  } else if (!hasCapacity) {
                    badge = "⚠️ [INELIGIBLE — At Capacity]";
                  }
                  return (
                    <option key={f.id} value={f.id} disabled={!isEligible}>
                      {f.foster_family} (Capacity: {f.active_count}/{f.max_capacity}) {badge}
                    </option>
                  );
                })}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dog *</label>
            <Select
              required
              searchable
              placeholder="Select dog..."
              value={placeForm.dog_id}
              onChange={(val) => setPlaceForm({ ...placeForm, dog_id: String(val || "") })}
              options={dogs.map((d) => ({
                value: d.id,
                label: d.label || d.name || String(d.id),
              }))}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Placement Notes</label>
            <textarea placeholder="e.g. Placing for post-surgery recovery, 4-6 weeks." value={placeForm.notes} onChange={(e) => setPlaceForm({ ...placeForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsPlaceModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Placing..." : "Confirm Placement"}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Foster Caregiver Profile">
        <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Profile Status</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })} style={inputStyle}>
              <option value="applied">Applied (Pending)</option>
              <option value="approved">Approved &amp; Active</option>
              <option value="rejected">Rejected</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Max Capacity</label>
              <input type="number" min="1" max="10" value={editForm.max_capacity || 2} onChange={(e) => setEditForm({ ...editForm, max_capacity: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Available for Placement</label>
              <select value={editForm.is_available ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, is_available: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Yes (Available)</option>
                <option value="false">No (Busy / Max Capacity)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Background Check Passed</label>
              <select value={editForm.background_check_passed ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, background_check_passed: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Passed (Verified)</option>
                <option value="false">Pending / Failed</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Home Inspection Passed</label>
              <select value={editForm.home_inspection_passed ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, home_inspection_passed: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Passed (Fenced Yard Verified)</option>
                <option value="false">Pending Inspection</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Vetting Summary</label>
            <textarea placeholder="e.g. Background check clear, home inspection completed." value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </Modal>

      {/* Return Dog Modal */}
      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Return Dog to Shelter Care" maxWidth="600px">
        {selectedPlacement && (() => {
          const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
          const dogObj = selectedPlacement.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;

          return (
            <form onSubmit={handleReturnSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FaUndo color="#DC2626" size={20} style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#991B1B" }}>
                    Conclude Foster Stay &amp; Return to Shelter
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#B91C1C", lineHeight: "1.4" }}>
                    This action closes the active foster placement for <strong>{dogName}</strong> with family <strong>{selectedPlacement.foster_family}</strong>. The dog will be returned to shelter facility management.
                  </p>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div><strong>Animal:</strong> {dogName} {breed ? `(${breed})` : ""}</div>
                <div><strong>Foster Caregiver:</strong> {selectedPlacement.foster_family}</div>
                <div><strong>Placement Ref:</strong> <span style={{ fontFamily: "monospace" }}>{String(selectedPlacement.id || "").slice(0, 8)}</span></div>
                <div><strong>Next Status:</strong> <span style={{ color: "#2563EB", fontWeight: 700 }}>In Shelter (Shelter Care)</span></div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Primary Return Reason *
                </label>
                <select
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={inputStyle}
                >
                  <option value="Foster Term Completed">Foster Term Completed (Standard conclusion)</option>
                  <option value="Behavioral Mismatch / Training Needed">Behavioral Mismatch / Specialized Training Needed</option>
                  <option value="Medical Escalation / Shelter Treatment">Medical Escalation / Shelter Clinical Treatment Required</option>
                  <option value="Caregiver Moving / Unable to Continue">Caregiver Moving / Unable to Continue Fostering</option>
                  <option value="Emergency Return">Emergency Return / Facility Recall</option>
                  <option value="Other">Other Operational Reason</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Return Evaluation &amp; History Notes *
                </label>
                <textarea
                  required
                  placeholder="Describe pet condition, reason for concluding stay, care summary, or handoff instructions..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: "75px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaUndo /> {isSubmitting ? "Returning..." : "Confirm Return to Shelter"}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Request Vet Check Modal */}
      <Modal isOpen={isVetCheckModalOpen} onClose={() => setIsVetCheckModalOpen(false)} title="Request Veterinary Medical Check" maxWidth="600px">
        {selectedPlacementForVetCheck && (() => {
          const p = selectedPlacementForVetCheck;
          const dogId = String(p.dog_id || p.dog?.id || "");
          const dogObj = p.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;

          return (
            <form onSubmit={handleConfirmVetCheckSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <FaStethoscope color="#047857" size={22} style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#065F46" }}>
                    Initiate Veterinary Examination
                  </h4>
                  <p style={{ margin: 0, fontSize: "12.5px", color: "#047857", lineHeight: "1.4" }}>
                    Request a medical evaluation for foster dog <strong>{dogName}</strong>. This request will be routed to the veterinary queue and recorded on the dog&apos;s medical history.
                  </p>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div><strong>Pet:</strong> {dogName} {breed ? `(${breed})` : ""}</div>
                <div><strong>Current Caregiver:</strong> {p.foster_family || "Foster Parent"}</div>
                <div><strong>Pet ID:</strong> <span style={{ fontFamily: "monospace" }}>{dogId || "N/A"}</span></div>
                <div><strong>Placement Ref:</strong> <span style={{ fontFamily: "monospace" }}>{String(p.id || "").slice(0, 8) || "N/A"}</span></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Urgency Level *
                  </label>
                  <select
                    value={vetCheckForm.urgency}
                    onChange={(e) => setVetCheckForm({ ...vetCheckForm, urgency: e.target.value as any })}
                    style={inputStyle}
                  >
                    <option value="routine">Routine Checkup (Standard priority)</option>
                    <option value="urgent">Urgent (Needs attention within 24-48h)</option>
                    <option value="emergency">Emergency (Immediate evaluation)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={vetCheckForm.preferred_date}
                    onChange={(e) => setVetCheckForm({ ...vetCheckForm, preferred_date: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Examination Reason *
                </label>
                <select
                  value={vetCheckForm.reason}
                  onChange={(e) => setVetCheckForm({ ...vetCheckForm, reason: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Routine Health Check">Routine Health &amp; Wellness Check</option>
                  <option value="Vaccination Follow-up">Vaccination Booster / Rabies Follow-up</option>
                  <option value="Illness / Symptom Evaluation">Illness / Symptom Evaluation (Coughing, Fever, Lethargy)</option>
                  <option value="Post-Surgery Follow-up">Post-Surgery Wound / Recovery Check</option>
                  <option value="Dietary / Weight Management">Dietary / Digestive or Weight Issue</option>
                  <option value="Behavioral / Dental Assessment">Behavioral / Dental or Skin/Ear Assessment</option>
                  <option value="Pre-Adoption Medical Clearance">Pre-Adoption Final Medical Clearance</option>
                  <option value="Other">Other Clinical Reason</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Clinical Notes &amp; Caregiver Observations
                </label>
                <textarea
                  placeholder="Enter details on symptoms, appetite, energy levels, behavior notes, or specific veterinary requests..."
                  value={vetCheckForm.notes}
                  onChange={(e) => setVetCheckForm({ ...vetCheckForm, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "75px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsVetCheckModalOpen(false)}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#059669", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaStethoscope /> {isSubmitting ? "Requesting..." : "Submit Vet Check Request"}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Progress Log Modal */}
      <Modal isOpen={isProgressModalOpen} onClose={() => setIsProgressModalOpen(false)} title="Log Foster Progress Report" maxWidth="600px">
        {selectedPlacement && (() => {
          const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
          const dogObj = selectedPlacement.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal Placement");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;
          const placementId = String(selectedPlacement.id || selectedPlacement.placement_id || "");

          return (
            <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Context Summary Header */}
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                <div><strong>Pet Name:</strong> {dogName} {breed ? `(${breed})` : ""}</div>
                <div><strong>Foster Family:</strong> {selectedPlacement.foster_family || "Caregiver"}</div>
                <div><strong>Placement Ref:</strong> <span style={{ fontFamily: "monospace" }}>{placementId.slice(0, 8)}</span></div>
                <div><strong>Context:</strong> <span style={{ color: "#1D4ED8", fontWeight: 700 }}>Active Care &amp; Monitoring</span></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 15.5"
                    value={progressForm.weight_kg ?? ""}
                    onChange={(e) => setProgressForm({ ...progressForm, weight_kg: e.target.value ? Number(e.target.value) : undefined })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Mood Rating (1-5)</label>
                  <select
                    value={progressForm.mood_rating ?? 5}
                    onChange={(e) => setProgressForm({ ...progressForm, mood_rating: Number(e.target.value) })}
                    style={inputStyle}
                  >
                    <option value={5}>5 - Excellent / Energetic &amp; Happy</option>
                    <option value={4}>4 - Good / Calm &amp; Contented</option>
                    <option value={3}>3 - Fair / Normal Activity</option>
                    <option value={2}>2 - Guarded / Mild Anxiety or Stress</option>
                    <option value={1}>1 - Poor / Lethargic or Unwell</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Behavior Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Playful and settled well, responsive to family interactions."
                  value={progressForm.behavior_notes || ""}
                  onChange={(e) => setProgressForm({ ...progressForm, behavior_notes: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Feeding Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Ate full meal portion, good appetite."
                    value={progressForm.feeding_notes || ""}
                    onChange={(e) => setProgressForm({ ...progressForm, feeding_notes: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Medication Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Administered daily supplement / antibiotics."
                    value={progressForm.medication_notes || ""}
                    onChange={(e) => setProgressForm({ ...progressForm, medication_notes: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Care &amp; Progress Summary Notes</label>
                <textarea
                  placeholder="e.g. Overall health observations, care routine updates, or comments."
                  value={progressForm.notes || ""}
                  onChange={(e) => setProgressForm({ ...progressForm, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "70px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaClipboardList /> {isSubmitting ? "Logging..." : "Submit Progress Log"}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Log Supply Dispatch Modal */}
      <Modal isOpen={isSupplyModalOpen} onClose={() => setIsSupplyModalOpen(false)} title="Log Supply Dispatch">
        <form onSubmit={handleSupplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Supply Item Type</label>
            <select value={supplyForm.item_type} onChange={(e) => setSupplyForm({ ...supplyForm, item_type: e.target.value as any })} style={inputStyle}>
              <option value="food">Canine Food</option>
              <option value="crate">Crate / Carrier</option>
              <option value="medication">Medication / Supplements</option>
              <option value="bedding">Bedding &amp; Blankets</option>
              <option value="toys">Toys &amp; Enrichment</option>
              <option value="other">Other Supplies</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Description</label>
            <input type="text" placeholder="e.g. 20lb bag of puppy food" value={supplyForm.description || ""} onChange={(e) => setSupplyForm({ ...supplyForm, description: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Quantity</label>
            <input type="number" min="1" value={supplyForm.quantity || 1} onChange={(e) => setSupplyForm({ ...supplyForm, quantity: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsSupplyModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#6366F1", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Dispatching..." : "Log Supply"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Foster Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to delete foster profile <strong>{selectedFoster?.foster_family}</strong>?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={handleDelete} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600 }}>Delete</button>
          </div>
        </div>
      </Modal>

      {/* Detailed Profile & History Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Foster Caregiver Profile — ${selectedFoster?.foster_family || "Caregiver"}`} maxWidth="750px">
        {selectedFoster && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Header Box */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedFoster.foster_family}</h2>
                <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                  Profile / Application ID: <span style={{ fontFamily: "monospace" }}>{selectedFoster.id}</span>
                </div>
                {selectedFoster.user?.email && (
                  <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                    Email: <strong>{selectedFoster.user.email}</strong> {selectedFoster.user?.phone ? `• Phone: ${selectedFoster.user.phone}` : ""}
                  </div>
                )}
              </div>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: selectedFoster.status === "approved" ? "#D1FAE5" : selectedFoster.status === "applied" || selectedFoster.status === "pending" ? "#FEF3C7" : selectedFoster.status === "rejected" ? "#FEE2E2" : "#F1F5F9",
                  color: selectedFoster.status === "approved" ? "#047857" : selectedFoster.status === "applied" || selectedFoster.status === "pending" ? "#B45309" : selectedFoster.status === "rejected" ? "#B91C1C" : "#475569",
                }}
              >
                {selectedFoster.status}
              </span>
            </div>

            {/* Application Overview & Preferences Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Capacity &amp; Placements</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB", marginTop: "4px" }}>
                  {selectedFoster.active_count || 0} Active / {selectedFoster.max_capacity || 1} Max Capacity
                </div>
              </div>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Preferences</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  {selectedFoster.preferences || "Any"}
                </div>
              </div>
            </div>

            {/* Residence, Household & Questionnaire Details */}
            {selectedFoster.notes && (
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                  Application Questionnaire &amp; Residence Information
                </div>
                <div style={{ fontSize: "13px", color: "#334155", whiteSpace: "pre-line", lineHeight: "1.5" }}>
                  {selectedFoster.notes}
                </div>
              </div>
            )}

            {/* Verification & Inspection Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Background Check</div>
                {(() => {
                  const bgStatus = String(selectedFoster.raw?.background_check_status || (selectedFoster.background_check_passed ? "cleared" : "pending")).toLowerCase();
                  const isCleared = selectedFoster.background_check_passed || bgStatus === "cleared" || bgStatus === "passed";
                  const isRejected = bgStatus === "rejected" || bgStatus === "failed";
                  const isFlagged = bgStatus === "flagged";
                  const isInProgress = bgStatus === "in_progress" || bgStatus === "initiated";

                  const label = isCleared
                    ? "✓ Cleared"
                    : isRejected
                    ? "✕ Rejected"
                    : isFlagged
                    ? "⚠ Flagged"
                    : isInProgress
                    ? "⏳ In Progress"
                    : "Pending Verification";

                  const color = isCleared ? "#059669" : isRejected ? "#DC2626" : isFlagged ? "#D97706" : isInProgress ? "#2563EB" : "#64748B";

                  return (
                    <div style={{ fontSize: "13px", fontWeight: 700, color, marginTop: "4px" }}>
                      {label}
                    </div>
                  );
                })()}
                {selectedFoster.raw?.background_check_notes && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Notes: {selectedFoster.raw.background_check_notes}</div>
                )}
              </div>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Home Inspection</div>
                {(() => {
                  const homeStatus = String(selectedFoster.raw?.home_inspection_status || (selectedFoster.home_inspection_passed ? "approved" : "pending")).toLowerCase();
                  const isApproved = selectedFoster.home_inspection_passed || homeStatus === "approved" || homeStatus === "passed";
                  const isRejected = homeStatus === "rejected" || homeStatus === "failed";
                  const isScheduled = homeStatus === "scheduled";
                  const isInProgress = homeStatus === "in_progress";

                  const label = isApproved
                    ? "✓ Approved"
                    : isRejected
                    ? "✕ Rejected"
                    : isScheduled
                    ? "📅 Scheduled"
                    : isInProgress
                    ? "⏳ In Progress"
                    : "Pending Inspection";

                  const color = isApproved ? "#059669" : isRejected ? "#DC2626" : isScheduled || isInProgress ? "#2563EB" : "#64748B";

                  return (
                    <div style={{ fontSize: "13px", fontWeight: 700, color, marginTop: "4px" }}>
                      {label}
                    </div>
                  );
                })()}
                {selectedFoster.raw?.home_inspection_notes && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Notes: {selectedFoster.raw.home_inspection_notes}</div>
                )}
              </div>
            </div>

            {/* Recent History / Progress Logs */}
            <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaHistory color="#2563EB" /> Recent Progress Logs &amp; Supply Dispatches
              </div>
              {progressLogs.length === 0 && suppliesList.length === 0 ? (
                <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", color: "#64748B", fontSize: "13px", textAlign: "center" }}>
                  No recent logs registered for this profile.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                  {progressLogs.map((log, idx) => (
                    <div key={idx} style={{ background: "#FFF", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "12px" }}>
                      <strong>Progress Log:</strong> Weight: {log.weight_kg || "-"}kg &bull; Behavior: {log.behavior_notes || "-"}
                    </div>
                  ))}
                  {suppliesList.map((sup, idx) => (
                    <div key={idx} style={{ background: "#FFF", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "12px" }}>
                      <strong>Supply Dispatch:</strong> Item: {sup.item_type} &bull; {sup.description} (Qty: {sup.quantity})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {(selectedFoster.status === "applied" || selectedFoster.status === "pending" || selectedFoster.status === "under_review" || selectedFoster.status === "submitted") && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenReview(selectedFoster);
                  }}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaClipboardList /> Start Full Application Review
                </button>
              )}
              <button type="button" onClick={() => setIsDetailModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Comprehensive Application Review Modal (Sequential 4-Step Flow) */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Foster Application Review — ${selectedFoster?.foster_family || "Applicant"}`}
        maxWidth="820px"
      >
        {selectedFoster && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Header / Applicant Status Banner */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{selectedFoster.foster_family}</h3>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                  Profile ID: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{String(selectedFoster.id).slice(0, 8)}</span> &bull; Applied: {selectedFoster.created_at ? formatDateTime(selectedFoster.created_at) : "N/A"}
                </div>
              </div>
              {(() => {
                const rawStatus = String(selectedFoster.status || "applied").toLowerCase();
                let label = "Applied";
                let bg = "#FEF3C7";
                let color = "#B45309";
                let border = "#FDE68A";

                if (rawStatus === "approved") {
                  label = "Approved";
                  bg = "#ECFDF5";
                  color = "#047857";
                  border = "#A7F3D0";
                } else if (rawStatus === "rejected") {
                  label = "Application Rejected";
                  bg = "#FEF2F2";
                  color = "#DC2626";
                  border = "#FCA5A5";
                } else if (rawStatus === "inactive") {
                  label = "Inactive";
                  bg = "#F1F5F9";
                  color = "#475569";
                  border = "#CBD5E1";
                }

                return (
                  <span
                    style={{
                      padding: "5px 14px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: bg,
                      color: color,
                      border: `1px solid ${border}`,
                    }}
                  >
                    Application: {label}
                  </span>
                );
              })()}
            </div>

            {/* Stepper Navigation Bar */}
            {(() => {
              const bgStatus = String(reviewForm.background_check_status || "pending").toLowerCase();
              const bgPassed = reviewForm.background_check_passed === true || bgStatus === "cleared" || bgStatus === "passed";
              const bgAttention = bgStatus === "flagged" || bgStatus === "rejected" || bgStatus === "failed";
              const bgSubtitle = bgPassed
                ? "✓ Cleared"
                : bgStatus === "flagged"
                ? "⚠ Flagged"
                : bgStatus === "rejected" || bgStatus === "failed"
                ? "⚠ Rejected"
                : bgStatus === "in_progress" || bgStatus === "initiated"
                ? "In Progress"
                : "Pending";

              const homeStatus = String(reviewForm.home_inspection_status || "pending").toLowerCase();
              const homePassed = reviewForm.home_inspection_passed === true || homeStatus === "approved" || homeStatus === "passed";
              const homeAttention = homeStatus === "rejected" || homeStatus === "failed";
              const homeSubtitle = homePassed
                ? "✓ Approved"
                : homeStatus === "scheduled"
                ? "📅 Scheduled"
                : homeStatus === "in_progress"
                ? "In Progress"
                : homeStatus === "completed"
                ? "Log Recorded"
                : homeStatus === "rejected" || homeStatus === "failed"
                ? "⚠ Rejected"
                : "Pending";

              const appStatus = String(selectedFoster.status || "").toLowerCase();
              const appSubtitle = appStatus === "approved"
                ? "✓ Approved"
                : appStatus === "rejected"
                ? "✕ Rejected"
                : "Final Decision";

              const steps = [
                {
                  id: 1,
                  title: "1. Application",
                  subtitle: appStatus === "approved" ? "Approved" : appStatus === "rejected" ? "Rejected" : "Completed",
                  isDone: true,
                  isAttention: false,
                },
                {
                  id: 2,
                  title: "2. Background Check",
                  subtitle: bgSubtitle,
                  isDone: bgPassed,
                  isAttention: bgAttention,
                },
                {
                  id: 3,
                  title: "3. Home Inspection",
                  subtitle: homeSubtitle,
                  isDone: homePassed,
                  isAttention: homeAttention,
                },
                {
                  id: 4,
                  title: "4. Final Review",
                  subtitle: appSubtitle,
                  isDone: appStatus === "approved",
                  isAttention: appStatus === "rejected",
                },
              ];

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", background: "#F1F5F9", padding: "6px", borderRadius: "10px" }}>
                  {steps.map((st) => {
                    const isActive = reviewActiveStep === st.id;
                    let bgStyle = "#FFFFFF";
                    let textColor = "#475569";
                    let subColor = "#94A3B8";
                    let borderStyle = "none";
                    let shadow = "0 1px 2px rgba(0,0,0,0.03)";

                    if (isActive) {
                      bgStyle = "#1E3A8A";
                      textColor = "#FFFFFF";
                      subColor = "#BFDBFE";
                      shadow = "0 2px 4px rgba(30,58,138,0.2)";
                    } else if (st.isDone) {
                      bgStyle = "#FFFFFF";
                      textColor = "#0F172A";
                      subColor = "#16A34A";
                      shadow = "0 1px 2px rgba(0,0,0,0.05)";
                    } else if (st.isAttention) {
                      bgStyle = "#FFFBEB";
                      textColor = "#92400E";
                      subColor = "#D97706";
                      borderStyle = "1px solid #FDE68A";
                      shadow = "none";
                    }

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setReviewActiveStep(st.id as any);
                          setIsRejectConfirmOpen(false);
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: borderStyle,
                          textAlign: "left",
                          cursor: "pointer",
                          background: bgStyle,
                          color: textColor,
                          boxShadow: shadow,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                          {st.isDone && !isActive && <FaCheckCircle color="#16A34A" size={11} />}
                          {st.isAttention && !isActive && <span style={{ color: "#D97706", fontSize: "11px" }}>⚠</span>}
                          {st.title}
                        </div>
                        <div style={{ fontSize: "11px", color: subColor, marginTop: "2px", fontWeight: 600 }}>
                          {st.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* STEP 1: APPLICATION REVIEW (READ-ONLY) */}
            {reviewActiveStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#1E40AF" }}>
                  ℹ️ <strong>Applicant Information Review:</strong> This section contains the raw registration data submitted by the caregiver applicant and is read-only.
                </div>

                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Applicant Full Name</div>
                    <div style={{ fontWeight: 700, color: "#0F172A", marginTop: "3px" }}>{selectedFoster.foster_family}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Registered Email &amp; Phone</div>
                    <div style={{ color: "#334155", marginTop: "3px" }}>
                      {selectedFoster.user?.email || "N/A"} {selectedFoster.user?.phone ? `• ${selectedFoster.user.phone}` : ""}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Application Date</div>
                    <div style={{ color: "#334155", marginTop: "3px" }}>
                      {selectedFoster.created_at ? formatDateTime(selectedFoster.created_at) : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Requested Maximum Capacity</div>
                    <div style={{ fontWeight: 700, color: "#2563EB", marginTop: "3px" }}>
                      {reviewForm.max_capacity} Animals Max
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Animal &amp; Care Preferences</div>
                    <div style={{ color: "#0F172A", fontWeight: 600, marginTop: "3px" }}>
                      {reviewForm.preferences || "No specific preferences indicated."}
                    </div>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Applicant Experience &amp; Notes</div>
                    <div style={{ color: "#334155", background: "#F8FAFC", padding: "10px 12px", borderRadius: "6px", border: "1px solid #E2E8F0", marginTop: "4px", whiteSpace: "pre-line", lineHeight: "1.5" }}>
                      {selectedFoster.notes || "No additional notes provided by applicant."}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setReviewActiveStep(2)}
                    style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    Continue to Background Check <FaArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BACKGROUND CHECK */}
            {reviewActiveStep === 2 && (() => {
              const status = String(reviewForm.background_check_status || "pending").toLowerCase();
              const isCleared = reviewForm.background_check_passed === true || status === "cleared" || status === "passed";
              const isRejected = !isCleared && (status === "rejected" || status === "failed");
              const isFlagged = !isCleared && status === "flagged";
              const isInProgress = !isCleared && (status === "in_progress" || status === "initiated");
              const isPending = !isCleared && !isRejected && !isFlagged && !isInProgress;

              const badge = isCleared
                ? { label: "Cleared", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" }
                : isInProgress
                ? { label: "In Progress", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" }
                : isFlagged
                ? { label: "Requires Attention", bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" }
                : isRejected
                ? { label: "Rejected", bg: "#FEF2F2", color: "#DC2626", border: "#FCA5A5" }
                : { label: "Pending", bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1" };

              const continueHelpText = isCleared
                ? null
                : isPending
                ? "Complete the background check before continuing."
                : isInProgress
                ? "Background verification is still in progress."
                : isFlagged
                ? "Background verification requires attention before continuing."
                : isRejected
                ? "Background verification was rejected. Resolve this verification before continuing."
                : "Complete the background check before continuing.";

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Compact Status Card */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Background Check Status</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 800,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                        {(isRejected || isFlagged) && (
                          <span style={{ fontSize: "12px", color: isRejected ? "#DC2626" : "#D97706", fontWeight: 600 }}>
                            Requires attention before continuing.
                          </span>
                        )}
                      </div>
                    </div>
                    {reviewForm.background_check_notes && (
                      <div style={{ fontSize: "12px", color: "#475569", maxWidth: "350px", textAlign: "right" }}>
                        <strong>Notes:</strong> {reviewForm.background_check_notes}
                      </div>
                    )}
                  </div>

                  {/* 1. Initiate Check */}
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>1. Initiate Background Check Verification</span>
                      {!isPending && (
                        <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600, background: "#ECFDF5", padding: "2px 8px", borderRadius: "4px" }}>
                          ✓ Initiated ({badge.label})
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: "8px", alignItems: "center" }}>
                      <select
                        value={bgCheckProvider}
                        onChange={(e) => setBgCheckProvider(e.target.value)}
                        disabled={isSubmitting || isInitiatingBgCheck}
                        style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                      >
                        <option value="PawGuard Registry">PawGuard National Registry</option>
                        <option value="Checkr Identity">Checkr Identity &amp; Criminal</option>
                        <option value="ID.me Verification">ID.me Government ID</option>
                        <option value="Local Police Check">Local Police Record Check</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Optional dispatch or reference notes..."
                        value={bgCheckInitiateNotes}
                        onChange={(e) => setBgCheckInitiateNotes(e.target.value)}
                        disabled={isSubmitting || isInitiatingBgCheck}
                        style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                      />
                      <button
                        type="button"
                        disabled={isSubmitting || isInitiatingBgCheck}
                        onClick={handleInitiateBackgroundCheck}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "6px",
                          border: "none",
                          background: isSubmitting || isInitiatingBgCheck ? "#94A3B8" : "#2563EB",
                          color: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isSubmitting || isInitiatingBgCheck ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isInitiatingBgCheck ? "Initiating..." : isPending ? "Initiate Background Check" : "Re-Initiate Check"}
                      </button>
                    </div>

                    {/* Inline Non-Blocking Error Alert */}
                    {bgCheckInitiateError && (
                      <div style={{ marginTop: "10px", padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "12px", color: "#DC2626", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <div>
                          <strong>Initiation Failed:</strong> {bgCheckInitiateError}
                        </div>
                        <button
                          type="button"
                          onClick={handleInitiateBackgroundCheck}
                          disabled={isSubmitting || isInitiatingBgCheck}
                          style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #DC2626", background: "#FFF", color: "#DC2626", fontSize: "11px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Retry Initiation
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Record Outcome & References */}
                  <div style={{
                    background: isPending ? "#F8FAFC" : "#FFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px",
                    opacity: isPending ? 0.6 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: isPending ? "#64748B" : "#0F172A" }}>
                        2. Record Outcome &amp; References
                      </div>
                      {isPending && (
                        <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, background: "#E2E8F0", padding: "2px 8px", borderRadius: "4px" }}>
                          Locked until check is initiated
                        </span>
                      )}
                    </div>

                    {isPending ? (
                      <div style={{ fontSize: "12px", color: "#64748B", padding: "8px 0" }}>
                        Outcome and references cannot be recorded until a background check is initiated and in progress.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px", marginBottom: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Background Outcome Decision *</label>
                            <select
                              value={bgCheckOutcome}
                              onChange={(e) => setBgCheckOutcome(e.target.value as any)}
                              disabled={isSubmitting}
                              style={{
                                ...inputStyle,
                                fontSize: "12px",
                                padding: "7px 10px",
                                fontWeight: 700,
                                background: bgCheckOutcome === "cleared" ? "#ECFDF5" : bgCheckOutcome === "rejected" ? "#FEF2F2" : bgCheckOutcome === "flagged" ? "#FFFBEB" : "#FFF",
                              }}
                            >
                              <option value="" disabled>-- Select Verification Outcome --</option>
                              <option value="cleared">✓ Cleared (Clean Record, Eligible)</option>
                              <option value="flagged">⚠ Flagged (Discrepancy / Caution)</option>
                              <option value="rejected">✕ Rejected (Disqualified)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Verification Notes / Reference ID *</label>
                            <input
                              type="text"
                              placeholder="e.g. Cleared by PawGuard Registry ref #PG-BG-8921..."
                              value={bgCheckOutcomeNotes}
                              onChange={(e) => setBgCheckOutcomeNotes(e.target.value)}
                              disabled={isSubmitting}
                              style={{ ...inputStyle, fontSize: "12px", padding: "7px 10px" }}
                            />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px", alignItems: "center", borderTop: "1px dashed #E2E8F0", paddingTop: "10px", marginBottom: "10px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={reviewForm.references_checked}
                              onChange={(e) => setReviewForm({ ...reviewForm, references_checked: e.target.checked })}
                              disabled={isSubmitting}
                            />
                            Personal &amp; Vet References Checked
                          </label>
                          <input
                            type="text"
                            placeholder="Reference verification notes or veterinarian check summary..."
                            value={reviewForm.reference_notes}
                            onChange={(e) => setReviewForm({ ...reviewForm, reference_notes: e.target.value })}
                            disabled={isSubmitting}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            disabled={isSubmitting || !bgCheckOutcome}
                            onClick={handleSaveBackgroundCheckOutcome}
                            style={{
                              padding: "7px 16px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              background: !bgCheckOutcome || isSubmitting ? "#F1F5F9" : "#0F172A",
                              color: !bgCheckOutcome || isSubmitting ? "#94A3B8" : "#FFF",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: !bgCheckOutcome || isSubmitting ? "not-allowed" : "pointer",
                            }}
                          >
                            {isSubmitting ? "Saving Outcome..." : "Save Background Check Outcome"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Navigation */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => setReviewActiveStep(1)}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaArrowLeft size={11} /> Back to Application
                      </button>
                      <button
                        type="button"
                        disabled={!isCleared}
                        onClick={() => setReviewActiveStep(3)}
                        style={{
                          padding: "9px 18px",
                          borderRadius: "8px",
                          border: "none",
                          background: isCleared ? "#2563EB" : "#94A3B8",
                          color: "#FFF",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: isCleared ? "pointer" : "not-allowed",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        Continue to Home Inspection <FaArrowRight size={11} />
                      </button>
                    </div>
                    {continueHelpText && (
                      <div style={{ fontSize: "12px", color: isRejected ? "#DC2626" : isFlagged ? "#D97706" : "#64748B", textAlign: "right", fontWeight: 500 }}>
                        {isRejected ? `⚠️ ${continueHelpText}` : isFlagged ? `⚠️ ${continueHelpText}` : `ℹ️ ${continueHelpText}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* STEP 3: HOME & YARD INSPECTION */}
            {reviewActiveStep === 3 && (() => {
              const status = String(reviewForm.home_inspection_status || "pending").toLowerCase();
              const isApproved = reviewForm.home_inspection_passed === true || status === "approved" || status === "passed";
              const isScheduled = status === "scheduled";
              const isInProgress = status === "in_progress";
              const isCompleted = status === "completed";
              const isRejected = status === "rejected" || status === "failed";

              const badge = isApproved
                ? { label: "Approved", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" }
                : isScheduled
                ? { label: "Scheduled", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" }
                : isInProgress
                ? { label: "In Progress", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" }
                : isCompleted
                ? { label: "Completed", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" }
                : isRejected
                ? { label: "Rejected", bg: "#FEF2F2", color: "#DC2626", border: "#FCA5A5" }
                : { label: "Pending", bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1" };

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Compact Status Card */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Home Inspection Status</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontSize: "12px",
                            fontWeight: 800,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.label}
                        </span>
                        {isRejected && (
                          <span style={{ fontSize: "12px", color: "#DC2626", fontWeight: 600 }}>
                            Requires attention before final approval.
                          </span>
                        )}
                      </div>
                    </div>
                    {reviewForm.home_inspection_notes && (
                      <div style={{ fontSize: "12px", color: "#475569", maxWidth: "350px", textAlign: "right" }}>
                        <strong>Notes:</strong> {reviewForm.home_inspection_notes}
                      </div>
                    )}
                  </div>

                  {/* Sub-Step Navigation Pills */}
                  <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "8px" }}>
                    {[
                      { id: "schedule", label: "3A. Schedule Inspection" },
                      { id: "checklist", label: `3B. Inspection Checklist ${inspectionEvidenceList.length > 0 ? `(${inspectionEvidenceList.length} docs)` : ""}` },
                      { id: "decision", label: "3C. Final Inspection Decision" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setInspectionSubStep(st.id as any)}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "none",
                          fontSize: "12px",
                          fontWeight: inspectionSubStep === st.id ? 800 : 600,
                          background: inspectionSubStep === st.id ? "#0F172A" : "transparent",
                          color: inspectionSubStep === st.id ? "#FFF" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* 3A: Schedule Inspection */}
                  {inspectionSubStep === "schedule" && (
                    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Scheduled Date &amp; Time *</label>
                          <input
                            type="datetime-local"
                            value={inspectionScheduleForm.scheduled_at}
                            onChange={(e) => setInspectionScheduleForm({ ...inspectionScheduleForm, scheduled_at: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Inspector Name</label>
                          <input
                            type="text"
                            placeholder="Assigned inspector full name..."
                            value={inspectionScheduleForm.inspector_name}
                            onChange={(e) => setInspectionScheduleForm({ ...inspectionScheduleForm, inspector_name: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Inspection Type</label>
                          <select
                            value={inspectionScheduleForm.inspection_type}
                            onChange={(e) => setInspectionScheduleForm({ ...inspectionScheduleForm, inspection_type: e.target.value as any })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          >
                            <option value="physical">In-Person Physical Visit</option>
                            <option value="virtual">Virtual Video Walkthrough</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Site Address</label>
                          <input
                            type="text"
                            placeholder="Caregiver residence address..."
                            value={inspectionScheduleForm.address}
                            onChange={(e) => setInspectionScheduleForm({ ...inspectionScheduleForm, address: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                      </div>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Scheduling Notes / Access Instructions</label>
                        <input
                          type="text"
                          placeholder="Gate codes, appointment instructions..."
                          value={inspectionScheduleForm.notes}
                          onChange={(e) => setInspectionScheduleForm({ ...inspectionScheduleForm, notes: e.target.value })}
                          style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleScheduleHomeInspection}
                          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Schedule Inspection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3B: Inspection Checklist */}
                  {inspectionSubStep === "checklist" && (
                    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Yard Condition &amp; Containment</label>
                          <select
                            value={inspectionAuditForm.yard_condition}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, yard_condition: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          >
                            <option value="Secure & Escape-Proof">Secure &amp; Escape-Proof Yard</option>
                            <option value="Adequate Yard (Minor maintenance needed)">Adequate Yard (Minor maintenance)</option>
                            <option value="Unfenced Yard (Leash required)">Unfenced Yard (Leash required)</option>
                            <option value="Apartment / Balcony Only">Apartment / Balcony Only</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Fencing Condition &amp; Height</label>
                          <select
                            value={inspectionAuditForm.fencing_condition}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, fencing_condition: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          >
                            <option value="High Fence (6ft+ Privacy/Chainlink)">High Fence (6ft+ Secure)</option>
                            <option value="Medium Fence (4-5ft)">Medium Fence (4-5ft)</option>
                            <option value="Low Fence (<4ft)">Low Fence (&lt;4ft)</option>
                            <option value="No Perimeter Fencing">No Perimeter Fencing</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Household Information</label>
                          <input
                            type="text"
                            placeholder="Cleanliness, space, crate setup..."
                            value={inspectionAuditForm.household_info}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, household_info: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Existing Pets Information</label>
                          <input
                            type="text"
                            placeholder="Resident animals, temperaments, vaccines..."
                            value={inspectionAuditForm.existing_pets_info}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, existing_pets_info: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Hazards / Environmental Safety</label>
                          <input
                            type="text"
                            placeholder="Chemicals, pool, toxic plants, open wires..."
                            value={inspectionAuditForm.hazards}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, hazards: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Suitability Rating (1-5)</label>
                          <select
                            value={inspectionAuditForm.rating}
                            onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, rating: Number(e.target.value) })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px", fontWeight: 700 }}
                          >
                            <option value={5}>⭐⭐⭐⭐⭐ 5/5 (Exceptional)</option>
                            <option value={4}>⭐⭐⭐⭐ 4/5 (Very Good)</option>
                            <option value={3}>⭐⭐⭐ 3/5 (Acceptable)</option>
                            <option value={2}>⭐⭐ 2/5 (Marginal)</option>
                            <option value={1}>⭐ 1/5 (Unsuitable)</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Inspector Notes</label>
                        <input
                          type="text"
                          placeholder="General observations, landlord permission confirmed..."
                          value={inspectionAuditForm.notes}
                          onChange={(e) => setInspectionAuditForm({ ...inspectionAuditForm, notes: e.target.value })}
                          style={{ ...inputStyle, fontSize: "12px", padding: "6px 8px" }}
                        />
                      </div>

                      {/* Evidence Documents Section */}
                      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Evidence Photos / Lease Authorizations (JPEG, PNG, PDF)</span>
                          <label style={{ padding: "4px 10px", borderRadius: "6px", background: "#2563EB", color: "#FFF", fontSize: "11px", fontWeight: 700, cursor: isUploadingEvidence ? "not-allowed" : "pointer" }}>
                            {isUploadingEvidence ? "Uploading..." : "+ Upload File"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/jpg,application/pdf"
                              onChange={handleUploadInspectionEvidence}
                              disabled={isUploadingEvidence}
                              style={{ display: "none" }}
                            />
                          </label>
                        </div>
                        {inspectionEvidenceList.length === 0 ? (
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>No photos or documents attached yet.</div>
                        ) : (
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {inspectionEvidenceList.map((url, idx) => (
                              <div key={idx} style={{ padding: "4px 8px", borderRadius: "4px", background: "#FFF", border: "1px solid #CBD5E1", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>📎 Document #{idx + 1}</span>
                                <a href={url} target="_blank" rel="noreferrer" style={{ color: "#2563EB", fontWeight: 700, textDecoration: "none" }}>View</a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleSaveHomeInspectionAudit}
                          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#059669", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Save Inspection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3C: Final Inspection Decision */}
                  {inspectionSubStep === "decision" && (
                    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px", marginBottom: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Final Inspection Decision *</label>
                          <select
                            value={inspectionOutcomeForm.outcome}
                            onChange={(e) => setInspectionOutcomeForm({ ...inspectionOutcomeForm, outcome: e.target.value as any })}
                            style={{
                              ...inputStyle,
                              fontSize: "12px",
                              padding: "7px 10px",
                              fontWeight: 700,
                              background: inspectionOutcomeForm.outcome === "approved" ? "#ECFDF5" : "#FEF2F2",
                            }}
                          >
                            <option value="approved">✓ Approved (Home &amp; Yard Passed)</option>
                            <option value="rejected">✕ Rejected (Unsuitable Environment)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Decision Notes / Reason *</label>
                          <input
                            type="text"
                            placeholder={inspectionOutcomeForm.outcome === "rejected" ? "Mandatory rejection reason..." : "Approval notes, verified fence & space..."}
                            value={inspectionOutcomeForm.notes}
                            onChange={(e) => setInspectionOutcomeForm({ ...inspectionOutcomeForm, notes: e.target.value })}
                            style={{ ...inputStyle, fontSize: "12px", padding: "7px 10px" }}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleSaveHomeInspectionOutcome}
                          style={{ padding: "8px 18px", borderRadius: "6px", border: "none", background: inspectionOutcomeForm.outcome === "approved" ? "#059669" : "#DC2626", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                        >
                          Save Inspection Decision
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setReviewActiveStep(2)}
                      style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FaArrowLeft size={11} /> Back to Background Check
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewActiveStep(4)}
                      style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      Continue to Final Review <FaArrowRight size={11} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 4: FINAL COORDINATOR REVIEW & DECISION */}
            {reviewActiveStep === 4 && (() => {
              const rawAppStatus = String(selectedFoster.status || "applied").toLowerCase();
              const appStatusLabel = rawAppStatus === "approved"
                ? "Approved"
                : rawAppStatus === "rejected"
                ? "Application Rejected"
                : rawAppStatus === "inactive"
                ? "Inactive"
                : "Applied (Pending Review)";

              const bgStatus = String(reviewForm.background_check_status || "pending").toLowerCase();
              const bgPassed = reviewForm.background_check_passed === true || bgStatus === "cleared" || bgStatus === "passed";
              const bgStatusLabel = bgPassed ? "Cleared" : bgStatus.charAt(0).toUpperCase() + bgStatus.slice(1);

              const homeStatus = String(reviewForm.home_inspection_status || "pending").toLowerCase();
              const homePassed = reviewForm.home_inspection_passed === true || homeStatus === "approved" || homeStatus === "passed";
              const homeStatusLabel = homePassed ? "Approved" : homeStatus.charAt(0).toUpperCase() + homeStatus.slice(1);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Summary Grid */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>APPLICATION STATUS</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: rawAppStatus === "approved" ? "#059669" : rawAppStatus === "rejected" ? "#DC2626" : "#B45309", marginTop: "2px" }}>
                        {appStatusLabel}
                      </div>
                    </div>

                    <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>BACKGROUND CHECK</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: bgPassed ? "#059669" : bgStatus === "rejected" || bgStatus === "failed" ? "#DC2626" : "#D97706", marginTop: "2px" }}>
                        {bgPassed ? "✓ Cleared" : bgStatusLabel}
                        {reviewForm.references_checked ? " • References Checked" : ""}
                      </div>
                    </div>

                    <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>HOME INSPECTION</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: homePassed ? "#059669" : homeStatus === "rejected" || homeStatus === "failed" ? "#DC2626" : "#D97706", marginTop: "2px" }}>
                        {homePassed ? "✓ Approved" : homeStatusLabel}
                        {inspectionAuditForm.rating ? ` (Rating: ${inspectionAuditForm.rating}/5)` : ""}
                      </div>
                    </div>

                    <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>CAPACITY &amp; PREFERENCES</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#2563EB", marginTop: "2px" }}>
                        {reviewForm.max_capacity} Animals Max &bull; <span style={{ color: "#0F172A", fontWeight: 600 }}>{reviewForm.preferences || "Any"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Coordinator Evaluation Notes */}
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", textTransform: "uppercase" }}>
                        Coordinator Evaluation Notes
                      </label>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSaveVettingProgress}
                        style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}
                      >
                        Save Vetting Progress
                      </button>
                    </div>
                    <textarea
                      placeholder="Enter coordinator vetting notes, evaluation observations, or notes..."
                      value={reviewForm.vetting_notes}
                      onChange={(e) => setReviewForm({ ...reviewForm, vetting_notes: e.target.value })}
                      style={{ ...inputStyle, minHeight: "65px", fontSize: "13px" }}
                    />
                  </div>

                  {/* Inline Rejection Prompt */}
                  {isRejectConfirmOpen ? (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontWeight: 800, color: "#991B1B", fontSize: "13px" }}>
                        Confirm Application Rejection for {selectedFoster.foster_family}
                      </div>
                      <input
                        type="text"
                        placeholder="Enter rejection reason..."
                        value={rejectReasonText}
                        onChange={(e) => setRejectReasonText(e.target.value)}
                        style={{ ...inputStyle, borderColor: "#FCA5A5", fontSize: "13px" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setIsRejectConfirmOpen(false)}
                          style={{ padding: "7px 14px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleConfirmReject}
                          style={{ padding: "7px 16px", borderRadius: "6px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                        >
                          {isSubmitting ? "Rejecting..." : "Confirm Reject"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Bottom Action Bar */
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => setReviewActiveStep(3)}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaArrowLeft size={11} /> Back to Home Inspection
                      </button>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setIsRejectConfirmOpen(true)}
                          style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                        >
                          Reject Application
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={handleConfirmApprove}
                          style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <FaCheckCircle /> {isSubmitting ? "Approving..." : "Approve Application"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Detailed Active Placement Modal */}
      <Modal
        isOpen={isPlacementDetailModalOpen}
        onClose={() => setIsPlacementDetailModalOpen(false)}
        title="Active Foster Placement Details"
        maxWidth="750px"
      >
        {selectedPlacementDetail && (() => {
          const p = selectedPlacementDetail;
          const dogId = String(p.dog_id || p.dog?.id || "");
          const dogObj = p.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal Placement");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;
          const photoUrl = getPetPhoto(dogObj);
          const placedAt = p.placed_at || p.start_date || p.created_at;
          const durationStr = getDurationInCare(placedAt);
          const expectedReturn = p.expected_return_date || p.expected_return || p.end_date;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Pet & Placement Header Card */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={dogName} style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover", border: "1px solid #CBD5E1" }} />
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "12px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                      <FaDog />
                    </div>
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>{dogName}</h2>
                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                      {breed ? `${breed} • ` : ""}
                      {dogObj?.gender ? `${dogObj.gender} • ` : ""}
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#64748B" }}>Pet ID: {dogId || "N/A"}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                      Placement Ref ID: <span style={{ fontFamily: "monospace" }}>{p.id}</span>
                    </div>
                  </div>
                </div>

                <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>
                  {p.status || "Active Placement"}
                </span>
              </div>

              {/* Grid Section: Caregiver Info & Placement Timeline */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Caregiver Card */}
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaHome color="#2563EB" /> Foster Caregiver Information
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>{p.foster_family}</div>
                  {p.caregiver_email && (
                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                      Email: <strong>{p.caregiver_email}</strong>
                    </div>
                  )}
                  {p.caregiver_phone && (
                    <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                      Phone: <strong>{p.caregiver_phone}</strong>
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px" }}>
                    Profile ID: <span style={{ fontFamily: "monospace" }}>{p.profile_id}</span>
                  </div>
                </div>

                {/* Placement Timeline Card */}
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaCalendarAlt color="#6366F1" /> Placement Timeline
                  </div>
                  <div style={{ fontSize: "13px", color: "#334155" }}>
                    Placed On: <strong>{placedAt ? formatDateTime(placedAt) : "N/A"}</strong>
                  </div>
                  {durationStr && (
                    <div style={{ fontSize: "13px", color: "#2563EB", fontWeight: 700, marginTop: "4px" }}>
                      Care Duration: {durationStr}
                    </div>
                  )}
                  {expectedReturn && (
                    <div style={{ fontSize: "13px", color: "#B45309", fontWeight: 600, marginTop: "4px" }}>
                      Expected Return: <strong>{formatDateTime(expectedReturn)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {p.notes && (
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Placement Agreement Notes</div>
                  <div style={{ fontSize: "13px", color: "#1E293B", whiteSpace: "pre-line" }}>{p.notes}</div>
                </div>
              )}

              {/* Care & Monitoring Progress Logs */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaClipboardList color="#2563EB" /> Care &amp; Monitoring Progress History
                </div>
                {placementDetailLoading ? (
                  <div style={{ fontSize: "13px", color: "#64748B", textAlign: "center", padding: "12px" }}>Loading care logs...</div>
                ) : placementProgressLogs.length === 0 ? (
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "14px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                    No progress reports yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                    {placementProgressLogs.map((log: any, idx: number) => (
                      <div key={idx} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", fontSize: "13px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                          <span>LOG #{idx + 1}</span>
                          <span>{log.created_at ? formatDateTime(log.created_at) : ""}</span>
                        </div>
                        <div style={{ fontWeight: 700, color: "#0F172A" }}>
                          Weight: {log.weight_kg ? `${log.weight_kg} kg` : "N/A"} • Mood Rating: {log.mood_rating || "N/A"}/5
                        </div>
                        {log.behavior_notes && <div style={{ color: "#334155", marginTop: "2px" }}><strong>Behavior:</strong> {log.behavior_notes}</div>}
                        {log.feeding_notes && <div style={{ color: "#334155", marginTop: "2px" }}><strong>Feeding:</strong> {log.feeding_notes}</div>}
                        {log.medication_notes && <div style={{ color: "#334155", marginTop: "2px" }}><strong>Medication:</strong> {log.medication_notes}</div>}
                        {log.notes && <div style={{ color: "#334155", marginTop: "2px" }}><strong>Notes:</strong> {log.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Supply Dispatches */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaBoxOpen color="#7E22CE" /> Supply Dispatches Log
                </div>
                {placementDetailLoading ? (
                  <div style={{ fontSize: "13px", color: "#64748B", textAlign: "center", padding: "12px" }}>Loading supply logs...</div>
                ) : placementSuppliesList.length === 0 ? (
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "14px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                    No supply dispatches logged yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                    {placementSuppliesList.map((sup: any, idx: number) => (
                      <div key={idx} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "#7E22CE", textTransform: "capitalize" }}>{sup.item_type}</strong>: {sup.description || "N/A"}
                        </div>
                        <span style={{ fontWeight: 700, color: "#475569" }}>Qty: {sup.quantity || 1}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons Bar */}
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacementDetailModalOpen(false);
                      openLogProgressModal(p);
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaClipboardList /> Log Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacementDetailModalOpen(false);
                      setSelectedPlacement(p);
                      setIsSupplyModalOpen(true);
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #C084FC", background: "#F3E8FF", color: "#7E22CE", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaBoxOpen /> Log Supply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacementDetailModalOpen(false);
                      handleOpenVetCheckModal(p);
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #6EE7B7", background: "#ECFDF5", color: "#047857", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaStethoscope /> Request Vet Check
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacementDetailModalOpen(false);
                      handleOpenConvertModal(p);
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #F472B6", background: "#FDF2F8", color: "#DB2777", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaHeart /> Convert to Adopt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlacementDetailModalOpen(false);
                      handleOpenReturnModal(p);
                    }}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaUndo /> Return to Shelter
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Convert to Permanent Adoption Confirmation Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert Foster Placement to Permanent Adoption"
        maxWidth="620px"
      >
        {selectedPlacementForConvert && (() => {
          const p = selectedPlacementForConvert;
          const dogId = String(p.dog_id || p.dog?.id || "");
          const dogObj = p.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;
          const caregiverProfile = fosters.find(
            (f) => f.id === (p.profile_id || p.foster_id || p.foster_profile_id)
          );
          const isPlacementActive = Boolean(
            p.is_active || p.status === "active" || (!p.returned_at && p.status !== "converted_to_adopt")
          );
          const hasValidDog = Boolean(p.dog_id || p.dog?.id);
          const bgCheckPassed = Boolean(
            p.background_check_passed ?? caregiverProfile?.background_check_passed
          );
          const homeInspectionPassed = Boolean(
            p.home_inspection_passed ?? caregiverProfile?.home_inspection_passed
          );
          const isDogAlreadyAdopted = dogObj?.status === "adopted";
          const isReturnInProgress = Boolean(
            p.status === "return_pending" || p.status === "returned" || p.returned_at
          );

          return (
            <form onSubmit={handleConfirmConvertToAdopt} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#FDF2F8", border: "1px solid #FBCFE8", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <FaHeart size={24} color="#DB2777" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "#831843" }}>
                    Confirm Permanent Adoption Transition
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#9D174D", lineHeight: "1.5" }}>
                    You are initiating permanent adoption for <strong>{dogName}</strong> {breed ? `(${breed})` : ""} with current foster caregiver <strong>{p.foster_family}</strong>.
                  </p>
                </div>
              </div>

              {/* Placement & Pet Verification Summary */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Pet / Animal</span>
                    <strong style={{ color: "#0F172A", fontSize: "14px" }}>{dogName}</strong> {breed ? <span style={{ color: "#64748B", fontSize: "12px" }}>({breed})</span> : null}
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Foster Caregiver</span>
                    <strong style={{ color: "#0F172A", fontSize: "14px" }}>{p.foster_family || "Bobby"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Current Placement Status</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800 }}>
                      ● ACTIVE FOSTER
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>Current Adoption Status</span>
                    {dogObj?.status === "adopted" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800 }}>
                        ⚠️ ADOPTED (Database Conflict)
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800 }}>
                        NOT ADOPTED / FOSTER
                      </span>
                    )}
                  </div>
                </div>

                {/* Target intended transition divider */}
                <div style={{ borderTop: "1px dashed #CBD5E1", paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ color: "#64748B", fontSize: "11px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                      Target Outcome (Upon Confirmation)
                    </span>
                    <div style={{ fontSize: "11px", color: "#9D174D" }}>
                      Intended permanent transition &mdash; not current state
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FDF2F8", color: "#DB2777", border: "1px solid #FBCFE8", padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 800 }}>
                    <FaHeart size={12} /> Permanent Adoption
                  </span>
                </div>
              </div>

              {/* Data Inconsistency Warning Banner if pet is already adopted in registry */}
              {isDogAlreadyAdopted && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#92400E", lineHeight: "1.5" }}>
                  <strong>⚠️ Backend State Conflict Warning:</strong> This dog&apos;s master registry status is currently recorded as <strong>&quot;adopted&quot;</strong> in the database (or has an existing completed adoption application), while this foster placement remains active. Attempting conversion will validate this against the backend. If an existing adoption record locks this animal, the backend will return HTTP 409 Conflict.
                </div>
              )}

              {/* Real Backend Conflict Error Banner */}
              {convertConflictError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", padding: "12px 14px", fontSize: "12px", color: "#991B1B", lineHeight: "1.5" }}>
                  <div style={{ fontWeight: 800, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🚫 Backend Conversion Conflict (HTTP 409)</span>
                  </div>
                  <div>{convertConflictError}</div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#7F1D1D" }}>
                    Real backend records refreshed. This placement cannot be converted while a conflicting adoption record exists.
                  </div>
                </div>
              )}

              {/* Prerequisites Verification Checklist */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", fontSize: "12px" }}>
                <div style={{ fontWeight: 700, color: "#1E293B", marginBottom: "8px" }}>
                  Pre-Conversion Prerequisites Validation:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isPlacementActive ? (
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ Placement Active</span>
                    ) : (
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>✗ Placement Inactive</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {hasValidDog ? (
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ Pet Profile Linked</span>
                    ) : (
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>✗ Missing Pet Profile</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {bgCheckPassed ? (
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ Caregiver Background Check Cleared</span>
                    ) : (
                      <span style={{ color: "#D97706", fontWeight: 700 }}>⚠️ Background Check Pending</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {homeInspectionPassed ? (
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ Home Inspection Approved</span>
                    ) : (
                      <span style={{ color: "#D97706", fontWeight: 700 }}>⚠️ Home Inspection Pending</span>
                    )}
                  </div>
                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "6px" }}>
                    {isDogAlreadyAdopted ? (
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>⚠️ Conflict: Pet is already marked as Adopted in database</span>
                    ) : isReturnInProgress ? (
                      <span style={{ color: "#DC2626", fontWeight: 700 }}>⚠️ Return to shelter in progress</span>
                    ) : (
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>✓ No Conflicting Adoption or Return In Progress</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Adoption Agreement &amp; Conversion Notes
                </label>
                <textarea
                  placeholder="Enter adoption agreement or transition notes..."
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: "75px", fontSize: "13px" }}
                />
              </div>

              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "10px 12px" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "#92400E", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    required
                    checked={convertLegalConfirmed}
                    onChange={(e) => setConvertLegalConfirmed(e.target.checked)}
                    style={{ marginTop: "2px" }}
                  />
                  <span>
                    I confirm that the caregiver family has signed all required legal adoption agreements and the shelter management record should be finalized as Adopted.
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsConvertModalOpen(false);
                    setConvertConflictError(null);
                  }}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !convertLegalConfirmed}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: !convertLegalConfirmed || isSubmitting ? "#94A3B8" : "#DB2777",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: !convertLegalConfirmed || isSubmitting ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaHeart /> {isSubmitting ? "Converting..." : "Confirm Permanent Adoption"}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>
    </div>
  );
};

export default FosterManagement;
