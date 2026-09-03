import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaHome,
  FaBed,
  FaPaw,
  FaBoxes,
  FaQrcode,
  FaStethoscope,
  FaEye,
  FaEdit,
  FaDownload,
  FaPrint,
  FaSync,
  FaPlus,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaCheckCircle,
} from "react-icons/fa";
import shelterService from "../../../services/shelterService";
import petService from "../../../services/petService";
import rescueService from "../../../services/rescueService";
import inventoryService from "../../../services/inventoryService";

import storageService from "../../../services/storageService";
import { getDogPhotoUrl } from "../../pets/Pets";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import { generateQrDataUrl, generateQrBlob } from "../../../utils/qrGenerator";
import { formatDateTime } from "../../../utils/dateUtils";
import { getCurrentUser, getCurrentUserRole } from "../../../utils/roleUtils";



const IN_SHELTER_STATUSES = ["rescued", "clinic", "shelter"];
const DOG_STATUSES = ["rescued", "clinic", "shelter", "fostered", "adopted"];
const GENDERS = ["male", "female", "unknown"];

const emptyPetForm = {
  name: "",
  photo_url: "",
  breed: "",
  gender: "male",
  estimated_age: "",
  age_months: "",
  weight: "",
  color: "",
  rescue_case_id: "",
  rescue_date: "",
  rescue_location: "",
  shelter_id: "",
  intake_condition: "",
  medical_notes: "",
  is_adoptable: false,
  status: "shelter",
};

const cleanPayload = (data: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
};

const triggerDownload = (url: string, filename: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const formatDateOnly = (dStr?: string) => {
  if (!dStr) return "-";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dStr;
  }
};

