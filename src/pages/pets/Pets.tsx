import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaPaw,
  FaDog,
  FaAmbulance,
  FaHeart,
  FaPlus,
  FaTrash,
  FaQrcode,
  FaDownload,
  FaPrint,
  FaEye,
  FaCamera,
  FaStethoscope,
  FaSearch,
  FaCheckCircle,
  FaSync,
  FaHistory,
} from "react-icons/fa";

import petService from "../../services/petService";
import rescueService from "../../services/rescueService";
import medicalService from "../../services/medicalService";
import storageService from "../../services/storageService";
import { getCurrentUser, getCurrentUserRole, normalizeRole, getRescueCentreId } from "../../utils/roleUtils";
import { hasPermission } from "../../utils/rbac";
import { notifyDataChanged } from "../../utils/dataSync";
import { publishActionEvent } from "../../utils/eventSystem";
import { generateQrDataUrl, generateQrBlob } from "../../utils/qrGenerator";
import DogLifecycleTimelineModal from "../../components/pets/DogLifecycleTimelineModal";

const DOG_STATUSES = ["rescued", "clinic", "shelter", "fostered", "adopted"];
const GENDERS = ["male", "female", "unknown"];

export const EAR_SHAPES = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "pricked", label: "Pricked" },
  { value: "floppy", label: "Floppy" },
  { value: "semi_pricked", label: "Semi-Pricked" },
  { value: "rose", label: "Rose" },
  { value: "button", label: "Button" },
];

export const TAIL_TYPES = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "straight", label: "Straight" },
  { value: "curled", label: "Curled" },
  { value: "docked", label: "Docked" },
  { value: "long", label: "Long" },
  { value: "bobtail", label: "Bobtail" },
];

export const formatEarShape = (val?: string | null): string => {
  if (!val) return "Not recorded";
  const s = String(val).toLowerCase().trim();
  switch (s) {
    case "pricked": return "Pricked";
    case "floppy": return "Floppy";
    case "semi_pricked": return "Semi-Pricked";
    case "rose": return "Rose";
    case "button": return "Button";
    case "unknown": return "Not recorded";
    default: return val.charAt(0).toUpperCase() + val.slice(1);
  }
};

export const formatTailType = (val?: string | null): string => {
  if (!val) return "Not recorded";
  const s = String(val).toLowerCase().trim();
  switch (s) {
    case "straight": return "Straight";
    case "curled": return "Curled";
    case "docked": return "Docked";
    case "long": return "Long";
    case "bobtail": return "Bobtail";
    case "unknown": return "Not recorded";
    default: return val.charAt(0).toUpperCase() + val.slice(1);
  }
};

export const getDogPhotoUrl = (dog: any, photoMap?: Record<string, string>): string => {
  if (!dog) return "";
  const dId = dog?.id || dog?.dog_id || dog?.registration_number;
  if (dId && photoMap && photoMap[dId]) return photoMap[dId];
  if (typeof dog.photo_url === "string" && dog.photo_url.trim()) return dog.photo_url.trim();
  if (typeof dog.image_url === "string" && dog.image_url.trim()) return dog.image_url.trim();
  if (typeof dog.avatar_url === "string" && dog.avatar_url.trim()) return dog.avatar_url.trim();
  if (Array.isArray(dog.image_urls) && dog.image_urls.length > 0 && typeof dog.image_urls[0] === "string" && dog.image_urls[0].trim()) {
    return dog.image_urls[0].trim();
  }
  if (Array.isArray(dog.photo_gallery_urls) && dog.photo_gallery_urls.length > 0 && typeof dog.photo_gallery_urls[0] === "string" && dog.photo_gallery_urls[0].trim()) {
    return dog.photo_gallery_urls[0].trim();
  }
  if (Array.isArray(dog.photos) && dog.photos.length > 0) {
    const p = dog.photos[0];
    if (typeof p === "string" && p.trim()) return p.trim();
    if (p && typeof p.url === "string" && p.url.trim()) return p.url.trim();
  }
  if (dId) {
    const cached = localStorage.getItem(`pawguard_dog_photo_${dId}`) || sessionStorage.getItem(`pawguard_dog_photo_${dId}`);
    if (cached) return cached;
  }
  return "";
};

export const isDogMedicallyCleared = (dog: any, clearancesList?: any[]): boolean => {
  if (!dog) return false;
  if (dog.vet_clearance === true || dog.is_fit_for_adoption === true) return true;
  if (dog.vet_clearance === false) return false;
  const vStatus = String(dog.vet_clearance_status || "").toLowerCase();
  if (vStatus === "approved" || vStatus === "cleared" || vStatus === "fit") return true;
  if (vStatus === "pending" || vStatus === "rejected" || vStatus === "denied") return false;
  const mStatus = String(dog.medical_status || "").toLowerCase();
  if (mStatus.includes("clear") || mStatus.includes("fit") || mStatus.includes("healthy") || mStatus.includes("passed")) return true;
  if (mStatus.includes("quarantine") || mStatus.includes("treatment") || mStatus.includes("surgery") || mStatus.includes("pending")) return false;
  if (Array.isArray(clearancesList) && clearancesList.length > 0) {
    const dId = String(dog.id || dog.dog_id || dog.registration_number || "").toLowerCase();
    const match = clearancesList.find((c: any) => {
      const cDogId = String(c.dog_id || c.pet_id || "").toLowerCase();
      return cDogId === dId && (String(c.status).toLowerCase() === "approved" || String(c.status).toLowerCase() === "cleared");
    });
    if (match) return true;
  }
  return false;
};

interface QrDogInfo {
  id?: string;
  name?: string;
  breed?: string;
  gender?: string;
  status?: string;
  estimated_age?: string;
  registration_number?: string;
  rescue_case_id?: string;
  raw_token?: string;
}

const emptyPetForm = {
  name: "",
  breed: "",
  gender: "unknown",
  estimated_age: "",
  age_months: "",
  weight: "",
  ear_shape: "unknown",
  tail_type: "unknown",
  is_adoptable: false,
  status: "shelter",
  rescue_case_id: "",
};

