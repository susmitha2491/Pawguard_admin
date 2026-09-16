import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import { Modal } from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaPaw,
  FaStethoscope,
  FaCalendarCheck,
  FaCamera,
  FaWeight,
  FaSmile,
  FaPills,
  FaDog,
  FaBoxOpen,
  FaHospital,
  FaSearch,
  FaEye,
  FaComments,
  FaInfoCircle,
  FaPlus,
  FaClipboardList,
} from "react-icons/fa";
import { fosterService } from "../../../services/fosterService";
import { petService } from "../../../services/petService";
import { storageService } from "../../../services/storageService";
import { vetService } from "../../../services/vetService";
import { getStoredUser } from "../../../utils/authStorage";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { formatDateTime } from "../../../utils/dateUtils";
import { getDogPhotoUrl } from "../../../utils/imageUtils";

const extractBackendErrorMessage = (err: any, fallback: string): string => {
  if (!err) return fallback;
  const resData = err?.response?.data;
  if (resData) {
    if (typeof resData.detail === "string" && resData.detail.trim()) return resData.detail.trim();
    if (typeof resData.message === "string" && resData.message.trim()) return resData.message.trim();
    if (Array.isArray(resData.detail) && resData.detail.length > 0) {
      return resData.detail
        .map((d: any) => (typeof d === "string" ? d : d?.msg || d?.message || JSON.stringify(d)))
        .join("; ");
    }
  }
  return err?.message || fallback;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  background: "#FFF",
  color: "#0F172A",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "5px",
};

const getDurationInCare = (placedAt?: string | null): string => {
  if (!placedAt) return "Recently placed";
  const start = new Date(placedAt).getTime();
  if (isNaN(start)) return "Recently placed";
  const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Placed today";
  if (days === 1) return "1 day in care";
  return `${days} days in care`;
};