const getRescueAgentName = (c: any) => {
  if (!c) return "";
  if (c.dispatch?.driver_name) return c.dispatch.driver_name;
  if (c.dispatch?.driver?.full_name) return c.dispatch.driver.full_name;
  if (Array.isArray(c.dispatch?.agents) && c.dispatch.agents.length > 0) {
    const names = c.dispatch.agents
      .map((a: any) => a.agent_name || a.agent?.full_name || "")
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  return "";
};

const DogRowActions = ({
  row,
  onView,
  onEdit,
  onQr,
  onCage,
  onMedical,
  onTransfer,
  onAdoptionReadiness,
}: {
  row: any;
  onView: () => void;
  onEdit: () => void;
  onQr: () => void;
  onCage: () => void;
  onMedical: () => void;
  onTransfer?: () => void;
  onAdoptionReadiness?: () => void;
}) => {
  const [showMore, setShowMore] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = String(row.status || "").toLowerCase().trim();
  const isAdopted = status === "adopted";
  const hasCage = !!(row.kennel_id || row.cage_number);
  const hasActiveTag = !!row.has_active_tag;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    if (showMore) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMore]);

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      {/* ONLY ONE compact "•••" button for every dog row */}
      <button
        type="button"
        title="Actions Menu"
        onClick={(e) => {
          e.stopPropagation();
          setShowMore(!showMore);
        }}
        style={{
          padding: "6px 12px",
          borderRadius: "6px",
          border: "1px solid #CBD5E1",
          background: showMore ? "#F1F5F9" : "#FFF",
          color: "#475569",
          fontSize: "13px",
          fontWeight: 800,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        •••
      </button>

      {showMore && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            background: "#FFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            padding: "4px 0",
            minWidth: "170px",
            zIndex: 99,
          }}
        >
          {/* 1. View Dog */}
          <button
            type="button"
            onClick={() => {
              setShowMore(false);
              onView();
            }}
            style={{
              width: "100%",
              padding: "8px 14px",
              textAlign: "left",
              border: "none",
              background: "transparent",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaEye color="#1E3A8A" /> View Dog
          </button>

          {/* 2. Edit Dog */}
          <button
            type="button"
            onClick={() => {
              setShowMore(false);
              onEdit();
            }}
            style={{
              width: "100%",
              padding: "8px 14px",
              textAlign: "left",
              border: "none",
              background: "transparent",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaEdit color="#15803D" /> Edit Dog
          </button>

          {/* 3. Cage / Kennel Allocation */}
          {!isAdopted && (
            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onCage();
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaBed color="#1E3A8A" /> {hasCage ? "Reassign Cage" : "Allocate Cage"}
            </button>
          )}

          {/* 4. Safety Tag / QR */}
          {(!isAdopted || hasActiveTag) && (
            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onQr();
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaQrcode color="#1E3A8A" /> {hasActiveTag ? "View Safety Tag" : "Generate Safety Tag"}
            </button>
          )}

          {/* 5. Medical Records */}
          <button
            type="button"
            onClick={() => {
              setShowMore(false);
              onMedical();
            }}
            style={{
              width: "100%",
              padding: "8px 14px",
              textAlign: "left",
              border: "none",
              background: "transparent",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaStethoscope color="#DC2626" /> Medical Records
          </button>

          {/* 6. Facility Transfer */}
          {onTransfer && !isAdopted && (
            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onTransfer();
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaExchangeAlt color="#1E3A8A" /> Facility Transfer
            </button>
          )}

          {/* 7. Mark Ready for Adoption */}
          {onAdoptionReadiness && !row.is_adoptable && !isAdopted && (
            <button
              type="button"
              onClick={() => {
                setShowMore(false);
                onAdoptionReadiness();
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                fontSize: "12px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaCheckCircle color="#15803D" /> Ready for Adoption
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ShelterManagerDashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dogs, setDogs] = useState<any[]>([]);
  const [kennelRows, setKennelRows] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [incomingRescues, setIncomingRescues] = useState<any[]>([]);
  const [allRescues, setAllRescues] = useState<any[]>([]);
  const [selectedRescueForDetails, setSelectedRescueForDetails] = useState<any>(null);
  const [isRescueDetailsModalOpen, setIsRescueDetailsModalOpen] = useState(false);
  const [activeRescueForIntake, setActiveRescueForIntake] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [transfersList, setTransfersList] = useState<any[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    dogId: "",
    fromFacilityId: "",
    toFacilityId: "",
    notes: "",
  });

  const [dashboardData, setDashboardData] = useState({
    total_facilities: 0,
    total_dogs: 0,
    adoptable_dogs: 0,
    total_kennels: 0,
    in_shelter_dogs: 0,
    total_capacity: 0,
  });

  // Modal States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewMasterModalOpen, setIsViewMasterModalOpen] = useState(false);
  const [isCageModalOpen, setIsCageModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Safety Tag Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDog, setQrDog] = useState<any | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [, setQrBlob] = useState<Blob | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [tagStatus, setTagStatus] = useState<string>("INACTIVE");
  const [tagMetadata, setTagMetadata] = useState<Record<string, unknown> | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [isReProvisionConfirmOpen, setIsReProvisionConfirmOpen] = useState(false);
  const [isRefreshingScanData, setIsRefreshingScanData] = useState(false);



  // Selected Dog & Form States
  const [selectedDog, setSelectedDog] = useState<any | null>(null);
  const [petForm, setPetForm] = useState({ ...emptyPetForm });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photo uploads state
  const [intakePhotoFile, setIntakePhotoFile] = useState<File | null>(null);
  const [intakePhotoUrl, setIntakePhotoUrl] = useState<string>("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Backend-persisted photo URL map: dogId → presigned download URL
  const [dogPhotoMap, setDogPhotoMap] = useState<Record<string, string>>({});

  // Cage Allocation State
  const [cageSections, setCageSections] = useState<any[]>([]);
  const [cageKennels, setCageKennels] = useState<any[]>([]);
  const [cageSel, setCageSel] = useState({ facilityId: "", sectionId: "", kennelId: "", dogId: "" });
  const [cageLoading, setCageLoading] = useState(false);

  // Supply Request State
  const [supplyForm, setSupplyForm] = useState({
    itemName: "",
    category: "Food & Nutrition",
    stock: "50 kg",
    threshold: "10 kg",
    facilityId: "",
  });

  // Report Form State
  const [reportType, setReportType] = useState("occupancy");
  const [reportGeneratedText, setReportGeneratedText] = useState<string | null>(null);

  const unwrapList = (v: any) =>
    Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

  const isUuid = (val: unknown): boolean =>
    typeof val === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val.trim());

  const dogId = (dog: any): string => {
    if (!dog) return "";
    const candidates = [
      dog.id,
      dog.dog_id,
      dog.original_dog_id,
      dog.companion_pet?.original_dog_id,
      dog.companion_pet_id,
      dog.companion_pet?.id,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && isUuid(c)) return c.trim();
    }
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    return "";
  };

  const formatDog = (dog: any) => {
    const hasActiveTag = !!(dog.safety_tag_status === "ACTIVE" || dog.safety_tag_active === true || dog.is_active === true);

    return {
      ...dog,
      registration_number: dog.registration_number || dog.id || "-",
      rescue_id: dog.rescue_case_id || dog.rescue_id || dog.rescue_case?.id || "-",
      // Preserve raw kennel_id UUID so the table can cross-reference kennel name
      kennel_id: dog.kennel_id || null,
      name: dog.name || "-",
      breed: dog.breed || "-",
      gender: dog.gender || "",
      estimated_age: dog.estimated_age || dog.age || "-",
      age_months: dog.age_months ?? "",
      weight: dog.weight ?? "",
      is_adoptable: !!dog.is_adoptable,
      status: dog.status || "shelter",
      medical_status: dog.is_fit_for_adoption ? "Fit for Adoption" : dog.medical_status || "Medically Cleared",
      adoption_status: dog.is_adoptable ? "Ready for Adoption" : dog.status === "adopted" ? "Adopted" : "In Shelter Care",
      has_active_tag: hasActiveTag,
      tag_status_label: hasActiveTag ? "ACTIVE" : "INACTIVE",
      rescue_date: dog.rescue_date ? String(dog.rescue_date).slice(0, 10) : dog.created_at ? String(dog.created_at).slice(0, 10) : "-",
      intake_date: dog.created_at ? String(dog.created_at).slice(0, 10) : "-",
    };
  };

  const mapKennel = (k: any, sectionName?: string) => ({
    id: k.id || k.kennel_id || "",
    cageNo: k.identifier || k.kennel_number || k.name || "",
    section: sectionName || k.section_name || "",
    capacity: k.capacity ?? "",
    status: k.sanitation_state || k.sanitation || "",
  });

  // Resolve a kennel UUID → human-readable identifier (e.g. "K-01") from kennelRows
  const getKennelLabel = (kennelId: string | null | undefined): string => {
    if (!kennelId) return "Unassigned";
    const found = kennelRows.find((kr: any) => String(kr.id) === String(kennelId));
    if (found) return found.cageNo || found.id;
    // Fallback: show truncated UUID so we know it's set but not yet loaded
    return `Kennel (${String(kennelId).slice(0, 8)}…)`;
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const [facilitiesRes, dogsRes, rescueCasesRes, transfersRes, dashSummaryRes] = await Promise.allSettled([
        shelterService.getShelters({ page: 1, page_size: 50 }),
        petService.getAllDogs(),
        rescueService.getRescueCases({ page: 1, page_size: 50 }),
        shelterService.getTransfers({ page: 1, page_size: 50 }),
        shelterService.getShelterDashboard().catch(() => null),
      ]);

      const currentUser = getCurrentUser();
      const userRole = getCurrentUserRole();
      const isShelterMgr = userRole === "shelter_manager";
      const currentShelterId = (currentUser as any)?.shelter_id || (currentUser as any)?.shelterId || (currentUser as any)?.facility_id || (currentUser as any)?.facilityId || (currentUser as any)?.organization_id;

      let facList = facilitiesRes.status === "fulfilled" ? unwrapList(facilitiesRes.value) : [];
      let dogList = dogsRes.status === "fulfilled" ? unwrapList(dogsRes.value).map(formatDog) : [];
      const rescueCases = rescueCasesRes.status === "fulfilled" ? unwrapList(rescueCasesRes.value) : [];
      const rawTransfers = transfersRes.status === "fulfilled" ? unwrapList(transfersRes.value) : [];
      const dashSummary = dashSummaryRes.status === "fulfilled" && dashSummaryRes.value ? (dashSummaryRes.value?.data ?? dashSummaryRes.value) : null;

      if (dogsRes.status === "rejected") {
        const errDetail = (dogsRes.reason as any)?.response?.data?.detail || (dogsRes.reason as any)?.response?.data?.message || "Failed to load dogs data.";
        setError(`⚠️ ${errDetail}`);
      }

      // Facility scoping for Shelter Manager if shelter_id is defined
      if (isShelterMgr && currentShelterId) {
        facList = facList.filter((f: any) => String(f.id || f.facility_id) === String(currentShelterId));
        dogList = dogList.filter((d: any) => !d.shelter_id || String(d.shelter_id) === String(currentShelterId) || String(d.shelter_facility_id) === String(currentShelterId));
      }

      setFacilities(facList);
      setDogs(dogList);
      setAllRescues(rescueCases);
      setTransfersList(rawTransfers);

      // Collect all rescue case IDs that have already been registered into Dog Master / Shelter Dogs
      const registeredRescueIds = new Set(
        dogList
          .map((d: any) => String(d.rescue_id || d.rescue_case_id || d.rescue_case?.id || "").trim())
          .filter(Boolean)
      );

      // Filter incoming rescued dogs requiring Shelter Manager intake action (Pending Action Queue)
      const seenCaseIds = new Set<string>();
      const incoming = rescueCases.filter((c: any) => {
        const caseId = String(c.id || c.rescue_case_id || "").trim();
        if (seenCaseIds.has(caseId)) return false;

        const st = String(c.status || "").toLowerCase().trim();

        // If already registered in Dog Master File, intake is complete -> exclude from pending queue
        if (caseId && registeredRescueIds.has(caseId)) return false;

        // Exclude finalized/completed/closed/cancelled/admitted statuses
        if (st === "admitted" || st === "completed" || st === "closed" || st === "cancelled" || st === "rejected") {
          return false;
        }

        // Include active pending handover/intake statuses
        const isPendingStatus =
          st === "rescued" ||
          st === "in_transit" ||
          st === "dispatched" ||
          st === "handover_pending" ||
          st === "pending_intake" ||
          st === "";

        if (isPendingStatus) {
          if (caseId) seenCaseIds.add(caseId);
          return true;
        }
        return false;
      });
      setIncomingRescues(incoming);

      const totalCapacity = facList.reduce(
        (acc: number, f: any) => acc + (Number(f.total_capacity) || 0),
        0
      );
      const inShelterDogs = dogList.filter((d: any) =>
        IN_SHELTER_STATUSES.includes(String(d.status).toLowerCase())
      ).length;
      const adoptableDogs = dogList.filter((d: any) => d.is_adoptable).length;

      setDashboardData({
        total_facilities: dashSummary?.total_facilities ?? facList.length,
        total_dogs: dashSummary?.total_dogs ?? dogList.length,
        adoptable_dogs: dashSummary?.adoptable_dogs ?? adoptableDogs,
        in_shelter_dogs: dashSummary?.in_shelter_dogs ?? dashSummary?.current_occupancy ?? inShelterDogs,
        total_capacity: dashSummary?.total_capacity ?? totalCapacity,
        total_kennels: dashSummary?.total_kennels ?? 0,
      });

      // Load kennels
      const sectionResults = await Promise.allSettled(
        facList.map((s: any) =>
          shelterService.getFacilitySections(s.facility_id ?? s.id)
        )
      );
      const sections = sectionResults.flatMap((r) =>
        r.status === "fulfilled" ? unwrapList(r.value) : []
      );

      const sectionNames: Record<string, string> = {};
      for (const sec of sections) {
        if (sec?.id) sectionNames[sec.id] = sec.name || sec.id;
      }

      const kennelResults = await Promise.allSettled(
        sections.map((sec: any) =>
          shelterService.getSectionKennels(sec.section_id ?? sec.id)
        )
      );
      const kennels = kennelResults.flatMap((r) =>
        r.status === "fulfilled" ? unwrapList(r.value) : []
      );
      setKennelRows(kennels.map((k: any) => mapKennel(k, sectionNames[k.section_id])));
      setDashboardData((prev) => ({ ...prev, total_kennels: kennels.length }));
    } catch (err: any) {
      console.error("Shelter Dashboard Error:", err);
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load shelter manager metrics. Access may be restricted."
      );
    } finally {
      setLoading(false);
    }
  };



  /**
   * Load the persistent photo URL map from backend storage for all dogs.
   */
  const loadDogPhotoMap = async () => {
    try {
      const map = await storageService.buildPhotoMapForDogs();
      if (Object.keys(map).length > 0) {
        setDogPhotoMap(map);
      }
    } catch (err) {
      console.warn("Could not load dog photo map:", err);
    }
  };

  /**
   * Refresh the photo URL for a single dog in the dogPhotoMap.
   * Called after a successful photo upload so the profile refreshes immediately.
   */
  const refreshDogPhotoInMap = async (dId: string) => {
    try {
      const files = await storageService.getFilesByEntity("dog_profile", dId);
      const confirmed = files.filter((f: any) => f.is_uploaded);
      if (confirmed.length === 0) return;
      confirmed.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = confirmed[0];
      const dlRes = await storageService.getDownloadUrl(latest.id);
      if (dlRes?.download_url) {
        setDogPhotoMap((prev) => ({ ...prev, [dId]: dlRes.download_url }));
      }
    } catch (err) {
      console.warn(`Could not refresh photo for dog ${dId}:`, err);
    }
  };

  useDataSync(() => {
    fetchDashboard();
  });

  useEffect(() => {
    fetchDashboard();
    loadDogPhotoMap();
  }, []);

  // Handlers for Rescued Dog Registration
  const handleOpenReceiveRescue = (caseItem: any) => {
    setActiveRescueForIntake(caseItem);
    setIntakePhotoFile(null);
    setIntakePhotoUrl("");
    setPetForm({
      ...emptyPetForm,
      name: caseItem.animal_type ? `Rescued ${caseItem.animal_type}` : `Rescued Dog (${caseItem.ticket_number || caseItem.id})`,
      photo_url: caseItem.photo_url || "",
      rescue_case_id: caseItem.id || "",
      rescue_location: caseItem.location_address || "",
      rescue_date: caseItem.created_at ? String(caseItem.created_at).slice(0, 10) : "",
      intake_condition: caseItem.description || "Rescued animal handed over to shelter care",
      medical_notes: caseItem.notes || "",
      shelter_id: facilities[0]?.id || "",
      status: "shelter",
    });
    setIsRegisterModalOpen(true);
  };

  const handleRegisterPetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petForm.name) {
      addToast("Pet Name is required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      
      let photoUrl = petForm.photo_url;
      const existingDogProfileId = activeRescueForIntake?.dog_profile_id;

      // If there is an existing dog profile ID (from admitted case), upload photo first
      if (intakePhotoFile && existingDogProfileId) {
        photoUrl = await storageService.uploadFile(intakePhotoFile, {
          folder: "dogs",
          entity_type: "dog_profile",
          entity_id: existingDogProfileId,
        });
      }

      const payload = cleanPayload({
        name: petForm.name,
        photo_url: photoUrl || undefined,
        image_url: photoUrl || undefined,
        image_urls: photoUrl ? [photoUrl] : undefined,
        photo_gallery_urls: photoUrl ? [photoUrl] : undefined,
        breed: petForm.breed,
        gender: petForm.gender,
        estimated_age: petForm.estimated_age,
        age_months: petForm.age_months ? Number(petForm.age_months) : undefined,
        weight: petForm.weight ? Number(petForm.weight) : undefined,
        color: petForm.color,
        rescue_case_id: petForm.rescue_case_id || undefined,
        rescue_date: petForm.rescue_date || undefined,
        rescue_location: petForm.rescue_location || undefined,
        shelter_id: petForm.shelter_id || undefined,
        shelter_facility_id: petForm.shelter_id || undefined,
        intake_condition: petForm.intake_condition || undefined,
        medical_notes: petForm.medical_notes || undefined,
        is_adoptable: petForm.is_adoptable,
        status: petForm.status || "shelter",
      });

      // If the rescue case already has an auto-created dog profile (from /admitted),
      // update it instead of creating a duplicate record.
      let resultDog: any;
      if (existingDogProfileId) {
        const updRes = await petService.updatePet(existingDogProfileId, payload);
        resultDog = updRes?.data || updRes;
      } else {
        const createdRes = await petService.createPet(payload);
        resultDog = createdRes?.data || createdRes;

        const resultId = dogId(resultDog) || resultDog?.id;
        // If there was no existing ID initially, we upload now and update the created dog
        if (intakePhotoFile && resultId) {
          const uploadedUrl = await storageService.uploadFile(intakePhotoFile, {
            folder: "dogs",
            entity_type: "dog_profile",
            entity_id: resultId,
          });
          const updateRes = await petService.updatePet(resultId, {
            photo_url: uploadedUrl,
            image_url: uploadedUrl,
            image_urls: [uploadedUrl],
            photo_gallery_urls: [uploadedUrl],
          });
          resultDog = updateRes?.data || updateRes;
        }
      }

      const resultId = dogId(resultDog) || resultDog?.id;

      addToast(`Dog "${petForm.name}" registered into shelter care successfully!`, "success");
      setIsRegisterModalOpen(false);
      setActiveRescueForIntake(null);
      setPetForm({ ...emptyPetForm });
      fetchDashboard();
      notifyDataChanged();

      // Automatically prompt for Safety Tag Provisioning
      if (resultId && resultDog) {
        openQrModal(formatDog(resultDog));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || "Failed to register dog.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = dogId(selectedDog);
    if (!id) return;
    try {
      setIsSubmitting(true);
      
      let photoUrl = petForm.photo_url || getDogPhotoUrl(selectedDog, dogPhotoMap);
      if (editPhotoFile) {
        photoUrl = await storageService.uploadFile(editPhotoFile, {
          folder: "dogs",
          entity_type: "dog_profile",
          entity_id: id,
        });
      }

      const payload = cleanPayload({
        name: petForm.name,
        breed: petForm.breed,
        gender: petForm.gender,
        estimated_age: petForm.estimated_age,
        age_months: petForm.age_months ? Number(petForm.age_months) : undefined,
        weight: petForm.weight ? Number(petForm.weight) : undefined,
        color: petForm.color,
        status: petForm.status,
        is_adoptable: petForm.is_adoptable,
        photo_url: photoUrl || undefined,
        image_url: photoUrl || undefined,
        image_urls: photoUrl ? [photoUrl] : undefined,
        photo_gallery_urls: photoUrl ? [photoUrl] : undefined,
      });
      const res = await petService.updatePet(id, payload);
      const updatedDog = res?.data || res;

      addToast(`Dog profile for "${petForm.name}" updated!`, "success");
      setIsEditModalOpen(false);
      
      // Update local state immediately
      setDogs((prev) =>
        prev.map((d) => (dogId(d) === id ? formatDog({ ...d, ...updatedDog }) : d))
      );

      // If the selectedDog Master modal is currently open and viewing this dog, update it
      setSelectedDog((prev: any) =>
        prev && dogId(prev) === id ? formatDog({ ...prev, ...updatedDog }) : prev
      );

      setSelectedDog(null);

      // If a new photo was uploaded, update the photo map for instant display
      if (editPhotoFile && photoUrl) {
        setDogPhotoMap((prev) => ({ ...prev, [id]: photoUrl }));
        await refreshDogPhotoInMap(id);
      }

      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to update dog record.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safety Tag & QR Modal Handlers
  const openQrModal = async (dog: any) => {
    const id = dogId(dog);
    if (!id) return;
    setQrDog(dog);
    setQrBlob(null);
    setQrDog(dog);
    setQrBlob(null);
    setQrImageUrl(null);
    setQrError(null);
    setTagMetadata(null);
    setManualTokenInput("");
    setTagStatus("INACTIVE");
    setIsQrModalOpen(true);

    try {
      setQrLoading(true);
      let activeState = false;
      let authoritativeScanUrl: string | null = null;
      const isCompanion = Boolean((dog as any)?.is_companion_pet || (dog as any)?.companion_pet_id || (dog as any)?.owner_id);

      try {
        let metaRes: any = null;
        if (isCompanion) {
          try {
            metaRes = await petService.getCompanionPetSafetyTagMetadata(id);
          } catch {
            metaRes = await petService.getSafetyTagMetadata(id);
          }
        } else {
          try {
            metaRes = await petService.getSafetyTagMetadata(id);
          } catch {
            metaRes = await petService.getCompanionPetSafetyTagMetadata(id);
          }
        }

        const metaData = metaRes?.data || metaRes;
        if (metaData) {
          setTagMetadata(metaData);
          activeState = metaData.is_active === true || String(metaData.status || "").toUpperCase() === "ACTIVE";
          if (activeState) {
            setTagStatus("ACTIVE");
            const rawScanUrl = metaData.public_scan_url || metaData.public_scan_path;
            if (rawScanUrl && typeof rawScanUrl === "string" && rawScanUrl.trim()) {
              const cleanUrl = rawScanUrl.trim();
              const publicWebBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string) || "https://pawguard-public-web.vercel.app";
              authoritativeScanUrl = cleanUrl.startsWith("http")
                ? cleanUrl
                : `${publicWebBase.replace(/\/+$/, "")}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
            }
          } else {
            setTagStatus("INACTIVE");
            setQrImageUrl(null);
            setQrBlob(null);
            return;
          }
        }
      } catch (metaErr: unknown) {
        const e = metaErr as { response?: { status?: number; data?: { error?: { message?: string }; message?: string } } };
        const status = e?.response?.status;
        const apiMsg = e?.response?.data?.error?.message || e?.response?.data?.message;

        if (status === 404 || (apiMsg && apiMsg.toLowerCase().includes("not found"))) {
          setTagStatus("INACTIVE");
          setTagMetadata(null);
          setQrImageUrl(null);
          setQrBlob(null);
          return;
        } else if (status === 401) {
          setQrError("Authentication Failure (401): No valid authentication credentials provided or session expired. Please sign in again.");
          return;
        } else if (status === 403) {
          setQrError("Unauthorized (403): Your account role does not have permission to access Safety Tags for shelter animals.");
          return;
        } else if (apiMsg) {
          setQrError(String(apiMsg));
        }
      }

      if (authoritativeScanUrl) {
        const qrUrl = await generateQrDataUrl(authoritativeScanUrl);
        const blob = await generateQrBlob(authoritativeScanUrl);
        setQrImageUrl(qrUrl);
        setQrBlob(blob);
        setTagStatus("ACTIVE");
      } else if (activeState && !isCompanion) {
        try {
          const qrBlobData = await petService.getDogQrImage(id);
          const qrUrlData = URL.createObjectURL(qrBlobData);
          setQrImageUrl(qrUrlData);
          setQrBlob(qrBlobData);
          setTagStatus("ACTIVE");
        } catch {
          setQrImageUrl(null);
          setQrBlob(null);
          setQrError("Unable to load Safety Tag QR code from backend service. Please click Retry Request below.");
        }
      } else if (activeState && isCompanion) {
        const publicWebBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string) || "https://pawguard-public-web.vercel.app";
        const fallbackScanUrl = `${publicWebBase.replace(/\/+$/, "")}/api/v1/companion-pets/${id}/public-scan`;
        const qrUrl = await generateQrDataUrl(fallbackScanUrl);
        const blob = await generateQrBlob(fallbackScanUrl);
        setQrImageUrl(qrUrl);
        setQrBlob(blob);
        setTagStatus("ACTIVE");
      }
    } catch {
      setQrError("Failed to load Safety Tag metadata.");
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    setIsQrModalOpen(false);
    setQrDog(null);
    setQrImageUrl(null);
    setQrBlob(null);
  };

  const handleProvisionTag = async (forceReissue = false) => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsProvisioning(true);
    try {
      const res = await petService.provisionSafetyTag(id, forceReissue);
      const data = res?.data || res || {};
      const scanUrl = data.public_scan_url || `/api/v1/dogs/${id}/public-scan`;
      const publicWebBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string) || "https://pawguard-public-web.vercel.app";
      const fullUrl = scanUrl.startsWith("http") ? scanUrl : `${publicWebBase.replace(/\/+$/, "")}${scanUrl.startsWith("/") ? "" : "/"}${scanUrl}`;

      const qrDataUrl = await generateQrDataUrl(fullUrl);
      const blob = await generateQrBlob(fullUrl);

      setQrImageUrl(qrDataUrl);
      setQrBlob(blob);
      setTagStatus("ACTIVE");
      setTagMetadata({
        token_prefix: data.token_prefix || String(fullUrl).slice(-8),
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        scans_count: 0,
      });

      setIsReProvisionConfirmOpen(false);
      addToast("Safety Tag provisioned!", "success");
      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.message || "Failed to provision Safety Tag.", "error");
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleRefreshScanData = async () => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsRefreshingScanData(true);
    try {
      const metaRes = await petService.getSafetyTagMetadata(id);
      const metaData = metaRes?.data || metaRes;
      if (metaData) {
        setTagMetadata(metaData);
        if (metaData.status) setTagStatus(String(metaData.status).toUpperCase());
      }
      addToast("Scan activity data refreshed from backend.", "success");
    } catch {
      addToast("Could not refresh scan activity data.", "error");
    } finally {
      setIsRefreshingScanData(false);
    }
  };

  const handleDeactivateTag = async () => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsDeactivating(true);
    try {
      await petService.revokeSafetyTag(id);
      addToast(`Safety Tag deactivated for pet ${qrDog.name}.`, "success");
      setTagStatus("INACTIVE");
      setQrImageUrl(null);
      setQrBlob(null);
      setIsDeactivateConfirmOpen(false);
      fetchDashboard();
      notifyDataChanged();
    } catch {
      addToast("Failed to deactivate Safety Tag.", "error");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl || !qrDog) return;
    const name = qrDog.name ? String(qrDog.name).replace(/[^a-zA-Z0-9-_]/g, "_") : "Pet";
    triggerDownload(qrImageUrl, `PawGuard_SafetyTag_${name}.png`);
  };

  const handlePrintQr = () => {
    if (!qrImageUrl || !qrDog) return;
    const name = String(qrDog.name || "Pet");
    const reg = String(qrDog.registration_number || qrDog.id || "-");
    const win = window.open("", "_blank", "width=440,height=680");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>PawGuard Safety Tag - ${name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; text-align: center; color: #0F172A; }
            .card { border: 2px solid #1E3A8A; border-radius: 16px; padding: 24px; background: #FFF; }
            h1 { color: #1E3A8A; margin: 0 0 4px; font-size: 24px; }
            .sub { font-size: 11px; color: #64748B; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
            img.qr { width: 240px; height: 240px; margin: 14px auto; display: block; }
            .meta { font-size: 13px; color: #334155; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>PawGuard</h1>
            <div class="sub">Official Pet Safety Tag</div>
            <p class="meta"><strong>Name:</strong> ${name} &bull; <strong>Dog ID:</strong> ${reg}</p>
            <img class="qr" src="${qrImageUrl}" onload="setTimeout(function(){ window.print(); }, 250);" />
            <p class="meta">Scan QR to view pet safety information</p>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
  };

  // Cage Allocation Handlers
  const openCageModal = async (dog?: any) => {
    setCageSel({
      facilityId: facilities[0]?.id || "",
      sectionId: "",
      kennelId: "",
      dogId: dog ? dogId(dog) : "",
    });
    setCageSections([]);
    setCageKennels([]);
    setIsCageModalOpen(true);

    if (facilities[0]?.id) {
      onFacilityChange(facilities[0].id);
    }
  };

  const onFacilityChange = async (facilityId: string) => {
    setCageSel((s) => ({ ...s, facilityId, sectionId: "", kennelId: "" }));
    setCageKennels([]);
    if (!facilityId) {
      setCageSections([]);
      return;
    }
    try {
      const res = await shelterService.getFacilitySections(facilityId);
      setCageSections(unwrapList(res));
    } catch {
      setCageSections([]);
    }
  };

  const onSectionChange = async (sectionId: string) => {
    setCageSel((s) => ({ ...s, sectionId, kennelId: "" }));
    if (!sectionId) {
      setCageKennels([]);
      return;
    }
    try {
      const res = await shelterService.getSectionKennels(sectionId);
      setCageKennels(unwrapList(res));
    } catch {
      setCageKennels([]);
    }
  };

  const handleAssignCageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cageSel.kennelId || !cageSel.dogId) {
      addToast("Please select both a kennel and a dog.", "error");
      return;
    }
    const targetKennel = cageKennels.find((k: any) => String(k.id || k.kennel_id) === String(cageSel.kennelId));
    if (targetKennel) {
      const cap = Number(targetKennel.capacity) || 1;
      const occ = Number(targetKennel.current_occupancy) || 0;
      if (occ >= cap) {
        addToast(`Cannot assign: Kennel "${targetKennel.identifier || targetKennel.name || "unit"}" is at maximum capacity (${occ}/${cap}).`, "error");
        return;
      }
    }
    try {
      setCageLoading(true);
      await shelterService.assignDogToKennel(cageSel.kennelId, cageSel.dogId);
      addToast("Dog successfully assigned to cage/kennel!", "success");
      setIsCageModalOpen(false);

      // Immediately update the local dogs state so the table/modal reflect the
      // new kennel_id without waiting for a full dashboard re-fetch.
      setDogs((prev: any[]) =>
        prev.map((d: any) =>
          dogId(d) === cageSel.dogId
            ? { ...d, kennel_id: cageSel.kennelId }
            : d
        )
      );
      // Also refresh if selectedDog is the same dog
      setSelectedDog((prev: any) =>
        prev && dogId(prev) === cageSel.dogId
          ? { ...prev, kennel_id: cageSel.kennelId }
          : prev
      );

      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to assign dog to kennel.", "error");
    } finally {
      setCageLoading(false);
    }
  };

  // Supply Request Handler
  const handleSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyForm.itemName) {
      addToast("Item name is required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await inventoryService.createInventoryItem({
        itemName: supplyForm.itemName,
        category: supplyForm.category,
        stock: supplyForm.stock,
        threshold: supplyForm.threshold,
      });
      addToast(`Supply request for "${supplyForm.itemName}" created!`, "success");
      setIsSupplyModalOpen(false);
      setSupplyForm({ itemName: "", category: "Food & Nutrition", stock: "50 kg", threshold: "10 kg", facilityId: "" });
      notifyDataChanged();
    } catch {
      addToast("Failed to submit supply request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Facility Transfer Placement Handler
  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.dogId || !transferForm.toFacilityId) {
      addToast("Please select both a dog and target facility.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await shelterService.createTransfer({
        dog_id: transferForm.dogId,
        from_facility_id: transferForm.fromFacilityId || facilities[0]?.id || "",
        to_facility_id: transferForm.toFacilityId,
        notes: transferForm.notes,
      });
      addToast("Facility transfer placement requested successfully!", "success");
      setIsTransferModalOpen(false);
      setTransferForm({ dogId: "", fromFacilityId: "", toFacilityId: "", notes: "" });
      fetchDashboard();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.response?.data?.message || "Failed to create transfer request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adoption Readiness Handoff Handler
  const handleMarkReadyForAdoption = async (dog: any) => {
    const id = dogId(dog);
    if (!id) return;
    try {
      setIsSubmitting(true);
      await petService.updatePet(id, {
        is_adoptable: true,
        adoption_status: "Ready for Adoption",
        status: "shelter",
      });
      setDogs((prev) =>
        prev.map((d) => (dogId(d) === id ? { ...d, is_adoptable: true, adoption_status: "Ready for Adoption" } : d))
      );
      addToast(`Dog "${dog.name}" is now marked Ready for Adoption!`, "success");
      notifyDataChanged();
    } catch (err: any) {
      addToast("Failed to update adoption readiness status.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Report Generator Handler
  const handleGenerateReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = formatDateTime(new Date());
    let title = "Shelter Occupancy & Capacity Report";
    let body = `Total Shelter Dogs: ${dashboardData.total_dogs}\nAdoptable Dogs: ${dashboardData.adoptable_dogs}\nKennels Registered: ${dashboardData.total_kennels}\nCapacity Utilization: ${dashboardData.total_capacity > 0 ? Math.round((dashboardData.in_shelter_dogs / dashboardData.total_capacity) * 100) : 0}%`;

    if (reportType === "intake") {
      title = "Rescued Dog Intake & Registration Report";
      body = `Incoming Rescued Dogs Handed Over: ${incomingRescues.length}\nRegistered Dogs in Care: ${dogs.length}\nLast Updated: ${now}`;
    } else if (reportType === "tags") {
      title = "Safety Tag & QR Code Audit Report";
      body = `Active Safety Tags Provisioned: ${dogs.length}\nScan Activity Status: Operational\nLast Audit Date: ${now}`;
    }

    setReportGeneratedText(`=======================================\nPAWGUARD SHELTER OPERATIONS REPORT\n${title}\nGenerated Date: ${now}\n=======================================\n\n${body}`);
  };

  const filteredDogs = dogs.filter((d: any) => {
    const q = search.toLowerCase().trim();
    const nameMatch =
      !q ||
      String(d.name).toLowerCase().includes(q) ||
      String(d.registration_number).toLowerCase().includes(q) ||
      String(d.rescue_id).toLowerCase().includes(q) ||
      String(d.breed).toLowerCase().includes(q) ||
      String(d.medical_status).toLowerCase().includes(q) ||
      String(d.adoption_status).toLowerCase().includes(q) ||
      String(d.tag_status_label).toLowerCase().includes(q);
    const statusMatch = !statusFilter || String(d.status).toLowerCase() === statusFilter.toLowerCase();
    return nameMatch && statusMatch;
  });

  const { total_capacity, in_shelter_dogs } = dashboardData;
  const occupancyText = total_capacity > 0 ? `${Math.round((in_shelter_dogs / total_capacity) * 100)}%` : "N/A";

  const stats = [
    { title: "Total Shelter Dogs", value: loading ? "..." : dashboardData.total_dogs, trend: `${dashboardData.adoptable_dogs} Adoptable`, color: "#1E3A8A", icon: <FaHome /> },
    { title: "Dogs in Shelter Care", value: loading ? "..." : dashboardData.in_shelter_dogs, trend: "Rescued & Shelter Care", color: "#16A34A", icon: <FaPaw /> },
    { title: "Adoptable Dogs", value: loading ? "..." : dashboardData.adoptable_dogs, trend: "Ready for Adoption", color: "#15803D", icon: <FaPaw /> },
    { title: "Kennel Occupancy", value: loading ? "..." : occupancyText, trend: `${in_shelter_dogs} In Care / ${total_capacity || 20} Capacity`, color: "#F59E0B", icon: <FaBed /> },
    { title: "Active Transfers", value: loading ? "..." : transfersList.length, trend: "Facility Placements", color: "#1E3A8A", icon: <FaExchangeAlt /> },
  ];

  const dogColumns = [
    {
      key: "name",
      title: "Dog Name & ID",
      render: (_val: any, row: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", overflow: "hidden", flexShrink: 0 }}>
            {getDogPhotoUrl(row, dogPhotoMap) ? (
              <img src={getDogPhotoUrl(row, dogPhotoMap)} alt={row.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              "🐶"
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{row.name}</div>
            <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>ID: {row.registration_number}</div>
          </div>
        </div>
      ),
    },
    {
      key: "rescue_id",
      title: "Rescue ID",
      render: (_val: any, row: any) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569", fontWeight: 600 }}>
          {row.rescue_id}
        </span>
      ),
    },
    {
      key: "breed",
      title: "Breed & Sex",
      render: (_val: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155" }}>{row.breed}</div>
          <div style={{ fontSize: "12px", color: "#64748B" }}>
            {row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : "-"} &bull; {row.estimated_age}
          </div>
        </div>
      ),
    },
    { key: "intake_date", title: "Intake Date" },
    {
      key: "kennel_id",
      title: "Cage / Kennel",
      render: (_val: any, row: any) => {
        const label = getKennelLabel(row.kennel_id);
        const isAssigned = !!row.kennel_id;
        return (
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              background: isAssigned ? "#ECFDF5" : "#F1F5F9",
              color: isAssigned ? "#15803D" : "#64748B",
              border: isAssigned ? "1px solid #6EE7B7" : "1px solid #CBD5E1",
            }}
          >
            {isAssigned ? `🛏 ${label}` : "Unassigned"}
          </span>
        );
      },
    },
    {
      key: "medical_status",
      title: "Medical Status",
      render: (_val: any, row: any) => (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: "#ECFDF5",
            color: "#15803D",
            textTransform: "capitalize",
          }}
        >
          {row.medical_status}
        </span>
      ),
    },
    {
      key: "adoption_status",
      title: "Adoption Readiness",
      render: (_val: any, row: any) => (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: row.is_adoptable ? "#EFF6FF" : "#F1F5F9",
            color: row.is_adoptable ? "#1E3A8A" : "#475569",
          }}
        >
          {row.adoption_status}
        </span>
      ),
    },
    {
      key: "tag_status_label",
      title: "Safety Tag",
      render: (_val: any, row: any) => (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: row.has_active_tag ? "#F3E8FF" : "#FEE2E2",
            color: row.has_active_tag ? "#1E3A8A" : "#991B1B",
            border: row.has_active_tag ? "1px solid #C4B5FD" : "1px solid #FCA5A5",
          }}
        >
          {row.has_active_tag ? "✓ ACTIVE" : "INACTIVE"}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Hero Header */}
      <div
        style={{
          marginBottom: "20px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
          Shelter Operations Workspace
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Formally receive rescued animals, register intake details into shelter care, assign cage allocations, manage shelter care, and provision authoritative Safety Tags & QR codes.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* OPERATIONAL CAPACITY & INTAKE ALERTS BANNER */}
      {((total_capacity > 0 && in_shelter_dogs / total_capacity >= 0.85) || incomingRescues.length > 0) && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "12px", background: "#FFFBEB", border: "1px solid #FCD34D", color: "#92400E", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FaExclamationTriangle size={20} color="#D97706" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "14px" }}>Operational Shelter Alert</div>
              <div style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>
                {total_capacity > 0 && in_shelter_dogs / total_capacity >= 0.85
                  ? `High Occupancy Warning: Shelter is operating at ${Math.round((in_shelter_dogs / total_capacity) * 100)}% capacity (${in_shelter_dogs}/${total_capacity} dogs).`
                  : `${incomingRescues.length} rescued animal(s) handed over awaiting intake & kennel allocation.`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openCageModal()}
            style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#D97706", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Manage Allocations
          </button>
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <QuickActionCard icon={<FaPlus />} title="Register Rescued Dog / Intake" subtitle="New intake entry" color="#16A34A" onClick={() => { setPetForm({ ...emptyPetForm }); setIsRegisterModalOpen(true); }} />
        <QuickActionCard icon={<FaBed />} title="Allocate Cage" subtitle="Assign dog to kennel" color="#1E3A8A" onClick={() => openCageModal()} />
        <QuickActionCard icon={<FaExchangeAlt />} title="Facility Placement" subtitle="Request internal transfer" color="#1E3A8A" onClick={() => setIsTransferModalOpen(true)} />
        <QuickActionCard icon={<FaBoxes />} title="Request Supplies" subtitle="Food & Medicines" color="#F59E0B" onClick={() => setIsSupplyModalOpen(true)} />
      </div>

      {/* Headline Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* INCOMING RESCUED ANIMALS QUEUE */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px", overflow: "visible" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
              🚨 Incoming Rescued Animals Queue (Intake & Handover)
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Rescued animals handed over by Rescue Agents awaiting shelter registration & Safety Tag assignment
            </span>
          </div>
          <button
            type="button"
            onClick={fetchDashboard}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <FaSync /> Refresh Queue
          </button>
        </div>

        {incomingRescues.length === 0 ? (
          <div style={{ padding: "24px", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
            ✓ No pending rescued animals awaiting intake handover at this time.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px", overflow: "visible" }}>
            {incomingRescues.map((c) => (
              <div key={c.id} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "12px", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, color: "#1E3A8A", fontFamily: "monospace", fontSize: "13px" }}>
                      Ticket #{c.ticket_number || c.id}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#FEF3C7", color: "#92400E", fontSize: "11px", fontWeight: 700, textTransform: "capitalize" }}>
                      {c.status || "Handed Over"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    🐕 {c.animal_type ? `Rescued ${c.animal_type}` : "Rescued Dog"} ({c.animal_count ?? 1} animal)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px", fontSize: "12px", color: "#475569", marginTop: "8px" }}>
                    <div><strong>Rescue Date:</strong> {formatDateOnly(c.created_at)}</div>
                    <div><strong>Rescue Location:</strong> {c.location_address || "-"}</div>
                    <div><strong>Reported By:</strong> {c.reporter_name || "-"}</div>
                    <div><strong>Rescue Agent:</strong> {getRescueAgentName(c) || "-"}</div>
                    <div><strong>Priority:</strong> <span style={{ textTransform: "capitalize" }}>{c.severity || "-"}</span></div>
                  </div>
                  {c.description && (
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px", background: "#F8FAFC", padding: "8px", borderRadius: "6px", fontStyle: "italic" }}>
                      "{c.description}"
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedRescueForDetails(c); setIsRescueDetailsModalOpen(true); }}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    View Rescue Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenReceiveRescue(c)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FaPaw /> Receive & Register Dog
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REGISTERED RESCUED DOGS & DOG RECORDS DIRECTORY */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
              🐕 Rescued Dogs / Dog Records Directory
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              View rescued dogs in shelter care, provision Safety Tags, download QR codes, and manage medical & adoption status
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Search name, Dog ID, Rescue ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "240px" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              <option value="">All Statuses</option>
              {DOG_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={dogColumns}
          data={filteredDogs}
          loading={loading}
          emptyMessage="No dogs registered in shelter care yet."
          onRowClick={(row: any) => { setSelectedDog(row); setIsViewMasterModalOpen(true); }}
          renderRowActions={(row: any) => (
            <DogRowActions
              row={row}
              onView={() => { setSelectedDog(row); setIsViewMasterModalOpen(true); }}
              onEdit={() => {
                setSelectedDog(row);
                setEditPhotoFile(null);
                setEditPhotoUrl("");
                setPetForm({
                  ...emptyPetForm,
                  name: row.name || "",
                  breed: row.breed || "",
                  gender: row.gender || "male",
                  estimated_age: row.estimated_age || "",
                  age_months: row.age_months ? String(row.age_months) : "",
                  weight: row.weight ? String(row.weight) : "",
                  color: row.color || "",
                  status: row.status || "shelter",
                  is_adoptable: !!row.is_adoptable,
                  photo_url: getDogPhotoUrl(row, dogPhotoMap) || "",
                });
                setIsEditModalOpen(true);
              }}
              onQr={() => openQrModal(row)}
              onCage={() => openCageModal(row)}
              onMedical={() => navigate(`/medical-records?dogId=${dogId(row)}`)}
              onTransfer={() => {
                setTransferForm({
                  dogId: dogId(row),
                  fromFacilityId: row.shelter_id || facilities[0]?.id || "",
                  toFacilityId: "",
                  notes: "",
                });
                setIsTransferModalOpen(true);
              }}
              onAdoptionReadiness={() => handleMarkReadyForAdoption(row)}
            />
          )}
        />
      </div>


      {/* RESCUE CASE DETAILS READ-ONLY MODAL */}
      <Modal
        isOpen={isRescueDetailsModalOpen}
        onClose={() => { setIsRescueDetailsModalOpen(false); setSelectedRescueForDetails(null); }}
        title={`Rescue Details — ${selectedRescueForDetails?.ticket_number || selectedRescueForDetails?.id || ""}`}
        maxWidth="600px"
      >
        {selectedRescueForDetails && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", color: "#334155" }}>
              <div><strong>Rescue Case ID:</strong><br /><span style={{ fontFamily: "monospace", color: "#1E3A8A" }}>{selectedRescueForDetails.ticket_number || selectedRescueForDetails.id}</span></div>
              <div><strong>Status:</strong><br /><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{selectedRescueForDetails.status || "-"}</span></div>
              <div><strong>Rescue Date:</strong><br />{formatDateOnly(selectedRescueForDetails.created_at)}</div>
              <div><strong>Priority / Severity:</strong><br /><span style={{ textTransform: "capitalize" }}>{selectedRescueForDetails.severity || "-"}</span></div>
              <div><strong>Rescue Location:</strong><br />{selectedRescueForDetails.location_address || "-"}</div>
              {(selectedRescueForDetails.latitude && selectedRescueForDetails.longitude) && (
                <div><strong>GPS:</strong><br />{String(selectedRescueForDetails.latitude)}, {String(selectedRescueForDetails.longitude)}</div>
              )}
              <div><strong>Reporter:</strong><br />{selectedRescueForDetails.reporter_name || "-"}{selectedRescueForDetails.reporter_phone ? ` · ${selectedRescueForDetails.reporter_phone}` : ""}</div>
              <div><strong>Rescue Agent:</strong><br />{getRescueAgentName(selectedRescueForDetails) || "-"}</div>
              {selectedRescueForDetails.dispatch?.assigned_vehicle_id && (
                <div><strong>Assigned Vehicle:</strong><br /><span style={{ fontFamily: "monospace", fontSize: "12px" }}>{selectedRescueForDetails.dispatch.assigned_vehicle_id}</span></div>
              )}
              {selectedRescueForDetails.reporter_notes && (
                <div style={{ gridColumn: "1 / -1" }}><strong>Reporter Notes:</strong><br /><span style={{ fontStyle: "italic", color: "#64748B" }}>{selectedRescueForDetails.reporter_notes}</span></div>
              )}
            </div>
            {Array.isArray(selectedRescueForDetails.media_evidence || selectedRescueForDetails.media_urls) &&
              ((selectedRescueForDetails.media_evidence || selectedRescueForDetails.media_urls) as string[]).length > 0 && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>Evidence Photos</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {((selectedRescueForDetails.media_evidence || selectedRescueForDetails.media_urls) as string[]).map((url: string, idx: number) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Evidence ${idx + 1}`} style={{ width: "90px", height: "90px", objectFit: "cover", borderRadius: "8px", border: "1px solid #E2E8F0" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => { setIsRescueDetailsModalOpen(false); setSelectedRescueForDetails(null); }}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REGISTER RESCUED DOG INTAKE MODAL */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Rescued Dog Intake"
        maxWidth="640px"
      >
        <form onSubmit={handleRegisterPetSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Read-Only Rescue Details Section */}
          {activeRescueForIntake && (
            <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "8px", padding: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#0369A1", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                🐕 Rescue Details <span style={{ fontWeight: 400, color: "#64748B", fontSize: "11px" }}>(Read-Only)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", color: "#334155" }}>
                <div><strong>Rescue Case:</strong> <span style={{ fontFamily: "monospace", color: "#1E3A8A" }}>{activeRescueForIntake.ticket_number || activeRescueForIntake.id}</span></div>
                <div><strong>Status:</strong> <span style={{ textTransform: "capitalize" }}>{activeRescueForIntake.status || "-"}</span></div>
                <div><strong>Rescue Date:</strong> {formatDateOnly(activeRescueForIntake.created_at)}</div>
                <div><strong>Priority:</strong> <span style={{ textTransform: "capitalize" }}>{activeRescueForIntake.severity || "-"}</span></div>
                <div><strong>Rescue Location:</strong> {activeRescueForIntake.location_address || "-"}</div>
                <div><strong>Reported By:</strong> {activeRescueForIntake.reporter_name || "-"}</div>
                <div><strong>Rescue Agent:</strong> {getRescueAgentName(activeRescueForIntake) || "-"}</div>
                {Array.isArray(activeRescueForIntake.media_evidence || activeRescueForIntake.media_urls) &&
                  ((activeRescueForIntake.media_evidence || activeRescueForIntake.media_urls) as string[]).length > 0 && (
                  <div>
                    <strong>Evidence:</strong>{" "}
                    {((activeRescueForIntake.media_evidence || activeRescueForIntake.media_urls) as string[]).map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1E3A8A", textDecoration: "underline", marginRight: "6px", fontSize: "11px" }}>
                        View Photo {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", paddingBottom: "2px", borderBottom: "1px solid #E2E8F0" }}>Dog Registration</div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Dog Name / Code Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Max or Rescued Dog (RSC-0042)"
              value={petForm.name}
              onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Photo URL / Upload</label>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={petForm.photo_url}
                  onChange={(e) => setPetForm({ ...petForm, photo_url: e.target.value })}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                />
                <label style={{ cursor: "pointer", background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #CBD5E1", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {intakePhotoFile ? "Selected" : "Choose File"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIntakePhotoFile(file);
                        setIntakePhotoUrl(URL.createObjectURL(file));
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
              {intakePhotoUrl && (
                <div style={{ marginTop: "4px" }}>
                  <img src={intakePhotoUrl} alt="Preview" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }} />
                </div>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Breed / Type</label>
              <input
                type="text"
                placeholder="e.g. Indie Mix"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Gender</label>
              <select
                value={petForm.gender}
                onChange={(e) => setPetForm({ ...petForm, gender: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Estimated Age</label>
              <input
                type="text"
                placeholder="e.g. 2 years"
                value={petForm.estimated_age}
                onChange={(e) => setPetForm({ ...petForm, estimated_age: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Color / Marks</label>
              <input
                type="text"
                placeholder="e.g. Brown with white chest"
                value={petForm.color}
                onChange={(e) => setPetForm({ ...petForm, color: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Rescue Date</label>
              <input
                type="date"
                value={petForm.rescue_date}
                onChange={(e) => setPetForm({ ...petForm, rescue_date: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Rescue Location</label>
              <input
                type="text"
                placeholder="e.g. Sector 14, Main Road"
                value={petForm.rescue_location}
                onChange={(e) => setPetForm({ ...petForm, rescue_location: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Shelter Facility</label>
              <select
                value={petForm.shelter_id}
                onChange={(e) => setPetForm({ ...petForm, shelter_id: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                <option value="">Select facility...</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Intake Condition / Status</label>
              <input
                type="text"
                placeholder="e.g. Mild dehydration, stable"
                value={petForm.intake_condition}
                onChange={(e) => setPetForm({ ...petForm, intake_condition: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Medical / Intake Information</label>
            <textarea
              rows={2}
              placeholder="Initial medical observations, treatment given on intake..."
              value={petForm.medical_notes}
              onChange={(e) => setPetForm({ ...petForm, medical_notes: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
            >
              {isSubmitting ? "Registering..." : "Save & Register Dog"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT DOG MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Dog Intake Details"
      >
        <form onSubmit={handleEditDogSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Dog Name</label>
            <input
              type="text"
              required
              value={petForm.name}
              onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Photo URL / Upload</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="url"
                placeholder="https://..."
                value={petForm.photo_url}
                onChange={(e) => setPetForm({ ...petForm, photo_url: e.target.value })}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
              <label style={{ cursor: "pointer", background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #CBD5E1", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>
                {editPhotoFile ? "Selected" : "Choose File"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setEditPhotoFile(file);
                      setEditPhotoUrl(URL.createObjectURL(file));
                    }
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            {(editPhotoUrl || getDogPhotoUrl(selectedDog, dogPhotoMap)) && (
              <div style={{ marginTop: "4px" }}>
                <img src={editPhotoUrl || getDogPhotoUrl(selectedDog, dogPhotoMap)} alt="Preview" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }} />
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Breed</label>
              <input
                type="text"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Gender</label>
              <select
                value={petForm.gender}
                onChange={(e) => setPetForm({ ...petForm, gender: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#15803D", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* DOG MASTER FILE VIEW MODAL */}
      <Modal
        isOpen={isViewMasterModalOpen}
        onClose={() => setIsViewMasterModalOpen(false)}
        title={`Dog Master Profile — ${selectedDog?.name || ""}`}
        maxWidth="600px"
      >
        {selectedDog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "#F8FAFC", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", overflow: "hidden" }}>
                {getDogPhotoUrl(selectedDog, dogPhotoMap) ? (
                  <img src={getDogPhotoUrl(selectedDog, dogPhotoMap)} alt={selectedDog.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  "🐶"
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedDog.name}</div>
                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>Dog ID: {selectedDog.registration_number}</div>
                <div style={{ fontSize: "12px", color: "#1E3A8A", fontWeight: 600, marginTop: "2px" }}>Rescue Reference: {selectedDog.rescue_id || "-"}</div>
              </div>
              <div>
                <label style={{ cursor: "pointer", background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #BAE6FD", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                  {isUploadingPhoto ? "Uploading..." : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingPhoto}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dId = dogId(selectedDog);
                      if (!dId) return;
                      try {
                        setIsUploadingPhoto(true);
                        const uploadedUrl = await storageService.uploadFile(file, {
                          folder: "dogs",
                          entity_type: "dog_profile",
                          entity_id: dId,
                        });
                        const res = await petService.updatePet(dId, {
                          photo_url: uploadedUrl,
                          image_url: uploadedUrl,
                          image_urls: [uploadedUrl],
                          photo_gallery_urls: [uploadedUrl],
                        });
                        const updatedDog = res?.data || res;
                        
                        addToast("Photo uploaded successfully!", "success");

                        // Update local states instantly
                        setDogs((prev) =>
                          prev.map((d) => (dogId(d) === dId ? formatDog({ ...d, ...updatedDog }) : d))
                        );
                        setSelectedDog(formatDog({ ...selectedDog, ...updatedDog }));
                        fetchDashboard();
                        notifyDataChanged();
                      } catch (err: any) {
                        addToast(err?.response?.data?.message || "Failed to upload photo.", "error");
                      } finally {
                        setIsUploadingPhoto(false);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div><strong>Breed:</strong> {selectedDog.breed}</div>
              <div><strong>Gender:</strong> {selectedDog.gender}</div>
              <div><strong>Estimated Age:</strong> {selectedDog.estimated_age}</div>
              <div><strong>Rescue Date:</strong> {selectedDog.rescue_date}</div>
              <div><strong>Intake Date:</strong> {selectedDog.intake_date}</div>
              <div><strong>Status:</strong> {selectedDog.status}</div>
              <div><strong>Medical Status:</strong> {selectedDog.medical_status}</div>
              <div><strong>Adoption Readiness:</strong> {selectedDog.adoption_status}</div>
              <div>
                <strong>Cage / Kennel Assignment:</strong>{" "}
                <span
                  style={{
                    fontWeight: 700,
                    color: selectedDog.kennel_id ? "#15803D" : "#64748B",
                  }}
                >
                  {getKennelLabel(selectedDog.kennel_id)}
                </span>
              </div>
            </div>

            {/* Rescue Origin — cross-reference from allRescues if data available */}
            {(() => {
              const rescueId = selectedDog.rescue_id || selectedDog.rescue_case_id || "";
              const matchedCase = rescueId && rescueId !== "-"
                ? allRescues.find((r: any) => String(r.id) === String(rescueId))
                : null;
              if (!matchedCase) return null;
              const agentName = getRescueAgentName(matchedCase);
              return (
                <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "8px", padding: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#0369A1", marginBottom: "6px" }}>🐕 Rescue Origin</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", color: "#334155" }}>
                    <div><strong>Case:</strong> <span style={{ fontFamily: "monospace", color: "#1E3A8A" }}>{matchedCase.ticket_number || matchedCase.id}</span></div>
                    <div><strong>Rescue Date:</strong> {formatDateOnly(matchedCase.created_at)}</div>
                    <div><strong>Rescue Location:</strong> {matchedCase.location_address || "-"}</div>
                    {agentName && <div><strong>Rescue Agent:</strong> {agentName}</div>}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => { setIsViewMasterModalOpen(false); openQrModal(selectedDog); }}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaQrcode /> Open Safety Tag / QR
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CAGE ALLOCATION MODAL */}
      <Modal
        isOpen={isCageModalOpen}
        onClose={() => setIsCageModalOpen(false)}
        title="Allocate Dog to Cage / Kennel"
        maxWidth="500px"
      >
        <form onSubmit={handleAssignCageSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Select Dog *</label>
            <select
              value={cageSel.dogId}
              onChange={(e) => setCageSel({ ...cageSel, dogId: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={dogId(d)} value={dogId(d)}>
                  {d.name} ({d.registration_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Shelter Facility</label>
            <select
              value={cageSel.facilityId}
              onChange={(e) => onFacilityChange(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">Select facility...</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Section / Ward</label>
            <select
              value={cageSel.sectionId}
              onChange={(e) => onSectionChange(e.target.value)}
              disabled={!cageSel.facilityId}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">Choose section...</option>
              {cageSections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Available Kennel / Cage</label>
            <select
              value={cageSel.kennelId}
              onChange={(e) => setCageSel({ ...cageSel, kennelId: e.target.value })}
              disabled={!cageSel.sectionId}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">Choose kennel...</option>
              {cageKennels.map((k) => (
                <option key={k.id} value={k.id}>{k.identifier || k.name || k.id}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsCageModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={cageLoading} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700 }}>
              {cageLoading ? "Assigning..." : "Confirm Cage Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* SUPPLY REQUEST MODAL */}
      <Modal
        isOpen={isSupplyModalOpen}
        onClose={() => setIsSupplyModalOpen(false)}
        title="Request Shelter Supplies & Inventory"
        maxWidth="480px"
      >
        <form onSubmit={handleSupplySubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Item Name / Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Dog Kibble 20kg Bags or Antibiotic Vials"
              value={supplyForm.itemName}
              onChange={(e) => setSupplyForm({ ...supplyForm, itemName: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Category</label>
              <select
                value={supplyForm.category}
                onChange={(e) => setSupplyForm({ ...supplyForm, category: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                <option value="Food & Nutrition">Food & Nutrition</option>
                <option value="Medicines">Medicines</option>
                <option value="Vaccines">Vaccines</option>
                <option value="Supplies">Supplies</option>
                <option value="Gear">Gear</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Quantity Needed</label>
              <input
                type="text"
                placeholder="e.g. 50 kg"
                value={supplyForm.stock}
                onChange={(e) => setSupplyForm({ ...supplyForm, stock: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsSupplyModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#F59E0B", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Submitting..." : "Submit Supply Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* REPORT GENERATOR MODAL */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Generate Shelter Operational Report"
        maxWidth="520px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <form onSubmit={handleGenerateReportSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Select Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            >
              <option value="occupancy">Shelter Occupancy & Capacity Report</option>
              <option value="intake">Rescued Dog Intake & Registration Summary</option>
              <option value="tags">Safety Tag & QR Code Audit Report</option>
            </select>
            <button
              type="submit"
              style={{ padding: "10px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              Generate Live Metrics Report
            </button>
          </form>

          {reportGeneratedText && (
            <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "12px" }}>
              <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "12px", color: "#334155", whiteSpace: "pre-wrap" }}>{reportGeneratedText}</pre>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([reportGeneratedText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  triggerDownload(url, `Shelter_Report_${reportType}.txt`);
                }}
                style={{ marginTop: "10px", width: "100%", padding: "8px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
              >
                Download Report File
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* SAFETY TAG & QR MODAL */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={closeQrModal}
        title={qrDog?.name ? `Safety Tag & QR Code — ${qrDog.name}` : "Dog Safety Tag & QR Code"}
        maxWidth="520px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {qrDog && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "16px" }}>Dog Name: {qrDog.name || "-"}</span>
                <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: tagStatus === "ACTIVE" ? "#DCFCE7" : "#FEE2E2", color: tagStatus === "ACTIVE" ? "#166534" : "#991B1B", border: tagStatus === "ACTIVE" ? "1px solid #86EFAC" : "1px solid #FCA5A5", textTransform: "uppercase" }}>
                  Tag Status: {tagStatus}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                <strong>Dog ID:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{qrDog.registration_number || qrDog.id || "-"}</span>
              </div>
              {qrDog.rescue_id && (
                <div style={{ fontSize: "13px", color: "#475569" }}>
                  <strong>Rescue Case ID:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1E3A8A" }}>{qrDog.rescue_id}</span>
                </div>
              )}
              <div style={{ fontSize: "13px", color: "#475569" }}>
                <strong>Breed:</strong> {qrDog.breed || "-"} &nbsp;|&nbsp; <strong>Gender:</strong> {qrDog.gender ? qrDog.gender.charAt(0).toUpperCase() + qrDog.gender.slice(1) : "-"}
              </div>
            </div>
          )}

          {/* SCAN ACTIVITY WATCH & TOKEN DISPLAY */}
          {qrDog && (
            <div style={{ width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Scan Activity</div>
                  <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                    <strong>Total Scans:</strong> {String(tagMetadata?.scans_count ?? tagMetadata?.scan_count ?? 0)} &bull; <strong>Last Scanned:</strong> {tagMetadata?.last_scanned_at ? String(tagMetadata.last_scanned_at).slice(0, 16).replace("T", " ") : "Never"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshScanData}
                  disabled={isRefreshingScanData}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#334155", fontSize: "12px", fontWeight: 600, cursor: isRefreshingScanData ? "not-allowed" : "pointer" }}
                >
                  <FaSync style={{ animation: isRefreshingScanData ? "spin 1s linear infinite" : "none" }} />
                  {isRefreshingScanData ? "Refreshing..." : "Refresh Scan Data"}
                </button>
              </div>

            </div>
          )}

          {qrLoading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ display: "inline-block", width: "32px", height: "32px", border: "3px solid #F3E8FF", borderTopColor: "#1E3A8A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748B", fontWeight: 500 }}>Fetching unique Safety Tag metadata from backend...</div>
            </div>
          )}

          {!qrLoading && !qrError && !qrImageUrl && (
            <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", color: "#334155", padding: "24px 20px", borderRadius: "12px", fontSize: "13px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)" }}>
              {tagStatus === "ACTIVE" ? (
                <>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#1E293B" }}>
                    ℹ️ SAFETY TAG IS ACTIVE ON BACKEND
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", maxWidth: "440px", lineHeight: 1.5 }}>
                    Tag Status: <strong style={{ color: "#16A34A" }}>ACTIVE</strong>{" "}
                    {tagMetadata?.token_prefix ? `(Prefix: ${String(tagMetadata.token_prefix)})` : ""}
                    <br />
                    To render and print the QR code for this active tag on this browser without re-issuing or changing the backend tag, enter the existing raw token below:
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const clean = manualTokenInput.trim();
                      if (!clean) return;
                      const prefix = String(tagMetadata?.token_prefix || "").trim();
                      if (prefix && !clean.startsWith(prefix)) {
                        addToast(`Token prefix mismatch! Expected token starting with "${prefix}".`, "error");
                        return;
                      }
                      try {
                        const qrUrl = await generateQrDataUrl(clean);
                        const blob = await generateQrBlob(clean);
                        setQrImageUrl(qrUrl);
                        setQrBlob(blob);
                        addToast("Active Safety Tag QR loaded successfully!", "success");
                      } catch {
                        addToast("Failed to render QR for entered token.", "error");
                      }
                    }}
                    style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}
                  >
                    <input
                      type="text"
                      value={manualTokenInput}
                      onChange={(e) => setManualTokenInput(e.target.value)}
                      placeholder="Enter existing raw token (e.g. cVnzRiqR...)"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="submit"
                        disabled={!manualTokenInput.trim()}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: "8px",
                          border: "none",
                          background: manualTokenInput.trim() ? "#16A34A" : "#94A3B8",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: manualTokenInput.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        Load Active QR Code
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsReProvisionConfirmOpen(true)}
                        disabled={isProvisioning}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#1E3A8A",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: isProvisioning ? "not-allowed" : "pointer",
                        }}
                      >
                        Re-Provision
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div style={{ color: "#991B1B", fontWeight: 700, fontSize: "14px" }}>This pet does not have an active Safety Tag yet.</div>
                  <div style={{ fontSize: "12px", color: "#64748B", maxWidth: "400px", lineHeight: 1.5 }}>Please provision a Safety Tag to generate an authoritative QR code and safety token for this pet.</div>
                  <button type="button" onClick={() => handleProvisionTag()} disabled={isProvisioning} style={{ padding: "11px 24px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: isProvisioning ? "not-allowed" : "pointer" }}>
                    {isProvisioning ? "Provisioning..." : "Provision Safety Tag"}
                  </button>
                </>
              )}
            </div>
          )}

          {!qrLoading && !qrError && qrImageUrl && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
              <div style={{ padding: "18px", border: "2px solid #E2E8F0", borderRadius: "16px", background: "#FFFFFF", boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img src={qrImageUrl} alt={`Safety Tag QR Code for ${qrDog?.name || "Dog"}`} style={{ width: "240px", height: "240px", imageRendering: "pixelated", display: "block" }} />
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Scan this QR code to view pet safety information.</div>
              </div>

              {tagStatus === "ACTIVE" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%" }}>
                  <button type="button" onClick={handleDownloadQr} style={{ padding: "11px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><FaDownload /> Download QR</button>
                  <button type="button" onClick={handlePrintQr} style={{ padding: "11px", borderRadius: "8px", border: "1px solid #C4B5FD", background: "#FFF", color: "#1E3A8A", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><FaPrint /> Print Safety Tag</button>
                  <button type="button" onClick={() => setIsDeactivateConfirmOpen(true)} style={{ padding: "11px", borderRadius: "8px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Deactivate Tag</button>
                </div>
              ) : (
                <button type="button" onClick={() => handleProvisionTag(true)} disabled={isProvisioning} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px" }}>
                  {isProvisioning ? "Re-Provisioning..." : "Re-Provision Safety Tag"}
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* RE-PROVISION CONFIRMATION MODAL */}
      <Modal isOpen={isReProvisionConfirmOpen} onClose={() => setIsReProvisionConfirmOpen(false)} title="Re-Provision Safety Tag?" maxWidth="450px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Re-provisioning this Safety Tag will generate a <strong>NEW raw token</strong> and invalidate the existing QR code tag for <strong>{qrDog?.name || "this pet"}</strong>. Continue?
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsReProvisionConfirmOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
            <button type="button" onClick={() => handleProvisionTag(true)} disabled={isProvisioning} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700 }}>
              {isProvisioning ? "Re-Provisioning..." : "Confirm Re-Provision"}
            </button>
          </div>
        </div>
      </Modal>

      {/* DEACTIVATE CONFIRMATION MODAL */}
      <Modal isOpen={isDeactivateConfirmOpen} onClose={() => setIsDeactivateConfirmOpen(false)} title="Deactivate Safety Tag?" maxWidth="440px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Are you sure you want to deactivate the Safety Tag for <strong>{qrDog?.name || "this pet"}</strong>?
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsDeactivateConfirmOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
            <button type="button" onClick={handleDeactivateTag} disabled={isDeactivating} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700 }}>
              {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
            </button>
          </div>
        </div>
      </Modal>

      {/* FACILITY PLACEMENT & TRANSFER MODAL */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Request Internal Shelter / Facility Transfer"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateTransferSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Select Dog to Transfer *
            </label>
            <select
              required
              value={transferForm.dogId}
              onChange={(e) => setTransferForm({ ...transferForm, dogId: e.target.value })}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            >
              <option value="">-- Choose Dog --</option>
              {dogs.map((d: any) => (
                <option key={dogId(d)} value={dogId(d)}>
                  {d.name} (ID: {d.registration_number}) - {d.breed || "Dog"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Destination Shelter / Facility *
            </label>
            <select
              required
              value={transferForm.toFacilityId}
              onChange={(e) => setTransferForm({ ...transferForm, toFacilityId: e.target.value })}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            >
              <option value="">-- Choose Destination Facility --</option>
              {facilities.map((f: any) => (
                <option key={f.id || f.facility_id} value={f.id || f.facility_id}>
                  {f.name} ({f.facility_type || "Shelter"}) - Capacity: {f.total_capacity || "Unspecified"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Transfer Rationale &amp; Operational Notes
            </label>
            <textarea
              rows={3}
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="Reason for transfer (e.g. specialized medical isolation, capacity rebalancing, adoption prep)..."
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px" }}
            >
              {isSubmitting ? "Submitting..." : "Submit Placement Transfer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShelterManagerDashboard;