const cleanPayload = (data: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const triggerDownload = (url: string, filename: string) => {
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const Pets = () => {
  const [dogs, setDogs] = useState<any[]>([]);
  const [dogPhotoMap, setDogPhotoMap] = useState<Record<string, string>>({});
  const [allDogs, setAllDogs] = useState<any[]>([]);
  const [dogMasterCount, setDogMasterCount] = useState<number>(0);
  const [companionPetCount, setCompanionPetCount] = useState<number>(0);
  const [globalTotalCount, setGlobalTotalCount] = useState<number | null>(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [rescueCases, setRescueCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [adoptableOnly, setAdoptableOnly] = useState<boolean>(false);
  const [registryTab, setRegistryTab] = useState<"all" | "master" | "companion">("all");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(() => searchParams.get("action") === "register");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAdoptableModalOpen, setIsAdoptableModalOpen] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedDog, setSelectedDog] = useState<any | null>(null);
  const [selectedViewDog, setSelectedViewDog] = useState<any | null>(null);
  const [timelineDog, setTimelineDog] = useState<any | null>(null);

  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  // QR modal state
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDog, setQrDog] = useState<QrDogInfo | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Safety Tag lifecycle state
  const [tagStatus, setTagStatus] = useState<string>("ACTIVE");
  const [tagMetadata, setTagMetadata] = useState<Record<string, unknown> | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [isReProvisionConfirmOpen, setIsReProvisionConfirmOpen] = useState(false);
  const [isRefreshingScanData, setIsRefreshingScanData] = useState(false);

  // Manual Token Lookup modal state
  const [isTokenLookupModalOpen, setIsTokenLookupModalOpen] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [verifiedDog, setVerifiedDog] = useState<any | null>(null);

  // Form states
  const [petForm, setPetForm] = useState({ ...emptyPetForm });
  const [statusUpdateForm, setStatusUpdateForm] = useState({
    dogId: "",
    status: "shelter",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const rawStatus = String(dog.status || "").toLowerCase();
    const isFostered = rawStatus === "fostered" || (!!dog.foster_home_id && rawStatus !== "adopted");
    return {
      ...dog,
      registration_number: dog.registration_number || dog.id || "-",
      name: dog.name || "-",
      photo_url: getDogPhotoUrl(dog, dogPhotoMap),
      breed: dog.breed || "-",
      gender: dog.gender || "",
      estimated_age: dog.estimated_age || dog.age || "-",
      age_months: dog.age_months ?? "",
      weight: dog.weight ?? "",
      is_adoptable: !!dog.is_adoptable,
      is_public_visible: dog.is_public_visible !== false,
      status: isFostered ? "fostered" : (dog.status || "-"),
    };
  };

  const handleMasterPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedViewDog) return;

    const userRole = getCurrentUserRole();
    const canEdit =
      hasPermission("edit_animals") ||
      userRole === "super_admin" ||
      userRole === "shelter_manager" ||
      userRole === "adoption_coordinator" ||
      userRole === "rescue_centre_admin";

    if (!canEdit) {
      addToast("You do not have permission to upload or change dog photos.", "error");
      e.target.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      addToast("Invalid file format. Only JPG, JPEG, PNG, and WEBP images are supported.", "error");
      e.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast("File size exceeds 5MB limit. Please select a smaller photo.", "error");
      e.target.value = "";
      return;
    }

    setPendingPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (!reader.result) return;
      const photoDataUrl = String(reader.result);
      setPendingPhotoUrl(photoDataUrl);
      e.target.value = "";
    };
    reader.onerror = () => {
      addToast("Failed to process photo file.", "error");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMasterPhoto = async () => {
    if (!pendingPhotoUrl || !selectedViewDog) return;
    const dId = dogId(selectedViewDog);
    if (!dId) {
      addToast("Cannot identify dog record to save photo.", "error");
      return;
    }

    if (!pendingPhotoFile) {
      addToast("No photo file selected.", "error");
      return;
    }

    try {
      setIsSavingPhoto(true);

      // Upload the file to Supabase Storage via backend presigned URL.
      // The backend's storage table records entity_type=dog_profile + entity_id=dId,
      // making this the persistent source of truth for the dog photo.
      const persistentStorageUrl = await storageService.uploadFile(pendingPhotoFile, {
        folder: "dogs",
        entity_type: "dog_profile",
        entity_id: dId,
      });

      // Clear any legacy base64 localStorage fallback so the UI uses backend storage URL
      try {
        localStorage.removeItem(`pawguard_dog_photo_${dId}`);
        sessionStorage.removeItem(`pawguard_dog_photo_${dId}`);
      } catch {
        /* ignore storage errors */
      }

      // Update the dogPhotoMap immediately for this dog so the UI reflects the new photo
      // without requiring a full page reload
      setDogPhotoMap((prev) => ({ ...prev, [dId]: persistentStorageUrl }));

      // Also patch the in-memory dog list and selected view dog
      setSelectedViewDog((prev: any) => prev ? { ...prev, photo_url: persistentStorageUrl } : prev);
      setDogs((prevDogs: any[]) =>
        prevDogs.map((d: any) =>
          dogId(d) === dId ? { ...d, photo_url: persistentStorageUrl } : d
        )
      );

      notifyDataChanged();
      await publishActionEvent({
        module: "shelter",
        action: "update",
        title: "Dog Photo Updated",
        message: `Updated photo for dog ${selectedViewDog.name || dId}`,
        targetRoles: ["super_admin", "shelter_manager", "adoption_coordinator"],
        metadata: { dog_id: dId },
      });

      addToast("Dog photo uploaded and saved successfully!", "success");
      setPendingPhotoUrl(null);
      setPendingPhotoFile(null);

      // Refresh the photo map entry from backend to get a fresh presigned URL
      await refreshDogPhotoInMap(dId);
      fetchDogs();
      fetchAllDogs();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to save dog photo.";
      addToast(msg, "error");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleCancelPhotoPreview = () => {
    setPendingPhotoUrl(null);
    setPendingPhotoFile(null);
  };

  const fetchDogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getCurrentUser();
      const currentRole = normalizeRole(currentUser);
      const isRescueAdmin = currentRole === "rescue_centre_admin" || currentRole === "rescue_coordinator" || currentRole === "rescue_agent" || String(currentRole || "").includes("rescue");
      const userShelterId = (currentUser as any)?.shelter_id || (currentUser as any)?.shelter?.id || (currentUser as any)?.assigned_shelter_id;
      const userRescueCentreId = getRescueCentreId(currentUser);

      if (currentRole === "rescue_centre_admin" && !userRescueCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator.");
        setDogs([]);
        setLoading(false);
        return;
      }

      const effectiveTab = (isRescueAdmin && registryTab === "companion") ? "master" : registryTab;

      const queryParams: Record<string, any> = {
        record_type: effectiveTab,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        is_adoptable: adoptableOnly ? true : undefined,
        page,
        page_size: 10,
      };

      if (currentRole === "shelter_manager" && userShelterId) {
        queryParams.shelter_id = userShelterId;
      }

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        queryParams.rescue_centre_id = userRescueCentreId;
      }

      const response = await petService.getPets(queryParams);

      let dogList = unwrapList(response).map(formatDog);

      if (currentRole === "shelter_manager" && userShelterId) {
        dogList = dogList.filter((d: any) => {
          const dShelterId = d.shelter_id || d.shelter?.id || d.shelter_location_id;
          return !dShelterId || String(dShelterId).toLowerCase() === String(userShelterId).toLowerCase();
        });
      }

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        dogList = dogList.filter((d: any) => {
          const dCentreId = d.rescue_centre_id || d.rescue_center_id || d.facility_id || d.organization_id || d.rescue_centre?.id;
          return !dCentreId || String(dCentreId) === String(userRescueCentreId);
        });
      }

      if (isRescueAdmin) {
        dogList = dogList.filter((d: any) => !d.is_companion_pet && d.status !== "companion");
      }

      // Registry tab filter refinement:
      if (effectiveTab === "master") {
        dogList = dogList.filter((d: any) => !d.is_companion_pet);
      } else if (effectiveTab === "companion" && !isRescueAdmin) {
        dogList = dogList.filter((d: any) => Boolean(d.is_companion_pet) || d.status === "companion");
      }

      // Status filter refinement:
      if (statusFilter) {
        dogList = dogList.filter((d: any) => String(d.status || "").toLowerCase() === statusFilter.toLowerCase());
      }

      // Adoptable filter refinement:
      if (adoptableOnly) {
        dogList = dogList.filter((d: any) => Boolean(d.is_adoptable));
      }

      // Search filter refinement:
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        dogList = dogList.filter((d: any) =>
          String(d.name || "").toLowerCase().includes(q) ||
          String(d.breed || "").toLowerCase().includes(q) ||
          String(d.registration_number || "").toLowerCase().includes(q) ||
          String(d.chip_number || "").toLowerCase().includes(q) ||
          String(d.status || "").toLowerCase().includes(q) ||
          String(d.owner_name || d.owner_email || "").toLowerCase().includes(q)
        );
      }

      const total = response?.meta?.total ?? response?.data?.meta?.total ?? dogList.length;
      setTotalCount(total);
      setDogs(dogList);
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error?.message || err?.response?.data?.detail || err?.response?.data?.message;

      if (status === 403) {
        if (registryTab === "companion") {
          setError("Access Denied (403): You don't have permission to view Companion Pets.");
        } else if (registryTab === "master") {
          setError("Access Denied (403): You don't have permission to view Dog Master records.");
        } else {
          setError("Access Denied (403): Your account role is not authorized to view pet records.");
        }
      } else if (apiMsg) {
        setError(String(apiMsg));
      } else {
        if (registryTab === "companion") {
          setError("Unable to load Companion Pets. Please check backend service connectivity.");
        } else {
          setError("Unable to load dogs list. Access may be restricted.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDogs = async () => {
    try {
      setLoadingAll(true);
      const currentUser = getCurrentUser();
      const currentRole = normalizeRole(currentUser);
      const userShelterId = (currentUser as any)?.shelter_id || (currentUser as any)?.shelter?.id || (currentUser as any)?.assigned_shelter_id;
      const userRescueCentreId = getRescueCentreId(currentUser);

      if (currentRole === "rescue_centre_admin" && !userRescueCentreId) {
        setAllDogs([]);
        setLoadingAll(false);
        return;
      }

      const params: Record<string, any> = {};
      if (currentRole === "shelter_manager" && userShelterId) {
        params.shelter_id = userShelterId;
      }

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        params.rescue_centre_id = userRescueCentreId;
      }

      const response = await petService.getAllDogs(params);
      const rawList = unwrapList(response);
      let formatted = rawList.map(formatDog);

      if (currentRole === "shelter_manager" && userShelterId) {
        formatted = formatted.filter((d: any) => {
          const dShelterId = d.shelter_id || d.shelter?.id || d.shelter_location_id;
          return !dShelterId || String(dShelterId).toLowerCase() === String(userShelterId).toLowerCase();
        });
      }

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        formatted = formatted.filter((d: any) => {
          const dCentreId = d.rescue_centre_id || d.rescue_center_id || d.facility_id || d.organization_id;
          return String(dCentreId) === String(userRescueCentreId);
        });
      }

      if (currentRole === "rescue_centre_admin" || currentRole === "rescue_coordinator" || currentRole === "rescue_agent" || String(currentRole || "").includes("rescue")) {
        formatted = formatted.filter((d: any) => !d.is_companion_pet && d.status !== "companion");
      }

      setAllDogs(formatted);

      // Separate Dog Master profiles vs Companion Pets authoritatively
      const masterList = formatted.filter((d: any) => !d.is_companion_pet);
      const companionList = formatted.filter((d: any) => Boolean(d.is_companion_pet));

      setDogMasterCount(masterList.length);
      setCompanionPetCount(companionList.length);

      const totalMeta = response?.meta?.total ?? response?.data?.meta?.total ?? formatted.length;
      if (typeof totalMeta === "number" && totalMeta >= 0) {
        setGlobalTotalCount(totalMeta);
      }
    } catch (err) {
      console.warn("Failed to fetch global dogs list for summary cards:", err);
    } finally {
      setLoadingAll(false);
    }
  };

  // Rescue cases that produced a rescued/admitted animal, available to link
  // to this dog's profile (backend DogProfile accepts nullable rescue_case_id).
  const fetchRescueCases = async () => {
    try {
      const cases: any[] = [];
      for (const status of ["rescued", "admitted"]) {
        const response = await rescueService.getRescueCases({ status });
        cases.push(...unwrapList(response));
      }
      setRescueCases(cases);
    } catch {
      setRescueCases([]);
    }
  };

  /**
   * Load the persistent photo URL map from backend storage for all dogs.
   * Called once on mount and after any photo upload to keep the map fresh.
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
      // Use the most recently uploaded file
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

  useEffect(() => {
    fetchDogs();
  }, [search, page, statusFilter, adoptableOnly, registryTab]);

  useEffect(() => {
    fetchAllDogs();
    fetchRescueCases();
    loadDogPhotoMap();
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "register") {
      setIsRegisterModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const handleRegisterPet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petForm.name) {
      addToast("Pet Name is required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await petService.createPet(
        cleanPayload({
          name: petForm.name,
          breed: petForm.breed,
          gender: petForm.gender,
          estimated_age: petForm.estimated_age,
          age_months: petForm.age_months ? Number(petForm.age_months) : undefined,
          weight: petForm.weight ? Number(petForm.weight) : undefined,
          ear_shape: petForm.ear_shape && petForm.ear_shape !== "unknown" ? petForm.ear_shape : undefined,
          tail_type: petForm.tail_type && petForm.tail_type !== "unknown" ? petForm.tail_type : undefined,
          is_adoptable: petForm.is_adoptable,
          rescue_case_id: petForm.rescue_case_id || undefined,
        })
      );
      addToast(`Rescued pet "${petForm.name}" registered successfully!`, "success");
      setIsRegisterModalOpen(false);
      setPetForm({ ...emptyPetForm });
      fetchDogs();
      fetchAllDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to register pet.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = statusUpdateForm.dogId;
    if (!id) {
      addToast("Please select a dog to update.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await petService.updatePetStatus(id, statusUpdateForm.status);
      addToast(`Status updated for pet ${id} to ${statusUpdateForm.status}`, "success");
      setIsStatusModalOpen(false);
      setStatusUpdateForm({ dogId: "", status: "shelter" });
      fetchDogs();
      fetchAllDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update status.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAdoptable = async (dog: any) => {
    const id = dogId(dog);
    if (!id) {
      addToast("Could not determine the dog record to update.", "error");
      return;
    }
    // Enforce business rule: A dog cannot become adoptable without veterinary clearance
    if (
      dog.vet_clearance === false ||
      dog.vet_clearance_status === "pending" ||
      dog.vet_clearance_status === "rejected" ||
      dog.medical_status === "quarantine"
    ) {
      addToast(
        `Cannot clear ${dog.name} for adoption: Veterinary clearance is required before listing a dog as adoptable.`,
        "error"
      );
      return;
    }
    try {
      await petService.markDogAdoptable(id);
      addToast(`${dog.name} is now marked Ready for Adoption!`, "success");
      setIsAdoptableModalOpen(false);
      fetchDogs();
      fetchAllDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update status.";
      addToast(msg, "error");
    }
  };

  const openViewMasterFile = async (dog: any) => {
    setPendingPhotoUrl(null);
    const dId = dogId(dog);
    const cachedPhoto = dId ? localStorage.getItem(`pawguard_dog_photo_${dId}`) || sessionStorage.getItem(`pawguard_dog_photo_${dId}`) : null;
    const initialDog = cachedPhoto && !getDogPhotoUrl(dog) ? { ...dog, photo_url: cachedPhoto, image_url: cachedPhoto } : dog;

    setSelectedViewDog(initialDog);
    setIsViewModalOpen(true);

    if (dId) {
      try {
        const [res, tagRes] = await Promise.allSettled([
          petService.getPetById(dId),
          petService.getSafetyTagMetadata(dId),
        ]);

        let freshFormatted: any = {};
        if (res.status === "fulfilled") {
          const fresh = res.value?.data || res.value;
          if (fresh && (fresh.id || fresh.registration_number || fresh.name)) {
            freshFormatted = formatDog(fresh);
          }
        }

        let tagInfo: any = { safety_tag_status: "INACTIVE", safety_tag_active: false };
        if (tagRes.status === "fulfilled") {
          const tagMeta = tagRes.value?.data || tagRes.value;
          if (tagMeta) {
            const isTagActive = tagMeta.is_active === true || String(tagMeta.status || "").toUpperCase() === "ACTIVE";
            tagInfo = {
              safety_tag_active: isTagActive,
              safety_tag_status: isTagActive ? "ACTIVE" : "INACTIVE",
              safety_tag_metadata: tagMeta,
            };
          }
        }

        setSelectedViewDog((prev: any) => (prev && dogId(prev) === dId ? { ...prev, ...freshFormatted, ...tagInfo } : prev));
      } catch {
        /* keep initialDog */
      }
    }
  };

  const openTimelineModal = (dog: any) => {
    setTimelineDog(dog);
    setIsTimelineModalOpen(true);
  };

  const openDelete = (dog: any) => {
    setSelectedDog(dog);
    setIsDeleteModalOpen(true);
  };

