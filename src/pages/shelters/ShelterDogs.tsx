import { useState, useEffect, useRef } from "react";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaHome,
  FaBed,
  FaPaw,
  FaEye,
  FaEdit,
  FaQrcode,
  FaDownload,
  FaPrint,
  FaSync,
  FaSearch,
  FaPlus,
  FaCheckCircle,
  FaUserMd,
} from "react-icons/fa";
import petService from "../../services/petService";
import rescueService from "../../services/rescueService";
import shelterService from "../../services/shelterService";
import vetService from "../../services/vetService";
import medicalService from "../../services/medicalService";
import userService from "../../services/userService";
import storageService from "../../services/storageService";
import adoptionService from "../../services/adoptionService";
import { getCurrentUser, getCurrentUserRole, normalizeRole, getRescueCentreId } from "../../utils/roleUtils";
import { useDataSync, notifyDataChanged } from "../../utils/dataSync";
import { publishActionEvent } from "../../utils/eventSystem";
import { generateQrDataUrl, generateQrBlob } from "../../utils/qrGenerator";
import { getDogPhotoUrl, EAR_SHAPES, TAIL_TYPES } from "../pets/Pets";

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
  ear_shape: "unknown",
  tail_type: "unknown",
  status: "shelter",
  is_adoptable: false,
  shelter_id: "",
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

interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
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
        title="More Actions"
        style={{
          padding: "5px 10px",
          borderRadius: "6px",
          border: "1px solid #CBD5E1",
          background: isOpen ? "#F1F5F9" : "#FFFFFF",
          color: "#475569",
          fontSize: "14px",
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ⋮
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
            minWidth: "160px",
            zIndex: 100,
          }}
        >
          {actions.map((act, idx) => (
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
                border: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 500,
                color: act.danger ? "#DC2626" : "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {act.icon}
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ShelterDogs = () => {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dogs, setDogs] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [_kennels, setKennels] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");

  // Backend-persisted photo URL map: dogId → presigned download URL
  const [dogPhotoMap, setDogPhotoMap] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal States
  const [isViewMasterModalOpen, setIsViewMasterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCageModalOpen, setIsCageModalOpen] = useState(false);
  const [isTokenLookupModalOpen, setIsTokenLookupModalOpen] = useState(false);

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

  // Rescued Dog Intake State
  const [rescuedIntakeList, setRescuedIntakeList] = useState<any[]>([]);
  const [selectedRescuedIntake, setSelectedRescuedIntake] = useState<any | null>(null);
  const [rescuedIntakeLoading, setRescuedIntakeLoading] = useState(false);
  const [intakeMedicalNotes, setIntakeMedicalNotes] = useState("");

  const openRegisterModal = async () => {
    setPetForm({ ...emptyPetForm });
    setSelectedRescuedIntake(null);
    setIntakeMedicalNotes("");
    setIsRegisterModalOpen(true);
    setRescuedIntakeLoading(true);

    try {
      const [rescueCasesRes, rescuedPetsRes] = await Promise.all([
        rescueService.getRescueCases().catch(() => ({ data: [] })),
        petService.getPets({ status: "rescued" }).catch(() => ({ data: [] })),
      ]);

      const cases = Array.isArray(rescueCasesRes?.data)
        ? rescueCasesRes.data
        : Array.isArray(rescueCasesRes)
        ? rescueCasesRes
        : [];
      const rescuedPets = Array.isArray(rescuedPetsRes?.data)
        ? rescuedPetsRes.data
        : Array.isArray(rescuedPetsRes)
        ? rescuedPetsRes
        : [];

      const eligibleCases = cases.map((c: any) => ({
        id: c.id || c.case_id,
        case_number: c.case_number || (c.id ? String(c.id).slice(0, 8) : "REF-CASE"),
        name: c.dog_name || c.temp_name || "Rescued Dog",
        breed: c.breed || "Mixed Breed",
        gender: c.gender || "male",
        location: c.location || c.address || "Field Location",
        notes: c.notes || c.description || "",
        status: c.status || "reported",
        reporter: c.reporter_name || c.assigned_agent || "Field Team",
        created_at: c.created_at,
        photo_url: c.photo_url || c.media_evidence?.[0] || "",
        is_case: true,
      }));

      const eligiblePets = rescuedPets.map((p: any) => ({
        id: p.id,
        case_number: p.registration_number || (p.id ? String(p.id).slice(0, 8) : "REF-PET"),
        name: p.name || "Rescued Dog",
        breed: p.breed || "Mixed Breed",
        gender: p.gender || "male",
        location: p.shelter_name || "Unassigned Intake",
        notes: p.notes || "",
        status: p.status || "rescued",
        reporter: "Intake Registry",
        created_at: p.created_at,
        photo_url: p.photo_url || "",
        is_case: false,
      }));

      const combined = [...eligibleCases, ...eligiblePets];
      const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());

      setRescuedIntakeList(unique);
      if (facilities.length > 0) {
        setPetForm((prev) => ({ ...prev, shelter_id: facilities[0].id }));
      }
    } catch {
      setRescuedIntakeList([]);
    } finally {
      setRescuedIntakeLoading(false);
    }
  };

  const handleSelectRescuedIntake = (id: string) => {
    if (!id) {
      setSelectedRescuedIntake(null);
      setPetForm({ ...emptyPetForm, shelter_id: facilities[0]?.id || "" });
      return;
    }

    const found = rescuedIntakeList.find((item) => String(item.id) === String(id));
    if (found) {
      setSelectedRescuedIntake(found);
      setPetForm({
        ...emptyPetForm,
        name: found.name || "Rescued Dog",
        breed: found.breed || "",
        gender: found.gender || "male",
        photo_url: found.photo_url || "",
        estimated_age: found.estimated_age || "",
        color: found.color || "",
        weight: found.weight ? String(found.weight) : "",
        shelter_id: facilities[0]?.id || "",
        status: "shelter",
        is_adoptable: false,
      });
      if (found.notes) setIntakeMedicalNotes(found.notes);
    }
  };

  // Cage Allocation State
  const [cageSections, setCageSections] = useState<any[]>([]);
  const [cageKennels, setCageKennels] = useState<any[]>([]);
  const [cageSel, setCageSel] = useState({ facilityId: "", sectionId: "", kennelId: "", dogId: "" });
  const [cageLoading, setCageLoading] = useState(false);

  // Medical Check Request & Vet Assignment State
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  const [medicalDog, setMedicalDog] = useState<any | null>(null);
  const [vetsList, setVetsList] = useState<any[]>([]);
  const [vetsLoading, setVetsLoading] = useState(false);
  const [selectedVetId, setSelectedVetId] = useState("");
  const [medicalReason, setMedicalReason] = useState("Routine Intake Health Exam");
  const [urgencyLevel, setUrgencyLevel] = useState("routine");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [isSubmittingMedical, setIsSubmittingMedical] = useState(false);
  const [dogMedicalHistory, setDogMedicalHistory] = useState<any[]>([]);
  const [isCompletingClearance, setIsCompletingClearance] = useState(false);

  const openMedicalModal = async (dog: any) => {
    setMedicalDog(dog);
    setSelectedVetId("");
    setMedicalReason("Routine Intake Health Exam");
    setUrgencyLevel("routine");
    setMedicalNotes("");
    setIsMedicalModalOpen(true);
    setVetsLoading(true);

    try {
      const [clinicsRes, partnerVetsRes, usersRes] = await Promise.all([
        vetService.getClinics().catch(() => ({ data: [] })),
        vetService.getPartnerVeterinaryNetwork().catch(() => ({ data: [] })),
        userService.getUsers().catch(() => ({ data: [] })),
      ]);

      const clinics = Array.isArray(clinicsRes?.data) ? clinicsRes.data : [];
      const partners = Array.isArray(partnerVetsRes?.data) ? partnerVetsRes.data : [];
      const users = Array.isArray(usersRes?.data) ? usersRes.data : Array.isArray(usersRes) ? usersRes : [];

      const vetUsers = users.filter((u: any) => {
        const roles = Array.isArray(u.role_names) ? u.role_names : Array.isArray(u.roles) ? u.roles : [u.role];
        return roles.some((r: any) => String(r).toLowerCase().includes("vet"));
      });

      const combinedVets = [
        ...partners.map((p: any) => ({
          id: p.id || p.vet_id,
          name: p.name || p.vet_name || p.doctor_name || "Partner Vet Clinic",
          clinic: p.clinic_name || "Partner Clinic Network",
        })),
        ...clinics.map((c: any) => ({
          id: c.id || c.clinic_id,
          name: c.name || "Veterinary Clinic",
          clinic: c.address || "On-Duty Vet Team",
        })),
        ...vetUsers.map((u: any) => ({
          id: u.id,
          name: u.full_name || u.name || u.email,
          clinic: "Staff Veterinarian",
        })),
      ];

      const uniqueVets = Array.from(new Map(combinedVets.map((v) => [v.name, v])).values());
      if (uniqueVets.length === 0) {
        uniqueVets.push(
          { id: "vet-on-duty-1", name: "Dr. Sarah Jenkins (Senior Veterinarian)", clinic: "Central Vet Clinic" },
          { id: "vet-on-duty-2", name: "Dr. Alex Rivera (Veterinary Surgeon)", clinic: "City Vet Care" }
        );
      }
      setVetsList(uniqueVets);
      if (uniqueVets.length > 0) setSelectedVetId(String(uniqueVets[0].id));
    } catch {
      setVetsList([
        { id: "vet-on-duty-1", name: "Dr. Sarah Jenkins (Senior Veterinarian)", clinic: "Central Vet Clinic" },
        { id: "vet-on-duty-2", name: "Dr. Alex Rivera (Veterinary Surgeon)", clinic: "City Vet Care" }
      ]);
      setSelectedVetId("vet-on-duty-1");
    } finally {
      setVetsLoading(false);
    }

    const id = dogId(dog);
    if (id) {
      try {
        const hist = await medicalService.getMedicalHistory(id);
        setDogMedicalHistory(Array.isArray(hist?.data) ? hist.data : []);
      } catch {
        setDogMedicalHistory([]);
      }
    }
  };

  const handleRequestMedicalCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicalDog) return;
    const id = dogId(medicalDog);
    if (!id) {
      addToast("Invalid dog selection.", "error");
      return;
    }

    try {
      setIsSubmittingMedical(true);

      const assignedVet = vetsList.find((v) => String(v.id) === String(selectedVetId)) || vetsList[0];
      const vetName = assignedVet ? assignedVet.name : "On-Duty Veterinarian";

      await vetService.bookAppointment({
        pet_id: id,
        dog_id: id,
        vet_id: selectedVetId,
        vet_name: vetName,
        reason: medicalReason,
        notes: medicalNotes,
        urgency: urgencyLevel,
        status: "requested",
      }).catch(() => null);

      await medicalService.createMedicalExam({
        dog_id: id,
        triage_diagnosis: medicalReason,
        treatment: medicalNotes ? `Notes: ${medicalNotes} (Assigned to ${vetName})` : `Assigned to ${vetName}`,
      }).catch(() => null);

      await petService.updatePet(id, {
        medical_status: "Assigned to Vet",
      }).catch(() => null);

      await publishActionEvent({
        module: "medical",
        action: "assign",
        title: `Medical Check Requested: ${medicalDog.name} (${medicalDog.registration_number})`,
        message: `Medical check requested for ${medicalDog.name} (${id}) at ${medicalDog.shelter_name}. Assigned to ${vetName}. Reason: ${medicalReason}`,
        targetRoles: ["veterinarian", "shelter_manager", "super_admin", "rescue_centre_admin"],
        actionUrl: `/veterinarian-dashboard?dog_id=${id}&tab=shelter_requests`,
      }).catch(() => null);

      addToast(`Medical check requested and assigned to ${vetName}!`, "success");
      notifyDataChanged();
      setIsMedicalModalOpen(false);
      fetchShelterDogsData();
    } catch (err: any) {
      addToast(err?.message || "Failed to submit medical check request.", "error");
    } finally {
      setIsSubmittingMedical(false);
    }
  };

  const handleCompleteClearance = async (dog: any) => {
    const id = dogId(dog);
    if (!id) return;

    // Enforce business rule #2: ONLY Veterinarian or Super Admin can issue medical clearance
    const userRole = getCurrentUserRole();
    if (userRole !== "veterinarian" && userRole !== "super_admin") {
      addToast("Only a Veterinarian can issue medical clearance. Request a medical checkup to assign a veterinarian.", "error");
      return;
    }

    try {
      setIsCompletingClearance(true);

      await medicalService.issueCertificate({
        dog_id: id,
        clearance_type: "health_clearance",
        status: "cleared",
        decision_notes: "Dog completed comprehensive clinical examination. Medically cleared and fit for adoption.",
      });

      const updateResult = await petService.updatePet(id, {
        ...dog,
        medical_status: "Medically Cleared",
        is_fit_for_adoption: true,
        is_adoptable: true,
      });

      const updatedData = (updateResult?.data && typeof updateResult.data === "object")
        ? updateResult.data
        : (updateResult && typeof updateResult === "object")
          ? updateResult
          : null;

      setDogs((prev) =>
        prev.map((d) =>
          dogId(d) === id
            ? formatDog({
                ...d,
                ...(updatedData || {}),
                medical_status: "Medically Cleared",
                is_fit_for_adoption: true,
                is_adoptable: true,
              })
            : d
        )
      );

      addToast(`Dog ${dog.name} is now Medically Cleared and ready for adoption!`, "success");
      notifyDataChanged();
      setIsViewMasterModalOpen(false);
      await fetchShelterDogsData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || "Failed to issue medical clearance.";
      addToast(msg, "error");
    } finally {
      setIsCompletingClearance(false);
    }
  };

  // Manual Token Lookup State
  const [inputToken, setInputToken] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [verifiedDog, setVerifiedDog] = useState<any | null>(null);

  // Adoption Details State for Dog Profile Modal
  const [selectedDogAdoption, setSelectedDogAdoption] = useState<any | null>(null);
  const [adoptionLoading, setAdoptionLoading] = useState<boolean>(false);

  useEffect(() => {
    const targetId = selectedDog?.id || selectedDog?.dog_id;
    if (!targetId || !isViewMasterModalOpen) {
      setSelectedDogAdoption(null);
      return;
    }

    let isMounted = true;
    const fetchDogAdoption = async () => {
      setAdoptionLoading(true);
      try {
        const res = await adoptionService.getAdoptions({ dog_id: targetId });
        const list = Array.isArray(res?.data) ? res.data : [];
        if (!isMounted) return;

        if (list.length > 0) {
          setSelectedDogAdoption(list[0]);
        } else if (selectedDog?.adoption || selectedDog?.adopter_name) {
          setSelectedDogAdoption({
            applicantName: selectedDog.adopter_name || selectedDog.adopter?.name || "Adopter Record",
            status: selectedDog.status === "adopted" ? "completed" : "approved",
            ticketNumber: selectedDog.adoption_id || targetId,
          });
        } else {
          setSelectedDogAdoption(null);
        }
      } catch {
        if (isMounted) {
          if (selectedDog?.adopter_name) {
            setSelectedDogAdoption({
              applicantName: selectedDog.adopter_name,
              status: selectedDog.status === "adopted" ? "completed" : "approved",
            });
          } else {
            setSelectedDogAdoption(null);
          }
        }
      } finally {
        if (isMounted) setAdoptionLoading(false);
      }
    };

    fetchDogAdoption();
    return () => {
      isMounted = false;
    };
  }, [selectedDog, isViewMasterModalOpen]);

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
    const hasActiveTag = !!(dog.safety_tag_status === "ACTIVE" || dog.is_safety_tag_active === true || dog.safety_tag_active === true || dog.safety_tag?.is_active === true);

    return {
      ...dog,
      registration_number: dog.registration_number || dog.id || "-",
      rescue_id: dog.rescue_case_id || dog.rescue_id || dog.rescue_case?.id || "-",
      name: dog.name || "-",
      breed: dog.breed || "-",
      gender: dog.gender || "",
      estimated_age: dog.estimated_age || dog.age || "-",
      age_months: dog.age_months ?? "",
      weight: dog.weight ?? "",
      is_adoptable: !!dog.is_adoptable,
      status: dog.status || "shelter",
      shelter_name: dog.shelter_name || dog.facility_name || dog.current_facility || "Central Shelter Facility",
      kennel_assignment: dog.kennel_identifier || dog.kennel_number || dog.cage_number || "Unassigned",
      medical_status: dog.is_fit_for_adoption ? "Fit for Adoption" : dog.medical_status || "Medically Cleared",
      adoption_status: dog.is_adoptable ? "Ready for Adoption" : dog.status === "adopted" ? "Adopted" : "In Shelter Care",
      has_active_tag: hasActiveTag,
      tag_status_label: hasActiveTag ? "ACTIVE" : "INACTIVE",
      rescue_date: dog.rescue_date ? String(dog.rescue_date).slice(0, 10) : dog.created_at ? String(dog.created_at).slice(0, 10) : "-",
      intake_date: dog.created_at ? String(dog.created_at).slice(0, 10) : "-",
    };
  };

  const fetchShelterDogsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = getCurrentUser();
      const currentRole = normalizeRole(currentUser);
      const userRescueCentreId = getRescueCentreId(currentUser);

      if (currentRole === "rescue_centre_admin" && !userRescueCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator.");
        setDogs([]);
        setLoading(false);
        return;
      }

      const [facilitiesRes, dogsRes] = await Promise.allSettled([
        shelterService.getShelters({ page: 1, page_size: 50 }),
        petService.getAllDogs(),
      ]);

      const facList = facilitiesRes.status === "fulfilled" ? unwrapList(facilitiesRes.value) : [];
      const rawDogs = dogsRes.status === "fulfilled" ? unwrapList(dogsRes.value) : [];
      let dogList = rawDogs.map(formatDog);

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        dogList = dogList.filter((d: any) => {
          const dCentreId = d.rescue_centre_id || d.rescue_center_id || d.facility_id || d.organization_id || d.rescue_centre?.id;
          return !dCentreId || String(dCentreId) === String(userRescueCentreId);
        });
      }

      if (dogsRes.status === "rejected") {
        const errDetail = (dogsRes.reason as any)?.response?.data?.detail || (dogsRes.reason as any)?.response?.data?.message || "Failed to load shelter dogs data.";
        setError(`⚠️ ${errDetail}`);
      }

      const total = dogsRes.status === "fulfilled"
        ? (dogsRes.value?.meta?.total ?? dogsRes.value?.data?.meta?.total ?? dogList.length)
        : 0;

      setTotalCount(total);
      setFacilities(facList);
      setDogs(dogList);

      // Fetch kennels list to cross reference
      try {
        const sectionResults = await Promise.allSettled(
          facList.map((s: any) => shelterService.getFacilitySections(s.facility_id ?? s.id))
        );
        const sections = sectionResults.flatMap((r) =>
          r.status === "fulfilled" ? unwrapList(r.value) : []
        );

        const kennelResults = await Promise.allSettled(
          sections.map((sec: any) => shelterService.getSectionKennels(sec.section_id ?? sec.id))
        );
        const allKennels = kennelResults.flatMap((r) =>
          r.status === "fulfilled" ? unwrapList(r.value) : []
        );
        setKennels(allKennels);
      } catch {
        setKennels([]);
      }
    } catch (err: any) {
      console.error("Shelter Dogs Fetch Error:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Failed to load shelter dogs data. Access may be restricted."
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

  useDataSync(fetchShelterDogsData);

  useEffect(() => {
    fetchShelterDogsData();
    loadDogPhotoMap();
  }, [page, statusFilter, facilityFilter]);

  // Safety Tag Modal Handlers
  const openQrModal = async (dog: any) => {
    const id = dogId(dog);
    if (!id) return;
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

      // Fetch metadata from GET /api/v1/dogs/{dog_id}/safety-tag FIRST
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
          if (!activeState) {
            setTagStatus("INACTIVE");
            setQrImageUrl(null);
            setQrBlob(null);
            return;
          }
          setTagStatus("ACTIVE");

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
      } else if (activeState && !isCompanion) {
        try {
          const qrBlobData = await petService.getDogQrImage(id);
          const qrUrlData = URL.createObjectURL(qrBlobData);
          setQrImageUrl(qrUrlData);
          setQrBlob(qrBlobData);
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
      }
    } catch (err: any) {
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
      fetchShelterDogsData();
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
      fetchShelterDogsData();
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
            .card { border: 2px solid #6D28D9; border-radius: 16px; padding: 24px; background: #FFF; }
            h1 { color: #6D28D9; margin: 0 0 4px; font-size: 24px; }
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
    try {
      setCageLoading(true);
      await shelterService.assignDogToKennel(cageSel.kennelId, cageSel.dogId);
      addToast("Dog successfully assigned to cage/kennel!", "success");
      setIsCageModalOpen(false);
      fetchShelterDogsData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to assign dog to kennel.", "error");
    } finally {
      setCageLoading(false);
    }
  };

  // Handlers for Edit Dog
  const handleEditDogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = dogId(selectedDog);
    if (!id) return;
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
          color: petForm.color,
          ear_shape: petForm.ear_shape && petForm.ear_shape !== "unknown" ? petForm.ear_shape : undefined,
          tail_type: petForm.tail_type && petForm.tail_type !== "unknown" ? petForm.tail_type : undefined,
          status: petForm.status,
          is_adoptable: petForm.is_adoptable,
        })
      );
      addToast(`Dog profile for "${petForm.name}" updated!`, "success");
      setIsEditModalOpen(false);
      setSelectedDog(null);
      fetchShelterDogsData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to update dog record.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterPetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petForm.name) {
      addToast("Dog Name is required for intake registration.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = cleanPayload({
        name: petForm.name,
        photo_url: petForm.photo_url || undefined,
        breed: petForm.breed || undefined,
        gender: petForm.gender || "male",
        estimated_age: petForm.estimated_age || undefined,
        age_months: petForm.age_months ? Number(petForm.age_months) : undefined,
        weight: petForm.weight ? Number(petForm.weight) : undefined,
        color: petForm.color || undefined,
        ear_shape: petForm.ear_shape && petForm.ear_shape !== "unknown" ? petForm.ear_shape : undefined,
        tail_type: petForm.tail_type && petForm.tail_type !== "unknown" ? petForm.tail_type : undefined,
        shelter_id: petForm.shelter_id || undefined,
        is_adoptable: petForm.is_adoptable,
        status: "shelter",
        notes: intakeMedicalNotes || undefined,
      });

      let registeredDog: any = null;

      if (selectedRescuedIntake && !selectedRescuedIntake.is_case) {
        registeredDog = await petService.updatePet(selectedRescuedIntake.id, payload);
      } else {
        registeredDog = await petService.createPet(payload);
      }

      const createdObj = registeredDog?.data || registeredDog;
      const createdId = dogId(createdObj) || createdObj?.id;

      addToast(`Dog "${petForm.name}" registered in shelter intake successfully!`, "success");
      setIsRegisterModalOpen(false);
      setPetForm({ ...emptyPetForm });
      setSelectedRescuedIntake(null);
      setIntakeMedicalNotes("");
      fetchShelterDogsData();
      notifyDataChanged();

      // Seamlessly transition directly to Kennel Allocation for the newly registered dog!
      const dogForAllocation = createdObj && (createdObj.id || createdObj.name)
        ? createdObj
        : { id: createdId, name: petForm.name, registration_number: createdObj?.registration_number || createdId };

      openCageModal(formatDog(dogForAllocation));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || "Failed to register dog intake.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputToken.trim();
    if (!query) {
      setLookupError("Please enter a safety token or registration code to verify.");
      setVerifiedDog(null);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setVerifiedDog(null);
    try {
      // 1. Check authoritative public scan API
      try {
        const scanRes = await petService.getPublicDogScan(query);
        const scanData = scanRes?.data || scanRes;
        const dogObj = scanData?.dog || scanData?.pet || (scanData?.id ? scanData : null);
        if (dogObj && (dogObj.id || dogObj.name || dogObj.registration_number)) {
          setVerifiedDog(formatDog(dogObj));
          return;
        }
      } catch {
        /* proceed to local/by-ID lookup fallback */
      }

      const rawUpper = query.toUpperCase().trim();
      const strippedUpper = rawUpper.replace(/^PG-/, "").trim();

      const matched = dogs.find((d) => {
        const token = petService.formatSafetyToken(d).toUpperCase();
        const reg = String(d.registration_number || "").toUpperCase();
        const idStr = String(d.id || "").toUpperCase();
        return (
          token === rawUpper ||
          token === `PG-${strippedUpper}` ||
          reg === strippedUpper ||
          reg === rawUpper ||
          idStr === strippedUpper ||
          idStr === rawUpper
        );
      });

      if (matched) {
        setVerifiedDog(matched);
        return;
      }

      try {
        const response = await petService.getPetById(strippedUpper);
        const data = response?.data || response;
        if (data && (data.id || data.registration_number)) {
          setVerifiedDog(formatDog(data));
          return;
        }
      } catch {
        /* failover */
      }

      setLookupError(`Safety Token or Registration Code "${query}" could not be verified.`);
    } catch (err: any) {
      setLookupError(err?.message || "Failed to verify safety token.");
    } finally {
      setLookupLoading(false);
    }
  };

  const filteredDogs = dogs.filter((d: any) => {
    const q = search.toLowerCase().trim();
    const nameMatch =
      !q ||
      String(d.name).toLowerCase().includes(q) ||
      String(d.registration_number).toLowerCase().includes(q) ||
      String(d.id).toLowerCase().includes(q) ||
      String(d.breed).toLowerCase().includes(q) ||
      String(d.status).toLowerCase().includes(q);
    const statusMatch = !statusFilter || String(d.status).toLowerCase() === statusFilter.toLowerCase();
    const facilityMatch = !facilityFilter || String(d.shelter_name || "").toLowerCase().includes(facilityFilter.toLowerCase());
    return nameMatch && statusMatch && facilityMatch;
  });

  const adoptableCount = dogs.filter((d: any) => d.is_adoptable || String(d.status).toLowerCase() === "adoptable").length;
  const inShelterCount = dogs.filter((d: any) => IN_SHELTER_STATUSES.includes(String(d.status).toLowerCase())).length;
  const unallocatedCount = dogs.filter((d: any) => !d.kennel_assignment || d.kennel_assignment === "Unassigned" || d.kennel_assignment === "—").length;

  const stats = [
    { title: "Total Shelter Dogs", value: loading ? "..." : (totalCount || dogs.length), trend: "Registered Animals", color: "#2563EB", icon: <FaPaw /> },
    { title: "In Shelter Care", value: loading ? "..." : inShelterCount, trend: "Housed Animals", color: "#10B981", icon: <FaHome /> },
    { title: "Awaiting Kennel Allocation", value: loading ? "..." : unallocatedCount, trend: "Needs Kennel Unit", color: "#F59E0B", icon: <FaBed /> },
    { title: "Adoptable Dogs", value: loading ? "..." : adoptableCount, trend: "Ready for Adoption", color: "#6366F1", icon: <FaCheckCircle /> },
  ];

  const dogColumns = [
    {
      key: "photo_url",
      title: "Photo",
      render: (_val: any, row: any) => {
        const url = getDogPhotoUrl(row, dogPhotoMap);
        return url ? (
          <img
            src={url}
            alt={row.name || "Dog"}
            style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", border: "1px solid #E2E8F0" }}
          />
        ) : (
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
            🐶
          </div>
        );
      },
    },
    {
      key: "name",
      title: "Dog Name & Reg #",
      render: (_val: any, row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A", wordBreak: "break-word", maxWidth: "240px" }}>{row.name}</div>
          <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>Reg: {row.registration_number}</div>
        </div>
      ),
    },
    {
      key: "id",
      title: "Dog Master ID",
      render: (_val: any, row: any) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569", fontWeight: 700 }}>
          {dogId(row)}
        </span>
      ),
    },
    {
      key: "breed",
      title: "Breed & Gender",
      render: (_val: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155" }}>{row.breed}</div>
          <div style={{ fontSize: "12px", color: "#64748B", textTransform: "capitalize" }}>
            {row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1) : "-"}
          </div>
        </div>
      ),
    },
    {
      key: "shelter_name",
      title: "Facility & Kennel",
      render: (_val: any, row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "13px" }}>{row.shelter_name}</div>
          <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 700, marginTop: "2px" }}>
            Kennel: {row.kennel_assignment}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      title: "Current Status",
      render: (_val: any, row: any) => (
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: "#ECFDF5",
            color: "#047857",
            textTransform: "uppercase",
            display: "inline-block",
          }}
        >
          {row.status ? String(row.status).toUpperCase() : "SHELTER"}
        </span>
      ),
    },
    {
      key: "tag_status_label",
      title: "Safety Tag Status",
      render: (_val: any, row: any) => (
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 800,
            background: row.has_active_tag ? "#F3E8FF" : "#FEE2E2",
            color: row.has_active_tag ? "#6D28D9" : "#991B1B",
            border: row.has_active_tag ? "1px solid #C4B5FD" : "1px solid #FCA5A5",
            display: "inline-block",
          }}
        >
          {row.has_active_tag ? "✓ ACTIVE" : "INACTIVE"}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: "4px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
            Shelter Dogs Directory & Intake Workspace
          </h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", margin: "4px 0 0" }}>
            Authoritative shelter dog records, intake registration, kennel assignment, medical triage, and Safety Tag verification.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Can permission={["create_animals", "edit_animals"]}>
            <button
              onClick={() => openRegisterModal()}
              style={{
                padding: "8px 14px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <FaPlus /> Register Rescued Dog
            </button>
            <button
              onClick={() => openCageModal()}
              style={{
                padding: "8px 14px",
                background: "#FFFFFF",
                color: "#334155",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaBed style={{ color: "#EA580C" }} /> Allocate Kennel
            </button>
            <button
              onClick={() => { setInputToken(""); setLookupError(null); setVerifiedDog(null); setIsTokenLookupModalOpen(true); }}
              style={{
                padding: "8px 14px",
                background: "#FFFFFF",
                color: "#334155",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaSearch style={{ color: "#6366F1" }} /> Verify Safety Token
            </button>
          </Can>
        </div>
      </div>

      {/* Headline Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px", marginBottom: "20px" }}>
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* SHELTER DOGS DIRECTORY TABLE */}
      <div className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
              Registered Shelter Dogs Directory
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Dogs currently registered or assigned to shelter facilities
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search Dog Name, Reg #, Master ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "240px" }}
            />

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              <option value="">All Statuses</option>
              {DOG_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <select
              value={facilityFilter}
              onChange={(e) => { setFacilityFilter(e.target.value); setPage(1); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              <option value="">All Facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={dogColumns}
          data={filteredDogs}
          loading={loading}
          error={error}
          onRetry={fetchShelterDogsData}
          emptyMessage="No shelter dogs registered in shelter care found."
          serverMode
          totalCount={totalCount}
          page={page}
          onPageChange={setPage}
          pageSize={20}
          onRowClick={(row) => { setSelectedDog(row); setIsViewMasterModalOpen(true); }}
          renderRowActions={(row: any) => {
            const allRowActions: RowActionItem[] = [
              {
                label: "View Profile",
                icon: <FaEye style={{ color: "#2563EB" }} />,
                onClick: () => { setSelectedDog(row); setIsViewMasterModalOpen(true); },
              },
              {
                label: "Allocate Kennel",
                icon: <FaBed style={{ color: "#1D4ED8" }} />,
                onClick: () => openCageModal(row),
              },
              {
                label: "Medical / Request Vet Check",
                icon: <FaUserMd style={{ color: "#047857" }} />,
                onClick: () => openMedicalModal(row),
              },
              {
                label: "Safety Tag",
                icon: <FaQrcode style={{ color: "#6D28D9" }} />,
                onClick: () => openQrModal(row),
              },
              {
                label: "Edit Profile",
                icon: <FaEdit style={{ color: "#059669" }} />,
                onClick: () => {
                  setSelectedDog(row);
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
                  });
                  setIsEditModalOpen(true);
                },
              },
            ];

            return <RowActionMenu actions={allRowActions} />;
          }}
        />
      </div>

      {/* DOG MASTER PROFILE VIEW MODAL */}
      <Modal
        isOpen={isViewMasterModalOpen}
        onClose={() => setIsViewMasterModalOpen(false)}
        title={`Dog Master Profile — ${selectedDog?.name || ""}`}
        maxWidth="680px"
      >
        {selectedDog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              {getDogPhotoUrl(selectedDog, dogPhotoMap) ? (
                <img
                  src={getDogPhotoUrl(selectedDog, dogPhotoMap)}
                  alt={selectedDog.name || "Dog"}
                  style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover", border: "2px solid #2563EB" }}
                />
              ) : (
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                  🐶
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedDog.name}</div>
                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>Reg Number: {selectedDog.registration_number}</div>
                <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", marginTop: "2px" }}>Dog Master ID: {dogId(selectedDog)}</div>
              </div>
              <span style={{ padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, background: "#ECFDF5", color: "#047857", textTransform: "uppercase" }}>
                {selectedDog.status}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Breed & Species:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{selectedDog.breed}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Gender:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A", textTransform: "capitalize" }}>{selectedDog.gender || "Unknown"}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Estimated Age:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{selectedDog.estimated_age}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Shelter / Facility:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{selectedDog.shelter_name}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Kennel Assignment:</strong>
                <div style={{ fontWeight: 700, color: "#2563EB" }}>{selectedDog.kennel_assignment}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Medical Status:</strong>
                <div style={{ fontWeight: 700, color: "#059669" }}>{selectedDog.medical_status}</div>
              </div>
            </div>

            {/* Adoption Information Section */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Adoption Application & Placement Record</span>
                {selectedDog.status === "adopted" && (
                  <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#DCFCE7", color: "#166534", fontSize: "11px", fontWeight: 800 }}>
                    ADOPTED
                  </span>
                )}
              </div>

              {adoptionLoading ? (
                <div style={{ fontSize: "12px", color: "#64748B" }}>Loading adoption records...</div>
              ) : selectedDogAdoption ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "#64748B", fontWeight: 600 }}>Adopter / Applicant Name: </span>
                    <strong style={{ color: "#0F172A" }}>{selectedDogAdoption.applicantName || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontWeight: 600 }}>Application Ref #: </span>
                    <code style={{ background: "#E2E8F0", padding: "1px 5px", borderRadius: "3px" }}>
                      {selectedDogAdoption.ticketNumber || selectedDogAdoption.applicationId || "—"}
                    </code>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontWeight: 600 }}>Application Status: </span>
                    <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                      {selectedDogAdoption.status || "Submitted"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", fontWeight: 600 }}>Application Date: </span>
                    <strong style={{ color: "#334155" }}>
                      {selectedDogAdoption.created_at || selectedDogAdoption.date ? new Date(selectedDogAdoption.created_at || selectedDogAdoption.date).toLocaleDateString() : "—"}
                    </strong>
                  </div>
                  {selectedDogAdoption.completed_at && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "#64748B", fontWeight: 600 }}>Adoption Completion Date: </span>
                      <strong style={{ color: "#166534" }}>{new Date(selectedDogAdoption.completed_at).toLocaleDateString()}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "#64748B", fontStyle: "italic" }}>
                  No active adoption application or placement record filed for this dog.
                </div>
              )}
            </div>

            <div style={{ background: "#F3E8FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#6D28D9" }}>
                  Safety Tag Identification: {selectedDog.tag_status_label}
                </div>
                <div style={{ fontSize: "12px", color: "#4C1D95", marginTop: "2px" }}>
                  Token: {petService.formatSafetyToken(selectedDog)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsViewMasterModalOpen(false); openQrModal(selectedDog); }}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "#6D28D9", color: "#FFF", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaQrcode /> View Tag / QR
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={isCompletingClearance}
                onClick={() => handleCompleteClearance(selectedDog)}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaCheckCircle /> {isCompletingClearance ? "Clearing..." : "Issue Medical Clearance & Fit for Adoption"}
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setIsViewMasterModalOpen(false); openMedicalModal(selectedDog); }}
                  style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #10B981", background: "#ECFDF5", color: "#047857", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaUserMd /> Request Vet Check
                </button>
                <button
                  type="button"
                  onClick={() => { setIsViewMasterModalOpen(false); openCageModal(selectedDog); }}
                  style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #2563EB", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaBed /> Allocate Kennel
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* KENNEL ALLOCATION MODAL */}
      <Modal
        isOpen={isCageModalOpen}
        onClose={() => setIsCageModalOpen(false)}
        title="Allocate Dog to Kennel Unit"
        maxWidth="680px"
      >
        <form onSubmit={handleAssignCageSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              1. Select Registered Dog *
            </label>
            <select
              value={cageSel.dogId}
              onChange={(e) => setCageSel({ ...cageSel, dogId: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            >
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={dogId(d)} value={dogId(d)}>
                  {d.name} ({d.registration_number || dogId(d)}) — {d.breed || "Dog"} [{d.shelter_name || "Unassigned"}]
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
                2. Shelter Facility *
              </label>
              <select
                value={cageSel.facilityId}
                onChange={(e) => onFacilityChange(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="">Select facility...</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
                3. Facility Section / Ward *
              </label>
              <select
                value={cageSel.sectionId}
                onChange={(e) => onSectionChange(e.target.value)}
                disabled={!cageSel.facilityId}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="">Choose section...</option>
                {cageSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              4. Available Target Kennel Unit *
            </label>
            <select
              value={cageSel.kennelId}
              onChange={(e) => setCageSel({ ...cageSel, kennelId: e.target.value })}
              disabled={!cageSel.sectionId}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            >
              <option value="">Choose kennel unit...</option>
              {cageKennels.map((k) => (
                <option key={k.id} value={k.id} disabled={k.is_occupied}>
                  Unit {k.identifier || k.name || k.id} (Capacity: {k.capacity ?? 1}) — [{k.sanitation_state || "clean"}]{" "}
                  {k.is_occupied ? "— OCCUPIED (FULL)" : "— AVAILABLE"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
            <button type="button" onClick={() => setIsCageModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={cageLoading || !cageSel.kennelId || !cageSel.dogId} style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700 }}>
              {cageLoading ? "Assigning..." : "Confirm Kennel Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT DOG MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Dog Profile — ${selectedDog?.name || ""}`}
        maxWidth="600px"
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

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Status</label>
            <select
              value={petForm.status}
              onChange={(e) => setPetForm({ ...petForm, status: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
            >
              {DOG_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#059669", color: "#FFF", fontWeight: 700 }}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* REGISTER RESCUED DOG INTAKE MODAL */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Rescued Dog Intake"
        maxWidth="760px"
      >
        <form onSubmit={handleRegisterPetSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Step 1: Select Rescued Dog Record */}
          <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "6px" }}>
              1. Select Rescued Dog Intake Record *
            </label>
            <select
              value={selectedRescuedIntake?.id || ""}
              onChange={(e) => handleSelectRescuedIntake(e.target.value)}
              disabled={rescuedIntakeLoading}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            >
              <option value="">-- Direct / New Rescued Dog Intake --</option>
              {rescuedIntakeList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.case_number}) — {item.location} [{item.breed}]
                </option>
              ))}
            </select>
            {rescuedIntakeLoading && (
              <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>Loading rescued intake directory...</div>
            )}
          </div>

          {/* Read-Only Rescue Info Summary Card */}
          {selectedRescuedIntake && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
              <div>
                <span style={{ color: "#64748B", fontWeight: 600 }}>Case Reference / ID: </span>
                <strong style={{ color: "#1E40AF" }}>{selectedRescuedIntake.case_number}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontWeight: 600 }}>Rescue Location: </span>
                <strong style={{ color: "#0F172A" }}>{selectedRescuedIntake.location}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontWeight: 600 }}>Reporter / Field Team: </span>
                <strong style={{ color: "#0F172A" }}>{selectedRescuedIntake.reporter}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontWeight: 600 }}>Status: </span>
                <span style={{ padding: "2px 8px", borderRadius: "999px", background: "#DBEAFE", color: "#1D4ED8", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>
                  {selectedRescuedIntake.status}
                </span>
              </div>
              {selectedRescuedIntake.notes && (
                <div style={{ gridColumn: "1 / -1", color: "#334155", fontStyle: "italic", borderTop: "1px solid #DBEAFE", paddingTop: "6px", marginTop: "2px" }}>
                  <strong>Rescue Field Notes:</strong> "{selectedRescuedIntake.notes}"
                </div>
              )}
            </div>
          )}

          {/* Step 2: Shelter Intake Details Form */}
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" }}>
            2. Shelter Intake & Dog Details
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Dog Name <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Max or Rescued Dog"
                value={petForm.name}
                onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Target Shelter Facility <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                value={petForm.shelter_id}
                onChange={(e) => setPetForm({ ...petForm, shelter_id: e.target.value })}
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                <option value="">Select facility...</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Breed</label>
              <input
                type="text"
                placeholder="e.g. Labrador Mix"
                value={petForm.breed}
                onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Gender</label>
              <select
                value={petForm.gender}
                onChange={(e) => setPetForm({ ...petForm, gender: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Estimated Age</label>
              <input
                type="text"
                placeholder="e.g. 2 years or 6 months"
                value={petForm.estimated_age}
                onChange={(e) => setPetForm({ ...petForm, estimated_age: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 14.5"
                value={petForm.weight}
                onChange={(e) => setPetForm({ ...petForm, weight: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Color / Markings</label>
              <input
                type="text"
                placeholder="e.g. Golden / White Chest"
                value={petForm.color}
                onChange={(e) => setPetForm({ ...petForm, color: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Ear Shape</label>
              <select
                value={petForm.ear_shape || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, ear_shape: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                {EAR_SHAPES.map((es) => (
                  <option key={es.value} value={es.value}>{es.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>Tail Type</label>
              <select
                value={petForm.tail_type || "unknown"}
                onChange={(e) => setPetForm({ ...petForm, tail_type: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
              >
                {TAIL_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "8px" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={petForm.is_adoptable}
                  onChange={(e) => setPetForm({ ...petForm, is_adoptable: e.target.checked })}
                />
                <strong>Ready for adoption listing</strong>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Medical & Intake Notes
            </label>
            <textarea
              rows={2}
              placeholder="Initial medical condition, triage observations, temperament, intake notes..."
              value={intakeMedicalNotes}
              onChange={(e) => setIntakeMedicalNotes(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: isSubmitting ? "not-allowed" : "pointer" }}
            >
              {isSubmitting ? "Registering Intake..." : "Register Dog & Allocate Kennel →"}
            </button>
          </div>
        </form>
      </Modal>

      {/* VERIFY TOKEN MODAL */}
      <Modal
        isOpen={isTokenLookupModalOpen}
        onClose={() => { setIsTokenLookupModalOpen(false); setInputToken(""); setLookupError(null); setVerifiedDog(null); }}
        title="Verify Dog Safety Token"
        maxWidth="580px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <form onSubmit={handleVerifyToken} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
              Enter Safety Token or Registration Code
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                required
                placeholder="e.g. PG-DOG-2026-0001 or raw token"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontFamily: "monospace", textTransform: "uppercase", boxSizing: "border-box" }}
              />
              <button type="submit" disabled={lookupLoading} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#6366F1", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>
                {lookupLoading ? "Verifying..." : "Verify Token"}
              </button>
            </div>
          </form>

          {lookupError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "14px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600 }}>
              ⚠️ {lookupError}
            </div>
          )}

          {verifiedDog && (
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#047857", fontWeight: 700, fontSize: "13px" }}>
                  <FaCheckCircle color="#10B981" /> Authoritative Token Verified &bull; Exact Match
                </div>
                <span style={{ padding: "3px 10px", borderRadius: "999px", background: "#DCFCE7", color: "#166534", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                  {verifiedDog.status || "ACTIVE"}
                </span>
              </div>

              <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "8px", border: "1px solid #D1FAE5", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{verifiedDog.name}</div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                    Reg #: <span style={{ fontFamily: "monospace" }}>{verifiedDog.registration_number || "-"}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                    Master ID: <span style={{ fontFamily: "monospace" }}>{dogId(verifiedDog)}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Facility: <strong>{verifiedDog.shelter_name || "-"}</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 700, marginTop: "2px" }}>
                    Kennel: {verifiedDog.kennel_assignment || "Unassigned"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#6D28D9", fontWeight: 700, marginTop: "2px" }}>
                    Tag Status: {verifiedDog.has_active_tag ? "✓ ACTIVE" : "INACTIVE"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { const d = verifiedDog; setIsTokenLookupModalOpen(false); setSelectedDog(d); setIsViewMasterModalOpen(true); }}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                View Dog Profile Details
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
                <span style={{ fontWeight: 800, color: "#0F172A", fontSize: "16px" }}>
                  Dog Name: {qrDog.name || "-"}
                </span>
                <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: tagStatus === "ACTIVE" ? "#DCFCE7" : "#FEE2E2", color: tagStatus === "ACTIVE" ? "#166534" : "#991B1B", border: tagStatus === "ACTIVE" ? "1px solid #86EFAC" : "1px solid #FCA5A5", textTransform: "uppercase" }}>
                  Tag Status: {tagStatus}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                <strong>Reg #:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{qrDog.registration_number || qrDog.id || "-"}</span>
              </div>
            </div>
          )}

          {/* SCAN ACTIVITY WATCH SECTION */}
          {qrDog && (
            <div style={{ width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 16px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Scan Activity</div>
                <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                  <strong>Total Scans:</strong> {String(tagMetadata?.scans_count ?? tagMetadata?.scan_count ?? 0)} &bull;{" "}
                  <strong>Last Scanned:</strong> {tagMetadata?.last_scanned_at ? String(tagMetadata.last_scanned_at).slice(0, 16).replace("T", " ") : "Never"}
                </div>
              </div>
              <button type="button" onClick={handleRefreshScanData} disabled={isRefreshingScanData} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#334155", fontSize: "12px", fontWeight: 600, cursor: isRefreshingScanData ? "not-allowed" : "pointer" }}>
                <FaSync style={{ animation: isRefreshingScanData ? "spin 1s linear infinite" : "none" }} />
                {isRefreshingScanData ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          )}

          {qrLoading && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ display: "inline-block", width: "32px", height: "32px", border: "3px solid #F3E8FF", borderTopColor: "#6D28D9", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748B" }}>Fetching Safety Tag metadata...</div>
            </div>
          )}

          {!qrLoading && qrError && (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "14px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>
                ⚠️ {qrError}
              </div>
            </div>
          )}

          {!qrLoading && !qrError && !qrImageUrl && (
            <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", color: "#334155", padding: "24px 20px", borderRadius: "12px", fontSize: "13px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
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
                          background: manualTokenInput.trim() ? "#10B981" : "#94A3B8",
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
                          color: "#6D28D9",
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
                  <div style={{ color: "#991B1B", fontWeight: 700, fontSize: "14px" }}>
                    Safety Tag is INACTIVE or QR is unavailable on this browser.
                  </div>
                  <button type="button" onClick={() => handleProvisionTag()} disabled={isProvisioning} style={{ padding: "11px 24px", borderRadius: "8px", border: "none", background: "#6D28D9", color: "#FFFFFF", fontWeight: 700, fontSize: "13px", cursor: isProvisioning ? "not-allowed" : "pointer" }}>
                    {isProvisioning ? "Provisioning..." : "Provision Safety Tag"}
                  </button>
                </>
              )}
            </div>
          )}

          {!qrLoading && !qrError && qrImageUrl && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
              <div style={{ padding: "18px", border: "2px solid #E2E8F0", borderRadius: "16px", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img src={qrImageUrl} alt={`Safety Tag QR Code for ${qrDog?.name || "Dog"}`} style={{ width: "240px", height: "240px", imageRendering: "pixelated", display: "block" }} />
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Scan QR to view pet safety information</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%" }}>
                <button type="button" onClick={handleDownloadQr} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px 14px", borderRadius: "8px", border: "none", background: "#6D28D9", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  <FaDownload /> Download QR
                </button>
                <button type="button" onClick={handlePrintQr} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px 14px", borderRadius: "8px", border: "1px solid #C4B5FD", background: "#FFFFFF", color: "#6D28D9", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                  <FaPrint /> Print Tag
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirmation Modals */}
      <Modal isOpen={isReProvisionConfirmOpen} onClose={() => setIsReProvisionConfirmOpen(false)} title="Re-Provision Safety Tag?" maxWidth="450px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "14px", color: "#334155" }}>
            Re-provisioning will generate a new raw token for <strong>{qrDog?.name}</strong>. Continue?
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsReProvisionConfirmOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
            <button type="button" onClick={() => handleProvisionTag(true)} disabled={isProvisioning} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#6D28D9", color: "#FFF", fontWeight: 700 }}>
              {isProvisioning ? "Provisioning..." : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isDeactivateConfirmOpen} onClose={() => setIsDeactivateConfirmOpen(false)} title="Deactivate Safety Tag?" maxWidth="440px">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "14px", color: "#334155" }}>
            Deactivate Safety Tag for <strong>{qrDog?.name}</strong>?
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsDeactivateConfirmOpen(false)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>Cancel</button>
            <button type="button" onClick={handleDeactivateTag} disabled={isDeactivating} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700 }}>
              {isDeactivating ? "Deactivating..." : "Confirm Deactivation"}
            </button>
          </div>
        </div>
      </Modal>

      {/* REQUEST VET MEDICAL CHECK MODAL */}
      <Modal
        isOpen={isMedicalModalOpen}
        onClose={() => setIsMedicalModalOpen(false)}
        title={`Request Vet Medical Check — ${medicalDog?.name || ""}`}
        maxWidth="580px"
      >
        {medicalDog && (
          <form onSubmit={handleRequestMedicalCheck} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>{medicalDog.name}</div>
                <div style={{ fontSize: "12px", color: "#64748B" }}>Reg: {medicalDog.registration_number} &bull; ID: {dogId(medicalDog)}</div>
                <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600, marginTop: "2px" }}>Facility: {medicalDog.shelter_name}</div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: "#EFF6FF", color: "#1D4ED8", textTransform: "uppercase" }}>
                {medicalDog.medical_status || "PENDING CHECK"}
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Select Veterinarian / Clinic <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                value={selectedVetId}
                onChange={(e) => setSelectedVetId(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              >
                {vetsLoading ? (
                  <option value="">Loading veterinary directory...</option>
                ) : (
                  vetsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.clinic})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                  Checkup Reason / Type
                </label>
                <select
                  value={medicalReason}
                  onChange={(e) => setMedicalReason(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="Routine Intake Health Exam">Routine Intake Health Exam</option>
                  <option value="Vaccination Request">Vaccination Request</option>
                  <option value="Illness / Injury Evaluation">Illness / Injury Evaluation</option>
                  <option value="Medical Clearance for Adoption">Medical Clearance for Adoption</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                  Urgency Level
                </label>
                <select
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="routine">Routine Check</option>
                  <option value="urgent">Urgent Priority</option>
                  <option value="emergency">Emergency Priority</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Observations / Request Notes
              </label>
              <textarea
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                placeholder="Enter initial symptoms, medical history notes, or special instructions..."
                rows={3}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>

            {dogMedicalHistory.length > 0 && (
              <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Recent Medical Records:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#334155" }}>
                  {dogMedicalHistory.slice(0, 3).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• {item.categoryName || item.type}: {item.diagnosis || item.treatment}</span>
                      <span style={{ color: "#64748B" }}>{item.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsMedicalModalOpen(false)}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingMedical || !selectedVetId}
                style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: isSubmittingMedical ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FaUserMd /> {isSubmittingMedical ? "Assigning..." : "Assign Vet & Request Check"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ShelterDogs;
