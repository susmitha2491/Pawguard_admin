import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import Modal from "../../components/common/Modal";
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
} from "react-icons/fa";
import fosterService, {
  type FosterProfileUpdatePayload,
  type FosterPlacementPayload,
  type FosterProgressLogPayload,
  type FosterSupplyDispatchPayload,
} from "../../services/fosterService";
import petService from "../../services/petService";
import vetService from "../../services/vetService";
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
      return resData.error.message.trim();
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
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedPlacementForConvert, setSelectedPlacementForConvert] = useState<any | null>(null);
  const [convertNotes, setConvertNotes] = useState("");
  const [selectedFoster, setSelectedFoster] = useState<FosterProfileRow | null>(null);

  // Application Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewStep, setReviewStep] = useState<"review" | "confirm_approve" | "confirm_reject">("review");
  const [reviewForm, setReviewForm] = useState({
    max_capacity: 2,
    preferences: "",
    notes: "",
    background_check_passed: false,
    background_check_notes: "",
    references_checked: false,
    reference_notes: "",
    home_inspection_passed: false,
    home_inspection_notes: "",
    home_inspection_address: "",
    vetting_notes: "",
    rejection_reason: "",
  });

  const handleOpenReview = (foster: FosterProfileRow) => {
    const raw = foster.raw || {};
    setSelectedFoster(foster);
    setReviewForm({
      max_capacity: Number(foster.max_capacity || 1),
      preferences: foster.preferences || "",
      notes: foster.notes || "",
      background_check_passed: Boolean(raw.background_check_passed ?? foster.background_check_passed),
      background_check_notes: raw.background_check_notes || "",
      references_checked: Boolean(raw.references_checked),
      reference_notes: raw.reference_notes || "",
      home_inspection_passed: Boolean(raw.home_inspection_passed ?? foster.home_inspection_passed),
      home_inspection_notes: raw.home_inspection_notes || "",
      home_inspection_address: raw.home_inspection_address || "",
      vetting_notes: raw.vetting_notes || "",
      rejection_reason: "",
    });
    setReviewStep("review");
    setIsReviewModalOpen(true);
  };

  const handleSaveVettingProgress = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
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
      });
      addToast("Vetting progress saved successfully!", "success");
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to save vetting progress.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      await fosterService.updateProfile(selectedFoster.id, {
        status: "approved",
        is_available: true,
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
      addToast(`Approved ${selectedFoster.foster_family} as an active Foster Caregiver!`, "success");
      setIsReviewModalOpen(false);
      setSelectedFoster(null);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to approve foster profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      const notesPayload = reviewForm.rejection_reason || reviewForm.vetting_notes || reviewForm.notes;
      await fosterService.updateProfile(selectedFoster.id, {
        status: "rejected",
        is_available: false,
        vetting_notes: notesPayload,
        background_check_notes: reviewForm.background_check_notes,
        home_inspection_notes: reviewForm.home_inspection_notes,
      });
      addToast(`Rejected application for ${selectedFoster.foster_family}.`, "info");
      setIsReviewModalOpen(false);
      setSelectedFoster(null);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to reject foster application.";
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

  const [returnNotes, setReturnNotes] = useState("");

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

  const fetchFosters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fosterService.getFosterProfiles();
      const list = unwrapList(response);

      const formatted: FosterProfileRow[] = list.map((item: any) => {
        const user = item.user || {};
        const name = user.full_name || user.name || user.email || item.foster_name || item.id || "Foster Parent";
        return {
          id: String(item.id || item.profile_id || ""),
          foster_family: String(name),
          status: String(item.status || (item.is_available ? "approved" : "applied")),
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
      fetchPlacements(formatted);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load foster profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchPlacements = useCallback(async (fosterProfiles: FosterProfileRow[]) => {
    try {
      setPlacementsLoading(true);
      setPlacementsError(null);
      const activeProfiles = fosterProfiles.filter(
        (f) => f.status === "approved" || Number(f.active_count || 0) > 0
      );
      if (activeProfiles.length === 0) {
        setActivePlacements([]);
        setPlacementsLoading(false);
        return;
      }
      const results = await Promise.allSettled(
        activeProfiles.map((f) => fosterService.getProfilePlacements(f.id))
      );
      const allPlacements: any[] = [];
      results.forEach((res, idx) => {
        if (res.status === "fulfilled" && res.value) {
          const list = unwrapList(res.value);
          const f = activeProfiles[idx];
          list.forEach((p: any) => {
            if (p.is_active || p.status === "active" || (!p.returned_at && p.status !== "converted_to_adopt")) {
              allPlacements.push({
                ...p,
                foster_family: f.foster_family,
                profile_id: f.id,
                caregiver_email: f.user?.email || f.raw?.user?.email || "",
                caregiver_phone: f.user?.phone || f.raw?.user?.phone || "",
                caregiver_raw: f.raw,
              });
            }
          });
        }
      });
      setActivePlacements(allPlacements);
    } catch (err: any) {
      setPlacementsError(
        err?.response?.data?.detail || err?.response?.data?.message || "Failed to load active foster placements."
      );
      setActivePlacements([]);
    } finally {
      setPlacementsLoading(false);
    }
  }, []);

  const fetchDogs = useCallback(async () => {
    try {
      const dogsRes = await petService.getPets({ page_size: 100 });
      const list = unwrapList(dogsRes);
      const map = new Map<string, any>();
      const dogOptions: any[] = [];
      list.forEach((d: any) => {
        const id = String(d.id || d.dog_id || "");
        if (id) map.set(id, d);
        dogOptions.push({
          ...d,
          id,
          name: d.name || "Dog",
          label: `${d.name || "Dog"} (${d.registration_number || id.slice(0, 8)})`,
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

  useEffect(() => {
    fetchFosters();
    fetchDogs();
  }, [fetchFosters, fetchDogs]);

  useEffect(() => {
    if (searchParams.get("action")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

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
      await fosterService.returnDog(selectedPlacement.id, returnNotes);
      if (dogId) {
        await petService.updatePet(dogId, {
          status: "shelter_care",
          shelter_status: "In Shelter",
          is_adoptable: true,
        }).catch(() => null);
      }
      addToast("Dog returned from foster care to shelter & Dog Master updated!", "success");
      setIsReturnModalOpen(false);
      setSelectedPlacement(null);
      setReturnNotes("");
      fetchFosters();
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
      await fosterService.logSupplyDispatch(selectedPlacement.id, supplyForm);
      addToast("Logged supply dispatch for foster placement!", "success");
      setIsSupplyModalOpen(false);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to log supply dispatch.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenConvertModal = (placement: any) => {
    setSelectedPlacementForConvert(placement);
    setConvertNotes(
      placement?.notes
        ? `Converted from active foster stay (${placement.notes})`
        : "Finalized foster stay and converted to permanent adoption."
    );
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

    try {
      setIsSubmitting(true);
      await fosterService.convertToAdopt(placementId, convertNotes);
      if (dogId) {
        await petService.updatePet(dogId, {
          status: "adopted",
          shelter_status: "Adopted",
          is_adoptable: false,
        }).catch(() => null);
      }
      addToast("Foster placement successfully converted into permanent adoption!", "success");
      setIsConvertModalOpen(false);
      setIsPlacementDetailModalOpen(false);
      setSelectedPlacementForConvert(null);
      setConvertNotes("");
      fetchFosters();
      fetchDogs();
      notifyDataChanged();
    } catch (err: any) {
      const errMsg = extractBackendErrorMessage(err, "Failed to convert foster placement to adoption.");
      addToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestMedical = async (dogId: string, notes?: string) => {
    if (!dogId) return;
    try {
      setIsSubmitting(true);
      await vetService.bookAppointment({
        pet_id: dogId,
        appointment_type: "Foster Care Medical Check",
        notes: notes || "Medical evaluation requested for fostered animal.",
        scheduled_at: new Date().toISOString(),
      });
      addToast("Veterinary medical check request booked successfully!", "success");
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to book medical evaluation.", "error");
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
      render: (_v, row) => (
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
              background: row.status === "approved" ? "#ECFDF5" : row.status === "applied" ? "#FEF3C7" : "#F1F5F9",
              color: row.status === "approved" ? "#047857" : row.status === "applied" ? "#B45309" : "#475569",
            }}
          >
            {row.status}
          </span>
          <div style={{ fontSize: "11px", color: "#64748B", display: "flex", gap: "6px" }}>
            <span>Bg Check: {row.background_check_passed ? "✓ Clear" : "Pending"}</span>
            <span>Home Insp: {row.home_inspection_passed ? "✓ Passed" : "Pending"}</span>
          </div>
        </div>
      ),
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
            renderRowActions={(row: FosterProfileRow) => (
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                {(row.status === "applied" || row.status === "pending") ? (
                  <button
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
                ) : (
                  <button
                    onClick={() => void openFosterDetail(row)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #93C5FD",
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Inspect Profile
                  </button>
                )}
                {row.status === "approved" && (
                  <button
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
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Place Dog
                  </button>
                )}
              </div>
            )}
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
                onClick={() => fetchFosters()}
                title="Refresh Active Placements"
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaSync className={placementsLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {/* Loading State */}
          {placementsLoading ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748B", background: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <FaSync className="animate-spin" size={28} color="#2563EB" style={{ marginBottom: "12px" }} />
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#1E293B" }}>Loading active foster placements...</div>
              <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Retrieving active caregiver placement records</div>
            </div>
          ) : placementsError ? (
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
            /* Operational Card Roster Grid */
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
                            onClick: () => void handleRequestMedical(dogId),
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
                            onClick: () => {
                              setSelectedPlacement(p);
                              setIsReturnModalOpen(true);
                            },
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
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
              <option value="">Select foster parent...</option>
              {fosters.filter((f) => f.is_available).map((f) => (
                <option key={f.id} value={f.id}>{f.foster_family} (Capacity: {f.active_count}/{f.max_capacity})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dog *</label>
            <select required value={placeForm.dog_id} onChange={(e) => setPlaceForm({ ...placeForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
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
      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Return Dog to Shelter">
        <form onSubmit={handleReturnSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Confirm returning dog from placement <strong>{selectedPlacement?.id?.slice(0, 8)}</strong> to shelter facility?
          </p>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Return Notes</label>
            <textarea placeholder="e.g. Fully recovered, ready to return to shelter." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsReturnModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Returning..." : "Confirm Return"}</button>
          </div>
        </form>
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
                <div style={{ fontSize: "13px", fontWeight: 700, color: selectedFoster.background_check_passed ? "#059669" : "#D97706", marginTop: "4px" }}>
                  {selectedFoster.background_check_passed ? "✓ Passed / Verified" : "Pending Verification"}
                </div>
                {selectedFoster.raw?.background_check_notes && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Notes: {selectedFoster.raw.background_check_notes}</div>
                )}
              </div>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Home Inspection</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: selectedFoster.home_inspection_passed ? "#059669" : "#D97706", marginTop: "4px" }}>
                  {selectedFoster.home_inspection_passed ? "✓ Passed / Verified Yard" : "Pending Inspection"}
                </div>
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
              {(selectedFoster.status === "applied" || selectedFoster.status === "pending") && (
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

      {/* Comprehensive Application Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Foster Caregiver Application Review — ${selectedFoster?.foster_family || "Caregiver"}`}
        maxWidth="800px"
      >
        {selectedFoster && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Header / Applicant Summary Box */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedFoster.foster_family}</h2>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  Profile ID: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{selectedFoster.id}</span> &bull; Applied: {selectedFoster.created_at ? formatDateTime(selectedFoster.created_at) : "N/A"}
                </div>
                {selectedFoster.user?.email && (
                  <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                    Email: <strong>{selectedFoster.user.email}</strong> {selectedFoster.user?.phone ? `• Phone: ${selectedFoster.user.phone}` : ""}
                  </div>
                )}
              </div>
              <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", background: "#FEF3C7", color: "#B45309" }}>
                {selectedFoster.status} (REQUIRES REVIEW)
              </span>
            </div>

            {reviewStep === "review" && (
              <>
                {/* SECTION A: APPLICANT CAPACITY & PREFERENCES */}
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    A. Capacity &amp; Care Preferences
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Maximum Animal Capacity</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={reviewForm.max_capacity}
                        onChange={(e) => setReviewForm({ ...reviewForm, max_capacity: Number(e.target.value) })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>Animal / Care Preferences</label>
                      <input
                        type="text"
                        placeholder="e.g. Medium dogs, Medical Recovery, Cats"
                        value={reviewForm.preferences}
                        onChange={(e) => setReviewForm({ ...reviewForm, preferences: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  {selectedFoster.notes && (
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "#334155", background: "#F8FAFC", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                      <strong>Applicant Notes / Questionnaire:</strong> {selectedFoster.notes}
                    </div>
                  )}
                </div>

                {/* SECTION B: ELIGIBILITY & VERIFICATION CHECKS */}
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    B. Eligibility Verification &amp; Inspection Checks
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {/* Background Check */}
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Background Check Verification</label>
                        <select
                          value={reviewForm.background_check_passed ? "true" : "false"}
                          onChange={(e) => setReviewForm({ ...reviewForm, background_check_passed: e.target.value === "true" })}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", fontWeight: 700, background: reviewForm.background_check_passed ? "#ECFDF5" : "#FFFBEB", color: reviewForm.background_check_passed ? "#047857" : "#B45309" }}
                        >
                          <option value="true">✓ Clear / Verified</option>
                          <option value="false">⏳ Pending / Failed</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Background check notes / reference ID..."
                        value={reviewForm.background_check_notes}
                        onChange={(e) => setReviewForm({ ...reviewForm, background_check_notes: e.target.value })}
                        style={{ ...inputStyle, fontSize: "12px", padding: "6px 10px" }}
                      />
                    </div>

                    {/* Home Inspection */}
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Home &amp; Yard Inspection</label>
                        <select
                          value={reviewForm.home_inspection_passed ? "true" : "false"}
                          onChange={(e) => setReviewForm({ ...reviewForm, home_inspection_passed: e.target.value === "true" })}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", fontWeight: 700, background: reviewForm.home_inspection_passed ? "#ECFDF5" : "#FFFBEB", color: reviewForm.home_inspection_passed ? "#047857" : "#B45309" }}
                        >
                          <option value="true">✓ Passed (Fenced Yard Verified)</option>
                          <option value="false">⏳ Pending Inspection</option>
                        </select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <input
                          type="text"
                          placeholder="Home inspection notes..."
                          value={reviewForm.home_inspection_notes}
                          onChange={(e) => setReviewForm({ ...reviewForm, home_inspection_notes: e.target.value })}
                          style={{ ...inputStyle, fontSize: "12px", padding: "6px 10px" }}
                        />
                        <input
                          type="text"
                          placeholder="Inspection site address..."
                          value={reviewForm.home_inspection_address}
                          onChange={(e) => setReviewForm({ ...reviewForm, home_inspection_address: e.target.value })}
                          style={{ ...inputStyle, fontSize: "12px", padding: "6px 10px" }}
                        />
                      </div>
                    </div>

                    {/* Reference Checks */}
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <label style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Personal &amp; Vet References</label>
                        <select
                          value={reviewForm.references_checked ? "true" : "false"}
                          onChange={(e) => setReviewForm({ ...reviewForm, references_checked: e.target.value === "true" })}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px", fontWeight: 700, background: reviewForm.references_checked ? "#ECFDF5" : "#FFFBEB", color: reviewForm.references_checked ? "#047857" : "#B45309" }}
                        >
                          <option value="true">✓ Verified References</option>
                          <option value="false">⏳ Pending References</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Reference check notes..."
                        value={reviewForm.reference_notes}
                        onChange={(e) => setReviewForm({ ...reviewForm, reference_notes: e.target.value })}
                        style={{ ...inputStyle, fontSize: "12px", padding: "6px 10px" }}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: COORDINATOR VETTING EVALUATION NOTES */}
                <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    C. Coordinator Review Evaluation Notes
                  </div>
                  <textarea
                    placeholder="Enter coordinator vetting notes, evaluation summary, or comments..."
                    value={reviewForm.vetting_notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, vetting_notes: e.target.value })}
                    style={{ ...inputStyle, minHeight: "70px", fontSize: "13px" }}
                  />
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "14px" }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveVettingProgress}
                    style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    {isSubmitting ? "Saving..." : "Save Vetting Progress"}
                  </button>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setReviewStep("confirm_reject")}
                      style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                    >
                      Reject Application
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setReviewStep("confirm_approve")}
                      style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                    >
                      Approve Application
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: APPROVAL CONFIRMATION */}
            {reviewStep === "confirm_approve" && (
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3 style={{ margin: 0, color: "#166534", fontSize: "16px", fontWeight: 800 }}>
                  Confirm Approval for {selectedFoster.foster_family}
                </h3>
                <p style={{ margin: 0, color: "#15803D", fontSize: "13px" }}>
                  Please review the final vetting summary before approving this caregiver. Upon approval, the status will update to <strong>APPROVED &amp; ACTIVE</strong> and the caregiver will become available for animal placements.
                </p>

                <div style={{ background: "#FFF", borderRadius: "8px", border: "1px solid #DCFCE7", padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                  <div><strong>Applicant:</strong> {selectedFoster.foster_family}</div>
                  <div><strong>Max Capacity:</strong> {reviewForm.max_capacity} Animals</div>
                  <div><strong>Background Check:</strong> {reviewForm.background_check_passed ? "✓ Clear" : "Pending"}</div>
                  <div><strong>Home Inspection:</strong> {reviewForm.home_inspection_passed ? "✓ Passed" : "Pending"}</div>
                  <div><strong>References:</strong> {reviewForm.references_checked ? "✓ Verified" : "Pending"}</div>
                  <div><strong>Resulting Status:</strong> <span style={{ color: "#166534", fontWeight: 800 }}>APPROVED &amp; AVAILABLE</span></div>
                </div>

                {reviewForm.vetting_notes && (
                  <div style={{ fontSize: "12px", color: "#166534", background: "#DCFCE7", padding: "8px 12px", borderRadius: "6px" }}>
                    <strong>Vetting Notes:</strong> {reviewForm.vetting_notes}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setReviewStep("review")}
                    style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                  >
                    Back to Review
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmApprove}
                    style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}
                  >
                    {isSubmitting ? "Approving..." : "Confirm & Approve Application"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REJECTION CONFIRMATION */}
            {reviewStep === "confirm_reject" && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3 style={{ margin: 0, color: "#991B1B", fontSize: "16px", fontWeight: 800 }}>
                  Confirm Application Rejection for {selectedFoster.foster_family}
                </h3>
                <p style={{ margin: 0, color: "#B91C1C", fontSize: "13px" }}>
                  Please provide the rejection reason or evaluation notes. The status will update to <strong>REJECTED</strong> and availability will be set to inactive.
                </p>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#991B1B", marginBottom: "6px" }}>Rejection Reason / Vetting Notes</label>
                  <textarea
                    placeholder="Enter reason for rejection..."
                    value={reviewForm.rejection_reason || reviewForm.vetting_notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })}
                    style={{ ...inputStyle, minHeight: "80px", borderColor: "#FCA5A5" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setReviewStep("review")}
                    style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                  >
                    Back to Review
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmReject}
                    style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}
                  >
                    {isSubmitting ? "Rejecting..." : "Confirm & Reject Application"}
                  </button>
                </div>
              </div>
            )}
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
                      void handleRequestMedical(dogId);
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
                      setSelectedPlacement(p);
                      setIsReturnModalOpen(true);
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
        title="Convert Foster Placement to Adoption"
        maxWidth="600px"
      >
        {selectedPlacementForConvert && (() => {
          const p = selectedPlacementForConvert;
          const dogId = String(p.dog_id || p.dog?.id || "");
          const dogObj = p.dog || dogsMap.get(dogId);
          const dogName = dogObj?.name || (dogId ? `Pet #${dogId.slice(0, 8)}` : "Animal");
          const breed = dogObj?.breed || dogObj?.breed_classification || null;

          return (
            <form onSubmit={handleConfirmConvertToAdopt} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#FDF2F8", border: "1px solid #FBCFE8", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <FaHeart size={24} color="#DB2777" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "#831843" }}>
                    Confirm Permanent Adoption Transition
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#9D174D", lineHeight: "1.5" }}>
                    You are converting the active foster stay for <strong>{dogName}</strong> {breed ? `(${breed})` : ""} into a permanent adoption with caregiver family <strong>{p.foster_family}</strong>.
                  </p>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div><strong>Pet Name:</strong> {dogName}</div>
                <div><strong>Caregiver Family:</strong> {p.foster_family}</div>
                <div><strong>Placement Ref:</strong> <span style={{ fontFamily: "monospace" }}>{String(p.id || p.placement_id).slice(0, 8)}</span></div>
                <div><strong>Target Pet Status:</strong> <span style={{ color: "#047857", fontWeight: 700 }}>ADOPTED</span></div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Adoption Agreement &amp; Conversion Notes
                </label>
                <textarea
                  placeholder="Enter conversion notes or adoption agreement details..."
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: "70px", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#DB2777", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaHeart /> {isSubmitting ? "Converting..." : "Confirm Adoption Conversion"}
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
