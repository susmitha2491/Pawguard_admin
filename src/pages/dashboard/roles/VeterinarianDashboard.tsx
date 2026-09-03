import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import StatCard from "../../../components/dashboard/StatCard";
import DataTable from "../../../components/common/DataTable";
import QuickActionCard from "../../../components/dashboard/QuickActionCard";
import Modal from "../../../components/common/Modal";
import { useToast } from "../../../context/ToastContext";
import {
  FaStethoscope,
  FaSyringe,
  FaFileMedical,
  FaExclamationCircle,
  FaCalendarAlt,
  FaCheck,
  FaBan,
  FaSearch,
  FaUserMd,
  FaHeartbeat,
  FaEye,
  FaCheckCircle,
  FaHome,
} from "react-icons/fa";
import vetService from "../../../services/vetService";
import medicalService from "../../../services/medicalService";
import petService from "../../../services/petService";
import userService from "../../../services/userService";
import dashboardService from "../../../services/dashboardService";
import storageService from "../../../services/storageService";
import { useDataSync, notifyDataChanged } from "../../../utils/dataSync";
import api from "../../../api/axios";

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const pick = (row: Row, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

import { formatDateTime } from "../../../utils/dateUtils";

const formatDate = (v: unknown): string => formatDateTime(v as string);

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: "3px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 800,
  display: "inline-block",
  textTransform: "uppercase",
});

const emptyConsultationForm = {
  chiefComplaint: "",
  diagnosis: "",
  bcs: 5,
  visibleInjuries: "",
  treatmentType: "",
  treatmentDesc: "",
  anesthesiaLog: "",
  postOpNotes: "",
  vaccineName: "",
  lotNumber: "",
  nextDueAt: "",
  drugName: "",
  dosage: "As directed",
  route: "Oral",
  drugDurationDays: 7,
  followUpDate: "",
  followUpReason: "",
  vetNotes: "",
  attachmentUrl: "",
};

const VeterinarianDashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [appointments, setAppointments] = useState<Row[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<Row[]>([]);
  const [dogs, setDogs] = useState<Row[]>([]);
  const [clinics, setClinics] = useState<Row[]>([]);
  const [vetSummary, setVetSummary] = useState<Row | null>(null);
  const [selectedPublicAppt, setSelectedPublicAppt] = useState<Row | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [shelterMedicalStatusFilter, setShelterMedicalStatusFilter] = useState("all");
  const [shelterAdoptionFilter, setShelterAdoptionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [searchParams] = useSearchParams();
  const highlightDogId = searchParams.get("dog_id");
  const tabParam = searchParams.get("tab");
  const [activeSourceTab, setActiveSourceTab] = useState<"shelter_requests" | "public_appts">(
    tabParam === "public_appts" ? "public_appts" : "shelter_requests"
  );

  // Dog Master Profile Modal State
  const [selectedDogMaster, setSelectedDogMaster] = useState<Row | null>(null);
  const [isDogProfileOpen, setIsDogProfileOpen] = useState(false);
  const [isClearingAdoption, setIsClearingAdoption] = useState(false);

  useEffect(() => {
    if (highlightDogId) {
      setSearchQuery(highlightDogId);
      if (tabParam) {
        setActiveSourceTab(tabParam === "public_appts" ? "public_appts" : "shelter_requests");
      }
    }
  }, [highlightDogId, tabParam]);

  const handleOpenDogProfile = async (dog: Row) => {
    setSelectedDogMaster(dog);
    setIsDogProfileOpen(true);
    const pId = str(pick(dog, "id", "dog_id"));
    if (pId) {
      try {
        setHistoryLoading(true);
        const historyRes = await medicalService.getMedicalHistory(pId);
        setPetHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      } catch {
        setPetHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const handleIssueMedicalClearance = async (dog: Row) => {
    const id = str(pick(dog, "id", "dog_id"));
    if (!id) return;

    // 1. Check if clearance is already approved on backend
    try {
      const existingClearances = await medicalService.getDogClearances(id);
      const isApprovedOnBackend = Array.isArray(existingClearances) && existingClearances.some(
        (c: any) => String(c.status).toLowerCase() === "approved" || String(c.status).toLowerCase() === "cleared"
      );
      if (isApprovedOnBackend || Boolean(dog.is_fit_for_adoption || dog.is_adoptable)) {
        addToast(`Dog ${str(dog.name || id)} is already medically cleared and fit for adoption.`, "info");
        return;
      }
    } catch {
      /* ignore lookup error */
    }

    // 2. Check if clinical examination has been completed (in local state or backend history)
    const currentMedStatus = str(dog.medical_status).toLowerCase();
    let isExamDone = currentMedStatus.includes("exam") || currentMedStatus.includes("consult") || currentMedStatus.includes("fit");

    if (!isExamDone) {
      try {
        const historyRes = await medicalService.getMedicalHistory(id);
        const historyList = Array.isArray(historyRes?.data) ? historyRes.data : [];
        if (historyList.length > 0) {
          isExamDone = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (!isExamDone) {
      addToast("Medical examination/consultation must be performed before issuing medical clearance.", "info");
      handleOpenConsultation({ pet_id: id, reason: dog.medical_status || "Shelter Medical Exam" });
      return;
    }

    try {
      setIsClearingAdoption(true);

      // 3. Issue Medical Clearance via POST /api/v1/medical/clearance/{dog_id}
      await medicalService.issueCertificate({
        dog_id: id,
        clearance_type: "adoption_surgery",
        status: "approved",
        decision_notes: "Healthy, cleared for adoption.",
      });

      // 4. Verify clearance from backend GET /api/v1/medical/clearances/dogs/{dog_id}
      await medicalService.getDogClearances(id).catch(() => []);

      // 5. Update local dog status in state from backend clearance
      setDogs((prevDogs) =>
        prevDogs.map((d) => {
          if (str(d.id || d.dog_id) === str(id)) {
            return {
              ...d,
              medical_status: "Medically Cleared",
              is_fit_for_adoption: true,
              is_adoptable: true,
              adoption_readiness: "READY_FOR_ADOPTION",
            };
          }
          return d;
        })
      );

      addToast(`Dog ${str(dog.name || id)} is now Medically Cleared & Ready for Adoption.`, "success");
      notifyDataChanged();
      setIsDogProfileOpen(false);

      // 6. Re-fetch fresh dashboard data from backend source of truth
      await fetchDashboardData();
    } catch (err: any) {
      let msg = "Failed to issue medical clearance.";
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          msg = data.detail.map((d: any) => `${d.loc ? d.loc.join(".") + ": " : ""}${d.msg}`).join("; ");
        } else if (typeof data.message === "string") {
          msg = data.message;
        }
      } else if (err?.message) {
        msg = err.message;
      }
      console.error("POST /medical/clearance Error:", err?.response?.status, err?.response?.data || err);
      addToast(msg, "error");
    } finally {
      setIsClearingAdoption(false);
    }
  };

  // Cancel Appointment Modal State
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Consultation Modal State
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [activeAppt, setActiveAppt] = useState<Row | null>(null);
  const [petHistory, setPetHistory] = useState<Row[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Consultation Form State
  const [consultationForm, setConsultationForm] = useState({ ...emptyConsultationForm });
  const [isSubmittingConsultation, setIsSubmittingConsultation] = useState(false);

  // Selected Recent Medical Record Detail Modal State
  const [selectedMedicalRecord, setSelectedMedicalRecord] = useState<Row | null>(null);

  // Selected Shelter Medical Request Detail Modal State
  const [selectedShelterRequest, setSelectedShelterRequest] = useState<Row | null>(null);

  // Optional Consultation Add-on Toggles
  const [showTreatmentSection, setShowTreatmentSection] = useState(false);
  const [showVaccineSection, setShowVaccineSection] = useState(false);
  const [showPrescriptionSection, setShowPrescriptionSection] = useState(false);
  const [showFollowupSection, setShowFollowupSection] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [showAttachmentSection, setShowAttachmentSection] = useState(false);

  // Explicit lookup Maps for deterministic O(1) resolution
  const [userMap, setUserMap] = useState<Map<string, Row>>(new Map());
  const [petMap, setPetMap] = useState<Map<string, Row>>(new Map());
  const [clinicMap, setClinicMap] = useState<Map<string, Row>>(new Map());

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [apptsRes, recordsRes, dogsRes, clinicsRes, dashSummaryRes] = await Promise.all([
        vetService.getAppointments({ page_size: 500 }).catch(() => ({ data: [] })),
        medicalService.getMedicalRecords().catch(() => ({ data: [] })),
        petService.getAllDogs().catch(() => ({ data: [] })),
        vetService.getClinics({ page_size: 100 }).catch(() => ({ data: [] })),
        dashboardService.getVeterinarianDashboard().catch(() => null),
      ]);

      const apptList = Array.isArray(apptsRes?.data) ? apptsRes.data : [];
      const recordList = Array.isArray(recordsRes?.data) ? recordsRes.data : [];
      const dogList = Array.isArray(dogsRes?.data) ? dogsRes.data : [];
      const clinicList = Array.isArray(clinicsRes?.data) ? clinicsRes.data : [];
      const summaryObj = (dashSummaryRes?.data ?? dashSummaryRes) as Row | null;

      setAppointments(apptList);
      setMedicalRecords(recordList);
      setDogs(dogList);
      setClinics(clinicList);
      setVetSummary(summaryObj);

      const cMap = new Map<string, Row>();
      clinicList.forEach((c: Row) => {
        const id = str(pick(c, "id", "clinic_id")).trim().toLowerCase();
        if (id) cMap.set(id, c);
      });
      setClinicMap(cMap);

      const pMap = new Map<string, Row>();
      dogList.forEach((d: Row) => {
        const id1 = str(pick(d, "id")).trim().toLowerCase();
        const id2 = str(pick(d, "dog_id")).trim().toLowerCase();
        const id3 = str(pick(d, "pet_id")).trim().toLowerCase();
        const id4 = str(pick(d, "original_dog_id")).trim().toLowerCase();
        const reg = str(pick(d, "registration_number")).trim().toLowerCase();
        if (id1) pMap.set(id1, d);
        if (id2) pMap.set(id2, d);
        if (id3) pMap.set(id3, d);
        if (id4) pMap.set(id4, d);
        if (reg) pMap.set(reg, d);
      });
      setPetMap(pMap);

      const ownerIds = new Set<string>();
      apptList.forEach((r: Row) => {
        const oId = str(pick(r, "owner_id", "user_id", "submitter_id", "client_id")).trim().toLowerCase();
        if (oId && isUuid(oId)) ownerIds.add(oId);
      });
      dogList.forEach((d: Row) => {
        const oId = str(pick(d, "owner_id", "user_id")).trim().toLowerCase();
        if (oId && isUuid(oId)) ownerIds.add(oId);
      });

      if (ownerIds.size > 0) {
        const newUsers = new Map<string, Row>();
        await Promise.all(
          Array.from(ownerIds).map(async (id) => {
            try {
              const summary = await userService.getUserSummary(id);
              if (summary && (summary.full_name || summary.name || summary.email)) {
                newUsers.set(id, summary);
              }
            } catch {
              /* ignore summary fetch error */
            }
          })
        );
        if (newUsers.size > 0) {
          setUserMap((prev) => {
            const merged = new Map(prev);
            newUsers.forEach((v, k) => merged.set(k, v));
            return merged;
          });
        }
      }
    } catch (err: any) {
      console.error("Veterinarian Dashboard Fetch Error:", err);
      setError("Failed to load veterinary station data. Access may be restricted.");
    } finally {
      setLoading(false);
    }
  }, []);

  useDataSync(fetchDashboardData);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const isUuid = (v: unknown): boolean =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

  const formatApptId = (v: unknown, r?: Row): string => {
    const code = pick(r || {}, "reference_code", "appointment_number", "code");
    if (code && !isUuid(code)) return str(code);
    const rawId = str(v || (r ? pick(r, "appointment_id", "id") : ""));
    if (!rawId) return "-";
    return isUuid(rawId) ? `#${rawId.slice(0, 8).toUpperCase()}` : rawId;
  };

  const clinicName = (rOrId: unknown, r?: Row): string => {
    let idStr = "";
    if (rOrId && typeof rOrId === "object") {
      const rowObj = rOrId as Row;
      const inlineName = pick(rowObj, "clinic_name", "hospital_name", "partner_clinic_name", "facility_name");
      if (inlineName && !isUuid(inlineName)) return str(inlineName);
      if (rowObj.clinic && typeof rowObj.clinic === "object") {
        const name = pick(rowObj.clinic as Record<string, unknown>, "name", "clinic_name");
        if (name && !isUuid(name)) return str(name);
      }
      idStr = str(pick(rowObj, "clinic_id", "hospital_id")).trim().toLowerCase();
    } else {
      idStr = str(rOrId).trim().toLowerCase();
    }

    if (r) {
      const inlineName = pick(r, "clinic_name", "hospital_name", "partner_clinic_name", "facility_name");
      if (inlineName && !isUuid(inlineName)) return str(inlineName);
      if (r.clinic && typeof r.clinic === "object") {
        const name = pick(r.clinic as Record<string, unknown>, "name", "clinic_name");
        if (name && !isUuid(name)) return str(name);
      }
    }

    if (idStr && clinicMap.has(idStr)) {
      const c = clinicMap.get(idStr)!;
      const name = pick(c, "name", "clinic_name");
      if (name && !isUuid(name)) return str(name);
    }

    const match = clinics.find((c) => str(c.id || c.clinic_id).trim().toLowerCase() === idStr);
    if (match) {
      const name = pick(match, "name", "clinic_name");
      if (name && !isUuid(name)) return str(name);
    }

    return "Not available";
  };

  const getPetRecord = (rOrId: unknown): Row | null => {
    if (!rOrId) return null;
    if (typeof rOrId === "object") {
      const rowObj = rOrId as Row;
      if (rowObj.breed || rowObj.gender || rowObj.registration_number) return rowObj;
      if (rowObj.pet && typeof rowObj.pet === "object") return rowObj.pet as Row;
      if (rowObj.dog && typeof rowObj.dog === "object") return rowObj.dog as Row;
      const pId = str(pick(rowObj, "pet_id", "dog_id", "animal_id", "id")).trim().toLowerCase();
      if (pId && petMap.has(pId)) return petMap.get(pId) || null;
    }
    const idStr = str(rOrId).trim().toLowerCase();
    return petMap.get(idStr) || dogs.find((d) => str(d.id || d.dog_id || d.pet_id).trim().toLowerCase() === idStr) || null;
  };

  const dogName = (rOrId: unknown, r?: Row): string => {
    let idStr = "";
    if (rOrId && typeof rOrId === "object") {
      const rowObj = rOrId as Row;
      const inlineName = pick(rowObj, "name", "pet_name", "dog_name", "animal_name");
      if (inlineName && !isUuid(inlineName)) return str(inlineName);
      if (rowObj.pet && typeof rowObj.pet === "object") {
        const name = pick(rowObj.pet as Record<string, unknown>, "name", "pet_name", "dog_name");
        if (name && !isUuid(name)) return str(name);
      }
      if (rowObj.dog && typeof rowObj.dog === "object") {
        const name = pick(rowObj.dog as Record<string, unknown>, "name", "pet_name", "dog_name");
        if (name && !isUuid(name)) return str(name);
      }
      idStr = str(pick(rowObj, "pet_id", "dog_id", "animal_id", "id")).trim().toLowerCase();
    } else {
      idStr = str(rOrId).trim().toLowerCase();
    }

    if (r) {
      const inlineName = pick(r, "name", "pet_name", "dog_name", "animal_name");
      if (inlineName && !isUuid(inlineName)) return str(inlineName);
      if (r.pet && typeof r.pet === "object") {
        const name = pick(r.pet as Record<string, unknown>, "name", "pet_name", "dog_name");
        if (name && !isUuid(name)) return str(name);
      }
      if (r.dog && typeof r.dog === "object") {
        const name = pick(r.dog as Record<string, unknown>, "name", "pet_name", "dog_name");
        if (name && !isUuid(name)) return str(name);
      }
    }

    if (idStr && petMap.has(idStr)) {
      const pet = petMap.get(idStr)!;
      const name = pick(pet, "name", "dog_name", "pet_name");
      if (name && !isUuid(name)) return str(name);
    }

    const match = dogs.find(
      (d) =>
        str(d.id || d.dog_id || d.pet_id).trim().toLowerCase() === idStr ||
        str(d.registration_number).trim().toLowerCase() === idStr ||
        str(d.original_dog_id).trim().toLowerCase() === idStr
    );
    if (match) {
      const name = pick(match, "name", "dog_name", "pet_name");
      if (name && !isUuid(name)) return str(name);
    }

    return "Not available";
  };

  const ownerName = (r: Row): string => {
    const val = pick(r, "owner_name", "full_name", "user_name", "submitter_name", "client_name", "reporter_name", "requested_by", "contact_name", "created_by", "name");
    if (val && !isUuid(val)) return str(val);
    if (r.owner && typeof r.owner === "object") {
      const name = pick(r.owner as Record<string, unknown>, "full_name", "name", "user_name");
      if (name && !isUuid(name)) return str(name);
    }
    if (r.user && typeof r.user === "object") {
      const name = pick(r.user as Record<string, unknown>, "full_name", "name", "user_name");
      if (name && !isUuid(name)) return str(name);
    }
    if (r.submitter && typeof r.submitter === "object") {
      const name = pick(r.submitter as Record<string, unknown>, "full_name", "name", "user_name");
      if (name && !isUuid(name)) return str(name);
    }

    const ownerId = str(pick(r, "owner_id", "user_id", "submitter_id", "client_id")).trim().toLowerCase();
    if (ownerId && userMap.has(ownerId)) {
      const u = userMap.get(ownerId)!;
      const name = pick(u, "full_name", "name", "user_name");
      if (name && !isUuid(name)) return str(name);
    }

    const petRec = getPetRecord(r);
    if (petRec) {
      const petOwner = pick(petRec, "owner_name", "full_name", "user_name", "submitter_name", "client_name", "requested_by", "contact_name", "created_by");
      if (petOwner && !isUuid(petOwner)) return str(petOwner);
      if (petRec.owner && typeof petRec.owner === "object") {
        const name = pick(petRec.owner as Record<string, unknown>, "full_name", "name", "user_name");
        if (name && !isUuid(name)) return str(name);
      }
      if (petRec.user && typeof petRec.user === "object") {
        const name = pick(petRec.user as Record<string, unknown>, "full_name", "name", "user_name");
        if (name && !isUuid(name)) return str(name);
      }
      const petOwnerId = str(pick(petRec, "owner_id", "user_id")).trim().toLowerCase();
      if (petOwnerId && userMap.has(petOwnerId)) {
        const u = userMap.get(petOwnerId)!;
        const name = pick(u, "full_name", "name", "user_name");
        if (name && !isUuid(name)) return str(name);
      }
    }

    const email = pick(r, "user_email", "email", "owner_email") || (petRec ? pick(petRec, "owner_email", "user_email", "email") : undefined);
    if (email && !isUuid(email)) return str(email).split("@")[0];

    return "Not available";
  };

  const vetName = (r: Row): string => {
    const val = pick(r, "vet_name", "doctor_name", "veterinarian_name");
    if (val && !isUuid(val)) return str(val);
    if (r.vet && typeof r.vet === "object") {
      const name = pick(r.vet as Record<string, unknown>, "full_name", "name", "user_name");
      if (name && !isUuid(name)) return str(name);
    }
    return "Not assigned";
  };

  // Appointment Actions
  const handleConfirm = async (row: Row) => {
    const id = str(pick(row, "id", "appointment_id"));
    if (!id) return;
    try {
      setConfirmingId(id);
      await vetService.confirmAppointment(id);
      addToast("Appointment confirmed.", "success");
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to confirm appointment.", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCompleteAppointment = async (row: Row) => {
    const id = str(pick(row, "id", "appointment_id"));
    if (!id) return;
    try {
      setConfirmingId(id);
      await vetService.completeAppointment(id, "Completed by attending veterinarian.");
      addToast("Appointment completed.", "success");
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to complete appointment.", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const id = str(pick(cancelTarget, "id", "appointment_id"));
    if (!id) return;
    try {
      setIsCancelling(true);
      await vetService.cancelAppointment(id, cancelReason.trim() || undefined);
      addToast("Appointment cancelled.", "success");
      setCancelTarget(null);
      setCancelReason("");
      fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.message || "Failed to cancel appointment.", "error");
    } finally {
      setIsCancelling(false);
    }
  };

  // Consultation Modal Actions
  const handleOpenConsultation = async (appt: Row) => {
    setActiveAppt(appt);
    setConsultationForm({
      ...emptyConsultationForm,
      chiefComplaint: str(pick(appt, "reason", "notes")),
    });
    setShowTreatmentSection(false);
    setShowVaccineSection(false);
    setShowPrescriptionSection(false);
    setShowFollowupSection(false);
    setShowHistorySection(false);
    setShowAttachmentSection(false);
    setIsConsultationOpen(true);

    const petId = str(pick(appt, "pet_id", "dog_id", "animal_id"));
    if (petId) {
      try {
        setHistoryLoading(true);
        const historyRes = await medicalService.getMedicalHistory(petId);
        setPetHistory(Array.isArray(historyRes?.data) ? historyRes.data : []);
      } catch {
        setPetHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    } else {
      setPetHistory([]);
    }
  };

  const handleCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAppt) return;
    const apptId = str(pick(activeAppt, "id", "appointment_id"));
    const rawDogId = str(pick(activeAppt, "pet_id", "dog_id", "animal_id", "id"));

    let realDogId = "";
    if (isUuid(rawDogId)) {
      realDogId = rawDogId;
    } else {
      const match = dogs.find(
        (d) =>
          str(d.id) === rawDogId ||
          str(d.dog_id) === rawDogId ||
          str(d.registration_number) === rawDogId ||
          (d.name && str(d.name).toLowerCase() === rawDogId.toLowerCase())
      );
      if (match) {
        realDogId = str(match.id || match.dog_id);
      }
    }

    if (!realDogId || !isUuid(realDogId)) {
      const firstValidDog = dogs.find((d) => isUuid(d.id) || isUuid(d.dog_id));
      if (firstValidDog) {
        realDogId = str(firstValidDog.id || firstValidDog.dog_id);
      }
    }

    if (!realDogId || !isUuid(realDogId)) {
      addToast("A valid patient record is required to record a clinical exam.", "error");
      return;
    }

    try {
      setIsSubmittingConsultation(true);

      // 1. Create Clinical Exam (records symptoms, diagnosis, BCS, observations & vet notes)
      await medicalService.createMedicalExam({
        dog_id: realDogId,
        triage_diagnosis: consultationForm.diagnosis || consultationForm.chiefComplaint || "Routine Clinical Checkup",
        body_condition_score: consultationForm.bcs,
        chief_complaint: consultationForm.chiefComplaint,
        visible_injuries: consultationForm.visibleInjuries,
        vet_notes: consultationForm.vetNotes,
      });

      // 2. Log Surgery / Procedure if entered
      if (consultationForm.treatmentType) {
        try {
          await medicalService.scheduleSurgery({
            dog_id: realDogId,
            treatment_type: consultationForm.treatmentType,
            description: consultationForm.treatmentDesc || consultationForm.vetNotes || `Procedure: ${consultationForm.treatmentType}`,
            anesthesia_log: consultationForm.anesthesiaLog || undefined,
            post_op_notes: consultationForm.postOpNotes || undefined,
          });
        } catch (err: unknown) {
          console.error("Failed to record surgical procedure:", err);
          addToast("Warning: Surgical procedure record failed to persist to backend.", "error");
        }
      }

      // 3. Log Vaccination if entered
      if (consultationForm.vaccineName) {
        await medicalService.createVaccination({
          dog_id: realDogId,
          vaccine_name: consultationForm.vaccineName,
          lot_number: consultationForm.lotNumber || undefined,
          next_due_at: consultationForm.nextDueAt || undefined,
        }).catch(() => null);
      }

      // 4. Log Prescription if entered
      if (consultationForm.drugName) {
        const durationDays = Number(consultationForm.drugDurationDays) || 7;
        const startAt = new Date().toISOString();
        const endAt = new Date(Date.now() + durationDays * 86400000).toISOString();
        await medicalService.createPrescription({
          dog_id: realDogId,
          drug_name: consultationForm.drugName,
          dosage: consultationForm.dosage || "As directed",
          route: consultationForm.route || "Oral",
          start_at: startAt,
          end_at: endAt,
        }).catch(() => null);
      }

      // 5. Schedule Follow-up if entered
      if (consultationForm.followUpDate) {
        await vetService.bookAppointment({
          pet_id: realDogId,
          dog_id: realDogId,
          reason: `Follow-up: ${consultationForm.followUpReason || consultationForm.diagnosis || "Post-consultation checkup"}`,
          notes: consultationForm.vetNotes,
          date: consultationForm.followUpDate,
          status: "requested",
        }).catch(() => null);
      }

      // 6. Update Appointment Status if valid appointment ID exists
      if (apptId) {
        await vetService.completeAppointment(apptId, consultationForm.vetNotes || undefined).catch(() => null);
      }

      // 7. Deliver notification to requesting user/owner if submitter ID exists
      const submitterId = pick(activeAppt, "user_id", "owner_id", "submitter_id", "client_id");
      if (submitterId && isUuid(submitterId)) {
        try {
          await api.post("/notifications/send", {
            user_id: String(submitterId),
            title: "Veterinary Examination Completed",
            body: `Clinical examination completed for ${dogName(activeAppt)}. Diagnosis: ${consultationForm.diagnosis || "Routine Clinical Checkup"}.`,
            notification_type: "medical",
            send_email: false,
          });
        } catch (notifErr) {
          console.warn("User notification delivery skipped/failed:", notifErr);
        }
      }

      // 8. Update local state immediately so table renders "Examined - Pending Clearance"
      setDogs((prevDogs) =>
        prevDogs.map((d) => {
          if (str(d.id || d.dog_id) === str(realDogId)) {
            return {
              ...d,
              medical_status: "Examined - Pending Clearance",
            };
          }
          return d;
        })
      );

      addToast("Veterinary consultation completed & medical records updated!", "success");
      setIsConsultationOpen(false);
      setActiveAppt(null);
      setConsultationForm({ ...emptyConsultationForm });
      await fetchDashboardData();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || "Failed to submit consultation.";
      addToast(msg, "error");
    } finally {
      setIsSubmittingConsultation(false);
    }
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter((a) => {
    const status = str(pick(a, "status")).toLowerCase();
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    const petName = dogName(pick(a, "pet_id"));
    const id = str(pick(a, "id", "appointment_id"));
    const reason = str(pick(a, "reason"));
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = !q || petName.toLowerCase().includes(q) || id.toLowerCase().includes(q) || reason.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const apptsTodayList = appointments.filter((a) => {
    const dStr = str(pick(a, "starts_at", "date", "appointment_date", "created_at")).split("T")[0];
    return dStr === todayStr;
  });
  const todayApptsCount = vetSummary?.today_appointments ?? (apptsTodayList.length > 0 ? apptsTodayList.length : appointments.length);

  const pendingTodayCount = (apptsTodayList.length > 0 ? apptsTodayList : appointments).filter((a) => {
    const s = str(pick(a, "status")).toLowerCase();
    return s === "requested" || s === "pending";
  }).length;

  const confirmedTodayCount = (apptsTodayList.length > 0 ? apptsTodayList : appointments).filter((a) => {
    const s = str(pick(a, "status")).toLowerCase();
    return s === "confirmed";
  }).length;

  const criticalCasesCount = vetSummary?.critical_cases ?? medicalRecords.filter((r) => {
    const st = str(r.status || r.diagnosis || r.treatment).toLowerCase();
    return st.includes("critical") || st.includes("emergency") || st.includes("post-op") || st.includes("icu");
  }).length;

  const loggedVaccinesCount = vetSummary?.total_vaccinations ?? medicalRecords.filter((r) =>
    str(r.entityType || r.categoryName || r.type).toLowerCase().includes("vaccin")
  ).length;

  const clearedDogsCount = vetSummary?.cleared_dogs ?? dogs.filter((d) =>
    Boolean(d.is_fit_for_adoption || d.is_adoptable || str(d.medical_status).toLowerCase().includes("clear"))
  ).length;

  const stats = [
    {
      title: "Appointments Today",
      value: loading ? "..." : String(todayApptsCount),
      trend: `${pendingTodayCount} Pending / ${confirmedTodayCount} Confirmed`,
      color: "#1E3A8A",
      icon: <FaCalendarAlt />,
      onClick: () => {
        setStatusFilter("all");
        const el = document.getElementById("appointments-queue");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Critical Medical Cases",
      value: loading ? "..." : String(criticalCasesCount),
      trend: "High Priority Medical Watch",
      color: "#DC2626",
      icon: <FaExclamationCircle />,
      onClick: () => {
        const el = document.getElementById("icu-queue");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      title: "Vaccinations Logged",
      value: loading ? "..." : String(loggedVaccinesCount),
      trend: "Immunization Suite",
      color: "#F59E0B",
      icon: <FaSyringe />,
      onClick: () => navigate("/medical-reminders"),
    },
    {
      title: "Medically Cleared Dogs",
      value: loading ? "..." : String(clearedDogsCount),
      trend: "Ready for Adoption",
      color: "#16A34A",
      icon: <FaFileMedical />,
      onClick: () => navigate("/medical-records"),
    },
  ];

  const renderStatusBadge = (statusStr: string) => {
    const s = statusStr.toLowerCase();
    if (s === "confirmed" || s === "completed") return <span style={badgeStyle("#DCFCE7", "#166534")}>{statusStr}</span>;
    if (s === "requested" || s === "pending") return <span style={badgeStyle("#FEF3C7", "#92400E")}>{statusStr}</span>;
    if (s === "cancelled") return <span style={badgeStyle("#FEE2E2", "#991B1B")}>{statusStr}</span>;
    return <span style={badgeStyle("#F1F5F9", "#475569")}>{statusStr}</span>;
  };

  const apptColumns = [
    { key: "id", title: "Appt ID", render: (v: unknown, r: Row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatApptId(v, r)}</span> },
    {
      key: "pet",
      title: "Pet Name & ID",
      render: (_: unknown, r: Row) => {
        const pId = pick(r, "pet_id", "dog_id");
        const nameStr = dogName(r);
        const petRec = getPetRecord(pId);
        const regNo = petRec ? str(petRec.registration_number) : "";
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A" }}>{nameStr}</div>
            <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>
              {regNo ? `Reg: ${regNo}` : isUuid(pId) ? `ID: ${str(pId).slice(0, 8).toUpperCase()}` : `ID: ${str(pId || "-")}`}
            </div>
          </div>
        );
      },
    },
    { key: "owner", title: "Owner / Submitter", render: (_: unknown, r: Row) => ownerName(r) },
    { key: "clinic", title: "Veterinary Clinic", render: (_: unknown, r: Row) => clinicName(r) },
    { key: "date", title: "Date & Time", render: (_: unknown, r: Row) => formatDate(pick(r, "starts_at", "date", "created_at")) },
    { key: "reason", title: "Reason for Visit", render: (v: unknown) => str(v) || "-" },
    {
      key: "source",
      title: "Source / Channel",
      render: (_: unknown, r: Row) => {
        const src = pick(r, "source", "channel", "platform", "booking_source");
        return (
          <span style={badgeStyle("#EFF6FF", "#1E3A8A")}>{String(src || "PUBLIC_WEB").toUpperCase()}</span>
        );
      },
    },
    { key: "status", title: "Status", render: (_: unknown, r: Row) => renderStatusBadge(str(pick(r, "status"))) },
  ];

  const shelterDogRows = dogs.filter((d) => {
    const status = str(d.status).toLowerCase();
    const medStatus = str(d.medical_status).toLowerCase();
    const name = str(d.name).toLowerCase();
    const regNo = str(d.registration_number).toLowerCase();
    const id = str(d.id || d.dog_id).toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    const isShelterDog = status === "shelter" || status === "clinic" || status === "rescued" || medStatus.length > 0;
    const matchesQuery = !q || name.includes(q) || regNo.includes(q) || id.includes(q) || medStatus.includes(q);

    // 1. Medical Status Filter
    let matchesMedStatus = true;
    if (shelterMedicalStatusFilter !== "all") {
      const target = shelterMedicalStatusFilter.toLowerCase();
      if (target === "pending") {
        matchesMedStatus = medStatus.includes("pending") || medStatus.includes("check") || !medStatus;
      } else if (target === "assigned to vet") {
        matchesMedStatus = medStatus.includes("assigned") || medStatus.includes("vet");
      } else if (target === "under treatment") {
        matchesMedStatus = medStatus.includes("treatment") || medStatus.includes("under");
      } else if (target === "examined - pending clearance") {
        matchesMedStatus = medStatus.includes("examined");
      } else if (target === "medically cleared") {
        matchesMedStatus = medStatus.includes("clear") || medStatus.includes("fit") || Boolean(d.is_fit_for_adoption || d.is_adoptable);
      } else {
        matchesMedStatus = medStatus === target || medStatus.includes(target);
      }
    }

    // 2. Adoption Readiness Filter
    let matchesAdoption = true;
    if (shelterAdoptionFilter !== "all") {
      const isAdoptable = Boolean(d.is_fit_for_adoption || d.is_adoptable || medStatus.includes("clear") || str(d.adoption_readiness).toUpperCase() === "READY_FOR_ADOPTION");
      if (shelterAdoptionFilter === "ready") {
        matchesAdoption = isAdoptable;
      } else if (shelterAdoptionFilter === "not_ready") {
        matchesAdoption = !isAdoptable;
      }
    }

    return isShelterDog && matchesQuery && matchesMedStatus && matchesAdoption;
  });

  const shelterColumns = [
    {
      key: "name",
      title: "Dog Name & Reg #",
      render: (_: unknown, r: Row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{str(r.name)}</div>
          <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>Reg: {str(r.registration_number)}</div>
        </div>
      ),
    },
    {
      key: "id",
      title: "Dog Master ID",
      render: (_: unknown, r: Row) => (
        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569", fontWeight: 700 }}>
          {str(r.id || r.dog_id)}
        </span>
      ),
    },
    {
      key: "shelter_name",
      title: "Shelter / Facility",
      render: (_: unknown, r: Row) => (
        <div style={{ fontWeight: 600, color: "#334155" }}>{str(r.shelter_name || r.shelter_id || "Central Shelter")}</div>
      ),
    },
    {
      key: "medical_status",
      title: "Medical Status",
      render: (_: unknown, r: Row) => {
        const medStatus = str(r.medical_status);
        const isCleared = medStatus.toLowerCase().includes("clear") || Boolean(r.is_fit_for_adoption || r.is_adoptable);
        const label = isCleared ? "MEDICALLY CLEARED" : (medStatus || "PENDING CHECK").toUpperCase();
        return (
          <span style={badgeStyle(isCleared ? "#ECFDF5" : "#EFF6FF", isCleared ? "#15803D" : "#1E3A8A")}>
            {label}
          </span>
        );
      },
    },
    {
      key: "is_fit_for_adoption",
      title: "Adoption Readiness",
      render: (_: unknown, r: Row) => {
        const isAdoptable = Boolean(r.is_fit_for_adoption || r.is_adoptable || str(r.medical_status).toLowerCase().includes("clear"));
        return (
          <span style={badgeStyle(isAdoptable ? "#ECFDF5" : "#FFFBEB", isAdoptable ? "#15803D" : "#B45309")}>
            {isAdoptable ? "READY FOR ADOPTION" : "PENDING CLEARANCE"}
          </span>
        );
      },
    },
  ];

  return (
    <div>
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
        <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800 }}>
          Veterinary Medical Station & Consultation Workspace
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "13px" }}>
          Authorized clinical station: receive appointments, perform medical check-ups, review pet medical history, log diagnoses & prescriptions, and update health status.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "14px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <QuickActionCard icon={<FaStethoscope />} title="Medical Records" subtitle="Exams & Diagnoses" color="#1E3A8A" onClick={() => navigate("/medical-records")} />
        <QuickActionCard icon={<FaSyringe />} title="Vaccination Suite" subtitle="Booster Reminders" color="#16A34A" onClick={() => navigate("/medical-reminders")} />
        <QuickActionCard icon={<FaFileMedical />} title="Issue Certificate" subtitle="Medical clearance" color="#1E3A8A" onClick={() => navigate("/certificates")} />
        <QuickActionCard icon={<FaUserMd />} title="Vet Directory" subtitle="Browse Partner Clinics" color="#1E3A8A" onClick={() => navigate("/vet-directory")} />
      </div>

      {/* Headline Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((item) => (
          <StatCard key={item.title} {...item} />
        ))}
      </div>

      {/* VETERINARY QUEUE & WORKSPACE (DUAL SOURCES) */}
      <div id="appointments-queue" className="soft-card" style={{ padding: "20px", marginBottom: "24px" }}>
        {/* Source Navigation Tabs */}
        <div style={{ borderBottom: "2px solid #E2E8F0", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveSourceTab("shelter_requests")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeSourceTab === "shelter_requests" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeSourceTab === "shelter_requests" ? "#EFF6FF" : "#FFFFFF",
                color: activeSourceTab === "shelter_requests" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaHome /> 🏠 Shelter Medical Requests ({shelterDogRows.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveSourceTab("public_appts")}
              style={{
                padding: "9px 16px",
                borderRadius: "10px",
                border: activeSourceTab === "public_appts" ? "2px solid #1E3A8A" : "1px solid #CBD5E1",
                background: activeSourceTab === "public_appts" ? "#EFF6FF" : "#FFFFFF",
                color: activeSourceTab === "public_appts" ? "#1E3A8A" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaCalendarAlt /> 🌐 Public Website Appointments ({filteredAppointments.length})
            </button>
          </div>
        </div>

        {/* TAB 1: SHELTER MEDICAL REQUESTS */}
        {activeSourceTab === "shelter_requests" && (
          <DataTable
            columns={shelterColumns}
            data={shelterDogRows}
            loading={loading}
            hideSearch={true}
            onRowClick={(row) => setSelectedShelterRequest(row)}
            onView={(row) => setSelectedShelterRequest(row)}
            leftHeaderControls={
              <>
                <div style={{ position: "relative" }}>
                  <FaSearch size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                  <input
                    type="text"
                    placeholder="Search dog, ID, diagnosis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: "8px 12px 8px 32px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "220px" }}
                  />
                </div>

                <select
                  value={shelterMedicalStatusFilter}
                  onChange={(e) => setShelterMedicalStatusFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                    background: "#FFF",
                    color: "#334155",
                    fontWeight: 500,
                  }}
                  aria-label="Filter by Medical Status"
                >
                  <option value="all">All Medical Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned to vet">Assigned to Vet</option>
                  <option value="under treatment">Under Treatment</option>
                  <option value="examined - pending clearance">Examined - Pending Clearance</option>
                  <option value="medically cleared">Medically Cleared</option>
                </select>

                <select
                  value={shelterAdoptionFilter}
                  onChange={(e) => setShelterAdoptionFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "13px",
                    background: "#FFF",
                    color: "#334155",
                    fontWeight: 500,
                  }}
                  aria-label="Filter by Adoption Readiness"
                >
                  <option value="all">All Adoption Readiness</option>
                  <option value="ready">Ready for Adoption</option>
                  <option value="not_ready">Not Ready</option>
                </select>
              </>
            }
            emptyMessage="No shelter medical requests found matching current filter."
            renderRowActions={(row: Row) => {
              const isCleared = Boolean(row.is_fit_for_adoption || row.is_adoptable || str(row.medical_status).toLowerCase().includes("clear"));
              return (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    title="View Dog Master Profile"
                    onClick={() => handleOpenDogProfile(row)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #1E3A8A", background: "#EFF6FF", color: "#1E3A8A", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <FaEye /> View Dog
                  </button>

                  <button
                    type="button"
                    title="Perform Examination & Record Findings"
                    onClick={() => handleOpenConsultation(row)}
                    style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <FaStethoscope /> {isCleared ? "Re-examine" : "Start Exam"}
                  </button>

                  {isCleared ? (
                    <span
                      style={{ padding: "6px 10px", borderRadius: "6px", background: "#ECFDF5", color: "#15803D", fontSize: "12px", fontWeight: 800, border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaCheckCircle /> Cleared
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Issue Medical Clearance & Adoption Readiness"
                      onClick={() => handleIssueMedicalClearance(row)}
                      disabled={isClearingAdoption}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaCheckCircle /> Issue Clearance
                    </button>
                  )}
                </div>
              );
            }}
          />
        )}

        {/* TAB 2: PUBLIC WEBSITE APPOINTMENTS */}
        {activeSourceTab === "public_appts" && (
          <DataTable
            columns={apptColumns}
            data={filteredAppointments}
            loading={loading}
            hideSearch={true}
            onRowClick={(row) => setSelectedPublicAppt(row)}
            onView={(row) => setSelectedPublicAppt(row)}
            leftHeaderControls={
              <>
                <div style={{ position: "relative" }}>
                  <FaSearch size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                  <input
                    type="text"
                    placeholder="Search dog, ID, diagnosis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: "8px 12px 8px 32px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", width: "220px" }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="requested">Requested / Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </>
            }
            emptyMessage="No public web appointments found matching current filters."
            renderRowActions={(row: Row) => {
              const status = str(pick(row, "status")).toLowerCase();
              const id = str(pick(row, "id", "appointment_id"));
              const isFinished = status === "completed" || status === "cancelled";

              return (
                <div style={{ display: "flex", gap: "6px" }}>
                  {(status === "requested" || status === "pending") && (
                    <button
                      type="button"
                      onClick={() => handleConfirm(row)}
                      disabled={confirmingId === id}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #16A34A", background: "#ECFDF5", color: "#15803D", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaCheck /> Confirm
                    </button>
                  )}

                  {status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() => handleCompleteAppointment(row)}
                      disabled={confirmingId === id}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #3B82F6", background: "#EFF6FF", color: "#1D4ED8", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaCheckCircle /> Complete
                    </button>
                  )}

                  {!isFinished && (
                    <button
                      type="button"
                      onClick={() => handleOpenConsultation(row)}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#1E3A8A", color: "#FFF", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FaStethoscope /> Start Consultation
                    </button>
                  )}

                  {!isFinished && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(row)}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FFF", color: "#DC2626", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaBan /> Cancel
                    </button>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      {/* ACTIVE CLINICAL PATIENTS / ICU QUEUE */}
      <div id="icu-queue" className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, color: "#0F172A", fontSize: "16px", fontWeight: 700 }}>
              🏥 Recent Medical Exams & Intensive Care Records
            </h3>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              Attending veterinary exam history and active treatment logs
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/medical-records")}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", color: "#1E3A8A", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            Full Medical Archive &rarr;
          </button>
        </div>

        <DataTable
          columns={[
            { key: "recordId", title: "Record ID", render: (v: unknown) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{str(v)}</span> },
            { key: "petName", title: "Pet Name & ID" },
            { key: "categoryName", title: "Category" },
            { key: "diagnosis", title: "Primary Diagnosis / Exam" },
            { key: "treatment", title: "Treatment / Notes" },
            { key: "date", title: "Date Recorded", render: (v: unknown) => formatDate(v) },
          ]}
          data={medicalRecords.slice(0, 10)}
          loading={loading}
          emptyMessage="No medical exam records found."
          onRowClick={(row) => setSelectedMedicalRecord(row)}
          onView={(row) => setSelectedMedicalRecord(row)}
        />
      </div>

      {/* CANCEL APPOINTMENT MODAL */}
      {cancelTarget && (
        <Modal
          isOpen={true}
          onClose={() => { setCancelTarget(null); setCancelReason(""); }}
          title="Cancel Veterinary Appointment"
          maxWidth="440px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#334155" }}>
              Are you sure you want to cancel the appointment for <strong>{dogName(pick(cancelTarget, "pet_id"))}</strong>?
            </p>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Cancellation Reason (optional)</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" onClick={() => setCancelTarget(null)} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF" }}>Back</button>
              <button type="button" onClick={handleCancel} disabled={isCancelling} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 700 }}>
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* VETERINARY CHECK-UP & CONSULTATION MODAL */}
      {isConsultationOpen && activeAppt && (
        <Modal
          isOpen={true}
          onClose={() => { setIsConsultationOpen(false); setActiveAppt(null); }}
          title={`Veterinary Clinical Examination — ${dogName(activeAppt)}`}
          maxWidth="640px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Patient & Request Banner */}
            {(() => {
              const pId = pick(activeAppt, "pet_id", "dog_id", "animal_id");
              const petRec = getPetRecord(activeAppt);
              const petNameStr = dogName(activeAppt);
              const ownerStr = ownerName(activeAppt);
              const clinicStr = clinicName(activeAppt);
              const reasonStr = str(pick(activeAppt, "reason", "notes", "medical_notes", "medical_issue")) || "General Veterinary Examination";
              const dateStr = formatDate(pick(activeAppt, "starts_at", "date", "created_at"));
              const sourceStr = str(pick(activeAppt, "source", "channel", "platform", "booking_source"));
              const displaySource = sourceStr ? sourceStr.toUpperCase() : activeAppt.shelter_id || activeAppt.facility ? "SHELTER REQUEST" : "PUBLIC APPOINTMENT";
              const userEmail = str(pick(activeAppt, "user_email", "email", "owner_email"));
              const userPhone = str(pick(activeAppt, "user_phone", "phone", "contact"));

              return (
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>🐶 {petNameStr}</div>
                      <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                        {petRec?.registration_number ? `Reg: ${str(petRec.registration_number)}` : isUuid(pId) ? `ID: ${str(pId).slice(0, 8).toUpperCase()}` : `ID: ${str(pId || "-")}`}
                      </div>
                      <div style={{ fontSize: "13px", color: "#334155", marginTop: "4px" }}>
                        <strong>Breed:</strong> {petRec?.breed ? str(petRec.breed) : "-"} &bull; <strong>Gender:</strong> {petRec?.gender ? str(petRec.gender) : "-"}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EFF6FF", color: "#1E3A8A" }}>
                          {displaySource}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", color: "#334155" }}>
                        <strong>Requester / Submitter:</strong> {ownerStr}
                      </div>
                      {userEmail && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>Email: {userEmail}</div>}
                      {userPhone && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>Phone: {userPhone}</div>}
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                        <strong>Facility / Clinic:</strong> {clinicStr}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "13px", color: "#1E293B" }}>
                      <strong>Reason for Visit:</strong> {reasonStr}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>
                      <strong>Date:</strong> {dateStr}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Core Examination Form */}
            <form onSubmit={handleCompleteConsultation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* 1. Chief Complaint & Symptoms */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Chief Complaint / Observed Symptoms *
                </label>
                <input
                  type="text"
                  required
                  value={consultationForm.chiefComplaint}
                  onChange={(e) => setConsultationForm({ ...consultationForm, chiefComplaint: e.target.value })}
                  placeholder="e.g. Eye redness, limping, lethargy, skin lesions"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              {/* 2. Clinical Diagnosis & Body Condition Score */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Clinical Diagnosis / Assessment *
                  </label>
                  <input
                    type="text"
                    required
                    value={consultationForm.diagnosis}
                    onChange={(e) => setConsultationForm({ ...consultationForm, diagnosis: e.target.value })}
                    placeholder="e.g. Corneal Abrasion, Acute Gastroenteritis, Healthy Intake"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Body Condition Score
                  </label>
                  <select
                    value={consultationForm.bcs}
                    onChange={(e) => setConsultationForm({ ...consultationForm, bcs: Number(e.target.value) })}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>BCS {n}/9 {n === 5 ? "(Ideal)" : n < 5 ? "(Underweight)" : "(Overweight)"}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Physical Exam Observations */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Physical Exam Findings &amp; Observations
                </label>
                <textarea
                  rows={2}
                  value={consultationForm.visibleInjuries}
                  onChange={(e) => setConsultationForm({ ...consultationForm, visibleInjuries: e.target.value })}
                  placeholder="Notes on eyes, ears, coat, dental health, joint palpation..."
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              {/* 4. Attending Vet Clinical Notes */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Attending Veterinarian Summary Notes
                </label>
                <textarea
                  rows={2}
                  value={consultationForm.vetNotes}
                  onChange={(e) => setConsultationForm({ ...consultationForm, vetNotes: e.target.value })}
                  placeholder="Clinical assessment summary, home care recommendations..."
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              {/* 5. Optional Secondary Add-ons Bar */}
              <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "12px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>
                  ➕ Optional Clinical Add-ons for this Visit:
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShowTreatmentSection(!showTreatmentSection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showTreatmentSection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showTreatmentSection ? "#EFF6FF" : "#FFF", color: showTreatmentSection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showTreatmentSection ? "✓ Treatment/Surgery" : "+ Treatment / Surgery"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrescriptionSection(!showPrescriptionSection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showPrescriptionSection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showPrescriptionSection ? "#EFF6FF" : "#FFF", color: showPrescriptionSection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showPrescriptionSection ? "✓ Prescription" : "+ Prescription"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVaccineSection(!showVaccineSection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showVaccineSection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showVaccineSection ? "#EFF6FF" : "#FFF", color: showVaccineSection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showVaccineSection ? "✓ Vaccination" : "+ Vaccination"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFollowupSection(!showFollowupSection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showFollowupSection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showFollowupSection ? "#EFF6FF" : "#FFF", color: showFollowupSection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showFollowupSection ? "✓ Follow-Up" : "+ Schedule Follow-Up"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowHistorySection(!showHistorySection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showHistorySection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showHistorySection ? "#EFF6FF" : "#FFF", color: showHistorySection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showHistorySection ? "✓ Medical History" : `📋 History (${petHistory.length})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAttachmentSection(!showAttachmentSection)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: showAttachmentSection ? "1px solid #1E3A8A" : "1px solid #CBD5E1", background: showAttachmentSection ? "#EFF6FF" : "#FFF", color: showAttachmentSection ? "#1E3A8A" : "#334155", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showAttachmentSection ? "✓ Lab Attachment" : "📎 Attach Document"}
                  </button>
                </div>
              </div>

              {/* OPTIONAL EXPANDABLE SECTION 1: TREATMENT / SURGERY */}
              {showTreatmentSection && (
                <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF" }}>🏥 Procedure / Surgery Details</div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Procedure / Surgery Type *</label>
                    <input
                      type="text"
                      value={consultationForm.treatmentType}
                      onChange={(e) => setConsultationForm({ ...consultationForm, treatmentType: e.target.value })}
                      placeholder="e.g. Ocular Reconstruction / Spay Surgery / Wound Suture"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Procedure Description &amp; Indications</label>
                    <textarea
                      rows={2}
                      value={consultationForm.treatmentDesc}
                      onChange={(e) => setConsultationForm({ ...consultationForm, treatmentDesc: e.target.value })}
                      placeholder="Surgical procedure details, clinical indications, and surgical care notes..."
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Anesthesia Log (Optional)</label>
                      <input
                        type="text"
                        value={consultationForm.anesthesiaLog}
                        onChange={(e) => setConsultationForm({ ...consultationForm, anesthesiaLog: e.target.value })}
                        placeholder="e.g. Isoflurane 2%, 45 min duration, vitals stable"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Post-Operative Notes (Optional)</label>
                      <input
                        type="text"
                        value={consultationForm.postOpNotes}
                        onChange={(e) => setConsultationForm({ ...consultationForm, postOpNotes: e.target.value })}
                        placeholder="e.g. Recovered smoothly; E-collar required for 14 days"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OPTIONAL EXPANDABLE SECTION 2: PRESCRIPTION */}
              {showPrescriptionSection && (
                <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF" }}>💊 Prescription Details</div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Medication Name</label>
                    <input
                      type="text"
                      value={consultationForm.drugName}
                      onChange={(e) => setConsultationForm({ ...consultationForm, drugName: e.target.value })}
                      placeholder="e.g. Ciprofloxacin Eye Drops, Amoxicillin"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Dosage</label>
                      <input
                        type="text"
                        value={consultationForm.dosage}
                        onChange={(e) => setConsultationForm({ ...consultationForm, dosage: e.target.value })}
                        placeholder="e.g. 2 drops TID"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Route</label>
                      <select
                        value={consultationForm.route}
                        onChange={(e) => setConsultationForm({ ...consultationForm, route: e.target.value })}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      >
                        <option value="Topical">Topical / Ophthalmic</option>
                        <option value="Oral">Oral (PO)</option>
                        <option value="Subcutaneous">Subcutaneous (SQ)</option>
                        <option value="Intramuscular">Intramuscular (IM)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Duration (Days)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={consultationForm.drugDurationDays}
                        onChange={(e) => setConsultationForm({ ...consultationForm, drugDurationDays: Number(e.target.value) })}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OPTIONAL EXPANDABLE SECTION 3: VACCINATION */}
              {showVaccineSection && (
                <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF" }}>💉 Vaccination Log</div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Vaccine Name</label>
                    <input
                      type="text"
                      value={consultationForm.vaccineName}
                      onChange={(e) => setConsultationForm({ ...consultationForm, vaccineName: e.target.value })}
                      placeholder="e.g. Rabies Vaccine or DHPP 7-in-1"
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Lot / Serial Number</label>
                      <input
                        type="text"
                        value={consultationForm.lotNumber}
                        onChange={(e) => setConsultationForm({ ...consultationForm, lotNumber: e.target.value })}
                        placeholder="e.g. LOT-99824"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Next Due Date</label>
                      <input
                        type="date"
                        value={consultationForm.nextDueAt}
                        onChange={(e) => setConsultationForm({ ...consultationForm, nextDueAt: e.target.value })}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OPTIONAL EXPANDABLE SECTION 4: FOLLOW-UP */}
              {showFollowupSection && (
                <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF" }}>📅 Schedule Follow-up Visit</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Follow-up Date</label>
                      <input
                        type="date"
                        value={consultationForm.followUpDate}
                        onChange={(e) => setConsultationForm({ ...consultationForm, followUpDate: e.target.value })}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Follow-up Reason</label>
                      <input
                        type="text"
                        value={consultationForm.followUpReason}
                        onChange={(e) => setConsultationForm({ ...consultationForm, followUpReason: e.target.value })}
                        placeholder="e.g. Suture check, eye progress re-evaluation"
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* OPTIONAL EXPANDABLE SECTION 5: MEDICAL HISTORY */}
              {showHistorySection && (
                <div style={{ background: "#FFF", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "14px", maxHeight: "220px", overflowY: "auto" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>📋 Patient Prior Medical Records</div>
                  {historyLoading ? (
                    <div style={{ padding: "12px", textAlign: "center", color: "#1E3A8A", fontSize: "12px" }}>Loading patient medical history...</div>
                  ) : petHistory.length === 0 ? (
                    <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "6px", textAlign: "center", color: "#64748B", fontSize: "12px" }}>
                      No prior medical records logged for this pet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {petHistory.map((h, idx) => (
                        <div key={idx} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "8px 10px", fontSize: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                            <span>{str(h.categoryName || h.type)}</span>
                            <span style={{ color: "#64748B", fontWeight: 400 }}>{formatDate(h.date)}</span>
                          </div>
                          <div style={{ color: "#475569", marginTop: "2px" }}>
                            <strong>Diagnosis:</strong> {str(h.diagnosis)} &bull; <strong>Treatment:</strong> {str(h.treatment)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OPTIONAL EXPANDABLE SECTION 6: ATTACHMENT */}
              {showAttachmentSection && (
                <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#1E40AF", marginBottom: "6px" }}>📎 Attach Clinical Lab Document</div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          addToast("Uploading clinical report...", "info");
                          const url = await storageService.uploadFile(file, { folder: "medical_records", entity_type: "clinical_exam" });
                          setConsultationForm((prev) => ({ ...prev, attachmentUrl: url }));
                          addToast("Clinical report attached!", "success");
                        } catch {
                          addToast("Failed to upload file attachment.", "error");
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12px" }}
                  />
                  {consultationForm.attachmentUrl && (
                    <div style={{ fontSize: "12px", color: "#16A34A", fontWeight: 700, marginTop: "4px" }}>
                      ✓ Document attached: {consultationForm.attachmentUrl.slice(0, 45)}...
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsConsultationOpen(false)}
                  style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#334155", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingConsultation}
                  style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: isSubmittingConsultation ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {isSubmittingConsultation ? "Saving..." : "✓ Save & Complete Examination"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* DOG MASTER PROFILE VIEW MODAL FOR VETERINARIAN */}
      {isDogProfileOpen && selectedDogMaster && (
        <Modal
          isOpen={true}
          onClose={() => setIsDogProfileOpen(false)}
          title={`Dog Master Profile — ${str(selectedDogMaster.name)}`}
          maxWidth="640px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", background: "#F8FAFC", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>
                🐶
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{str(selectedDogMaster.name)}</div>
                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace" }}>Reg Number: {str(selectedDogMaster.registration_number || "-")}</div>
                <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace", marginTop: "2px" }}>Dog Master ID: {str(selectedDogMaster.id || selectedDogMaster.dog_id || "-")}</div>
              </div>
              <span style={{ padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, background: "#ECFDF5", color: "#15803D", textTransform: "uppercase" }}>
                {str(selectedDogMaster.status || "SHELTER")}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Breed & Species:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{str(selectedDogMaster.breed || "-")}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Gender:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A", textTransform: "capitalize" }}>{str(selectedDogMaster.gender || "Unknown")}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Estimated Age:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{str(selectedDogMaster.estimated_age || "-")}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Shelter / Facility:</strong>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{str(selectedDogMaster.shelter_name || selectedDogMaster.shelter_id || "Central Shelter")}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Cage / Kennel Assignment:</strong>
                <div style={{ fontWeight: 700, color: "#1E3A8A" }}>{str(selectedDogMaster.kennel_assignment || "Unassigned")}</div>
              </div>
              <div style={{ background: "#FFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <strong style={{ color: "#64748B" }}>Medical Status:</strong>
                <div style={{ fontWeight: 700, color: "#15803D" }}>{str(selectedDogMaster.medical_status || "Pending Check")}</div>
              </div>
            </div>

            <div style={{ background: "#F3E8FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#6D28D9" }}>
                  Safety Tag Identification: {str(selectedDogMaster.tag_status_label || "ACTIVE")}
                </div>
                <div style={{ fontSize: "12px", color: "#4C1D95", marginTop: "2px" }}>
                  Token: {petService.formatSafetyToken(selectedDogMaster)}
                </div>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: "#6D28D9", color: "#FFF" }}>
                PERMANENT TAG
              </span>
            </div>

            {/* Medical History Section */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                🏥 Medical & Clinical Exam History ({petHistory.length})
              </div>
              {historyLoading ? (
                <div style={{ fontSize: "12px", color: "#64748B" }}>Loading history...</div>
              ) : petHistory.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#94A3B8" }}>No prior clinical exam history logged.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {petHistory.map((item, idx) => (
                    <div key={idx} style={{ fontSize: "12px", padding: "6px 10px", background: "#FFF", borderRadius: "6px", border: "1px solid #CBD5E1", display: "flex", justifyContent: "space-between" }}>
                      <span><strong>{str(item.categoryName || item.type)}:</strong> {str(item.diagnosis || item.treatment)}</span>
                      <span style={{ color: "#64748B" }}>{formatDate(item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
              {selectedDogMaster.is_fit_for_adoption || selectedDogMaster.is_adoptable || str(selectedDogMaster.medical_status).toLowerCase().includes("clear") ? (
                <span
                  style={{ padding: "9px 16px", borderRadius: "8px", background: "#ECFDF5", color: "#15803D", fontWeight: 800, fontSize: "13px", border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaCheckCircle /> Medically Cleared & Ready for Adoption
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isClearingAdoption}
                  onClick={() => handleIssueMedicalClearance(selectedDogMaster)}
                  style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaCheckCircle /> {isClearingAdoption ? "Clearing..." : "Issue Medical Clearance & Adoption Fitness"}
                </button>
              )}

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsDogProfileOpen(false);
                    handleOpenConsultation({ pet_id: selectedDogMaster.id || selectedDogMaster.dog_id, reason: selectedDogMaster.medical_status || "Shelter Exam" });
                  }}
                  style={{ padding: "9px 14px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <FaStethoscope /> Perform Examination
                </button>
                <button
                  type="button"
                  onClick={() => setIsDogProfileOpen(false)}
                  style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* VETERINARIAN CLINICAL MEDICAL RECORD DETAIL MODAL */}
      {selectedMedicalRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMedicalRecord(null)}
          title={`Clinical Record Details — ${str(selectedMedicalRecord.petName || dogName(pick(selectedMedicalRecord, "petId", "pet_id", "dog_id")))}`}
          maxWidth="680px"
        >
          {(() => {
            const petId = pick(selectedMedicalRecord, "petId", "pet_id", "dog_id");
            const petRec = getPetRecord(petId);
            const raw = (selectedMedicalRecord.raw as Row) || selectedMedicalRecord;
            const category = str(selectedMedicalRecord.categoryName || pick(selectedMedicalRecord, "category", "entityType", "type")) || "Clinical Exam";
            const dateStr = formatDate(pick(selectedMedicalRecord, "date", "created_at", "exam_date", "treatment_date", "administered_at"));
            const vetStr = str(selectedMedicalRecord.vetName) || ownerName(selectedMedicalRecord) || "Attending Veterinarian";

            const diagnosis = str(selectedMedicalRecord.diagnosis) || str(pick(raw, "triage_diagnosis", "diagnosis")) || "Clinical Examination";
            const treatment = str(selectedMedicalRecord.treatment) || str(pick(raw, "treatment_type", "description", "drug_name", "vaccine_name")) || "-";

            const bcs = pick(raw, "body_condition_score", "bcs");
            const dental = pick(raw, "dental_health");
            const coat = pick(raw, "coat_condition");
            const injuries = pick(raw, "visible_injuries");
            const notes = pick(raw, "vet_notes", "notes", "description", "post_op_notes", "ocular_aural_notes");

            const vaccineName = pick(raw, "vaccine_name");
            const lotNumber = pick(raw, "lot_number");
            const nextDue = pick(raw, "next_due_at");

            const drugName = pick(raw, "drug_name");
            const dosage = pick(raw, "dosage");
            const route = pick(raw, "route");

            const anesthesiaLog = pick(raw, "anesthesia_log");
            const postOpNotes = pick(raw, "post_op_notes");

            const medStatus = petRec?.medical_status
              ? str(petRec.medical_status)
              : selectedMedicalRecord.vet_clearance_status
              ? str(selectedMedicalRecord.vet_clearance_status)
              : "Active Clinical Record";

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Patient Overview Card */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                      {dogName(petId)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                      Dog ID: {str(petId || "-")}
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>
                      <strong>Breed:</strong> {petRec?.breed ? str(petRec.breed) : "-"} &bull; <strong>Gender:</strong> {petRec?.gender ? str(petRec.gender) : "-"}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #BFDBFE" }}>
                        {category}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      <strong>Date Recorded:</strong> {dateStr}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                      <strong>Veterinarian:</strong> {vetStr}
                    </div>
                  </div>
                </div>

                {/* Primary Diagnosis & Medical Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Primary Diagnosis / Exam
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                      {diagnosis}
                    </div>
                  </div>

                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Medical Status
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: medStatus.toLowerCase().includes("clear") ? "#15803D" : "#1E3A8A", display: "flex", alignItems: "center", gap: "6px" }}>
                      <FaHeartbeat /> {medStatus}
                    </div>
                  </div>
                </div>

                {/* Treatment / Medication / Surgery */}
                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                    Treatment, Medication &amp; Clinical Plan
                  </div>
                  <div style={{ fontSize: "14px", color: "#1E293B", fontWeight: 600 }}>
                    {treatment}
                  </div>

                  {(Boolean(drugName) || Boolean(dosage) || Boolean(route)) && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #E2E8F0", fontSize: "12px", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      <div><strong>Prescription:</strong> {str(drugName || "-")}</div>
                      <div><strong>Dosage:</strong> {str(dosage || "-")}</div>
                      <div><strong>Route:</strong> {str(route || "-")}</div>
                    </div>
                  )}

                  {(Boolean(vaccineName) || Boolean(lotNumber) || Boolean(nextDue)) && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #E2E8F0", fontSize: "12px", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      <div><strong>Vaccine:</strong> {str(vaccineName || "-")}</div>
                      <div><strong>Lot #:</strong> {str(lotNumber || "-")}</div>
                      <div><strong>Next Due:</strong> {nextDue ? formatDate(str(nextDue)) : "-"}</div>
                    </div>
                  )}

                  {(Boolean(anesthesiaLog) || Boolean(postOpNotes)) && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #E2E8F0", fontSize: "12px", color: "#475569" }}>
                      {Boolean(anesthesiaLog) && <div><strong>Anesthesia Log:</strong> {str(anesthesiaLog)}</div>}
                      {Boolean(postOpNotes) && <div style={{ marginTop: "4px" }}><strong>Post-Op Notes:</strong> {str(postOpNotes)}</div>}
                    </div>
                  )}
                </div>

                {/* Examination Vitals & Observations */}
                {(bcs !== undefined || Boolean(dental) || Boolean(coat) || Boolean(injuries)) && (
                  <div style={{ background: "#F1F5F9", padding: "14px", borderRadius: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "#334155" }}>
                    {bcs !== undefined && bcs !== null && <div><strong>Body Condition Score (BCS):</strong> {str(bcs)} / 9</div>}
                    {Boolean(dental) && <div><strong>Dental Health:</strong> {str(dental)}</div>}
                    {Boolean(coat) && <div><strong>Coat Condition:</strong> {str(coat)}</div>}
                    {Boolean(injuries) && <div><strong>Visible Injuries:</strong> {str(injuries)}</div>}
                  </div>
                )}

                {/* Veterinary Clinical Remarks */}
                {Boolean(notes) && (
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400E", textTransform: "uppercase", marginBottom: "4px" }}>
                      Attending Veterinarian Remarks &amp; Clinical Notes
                    </div>
                    <div style={{ fontSize: "13px", color: "#78350F", whiteSpace: "pre-wrap" }}>
                      {str(notes)}
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMedicalRecord(null)}
                    style={{ padding: "9px 20px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* SHELTER MEDICAL REQUEST DETAIL MODAL */}
      {selectedShelterRequest && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedShelterRequest(null)}
          title={`Shelter Medical Request — ${str(selectedShelterRequest.name || "Dog Patient")}`}
          maxWidth="680px"
        >
          {(() => {
            const petId = pick(selectedShelterRequest, "id", "dog_id", "pet_id");
            const dogNameStr = str(selectedShelterRequest.name) || "Dog Patient";
            const regNo = str(selectedShelterRequest.registration_number || petId || "-");
            const shelterName = str(selectedShelterRequest.shelter_name || selectedShelterRequest.shelter_id || "Central Shelter Facility");
            const requestDate = formatDate(pick(selectedShelterRequest, "created_at", "intake_date", "updated_at", "date"));
            const requestedBy = str(pick(selectedShelterRequest, "submitted_by", "requested_by", "shelter_staff", "handler_name")) || "Shelter Operations Team";

            const medStatus = str(selectedShelterRequest.medical_status) || "Pending Examination";
            const isCleared = medStatus.toLowerCase().includes("clear") || Boolean(selectedShelterRequest.is_fit_for_adoption || selectedShelterRequest.is_adoptable);

            const priorityStr = str(pick(selectedShelterRequest, "priority", "urgency", "severity")).toUpperCase() ||
              (medStatus.toLowerCase().includes("critical") || medStatus.toLowerCase().includes("urgent") ? "HIGH / URGENT" : "NORMAL");

            const medicalIssue = str(pick(selectedShelterRequest, "reason", "medical_notes", "issue", "chief_complaint", "medical_status")) || "Routine Clinical Examination & Triage";
            const symptoms = str(pick(selectedShelterRequest, "visible_injuries", "symptoms", "observations", "triage_notes", "notes")) || "None reported by shelter staff";
            const shelterNotes = str(pick(selectedShelterRequest, "shelter_notes", "notes", "description", "vetting_notes")) || "Standard shelter intake & clinical examination request.";
            const requestedExam = str(pick(selectedShelterRequest, "requested_exam", "examination_type", "type")) || "General Veterinary Check-up & Health Clearance";

            const requiresSurgery = Boolean(selectedShelterRequest.requires_surgery || str(selectedShelterRequest.treatment_type).toLowerCase().includes("surg") || selectedShelterRequest.surgery);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Header Overview Card */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                      {dogNameStr}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                      Registration #: {regNo}
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>
                      <strong>Breed:</strong> {str(selectedShelterRequest.breed || "-")} &bull; <strong>Gender:</strong> {str(selectedShelterRequest.gender || "-")}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: priorityStr.includes("HIGH") || priorityStr.includes("URGENT") ? "#FEF2F2" : "#F1F5F9", color: priorityStr.includes("HIGH") || priorityStr.includes("URGENT") ? "#DC2626" : "#475569" }}>
                        Priority: {priorityStr}
                      </span>
                      <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: isCleared ? "#ECFDF5" : "#EFF6FF", color: isCleared ? "#15803D" : "#1E3A8A" }}>
                        {isCleared ? "MEDICALLY CLEARED" : medStatus.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      <strong>Facility:</strong> {shelterName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                      <strong>Request Date:</strong> {requestDate}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                      <strong>Requested By:</strong> {requestedBy}
                    </div>
                  </div>
                </div>

                {/* Request Clinical Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Medical Issue / Reason for Request
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                      {medicalIssue}
                    </div>
                  </div>

                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Requested Examination / Check-up
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1E3A8A" }}>
                      {requestedExam}
                    </div>
                  </div>
                </div>

                {/* Observed Symptoms & Physical Findings */}
                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                    Observed Symptoms &amp; Physical Observations
                  </div>
                  <div style={{ fontSize: "13px", color: "#334155" }}>
                    {symptoms}
                  </div>
                </div>

                {/* Conditional Surgery Section - ONLY IF SURGERY IS APPLICABLE */}
                {requiresSurgery && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Surgical Procedure Required
                    </div>
                    <div style={{ fontSize: "13px", color: "#7F1D1D", fontWeight: 600 }}>
                      {str(selectedShelterRequest.treatment_type || selectedShelterRequest.surgery_type || "Surgical Procedure Required")}
                    </div>
                  </div>
                )}

                {/* Shelter Remarks / Notes */}
                {Boolean(shelterNotes) && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Shelter Notes &amp; Observations
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" }}>
                      {shelterNotes}
                    </div>
                  </div>
                )}

                {/* Clinical Workflow Action Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const targetRecord = selectedShelterRequest;
                      setSelectedShelterRequest(null);
                      if (targetRecord) handleOpenConsultation(targetRecord);
                    }}
                    style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaStethoscope /> Perform Examination &amp; Record Findings
                  </button>

                  <div style={{ display: "flex", gap: "10px" }}>
                    {!isCleared && (
                      <button
                        type="button"
                        disabled={isClearingAdoption}
                        onClick={() => {
                          const targetRecord = selectedShelterRequest;
                          setSelectedShelterRequest(null);
                          handleIssueMedicalClearance(targetRecord);
                        }}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaCheckCircle /> Issue Medical Clearance
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedShelterRequest(null)}
                      style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* PUBLIC WEBSITE APPOINTMENT DETAIL MODAL FOR VETERINARIAN DASHBOARD */}
      {selectedPublicAppt && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPublicAppt(null)}
          title={`Veterinary Appointment Details`}
          maxWidth="640px"
        >
          {(() => {
            const petId = pick(selectedPublicAppt, "pet_id", "dog_id", "animal_id");
            const petRec = getPetRecord(petId);
            const petNameStr = dogName(selectedPublicAppt);
            const ownerStr = ownerName(selectedPublicAppt);
            const clinicStr = clinicName(selectedPublicAppt);
            const vetStr = vetName(selectedPublicAppt);

            const apptId = formatApptId(selectedPublicAppt.id, selectedPublicAppt);
            const status = str(pick(selectedPublicAppt, "status") || "pending");
            const dateStr = formatDate(pick(selectedPublicAppt, "starts_at", "date", "created_at"));
            const reason = str(pick(selectedPublicAppt, "reason")) || "General Checkup / Consultation";
            const source = str(pick(selectedPublicAppt, "source", "channel", "platform", "booking_source"));
            const notes = str(pick(selectedPublicAppt, "notes", "comments", "description"));
            const userEmail = str(pick(selectedPublicAppt, "user_email", "email", "owner_email"));
            const userPhone = str(pick(selectedPublicAppt, "user_phone", "phone", "owner_phone", "contact"));

            const canCancel = status.toLowerCase() !== "cancelled" && status.toLowerCase() !== "completed" && status.toLowerCase() !== "no_show";
            const canConfirm = status.toLowerCase() === "requested" || status.toLowerCase() === "pending";

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Patient & Submitter Summary Banner */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                      🐶 {petNameStr}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                      {petRec?.registration_number ? `Registration: ${str(petRec.registration_number)}` : isUuid(petId) ? `ID: ${str(petId).slice(0, 8).toUpperCase()}` : `ID: ${str(petId || "-")}`}
                    </div>
                    {petRec && (
                      <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>
                        <strong>Breed:</strong> {str(petRec.breed || "-")} &bull; <strong>Gender:</strong> {str(petRec.gender || "-")}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                      {renderStatusBadge(status)}
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155" }}>
                      <strong>Owner / Submitter:</strong> {ownerStr}
                    </div>
                    {userEmail && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Email: {userEmail}</div>}
                    {userPhone && <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Phone: {userPhone}</div>}
                  </div>
                </div>

                {/* Appointment Context Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Appointment ID &amp; Time
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>
                      {apptId}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                      {dateStr}
                    </div>
                  </div>

                  <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Clinic &amp; Assigned Veterinarian
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>
                      {clinicStr}
                    </div>
                    <div style={{ fontSize: "12px", color: "#1E3A8A", fontWeight: 600, marginTop: "4px" }}>
                      Vet: {vetStr}
                    </div>
                  </div>
                </div>

                {/* Reason for Visit & Source */}
                <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Reason for Visit
                    </div>
                    {source && (
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EFF6FF", color: "#1E3A8A" }}>
                        Channel: {source.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1E293B" }}>
                    {reason}
                  </div>
                </div>

                {/* Submitter Notes */}
                {notes && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Submitter Notes &amp; Clinical Context
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" }}>
                      {notes}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const targetRecord = selectedPublicAppt;
                      setSelectedPublicAppt(null);
                      if (targetRecord) handleOpenConsultation(targetRecord);
                    }}
                    style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#1E3A8A", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaStethoscope /> Start Consultation
                  </button>

                  <div style={{ display: "flex", gap: "10px" }}>
                    {canConfirm && (
                      <button
                        type="button"
                        disabled={confirmingId === apptId}
                        onClick={() => {
                          const target = selectedPublicAppt;
                          setSelectedPublicAppt(null);
                          void handleConfirm(target);
                        }}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #6EE7B7", background: "#FFF", color: "#15803D", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaCheckCircle /> {confirmingId === apptId ? "Confirming..." : "Confirm Appointment"}
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedPublicAppt;
                          setSelectedPublicAppt(null);
                          setCancelTarget(target);
                        }}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #FCA5A5", background: "#FFF", color: "#DC2626", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaBan /> Cancel Appointment
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedPublicAppt(null)}
                      style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

export default VeterinarianDashboard;
