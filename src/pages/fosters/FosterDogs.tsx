import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaPaw,
  FaHome,
  FaDog,
  FaCalendarAlt,
  FaStethoscope,
  FaBoxOpen,
  FaUndo,
  FaHeart,
  FaSync,
  FaSearch,
  FaEllipsisV,
  FaClipboardList,
  FaEye,
  FaExclamationTriangle,
  FaPlus,
} from "react-icons/fa";
import fosterService, {
  type FosterProgressLogPayload,
  type FosterSupplyDispatchPayload,
} from "../../services/fosterService";
import petService from "../../services/petService";
import vetService from "../../services/vetService";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";

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
  if (typeof dog.image_url === "string" && dog.image_url.trim()) return dog.image_url.trim();
  if (typeof dog.avatar_url === "string" && dog.avatar_url.trim()) return dog.avatar_url.trim();
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

interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "normal" | "accent" | "danger";
}

const RowActionMenu: React.FC<{ actions: RowActionItem[] }> = ({ actions }) => {
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

export const FosterDogs: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"active" | "all" | "eligible">("active");
  const [placements, setPlacements] = useState<any[]>([]);
  const [fosterProfiles, setFosterProfiles] = useState<any[]>([]);
  const [allDogs, setAllDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Placement Action Modals
  const [selectedPlacement, setSelectedPlacement] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProgressLogs, setDetailProgressLogs] = useState<any[]>([]);
  const [detailSuppliesList, setDetailSuppliesList] = useState<any[]>([]);

  // Log Progress Modal
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressForm, setProgressForm] = useState<FosterProgressLogPayload>({
    weight_kg: undefined,
    behavior_notes: "Calm, energetic, eating well",
    feeding_notes: "Normal appetite, 2 meals daily",
    medication_notes: "",
    exercise_minutes: 45,
    mood_rating: 5,
    notes: "",
  });

  // Request Vet Check Modal
  const [isVetCheckModalOpen, setIsVetCheckModalOpen] = useState(false);
  const [vetCheckForm, setVetCheckForm] = useState({
    urgency: "routine" as "routine" | "urgent" | "emergency",
    reason: "Routine Foster Health Check",
    preferred_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Dispatch Supplies Modal
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState<FosterSupplyDispatchPayload>({
    item_type: "food",
    description: "Dry Food (15kg) & Flea/Tick Prevention Package",
    quantity: 1,
  });

  // Return Dog Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("Foster Term Completed");
  const [returnNotes, setReturnNotes] = useState("Foster stay completed successfully. Returning animal to shelter facility.");

  // Convert to Adopt Modal
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertNotes, setConvertNotes] = useState("");
  const [convertLegalConfirmed, setConvertLegalConfirmed] = useState(false);

  // Place Dog Modal
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [placeTargetProfileId, setPlaceTargetProfileId] = useState("");
  const [placeTargetDogId, setPlaceTargetDogId] = useState("");
  const [placeNotes, setPlaceNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch foster dogs and placement data in clean, batch requests
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [placementsRes, profilesRes, dogsRes] = await Promise.allSettled([
        fosterService.getFosterPlacements({ page_size: 100 }),
        fosterService.getFosterProfiles({ page_size: 100 }),
        petService.getPets({ page_size: 100 }),
      ]);

      let rawPlacements: any[] = [];
      if (placementsRes.status === "fulfilled" && placementsRes.value) {
        rawPlacements = unwrapList(placementsRes.value);
      }

      let rawProfiles: any[] = [];
      if (profilesRes.status === "fulfilled" && profilesRes.value) {
        rawProfiles = unwrapList(profilesRes.value);
      }

      let rawDogs: any[] = [];
      if (dogsRes.status === "fulfilled" && dogsRes.value) {
        rawDogs = unwrapList(dogsRes.value);
      }

      const dogsMap = new Map<string, any>();
      rawDogs.forEach((d) => {
        const id = String(d.id || d.dog_id || "");
        if (id) dogsMap.set(id, d);
      });

      const profilesMap = new Map<string, any>();
      rawProfiles.forEach((p) => {
        const id = String(p.id || p.profile_id || "");
        if (id) profilesMap.set(id, p);
      });

      // Enrich placements with dog and foster caregiver information
      const enrichedPlacements = rawPlacements.map((p: any) => {
        const dogId = String(p.dog_id || p.dog?.id || "");
        const profileId = String(p.foster_id || p.profile_id || p.foster?.id || "");

        const dogObj = p.dog || dogsMap.get(dogId) || {
          id: dogId,
          name: p.dog_name || "Foster Dog",
          breed: p.dog_breed || "Mixed Breed",
          gender: p.dog_gender || "unknown",
        };

        const profileObj = profilesMap.get(profileId) || p.foster || {};
        const fosterUser = profileObj.user || {};
        const caregiverName =
          profileObj.foster_family ||
          p.foster_name ||
          fosterUser.full_name ||
          fosterUser.name ||
          fosterUser.email ||
          "Foster Caregiver";

        return {
          ...p,
          id: String(p.id || p.placement_id || ""),
          dog_id: dogId,
          profile_id: profileId,
          dog: dogObj,
          foster_family: caregiverName,
          caregiver_email: fosterUser.email || "",
          caregiver_phone: fosterUser.phone || "",
          caregiver_profile: profileObj,
        };
      });

      setPlacements(enrichedPlacements);
      setFosterProfiles(rawProfiles);
      setAllDogs(rawDogs);
    } catch (err: any) {
      setError(extractBackendErrorMessage(err, "Failed to load foster dogs data from backend."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataSync(() => {
    fetchData();
  });

  // Calculate foster statistics
  const activePlacements = useMemo(() => {
    return placements.filter(
      (p) =>
        p.is_active ||
        p.status === "active" ||
        (!p.returned_at && p.status !== "converted_to_adopt" && p.status !== "returned")
    );
  }, [placements]);

  const activeHomesCount = useMemo(() => {
    const approvedProfiles = fosterProfiles.filter(
      (p) =>
        p.is_available ||
        String(p.status).toLowerCase() === "approved" ||
        String(p.status).toLowerCase() === "active"
    );
    return approvedProfiles.length;
  }, [fosterProfiles]);

  const totalCapacitySlots = useMemo(() => {
    return fosterProfiles.reduce((sum, p) => {
      const isApproved =
        p.is_available ||
        String(p.status).toLowerCase() === "approved" ||
        String(p.status).toLowerCase() === "active";
      if (!isApproved) return sum;
      const max = Number(p.max_capacity) || 1;
      const current = Number(p.active_count ?? p.placements_count ?? 0);
      return sum + Math.max(0, max - current);
    }, 0);
  }, [fosterProfiles]);

  // Dogs eligible for foster (shelter, rescued, clinic status and not currently in active placement)
  const activePlacedDogIds = useMemo(() => {
    return new Set(activePlacements.map((p) => String(p.dog_id || p.dog?.id || "")));
  }, [activePlacements]);

  const eligibleDogs = useMemo(() => {
    return allDogs.filter((d) => {
      const dId = String(d.id || d.dog_id || "");
      if (activePlacedDogIds.has(dId)) return false;
      const status = String(d.status || "").toLowerCase();
      return status === "shelter" || status === "rescued" || status === "clinic";
    });
  }, [allDogs, activePlacedDogIds]);

  // Filtered rows based on tab, search query, and status filter
  const displayedPlacements = useMemo(() => {
    let list = activeTab === "active" ? activePlacements : placements;

    if (statusFilter !== "all") {
      list = list.filter((p) => {
        const s = String(p.status || "").toLowerCase();
        if (statusFilter === "active") return p.is_active || s === "active";
        if (statusFilter === "returned") return s === "returned" || !!p.returned_at;
        if (statusFilter === "converted_to_adopt") return s === "converted_to_adopt" || s === "adopted";
        return true;
      });
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((p) => {
      const dog = p.dog || {};
      const dogName = String(dog.name || p.dog_name || "").toLowerCase();
      const breed = String(dog.breed || p.dog_breed || "").toLowerCase();
      const dogId = String(p.dog_id || dog.id || "").toLowerCase();
      const family = String(p.foster_family || "").toLowerCase();
      const notes = String(p.notes || "").toLowerCase();
      return (
        dogName.includes(q) ||
        breed.includes(q) ||
        dogId.includes(q) ||
        family.includes(q) ||
        notes.includes(q)
      );
    });
  }, [activeTab, activePlacements, placements, statusFilter, searchQuery]);

  // Open Foster Dog Details Modal
  const handleOpenDetails = async (placement: any) => {
    setSelectedPlacement(placement);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    setDetailProgressLogs([]);
    setDetailSuppliesList([]);

    try {
      const placementId = String(placement.id || "");
      const [logsRes, suppRes] = await Promise.allSettled([
        fosterService.getProgressLogs(placementId),
        fosterService.getSupplyDispatches(placementId),
      ]);

      if (logsRes.status === "fulfilled" && logsRes.value) {
        setDetailProgressLogs(unwrapList(logsRes.value));
      }
      if (suppRes.status === "fulfilled" && suppRes.value) {
        setDetailSuppliesList(unwrapList(suppRes.value));
      }
    } catch {
      // ignore auxiliary log failure
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Log Progress Modal
  const handleOpenProgressModal = (placement: any) => {
    setSelectedPlacement(placement);
    setProgressForm({
      weight_kg: placement.dog?.weight_kg || undefined,
      behavior_notes: "Calm, energetic, eating well",
      feeding_notes: "Normal appetite, 2 meals daily",
      medication_notes: "",
      exercise_minutes: 45,
      mood_rating: 5,
      notes: "",
    });
    setIsProgressModalOpen(true);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement) return;
    const placementId = String(selectedPlacement.id || "");
    if (!placementId) {
      addToast("Invalid placement ID for progress logging.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.logProgress(placementId, progressForm);
      addToast("Foster care progress log recorded successfully!", "success");
      setIsProgressModalOpen(false);
      await fetchData();
      notifyDataChanged();
      if (isDetailModalOpen) {
        handleOpenDetails(selectedPlacement);
      }
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to log foster progress.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Request Vet Check Modal
  const handleOpenVetCheckModal = (placement: any) => {
    setSelectedPlacement(placement);
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
    if (!selectedPlacement) return;
    const placementId = String(selectedPlacement.id || "");
    const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
    if (!placementId) {
      addToast("Invalid placement ID for vet check request.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.requestVetCheck(placementId, {
        urgency: vetCheckForm.urgency,
        reason: vetCheckForm.reason,
        preferred_date: vetCheckForm.preferred_date
          ? new Date(vetCheckForm.preferred_date).toISOString()
          : new Date().toISOString(),
        notes: vetCheckForm.notes,
      });

      if (dogId) {
        await vetService
          .bookAppointment({
            pet_id: dogId,
            appointment_type: `Foster Vet Check: ${vetCheckForm.reason} (${vetCheckForm.urgency.toUpperCase()})`,
            notes:
              vetCheckForm.notes ||
              `Requested by Foster Coordinator for caregiver ${selectedPlacement.foster_family || ""}.`,
            scheduled_at: vetCheckForm.preferred_date
              ? new Date(vetCheckForm.preferred_date).toISOString()
              : new Date().toISOString(),
          })
          .catch(() => null);
      }

      addToast("Veterinary check request registered and sent to Veterinary Clinic!", "success");
      setIsVetCheckModalOpen(false);
      await fetchData();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to register veterinary check request.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Dispatch Supplies Modal
  const handleOpenSupplyModal = (placement: any) => {
    setSelectedPlacement(placement);
    setSupplyForm({
      item_type: "food",
      description: "Dry Food (15kg) & Flea/Tick Prevention Package",
      quantity: 1,
    });
    setIsSupplyModalOpen(true);
  };

  const handleConfirmSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement) return;
    const placementId = String(selectedPlacement.id || "");
    if (!placementId) {
      addToast("Invalid placement ID for supplies dispatch.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.dispatchSupplies(placementId, supplyForm);
      addToast("Supplies dispatch recorded successfully!", "success");
      setIsSupplyModalOpen(false);
      await fetchData();
      notifyDataChanged();
      if (isDetailModalOpen) {
        handleOpenDetails(selectedPlacement);
      }
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to dispatch foster supplies.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Return Dog Modal
  const handleOpenReturnModal = (placement: any) => {
    setSelectedPlacement(placement);
    setReturnReason("Foster Term Completed");
    setReturnNotes("Foster stay completed successfully. Returning animal to shelter facility.");
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement) return;
    const placementId = String(selectedPlacement.id || "");
    if (!placementId) {
      addToast("Invalid placement ID.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.returnDog(placementId, {
        reason: returnReason,
        notes: returnNotes,
      });
      addToast(
        `Returned ${selectedPlacement.dog?.name || "dog"} to shelter facility. Placement completed.`,
        "info"
      );
      setIsReturnModalOpen(false);
      setIsDetailModalOpen(false);
      await fetchData();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to process foster return.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Convert to Adopt Modal
  const handleOpenConvertModal = (placement: any) => {
    setSelectedPlacement(placement);
    setConvertNotes(`Caregiver ${placement.foster_family || ""} has formally adopted ${placement.dog?.name || "foster dog"}.`);
    setConvertLegalConfirmed(false);
    setIsConvertModalOpen(true);
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement) return;
    if (!convertLegalConfirmed) {
      addToast("Please confirm the legal adoption agreement before finalizing.", "error");
      return;
    }
    const placementId = String(selectedPlacement.id || "");
    if (!placementId) {
      addToast("Invalid placement ID.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.convertToAdopt(placementId, convertNotes);
      addToast(
        `Foster dog ${selectedPlacement.dog?.name || ""} successfully converted to permanent adoption! 🎉`,
        "success"
      );
      setIsConvertModalOpen(false);
      setIsDetailModalOpen(false);
      await fetchData();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to convert placement to adoption.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Place Dog Modal
  const handleOpenPlaceModal = (dogId?: string) => {
    if (dogId) {
      setPlaceTargetDogId(dogId);
    } else if (eligibleDogs.length > 0) {
      setPlaceTargetDogId(eligibleDogs[0].id);
    }
    const availableProfiles = fosterProfiles.filter(
      (p) =>
        p.is_available ||
        String(p.status).toLowerCase() === "approved" ||
        String(p.status).toLowerCase() === "active"
    );
    if (availableProfiles.length > 0) {
      setPlaceTargetProfileId(availableProfiles[0].id);
    }
    setPlaceNotes("Matched for temporary foster care stay.");
    setIsPlaceModalOpen(true);
  };

  const handleConfirmPlaceDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeTargetProfileId || !placeTargetDogId) {
      addToast("Please select an approved foster home and an eligible dog.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await fosterService.placeDog(placeTargetProfileId, {
        dog_id: placeTargetDogId,
        notes: placeNotes,
      });
      addToast("Dog successfully placed in foster home!", "success");
      setIsPlaceModalOpen(false);
      await fetchData();
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to place dog in foster care.");
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table Columns
  const placementColumns: Column<any>[] = [
    {
      key: "dog",
      title: "Dog Identity",
      render: (_: unknown, row: any) => {
        const dog = row.dog || {};
        const photo = getPetPhoto(dog);
        const name = dog.name || row.dog_name || "Foster Dog";
        const dogId = String(row.dog_id || dog.id || "").slice(0, 8);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "1px solid #E2E8F0",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                  color: "#1E3A8A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  flexShrink: 0,
                }}
              >
                <FaDog />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>{name}</div>
              <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>
                ID: {dogId || "—"} {dog.gender ? `• ${dog.gender}` : ""}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "breed",
      title: "Breed / Attributes",
      render: (_: unknown, row: any) => {
        const dog = row.dog || {};
        const breed = dog.breed || row.dog_breed || "Mixed Breed";
        const age = dog.estimated_age || (dog.age_months ? `${dog.age_months}m` : "");
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#334155" }}>{breed}</div>
            {age && <div style={{ fontSize: "12px", color: "#64748B" }}>Age: {age}</div>}
          </div>
        );
      },
    },
    {
      key: "foster_family",
      title: "Foster Caregiver",
      render: (_: unknown, row: any) => {
        const caregiver = row.foster_family || "Foster Caregiver";
        const email = row.caregiver_email;
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{caregiver}</div>
            {email && <div style={{ fontSize: "12px", color: "#64748B" }}>{email}</div>}
          </div>
        );
      },
    },
    {
      key: "placement_date",
      title: "Placement Timeline",
      render: (_: unknown, row: any) => {
        const placedAt = row.placed_at || row.created_at || row.date;
        const duration = getDurationInCare(placedAt);
        return (
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
              {placedAt ? formatDateTime(placedAt) : "—"}
            </div>
            {duration && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: "2px",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#EFF6FF",
                  color: "#1E3A8A",
                }}
              >
                {duration}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      title: "Care Status",
      render: (_: unknown, row: any) => {
        const isAct = row.is_active || row.status === "active" || (!row.returned_at && row.status !== "converted_to_adopt" && row.status !== "returned");
        const statusStr = String(row.status || (isAct ? "active" : "completed")).toLowerCase();

        let badgeBg = "#EFF6FF";
        let badgeColor = "#1E3A8A";
        let label = "ACTIVE FOSTER";

        if (statusStr === "converted_to_adopt" || statusStr === "adopted") {
          badgeBg = "#FDF2F8";
          badgeColor = "#DB2777";
          label = "ADOPTED";
        } else if (statusStr === "returned" || !!row.returned_at) {
          badgeBg = "#F1F5F9";
          badgeColor = "#475569";
          label = "RETURNED";
        } else if (isAct) {
          badgeBg = "#ECFDF5";
          badgeColor = "#15803D";
          label = "IN FOSTER CARE";
        }

        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              background: badgeBg,
              color: badgeColor,
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "actions",
      title: "Actions",
      render: (_: unknown, row: any) => {
        const isAct = row.is_active || row.status === "active" || (!row.returned_at && row.status !== "converted_to_adopt" && row.status !== "returned");

        const actionItems: RowActionItem[] = [
          {
            label: "View Foster Details",
            icon: <FaEye />,
            onClick: () => handleOpenDetails(row),
          },
        ];

        if (isAct) {
          actionItems.push(
            {
              label: "Log Progress & Notes",
              icon: <FaClipboardList />,
              onClick: () => handleOpenProgressModal(row),
            },
            {
              label: "Request Vet Checkup",
              icon: <FaStethoscope />,
              onClick: () => handleOpenVetCheckModal(row),
            },
            {
              label: "Dispatch Supplies",
              icon: <FaBoxOpen />,
              onClick: () => handleOpenSupplyModal(row),
            },
            {
              label: "Convert to Adoption",
              icon: <FaHeart />,
              variant: "accent",
              onClick: () => handleOpenConvertModal(row),
            },
            {
              label: "Return Dog to Facility",
              icon: <FaUndo />,
              variant: "danger",
              onClick: () => handleOpenReturnModal(row),
            }
          );
        }

        return <RowActionMenu actions={actionItems} />;
      },
    },
  ];

  // Eligible Dogs Table Columns
  const eligibleDogColumns: Column<any>[] = [
    {
      key: "dog",
      title: "Eligible Dog",
      render: (_: unknown, row: any) => {
        const photo = getPetPhoto(row);
        const name = row.name || "Dog";
        const dogId = String(row.id || row.dog_id || "").slice(0, 8);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "1px solid #E2E8F0",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                  color: "#1E3A8A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  flexShrink: 0,
                }}
              >
                <FaDog />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>{name}</div>
              <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>
                ID: {dogId || "—"} {row.gender ? `• ${row.gender}` : ""}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "breed",
      title: "Breed & Age",
      render: (_: unknown, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155" }}>{row.breed || "Mixed Breed"}</div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            {row.estimated_age || (row.age_months ? `${row.age_months} months` : "Age not specified")}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "Current Location / Status",
      render: (v: string) => (
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: "#FEF3C7",
            color: "#D97706",
            textTransform: "uppercase",
          }}
        >
          {v || "SHELTER"}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Placement Match",
      render: (_: unknown, row: any) => (
        <button
          type="button"
          onClick={() => handleOpenPlaceModal(row.id)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "none",
            background: "#16A34A",
            color: "#FFFFFF",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <FaPaw /> Place in Foster
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px 28px",
          borderRadius: "14px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Foster Dogs Station</h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px", maxWidth: "700px" }}>
              Monitor dogs residing with foster families, review daily care progress, request veterinary appointments, dispatch supplies, and coordinate placement transitions.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => handleOpenPlaceModal()}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#16A34A",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 6px -1px rgba(22, 163, 74, 0.3)",
              }}
            >
              <FaPlus /> Place Dog in Foster
            </button>
            <button
              type="button"
              onClick={fetchData}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#1E293B",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaSync /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Backend Error Warning */}
      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
              background: "#DC2626",
              color: "#FFF",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title="Dogs in Foster Care"
          value={loading ? "..." : String(activePlacements.length)}
          trend="Active Stays"
          color="#16A34A"
          icon={<FaDog />}
          onClick={() => setActiveTab("active")}
        />
        <StatCard
          title="Active Foster Homes"
          value={loading ? "..." : String(activeHomesCount)}
          trend="Approved Caregivers"
          color="#1E3A8A"
          icon={<FaHome />}
          onClick={() => navigate("/fosters")}
        />
        <StatCard
          title="Available Foster Slots"
          value={loading ? "..." : String(totalCapacitySlots)}
          trend="Open Capacity"
          color="#2563EB"
          icon={<FaCalendarAlt />}
          onClick={() => setActiveTab("eligible")}
        />
        <StatCard
          title="Placement History"
          value={loading ? "..." : String(placements.length)}
          trend="Total Stays Tracked"
          color="#0D9488"
          icon={<FaClipboardList />}
          onClick={() => setActiveTab("all")}
        />
      </div>

      {/* Quick Action Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <QuickActionCard
          icon={<FaPaw />}
          title="Place Dog in Foster"
          subtitle="Match shelter animal with caregiver"
          color="#16A34A"
          onClick={() => handleOpenPlaceModal()}
        />
        <QuickActionCard
          icon={<FaHome />}
          title="Foster Caregivers"
          subtitle="Manage approvals & home checks"
          color="#1E3A8A"
          onClick={() => navigate("/fosters")}
        />
        <QuickActionCard
          icon={<FaSync />}
          title="Sync Latest Data"
          subtitle="Refresh foster & medical records"
          color="#2563EB"
          onClick={fetchData}
        />
      </div>

      {/* Tabs & Search Controls */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #E2E8F0",
            background: "#F8FAFC",
            padding: "0 16px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            style={{
              padding: "14px 20px",
              border: "none",
              borderBottom: activeTab === "active" ? "3px solid #16A34A" : "3px solid transparent",
              background: "none",
              color: activeTab === "active" ? "#16A34A" : "#64748B",
              fontWeight: activeTab === "active" ? 800 : 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaDog /> Dogs in Active Foster Care ({activePlacements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("eligible")}
            style={{
              padding: "14px 20px",
              border: "none",
              borderBottom: activeTab === "eligible" ? "3px solid #1E3A8A" : "3px solid transparent",
              background: "none",
              color: activeTab === "eligible" ? "#1E3A8A" : "#64748B",
              fontWeight: activeTab === "eligible" ? 800 : 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaPaw /> Eligible for Foster ({eligibleDogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            style={{
              padding: "14px 20px",
              border: "none",
              borderBottom: activeTab === "all" ? "3px solid #2563EB" : "3px solid transparent",
              background: "none",
              color: activeTab === "all" ? "#2563EB" : "#64748B",
              fontWeight: activeTab === "all" ? 800 : 600,
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaClipboardList /> All Placements & History ({placements.length})
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            background: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "280px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <FaSearch
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                  fontSize: "14px",
                }}
              />
              <input
                type="text"
                placeholder={
                  activeTab === "eligible"
                    ? "Search eligible dogs by name, breed, ID..."
                    : "Search foster dogs by name, ID, breed, caregiver, notes..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingLeft: "36px",
                  height: "40px",
                }}
              />
            </div>

            {activeTab !== "eligible" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  ...inputStyle,
                  width: "180px",
                  height: "40px",
                }}
              >
                <option value="all">All Placement Statuses</option>
                <option value="active">Active Foster</option>
                <option value="returned">Returned / Closed</option>
                <option value="converted_to_adopt">Converted to Adoption</option>
              </select>
            )}
          </div>

          <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 600 }}>
            {activeTab === "eligible"
              ? `Showing ${eligibleDogs.length} eligible dogs`
              : `Showing ${displayedPlacements.length} foster placements`}
          </div>
        </div>

        {/* Table Content */}
        <div style={{ padding: "0 20px 20px" }}>
          {activeTab === "eligible" ? (
            <DataTable
              columns={eligibleDogColumns}
              data={eligibleDogs}
              loading={loading}
              emptyMessage="No eligible shelter dogs found available for foster placement."
              onRowClick={(row) => handleOpenPlaceModal(row.id)}
            />
          ) : (
            <DataTable
              columns={placementColumns}
              data={displayedPlacements}
              loading={loading}
              emptyMessage={
                activeTab === "active"
                  ? "No active foster dogs found. Place an eligible shelter dog into foster care above!"
                  : "No foster placements recorded."
              }
              onRowClick={(row) => handleOpenDetails(row)}
            />
          )}
        </div>
      </div>

      {/* ================= MODAL: FOSTER DOG DETAILS ================= */}
      {isDetailModalOpen && selectedPlacement && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Foster Care Details: ${selectedPlacement.dog?.name || "Dog Profile"}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top Dog Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: "#F8FAFC",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
              }}
            >
              {getPetPhoto(selectedPlacement.dog) ? (
                <img
                  src={getPetPhoto(selectedPlacement.dog)!}
                  alt={selectedPlacement.dog?.name || "Dog"}
                  style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "10px",
                    objectFit: "cover",
                    border: "2px solid #CBD5E1",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "70px",
                    height: "70px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                    color: "#1E3A8A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  <FaDog />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  {selectedPlacement.dog?.name || "Foster Dog"}
                </h2>
                <div style={{ fontSize: "13px", color: "#475569" }}>
                  <strong>Breed:</strong> {selectedPlacement.dog?.breed || "Mixed Breed"} &bull;{" "}
                  <strong>Gender:</strong> {selectedPlacement.dog?.gender || "Unknown"} &bull;{" "}
                  <strong>Age:</strong> {selectedPlacement.dog?.estimated_age || "—"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                  Dog ID: {selectedPlacement.dog_id || "—"} &bull; Placement ID: {selectedPlacement.id || "—"}
                </div>
              </div>
            </div>

            {/* Foster Caregiver Info */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaHome style={{ color: "#1E3A8A" }} /> Foster Caregiver Details
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#64748B" }}>Caregiver / Family:</span>
                  <div style={{ fontWeight: 700, color: "#0F172A" }}>{selectedPlacement.foster_family || "Foster Caregiver"}</div>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Email Contact:</span>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>{selectedPlacement.caregiver_email || "—"}</div>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Placement Date:</span>
                  <div style={{ fontWeight: 600, color: "#0F172A" }}>
                    {selectedPlacement.placed_at ? formatDateTime(selectedPlacement.placed_at) : "—"}
                  </div>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Stay Duration:</span>
                  <div style={{ fontWeight: 700, color: "#16A34A" }}>
                    {getDurationInCare(selectedPlacement.placed_at) || "Active Care"}
                  </div>
                </div>
              </div>
              {selectedPlacement.notes && (
                <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #F1F5F9", fontSize: "13px" }}>
                  <span style={{ color: "#64748B" }}>Placement Notes:</span>
                  <div style={{ color: "#334155", marginTop: "2px" }}>{selectedPlacement.notes}</div>
                </div>
              )}
            </div>

            {/* Progress Logs & Activity History */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaClipboardList style={{ color: "#16A34A" }} /> Recent Care Progress Logs
              </h3>
              {detailLoading ? (
                <div style={{ padding: "12px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>Loading logs...</div>
              ) : detailProgressLogs.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  No daily progress logs recorded yet. Click "Log Progress" below to add an update.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                  {detailProgressLogs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 12px",
                        background: "#F8FAFC",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", marginBottom: "4px" }}>
                        <span>{log.created_at ? formatDateTime(log.created_at) : "Recent Update"}</span>
                        {log.weight_kg && <span style={{ fontWeight: 700, color: "#1E3A8A" }}>Weight: {log.weight_kg} kg</span>}
                      </div>
                      <div style={{ color: "#0F172A", fontWeight: 600 }}>{log.behavior_notes || log.notes || "Progress logged"}</div>
                      {log.feeding_notes && <div style={{ color: "#475569", marginTop: "2px" }}>Feeding: {log.feeding_notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supply Dispatch History */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaBoxOpen style={{ color: "#F59E0B" }} /> Care Supplies Dispatched
              </h3>
              {detailLoading ? (
                <div style={{ padding: "12px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>Loading supplies...</div>
              ) : detailSuppliesList.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  No supply dispatches recorded for this stay yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "140px", overflowY: "auto" }}>
                  {detailSuppliesList.map((sup, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 12px",
                        background: "#FFFBEB",
                        borderRadius: "8px",
                        border: "1px solid #FDE68A",
                        fontSize: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#92400E" }}>
                          {sup.item_type ? `${String(sup.item_type).toUpperCase()} (Qty: ${sup.quantity || 1})` : "Foster Supplies"}
                        </div>
                        {sup.description && <div style={{ color: "#B45309" }}>{sup.description}</div>}
                      </div>
                      <span style={{ fontSize: "11px", color: "#92400E" }}>
                        {sup.created_at ? formatDateTime(sup.created_at) : "Dispatched"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Footer inside Modal */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "flex-end",
                paddingTop: "12px",
                borderTop: "1px solid #E2E8F0",
              }}
            >
              <button
                type="button"
                onClick={() => handleOpenProgressModal(selectedPlacement)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#0F172A",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaClipboardList /> Log Progress
              </button>
              <button
                type="button"
                onClick={() => handleOpenVetCheckModal(selectedPlacement)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#0F172A",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaStethoscope /> Request Vet Check
              </button>
              <button
                type="button"
                onClick={() => handleOpenSupplyModal(selectedPlacement)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#0F172A",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaBoxOpen /> Dispatch Supplies
              </button>
              <button
                type="button"
                onClick={() => handleOpenConvertModal(selectedPlacement)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#DB2777",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaHeart /> Convert to Adoption
              </button>
              <button
                type="button"
                onClick={() => handleOpenReturnModal(selectedPlacement)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaUndo /> Return Dog
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: LOG PROGRESS ================= */}
      {isProgressModalOpen && selectedPlacement && (
        <Modal
          isOpen={isProgressModalOpen}
          onClose={() => setIsProgressModalOpen(false)}
          title={`Log Care Progress: ${selectedPlacement.dog?.name || "Dog"}`}
        >
          <form onSubmit={handleSaveProgress} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  Current Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 14.5"
                  value={progressForm.weight_kg ?? ""}
                  onChange={(e) => setProgressForm({ ...progressForm, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  Daily Exercise (minutes)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  value={progressForm.exercise_minutes ?? ""}
                  onChange={(e) => setProgressForm({ ...progressForm, exercise_minutes: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Behavior & Temperament Notes
              </label>
              <textarea
                rows={2}
                value={progressForm.behavior_notes || ""}
                onChange={(e) => setProgressForm({ ...progressForm, behavior_notes: e.target.value })}
                placeholder="Describe energy level, socialization, sleep habits..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Feeding & Appetite Notes
              </label>
              <input
                type="text"
                value={progressForm.feeding_notes || ""}
                onChange={(e) => setProgressForm({ ...progressForm, feeding_notes: e.target.value })}
                placeholder="e.g. 2 cups kibble daily, high appetite"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Medications / Health Notes (optional)
              </label>
              <input
                type="text"
                value={progressForm.medication_notes || ""}
                onChange={(e) => setProgressForm({ ...progressForm, medication_notes: e.target.value })}
                placeholder="e.g. Completed antibiotic course"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsProgressModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#16A34A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Saving Log..." : "Save Progress Log"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: REQUEST VET CHECK ================= */}
      {isVetCheckModalOpen && selectedPlacement && (
        <Modal
          isOpen={isVetCheckModalOpen}
          onClose={() => setIsVetCheckModalOpen(false)}
          title={`Request Veterinary Check: ${selectedPlacement.dog?.name || "Dog"}`}
        >
          <form onSubmit={handleConfirmVetCheckSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  Urgency Level
                </label>
                <select
                  value={vetCheckForm.urgency}
                  onChange={(e) => setVetCheckForm({ ...vetCheckForm, urgency: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="routine">Routine Checkup</option>
                  <option value="urgent">Urgent Examination</option>
                  <option value="emergency">Emergency Visit</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                  Preferred Appointment Date
                </label>
                <input
                  type="date"
                  value={vetCheckForm.preferred_date}
                  onChange={(e) => setVetCheckForm({ ...vetCheckForm, preferred_date: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Reason for Appointment
              </label>
              <input
                type="text"
                value={vetCheckForm.reason}
                onChange={(e) => setVetCheckForm({ ...vetCheckForm, reason: e.target.value })}
                placeholder="e.g. 30-day foster health review, vaccine booster, skin check"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Clinical Notes / Symptoms
              </label>
              <textarea
                rows={3}
                value={vetCheckForm.notes}
                onChange={(e) => setVetCheckForm({ ...vetCheckForm, notes: e.target.value })}
                placeholder="Describe any observations reported by the foster parent..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsVetCheckModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1E3A8A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Dispatching..." : "Dispatch to Vet Clinic"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: DISPATCH SUPPLIES ================= */}
      {isSupplyModalOpen && selectedPlacement && (
        <Modal
          isOpen={isSupplyModalOpen}
          onClose={() => setIsSupplyModalOpen(false)}
          title={`Dispatch Foster Supplies: ${selectedPlacement.dog?.name || "Dog"}`}
        >
          <form onSubmit={handleConfirmSupplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Supply Category
              </label>
              <select
                value={supplyForm.item_type}
                onChange={(e) => setSupplyForm({ ...supplyForm, item_type: e.target.value as any })}
                style={inputStyle}
              >
                <option value="food">Pet Food & Nutrition (Kibble / Canned)</option>
                <option value="medication">Medication & Preventatives (Flea / Tick / Heartworm)</option>
                <option value="crate">Housing Gear (Crate / Bedding / Playpen)</option>
                <option value="bedding">Bedding & Blankets</option>
                <option value="toys">Enrichment & Toys (Leashes / Collars / Chews)</option>
                <option value="other">Other Foster Supplies</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Supply Description & Package Details
              </label>
              <input
                type="text"
                value={supplyForm.description || ""}
                onChange={(e) => setSupplyForm({ ...supplyForm, description: e.target.value })}
                placeholder="e.g. 15kg Adult Dog Kibble, 3-month Bravecto, Wire Crate 36-inch"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={supplyForm.quantity || 1}
                onChange={(e) => setSupplyForm({ ...supplyForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsSupplyModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#16A34A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Recording..." : "Record Supplies Dispatch"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: RETURN DOG ================= */}
      {isReturnModalOpen && selectedPlacement && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          title={`Return Dog to Shelter: ${selectedPlacement.dog?.name || "Dog"}`}
        >
          <form onSubmit={handleConfirmReturn} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: "13px",
              }}
            >
              <strong>Notice:</strong> This action closes the active foster placement and returns the dog to active shelter custody.
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Return Reason
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                style={inputStyle}
              >
                <option value="Foster Term Completed">Foster Stay Term Completed</option>
                <option value="Caregiver Traveling / Unavailable">Caregiver Traveling or Unavailable</option>
                <option value="Behavioral / Home Mismatch">Behavioral or Household Mismatch</option>
                <option value="Medical Intervention Required">Medical Facility Treatment Required</option>
                <option value="Other">Other Operational Reason</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Return Documentation & Notes
              </label>
              <textarea
                rows={3}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Processing Return..." : "Confirm Dog Return"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: CONVERT TO ADOPTION ================= */}
      {isConvertModalOpen && selectedPlacement && (
        <Modal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          title={`Convert Foster to Adoption: ${selectedPlacement.dog?.name || "Dog"}`}
        >
          <form onSubmit={handleConfirmConvert} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                padding: "14px 18px",
                borderRadius: "8px",
                background: "#FDF2F8",
                border: "1px solid #FBCFE8",
                color: "#9D174D",
                fontSize: "13px",
              }}
            >
              <strong>Foster-to-Adopt Conversion:</strong> This formally transitions the animal's permanent legal ownership to the foster caregiver ({selectedPlacement.foster_family}).
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Adoption Notes & Final Agreement
              </label>
              <textarea
                rows={3}
                value={convertNotes}
                onChange={(e) => setConvertNotes(e.target.value)}
                style={{ ...inputStyle, resize: "vertical" }}
                required
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px",
                borderRadius: "8px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                fontSize: "13px",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={convertLegalConfirmed}
                onChange={(e) => setConvertLegalConfirmed(e.target.checked)}
                style={{ marginTop: "3px" }}
              />
              <span>
                I confirm that the foster caregiver has completed all formal adoption requirements and signed the PawGuard adoption transfer agreement.
              </span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsConvertModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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
                  background: convertLegalConfirmed ? "#DB2777" : "#CBD5E1",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting || !convertLegalConfirmed ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Converting..." : "Finalize Adoption"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: PLACE DOG IN FOSTER ================= */}
      {isPlaceModalOpen && (
        <Modal
          isOpen={isPlaceModalOpen}
          onClose={() => setIsPlaceModalOpen(false)}
          title="Place Shelter Dog into Foster Home"
        >
          <form onSubmit={handleConfirmPlaceDog} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Select Eligible Dog
              </label>
              <select
                value={placeTargetDogId}
                onChange={(e) => setPlaceTargetDogId(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">-- Choose an eligible dog --</option>
                {eligibleDogs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || "Dog"} ({d.breed || "Mixed"} &bull; ID: {String(d.id).slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Select Approved Foster Caregiver
              </label>
              <select
                value={placeTargetProfileId}
                onChange={(e) => setPlaceTargetProfileId(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">-- Choose an approved caregiver --</option>
                {fosterProfiles
                  .filter((p) => p.is_available || String(p.status).toLowerCase() === "approved" || String(p.status).toLowerCase() === "active")
                  .map((p) => {
                    const u = p.user || {};
                    const name = p.foster_family || u.full_name || u.name || u.email || "Caregiver";
                    const max = Number(p.max_capacity) || 1;
                    const act = Number(p.active_count ?? p.placements_count ?? 0);
                    return (
                      <option key={p.id} value={p.id}>
                        {name} (Capacity: {act}/{max} slots used &bull; {p.preferences || "General"})
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
                Placement Notes & Agreements
              </label>
              <textarea
                rows={3}
                value={placeNotes}
                onChange={(e) => setPlaceNotes(e.target.value)}
                placeholder="Special care instructions, feeding routines, expected stay duration..."
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsPlaceModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFF",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#16A34A",
                  color: "#FFF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Placing..." : "Confirm Foster Placement"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default FosterDogs;
