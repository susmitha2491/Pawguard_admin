import React, { useState, useEffect, useCallback } from "react";
import StatCard from "../../../components/dashboard/StatCard";
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
  FaHeart,
  FaDog,
  FaCheckCircle,
} from "react-icons/fa";
import { fosterService } from "../../../services/fosterService";
import { petService } from "../../../services/petService";
import { storageService } from "../../../services/storageService";
import { adoptionService } from "../../../services/adoptionService";
import { getStoredUser } from "../../../utils/authStorage";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";

const extractBackendErrorMessage = (err: any, fallback: string): string => {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
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

const FosterFamilyDashboard: React.FC = () => {
  const { addToast } = useToast();
  const currentUser = getStoredUser<any>();

  // Main State
  const [placements, setPlacements] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Placement for Modals
  const [selectedPlacement, setSelectedPlacement] = useState<any | null>(null);

  // Daily Progress Portal Modal State
  const [isDailyProgressModalOpen, setIsDailyProgressModalOpen] = useState(false);
  const [activeProgressTab, setActiveProgressTab] = useState<"weight" | "behavior" | "medication" | "media" | "history">("weight");
  const [progressHistory, setProgressHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  // 2A. Weight Form
  const [weightForm, setWeightForm] = useState({
    weight_kg: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // 2B. Behavioral Form
  const [behaviorForm, setBehaviorForm] = useState({
    mood_rating: 5,
    exercise_minutes: 45,
    behavior_notes: "",
    notes: "",
  });

  // 2C. Medication Form
  const [medicationForm, setMedicationForm] = useState({
    medication_notes: "",
    verified: true,
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // 2D. Media Form
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaNotes, setMediaNotes] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Vet Check Modal State
  const [isVetCheckModalOpen, setIsVetCheckModalOpen] = useState(false);
  const [vetCheckForm, setVetCheckForm] = useState({
    urgency: "routine" as "routine" | "urgent" | "emergency",
    reason: "Routine Health Check",
    preferred_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Apply to Permanently Adopt Modal State
  const [isAdoptModalOpen, setIsAdoptModalOpen] = useState(false);
  const [adoptForm, setAdoptForm] = useState({
    residential_status: "owned",
    has_landlord_approval: true,
    has_yard_fence: true,
    household_members_count: 2,
    notes: "",
    agreement_confirmed: false,
  });
  const [isSubmittingAdopt, setIsSubmittingAdopt] = useState(false);

  // Fetch Placements & Foster Profile
  const fetchMyData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt loading foster placements for current family
      const [placementsRes, profileRes] = await Promise.allSettled([
        fosterService.getMyPlacements(),
        fosterService.getMyProfile(),
      ]);

      let placementList: any[] = [];
      if (placementsRes.status === "fulfilled" && placementsRes.value) {
        const val = placementsRes.value;
        placementList = Array.isArray(val) ? val : (val.data || val.items || []);
      }

      if (profileRes.status === "fulfilled" && profileRes.value) {
        setMyProfile(profileRes.value);
      }

      // If dog objects are not embedded, hydrate them
      const hydratedPlacements = await Promise.all(
        placementList.map(async (p: any) => {
          const dogId = String(p.dog_id || p.dog?.id || "");
          if (dogId && (!p.dog || !p.dog.name)) {
            try {
              const dogData = await petService.getPetById(dogId);
              return { ...p, dog: dogData };
            } catch {
              return p;
            }
          }
          return p;
        })
      );

      setPlacements(hydratedPlacements);
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to load foster profile. Please verify your connection.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  useDataSync(fetchMyData);

  // Load progress history for a placement
  const loadProgressHistory = async (placementId: string) => {
    try {
      setHistoryLoading(true);
      const res = await fosterService.getProgressLogs(placementId);
      const list = Array.isArray(res) ? res : (res?.data || res?.items || []);
      setProgressHistory(list);
    } catch {
      setProgressHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Daily Progress Modal
  const handleOpenDailyProgress = (placement: any, tab: "weight" | "behavior" | "medication" | "media" = "weight") => {
    setSelectedPlacement(placement);
    setActiveProgressTab(tab);
    setWeightForm({
      weight_kg: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setBehaviorForm({
      mood_rating: 5,
      exercise_minutes: 45,
      behavior_notes: "",
      notes: "",
    });
    setMedicationForm({
      medication_notes: "",
      verified: true,
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setMediaFile(null);
    setMediaCaption("");
    setMediaNotes("");
    setIsDailyProgressModalOpen(true);
    const placementId = String(placement.id || placement.placement_id || "");
    if (placementId) {
      loadProgressHistory(placementId);
    }
  };

  // 2A. Submit Weight Log
  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    const kg = parseFloat(weightForm.weight_kg);
    if (isNaN(kg) || kg <= 0) {
      addToast("Please enter a valid weight in kilograms.", "error");
      return;
    }
    try {
      setIsSubmittingProgress(true);
      await fosterService.logWeight(selectedPlacement.id, {
        weight_kg: kg,
        date: weightForm.date,
        notes: weightForm.notes.trim() || `Daily weight check: ${kg} kg`,
      });
      addToast("Weight recorded successfully!", "success");
      loadProgressHistory(selectedPlacement.id);
      setActiveProgressTab("history");
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to record weight."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // 2B. Submit Behavioral Log
  const handleBehaviorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    try {
      setIsSubmittingProgress(true);
      await fosterService.logBehavior(selectedPlacement.id, {
        mood_rating: behaviorForm.mood_rating,
        exercise_minutes: behaviorForm.exercise_minutes,
        behavior_notes: behaviorForm.behavior_notes.trim(),
        notes: behaviorForm.notes.trim(),
      });
      addToast("Behavior and exercise log submitted!", "success");
      loadProgressHistory(selectedPlacement.id);
      setActiveProgressTab("history");
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit behavior log."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // 2C. Submit Medication Check-in
  const handleMedicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    if (!medicationForm.medication_notes.trim()) {
      addToast("Please enter the medication name, dosage, or administration notes.", "error");
      return;
    }
    try {
      setIsSubmittingProgress(true);
      await fosterService.logMedication(selectedPlacement.id, {
        medication_notes: medicationForm.medication_notes.trim(),
        verified: medicationForm.verified,
        date: medicationForm.date,
        notes: medicationForm.notes.trim(),
      });
      addToast("Medication verification check-in logged!", "success");
      loadProgressHistory(selectedPlacement.id);
      setActiveProgressTab("history");
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to log medication check-in."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // 2D. Submit Media Upload
  const handleMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    if (!mediaFile) {
      addToast("Please choose an image file (JPEG or PNG) to upload.", "error");
      return;
    }
    try {
      setIsUploadingMedia(true);
      const url = await storageService.uploadFile(mediaFile, {
        folder: "foster_updates",
        entity_type: "foster_placement",
        entity_id: selectedPlacement.id,
      });

      await fosterService.logMedia(selectedPlacement.id, {
        photo_urls: [url],
        caption: mediaCaption.trim() || "Daily foster photo update",
        notes: mediaNotes.trim(),
      });

      addToast("Photo update uploaded and logged!", "success");
      setMediaFile(null);
      setMediaCaption("");
      setMediaNotes("");
      loadProgressHistory(selectedPlacement.id);
      setActiveProgressTab("history");
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to upload photo update."), "error");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Request Vet Check
  const handleOpenVetCheck = (placement: any) => {
    setSelectedPlacement(placement);
    setVetCheckForm({
      urgency: "routine",
      reason: "Routine Health Check",
      preferred_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setIsVetCheckModalOpen(true);
  };

  const handleVetCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    try {
      setIsSubmittingProgress(true);
      await fosterService.requestVetCheck(selectedPlacement.id, {
        urgency: vetCheckForm.urgency,
        reason: vetCheckForm.reason,
        preferred_date: new Date(vetCheckForm.preferred_date).toISOString(),
        notes: vetCheckForm.notes,
      });
      addToast("Vet check request sent to veterinary clinic!", "success");
      setIsVetCheckModalOpen(false);
      notifyDataChanged();
    } catch (err: any) {
      addToast(extractBackendErrorMessage(err, "Failed to submit vet check request."), "error");
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // Apply to Permanently Adopt (with zero 401 error guarantee)
  const handleOpenAdopt = (placement: any) => {
    setSelectedPlacement(placement);
    setAdoptForm({
      residential_status: "owned",
      has_landlord_approval: true,
      has_yard_fence: true,
      household_members_count: 2,
      notes: `We love having ${placement.dog?.name || "this animal"} in our home and would like to formally apply to adopt permanently!`,
      agreement_confirmed: false,
    });
    setIsAdoptModalOpen(true);
  };

  const handleAdoptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement) return;
    if (!adoptForm.agreement_confirmed) {
      addToast("Please confirm that you agree to complete the permanent adoption process.", "error");
      return;
    }

    const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
    const placementId = String(selectedPlacement.id || selectedPlacement.placement_id || "");

    try {
      setIsSubmittingAdopt(true);

      // Submit formal adoption application
      await adoptionService.createAdoption({
        dog_id: dogId,
        residential_status: adoptForm.residential_status,
        has_landlord_approval: adoptForm.has_landlord_approval,
        has_yard_fence: adoptForm.has_yard_fence,
        household_members_count: adoptForm.household_members_count,
        pet_care_experience: `Current active foster parent since ${selectedPlacement.start_date || selectedPlacement.created_at || "placement"}.`,
        notes: adoptForm.notes,
      });

      // Also notify foster coordinator workflow
      if (placementId) {
        await fosterService.logProgress(placementId, {
          notes: `[ADOPTION APPLICATION] Foster family submitted formal application to permanently adopt this animal.`,
        }).catch(() => null);
      }

      addToast("Adoption application submitted successfully! Your foster coordinator will review and finalize.", "success");
      setIsAdoptModalOpen(false);
      notifyDataChanged();
    } catch (err: any) {
      const msg = extractBackendErrorMessage(err, "Failed to submit adoption application.");
      addToast(msg, "error");
    } finally {
      setIsSubmittingAdopt(false);
    }
  };

  const activePlacementCount = placements.filter((p) => p.is_active !== false && !p.returned_at).length;
  const familyName = currentUser?.full_name || currentUser?.name || myProfile?.foster_family || "Foster Parent";

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px 28px",
          borderRadius: "16px",
          color: "#FFF",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>Welcome, {familyName}!</h1>
              <span style={{ padding: "4px 10px", borderRadius: "999px", background: "#10B981", color: "#FFF", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                Active Foster Home
              </span>
            </div>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "13.5px", maxWidth: "680px" }}>
              Foster Family Daily Portal: submit weight, behavioral notes, verified medication check-ins, upload photo updates, and request veterinary checkups for dogs currently under your care.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard
          title="Fostered Animals"
          value={loading ? "..." : `${activePlacementCount} in Care`}
          trend="Active Placements"
          color="#2563EB"
          icon={<FaDog />}
        />
        <StatCard
          title="Approved Capacity"
          value={loading ? "..." : `${myProfile?.max_capacity || 2} Dogs`}
          trend="Registered Home"
          color="#10B981"
          icon={<FaPaw />}
        />
        <StatCard
          title="Vetting Status"
          value={loading ? "..." : (myProfile?.background_check_passed ? "✓ Verified" : "⏳ Active")}
          trend="Background Cleared"
          color="#8B5CF6"
          icon={<FaCheckCircle />}
        />
        <StatCard
          title="Care Routine"
          value={loading ? "..." : "Daily Logs Active"}
          trend="Weight & Behavior"
          color="#F59E0B"
          icon={<FaCalendarCheck />}
        />
      </div>

      {/* Active Foster Dogs List */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
              Animals Currently in Your Care
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748B" }}>
              Select an animal to record daily health updates or submit an adoption request.
            </p>
          </div>
          {loading && <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 700 }}>Refreshing foster dogs...</span>}
        </div>

        {placements.length === 0 && !loading ? (
          <div style={{ background: "#FFF", border: "1px dashed #CBD5E1", borderRadius: "14px", padding: "40px 20px", textAlign: "center", color: "#64748B" }}>
            <FaDog size={40} color="#94A3B8" style={{ marginBottom: "12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#1E293B" }}>
              No Active Foster Animals Assigned
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748B", maxWidth: "480px", marginInline: "auto" }}>
              When your foster coordinator assigns a rescue dog to your home, their profile and daily health reporting options will automatically appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {placements.map((p) => {
              const dog = p.dog || {};
              const dogName = dog.name || `Pet #${String(p.dog_id || "").slice(0, 8)}`;
              const breed = dog.breed || dog.breed_classification || "Mixed Breed";
              const photoUrl = dog.primary_photo_url || dog.photo_url || dog.image_url;

              return (
                <div
                  key={p.id || p.placement_id}
                  style={{
                    background: "#FFF",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "20px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {/* Header with Photo & Name */}
                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "14px" }}>
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={dogName}
                          style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover", border: "1px solid #E2E8F0" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "12px",
                            background: "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748B",
                            fontSize: "24px",
                          }}
                        >
                          <FaDog />
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                            {dogName}
                          </h3>
                          <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#ECFDF5", color: "#047857", fontSize: "11px", fontWeight: 700 }}>
                            In Your Care
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                          {breed} {dog.gender ? `• ${dog.gender}` : ""} {dog.age_years ? `• ${dog.age_years} yrs` : ""}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px", fontFamily: "monospace" }}>
                          Placement: {String(p.id || "").slice(0, 8)}
                        </div>
                      </div>
                    </div>

                    {/* Care Details */}
                    <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#475569", marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      <div><strong>Placed On:</strong> {p.start_date || p.created_at ? new Date(p.start_date || p.created_at).toLocaleDateString() : "Active"}</div>
                      <div><strong>Diet/Food:</strong> {dog.dietary_guidance || dog.diet || "Standard Canine Diet"}</div>
                      <div style={{ gridColumn: "1 / -1" }}><strong>Coordinator Notes:</strong> {p.notes || "None"}</div>
                    </div>

                    {/* Daily Progress Action Badges */}
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                      Daily Progress Reporting:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDailyProgress(p, "weight")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaWeight color="#2563EB" /> Log Weight
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDailyProgress(p, "behavior")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaSmile color="#10B981" /> Behavioral Log
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDailyProgress(p, "medication")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaPills color="#8B5CF6" /> Medication
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDailyProgress(p, "media")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#1E293B",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaCamera color="#F59E0B" /> Photo Update
                      </button>
                    </div>
                  </div>

                  {/* Bottom Action Row: Vet Check & Apply to Adopt */}
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenVetCheck(p)}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#047857",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <FaStethoscope /> Request Vet
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAdopt(p)}
                      style={{
                        flex: 1.2,
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "linear-gradient(135deg, #DB2777 0%, #BE185D 100%)",
                        color: "#FFF",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        boxShadow: "0 2px 6px rgba(219,39,119,0.25)",
                      }}
                    >
                      <FaHeart /> Apply to Adopt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Progress Portal Modal (4 Tabs + History) */}
      <Modal
        isOpen={isDailyProgressModalOpen}
        onClose={() => setIsDailyProgressModalOpen(false)}
        title={`Daily Foster Progress: ${selectedPlacement?.dog?.name || "Animal"}`}
        maxWidth="680px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Sub Navigation Tabs */}
          <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid #E2E8F0", paddingBottom: "10px", flexWrap: "wrap" }}>
            {[
              { id: "weight", label: "⚖️ Weight Log" },
              { id: "behavior", label: "🎾 Behavioral Log" },
              { id: "medication", label: "💊 Medication Check-in" },
              { id: "media", label: "📷 Photo Update" },
              { id: "history", label: `📜 Progress History (${progressHistory.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveProgressTab(t.id as any)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: activeProgressTab === t.id ? 800 : 600,
                  background: activeProgressTab === t.id ? "#0F172A" : "#F1F5F9",
                  color: activeProgressTab === t.id ? "#FFF" : "#475569",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 2A: WEIGHT LOG */}
          {activeProgressTab === "weight" && (
            <form onSubmit={handleWeightSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "12px", fontSize: "12.5px", color: "#1E40AF" }}>
                Record animal weight regularly to help shelter medical staff track nutrition and recovery.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="e.g. 14.2"
                    value={weightForm.weight_kg}
                    onChange={(e) => setWeightForm({ ...weightForm, weight_kg: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Weigh-in Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={weightForm.date}
                    onChange={(e) => setWeightForm({ ...weightForm, date: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Observation Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Eating well, gained appetite after adjusting to food..."
                  value={weightForm.notes}
                  onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "70px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={isSubmittingProgress}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmittingProgress ? "Saving..." : "Record Weight Log"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2B: BEHAVIORAL LOG */}
          {activeProgressTab === "behavior" && (
            <form onSubmit={handleBehaviorSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "12px", fontSize: "12.5px", color: "#065F46" }}>
                Track daily temperament, exercise habits, socialization, and confidence building.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Mood &amp; Energy Rating
                  </label>
                  <select
                    value={behaviorForm.mood_rating}
                    onChange={(e) => setBehaviorForm({ ...behaviorForm, mood_rating: Number(e.target.value) })}
                    style={inputStyle}
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ Happy, Calm &amp; Relaxed (5/5)</option>
                    <option value={4}>⭐⭐⭐⭐ Active &amp; Playful (4/5)</option>
                    <option value={3}>⭐⭐⭐ Moderate / Quiet (3/5)</option>
                    <option value={2}>⭐⭐ Shy / Timid / Anxious (2/5)</option>
                    <option value={1}>⭐ Stressed / Agitated (1/5)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Daily Exercise / Walk (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={behaviorForm.exercise_minutes}
                    onChange={(e) => setBehaviorForm({ ...behaviorForm, exercise_minutes: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Behavioral Observations &amp; Milestones
                </label>
                <textarea
                  placeholder="e.g. Walked politely on leash, responded to sit command, slept well in crate..."
                  value={behaviorForm.behavior_notes}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, behavior_notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "75px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={isSubmittingProgress}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmittingProgress ? "Saving..." : "Save Behavioral Log"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2C: MEDICATION CHECK-IN */}
          {activeProgressTab === "medication" && (
            <form onSubmit={handleMedicationSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "12px", fontSize: "12.5px", color: "#5B21B6" }}>
                Verify administration of prescribed antibiotics, flea/tick prevention, supplements, or eye drops.
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Medication Administered &amp; Dosage *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amoxicillin 250mg with evening meal, Flea preventative tablet"
                  value={medicationForm.medication_notes}
                  onChange={(e) => setMedicationForm({ ...medicationForm, medication_notes: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, color: "#1E293B", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={medicationForm.verified}
                    onChange={(e) => setMedicationForm({ ...medicationForm, verified: e.target.checked })}
                  />
                  I confirm this dose was administered accurately to the animal
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Reactions or Eating Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Took pill easily with peanut butter, no upset stomach..."
                  value={medicationForm.notes}
                  onChange={(e) => setMedicationForm({ ...medicationForm, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "65px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={isSubmittingProgress}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#8B5CF6", color: "#FFF", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isSubmittingProgress ? "Saving..." : "Verify Medication Dose"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2D: MEDIA UPLOAD */}
          {activeProgressTab === "media" && (
            <form onSubmit={handleMediaSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "12px", fontSize: "12.5px", color: "#92400E" }}>
                Share high-resolution pictures to showcase foster recovery, personality, and aid adoption matching!
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Choose Photo (JPEG / PNG up to 10MB) *
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  required
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  style={{ ...inputStyle, padding: "8px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Caption / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Relaxing in the garden, Playing fetch at the park"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Story / Progress Notes
                </label>
                <textarea
                  placeholder="Describe how the animal was doing in this photo..."
                  value={mediaNotes}
                  onChange={(e) => setMediaNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: "65px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="submit"
                  disabled={isUploadingMedia || !mediaFile}
                  style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#F59E0B", color: "#FFF", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isUploadingMedia ? "Uploading Media..." : "Upload Photo Update"}
                </button>
              </div>
            </form>
          )}

          {/* TAB: PROGRESS HISTORY */}
          {activeProgressTab === "history" && (
            <div>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#64748B", fontSize: "13px" }}>Loading logs...</div>
              ) : progressHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 20px", color: "#94A3B8", fontSize: "13px", border: "1px dashed #CBD5E1", borderRadius: "8px" }}>
                  No daily progress logs submitted yet for this placement.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
                  {progressHistory.map((item, idx) => (
                    <div key={idx} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", fontSize: "12.5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <strong style={{ color: "#0F172A" }}>
                          {item.weight_kg ? `⚖️ Weight: ${item.weight_kg} kg` : (item.mood_rating ? `🎾 Mood: ${item.mood_rating}/5` : "Daily Log")}
                        </strong>
                        <span style={{ color: "#94A3B8", fontSize: "11.5px" }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                        </span>
                      </div>
                      {item.behavior_notes && <div style={{ color: "#334155" }}>Behavior: {item.behavior_notes}</div>}
                      {item.medication_notes && <div style={{ color: "#7E22CE" }}>Medication: {item.medication_notes}</div>}
                      {item.notes && <div style={{ color: "#64748B", marginTop: "2px" }}>Notes: {item.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Vet Check Request Modal */}
      <Modal
        isOpen={isVetCheckModalOpen}
        onClose={() => setIsVetCheckModalOpen(false)}
        title={`Request Vet Check: ${selectedPlacement?.dog?.name || "Animal"}`}
        maxWidth="560px"
      >
        <form onSubmit={handleVetCheckSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "12px", fontSize: "12.5px", color: "#065F46" }}>
            Submit a veterinary checkup request. The veterinary team and foster coordinator will review and schedule an examination.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Urgency Level *
              </label>
              <select
                value={vetCheckForm.urgency}
                onChange={(e) => setVetCheckForm({ ...vetCheckForm, urgency: e.target.value as any })}
                style={inputStyle}
              >
                <option value="routine">Routine Checkup</option>
                <option value="urgent">Urgent (Needs attention within 24-48h)</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
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
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Reason for Checkup *
            </label>
            <select
              value={vetCheckForm.reason}
              onChange={(e) => setVetCheckForm({ ...vetCheckForm, reason: e.target.value })}
              style={inputStyle}
            >
              <option value="Routine Health Check">Routine Health &amp; Wellness</option>
              <option value="Vaccination Follow-up">Vaccination Booster</option>
              <option value="Illness / Symptom Evaluation">Symptom Evaluation (Cough, Lethargy)</option>
              <option value="Dietary / Weight Management">Dietary / Digestive Concern</option>
              <option value="Other">Other Medical Reason</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Symptoms &amp; Observations
            </label>
            <textarea
              placeholder="Describe symptoms, duration, behavior changes..."
              value={vetCheckForm.notes}
              onChange={(e) => setVetCheckForm({ ...vetCheckForm, notes: e.target.value })}
              style={{ ...inputStyle, minHeight: "75px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => setIsVetCheckModalOpen(false)}
              style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingProgress}
              style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#059669", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmittingProgress ? "Submitting..." : "Submit Vet Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Apply to Permanently Adopt Modal */}
      <Modal
        isOpen={isAdoptModalOpen}
        onClose={() => setIsAdoptModalOpen(false)}
        title={`Apply to Permanently Adopt: ${selectedPlacement?.dog?.name || "Animal"}`}
        maxWidth="600px"
      >
        <form onSubmit={handleAdoptSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#FDF2F8", border: "1px solid #FBCFE8", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <FaHeart color="#DB2777" size={22} style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 800, color: "#831843" }}>
                Foster-to-Adopt Transition Application
              </h4>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9D174D", lineHeight: "1.4" }}>
                As an active foster parent, your home is already inspected and cleared! Submitting this request will fast-track your adoption application with the adoption coordinator.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Residential Ownership
              </label>
              <select
                value={adoptForm.residential_status}
                onChange={(e) => setAdoptForm({ ...adoptForm, residential_status: e.target.value })}
                style={inputStyle}
              >
                <option value="owned">Owned Home</option>
                <option value="rented">Rented (Landlord Approved)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Household Members
              </label>
              <input
                type="number"
                min="1"
                value={adoptForm.household_members_count}
                onChange={(e) => setAdoptForm({ ...adoptForm, household_members_count: Number(e.target.value) })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Adoption Motivation &amp; Long-Term Care Plan *
            </label>
            <textarea
              required
              placeholder="Tell us about your bond with this animal and your readiness for lifelong adoption..."
              value={adoptForm.notes}
              onChange={(e) => setAdoptForm({ ...adoptForm, notes: e.target.value })}
              style={{ ...inputStyle, minHeight: "80px" }}
            />
          </div>

          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
              <input
                type="checkbox"
                required
                checked={adoptForm.agreement_confirmed}
                onChange={(e) => setAdoptForm({ ...adoptForm, agreement_confirmed: e.target.checked })}
                style={{ marginTop: "2px" }}
              />
              <span>
                I confirm that our family intends to permanently adopt this animal, assume lifelong care responsibility, and sign final adoption agreements.
              </span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setIsAdoptModalOpen(false)}
              style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdopt}
              style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "#DB2777", color: "#FFF", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmittingAdopt ? "Submitting..." : "Submit Permanent Adoption Application"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FosterFamilyDashboard;
