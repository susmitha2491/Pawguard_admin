import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export interface ClinicalExamPayload {
  dog_id: string;
  body_condition_score?: number;
  dental_health?: string;
  ocular_aural_notes?: string;
  coat_condition?: string;
  visible_injuries?: string;
  triage_diagnosis: string;
}

export interface MedicalTreatmentPayload {
  dog_id: string;
  treatment_type: string;
  description: string;
  anesthesia_log?: string;
  post_op_notes?: string;
  inventory_consumptions?: Array<{ item_id: string; quantity: number }>;
}

export interface VaccinationRecordPayload {
  dog_id: string;
  vaccine_name: string;
  next_due_at?: string;
  lot_number?: string;
}

export interface VaccineProtocolPayload {
  name: string;
  default_interval_days?: number;
  is_required?: boolean;
}

export interface PrescriptionPayload {
  dog_id: string;
  drug_name: string;
  dosage: string;
  route: string;
  start_at: string;
  end_at: string;
  inventory_consumptions?: Array<{ item_id: string; quantity: number }>;
}

export interface PrescriptionUpdatePayload {
  drug_name?: string;
  dosage?: string;
  route?: string;
  start_at?: string;
  end_at?: string;
  is_active?: boolean;
}

export interface MedicationAdministrationPayload {
  dog_id: string;
  medication_name: string;
  dosage: string;
  route: string;
  administered_at: string;
  administered_by_id: string;
  notes?: string;
}

export interface MedicalClearancePayload {
  clearance_type: string;
  status: string;
  decision_notes?: string;
  expires_at?: string;
}

export const CRITICAL_MEDICAL_KEYWORDS = [
  "critical",
  "emergency",
  "urgent",
  "high priority",
  "icu",
  "post-op",
  "surgery",
  "bleeding",
  "broken",
  "fracture",
  "trauma",
  "severe",
  "wound",
  "laceration",
  "parvo",
  "distemper",
  "poisoning",
  "poison",
  "quarantine",
];

export const isCriticalMedicalRecord = (r: Record<string, unknown>): boolean => {
  if (!r) return false;
  if (r.is_critical === true || r.is_urgent === true) return true;

  const raw = (r.raw as Record<string, unknown>) || {};
  const prio = String(
    r.priority ||
    r.severity ||
    raw.priority ||
    raw.severity ||
    raw.is_urgent ||
    raw.is_critical ||
    ""
  ).toLowerCase();

  if (prio.includes("critical") || prio.includes("high") || prio.includes("urgent")) return true;

  const diagnosis = String(r.diagnosis || raw.triage_diagnosis || "").toLowerCase();
  const injuries = String(raw.visible_injuries || "").toLowerCase();
  const treatment = String(r.treatment || r.treatmentType || raw.treatment_type || "").toLowerCase();
  const anesthesia = String(r.anesthesiaLog || raw.anesthesia_log || "").toLowerCase();
  const postOp = String(r.postOpNotes || raw.post_op_notes || "").toLowerCase();
  const status = String(r.status || "").toLowerCase();

  if (injuries && injuries !== "none" && !injuries.includes("no visible injuries")) {
    if (CRITICAL_MEDICAL_KEYWORDS.some((k) => injuries.includes(k))) return true;
  }

  if (diagnosis && !diagnosis.includes("no acute distress") && !diagnosis.includes("routine")) {
    if (CRITICAL_MEDICAL_KEYWORDS.some((k) => diagnosis.includes(k))) return true;
  }

  if (
    treatment.includes("surgery") ||
    treatment.includes("wound") ||
    treatment.includes("operation") ||
    treatment.includes("emergency")
  ) {
    return true;
  }
  if (anesthesia && anesthesia.length > 0) return true;
  if (postOp && postOp.length > 0) return true;

  if (
    status.includes("critical") ||
    status.includes("emergency") ||
    status.includes("icu") ||
    status.includes("urgent")
  ) {
    return true;
  }

  return false;
};

