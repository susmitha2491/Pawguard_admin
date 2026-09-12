import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Column } from "../../components/common/DataTable";
import DataTable from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import { usePermissions } from "../../context/PermissionContext";
import Can from "../../components/rbac/Can";
import axios from "axios";
import {
  FaHospital,
  FaCalendarAlt,
  FaCheck,
  FaBan,
  FaSearch,
  FaStethoscope,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaExclamationTriangle,
} from "react-icons/fa";
import vetService, { type VetClinicPayload } from "../../services/vetService";
import petService from "../../services/petService";
import userService from "../../services/userService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";

type Row = Record<string, unknown>;

const pick = (row: Row, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const toErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as {
    response?: {
      status?: number;
      data?: {
        detail?: string | Array<{ msg?: string; loc?: string[] }>;
        message?: string;
        error?: string | { message?: string; details?: unknown };
      };
    };
    message?: string;
  };

  const res = e?.response;
  if (res?.status === 403) {
    const backendMsg =
      (typeof res.data?.error === "object" ? res.data?.error?.message : undefined) ||
      (typeof res.data?.error === "string" ? res.data?.error : undefined) ||
      (typeof res.data?.detail === "string" ? res.data?.detail : undefined) ||
      res.data?.message;
    if (backendMsg) return backendMsg;
    return "You do not have permission to manage veterinary clinics.";
  }

  if (res?.data) {
    if (typeof res.data.error === "object" && res.data.error?.message) {
      return res.data.error.message;
    }
    if (typeof res.data.error === "string") {
      return res.data.error;
    }
    if (typeof res.data.detail === "string") {
      return res.data.detail;
    }
    if (Array.isArray(res.data.detail) && res.data.detail[0]?.msg) {
      return res.data.detail.map((d) => d.msg).join(", ");
    }
    if (res.data.message) {
      return res.data.message;
    }
  }
  return e?.message || fallback;
};

const formatDate = (v: unknown): string => formatDateTime(v as string);

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  display: "inline-block",
  textTransform: "capitalize",
});

const isUuid = (v: unknown): boolean =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

interface ClinicFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  services: string;
  latitude: string;
  longitude: string;
  is_emergency: boolean;
  is_active: boolean;
}

const initialClinicFormData: ClinicFormData = {
  name: "",
  address: "",
  phone: "",
  email: "",
  services: "",
  latitude: "",
  longitude: "",
  is_emergency: false,
  is_active: true,
};