const extractTagData = (res: any) => {
  if (!res) return null;
  let cur = res;
  if (cur.data && typeof cur.data === "object" && !Array.isArray(cur.data)) {
    if (cur.data.data && typeof cur.data.data === "object" && !Array.isArray(cur.data.data)) {
      cur = cur.data.data;
    } else {
      cur = cur.data;
    }
  }
  return cur;
};

  const openQrModal = async (dog: QrDogInfo) => {
    const id = dogId(dog);
    if (!id) {
      addToast("Could not determine the dog record to generate a QR for.", "error");
      return;
    }
    const knownActiveOnDog = Boolean(
      (dog as any)?.raw_token ||
      (dog as any)?.token ||
      (dog as any)?.safety_token ||
      (dog as any)?.safety_tag_active === true ||
      String((dog as any)?.safety_tag_status || "").toUpperCase() === "ACTIVE"
    );

    setQrDog(dog);
    setQrBlob(null);
    setQrImageUrl(null);
    setQrError(null);
    setTagMetadata(null);
    setRawToken(null);
    setTagStatus("INACTIVE");
    setIsQrModalOpen(true);

    try {
      setQrLoading(true);

      let activeState = false;
      let authoritativeScanUrl: string | null = null;
      const isCompanion = Boolean((dog as any)?.is_companion_pet || (dog as any)?.companion_pet_id || (dog as any)?.owner_id);

      // Fetch authoritative metadata from GET /api/v1/dogs/{dog_id}/safety-tag or GET /api/v1/companion-pets/{pet_id}/safety-tag
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

        const metaData = extractTagData(metaRes);
        if (metaData) {
          setTagMetadata(metaData);
          activeState = metaData.is_active === true || String(metaData.status || "").toUpperCase() === "ACTIVE";
          if (!activeState) {
            setTagStatus("INACTIVE");
            setRawToken(null);
            setQrImageUrl(null);
            setQrBlob(null);
            return;
          }
          setTagStatus("ACTIVE");

          // Extract authoritative public_scan_url from backend metadata
          const rawScanUrl = metaData.public_scan_url || metaData.public_scan_path;
          if (rawScanUrl && typeof rawScanUrl === "string" && rawScanUrl.trim()) {
            const cleanUrl = rawScanUrl.trim();
            const publicWebBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string) || "https://pawguard-public-web.vercel.app";
            authoritativeScanUrl = cleanUrl.startsWith("http")
              ? cleanUrl
              : `${publicWebBase.replace(/\/+$/, "")}${cleanUrl.startsWith("/") ? "" : "/"}${cleanUrl}`;
          }
        }
      } catch (metaErr: unknown) {
        const e = metaErr as { response?: { status?: number; data?: { error?: { message?: string }; message?: string } } };
        const status = e?.response?.status;
        const apiMsg = e?.response?.data?.error?.message || e?.response?.data?.message;

        if (status === 404 || (apiMsg && apiMsg.toLowerCase().includes("not found"))) {
          if (!knownActiveOnDog) {
            setTagStatus("INACTIVE");
            setRawToken(null);
            setQrImageUrl(null);
            setQrBlob(null);
          }
          setQrError(null);
        } else if (status === 401) {
          setQrError("Authentication Failure (401): No valid authentication credentials provided or session expired. Please sign in again.");
        } else if (status === 403) {
          setQrError("Access Denied (403): Your account role does not have authorization to view protected Safety Tag tokens or QR codes.");
        } else if (apiMsg) {
          setQrError(String(apiMsg));
        } else {
          setQrError("Service Temporarily Unavailable: Failed to connect to Safety Tag backend service.");
        }
      }

      if (authoritativeScanUrl) {
        const qrUrl = await generateQrDataUrl(authoritativeScanUrl);
        const blob = await generateQrBlob(authoritativeScanUrl);
        setQrImageUrl(qrUrl);
        setQrBlob(blob);
      } else if (activeState && !isCompanion) {
        try {
          const qrBlobData = await petService.getDogQrImage(id);
          const qrUrlData = URL.createObjectURL(qrBlobData);
          setQrImageUrl(qrUrlData);
          setQrBlob(qrBlobData);
        } catch {
          setRawToken(null);
          setQrImageUrl(null);
          setQrBlob(null);
          setQrError("Unable to load Safety Tag QR code from backend service. Please click Retry Request below.");
        }
      } else if (activeState && isCompanion) {
        // Fallback for companion pet active tag: use pet public-scan route
        const publicWebBase = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string) || "https://pawguard-public-web.vercel.app";
        const fallbackScanUrl = `${publicWebBase.replace(/\/+$/, "")}/api/v1/companion-pets/${id}/public-scan`;
        const qrUrl = await generateQrDataUrl(fallbackScanUrl);
        const blob = await generateQrBlob(fallbackScanUrl);
        setQrImageUrl(qrUrl);
        setQrBlob(blob);
      } else {
        setRawToken(null);
        setQrImageUrl(null);
        setQrBlob(null);
      }
    } catch (err: unknown) {
      let msg = "Failed to load Safety Tag metadata from backend service.";
      const e = err as { response?: { data?: { error?: { message?: string }; message?: string }; status?: number } };
      const apiMsg = e?.response?.data?.error?.message || e?.response?.data?.message;
      if (apiMsg) msg = String(apiMsg);
      if (e?.response?.status === 404 || (apiMsg && apiMsg.toLowerCase().includes("not found"))) {
        msg = "Dog Master record not found. A valid Dog Master record must exist on the backend before a Safety Tag can be provisioned.";
      } else if (e?.response?.status === 401) {
        msg = "Authentication Failure (401): No valid authentication credentials provided or session expired. Please sign in again.";
      } else if (e?.response?.status === 403) {
        msg = "Unauthorized (403): Your account role does not have permission to access Safety Tags for shelter animals.";
      }
      setQrError(msg);
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    if (qrImageUrl && qrImageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(qrImageUrl);
    }
    setQrImageUrl(null);
    setQrBlob(null);
    setQrDog(null);
    setQrError(null);
    setTagMetadata(null);
    setRawToken(null);
    setTagStatus("INACTIVE");
    setIsQrModalOpen(false);
  };

  const handleRefreshScanData = async () => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsRefreshingScanData(true);
    try {
      let metaRes: any = null;
      const isCompanion = Boolean((qrDog as any)?.is_companion_pet || (qrDog as any)?.companion_pet_id || (qrDog as any)?.owner_id);
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
      const metaData = metaRes?.data?.data || metaRes?.data || metaRes;
      if (metaData) {
        setTagMetadata(metaData);
        const isExplicitlyInactive =
          metaData.is_active === false ||
          String(metaData.status || "").toUpperCase() === "INACTIVE" ||
          String(metaData.status || "").toUpperCase() === "REVOKED";

        if (isExplicitlyInactive) {
          setTagStatus("INACTIVE");
        } else {
          setTagStatus("ACTIVE");
        }
      }
      addToast("Scan activity data refreshed from backend.", "success");
    } catch {
      addToast("Could not refresh scan activity data from backend.", "error");
    } finally {
      setIsRefreshingScanData(false);
    }
  };

  const handleProvisionTag = async (forceReissue = false) => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsProvisioning(true);
    setQrError(null);

    const isCompanion = Boolean((qrDog as any)?.is_companion || (qrDog as any)?.companion_pet_id || (qrDog as any)?.type === "companion");

    try {
      // Provision via POST /dogs/{id}/safety-tag or POST /companion-pets/{id}/safety-tag
      let res: any = null;
      if (isCompanion) {
        res = await petService.provisionCompanionPetSafetyTag(id, forceReissue);
      } else {
        try {
          res = await petService.provisionSafetyTag(id, forceReissue);
        } catch {
          res = await petService.provisionCompanionPetSafetyTag(id, forceReissue);
        }
      }
      const data = res?.data || res || {};
      const token = data.raw_token || data.token || data.rawToken;

      if (!token) {
        throw new Error("Backend provisioning response did not include data.raw_token.");
      }

      setRawToken(token);
      setQrDog((prev: any) => (prev ? { ...prev, raw_token: token, token: token, safety_token: token } : prev));
      const qrDataUrl = await generateQrDataUrl(token);
      const blob = await generateQrBlob(token);

      setQrImageUrl(qrDataUrl);
      setQrBlob(blob);
      setTagStatus("ACTIVE");
      setTagMetadata({
        token_prefix: data.token_prefix || String(token).slice(0, 8),
        status: "ACTIVE",
        created_at: new Date().toISOString(),
        scans_count: 0,
      });

      setIsReProvisionConfirmOpen(false);
      addToast(res?.message || `Safety Tag Provisioned! QR generated directly from raw_token.`, "success");
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { error?: { message?: string }; message?: string } } };
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || e?.message || "Failed to provision Safety Tag.";
      addToast(msg, "error");
      setQrError(msg);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleDeactivateTag = async () => {
    if (!qrDog) return;
    const id = dogId(qrDog);
    if (!id) return;
    setIsDeactivating(true);
    const isCompanion = Boolean((qrDog as any)?.is_companion || (qrDog as any)?.companion_pet_id || (qrDog as any)?.type === "companion");
    try {
      let res: any = null;
      if (isCompanion) {
        res = await petService.revokeCompanionPetSafetyTag(id);
      } else {
        try {
          res = await petService.revokeSafetyTag(id);
        } catch {
          res = await petService.revokeCompanionPetSafetyTag(id);
        }
      }
      addToast(res?.message || `Safety Tag deactivated for pet ${qrDog.name || id}.`, "success");
      setTagStatus("INACTIVE");
      setRawToken(null);
      setQrImageUrl(null);
      setQrBlob(null);
      setIsDeactivateConfirmOpen(false);
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || "Failed to deactivate Safety Tag.";
      addToast(msg, "error");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrImageUrl || !qrDog) return;
    const dogName = qrDog.name ? String(qrDog.name).replace(/[^a-zA-Z0-9-_]/g, "_") : "Pet";
    triggerDownload(qrImageUrl, `PawGuard_SafetyTag_${dogName}.png`);
  };

  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputToken.trim();
    if (!query) {
      setLookupError("Please enter a Safety Tag token to verify.");
      setVerifiedDog(null);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setVerifiedDog(null);

    try {
      const scanResponse = await petService.getPublicDogScan(query);
      const scanData = scanResponse?.data || scanResponse;

      if (!scanData || (!scanData.id && !scanData.dog_id && !scanData.name)) {
        setLookupError(`Safety Tag token "${query}" could not be authoritatively resolved.`);
        return;
      }

      const isActive = scanData.is_active !== false && String(scanData.status || "").toLowerCase() !== "inactive";
      if (!isActive) {
        setLookupError(`Safety Tag token "${query}" is INACTIVE or REVOKED.`);
        return;
      }

      const dogIdVal = scanData.dog_id || scanData.id || scanData.pet_id;
      const matched = allDogs.find(
        (d) => String(d.id || "").toLowerCase() === String(dogIdVal || "").toLowerCase()
      );

      if (matched) {
        setVerifiedDog({
          ...matched,
          raw_token: scanData.raw_token || matched.raw_token,
          tag_status: "ACTIVE",
        });
      } else {
        setVerifiedDog(
          formatDog({
            ...scanData,
            id: dogIdVal || query,
            status: scanData.current_status || scanData.status || "shelter",
            raw_token: scanData.raw_token || query,
            tag_status: "ACTIVE",
          })
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        `Safety Tag token "${query}" could not be verified.`;
      setLookupError(msg);
      setVerifiedDog(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePrintQr = async () => {
    if ((!qrImageUrl && !qrBlob) || !qrDog) return;
    try {
      const dataUrl = qrImageUrl || (qrBlob ? await blobToDataUrl(qrBlob) : "");
      const name = String(qrDog.name || "Dog");
      const registration = String(qrDog.registration_number || qrDog.id || "-");
      const breed = String(qrDog.breed || "-");
      const status = String(qrDog.status || "-");
      const tokenDisplay = rawToken || (tagMetadata?.token_prefix ? `${String(tagMetadata.token_prefix)}...` : petService.formatSafetyToken(qrDog));
      const win = window.open("", "_blank", "width=440,height=680");
      if (!win) {
        addToast("Popup blocked. Allow popups to print the QR code.", "error");
        return;
      }
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>PawGuard Safety Tag - ${escapeHtml(name)}</title>
            <style>
              body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 32px; text-align: center; color: #0F172A; }
              .card { border: 2px solid #6D28D9; border-radius: 16px; padding: 24px; background: #FFFFFF; }
              h1 { font-size: 24px; margin: 0 0 4px; color: #6D28D9; letter-spacing: -0.02em; }
              .sub { font-size: 11px; color: #64748B; margin: 2px 0 16px; text-transform: uppercase; font-weight: bold; }
              .meta { color: #334155; font-size: 13px; margin: 4px 0; }
              .token-box { background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px 12px; font-family: monospace; font-size: 16px; font-weight: bold; color: #6D28D9; margin: 14px 0; display: inline-block; }
              img.qr { width: 240px; height: 240px; image-rendering: pixelated; margin: 14px auto; display: block; }
              .footer { margin-top: 20px; font-size: 11px; color: #94A3B8; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>PawGuard</h1>
              <div class="sub">Official Pet Safety Tag</div>
              <p class="meta"><strong>Dog Name:</strong> ${escapeHtml(name)} &bull; <strong>Breed:</strong> ${escapeHtml(breed)}</p>
              <p class="meta"><strong>Dog ID:</strong> ${escapeHtml(registration)} &bull; <strong>Status:</strong> ${escapeHtml(status)}</p>
              <img class="qr" src="${dataUrl}" alt="Safety Tag QR Code"
                   onload="setTimeout(function(){ window.print(); }, 250);" />
              <div class="token-box">TOKEN: ${escapeHtml(String(tokenDisplay))}</div>
              <p class="meta">Scan QR to view pet safety information</p>
              <div class="footer">PawGuard Rescue &amp; Shelter Network &bull; Authoritative Safety Tag</div>
            </div>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
    } catch {
      addToast("Failed to prepare the QR code for printing.", "error");
    }
  };

  const handleEditDogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = dogId(selectedDog);
    if (!id) {
      addToast("Could not determine the dog record to update.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await petService.updatePet(
        id,
        cleanPayload({
          name: petForm.name,
          breed: petForm.breed,
          gender: petForm.gender,
          estimated_age: petForm.estimated_age,
          age_months: petForm.age_months ? Number(petForm.age_months) : undefined,
          weight: petForm.weight ? Number(petForm.weight) : undefined,
          ear_shape: petForm.ear_shape && petForm.ear_shape !== "unknown" ? petForm.ear_shape : undefined,
          tail_type: petForm.tail_type && petForm.tail_type !== "unknown" ? petForm.tail_type : undefined,
          is_adoptable: petForm.is_adoptable,
          status: DOG_STATUSES.includes(petForm.status) ? petForm.status : undefined,
        })
      );
      addToast(`Updated record for ${petForm.name}!`, "success");
      setIsEditModalOpen(false);
      setSelectedDog(null);
      fetchDogs();
      fetchAllDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update record.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDog = async () => {
    const id = dogId(selectedDog);
    if (!id) {
      addToast("Could not determine the dog record to delete.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await petService.deletePet(id);
      addToast(`Deleted pet ${selectedDog?.name}`, "success");
      setIsDeleteModalOpen(false);
      setSelectedDog(null);
      fetchDogs();
      fetchAllDogs();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to delete pet.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser);
  const isRescueAdmin = currentRole === "rescue_centre_admin" || currentRole === "rescue_coordinator" || currentRole === "rescue_agent" || String(currentRole || "").includes("rescue");

  const totalRegisteredCount = (globalTotalCount && globalTotalCount > allDogs.length) ? globalTotalCount : allDogs.length;
  const companionCount = allDogs.filter((dog) => Boolean(dog.is_companion_pet) || dog.status === "companion").length;
  const adoptableCount = allDogs.filter((dog) => Boolean(dog.is_adoptable)).length;

  const isCardsLoading = loadingAll && allDogs.length === 0 && (globalTotalCount === null || globalTotalCount === 0);

  const stats = [
    {
      title: "Dog Master Registry",
      value: isCardsLoading ? "..." : dogMasterCount,
      trend: "Shelter & Rescue Intakes",
      color: "#1E3A8A",
      icon: <FaPaw />,
      selected: registryTab === "master" && !statusFilter && !adoptableOnly,
      onClick: () => {
        setRegistryTab("master");
        setStatusFilter("");
        setAdoptableOnly(false);
        setPage(1);
        document.getElementById("dogs-table-card")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Companion Pet Registry",
      value: isCardsLoading ? "..." : companionPetCount,
      trend: "User Pets",
      color: "#6D28D9",
      icon: <FaHeart />,
      selected: registryTab === "companion" && !statusFilter && !adoptableOnly,
      onClick: () => {
        setRegistryTab("companion");
        setStatusFilter("");
        setAdoptableOnly(false);
        setPage(1);
        document.getElementById("dogs-table-card")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Total Combined Registry",
      value: isCardsLoading ? "..." : totalRegisteredCount,
      trend: "Combined Animals Count",
      color: "#16A34A",
      icon: <FaPaw />,
      selected: registryTab === "all" && !statusFilter && !adoptableOnly,
      onClick: () => {
        setRegistryTab("all");
        setStatusFilter("");
        setAdoptableOnly(false);
        setPage(1);
        document.getElementById("dogs-table-card")?.scrollIntoView({ behavior: "smooth" });
      },
    },
    ...(!isRescueAdmin ? [{
      title: "Companion Dogs",
      value: isCardsLoading ? "..." : companionCount,
      trend: "Citizen & Owner Registered",
      color: "#1E3A8A",
      icon: <FaDog />,
      selected: registryTab === "companion" && !statusFilter && !adoptableOnly,
      onClick: () => {
        setRegistryTab("companion");
        setStatusFilter("");
        setAdoptableOnly(false);
        setPage(1);
        document.getElementById("dogs-table-card")?.scrollIntoView({ behavior: "smooth" });
      },
    }] : []),
    {
      title: "Adoptable Dogs",
      value: isCardsLoading ? "..." : adoptableCount,
      trend: "Ready for Adoption",
      color: "#15803D",
      icon: <FaHeart />,
      selected: adoptableOnly,
      onClick: () => {
        setAdoptableOnly(true);
        setStatusFilter("");
        setPage(1);
        document.getElementById("dogs-table-card")?.scrollIntoView({ behavior: "smooth" });
      },
    },
  ];

  const columns = [
    { key: "registration_number", title: "Pet ID" },
    {
      key: "name",
      title: "Pet Name",
      render: (v: string) => (
        <span style={{ fontWeight: 600, color: "#0F172A", wordBreak: "break-word", maxWidth: "240px", display: "inline-block" }}>
          {v || "-"}
        </span>
      ),
    },
    { key: "breed", title: "Breed" },
    {
      key: "gender",
      title: "Gender",
      render: (v: string) =>
        v ? v.charAt(0).toUpperCase() + v.slice(1) : "-",
    },
    { key: "estimated_age", title: "Age" },
    {
      key: "is_companion_pet",
      title: "Registry Category",
      render: (_: any, row: any) => (
        <span
          style={{
            padding: "3px 8px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            background: row.is_companion_pet ? "#EDE9FE" : "#DBEAFE",
            color: row.is_companion_pet ? "#6D28D9" : "#1D4ED8",
          }}
        >
          {row.is_companion_pet ? "Companion Pet" : "Dog Master"}
        </span>
      ),
    },
    { key: "status", title: "Status" },
  ];

  const rowActions = (row: any) => (
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
      <Can permission="delete_animals">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDelete(row);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #FCA5A5",
            background: "#FFFFFF",
            color: "#DC2626",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <FaTrash /> Delete
        </button>
      </Can>
    </div>
  );

  return (
    <div>
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
          Dog & Rescue Case Directory
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Comprehensive dog tracking, intake records, shelter management and adoption monitoring.
        </p>
      </div>

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
          ⚠️ {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <Can permission="create_animals">
          <QuickActionCard
            icon={<FaPlus />}
            title="Register New Dog"
            subtitle="Register rescued dog"
            color="#2563EB"
            onClick={() => {
              setPetForm({ ...emptyPetForm });
              setIsRegisterModalOpen(true);
            }}
          />
        </Can>

        <Can permission="view_animals">
          <QuickActionCard
            icon={<FaSearch />}
            title="Find Dog by Safety Token"
            subtitle="Verify token or QR tag"
            color="#6366F1"
            onClick={() => {
              setInputToken("");
              setLookupError(null);
              setVerifiedDog(null);
              setIsTokenLookupModalOpen(true);
            }}
          />
        </Can>

        <Can permission="edit_animals">
          <QuickActionCard
            icon={<FaAmbulance />}
            title="Update Status"
            subtitle="Update dog status"
            color="#EF4444"
            onClick={() => setIsStatusModalOpen(true)}
          />
        </Can>

        <Can permission="edit_animals">
          <QuickActionCard
            icon={<FaHeart />}
            title="Ready For Adoption"
            subtitle="Mark adoptable"
            color="#10B981"
            onClick={() => setIsAdoptableModalOpen(true)}
          />
        </Can>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      <div id="dogs-table-card" className="soft-card" style={{ padding: "20px" }}>
        <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              {registryTab === "companion"
                ? "Companion Pets Registry (GET /api/v1/companion-pets)"
                : registryTab === "master"
                ? "Dog Master Registry (GET /api/v1/dogs)"
                : "All Registered Animals"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748B" }}>
              {registryTab === "companion"
                ? "Viewing all citizen-registered & adopted companion pets across users."
                : registryTab === "master"
                ? "Viewing shelter intake & rescue centre Dog Master profiles."
                : "Combined registry showing Dog Master profiles and Companion Pets."}
            </p>
          </div>

          <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "8px" }}>
            <button
              type="button"
              onClick={() => { setRegistryTab("all"); setPage(1); }}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: registryTab === "all" ? "#FFFFFF" : "transparent",
                color: registryTab === "all" ? "#2563EB" : "#64748B",
                boxShadow: registryTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              All Pets
            </button>
            <button
              type="button"
              onClick={() => { setRegistryTab("master"); setPage(1); }}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: registryTab === "master" ? "#FFFFFF" : "transparent",
                color: registryTab === "master" ? "#2563EB" : "#64748B",
                boxShadow: registryTab === "master" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              Dog Master Registry
            </button>
            {!isRescueAdmin && (
              <button
                type="button"
                onClick={() => { setRegistryTab("companion"); setPage(1); }}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: registryTab === "companion" ? "#FFFFFF" : "transparent",
                  color: registryTab === "companion" ? "#2563EB" : "#64748B",
                  boxShadow: registryTab === "companion" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                Companion Pets Registry
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={dogs}
          module="animals"
          loading={loading}
          error={error}
          onRetry={fetchDogs}
          emptyMessage={
            registryTab === "companion"
              ? "No companion pets found."
              : registryTab === "master"
              ? "No Dog Master profiles found."
              : "No pets registered yet. Register a rescued dog to get started."
          }
          onRowClick={openViewMasterFile}
          renderRowActions={rowActions}
          serverMode
          totalCount={totalCount}
          page={page}
          onPageChange={setPage}
          searchValue={search}
          onSearchChange={(term) => {
            setSearch(term);
            setPage(1);
          }}
          leftHeaderControls={
            <>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF", outline: "none" }}
              >
                <option value="">All Statuses</option>
                {registryTab !== "companion" && (
                  <>
                    <option value="shelter">In Shelter</option>
                    <option value="clinic">In Clinic</option>
                    <option value="rescued">Rescued</option>
                    <option value="fostered">Fostered</option>
                    <option value="adopted">Adopted</option>
                  </>
                )}
                {registryTab !== "master" && (
                  <>
                    <option value="active">Active</option>
                    <option value="owned">Owned</option>
                    <option value="registered">Registered</option>
                    <option value="lost">Lost</option>
                    <option value="found">Found</option>
                  </>
                )}
              </select>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#334155", cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={adoptableOnly}
                  onChange={(e) => {
                    setAdoptableOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                Adoptable Only
              </label>

              {(statusFilter || adoptableOnly) && (
                <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600 }}>
                  Active Filter: {adoptableOnly ? "Adoptable Dogs Only" : `Status: ${statusFilter.toUpperCase()}`}{" "}
                  <button
                    onClick={() => {
                      setStatusFilter("");
                      setAdoptableOnly(false);
                      setPage(1);
                    }}
                    style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: "12px", textDecoration: "underline", marginLeft: "6px" }}
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {loading && (
                <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>
                  Loading dogs...
                </span>
              )}
            </>
          }
        />
      </div>

      {/* Register New Dog Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Rescued Pet"
      >
        <form onSubmit={handleRegisterPet} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dog Name / Code Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Max"
              value={petForm.name}
              onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Breed</label>
              <input
                type="text"
                placeholder="e.g. Indie Mix"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Gender</label>
              <select
                value={petForm.gender}
                onChange={(e) => setPetForm({ ...petForm, gender: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Estimated Age</label>
              <input
                type="text"
                placeholder="e.g. 2 years"
                value={petForm.estimated_age}
                onChange={(e) => setPetForm({ ...petForm, estimated_age: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Age (months)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 24"
                value={petForm.age_months}
                onChange={(e) => setPetForm({ ...petForm, age_months: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Weight (kg)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 16.4"
                value={petForm.weight}
                onChange={(e) => setPetForm({ ...petForm, weight: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                <input
                  type="checkbox"
                  checked={petForm.is_adoptable}
                  onChange={(e) => setPetForm({ ...petForm, is_adoptable: e.target.checked })}
                />
                Ready for adoption
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Ear Shape</label>
              <select
                value={petForm.ear_shape || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, ear_shape: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {EAR_SHAPES.map((es) => (
                  <option key={es.value} value={es.value}>
                    {es.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Tail Type</label>
              <select
                value={petForm.tail_type || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, tail_type: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {TAIL_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>
                    {tt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Linked Rescue Case</label>
            <select
              value={petForm.rescue_case_id}
              onChange={(e) => setPetForm({ ...petForm, rescue_case_id: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">No linked rescue case</option>
              {rescueCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ticket_number || c.id} — {c.animal_count ?? ""} {c.animal_count ? "dog(s)" : ""}{c.location_address ? ` @ ${c.location_address}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
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
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
            >
              {isSubmitting ? "Registering..." : "Register Dog"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Rescue Dog Status"
      >
        <form onSubmit={handleUpdateStatus} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Select Dog</label>
            <select
              value={statusUpdateForm.dogId}
              onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, dogId: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              <option value="">Choose a dog...</option>
              {allDogs.map((d) => (
                <option key={d.registration_number} value={dogId(d) || d.registration_number}>
                  {d.name} ({d.registration_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>New Operational Status</label>
            <select
              value={statusUpdateForm.status}
              onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              {DOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
            >
              {isSubmitting ? "Updating..." : "Update Status"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Mark Adoptable Modal */}
      <Modal
        isOpen={isAdoptableModalOpen}
        onClose={() => setIsAdoptableModalOpen(false)}
        title="Mark Dog Ready for Adoption"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Select a dog to clear for adoption listing:
          </p>
          <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {allDogs.map((d) => (
              <div
                key={d.registration_number}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#F8FAFC",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#0F172A" }}>{d.name}</div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>ID: {d.registration_number} | {d.breed}</div>
                </div>
                <button
                  disabled={d.is_adoptable}
                  onClick={() => handleMarkAdoptable(d)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: d.is_adoptable ? "#CBD5E1" : "#10B981",
                    color: "#FFF",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: d.is_adoptable ? "not-allowed" : "pointer",
                  }}
                >
                  {d.is_adoptable ? "Adoptable" : "Clear for Adoption"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Edit Dog Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDog(null);
        }}
        title="Edit Dog Record"
      >
        <form onSubmit={handleEditDogSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Name</label>
            <input
              type="text"
              required
              value={petForm.name}
              onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Breed</label>
              <input
                type="text"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Gender</label>
              <select
                value={petForm.gender}
                onChange={(e) => setPetForm({ ...petForm, gender: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Estimated Age</label>
              <input
                type="text"
                value={petForm.estimated_age}
                onChange={(e) => setPetForm({ ...petForm, estimated_age: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Age (months)</label>
              <input
                type="number"
                min="0"
                value={petForm.age_months}
                onChange={(e) => setPetForm({ ...petForm, age_months: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Ear Shape</label>
              <select
                value={petForm.ear_shape || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, ear_shape: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {EAR_SHAPES.map((es) => (
                  <option key={es.value} value={es.value}>
                    {es.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Tail Type</label>
              <select
                value={petForm.tail_type || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, tail_type: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
              >
                {TAIL_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>
                    {tt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Status</label>
            <select
              value={petForm.status}
              onChange={(e) => setPetForm({ ...petForm, status: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              {DOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>
            <input
              type="checkbox"
              checked={petForm.is_adoptable}
              onChange={(e) => setPetForm({ ...petForm, is_adoptable: e.target.checked })}
            />
            Ready for adoption
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedDog(null);
              }}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600, cursor: "pointer" }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dog Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedDog(null);
        }}
        title="Confirm Dog Record Deletion"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to remove record for <strong>{selectedDog?.name}</strong> ({selectedDog?.registration_number})?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedDog(null);
              }}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDeleteDog}
              style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FaTrash /> {isSubmitting ? "Deleting..." : "Delete Record"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Find Dog by Safety Token Modal */}
      <Modal
        isOpen={isTokenLookupModalOpen}
        onClose={() => {
          setIsTokenLookupModalOpen(false);
          setInputToken("");
          setLookupError(null);
          setVerifiedDog(null);
        }}
        title="Find Dog by Safety Token"
        maxWidth="500px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <form onSubmit={handleVerifyToken} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
              Enter Safety Token or Code
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                required
                placeholder="e.g. PG-DOG-2026-0001 or DOG-2026-0001"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={lookupLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#6366F1",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {lookupLoading ? "Verifying..." : "Verify Token"}
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Enter the unique safety token (e.g. PG-DOG-XXXX) printed on the dog's safety tag or encoded in the QR.
            </span>
          </form>

          {lookupError && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                padding: "14px 16px",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              ⚠️ {lookupError}
            </div>
          )}

          {verifiedDog && (
            <div
              style={{
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#047857", fontWeight: 700, fontSize: "13px" }}>
                  <FaCheckCircle color="#10B981" /> Token Verified &bull; Exact Match
                </div>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#FFFFFF",
                    color: "#065F46",
                    textTransform: "capitalize",
                  }}
                >
                  Status: {verifiedDog.status || "Shelter"}
                </span>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #D1FAE5" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                  {verifiedDog.name}
                </div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                  <strong>Dog ID:</strong> <span style={{ fontFamily: "monospace" }}>{verifiedDog.registration_number || verifiedDog.id}</span>
                </div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                  <strong>Breed:</strong> {verifiedDog.breed || "-"} &nbsp;|&nbsp; <strong>Gender:</strong> {verifiedDog.gender ? verifiedDog.gender.charAt(0).toUpperCase() + verifiedDog.gender.slice(1) : "-"}
                </div>
                <div style={{ fontSize: "13px", color: "#6D28D9", fontWeight: 700, marginTop: "6px", fontFamily: "monospace" }}>
                  Token: {petService.formatSafetyToken(verifiedDog)}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const d = verifiedDog;
                    setIsTokenLookupModalOpen(false);
                    openViewMasterFile(d);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <FaEye /> View Dog Information
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* QR Code & Safety Tag Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={closeQrModal}
        title={qrDog?.name ? `Safety Tag & QR Code — ${qrDog.name}` : "Dog Safety Tag & QR Code"}
        maxWidth="520px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {qrDog && (
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "16px" }}>
                  Dog Name: {qrDog.name || "-"}
                </span>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                    background: tagStatus === "ACTIVE" ? "#DCFCE7" : "#FEE2E2",
                    color: tagStatus === "ACTIVE" ? "#166534" : "#991B1B",
                    border: tagStatus === "ACTIVE" ? "1px solid #86EFAC" : "1px solid #FCA5A5",
                    textTransform: "uppercase",
                  }}
                >
                  Tag Status: {tagStatus}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                <strong>Dog ID:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{qrDog.registration_number || qrDog.id || "-"}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                <strong>Breed:</strong> {qrDog.breed || "-"} &nbsp;|&nbsp;{" "}
                <strong>Gender:</strong> {qrDog.gender ? qrDog.gender.charAt(0).toUpperCase() + qrDog.gender.slice(1) : "-"}
              </div>

              {tagMetadata && typeof tagMetadata === "object" && (
                <div style={{ marginTop: "4px", paddingTop: "8px", borderTop: "1px dashed #CBD5E1", fontSize: "12px", color: "#64748B", display: "flex", justifyContent: "space-between" }}>
                  <span>Created: {String(tagMetadata.created_at || tagMetadata.created_date || "Active").slice(0, 10)}</span>
                  {Boolean(tagMetadata.token_prefix) && <span>Prefix: {String(tagMetadata.token_prefix)}</span>}
                </div>
              )}

            </div>
          )}

          {/* SCAN ACTIVITY WATCH SECTION */}
          {qrDog && (
            <div
              style={{
                width: "100%",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "12px 16px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                  Scan Activity
                </div>
                <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                  <strong>Total Scans:</strong> {String(tagMetadata?.scans_count ?? tagMetadata?.scan_count ?? 0)} &bull;{" "}
                  <strong>Last Scanned:</strong> {tagMetadata?.last_scanned_at ? String(tagMetadata.last_scanned_at).slice(0, 16).replace("T", " ") : "Never"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshScanData}
                disabled={isRefreshingScanData}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: isRefreshingScanData ? "not-allowed" : "pointer",
                }}
              >
                <FaSync style={{ animation: isRefreshingScanData ? "spin 1s linear infinite" : "none" }} />
                {isRefreshingScanData ? "Refreshing..." : "Refresh Scan Data"}
              </button>
            </div>
          )}

          {qrLoading && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  display: "inline-block",
                  width: "32px",
                  height: "32px",
                  border: "3px solid #F3E8FF",
                  borderTopColor: "#6D28D9",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748B", fontWeight: 500 }}>
                Fetching unique Safety Tag metadata from backend...
              </div>
            </div>
          )}

          {!qrLoading && qrError && (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "12px",
                }}
              >
                ⚠️ {qrError}
              </div>
              <button
                type="button"
                onClick={() => qrDog && openQrModal(qrDog)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Retry Request
              </button>
            </div>
          )}

          {!qrLoading && !qrError && !qrImageUrl && (
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ color: "#991B1B", fontWeight: 700, fontSize: "14px" }}>
                This pet does not have an active Safety Tag yet.
              </div>
              <div style={{ fontSize: "12px", color: "#64748B", maxWidth: "400px", lineHeight: 1.5 }}>
                Please provision a Safety Tag to generate an authoritative QR code and safety token for this pet.
              </div>
              <button
                type="button"
                onClick={() => handleProvisionTag()}
                disabled={isProvisioning}
                style={{
                  padding: "11px 24px",
                  borderRadius: "8px",
                      border: "none",
                      background: "#6D28D9",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: isProvisioning ? "not-allowed" : "pointer",
                    }}
                  >
                    {isProvisioning ? "Provisioning..." : "Provision Safety Tag"}
                  </button>
            </div>
          )}

          {!qrLoading && !qrError && qrImageUrl && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
              {tagStatus === "INACTIVE" && (
                <div
                  style={{
                    width: "100%",
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  ⚠️ Safety Tag is INACTIVE. Scans will no longer resolve until re-provisioned.
                </div>
              )}

              {/* PROMINENT CENTERED QR CODE */}
              <div
                style={{
                  padding: "18px",
                  border: "2px solid #E2E8F0",
                  borderRadius: "16px",
                  background: "#FFFFFF",
                  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  opacity: tagStatus === "INACTIVE" ? 0.4 : 1,
                }}
              >
                <img
                  src={qrImageUrl}
                  alt={`Safety Tag QR Code for ${qrDog?.name || "Dog"}`}
                  style={{ width: "240px", height: "240px", imageRendering: "pixelated", display: "block" }}
                />
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
                  Scan this QR code to view pet safety information.
                </div>
              </div>

              {/* ACTION BUTTONS */}
              {tagStatus === "ACTIVE" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#6D28D9",
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <FaDownload /> Download QR
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintQr}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: "1px solid #C4B5FD",
                      background: "#FFFFFF",
                      color: "#6D28D9",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    <FaPrint /> Print Safety Tag
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsReProvisionConfirmOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#334155",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Re-Provision Tag
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeactivateConfirmOpen(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "11px 14px",
                      borderRadius: "8px",
                      border: "1px solid #FCA5A5",
                      background: "#FEF2F2",
                      color: "#991B1B",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Deactivate Tag
                  </button>
                </div>
              ) : (
                <div style={{ width: "100%" }}>
                  <button
                    type="button"
                    onClick={() => handleProvisionTag(true)}
                    disabled={isProvisioning}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#6D28D9",
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: isProvisioning ? "not-allowed" : "pointer",
                    }}
                  >
                    {isProvisioning ? "Re-Provisioning..." : "Re-Provision Safety Tag"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Re-Provision Confirmation Modal */}
      <Modal
        isOpen={isReProvisionConfirmOpen}
        onClose={() => setIsReProvisionConfirmOpen(false)}
        title="Re-Provision Safety Tag?"
        maxWidth="450px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Re-provisioning this Safety Tag will generate a <strong>NEW raw token</strong> and invalidate the existing QR code tag for <strong>{qrDog?.name || "this pet"}</strong>.
            <br />
            <br />
            The current QR code will no longer resolve for public scans. Continue?
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setIsReProvisionConfirmOpen(false)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleProvisionTag(true)}
              disabled={isProvisioning}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#6D28D9",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: isProvisioning ? "not-allowed" : "pointer",
              }}
            >
              {isProvisioning ? "Re-Provisioning..." : "Confirm Re-Provision"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Safety Tag Confirmation Modal */}
      <Modal
        isOpen={isDeactivateConfirmOpen}
        onClose={() => setIsDeactivateConfirmOpen(false)}
        title="Deactivate Safety Tag?"
        maxWidth="440px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
          <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
            Are you sure you want to deactivate the Safety Tag for <strong>{qrDog?.name || "this pet"}</strong>?
            <br />
            <br />
            Once deactivated, public QR scans will no longer resolve to this pet's profile until a new tag is provisioned.
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setIsDeactivateConfirmOpen(false)}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivateTag}
              disabled={isDeactivating}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#DC2626",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "13px",
                cursor: isDeactivating ? "not-allowed" : "pointer",
              }}
            >
              {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Dog Master File View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedViewDog(null);
        }}
        title={`Dog Master Profile — ${selectedViewDog?.name || "Record"}`}
        size="xl"
        footer={
          selectedViewDog ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const dog = selectedViewDog;
                  setIsViewModalOpen(false);
                  openTimelineModal(dog);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <FaHistory /> View Lifecycle Timeline
              </button>
              <button
                type="button"
                onClick={() => {
                  const dog = selectedViewDog;
                  setIsViewModalOpen(false);
                  openQrModal(dog);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#6D28D9",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <FaQrcode /> View QR Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedViewDog(null);
                }}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close Profile
              </button>
            </>
          ) : null
        }
      >
        {selectedViewDog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                borderRadius: "12px",
                padding: "16px 20px",
                color: "#FFFFFF",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <label
                    style={{
                      position: "relative",
                      cursor: isSavingPhoto ? "not-allowed" : "pointer",
                      display: "block",
                      width: "76px",
                      height: "76px",
                      flexShrink: 0,
                    }}
                    title="Click to Upload or Select New Dog Photo (JPG, PNG, WEBP max 5MB)"
                  >
                    {(pendingPhotoUrl || getDogPhotoUrl(selectedViewDog)) ? (
                      <img
                        src={pendingPhotoUrl || getDogPhotoUrl(selectedViewDog)}
                        alt={selectedViewDog.name || "Dog"}
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "12px",
                          objectFit: "cover",
                          border: pendingPhotoUrl ? "2px solid #F59E0B" : "2px solid #38BDF8",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "12px",
                          background: "#334155",
                          border: "2px dashed #64748B",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94A3B8",
                        }}
                      >
                        <FaPaw style={{ fontSize: "24px" }} />
                        <span style={{ fontSize: "9px", fontWeight: 700, marginTop: "2px" }}>No Photo</span>
                      </div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "12px",
                        background: "rgba(15, 23, 42, 0.75)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        opacity: 0,
                        transition: "opacity 0.2s ease",
                        fontSize: "10px",
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "2px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <FaCamera style={{ fontSize: "16px", marginBottom: "2px" }} />
                      <span>{getDogPhotoUrl(selectedViewDog) ? "Change" : "Add"}</span>
                    </div>

                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={handleMasterPhotoSelect}
                      disabled={isSavingPhoto}
                    />
                  </label>
                </div>

                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#FFFFFF" }}>
                    {selectedViewDog.name || "Unnamed Dog"}
                  </h2>
                  <div style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>
                    Registration ID: <strong style={{ fontFamily: "monospace", color: "#F3F4F6" }}>{selectedViewDog.registration_number || selectedViewDog.id}</strong> &bull;{" "}
                    Breed: <strong style={{ color: "#F3F4F6" }}>{selectedViewDog.breed || "Mixed"}</strong>
                  </div>

                  {pendingPhotoUrl && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleSaveMasterPhoto}
                        disabled={isSavingPhoto}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#10B981",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: isSavingPhoto ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        }}
                      >
                        {isSavingPhoto ? "Saving Photo..." : "💾 Save Photo"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelPhotoPreview}
                        disabled={isSavingPhoto}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #64748B",
                          background: "#334155",
                          color: "#CBD5E1",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: isSavingPhoto ? "not-allowed" : "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 700 }}>
                        ⚠️ Unsaved Preview
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                    background: selectedViewDog.is_adoptable ? "#10B981" : "#2563EB",
                    color: "#FFFFFF",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedViewDog.is_adoptable ? "Ready for Adoption" : String(selectedViewDog.status || "Admitted").toUpperCase()}
                </span>

                <span
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                    background: selectedViewDog.safety_tag_status === "ACTIVE" || selectedViewDog.safety_tag_active ? "#059669" : "#DC2626",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Safety Tag: {selectedViewDog.safety_tag_status === "ACTIVE" || selectedViewDog.safety_tag_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            {/* Stage-Driven Dog Master Profile Lifecycle Workflow Box */}
            {(() => {
              const dog = selectedViewDog;
              if (!dog) return null;
              const status = String(dog.status || "").toLowerCase();
              const isAdoptable = !!dog.is_adoptable;
              const isCleared = isDogMedicallyCleared(dog);
              const mStatus = String(dog.medical_status || "").toLowerCase();
              const isQuarantineOrTreatment = mStatus.includes("treatment") || mStatus.includes("quarantine") || dog.vet_clearance === false;

              const handleAdmitToShelter = async () => {
                const dId = dogId(dog);
                try {
                  await petService.updatePetStatus(dId, "shelter");
                  addToast(`${dog.name || "Dog"} admitted to Shelter Care!`, "success");
                  const updated = { ...dog, status: "shelter" };
                  setSelectedViewDog(updated);
                  notifyDataChanged();
                  fetchDogs();
                } catch (err: any) {
                  addToast(err?.message || "Failed to update dog status.", "error");
                }
              };

              const handleSendForCheckup = async () => {
                const dId = dogId(dog);
                try {
                  await petService.updatePet(dId, { status: "clinic", medical_status: "Checkup Requested" });
                  await publishActionEvent({
                    module: "medical",
                    action: "create",
                    title: "Medical Checkup Requested",
                    message: `Medical checkup requested for dog ${dog.name || dId}. Assigned to Veterinarian queue.`,
                    targetRoles: ["super_admin", "veterinarian"],
                    metadata: { dog_id: dId },
                  });
                  addToast(`Medical checkup request submitted for ${dog.name || "Dog"}. Sent to Veterinarian queue!`, "success");
                  const updated = { ...dog, status: "clinic", medical_status: "Checkup Requested" };
                  setSelectedViewDog(updated);
                  notifyDataChanged();
                  fetchDogs();
                } catch (err: any) {
                  addToast(err?.message || "Failed to submit medical checkup request.", "error");
                }
              };

              const handleIssueVetClearance = async () => {
                const dId = dogId(dog);
                const userRole = getCurrentUserRole();
                if (userRole !== "veterinarian" && userRole !== "super_admin") {
                  addToast("Only a Veterinarian or Super Admin can issue medical clearance.", "error");
                  return;
                }
                try {
                  await medicalService.issueCertificate({
                    dog_id: dId,
                    clearance_type: "adoption_surgery",
                    status: "cleared",
                    decision_notes: "Dog completed comprehensive clinical examination. Medically cleared & fit for adoption.",
                  });
                  await petService.updatePet(dId, {
                    medical_status: "Medically Cleared",
                    is_fit_for_adoption: true,
                    vet_clearance: true,
                    vet_clearance_status: "approved",
                  });
                  addToast(`Veterinary Clearance issued for ${dog.name || "Dog"}! Medically fit for adoption.`, "success");
                  const updated = {
                    ...dog,
                    vet_clearance: true,
                    vet_clearance_status: "approved",
                    is_fit_for_adoption: true,
                    medical_status: "Medically Cleared",
                  };
                  setSelectedViewDog(updated);
                  notifyDataChanged();
                  fetchDogs();
                } catch (err: any) {
                  addToast(err?.message || "Failed to issue veterinary clearance.", "error");
                }
              };

              const handleMarkReadyForAdoption = async () => {
                const dId = dogId(dog);
                if (!isCleared) {
                  addToast("Medical checkup required. This dog must be examined and cleared by a veterinarian before it can be marked Ready for Adoption.", "error");
                  return;
                }
                try {
                  await petService.markDogAdoptable(dId);
                  addToast(`${dog.name || "Dog"} is now marked Ready for Adoption!`, "success");
                  const updated = { ...dog, is_adoptable: true, status: "shelter" };
                  setSelectedViewDog(updated);
                  notifyDataChanged();
                  fetchDogs();
                } catch (err: any) {
                  addToast(err?.message || "Failed to mark dog as adoptable.", "error");
                }
              };

              if (status === "rescued") {
                return (
                  <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#1E40AF" }}>Rescued & Intaked</div>
                        <div style={{ fontSize: "13px", color: "#3B82F6", marginTop: "2px" }}>Next Action: Admit to Shelter Care</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAdmitToShelter}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#2563EB",
                          color: "#FFFFFF",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Admit to Shelter
                      </button>
                    </div>
                  </div>
                );
              }

              if (status === "shelter" && !isAdoptable && !isCleared && !isQuarantineOrTreatment) {
                return (
                  <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#B45309", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#92400E" }}>Shelter Care & Admission</div>
                        <div style={{ fontSize: "13px", color: "#D97706", marginTop: "2px" }}>Next Action: Send for Medical Checkup & Vet Examination</div>
                      </div>
                      <Can permission="edit_animals">
                        <button
                          type="button"
                          onClick={handleSendForCheckup}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#D97706",
                            color: "#FFFFFF",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <FaStethoscope /> Send for Medical Checkup
                        </button>
                      </Can>
                    </div>
                  </div>
                );
              }

              if (status === "clinic" || mStatus.includes("checkup") || (isQuarantineOrTreatment && !isCleared)) {
                const userRole = getCurrentUserRole();
                const isVetOrAdmin = userRole === "veterinarian" || userRole === "super_admin";
                return (
                  <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#6D28D9", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#5B21B6" }}>
                          {isQuarantineOrTreatment ? "Under Medical Treatment & Care" : "Under Veterinary Checkup / Clinic"}
                        </div>
                        <div style={{ fontSize: "13px", color: "#7C3AED", marginTop: "2px" }}>
                          Next Action: Veterinarian Clinical Examination & Decision
                        </div>
                      </div>

                      {isVetOrAdmin ? (
                        <button
                          type="button"
                          onClick={handleIssueVetClearance}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#6D28D9",
                            color: "#FFFFFF",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <FaStethoscope /> Issue Veterinary Clearance
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#6D28D9", fontWeight: 600, background: "#EDE9FE", padding: "6px 12px", borderRadius: "6px" }}>
                          ⏳ Waiting for Veterinarian Examination & Decision
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              if (isCleared && !isAdoptable && status !== "adopted") {
                return (
                  <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#065F46" }}>Medically Cleared & Fit for Adoption</div>
                        <div style={{ fontSize: "13px", color: "#059669", marginTop: "2px" }}>Next Action: Mark Ready for Adoption</div>
                      </div>
                      <Can permission="edit_animals">
                        <button
                          type="button"
                          onClick={handleMarkReadyForAdoption}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#059669",
                            color: "#FFFFFF",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <FaCheckCircle /> Mark Ready for Adoption
                        </button>
                      </Can>
                    </div>
                  </div>
                );
              }

              if (isAdoptable && status !== "adopted") {
                return (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#166534" }}>Ready for Adoption (Listed on Public Site)</div>
                        <div style={{ fontSize: "13px", color: "#16A34A", marginTop: "2px" }}>Next Action: Adoption Application Review & Handover</div>
                      </div>
                      <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700, background: "#DCFCE7", padding: "6px 12px", borderRadius: "6px" }}>
                        🐶 Listed for Public Adoption
                      </span>
                    </div>
                  </div>
                );
              }

              if (status === "adopted") {
                return (
                  <div style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>CURRENT STAGE:</span>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>Adopted (Forever Home Joined)</div>
                        <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Lifecycle Completed &bull; Removed from Public Adoption Listing</div>
                      </div>
                      <span style={{ fontSize: "12px", color: "#0F172A", fontWeight: 700, background: "#E2E8F0", padding: "6px 12px", borderRadius: "6px" }}>
                        🎉 Adopted
                      </span>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Breed</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedViewDog.breed || "-"}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Gender</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px", textTransform: "capitalize" }}>{selectedViewDog.gender || "-"}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Estimated Age</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedViewDog.estimated_age || (selectedViewDog.age_months ? `${selectedViewDog.age_months} months` : "-")}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Weight</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedViewDog.weight ? `${selectedViewDog.weight} kg` : "-"}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Color / Markings</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{selectedViewDog.color || selectedViewDog.distinguishing_marks || "-"}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Microchip ID</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px", fontFamily: "monospace" }}>{selectedViewDog.microchip_id || "Not Microchipped"}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Ear Shape</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{formatEarShape(selectedViewDog.ear_shape)}</div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Tail Type</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{formatTailType(selectedViewDog.tail_type)}</div>
              </div>
            </div>

            {/* Safety Identification Box in Master File */}
            <div style={{ background: "#F3E8FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 700, color: "#6D28D9" }}>
                  <FaQrcode color="#6D28D9" /> Safety Identification (Unified 1:1)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const dog = selectedViewDog;
                    setIsViewModalOpen(false);
                    openQrModal(dog);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#6D28D9",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <FaQrcode /> Generate / View QR
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#64748B" }}>Unique Safety Token:</span>{" "}
                  <strong style={{ fontFamily: "monospace", color: "#6D28D9" }}>
                    {petService.formatSafetyToken(selectedViewDog)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>QR Tag Status:</span>{" "}
                  <strong style={{ color: "#059669" }}>Active &amp; Linked</strong>
                </div>
              </div>
            </div>

            <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                <FaStethoscope color="#2563EB" /> Veterinary &amp; Operational Clearance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div>
                  <span style={{ color: "#64748B" }}>Vet Clearance Status:</span>{" "}
                  <strong style={{ color: selectedViewDog.vet_clearance === false ? "#DC2626" : "#059669" }}>
                    {selectedViewDog.vet_clearance_status || (selectedViewDog.vet_clearance === false ? "Pending Clearance" : "Cleared")}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Linked Rescue Ticket:</span>{" "}
                  <strong>{selectedViewDog.rescue_case_id ? `Case #${selectedViewDog.rescue_case_id.slice(0, 8)}` : "None Linked"}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B" }}>Current Facility / Shelter:</span>{" "}
                  <strong>{selectedViewDog.shelter_name || selectedViewDog.current_facility || "Central Shelter"}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Dog Master Unified Lifecycle Timeline Modal */}
      <DogLifecycleTimelineModal
        isOpen={isTimelineModalOpen}
        onClose={() => {
          setIsTimelineModalOpen(false);
          setTimelineDog(null);
        }}
        dog={timelineDog}
      />
    </div>
  );
};

export default Pets;