const pick = (data: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const k of keys) {
    const v = data[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const normalizeMedicalRow = (r: Record<string, unknown>, type: string): Record<string, unknown> => {
  const vetIdRaw = r.administered_by || r.vet_id || r.authored_by_id;
  const vetName = vetIdRaw ? `Vet ID: ${String(vetIdRaw).slice(0, 8)}` : "Attending Vet";

  if (type === "exams") {
    const notes: string[] = [];
    if (r.body_condition_score !== undefined && r.body_condition_score !== null) notes.push(`BCS ${r.body_condition_score}/9`);
    if (r.visible_injuries) notes.push(String(r.visible_injuries));
    if (r.dental_health) notes.push(`Dental: ${r.dental_health}`);
    if (r.coat_condition) notes.push(`Coat: ${r.coat_condition}`);
    return {
      recordId: r.id,
      id: r.id,
      entityType: "exams",
      type: "exams",
      categoryName: "Clinical Exam",
      petName: (r.dog as { name?: string } | undefined)?.name || r.dog_id || "-",
      petId: r.dog_id || "-",
      vetName,
      vetId: vetIdRaw || null,
      diagnosis: r.triage_diagnosis || "-",
      treatment: notes.length > 0 ? notes.join("; ") : "-",
      date: r.exam_date || r.created_at || "-",
      raw: r,
    };
  }

  if (type === "treatments") {
    return {
      recordId: r.id,
      id: r.id,
      entityType: "treatments",
      type: "treatments",
      categoryName: "Treatment / Surgery",
      petName: (r.dog as { name?: string } | undefined)?.name || r.dog_id || "-",
      petId: r.dog_id || "-",
      vetName,
      vetId: vetIdRaw || null,
      diagnosis: "-",
      treatment: r.treatment_type ? `${r.treatment_type}${r.description ? `: ${r.description}` : ""}` : (r.description || "-"),
      treatmentType: r.treatment_type || "-",
      description: r.description || "-",
      anesthesiaLog: r.anesthesia_log || null,
      postOpNotes: r.post_op_notes || null,
      date: r.treatment_date || r.created_at || "-",
      raw: r,
    };
  }

  if (type === "vaccinations") {
    return {
      recordId: r.id,
      id: r.id,
      entityType: "vaccinations",
      type: "vaccinations",
      categoryName: "Vaccination",
      petName: (r.dog as { name?: string } | undefined)?.name || r.dog_id || "-",
      petId: r.dog_id || "-",
      vetName,
      vetId: vetIdRaw || null,
      diagnosis: "-",
      treatment: r.vaccine_name ? `Vaccine: ${r.vaccine_name}${r.lot_number ? ` (Lot #${r.lot_number})` : ""}` : "-",
      vaccineName: r.vaccine_name || "-",
      lotNumber: r.lot_number || null,
      nextDueAt: r.next_due_at || null,
      date: r.administered_at || r.created_at || "-",
      raw: r,
    };
  }

  if (type === "prescriptions") {
    return {
      recordId: r.id,
      id: r.id,
      entityType: "prescriptions",
      type: "prescriptions",
      categoryName: "Prescription",
      petName: (r.dog as { name?: string } | undefined)?.name || r.dog_id || "-",
      petId: r.dog_id || "-",
      vetName,
      vetId: vetIdRaw || null,
      diagnosis: "-",
      treatment: r.drug_name ? `Rx: ${r.drug_name} (${r.dosage || "As directed"}, ${r.route || "Oral"})` : "-",
      drugName: r.drug_name || "-",
      dosage: r.dosage || "-",
      route: r.route || "-",
      startAt: r.start_at || "-",
      endAt: r.end_at || "-",
      isActive: r.is_active ?? true,
      date: r.start_at || r.created_at || "-",
      raw: r,
    };
  }

  return {
    recordId: r.id,
    id: r.id,
    entityType: type,
    type,
    categoryName: type,
    petName: (r.dog as { name?: string } | undefined)?.name || r.dog_id || "-",
    petId: r.dog_id || "-",
    vetName,
    diagnosis: "-",
    treatment: "-",
    date: r.created_at || "-",
    raw: r,
  };
};

export const medicalService = {
  // GET /dashboards/medical
  getMedicalDashboard: async () => {
    const response = await api.get("/dashboards/medical");
    return response.data;
  },

  // GET /admin/dashboard/medical-stats
  getMedicalStats: async () => {
    const response = await api.get("/admin/dashboard/medical-stats");
    return response.data;
  },

  // GET /medical/exams
  getExams: async (params?: Record<string, unknown>) => {
    const response = await api.get("/medical/exams", { params });
    return response.data;
  },

  // GET /medical/treatments
  getTreatments: async (params?: Record<string, unknown>) => {
    const response = await api.get("/medical/treatments", { params });
    return response.data;
  },

  // GET /medical/vaccinations
  getVaccinations: async (params?: Record<string, unknown>) => {
    const response = await api.get("/medical/vaccinations", { params });
    return response.data;
  },

  // GET /medical/prescriptions
  getPrescriptions: async (params?: Record<string, unknown>) => {
    const response = await api.get("/medical/prescriptions", { params });
    return response.data;
  },

  // GET /medical/vaccine-protocols
  getVaccineProtocols: async () => {
    const response = await api.get("/medical/vaccine-protocols");
    return response.data;
  },

  // POST /medical/vaccine-protocols
  createVaccineProtocol: async (payload: VaccineProtocolPayload) => {
    const response = await api.post("/medical/vaccine-protocols", payload);
    return response.data;
  },

  // GET /medical/records aggregate across exams, vaccinations, treatments, prescriptions
  getMedicalRecords: async (params?: Record<string, unknown>) => {
    const [exams, vaccinations, treatments, prescriptions] = await Promise.all([
      api.get("/medical/exams", { params }).catch(() => ({ data: [] })),
      api.get("/medical/vaccinations", { params }).catch(() => ({ data: [] })),
      api.get("/medical/treatments", { params }).catch(() => ({ data: [] })),
      api.get("/medical/prescriptions", { params }).catch(() => ({ data: [] })),
    ]);

    const unwrap = (res: { data?: { data?: Record<string, unknown>[] } | Record<string, unknown>[] }): Record<string, unknown>[] => {
      const data = res?.data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray(data.data)) return data.data;
      return [];
    };

    const rows = [
      ...unwrap(exams).map((r) => normalizeMedicalRow(r, "exams")),
      ...unwrap(vaccinations).map((r) => normalizeMedicalRow(r, "vaccinations")),
      ...unwrap(treatments).map((r) => normalizeMedicalRow(r, "treatments")),
      ...unwrap(prescriptions).map((r) => normalizeMedicalRow(r, "prescriptions")),
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return { data: rows, total: rows.length };
  },

  // GET /medical/dogs/{dog_id}/history
  getMedicalHistory: async (dogId: string) => {
    try {
      const response = await api.get(`/medical/dogs/${dogId}/history`);
      const payload = response?.data?.data || response?.data;
      if (Array.isArray(payload)) {
        return { data: payload };
      }
      if (payload && typeof payload === "object") {
        const unwrap = (val: unknown): Record<string, unknown>[] => (Array.isArray(val) ? (val as Record<string, unknown>[]) : []);
        const rows = [
          ...unwrap(payload.exams).map((r) => normalizeMedicalRow(r, "exams")),
          ...unwrap(payload.treatments).map((r) => normalizeMedicalRow(r, "treatments")),
          ...unwrap(payload.vaccinations).map((r) => normalizeMedicalRow(r, "vaccinations")),
          ...unwrap(payload.prescriptions).map((r) => normalizeMedicalRow(r, "prescriptions")),
        ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        return { data: rows };
      }
      return { data: [] };
    } catch {
      return { data: [] };
    }
  },

  // GET /medical/clearances/dogs/{dog_id}
  getDogClearances: async (dogId: string) => {
    const response = await api.get(`/medical/clearances/dogs/${dogId}`);
    const list = Array.isArray(response?.data?.data) ? response.data.data : Array.isArray(response?.data) ? response.data : [];
    return list;
  },

  // POST /medical/exams
  createMedicalExam: async (data: Record<string, unknown> | ClinicalExamPayload) => {
    const raw = data as Record<string, unknown>;
    const dogId = pick(raw, "dog_id", "dogId", "petName");
    if (!dogId) throw new Error("Dog selection is required to record a clinical exam.");

    const diagnosis = pick(raw, "triage_diagnosis", "diagnosis", "chiefComplaint") || "Routine Clinical Checkup";
    const bcs = Number(pick(raw, "body_condition_score", "bodyConditionScore", "bcs")) || 5;

    const payload: ClinicalExamPayload = {
      dog_id: String(dogId),
      triage_diagnosis: String(diagnosis),
      body_condition_score: bcs,
      dental_health: (pick(raw, "dental_health", "dental") as string) || undefined,
      ocular_aural_notes: (pick(raw, "ocular_aural_notes", "ocular") as string) || undefined,
      coat_condition: (pick(raw, "coat_condition", "coat") as string) || undefined,
      visible_injuries: (pick(raw, "visible_injuries", "treatment", "injuries") as string) || undefined,
    };

    const response = await api.post("/medical/exams", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Clinical Medical Exam Recorded",
      message: `Clinical examination recorded for patient ${dogId}. Diagnosis: ${diagnosis}.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // POST /medical/treatments
  createMedicalTreatment: async (data: Record<string, unknown> | MedicalTreatmentPayload) => {
    const raw = data as Record<string, unknown>;
    const dogId = pick(raw, "dog_id", "dogId", "petName");
    if (!dogId) throw new Error("Dog selection is required to record a treatment.");
    const treatmentType = pick(raw, "treatment_type", "treatmentType", "procedure");
    if (!treatmentType) throw new Error("Procedure/treatment type is required.");

    const payload: MedicalTreatmentPayload = {
      dog_id: String(dogId),
      treatment_type: String(treatmentType),
      description: String(pick(raw, "description", "treatment") || "Medical procedure completed."),
      anesthesia_log: (pick(raw, "anesthesia_log", "anesthesiaLog") as string) || undefined,
      post_op_notes: (pick(raw, "post_op_notes", "postOpNotes") as string) || undefined,
      inventory_consumptions: raw.inventory_consumptions as any,
    };

    const response = await api.post("/medical/treatments", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Medical Treatment / Surgery Recorded",
      message: `Treatment (${treatmentType}) recorded for patient ${dogId}.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // Alias for backward compatibility
  scheduleSurgery: async (data: Record<string, unknown>) => {
    return medicalService.createMedicalTreatment(data);
  },

  // POST /medical/vaccinations
  createVaccination: async (data: Record<string, unknown> | VaccinationRecordPayload) => {
    const raw = data as Record<string, unknown>;
    const dogId = pick(raw, "dog_id", "dogId", "petName");
    if (!dogId) throw new Error("Dog selection is required to log a vaccination.");
    const vaccineName = pick(raw, "vaccine_name", "vaccineName");
    if (!vaccineName) throw new Error("Vaccine name is required.");

    const payload: VaccinationRecordPayload = {
      dog_id: String(dogId),
      vaccine_name: String(vaccineName),
      next_due_at: (pick(raw, "next_due_at", "nextDueAt") as string) || undefined,
      lot_number: (pick(raw, "lot_number", "lotNumber") as string) || undefined,
    };

    const response = await api.post("/medical/vaccinations", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Vaccination Administered",
      message: `Vaccine ${vaccineName} administered to patient ${dogId}.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // POST /medical/prescriptions
  createPrescription: async (data: Record<string, unknown> | PrescriptionPayload) => {
    const raw = data as Record<string, unknown>;
    const dogId = pick(raw, "dog_id", "dogId", "petName");
    if (!dogId) throw new Error("Dog selection is required to prescribe medication.");
    const drugName = pick(raw, "drug_name", "drugName");
    if (!drugName) throw new Error("Drug name is required.");

    const payload: PrescriptionPayload = {
      dog_id: String(dogId),
      drug_name: String(drugName),
      dosage: String(pick(raw, "dosage") || "As directed"),
      route: String(pick(raw, "route") || "Oral"),
      start_at: String(pick(raw, "start_at", "startAt") || new Date().toISOString()),
      end_at: String(pick(raw, "end_at", "endAt") || new Date(Date.now() + 7 * 86400000).toISOString()),
      inventory_consumptions: raw.inventory_consumptions as any,
    };

    const response = await api.post("/medical/prescriptions", payload);
    await publishActionEvent({
      module: "medical",
      action: "create",
      title: "Prescription Issued",
      message: `Prescription (${drugName}) issued for patient ${dogId}.`,
      targetRoles: ["super_admin", "veterinarian", "rescue_centre_admin", "shelter_manager"],
    });
    return response.data;
  },

  // PUT /medical/prescriptions/{prescription_id}
  updatePrescription: async (prescriptionId: string, payload: PrescriptionUpdatePayload) => {
    const response = await api.put(`/medical/prescriptions/${prescriptionId}`, payload);
    return response.data;
  },

  // PATCH /medical/prescriptions/{prescription_id}/status
  updatePrescriptionStatus: async (prescriptionId: string, isActive: boolean) => {
    const response = await api.patch(`/medical/prescriptions/${prescriptionId}/status`, { is_active: isActive });
    return response.data;
  },

  // POST /medical/administrations
  logMedicationAdministration: async (payload: MedicationAdministrationPayload) => {
    const response = await api.post("/medical/administrations", payload);
    await publishActionEvent({
      module: "medical",
      action: "update",
      title: "Medication Administered",
      message: `Medication (${payload.medication_name}) logged for dog ${payload.dog_id}.`,
      targetRoles: ["super_admin", "veterinarian", "shelter_manager"],
    });
    return response.data;
  },

  // GET /medical/prescriptions/{prescription_id}/administrations
  getPrescriptionAdministrations: async (prescriptionId: string) => {
    const response = await api.get(`/medical/prescriptions/${prescriptionId}/administrations`);
    return response.data;
  },

  // GET /medical/dogs/{dog_id}/administrations
  getDogAdministrations: async (dogId: string) => {
    const response = await api.get(`/medical/dogs/${dogId}/administrations`);
    return response.data;
  },

  // POST /medical/clearance/{dog_id}
  issueCertificate: async (data: Record<string, unknown> | MedicalClearancePayload) => {
    const raw = data as Record<string, unknown>;
    const dogId = pick(raw, "dog_id", "dogId", "petName");
    if (!dogId) throw new Error("Dog selection is required to issue a clearance certificate.");

    const rawStatus = String(pick(raw, "status", "certStatus") || "approved").toLowerCase();
    const status = (rawStatus === "denied" || rawStatus === "pending") ? rawStatus : "approved";
    const clearanceType = String(pick(raw, "clearance_type", "clearanceType", "certType") || "adoption_surgery");
    const notes = pick(raw, "decision_notes", "notes") || "Healthy, cleared for adoption.";

    const payload: MedicalClearancePayload = {
      clearance_type: clearanceType,
      status,
      decision_notes: String(notes),
    };
    if (raw.expires_at) {
      payload.expires_at = String(raw.expires_at);
    }

    const response = await api.post(`/medical/clearance/${dogId}`, payload);

    await publishActionEvent({
      module: "medical",
      action: "approve",
      title: "Medical Clearance Issued",
      message: `Medical clearance (${String(payload.status)}) issued for dog ${dogId}.`,
      targetRoles: ["super_admin", "rescue_centre_admin", "veterinarian", "shelter_manager"],
    });
    return response.data;
  },

  // DELETE /medical/{entity_type}/{entity_id}
  deleteMedicalRecord: async (id: string, entityType: string = "exams") => {
    const response = await api.delete(`/medical/${entityType}/${id}`);
    await publishActionEvent({
      module: "medical",
      action: "delete",
      title: "Medical Record Removed",
      message: `Medical entity (${entityType} #${id}) removed from system.`,
      targetRoles: ["super_admin", "veterinarian", "shelter_manager"],
    });
    return response.data;
  },
};

export default medicalService;