const VetAppointments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<"directory" | "appointments">(
    tabParam === "directory" ? "directory" : "appointments"
  );

  const { role, has, can } = usePermissions();
  const { addToast } = useToast();

  const canManageClinics =
    role === "super_admin" ||
    role === "rescue_centre_admin" ||
    role === "veterinarian" ||
    can("create", "medical") ||
    can("edit", "medical") ||
    can("manage", "medical") ||
    has("create_medical") ||
    has("edit_medical") ||
    has("manage_medical") ||
    has("vet_clinic:manage");

  const canDeleteClinics =
    role === "super_admin" ||
    role === "rescue_centre_admin" ||
    can("delete", "medical") ||
    can("manage", "medical") ||
    has("delete_medical") ||
    has("manage_medical") ||
    has("vet_clinic:manage");

  // Vet directory state
  const [clinics, setClinics] = useState<Row[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicsError, setClinicsError] = useState<string | null>(null);
  const [clinicSearch, setClinicSearch] = useState("");

  // Add / Edit Clinic modal state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Row | null>(null);
  const [clinicFormData, setClinicFormData] = useState<ClinicFormData>(initialClinicFormData);
  const [clinicFormErrors, setClinicFormErrors] = useState<Record<string, string>>({});
  const [isSavingClinic, setIsSavingClinic] = useState(false);

  // Clinic Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewingClinic, setViewingClinic] = useState<Row | null>(null);
  const [clinicDoctors, setClinicDoctors] = useState<Row[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // Delete Clinic Modal State
  const [deleteTargetClinic, setDeleteTargetClinic] = useState<Row | null>(null);
  const [isDeletingClinic, setIsDeletingClinic] = useState(false);

  // Appointments state
  const [appointments, setAppointments] = useState<Row[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Row | null>(null);
  const [apptPage, setApptPage] = useState(1);
  const [apptTotal, setApptTotal] = useState(0);

  // Dog Management data used for appointment pet selection + display
  const [dogs, setDogs] = useState<Row[]>([]);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Explicit lookup Maps for deterministic O(1) resolution
  const [userMap, setUserMap] = useState<Map<string, Row>>(new Map());
  const [petMap, setPetMap] = useState<Map<string, Row>>(new Map());
  const [clinicMap, setClinicMap] = useState<Map<string, Row>>(new Map());

  const fetchClinics = useCallback(async (search: string) => {
    try {
      setClinicsLoading(true);
      setClinicsError(null);
      const res = await vetService.getClinics({
        search: search.trim() || undefined,
        page: 1,
        page_size: 50,
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setClinics(list);

      const map = new Map<string, Row>();
      list.forEach((c: Row) => {
        const id = str(pick(c, "id", "clinic_id")).trim().toLowerCase();
        if (id) map.set(id, c);
      });
      setClinicMap(map);
    } catch (err) {
      if (axios.isCancel(err)) return;
      setClinicsError(toErrorMessage(err, "Failed to load veterinary clinics."));
    } finally {
      setClinicsLoading(false);
    }
  }, []);

  const fetchAppointments = useCallback(async (pageNum = 1) => {
    try {
      setAppointmentsLoading(true);
      setAppointmentsError(null);
      const res = await vetService.getAppointments({ page: pageNum, page_size: 50 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setAppointments(list);
      setApptPage(pageNum);
      const total = Number((res?.meta as Record<string, unknown>)?.total || list.length);
      setApptTotal(total);

      // Collect all distinct owner/user UUIDs to resolve real names dynamically
      const ownerIds = new Set<string>();
      list.forEach((r: Row) => {
        const oId = str(pick(r, "owner_id", "user_id", "submitter_id", "client_id")).trim().toLowerCase();
        if (oId && isUuid(oId)) ownerIds.add(oId);
      });

      if (ownerIds.size > 0) {
        const newUsers = new Map<string, Row>();
        const missingIds: string[] = [];
        setUserMap((prevMap) => {
          ownerIds.forEach((id) => {
            if (!prevMap.has(id)) missingIds.push(id);
          });
          return prevMap;
        });

        if (missingIds.length > 0) {
          const chunkSize = 4;
          for (let i = 0; i < missingIds.length; i += chunkSize) {
            const chunk = missingIds.slice(i, i + chunkSize);
            await Promise.all(
              chunk.map(async (id) => {
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
          }
        }

        if (newUsers.size > 0) {
          setUserMap((prev) => {
            const merged = new Map(prev);
            newUsers.forEach((v, k) => merged.set(k, v));
            return merged;
          });
        }
      }
    } catch (err: unknown) {
      if (axios.isCancel(err)) return;
      const errObj = err as { response?: { status?: number } };
      if (errObj?.response?.status === 429 || String(err).includes("429")) {
        setAppointmentsError("Server rate limit reached (HTTP 429). Please wait a moment and click Retry Loading.");
      } else {
        setAppointmentsError(toErrorMessage(err, "Failed to load appointments."));
      }
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  const fetchDogs = useCallback(async () => {
    try {
      const res = await petService.getAllDogs();
      const list = Array.isArray(res?.data) ? res.data : [];
      setDogs(list);

      const map = new Map<string, Row>();
      list.forEach((d: Row) => {
        const id1 = str(pick(d, "id")).trim().toLowerCase();
        const id2 = str(pick(d, "dog_id")).trim().toLowerCase();
        const id3 = str(pick(d, "pet_id")).trim().toLowerCase();
        const id4 = str(pick(d, "original_dog_id")).trim().toLowerCase();
        const reg = str(pick(d, "registration_number")).trim().toLowerCase();
        if (id1) map.set(id1, d);
        if (id2) map.set(id2, d);
        if (id3) map.set(id3, d);
        if (id4) map.set(id4, d);
        if (reg) map.set(reg, d);
      });
      setPetMap(map);
    } catch {
      setDogs([]);
    }
  }, []);

  useEffect(() => {
    if (tabParam === "directory") {
      setActiveTab("directory");
    }
  }, [tabParam]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!isMounted) return;
      await fetchDogs();
      if (!isMounted) return;
      await fetchAppointments(1);
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, [fetchDogs, fetchAppointments]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchClinics(clinicSearch);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [clinicSearch, fetchClinics]);

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

  const handleOpenAddClinic = () => {
    setEditingClinic(null);
    setClinicFormData(initialClinicFormData);
    setClinicFormErrors({});
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditClinic = (clinic: Row) => {
    setEditingClinic(clinic);
    setClinicFormData({
      name: str(pick(clinic, "name", "clinic_name")),
      address: str(pick(clinic, "address", "location")),
      phone: str(pick(clinic, "phone", "contact_phone")),
      email: str(pick(clinic, "email")),
      services: str(pick(clinic, "services", "specialization")),
      latitude: clinic.latitude !== null && clinic.latitude !== undefined ? String(clinic.latitude) : "",
      longitude: clinic.longitude !== null && clinic.longitude !== undefined ? String(clinic.longitude) : "",
      is_emergency: Boolean(clinic.is_emergency),
      is_active: clinic.is_active !== false,
    });
    setClinicFormErrors({});
    setIsAddEditModalOpen(true);
  };

  const handleOpenClinicDetails = async (clinic: Row) => {
    setViewingClinic(clinic);
    setIsDetailsModalOpen(true);
    const clinicId = str(pick(clinic, "id", "clinic_id"));
    if (!clinicId) return;
    try {
      setDoctorsLoading(true);
      const docs = await vetService.getClinicVeterinarians(clinicId);
      setClinicDoctors(Array.isArray(docs?.data) ? (docs.data as Row[]) : Array.isArray(docs) ? (docs as Row[]) : []);
    } catch {
      setClinicDoctors([]);
    } finally {
      setDoctorsLoading(false);
    }
  };

  const validateClinicForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!clinicFormData.name.trim()) {
      errors.name = "Clinic name is required.";
    } else if (clinicFormData.name.trim().length > 255) {
      errors.name = "Clinic name cannot exceed 255 characters.";
    }

    if (!clinicFormData.address.trim()) {
      errors.address = "Clinic address is required.";
    } else if (clinicFormData.address.trim().length > 2000) {
      errors.address = "Address cannot exceed 2000 characters.";
    }

    if (!clinicFormData.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (clinicFormData.phone.trim().length < 3) {
      errors.phone = "Phone number must be at least 3 characters.";
    } else if (clinicFormData.phone.trim().length > 32) {
      errors.phone = "Phone number cannot exceed 32 characters.";
    }

    if (clinicFormData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clinicFormData.email.trim())) {
        errors.email = "Please enter a valid email address.";
      }
    }

    if (clinicFormData.latitude.trim()) {
      const lat = Number(clinicFormData.latitude.trim());
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.latitude = "Latitude must be a valid number between -90 and 90.";
      }
    }

    if (clinicFormData.longitude.trim()) {
      const lng = Number(clinicFormData.longitude.trim());
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.longitude = "Longitude must be a valid number between -180 and 180.";
      }
    }

    setClinicFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClinicForm()) return;

    try {
      setIsSavingClinic(true);
      const payload: VetClinicPayload = {
        name: clinicFormData.name.trim(),
        address: clinicFormData.address.trim(),
        phone: clinicFormData.phone.trim(),
        email: clinicFormData.email.trim() || null,
        services: clinicFormData.services.trim() || null,
        latitude: clinicFormData.latitude.trim() ? Number(clinicFormData.latitude.trim()) : null,
        longitude: clinicFormData.longitude.trim() ? Number(clinicFormData.longitude.trim()) : null,
        is_emergency: Boolean(clinicFormData.is_emergency),
        is_active: Boolean(clinicFormData.is_active),
      };

      if (editingClinic) {
        const clinicId = str(pick(editingClinic, "id", "clinic_id"));
        await vetService.updateClinic(clinicId, payload);
        addToast("Veterinary clinic updated successfully.", "success");
      } else {
        await vetService.createClinic(payload);
        addToast("Veterinary clinic added successfully.", "success");
      }

      setIsAddEditModalOpen(false);
      setEditingClinic(null);
      setClinicFormData(initialClinicFormData);
      void fetchClinics(clinicSearch);
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to save veterinary clinic."), "error");
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleDeleteClinic = async () => {
    if (!deleteTargetClinic) return;
    const clinicId = str(pick(deleteTargetClinic, "id", "clinic_id"));
    if (!clinicId) return;

    try {
      setIsDeletingClinic(true);
      await vetService.deleteClinic(clinicId);
      addToast("Veterinary clinic removed successfully.", "success");
      setDeleteTargetClinic(null);
      void fetchClinics(clinicSearch);
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to delete veterinary clinic."), "error");
    } finally {
      setIsDeletingClinic(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const id = str(pick(cancelTarget, "id", "appointment_id"));
    if (!id) return;
    try {
      setIsCancelling(true);
      await vetService.cancelAppointment(id, cancelReason.trim() || undefined);
      addToast("Appointment cancelled successfully.", "success");
      setCancelTarget(null);
      setCancelReason("");
      void fetchAppointments();
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to cancel appointment."), "error");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirm = async (row: Row) => {
    const id = str(pick(row, "id", "appointment_id"));
    if (!id) return;
    try {
      setConfirmingId(id);
      await vetService.confirmAppointment(id);
      addToast("Appointment confirmed.", "success");
      void fetchAppointments();
      notifyDataChanged();
    } catch (err) {
      addToast(toErrorMessage(err, "Failed to confirm appointment."), "error");
    } finally {
      setConfirmingId(null);
    }
  };

  const renderStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === "confirmed" || s === "completed") return <span style={badgeStyle("#ECFDF5", "#10B981")}>{status}</span>;
    if (s === "requested" || s === "pending") return <span style={badgeStyle("#FFFBEB", "#F59E0B")}>{status}</span>;
    if (s === "cancelled") return <span style={badgeStyle("#FEF2F2", "#EF4444")}>{status}</span>;
    if (s === "no_show") return <span style={badgeStyle("#F1F5F9", "#64748B")}>{status}</span>;
    return <span style={badgeStyle("#F1F5F9", "#475569")}>{status}</span>;
  };

  const directoryColumns: Column[] = [
    {
      key: "name",
      title: "Clinic / Hospital",
      render: (v, r) => {
        const isEmergency = Boolean(pick(r, "is_emergency"));
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{str(v) || "Unnamed Clinic"}</span>
              {isEmergency && (
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 800,
                    background: "#FEF2F2",
                    color: "#DC2626",
                    border: "1px solid #FECACA",
                  }}
                >
                  24/7 EMERGENCY
                </span>
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
              ID: {str(pick(r, "id", "clinic_id")).slice(0, 8).toUpperCase() || "-"}
            </div>
          </div>
        );
      },
    },
    {
      key: "services",
      title: "Services & Specialization",
      render: (v) => {
        const servicesStr = str(v);
        if (!servicesStr) return <span style={{ color: "#94A3B8" }}>Standard Veterinary Care</span>;
        const items = servicesStr.split(",").map((s) => s.trim()).filter(Boolean);
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "280px" }}>
            {items.slice(0, 3).map((item, i) => (
              <span
                key={i}
                style={{
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "#F1F5F9",
                  color: "#334155",
                  border: "1px solid #E2E8F0",
                }}
              >
                {item}
              </span>
            ))}
            {items.length > 3 && (
              <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, alignSelf: "center" }}>
                +{items.length - 3} more
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "phone",
      title: "Contact Information",
      render: (v, r) => {
        const email = str(pick(r, "email"));
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
              <FaPhone size={11} color="#64748B" />
              <span>{str(v) || "-"}</span>
            </div>
            {email && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
                <FaEnvelope size={10} color="#94A3B8" />
                <span>{email}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "address",
      title: "Location & Coordinates",
      render: (v, r) => {
        const lat = pick(r, "latitude");
        const lng = pick(r, "longitude");
        return (
          <div style={{ maxWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", fontSize: "13px", color: "#334155" }}>
              <FaMapMarkerAlt size={12} color="#DC2626" style={{ marginTop: "3px", flexShrink: 0 }} />
              <span>{str(v) || "-"}</span>
            </div>
            {lat !== undefined && lng !== undefined && lat !== null && lng !== null && (
              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px", marginLeft: "18px", fontFamily: "monospace" }}>
                GPS: {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "is_emergency",
      title: "Facility Type",
      render: (v) => (
        <span style={badgeStyle(v ? "#FEF2F2" : "#EFF6FF", v ? "#DC2626" : "#2563EB")}>
          {v ? "Emergency 24/7" : "General Clinic"}
        </span>
      ),
    },
    {
      key: "is_active",
      title: "Status",
      render: (v) => {
        const active = v !== false;
        return (
          <span style={badgeStyle(active ? "#ECFDF5" : "#F1F5F9", active ? "#059669" : "#64748B")}>
            {active ? "Active" : "Inactive"}
          </span>
        );
      },
    },
  ];

  const appointmentColumns: Column[] = [
    { key: "id", title: "Appt ID", render: (v, r) => formatApptId(v, r) },
    {
      key: "pet_id",
      title: "Dog / Pet",
      render: (_, r) => {
        const nameStr = dogName(r);
        const petRec = getPetRecord(r);
        const regNo = petRec ? str(petRec.registration_number) : "";
        const pId = pick(r, "pet_id", "dog_id", "animal_id");
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
    {
      key: "owner",
      title: "Owner / Submitter",
      render: (_, r) => {
        const nameStr = ownerName(r);
        const email = pick(r, "user_email", "email", "owner_email");
        const phone = pick(r, "user_phone", "phone", "contact");
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#1E293B" }}>{nameStr}</div>
            {Boolean(email) && <div style={{ fontSize: "12px", color: "#64748B" }}>{str(email)}</div>}
            {Boolean(phone) && !email && <div style={{ fontSize: "12px", color: "#64748B" }}>{str(phone)}</div>}
          </div>
        );
      },
    },
    { key: "clinic_id", title: "Clinic", render: (_, r) => clinicName(r) },
    { key: "vet", title: "Requested / Assigned Vet", render: (_, r) => vetName(r) },
    { key: "starts_at", title: "Date & Time", render: (v) => formatDate(v) },
    { key: "reason", title: "Reason for Visit", render: (v) => str(v) || "-" },
    {
      key: "source",
      title: "Source / Channel",
      render: (_, r) => {
        const src = pick(r, "source", "channel", "platform", "booking_source");
        return (
          <span style={badgeStyle("#EFF6FF", "#1D4ED8")}>{String(src || "PUBLIC_WEB").toUpperCase()}</span>
        );
      },
    },
    { key: "notes", title: "Notes", render: (v) => str(v) || "-" },
    { key: "status", title: "Status", render: (v) => renderStatus(str(v)) },
  ];

  const appointmentRowActions = (row: Row) => {
    const status = str(pick(row, "status")).toLowerCase();
    const id = str(pick(row, "id", "appointment_id"));
    const canCancel = status !== "cancelled" && status !== "completed" && status !== "no_show";
    return (
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        {(status === "requested" || status === "pending" || status === "confirmed") && (
          <Can permission="edit_medical">
            <button
              onClick={() => {
                const pId = str(pick(row, "pet_id", "dog_id", "animal_id"));
                navigate(`/dashboard/veterinarian?dog_id=${encodeURIComponent(pId)}&tab=public_appts`);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: "#2563EB",
                color: "#FFFFFF",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FaStethoscope /> Consultation
            </button>
          </Can>
        )}
        {(status === "requested" || status === "pending") && (
          <Can permission="edit_medical">
            <button
              onClick={() => void handleConfirm(row)}
              disabled={confirmingId === id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #6EE7B7",
                background: "#FFFFFF",
                color: "#047857",
                fontSize: "12px",
                fontWeight: 600,
                cursor: confirmingId === id ? "not-allowed" : "pointer",
              }}
            >
              <FaCheck /> {confirmingId === id ? "Confirming..." : "Confirm"}
            </button>
          </Can>
        )}
        {canCancel && (
          <Can permission="edit_medical">
            <button
              onClick={() => setCancelTarget(row)}
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
              <FaBan /> Cancel
            </button>
          </Can>
        )}
      </div>
    );
  };

  const directoryRowActions = (row: Row) => {
    return (
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "nowrap" }}>
        <button
          type="button"
          onClick={() => void handleOpenClinicDetails(row)}
          title="View Clinic Details & Doctors"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #93C5FD",
            background: "#EFF6FF",
            color: "#1D4ED8",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <FaEye size={12} /> Details
        </button>

        {canManageClinics && (
          <button
            type="button"
            onClick={() => handleOpenEditClinic(row)}
            title="Edit Clinic Information"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#334155",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FaEdit size={12} /> Edit
          </button>
        )}

        {canDeleteClinics && (
          <button
            type="button"
            onClick={() => setDeleteTargetClinic(row)}
            title="Delete / Remove Clinic"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #FECACA",
              background: "#FFF1F2",
              color: "#DC2626",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FaTrash size={12} /> Delete
          </button>
        )}
      </div>
    );
  };

  const tabStyle = (tab: "directory" | "appointments"): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 18px",
    borderRadius: "8px",
    border: "1px solid #CBD5E1",
    background: activeTab === tab ? "#2563EB" : "#FFFFFF",
    color: activeTab === tab ? "#FFFFFF" : "#475569",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  });

  return (
    <div>
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>
          Veterinary Appointments &amp; Clinic Management
        </h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Manage incoming veterinary consultations, appointment queues, and authoritative partner clinic directory.
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", marginTop: "16px" }}>
        <button onClick={() => setActiveTab("appointments")} style={tabStyle("appointments")}>
          <FaCalendarAlt /> Received Appointments ({apptTotal})
        </button>
        <button onClick={() => setActiveTab("directory")} style={tabStyle("directory")}>
          <FaHospital /> Vet Directory &amp; Clinics ({clinics.length})
        </button>
      </div>

      {activeTab === "appointments" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                Received Appointments
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Appointments submitted by PawGuard users through supported web and mobile channels.
              </p>
            </div>
            {appointmentsLoading && (
              <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>
                Loading appointments...
              </span>
            )}
          </div>
          <DataTable
            columns={appointmentColumns}
            data={appointments}
            module="medical"
            loading={appointmentsLoading}
            error={appointmentsError}
            onRetry={() => void fetchAppointments(apptPage)}
            onRowClick={(row) => setSelectedAppointment(row)}
            onView={(row) => setSelectedAppointment(row)}
            renderRowActions={appointmentRowActions}
            emptyMessage="No appointments received yet."
            pageSize={50}
            serverMode={true}
            totalCount={apptTotal}
            page={apptPage}
            onPageChange={(p) => void fetchAppointments(p)}
          />
        </div>
      )}

      {activeTab === "directory" && (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
                Veterinary Clinics &amp; Hospitals
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                Active partner clinics available for veterinary appointments, emergency dispatches, and public directory listings.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: "260px" }}>
                <FaSearch
                  size={14}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search clinics by name, address, services..."
                  value={clinicSearch}
                  onChange={(e) => setClinicSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {canManageClinics && (
                <button
                  type="button"
                  onClick={handleOpenAddClinic}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  <FaPlus size={12} /> Add Veterinary Clinic
                </button>
              )}
            </div>
          </div>

          <DataTable
            columns={directoryColumns}
            data={clinics}
            module="medical"
            loading={clinicsLoading}
            error={clinicsError}
            onRetry={() => void fetchClinics(clinicSearch)}
            emptyMessage="No veterinary clinics found in the directory."
            renderRowActions={directoryRowActions}
            onRowClick={(row) => void handleOpenClinicDetails(row)}
          />
        </div>
      )}

      {/* ADD / EDIT VETERINARY CLINIC MODAL */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isSavingClinic) {
              setIsAddEditModalOpen(false);
              setEditingClinic(null);
            }
          }}
          title={editingClinic ? `Edit Clinic — ${str(pick(editingClinic, "name"))}` : "Add New Veterinary Clinic"}
          maxWidth="680px"
        >
          <form onSubmit={handleSaveClinic} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                Registered clinics are stored in the authoritative backend database and automatically synchronized with the Public Website and Mobile App directories.
              </div>
            </div>

            {/* Section 1: Basic Information */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                  Clinic / Hospital Name <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., PawGuard Central Veterinary Hospital"
                  value={clinicFormData.name}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: clinicFormErrors.name ? "1px solid #DC2626" : "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {clinicFormErrors.name && (
                  <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {clinicFormErrors.name}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Contact Information */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                  Primary Phone Number <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., +1-555-0199 or 9876543210"
                  value={clinicFormData.phone}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, phone: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: clinicFormErrors.phone ? "1px solid #DC2626" : "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {clinicFormErrors.phone && (
                  <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {clinicFormErrors.phone}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g., info@centralvet.example.com"
                  value={clinicFormData.email}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, email: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: clinicFormErrors.email ? "1px solid #DC2626" : "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {clinicFormErrors.email && (
                  <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {clinicFormErrors.email}
                  </span>
                )}
              </div>
            </div>

            {/* Section 3: Physical Location */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                Full Physical Address <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                rows={2}
                placeholder="e.g., 108 Compassion Way, Sector 4, Hyderabad, 500081"
                value={clinicFormData.address}
                onChange={(e) => setClinicFormData({ ...clinicFormData, address: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: clinicFormErrors.address ? "1px solid #DC2626" : "1px solid #CBD5E1",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              {clinicFormErrors.address && (
                <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                  {clinicFormErrors.address}
                </span>
              )}
            </div>

            {/* Section 4: GPS Coordinates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                  Latitude (-90 to 90)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 17.4485"
                  value={clinicFormData.latitude}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, latitude: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: clinicFormErrors.latitude ? "1px solid #DC2626" : "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {clinicFormErrors.latitude && (
                  <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {clinicFormErrors.latitude}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                  Longitude (-180 to 180)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 78.3908"
                  value={clinicFormData.longitude}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, longitude: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: clinicFormErrors.longitude ? "1px solid #DC2626" : "1px solid #CBD5E1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {clinicFormErrors.longitude && (
                  <span style={{ fontSize: "12px", color: "#DC2626", marginTop: "4px", display: "block" }}>
                    {clinicFormErrors.longitude}
                  </span>
                )}
              </div>
            </div>

            {/* Section 5: Services Offered */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1E293B", marginBottom: "6px" }}>
                Services &amp; Specializations (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g., 24/7 Emergency, Orthopedic Surgery, Vaccination, Radiology, ICU, Dental Care"
                value={clinicFormData.services}
                onChange={(e) => setClinicFormData({ ...clinicFormData, services: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "12px", color: "#64748B", marginTop: "4px", display: "block" }}>
                Tip: Enter distinct services separated by commas so they display as tags on the public directory.
              </span>
            </div>

            {/* Section 6: Options & Flags */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", background: "#F1F5F9", borderRadius: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#1E293B", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicFormData.is_emergency}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, is_emergency: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>24/7 Emergency Care Facility</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#1E293B", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={clinicFormData.is_active}
                  onChange={(e) => setClinicFormData({ ...clinicFormData, is_active: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>Active &amp; Published in Directory</span>
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                disabled={isSavingClinic}
                onClick={() => {
                  setIsAddEditModalOpen(false);
                  setEditingClinic(null);
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isSavingClinic ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSavingClinic}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isSavingClinic ? "not-allowed" : "pointer",
                }}
              >
                {isSavingClinic ? (
                  <span>Saving to Database...</span>
                ) : editingClinic ? (
                  <>
                    <FaCheck /> Save Changes
                  </>
                ) : (
                  <>
                    <FaPlus /> Save &amp; Publish Clinic
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CLINIC DETAILS & DOCTORS MODAL */}
      {isDetailsModalOpen && viewingClinic && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setViewingClinic(null);
            setClinicDoctors([]);
          }}
          title={`Clinic Details — ${str(pick(viewingClinic, "name"))}`}
          maxWidth="650px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Overview Header Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)",
                border: "1px solid #DBEAFE",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  🏥 {str(pick(viewingClinic, "name"))}
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", fontFamily: "monospace", marginTop: "2px" }}>
                  Database ID: {str(pick(viewingClinic, "id", "clinic_id"))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {Boolean(pick(viewingClinic, "is_emergency")) && (
                  <span style={badgeStyle("#FEF2F2", "#DC2626")}>24/7 Emergency</span>
                )}
                <span
                  style={badgeStyle(
                    pick(viewingClinic, "is_active") !== false ? "#ECFDF5" : "#F1F5F9",
                    pick(viewingClinic, "is_active") !== false ? "#059669" : "#64748B"
                  )}
                >
                  {pick(viewingClinic, "is_active") !== false ? "Active Status" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Contact & Location Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                  Contact Information
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                  <FaPhone size={12} color="#2563EB" />
                  <span>{str(pick(viewingClinic, "phone")) || "No phone listed"}</span>
                </div>
                {Boolean(pick(viewingClinic, "email")) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                    <FaEnvelope size={11} color="#64748B" />
                    <span>{str(pick(viewingClinic, "email"))}</span>
                  </div>
                )}
              </div>

              <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                  Address &amp; GPS
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "#1E293B" }}>
                  <FaMapMarkerAlt size={12} color="#DC2626" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <span>{str(pick(viewingClinic, "address")) || "Address not provided"}</span>
                </div>
                {viewingClinic.latitude !== null && viewingClinic.longitude !== null && viewingClinic.latitude !== undefined && (
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", marginLeft: "20px", fontFamily: "monospace" }}>
                    Coords: {String(viewingClinic.latitude)}, {String(viewingClinic.longitude)}
                  </div>
                )}
              </div>
            </div>

            {/* Services Offered */}
            {Boolean(pick(viewingClinic, "services")) && (
              <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "8px" }}>
                  Services &amp; Clinical Facilities
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {str(pick(viewingClinic, "services"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((item, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: "#EFF6FF",
                          color: "#1E40AF",
                          border: "1px solid #BFDBFE",
                        }}
                      >
                        ✓ {item}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Doctors / Veterinarians Roster */}
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                Associated Doctors &amp; Medical Staff
              </div>

              {doctorsLoading ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#2563EB", fontSize: "13px" }}>
                  Loading registered veterinarians...
                </div>
              ) : clinicDoctors.length === 0 ? (
                <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "16px", textAlign: "center", color: "#64748B", fontSize: "13px", border: "1px solid #E2E8F0" }}>
                  No individual doctor profiles registered for this clinic location yet.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {clinicDoctors.map((doc: Row, idx: number) => (
                    <div key={idx} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#0F172A" }}>
                          {str(pick(doc, "name", "full_name")) || `Dr. Specialist #${idx + 1}`}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                          {str(pick(doc, "specialization", "services")) || "General Veterinary Practitioner"} &bull; Phone: {str(pick(doc, "phone")) || "-"}
                        </div>
                      </div>
                      <span style={badgeStyle("#ECFDF5", "#059669")}>{str(pick(doc, "status")) || "Active"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              {canManageClinics && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingClinic;
                    setIsDetailsModalOpen(false);
                    setViewingClinic(null);
                    handleOpenEditClinic(target);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <FaEdit /> Edit Clinic Information
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setViewingClinic(null);
                  setClinicDoctors([]);
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {deleteTargetClinic && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!isDeletingClinic) setDeleteTargetClinic(null);
          }}
          title="Confirm Clinic Removal"
          maxWidth="460px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px", borderRadius: "10px" }}>
                <FaExclamationTriangle size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                  Remove &ldquo;{str(pick(deleteTargetClinic, "name"))}&rdquo;?
                </p>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#64748B" }}>
                  This will remove the clinic from active database directories, public appointment booking, and companion pet services.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                disabled={isDeletingClinic}
                onClick={() => setDeleteTargetClinic(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isDeletingClinic ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingClinic}
                onClick={() => void handleDeleteClinic()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isDeletingClinic ? "not-allowed" : "pointer",
                }}
              >
                {isDeletingClinic ? "Removing Clinic..." : "Yes, Delete Clinic"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Appointment Modal */}
      {cancelTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            setCancelTarget(null);
            setCancelReason("");
          }}
          title="Cancel Veterinary Appointment"
          maxWidth="460px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#334155" }}>
              Are you sure you want to cancel the appointment for{" "}
              <strong>{dogName(pick(cancelTarget, "pet_id"))}</strong> at{" "}
              <strong>{clinicName(pick(cancelTarget, "clinic_id"))}</strong>?
            </p>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#334155" }}>
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Specify why the appointment is being cancelled..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F1F5F9",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => void handleCancel()}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: isCancelling ? "not-allowed" : "pointer",
                }}
              >
                {isCancelling ? "Cancelling..." : "Cancel Appointment"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* VETERINARY APPOINTMENT DETAIL MODAL */}
      {selectedAppointment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAppointment(null)}
          title={`Appointment Details — ${dogName(selectedAppointment)}`}
          maxWidth="640px"
        >
          {(() => {
            const petId = pick(selectedAppointment, "pet_id", "dog_id", "animal_id");
            const petRec = dogs.find((d) => pick(d, "id") === petId || pick(d, "dog_id") === petId);
            const petNameStr = dogName(selectedAppointment);
            const ownerStr = ownerName(selectedAppointment);
            const clinicStr = clinicName(selectedAppointment);
            const vetStr = vetName(selectedAppointment);

            const apptId = formatApptId(selectedAppointment.id, selectedAppointment);
            const status = str(pick(selectedAppointment, "status") || "pending");
            const dateStr = formatDate(pick(selectedAppointment, "starts_at", "date", "created_at"));
            const reason = str(pick(selectedAppointment, "reason")) || "General Checkup / Consultation";
            const source = str(pick(selectedAppointment, "source", "channel", "platform", "booking_source"));
            const notes = str(pick(selectedAppointment, "notes", "comments", "description"));
            const userEmail = str(pick(selectedAppointment, "user_email", "email", "owner_email"));
            const userPhone = str(pick(selectedAppointment, "user_phone", "phone", "owner_phone", "contact"));

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
                      Dog ID: {str(petId || "-")}
                    </div>
                    {petRec && (
                      <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>
                        <strong>Breed:</strong> {str(petRec.breed || "-")} &bull; <strong>Gender:</strong> {str(petRec.gender || "-")}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "6px" }}>
                      {renderStatus(status)}
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
                    <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600, marginTop: "4px" }}>
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
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8" }}>
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
                  {(canConfirm || status.toLowerCase() === "confirmed") && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedAppointment;
                        const pId = str(pick(target || {}, "pet_id", "dog_id", "animal_id"));
                        setSelectedAppointment(null);
                        navigate(`/dashboard/veterinarian?dog_id=${encodeURIComponent(pId)}&tab=public_appts`);
                      }}
                      style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <FaStethoscope /> Go to Clinical Consultation
                    </button>
                  )}

                  <div style={{ display: "flex", gap: "10px" }}>
                    {canConfirm && (
                      <button
                        type="button"
                        disabled={confirmingId === apptId}
                        onClick={() => {
                          const target = selectedAppointment;
                          setSelectedAppointment(null);
                          void handleConfirm(target);
                        }}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #6EE7B7", background: "#FFF", color: "#047857", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaCheck /> {confirmingId === apptId ? "Confirming..." : "Confirm Appointment"}
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedAppointment;
                          setSelectedAppointment(null);
                          setCancelTarget(target);
                        }}
                        style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #FCA5A5", background: "#FFF", color: "#DC2626", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <FaBan /> Cancel Appointment
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedAppointment(null)}
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

export default VetAppointments;