const FosterFamilyDashboard: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = getStoredUser<any>();

  // Active navigation tab
  const validTabs = ["overview", "dogs", "progress", "medical", "supplies", "vet_support", "notifications"];
  const rawTab = searchParams.get("tab") || "overview";
  const currentTab = validTabs.includes(rawTab) ? rawTab : "overview";

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };

  // Main State
  const [placements, setPlacements] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any | null>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Placement selection for single dog workflows
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>("");
  const [dogSearchTerm, setDogSearchTerm] = useState("");

  // Modals
  const [selectedDogPlacement, setSelectedDogPlacement] = useState<any | null>(null);
  const [isDogDetailModalOpen, setIsDogDetailModalOpen] = useState(false);
  const [dogModalTab, setDogModalTab] = useState<"overview" | "logs" | "medical" | "supplies">("overview");

  // Progress Logs & History per placement
  const [progressLogsMap, setProgressLogsMap] = useState<Record<string, any[]>>({});
  const [suppliesMap, setSuppliesMap] = useState<Record<string, any[]>>({});
  const [vetChecksMap, setVetChecksMap] = useState<Record<string, any[]>>({});

  // Forms state
  const [isDailyProgressModalOpen, setIsDailyProgressModalOpen] = useState(false);
  const [progressFormTab, setProgressFormTab] = useState<"weight" | "behavior" | "medication" | "media">("weight");
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  const [weightForm, setWeightForm] = useState({
    weight_kg: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [behaviorForm, setBehaviorForm] = useState({
    mood_rating: 5,
    exercise_minutes: 45,
    behavior_notes: "",
    notes: "",
  });

  const [medicationForm, setMedicationForm] = useState({
    medication_notes: "",
    verified: true,
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaNotes, setMediaNotes] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Medical Symptom / Vet Check Modal State
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    urgency: "routine" as "routine" | "urgent" | "emergency",
    reason: "General Health Observation",
    preferred_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [isSubmittingMedical, setIsSubmittingMedical] = useState(false);

  // Supply Request Modal State
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState({
    item_type: "food" as "food" | "crate" | "medication" | "bedding" | "toys" | "other",
    description: "",
    quantity: 1,
  });
  const [isSubmittingSupply, setIsSubmittingSupply] = useState(false);

  // Fetch Caregiver's Profile, Placements, and Vet Clinics
  const fetchMyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, placementsRes, clinicsRes] = await Promise.allSettled([
        fosterService.getMyProfile(),
        fosterService.getMyPlacements(),
        vetService.getClinics({ page_size: 20 }),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value) {
        setMyProfile(profileRes.value);
      }

      let placementList: any[] = [];
      if (placementsRes.status === "fulfilled" && placementsRes.value) {
        const val = placementsRes.value;
        placementList = Array.isArray(val) ? val : val.data || val.items || [];
      }

      if (clinicsRes.status === "fulfilled" && clinicsRes.value?.data) {
        setClinics(clinicsRes.value.data);
      }

      // Hydrate Dog Master records for placements if needed
      const hydratedPlacements = await Promise.all(
        placementList.map(async (p: any) => {
          const dogId = String(p.dog_id || p.dog?.id || "");
          if (dogId && (!p.dog || !p.dog.name)) {
            try {
              const dogData = await petService.getPetById(dogId);
              return { ...p, dog: { ...dogData, ...(p.dog || {}) } };
            } catch {
              return p;
            }
          }
          return p;
        })
      );

      setPlacements(hydratedPlacements);
      if (hydratedPlacements.length > 0 && !selectedPlacementId) {
        setSelectedPlacementId(hydratedPlacements[0].id);
      }

      // Fetch logs and supplies for each placement
      const logsMap: Record<string, any[]> = {};
      const supMap: Record<string, any[]> = {};

      await Promise.all(
        hydratedPlacements.map(async (p: any) => {
          try {
            const [progRes, supRes] = await Promise.allSettled([
              fosterService.getProgressLogs(p.id),
              fosterService.getSupplyDispatches(p.id),
            ]);
            if (progRes.status === "fulfilled" && progRes.value) {
              const pData = progRes.value;
              logsMap[p.id] = Array.isArray(pData) ? pData : pData.data || pData.items || [];
            }
            if (supRes.status === "fulfilled" && supRes.value) {
              const sData = supRes.value;
              supMap[p.id] = Array.isArray(sData) ? sData : sData.data || sData.items || [];
            }
          } catch {
            // Ignore per-placement log load errors
          }
        })
      );

      setProgressLogsMap(logsMap);
      setSuppliesMap(supMap);
    } catch (err: any) {
      setError(extractBackendErrorMessage(err, "Unable to load your foster caregiver dashboard. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [selectedPlacementId]);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  useDataSync(fetchMyData);

  // Active placements
  const activePlacements = useMemo(() => {
    return placements.filter((p) => p.is_active !== false && String(p.status).toLowerCase() !== "returned" && String(p.status).toLowerCase() !== "completed");
  }, [placements]);

  // Filtered assigned dogs for My Foster Dogs tab
  const filteredPlacements = useMemo(() => {
    if (!dogSearchTerm.trim()) return placements;
    const term = dogSearchTerm.toLowerCase().trim();
    return placements.filter((p) => {
      const dogName = String(p.dog?.name || "").toLowerCase();
      const reg = String(p.dog?.registration_number || "").toLowerCase();
      const breed = String(p.dog?.breed || "").toLowerCase();
      return dogName.includes(term) || reg.includes(term) || breed.includes(term);
    });
  }, [placements, dogSearchTerm]);

  // Selected placement object
  const activePlacement = useMemo(() => {
    return placements.find((p) => p.id === selectedPlacementId) || placements[0] || null;
  }, [placements, selectedPlacementId]);

  // All logs across all assigned placements
  const allCareLogs = useMemo(() => {
    const combined: any[] = [];
    Object.entries(progressLogsMap).forEach(([placementId, logs]) => {
      const pObj = placements.find((p) => p.id === placementId);
      logs.forEach((log) => {
        combined.push({
          ...log,
          placementId,
          dogName: pObj?.dog?.name || "Foster Dog",
          dogPhoto: pObj?.dog ? getDogPhotoUrl(pObj.dog) : null,
        });
      });
    });
    return combined.sort((a, b) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
  }, [progressLogsMap, placements]);

  // All supplies across all assigned placements
  const allSupplyRequests = useMemo(() => {
    const combined: any[] = [];
    Object.entries(suppliesMap).forEach(([placementId, supplies]) => {
      const pObj = placements.find((p) => p.id === placementId);
      supplies.forEach((sup) => {
        combined.push({
          ...sup,
          placementId,
          dogName: pObj?.dog?.name || "Foster Dog",
        });
      });
    });
    return combined.sort((a, b) => new Date(b.created_at || b.request_date || 0).getTime() - new Date(a.created_at || a.request_date || 0).getTime());
  }, [suppliesMap, placements]);

  // All vet checks across placements
  const allVetChecks = useMemo(() => {
    const combined: any[] = [];
    Object.entries(vetChecksMap).forEach(([placementId, checks]) => {
      const pObj = placements.find((p) => p.id === placementId);
      checks.forEach((chk) => {
        combined.push({
          ...chk,
          placementId,
          dogName: pObj?.dog?.name || "Foster Dog",
        });
      });
    });
    return combined;
  }, [vetChecksMap, placements]);

  // Handle Log Weight submission
  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    const weightNum = parseFloat(weightForm.weight_kg);
    if (isNaN(weightNum) || weightNum <= 0) {
      addToast("Please enter a valid weight in kilograms (greater than 0).", "info");
      return;
    }

    try {
      setIsSubmittingProgress(true);
      await fosterService.logWeight(activePlacement.id, {
        weight_kg: weightNum,
        date: weightForm.date,
        notes: weightForm.notes.trim() || undefined,
      });
      addToast(`Logged weight ${weightNum} kg for ${activePlacement.dog?.name || "dog"}!`, "success");
      setWeightForm({ weight_kg: "", date: new Date().toISOString().split("T")[0], notes: "" });
      setIsDailyProgressModalOpen(false);
      notifyDataChanged();
      fetchMyData();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit weight log. Please try again."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // Handle Log Behavior submission
  const handleLogBehavior = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    if (!behaviorForm.behavior_notes.trim()) {
      addToast("Please enter behavioral observations or notes.", "info");
      return;
    }

    try {
      setIsSubmittingProgress(true);
      await fosterService.logBehavior(activePlacement.id, {
        behavior_notes: behaviorForm.behavior_notes.trim(),
        mood_rating: Number(behaviorForm.mood_rating),
        exercise_minutes: Number(behaviorForm.exercise_minutes) || 0,
        notes: behaviorForm.notes.trim() || undefined,
      });
      addToast(`Behavior log recorded for ${activePlacement.dog?.name || "dog"}!`, "success");
      setBehaviorForm({ mood_rating: 5, exercise_minutes: 45, behavior_notes: "", notes: "" });
      setIsDailyProgressModalOpen(false);
      notifyDataChanged();
      fetchMyData();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit behavior log. Please try again."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // Handle Log Medication submission
  const handleLogMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    if (!medicationForm.medication_notes.trim()) {
      addToast("Please enter medication details or verification notes.", "info");
      return;
    }

    try {
      setIsSubmittingProgress(true);
      await fosterService.logMedication(activePlacement.id, {
        medication_notes: medicationForm.medication_notes.trim(),
        verified: medicationForm.verified,
        date: medicationForm.date,
        notes: medicationForm.notes.trim() || undefined,
      });
      addToast(`Medication verification logged for ${activePlacement.dog?.name || "dog"}!`, "success");
      setMedicationForm({ medication_notes: "", verified: true, date: new Date().toISOString().split("T")[0], notes: "" });
      setIsDailyProgressModalOpen(false);
      notifyDataChanged();
      fetchMyData();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit medication check-in. Please try again."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // Handle Media File Selection & Upload
  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    if (!mediaFile) {
      addToast("Please select a photo to upload.", "info");
      return;
    }

    try {
      setIsUploadingMedia(true);
      const uploadedUrl = await storageService.uploadFile(mediaFile, { folder: "foster_progress" });

      if (!uploadedUrl) {
        throw new Error("Could not retrieve uploaded photo URL.");
      }

      await fosterService.logMedia(activePlacement.id, {
        photo_urls: [uploadedUrl],
        caption: mediaCaption.trim() || undefined,
        notes: mediaNotes.trim() || undefined,
      });

      addToast(`Photo log added for ${activePlacement.dog?.name || "dog"}!`, "success");
      setMediaFile(null);
      setMediaPreview(null);
      setMediaCaption("");
      setMediaNotes("");
      setIsDailyProgressModalOpen(false);
      notifyDataChanged();
      fetchMyData();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to upload photo log. Please try again."), "error");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Handle Medical Symptom / Vet Check Request
  const handleRequestVetCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    if (!medicalForm.reason.trim()) {
      addToast("Please enter a reason or symptom for the veterinary consultation.", "info");
      return;
    }

    try {
      setIsSubmittingMedical(true);
      await fosterService.requestVetCheck(activePlacement.id, {
        urgency: medicalForm.urgency,
        reason: medicalForm.reason.trim(),
        preferred_date: medicalForm.preferred_date,
        notes: medicalForm.notes.trim() || undefined,
      });
      addToast(`Veterinary consultation requested (${medicalForm.urgency}) for ${activePlacement.dog?.name || "dog"}!`, "success");
      setVetChecksMap((prev) => ({
        ...prev,
        [activePlacement.id]: [
          ...(prev[activePlacement.id] || []),
          {
            id: Math.random().toString(),
            urgency: medicalForm.urgency,
            reason: medicalForm.reason.trim(),
            preferred_date: medicalForm.preferred_date,
            notes: medicalForm.notes.trim(),
            created_at: new Date().toISOString(),
            status: "pending",
          },
        ],
      }));
      setMedicalForm({ urgency: "routine", reason: "General Health Observation", preferred_date: new Date().toISOString().split("T")[0], notes: "" });
      setIsMedicalModalOpen(false);
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit veterinary consultation request. Please try again."), "error");
    } finally {
      setIsSubmittingMedical(false);
    }
  };

  // Handle Supply Request
  const handleRequestSupplies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlacement?.id) {
      addToast("Please select an assigned foster dog first.", "info");
      return;
    }
    if (!supplyForm.description.trim()) {
      addToast("Please describe the requested foster supply item.", "info");
      return;
    }

    try {
      setIsSubmittingSupply(true);
      await fosterService.requestSupplies(activePlacement.id, {
        item_type: supplyForm.item_type,
        description: supplyForm.description.trim(),
        quantity: Math.max(1, Number(supplyForm.quantity) || 1),
      });
      addToast(`Supply request (${supplyForm.quantity}x ${supplyForm.item_type}) submitted!`, "success");
      setSupplyForm({ item_type: "food", description: "", quantity: 1 });
      setIsSupplyModalOpen(false);
      notifyDataChanged();
      fetchMyData();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit supply request. Please try again."), "error");
    } finally {
      setIsSubmittingSupply(false);
    }
  };

  // Open Dog Detail Modal
  const handleOpenDogDetail = (placement: any) => {
    setSelectedDogPlacement(placement);
    setDogModalTab("overview");
    setIsDogDetailModalOpen(true);
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", minWidth: 0 }}>
      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          width: "100%",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
            🐾 Foster Caregiver Portal
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748B", wordBreak: "break-word", lineHeight: 1.4 }}>
            Welcome back, <strong>{currentUser?.full_name || myProfile?.user?.full_name || "Foster Parent"}</strong>! Manage your assigned foster dogs, daily progress logs, medical symptom reports, and supply requests.
          </p>
        </div>

        {/* Profile Status Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            padding: "8px 14px",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            flexWrap: "wrap",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Caregiver Status</div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#166534", wordBreak: "break-word" }}>
              {myProfile?.status === "approved" ? "✅ Approved Caregiver" : myProfile?.status ? `Status: ${myProfile.status}` : "Active Foster Family"}
            </div>
          </div>
          <div
            style={{
              background: "#F1F5F9",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#334155",
              whiteSpace: "nowrap",
            }}
          >
            Capacity: {activePlacements.length} / {myProfile?.max_capacity || 2} Dogs
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        className="responsive-tabs"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          borderBottom: "2px solid #E2E8F0",
          paddingBottom: "8px",
          overflowX: "auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange("overview")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "overview" ? "#1E3A8A" : "transparent",
            color: currentTab === "overview" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaPaw /> Dashboard Overview
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("dogs")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "dogs" ? "#1E3A8A" : "transparent",
            color: currentTab === "dogs" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaDog /> My Foster Dogs ({activePlacements.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("progress")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "progress" ? "#1E3A8A" : "transparent",
            color: currentTab === "progress" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaCalendarCheck /> Daily Progress ({allCareLogs.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("medical")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "medical" ? "#1E3A8A" : "transparent",
            color: currentTab === "medical" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaStethoscope /> Medical &amp; Symptoms
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("supplies")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "supplies" ? "#1E3A8A" : "transparent",
            color: currentTab === "supplies" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaBoxOpen /> Supply Requests ({allSupplyRequests.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("vet_support")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: currentTab === "vet_support" ? "#1E3A8A" : "transparent",
            color: currentTab === "vet_support" ? "#FFFFFF" : "#64748B",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <FaHospital /> Veterinary Support
        </button>
      </div>

      {/* Loading & Error Banners */}
      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600, wordBreak: "break-word" }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>⏳</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>Loading your foster care records...</div>
          <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Retrieving assigned foster dogs, daily logs, and supply requests from backend.</div>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* TAB 1: OVERVIEW & DASHBOARD */}
          {/* ============================================================ */}
          {currentTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Headline Stats Cards */}
              <div className="foster-kpi-grid">
                <StatCard
                  title="Assigned Foster Dogs"
                  value={activePlacements.length}
                  icon={<FaDog />}
                  color="#1E3A8A"
                  description={`${myProfile?.max_capacity || 2} max capacity`}
                />
                <StatCard
                  title="Daily Care Logs"
                  value={allCareLogs.length}
                  icon={<FaClipboardList />}
                  color="#16A34A"
                  description="Recorded progress entries"
                />
                <StatCard
                  title="Medical Requests"
                  value={allVetChecks.length}
                  icon={<FaStethoscope />}
                  color="#D97706"
                  description="Consultation / check requests"
                />
                <StatCard
                  title="Supply Requests"
                  value={allSupplyRequests.length}
                  icon={<FaBoxOpen />}
                  color="#7C3AED"
                  description="Food, medication & equipment"
                />
              </div>

              {/* Quick Action Caregiver Cards */}
              <div className="foster-actions-grid">
                <QuickActionCard
                  icon={<FaCalendarCheck />}
                  title="Log Daily Progress"
                  subtitle="Record weight, behavior & meds"
                  color="#16A34A"
                  onClick={() => setIsDailyProgressModalOpen(true)}
                  wrapText={true}
                />
                <QuickActionCard
                  icon={<FaStethoscope />}
                  title="Report Medical Symptom"
                  subtitle="Request vet consultation"
                  color="#DC2626"
                  onClick={() => setIsMedicalModalOpen(true)}
                  wrapText={true}
                />
                <QuickActionCard
                  icon={<FaBoxOpen />}
                  title="Request Foster Supplies"
                  subtitle="Kibble, crates & bedding"
                  color="#2563EB"
                  onClick={() => setIsSupplyModalOpen(true)}
                  wrapText={true}
                />
                <QuickActionCard
                  icon={<FaHospital />}
                  title="Veterinary Network"
                  subtitle="Emergency clinic directory"
                  color="#0891B2"
                  onClick={() => handleTabChange("vet_support")}
                  wrapText={true}
                />
              </div>

              {/* Assigned Foster Dogs Section */}
              <div className="soft-card" style={{ padding: "20px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <h2 style={{ margin: "0 0 2px 0", fontSize: "17px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                      🐕 Dogs Currently in Your Foster Care
                    </h2>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748B", wordBreak: "break-word" }}>
                      Animals officially placed with your household under authorized foster placement agreements.
                    </p>
                  </div>
                  {activePlacements.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsDailyProgressModalOpen(true)}
                      style={{
                        padding: "8px 14px",
                        background: "#1E3A8A",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaPlus size={11} /> Log Today's Progress
                    </button>
                  )}
                </div>

                {activePlacements.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
                    <FaDog size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                    <h3 style={{ margin: "0 0 6px 0", fontSize: "15px", color: "#334155" }}>No Foster Dogs Assigned Yet</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748B", maxWidth: "480px", marginInline: "auto" }}>
                      When the Foster Coordinator assigns a foster animal to your family, their profile, medical records, and daily reporting forms will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="foster-dogs-grid">
                    {activePlacements.map((p) => {
                      const dog = p.dog || {};
                      const photoUrl = getDogPhotoUrl(dog);
                      const isSelected = p.id === selectedPlacementId;

                      return (
                        <div
                          key={p.id}
                          style={{
                            background: isSelected ? "#F0FDF4" : "#FFFFFF",
                            border: isSelected ? "2px solid #16A34A" : "1px solid #E2E8F0",
                            borderRadius: "12px",
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "12px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                            boxSizing: "border-box",
                            width: "100%",
                          }}
                        >
                          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={dog.name || "Foster Dog"}
                                style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", border: "1px solid #CBD5E1", flexShrink: 0 }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "64px",
                                  height: "64px",
                                  borderRadius: "10px",
                                  background: "#E2E8F0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#64748B",
                                  fontSize: "24px",
                                  flexShrink: 0,
                                }}
                              >
                                🐶
                              </div>
                            )}

                            <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                              <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                                {dog.name || "Foster Dog"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>
                                {dog.registration_number || "REG-PENDING"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                                {dog.breed || "Mixed Breed"} • {dog.gender || "Unknown"}
                              </div>
                            </div>

                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: "999px",
                                background: "#DCFCE7",
                                color: "#166534",
                                textTransform: "uppercase",
                                alignSelf: "flex-start",
                              }}
                            >
                              Active
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: "#64748B", background: "#F8FAFC", padding: "8px 10px", borderRadius: "6px", wordBreak: "break-word" }}>
                            ⏱️ <strong>Duration:</strong> {getDurationInCare(p.placed_at || p.created_at)}
                            {p.notes && <div style={{ marginTop: "4px", color: "#475569", wordBreak: "break-word" }}>📝 {p.notes}</div>}
                          </div>

                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDogDetail(p)}
                              style={{
                                flex: "1 1 120px",
                                padding: "8px 12px",
                                background: "#1E3A8A",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                minHeight: "36px",
                              }}
                            >
                              <FaEye size={11} /> View Pet Profile
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlacementId(p.id);
                                setIsDailyProgressModalOpen(true);
                              }}
                              style={{
                                flex: "1 1 110px",
                                padding: "8px 12px",
                                background: "#F1F5F9",
                                color: "#1E293B",
                                border: "1px solid #CBD5E1",
                                borderRadius: "6px",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                minHeight: "36px",
                              }}
                            >
                              <FaPlus size={10} /> Log Progress
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Progress Logs Stream */}
              <div className="soft-card" style={{ padding: "20px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                    📋 Recent Daily Progress Entries
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleTabChange("progress")}
                    style={{ background: "transparent", border: "none", color: "#2563EB", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    View All Logs →
                  </button>
                </div>

                {allCareLogs.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748B", fontSize: "13px", background: "#F8FAFC", borderRadius: "8px" }}>
                    No daily logs recorded yet. Use the "Log Today's Progress" button to record weight, behavior, and medication updates.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {allCareLogs.slice(0, 5).map((log, idx) => (
                      <div
                        key={log.id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          background: "#F8FAFC",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          fontSize: "13px",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
                          <span style={{ fontSize: "16px", flexShrink: 0 }}>
                            {log.weight_kg ? "⚖️" : log.behavior_notes ? "🐾" : log.medication_notes ? "💊" : "📷"}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", wordBreak: "break-word" }}>
                              {log.dogName}: {log.weight_kg ? `${log.weight_kg} kg` : log.behavior_notes ? log.behavior_notes : log.medication_notes || "Care Update"}
                            </div>
                            {log.notes && <div style={{ fontSize: "12px", color: "#64748B", wordBreak: "break-word" }}>{log.notes}</div>}
                          </div>
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {formatDateTime(log.created_at || log.date || new Date())}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: MY FOSTER DOGS */}
          {/* ============================================================ */}
          {currentTab === "dogs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
              {/* Search Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  background: "#FFFFFF",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
                  <FaSearch style={{ position: "absolute", left: "12px", top: "11px", color: "#94A3B8" }} />
                  <input
                    type="text"
                    placeholder="Search assigned foster dogs by name, breed, or ID..."
                    value={dogSearchTerm}
                    onChange={(e) => setDogSearchTerm(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: "34px" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsDailyProgressModalOpen(true)}
                  style={{
                    padding: "9px 16px",
                    background: "#1E3A8A",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <FaPlus size={11} /> Log Care Progress
                </button>
              </div>

              {/* Dogs Cards Grid */}
              {filteredPlacements.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                  <FaDog size={44} color="#94A3B8" style={{ marginBottom: "12px" }} />
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#1E293B" }}>
                    {dogSearchTerm ? "No matching foster dogs found" : "No foster dogs currently assigned to you"}
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                    {dogSearchTerm ? "Try adjusting your search criteria." : "When animals are placed with you, their profiles will appear here."}
                  </p>
                </div>
              ) : (
                <div className="foster-dogs-grid">
                  {filteredPlacements.map((p) => {
                    const dog = p.dog || {};
                    const photoUrl = getDogPhotoUrl(dog);
                    const pLogs = progressLogsMap[p.id] || [];

                    return (
                      <div
                        key={p.id}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "12px",
                          overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          boxSizing: "border-box",
                          width: "100%",
                        }}
                      >
                        {/* Card Header & Photo */}
                        <div style={{ position: "relative", height: "160px", background: "#F1F5F9" }}>
                          {photoUrl ? (
                            <img src={photoUrl} alt={dog.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "48px" }}>
                              🐶
                            </div>
                          )}
                          <span
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              background: "rgba(15, 23, 42, 0.8)",
                              color: "#FFFFFF",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              backdropFilter: "blur(4px)",
                            }}
                          >
                            {p.status ? String(p.status).toUpperCase() : "ACTIVE FOSTER"}
                          </span>
                        </div>

                        {/* Card Body */}
                        <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px" }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "6px" }}>
                              <div style={{ minWidth: 0 }}>
                                <h3 style={{ margin: "0 0 2px 0", fontSize: "18px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                                  {dog.name || "Foster Dog"}
                                </h3>
                                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>
                                  {dog.registration_number || "REG-PENDING"}
                                </div>
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "3px 8px", borderRadius: "6px", whiteSpace: "nowrap" }}>
                                {dog.estimated_age || (dog.age_months ? `${dog.age_months} mos` : "Adult")}
                              </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))", gap: "8px", marginTop: "12px", fontSize: "12.5px" }}>
                              <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: "6px", wordBreak: "break-word" }}>
                                <span style={{ color: "#64748B" }}>Breed:</span> <strong>{dog.breed || "Mixed"}</strong>
                              </div>
                              <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: "6px", wordBreak: "break-word" }}>
                                <span style={{ color: "#64748B" }}>Gender:</span> <strong>{dog.gender || "Unknown"}</strong>
                              </div>
                              <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: "6px", wordBreak: "break-word" }}>
                                <span style={{ color: "#64748B" }}>Weight:</span> <strong>{dog.weight ? `${dog.weight} kg` : "N/A"}</strong>
                              </div>
                              <div style={{ background: "#F8FAFC", padding: "6px 8px", borderRadius: "6px", wordBreak: "break-word" }}>
                                <span style={{ color: "#64748B" }}>Logs:</span> <strong>{pLogs.length} entries</strong>
                              </div>
                            </div>

                            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "10px", wordBreak: "break-word" }}>
                              ⏱️ <strong>In Foster:</strong> {getDurationInCare(p.placed_at || p.created_at)}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: "12px" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenDogDetail(p)}
                              style={{
                                flex: "1 1 120px",
                                padding: "8px 12px",
                                background: "#1E3A8A",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                minHeight: "36px",
                              }}
                            >
                              <FaEye size={11} /> Dog Profile
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlacementId(p.id);
                                setIsDailyProgressModalOpen(true);
                              }}
                              style={{
                                flex: "1 1 110px",
                                padding: "8px 12px",
                                background: "#16A34A",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                minHeight: "36px",
                              }}
                            >
                              <FaCalendarCheck size={11} /> Log Progress
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: DAILY PROGRESS & LOGS */}
          {/* ============================================================ */}
          {currentTab === "progress" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Dog Selector & Quick Action Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  background: "#FFFFFF",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: "1 1 260px", minWidth: 0 }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", whiteSpace: "nowrap" }}>Active Dog Placement:</label>
                  <select
                    value={selectedPlacementId}
                    onChange={(e) => setSelectedPlacementId(e.target.value)}
                    style={{ ...inputStyle, width: "100%", maxWidth: "340px", minWidth: 0 }}
                  >
                    {placements.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.dog?.name || "Foster Dog"} ({p.dog?.registration_number || "REG"})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDailyProgressModalOpen(true)}
                  style={{
                    padding: "9px 16px",
                    background: "#16A34A",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <FaPlus size={11} /> Record New Progress Log
                </button>
              </div>

              {/* Progress Logs Table */}
              <div className="soft-card" style={{ padding: "20px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box" }}>
                <h2 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                  📊 Daily Care Logs for {activePlacement?.dog?.name || "Foster Dog"}
                </h2>

                {(!progressLogsMap[selectedPlacementId] || progressLogsMap[selectedPlacementId].length === 0) ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
                    <FaClipboardList size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#334155" }}>No Daily Logs Recorded Yet</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748B" }}>
                      Start submitting daily progress entries such as weight tracking, behavioral notes, and medication verification.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDailyProgressModalOpen(true)}
                      style={{
                        padding: "8px 16px",
                        background: "#16A34A",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Log First Entry
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive-container">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", textAlign: "left" }}>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Date &amp; Time</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Log Type</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Recorded Details</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Notes</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Media</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressLogsMap[selectedPlacementId].map((log, idx) => {
                          const logType = log.weight_kg ? "Weight Log" : log.behavior_notes ? "Behavior Observation" : log.medication_notes ? "Medication Check-in" : "Care Update";
                          return (
                            <tr key={log.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                                {formatDateTime(log.created_at || log.date || new Date())}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: log.weight_kg ? "#EFF6FF" : log.behavior_notes ? "#FEF3C7" : "#ECFDF5",
                                    color: log.weight_kg ? "#1E40AF" : log.behavior_notes ? "#92400E" : "#065F46",
                                  }}
                                >
                                  {logType}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#334155" }}>
                                {log.weight_kg && <strong>{log.weight_kg} kg</strong>}
                                {log.behavior_notes && <div>{log.behavior_notes} {log.mood_rating && `(Mood: ${log.mood_rating}/5)`}</div>}
                                {log.medication_notes && <div>{log.medication_notes} {log.verified && "✅ Verified Administered"}</div>}
                              </td>
                              <td style={{ padding: "12px 14px", color: "#64748B" }}>
                                {log.notes || "-"}
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                {log.photo_urls && log.photo_urls.length > 0 ? (
                                  <a href={log.photo_urls[0]} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", fontWeight: 600 }}>
                                    📷 View ({log.photo_urls.length})
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: MEDICAL & SYMPTOMS */}
          {/* ============================================================ */}
          {currentTab === "medical" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Clinical Role Boundary Alert */}
              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <FaInfoCircle size={20} color="#2563EB" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div style={{ fontSize: "13px", color: "#1E40AF", flex: "1 1 260px", minWidth: 0, wordBreak: "break-word" }}>
                  <strong>Caregiver Clinical Responsibility Notice:</strong> As a Foster Family caregiver, you report observations and clinical symptoms. Licensed veterinarians review these observations to formulate treatment plans, prescribe medications, and issue official medical clearances.
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", width: "100%" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 2px 0", fontSize: "18px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                    🩺 Veterinary Consultations &amp; Medical Symptom Reports
                  </h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748B", wordBreak: "break-word" }}>
                    Report appetite changes, lethargy, medication concerns, or request routine check-ups for your foster animals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMedicalModalOpen(true)}
                  style={{
                    padding: "9px 16px",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <FaPlus size={11} /> Report Symptom / Request Vet Check
                </button>
              </div>

              {/* History of Medical Reports */}
              <div className="soft-card" style={{ padding: "20px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box" }}>
                {allVetChecks.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
                    <FaStethoscope size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#334155" }}>No Medical Concerns Reported</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                      Your foster animals currently have no pending medical concerns or vet check requests.
                    </p>
                  </div>
                ) : (
                  <div className="table-responsive-container">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", textAlign: "left" }}>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Date</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Foster Dog</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Urgency</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Reason / Symptom</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Preferred Date</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Notes</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allVetChecks.map((chk, idx) => (
                          <tr key={chk.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                              {formatDateTime(chk.created_at || new Date())}
                            </td>
                            <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1E3A8A" }}>
                              {chk.dogName}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: chk.urgency === "emergency" ? "#FEE2E2" : chk.urgency === "urgent" ? "#FEF3C7" : "#F1F5F9",
                                  color: chk.urgency === "emergency" ? "#991B1B" : chk.urgency === "urgent" ? "#92400E" : "#475569",
                                  textTransform: "uppercase",
                                }}
                              >
                                {chk.urgency}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", color: "#334155" }}>{chk.reason}</td>
                            <td style={{ padding: "12px 14px", color: "#64748B" }}>{chk.preferred_date || "-"}</td>
                            <td style={{ padding: "12px 14px", color: "#64748B" }}>{chk.notes || "-"}</td>
                            <td style={{ padding: "12px 14px" }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#D97706", background: "#FEF3C7", padding: "2px 6px", borderRadius: "4px" }}>
                                {chk.status || "Submitted"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: SUPPLY REQUESTS */}
          {/* ============================================================ */}
          {currentTab === "supplies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Header & Request Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", width: "100%" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 2px 0", fontSize: "18px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                    📦 Foster Care Supplies &amp; Provisions
                  </h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748B", wordBreak: "break-word" }}>
                    Request food, crates, bedding, medications, and toys provided by the shelter for your foster animals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSupplyModalOpen(true)}
                  style={{
                    padding: "9px 16px",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <FaPlus size={11} /> Request Foster Supplies
                </button>
              </div>

              {/* Supply Requests Table */}
              <div className="soft-card" style={{ padding: "20px", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", width: "100%", boxSizing: "border-box" }}>
                {allSupplyRequests.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1" }}>
                    <FaBoxOpen size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#334155" }}>No Supply Requests Found</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748B" }}>
                      Need kibble, crates, or medications? Click "Request Foster Supplies" to submit an order to shelter logistics.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSupplyModalOpen(true)}
                      style={{
                        padding: "8px 16px",
                        background: "#2563EB",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      Request Supplies
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive-container">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", textAlign: "left" }}>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Request Date</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Foster Dog</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Item Category</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Description</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Quantity</th>
                          <th style={{ padding: "10px 14px", fontWeight: 700, color: "#475569" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSupplyRequests.map((sup, idx) => (
                          <tr key={sup.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                              {formatDateTime(sup.created_at || sup.request_date || new Date())}
                            </td>
                            <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1E3A8A" }}>
                              {sup.dogName}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: "#EFF6FF",
                                  color: "#1E40AF",
                                  textTransform: "uppercase",
                                }}
                              >
                                {sup.item_type || "SUPPLY"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 14px", color: "#334155" }}>
                              {sup.description || sup.item_name || "-"}
                            </td>
                            <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0F172A" }}>
                              {sup.quantity || 1}
                            </td>
                            <td style={{ padding: "12px 14px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background: sup.status === "dispatched" || sup.status === "fulfilled" ? "#ECFDF5" : "#FEF3C7",
                                  color: sup.status === "dispatched" || sup.status === "fulfilled" ? "#065F46" : "#92400E",
                                  textTransform: "uppercase",
                                }}
                              >
                                {sup.status || "Requested"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: VETERINARY SUPPORT & CLINIC DIRECTORY */}
          {/* ============================================================ */}
          {currentTab === "vet_support" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
              {/* Backend Blocker Disclosure Alert */}
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  padding: "16px 20px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                  flexWrap: "wrap",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <FaComments size={24} color="#D97706" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div style={{ fontSize: "13.5px", color: "#92400E", flex: "1 1 260px", minWidth: 0, wordBreak: "break-word" }}>
                  <div style={{ fontWeight: 800, fontSize: "15px", marginBottom: "4px" }}>
                    Veterinary Support Status
                  </div>
                  <div>
                    In-app live chat messaging with veterinarians is currently <strong>pending backend real-time messaging infrastructure (Backend Capability Blocked)</strong>.
                  </div>
                  <div style={{ marginTop: "6px" }}>
                    To reach clinical support, please submit a formal <strong>Veterinary Consultation / Exam Request</strong> through the portal or call our partner veterinary clinics directly using the emergency contact directory below.
                  </div>
                </div>
              </div>

              {/* Action Banner */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", width: "100%" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 2px 0", fontSize: "18px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                    🏥 Partner Veterinary Network &amp; Emergency Directory
                  </h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748B", wordBreak: "break-word" }}>
                    Authorized partner veterinary clinics available for PawGuard foster care consultations and emergency medical support.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMedicalModalOpen(true)}
                  style={{
                    padding: "9px 16px",
                    background: "#1E3A8A",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  <FaStethoscope size={11} /> Request Vet Consultation
                </button>
              </div>

              {/* Clinics Directory Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "16px", width: "100%" }}>
                {clinics.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", gridColumn: "1 / -1" }}>
                    <FaHospital size={36} color="#94A3B8" style={{ marginBottom: "10px" }} />
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#334155" }}>Partner Clinic Directory Loading</h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                      For urgent clinical assistance, please contact the PawGuard Central Shelter Hotline or submit a vet check request.
                    </p>
                  </div>
                ) : (
                  clinics.map((clinic) => (
                    <div
                      key={clinic.id}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                        boxSizing: "border-box",
                        width: "100%",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                            {clinic.name}
                          </h3>
                          {clinic.is_emergency && (
                            <span style={{ fontSize: "11px", fontWeight: 800, padding: "2px 6px", borderRadius: "4px", background: "#FEE2E2", color: "#991B1B", whiteSpace: "nowrap" }}>
                              24/7 Emergency
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px", wordBreak: "break-word" }}>
                          📍 {clinic.address}
                        </div>
                        <div style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600, marginTop: "6px", wordBreak: "break-word" }}>
                          📞 {clinic.phone}
                        </div>
                        {clinic.services && (
                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", wordBreak: "break-word" }}>
                            🩺 Services: {clinic.services}
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "10px" }}>
                        <a
                          href={`tel:${clinic.phone}`}
                          style={{
                            display: "block",
                            textAlign: "center",
                            padding: "8px 12px",
                            background: "#F1F5F9",
                            color: "#0F172A",
                            borderRadius: "6px",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "12.5px",
                          }}
                        >
                          Call Clinic
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: SINGLE FOSTER DOG DETAILS */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDogDetailModalOpen}
        onClose={() => setIsDogDetailModalOpen(false)}
        title={selectedDogPlacement?.dog?.name ? `🐕 Foster Pet Profile — ${selectedDogPlacement.dog.name}` : "Foster Pet Profile"}
        maxWidth="750px"
      >
        {selectedDogPlacement && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            {/* Modal Header Profile */}
            <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "#F8FAFC", padding: "16px", borderRadius: "10px", border: "1px solid #E2E8F0", flexWrap: "wrap" }}>
              {getDogPhotoUrl(selectedDogPlacement.dog) ? (
                <img
                  src={getDogPhotoUrl(selectedDogPlacement.dog)!}
                  alt={selectedDogPlacement.dog?.name}
                  style={{ width: "80px", height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid #CBD5E1", flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: "80px", height: "80px", borderRadius: "10px", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", flexShrink: 0 }}>
                  🐶
                </div>
              )}

              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A", wordBreak: "break-word" }}>
                  {selectedDogPlacement.dog?.name}
                </div>
                <div style={{ fontSize: "13px", color: "#64748B", fontFamily: "monospace" }}>
                  ID: {selectedDogPlacement.dog?.registration_number || "REG-PENDING"}
                </div>
                <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px", wordBreak: "break-word" }}>
                  {selectedDogPlacement.dog?.breed} • {selectedDogPlacement.dog?.gender} • {selectedDogPlacement.dog?.estimated_age || "Adult"}
                </div>
              </div>

              <span style={{ fontSize: "11px", fontWeight: 800, padding: "4px 10px", borderRadius: "999px", background: "#DCFCE7", color: "#166534", alignSelf: "flex-start", whiteSpace: "nowrap" }}>
                IN FOSTER CARE
              </span>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="responsive-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px", overflowX: "auto" }}>
              <button
                type="button"
                onClick={() => setDogModalTab("overview")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: dogModalTab === "overview" ? "#1E3A8A" : "transparent",
                  color: dogModalTab === "overview" ? "#FFFFFF" : "#64748B",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Dog Master Details
              </button>
              <button
                type="button"
                onClick={() => setDogModalTab("logs")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: dogModalTab === "logs" ? "#1E3A8A" : "transparent",
                  color: dogModalTab === "logs" ? "#FFFFFF" : "#64748B",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Daily Logs ({(progressLogsMap[selectedDogPlacement.id] || []).length})
              </button>
              <button
                type="button"
                onClick={() => setDogModalTab("supplies")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: dogModalTab === "supplies" ? "#1E3A8A" : "transparent",
                  color: dogModalTab === "supplies" ? "#FFFFFF" : "#64748B",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Supplies ({(suppliesMap[selectedDogPlacement.id] || []).length})
              </button>
            </div>

            {/* Dog Master Overview Sub-tab */}
            {dogModalTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "12px", fontSize: "13px" }}>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Microchip ID</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{selectedDogPlacement.dog?.microchip_id || "Not chipped"}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Weight</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{selectedDogPlacement.dog?.weight ? `${selectedDogPlacement.dog.weight} kg` : "Not recorded"}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Temperament</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{selectedDogPlacement.dog?.temperament || "Friendly"}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Spayed / Neutered</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{selectedDogPlacement.dog?.is_spayed_neutered ? "Yes" : "No"}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Placed In Care On</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{formatDateTime(selectedDogPlacement.placed_at || selectedDogPlacement.created_at)}</div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>Care Duration</span>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginTop: "2px", wordBreak: "break-word" }}>{getDurationInCare(selectedDogPlacement.placed_at)}</div>
                  </div>
                </div>

                {selectedDogPlacement.notes && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", padding: "12px", borderRadius: "8px", fontSize: "13px", color: "#92400E", wordBreak: "break-word" }}>
                    <strong>Placement Instructions:</strong> {selectedDogPlacement.notes}
                  </div>
                )}
              </div>
            )}

            {/* Daily Logs Sub-tab */}
            {dogModalTab === "logs" && (
              <div>
                {(!progressLogsMap[selectedDogPlacement.id] || progressLogsMap[selectedDogPlacement.id].length === 0) ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                    No daily progress entries recorded for this pet yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                    {progressLogsMap[selectedDogPlacement.id].map((log: any, idx: number) => (
                      <div key={idx} style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "6px", fontSize: "12.5px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0F172A", flexWrap: "wrap", gap: "4px" }}>
                          <span>{log.weight_kg ? `Weight: ${log.weight_kg} kg` : log.behavior_notes ? "Behavior Log" : "Medication Check"}</span>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>{formatDateTime(log.created_at || log.date)}</span>
                        </div>
                        {log.behavior_notes && <div style={{ color: "#334155", marginTop: "2px", wordBreak: "break-word" }}>{log.behavior_notes}</div>}
                        {log.medication_notes && <div style={{ color: "#334155", marginTop: "2px", wordBreak: "break-word" }}>💊 {log.medication_notes}</div>}
                        {log.notes && <div style={{ color: "#64748B", fontSize: "11.5px", marginTop: "2px", wordBreak: "break-word" }}>📝 {log.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Supplies Sub-tab */}
            {dogModalTab === "supplies" && (
              <div>
                {(!suppliesMap[selectedDogPlacement.id] || suppliesMap[selectedDogPlacement.id].length === 0) ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                    No supplies recorded for this dog's placement.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                    {suppliesMap[selectedDogPlacement.id].map((sup: any, idx: number) => (
                      <div key={idx} style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "6px", fontSize: "12.5px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: "#0F172A", wordBreak: "break-word" }}>{sup.quantity || 1}x {sup.item_type || "Supply"}</strong>
                          <div style={{ color: "#64748B", fontSize: "12px", wordBreak: "break-word" }}>{sup.description || "Foster provision"}</div>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#FEF3C7", color: "#92400E", whiteSpace: "nowrap" }}>
                          {sup.status || "Requested"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setIsDogDetailModalOpen(false);
                  setSelectedPlacementId(selectedDogPlacement.id);
                  setIsDailyProgressModalOpen(true);
                }}
                style={{
                  padding: "8px 14px",
                  background: "#16A34A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaCalendarCheck size={11} /> Log Progress
              </button>
              <button
                type="button"
                onClick={() => setIsDogDetailModalOpen(false)}
                style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: LOG DAILY PROGRESS */}
      {/* ============================================================ */}
      <Modal
        isOpen={isDailyProgressModalOpen}
        onClose={() => setIsDailyProgressModalOpen(false)}
        title={activePlacement?.dog?.name ? `📋 Log Daily Progress — ${activePlacement.dog.name}` : "Log Daily Progress"}
        maxWidth="600px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
          {/* Target Dog Selector */}
          <div>
            <label style={labelStyle}>Assigned Foster Dog</label>
            <select
              value={selectedPlacementId}
              onChange={(e) => setSelectedPlacementId(e.target.value)}
              style={inputStyle}
            >
              {placements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.dog?.name || "Foster Dog"} ({p.dog?.registration_number || "REG"})
                </option>
              ))}
            </select>
          </div>

          {/* Form Tabs */}
          <div className="responsive-tabs" style={{ display: "flex", gap: "6px", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px", overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setProgressFormTab("weight")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: progressFormTab === "weight" ? "#1E3A8A" : "transparent",
                color: progressFormTab === "weight" ? "#FFFFFF" : "#64748B",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <FaWeight size={11} /> Weight Log
            </button>
            <button
              type="button"
              onClick={() => setProgressFormTab("behavior")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: progressFormTab === "behavior" ? "#1E3A8A" : "transparent",
                color: progressFormTab === "behavior" ? "#FFFFFF" : "#64748B",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <FaSmile size={11} /> Behavior &amp; Mood
            </button>
            <button
              type="button"
              onClick={() => setProgressFormTab("medication")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: progressFormTab === "medication" ? "#1E3A8A" : "transparent",
                color: progressFormTab === "medication" ? "#FFFFFF" : "#64748B",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <FaPills size={11} /> Medication
            </button>
            <button
              type="button"
              onClick={() => setProgressFormTab("media")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: progressFormTab === "media" ? "#1E3A8A" : "transparent",
                color: progressFormTab === "media" ? "#FFFFFF" : "#64748B",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <FaCamera size={11} /> Photo Upload
            </button>
          </div>

          {/* Form 1: Weight */}
          {progressFormTab === "weight" && (
            <form onSubmit={handleLogWeight} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div>
                <label style={labelStyle}>Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="e.g. 15.4"
                  value={weightForm.weight_kg}
                  onChange={(e) => setWeightForm({ ...weightForm, weight_kg: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Measurement Date</label>
                <input
                  type="date"
                  value={weightForm.date}
                  onChange={(e) => setWeightForm({ ...weightForm, date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Optional Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Measured before morning meal"
                  value={weightForm.notes}
                  onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setIsDailyProgressModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isSubmittingProgress} style={{ padding: "8px 16px", background: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  {isSubmittingProgress ? "Saving..." : "Save Weight Log"}
                </button>
              </div>
            </form>
          )}

          {/* Form 2: Behavior */}
          {progressFormTab === "behavior" && (
            <form onSubmit={handleLogBehavior} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div>
                <label style={labelStyle}>Mood Rating (1 = Stressed, 5 = Excellent) *</label>
                <select
                  value={behaviorForm.mood_rating}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, mood_rating: Number(e.target.value) })}
                  style={inputStyle}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ 5 - Joyful, relaxed, energetic</option>
                  <option value={4}>⭐⭐⭐⭐ 4 - Good mood, friendly</option>
                  <option value={3}>⭐⭐⭐ 3 - Neutral / calm</option>
                  <option value={2}>⭐⭐ 2 - Slightly anxious / shy</option>
                  <option value={1}>⭐ 1 - Highly stressed / fearful</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Exercise &amp; Play Duration (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={behaviorForm.exercise_minutes}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, exercise_minutes: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Behavioral Observations *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe daily interactions, leash manners, socialization, crate comfort..."
                  value={behaviorForm.behavior_notes}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, behavior_notes: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setIsDailyProgressModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isSubmittingProgress} style={{ padding: "8px 16px", background: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  {isSubmittingProgress ? "Saving..." : "Save Behavior Log"}
                </button>
              </div>
            </form>
          )}

          {/* Form 3: Medication */}
          {progressFormTab === "medication" && (
            <form onSubmit={handleLogMedication} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div>
                <label style={labelStyle}>Medication Name &amp; Dosage *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heartworm Preventative Tablet 1x"
                  value={medicationForm.medication_notes}
                  onChange={(e) => setMedicationForm({ ...medicationForm, medication_notes: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
                <input
                  type="checkbox"
                  id="med_verified"
                  checked={medicationForm.verified}
                  onChange={(e) => setMedicationForm({ ...medicationForm, verified: e.target.checked })}
                  style={{ width: "16px", height: "16px" }}
                />
                <label htmlFor="med_verified" style={{ fontSize: "13px", fontWeight: 700, color: "#15803D", cursor: "pointer" }}>
                  ✅ Verified Administered to Animal
                </label>
              </div>
              <div>
                <label style={labelStyle}>Administration Date</label>
                <input
                  type="date"
                  value={medicationForm.date}
                  onChange={(e) => setMedicationForm({ ...medicationForm, date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Observations / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Taken smoothly with breakfast meal"
                  value={medicationForm.notes}
                  onChange={(e) => setMedicationForm({ ...medicationForm, notes: e.target.value })}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setIsDailyProgressModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isSubmittingProgress} style={{ padding: "8px 16px", background: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  {isSubmittingProgress ? "Saving..." : "Verify Medication"}
                </button>
              </div>
            </form>
          )}

          {/* Form 4: Media Upload */}
          {progressFormTab === "media" && (
            <form onSubmit={handleLogMedia} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div>
                <label style={labelStyle}>Select Foster Dog Photo *</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={handleMediaFileChange}
                  style={inputStyle}
                />
              </div>
              {mediaPreview && (
                <div style={{ textAlign: "center", padding: "8px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <img src={mediaPreview} alt="Preview" style={{ maxHeight: "180px", maxWidth: "100%", borderRadius: "6px", objectFit: "contain" }} />
                </div>
              )}
              <div>
                <label style={labelStyle}>Caption</label>
                <input
                  type="text"
                  placeholder="e.g. Relaxing in the living room after playtime"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Optional Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Showing healthy coat progress"
                  value={mediaNotes}
                  onChange={(e) => setMediaNotes(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setIsDailyProgressModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={isUploadingMedia} style={{ padding: "8px 16px", background: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  {isUploadingMedia ? "Uploading Photo..." : "Upload Care Photo"}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: REPORT MEDICAL SYMPTOM / REQUEST VET CHECK */}
      {/* ============================================================ */}
      <Modal
        isOpen={isMedicalModalOpen}
        onClose={() => setIsMedicalModalOpen(false)}
        title="🩺 Report Medical Symptom / Request Vet Consultation"
        maxWidth="600px"
      >
        <form onSubmit={handleRequestVetCheck} style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%" }}>
          <div>
            <label style={labelStyle}>Assigned Foster Dog *</label>
            <select
              value={selectedPlacementId}
              onChange={(e) => setSelectedPlacementId(e.target.value)}
              style={inputStyle}
            >
              {placements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.dog?.name || "Foster Dog"} ({p.dog?.registration_number || "REG"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Urgency Level *</label>
            <select
              value={medicalForm.urgency}
              onChange={(e) => setMedicalForm({ ...medicalForm, urgency: e.target.value as any })}
              style={inputStyle}
            >
              <option value="routine">Routine - General Wellness / Routine Check</option>
              <option value="urgent">Urgent - Acute symptom (Appetite loss, Diarrhea, Lethargy)</option>
              <option value="emergency">Emergency - Severe injury / Immediate clinical triage</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Primary Reason / Symptom *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mild limping on right hind leg after morning walk"
              value={medicalForm.reason}
              onChange={(e) => setMedicalForm({ ...medicalForm, reason: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Preferred Consultation Date</label>
            <input
              type="date"
              value={medicalForm.preferred_date}
              onChange={(e) => setMedicalForm({ ...medicalForm, preferred_date: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Detailed Clinical Symptom Observations</label>
            <textarea
              rows={3}
              placeholder="Describe when symptoms started, eating/drinking behavior, energy levels, and any home remedies attempted..."
              value={medicalForm.notes}
              onChange={(e) => setMedicalForm({ ...medicalForm, notes: e.target.value })}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setIsMedicalModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isSubmittingMedical} style={{ padding: "8px 16px", background: "#DC2626", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              {isSubmittingMedical ? "Submitting..." : "Submit Vet Check Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: REQUEST FOSTER SUPPLIES */}
      {/* ============================================================ */}
      <Modal
        isOpen={isSupplyModalOpen}
        onClose={() => setIsSupplyModalOpen(false)}
        title="📦 Request Foster Supplies"
        maxWidth="550px"
      >
        <form onSubmit={handleRequestSupplies} style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%" }}>
          <div>
            <label style={labelStyle}>Assigned Foster Dog *</label>
            <select
              value={selectedPlacementId}
              onChange={(e) => setSelectedPlacementId(e.target.value)}
              style={inputStyle}
            >
              {placements.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.dog?.name || "Foster Dog"} ({p.dog?.registration_number || "REG"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Supply Item Category *</label>
            <select
              value={supplyForm.item_type}
              onChange={(e) => setSupplyForm({ ...supplyForm, item_type: e.target.value as any })}
              style={inputStyle}
            >
              <option value="food">Kibble / Wet Food</option>
              <option value="crate">Crate / Exercise Pen / Carrier</option>
              <option value="medication">Medications / Supplements</option>
              <option value="bedding">Bedding / Blankets</option>
              <option value="toys">Enrichment Toys / Chews</option>
              <option value="other">Other Foster Equipment</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Item Specifics / Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Adult Dog Chicken &amp; Rice Kibble 5kg bag"
              value={supplyForm.description}
              onChange={(e) => setSupplyForm({ ...supplyForm, description: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Quantity *</label>
            <input
              type="number"
              min="1"
              max="20"
              required
              value={supplyForm.quantity}
              onChange={(e) => setSupplyForm({ ...supplyForm, quantity: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setIsSupplyModalOpen(false)} style={{ padding: "8px 14px", background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={isSubmittingSupply} style={{ padding: "8px 16px", background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              {isSubmittingSupply ? "Submitting..." : "Submit Supply Request"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FosterFamilyDashboard;
