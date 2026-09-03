import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaStethoscope,
  FaSyringe,
  FaNotesMedical,
  FaFileMedical,
  FaTrash,
  FaUserMd,
  FaEye,
  FaHeartbeat,
  FaClipboardList,
  FaCheckCircle,
  FaPills,
  FaSearch,
} from "react-icons/fa";
import medicalService, {
  type ClinicalExamPayload,
  type MedicalTreatmentPayload,
  type VaccinationRecordPayload,
  type PrescriptionPayload,
  type MedicationAdministrationPayload,
  type MedicalClearancePayload,
} from "../../services/medicalService";
import dogService from "../../services/dogService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
};

const MedicalRecords = () => {
  const isRescueCentreAdmin = getCurrentUserRole() === "rescue_centre_admin";
  const [medicalRecords, setMedicalRecords] = useState<Record<string, unknown>[]>([]);

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#DC2626", fontWeight: 800 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: "600px", margin: "12px auto" }}>
          Medical Records &amp; Clinical Management is reserved for Veterinarians, Shelter Managers, and Super Administrators. Rescue Centre Admin access is restricted to centre rescue operations, dispatch, vehicle fleet, and dog master management.
        </p>
      </div>
    );
  }
  const [dogs, setDogs] = useState<Record<string, unknown>[]>([]);
  const [certificatesIssued, setCertificatesIssued] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();

  // Search & Pagination & Filter state
  const [searchParams] = useSearchParams();
  const dogIdParam = searchParams.get("dogId");
  const [dogIdFilter, setDogIdFilter] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (dogIdParam) {
      setDogIdFilter(dogIdParam);
    } else {
      setDogIdFilter(null);
    }
  }, [dogIdParam]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false);
  const [isSurgeryModalOpen, setIsSurgeryModalOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isAdministrationModalOpen, setIsAdministrationModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [selectedDogProfile, setSelectedDogProfile] = useState<Record<string, unknown> | null>(null);
  const [dogHistory, setDogHistory] = useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form states
  const [examForm, setExamForm] = useState<ClinicalExamPayload>({
    dog_id: "",
    body_condition_score: 5,
    dental_health: "",
    ocular_aural_notes: "",
    coat_condition: "",
    visible_injuries: "",
    triage_diagnosis: "",
  });

  const [vaccineForm, setVaccineForm] = useState<VaccinationRecordPayload>({
    dog_id: "",
    vaccine_name: "",
    next_due_at: "",
    lot_number: "",
  });

  const [surgeryForm, setSurgeryForm] = useState<MedicalTreatmentPayload>({
    dog_id: "",
    treatment_type: "",
    description: "",
    anesthesia_log: "",
    post_op_notes: "",
  });

  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionPayload>({
    dog_id: "",
    drug_name: "",
    dosage: "",
    route: "Oral",
    start_at: new Date().toISOString().split("T")[0],
    end_at: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  });

  const [adminForm, setAdminForm] = useState<MedicationAdministrationPayload>({
    dog_id: "",
    medication_name: "",
    dosage: "",
    route: "Oral",
    administered_at: new Date().toISOString(),
    administered_by_id: "",
    notes: "",
  });

  const [certForm, setCertForm] = useState<MedicalClearancePayload>({
    clearance_type: "adoption_surgery",
    status: "approved",
    decision_notes: "Healthy, cleared for adoption.",
    expires_at: "",
  });
  const [certDogId, setCertDogId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [recordsRes, dogsRes] = await Promise.allSettled([
        medicalService.getMedicalRecords(),
        dogService.getAllDogs(),
      ]);

      let dogList: Record<string, unknown>[] = [];
      if (dogsRes.status === "fulfilled" && dogsRes.value) {
        const dRes = dogsRes.value;
        dogList = Array.isArray(dRes) ? dRes : Array.isArray(dRes?.data) ? (dRes.data as Record<string, unknown>[]) : [];
        setDogs(dogList);
      } else {
        setDogs([]);
      }

      let fetchedRecords: Record<string, unknown>[] = [];
      if (recordsRes.status === "fulfilled" && recordsRes.value) {
        const rRes = recordsRes.value;
        fetchedRecords = Array.isArray(rRes) ? rRes : Array.isArray(rRes?.data) ? (rRes.data as Record<string, unknown>[]) : [];
      } else {
        const errObj = recordsRes.status === "rejected" ? (recordsRes.reason as { response?: { data?: { detail?: string } }; message?: string }) : null;
        const msg = errObj?.response?.data?.detail || errObj?.message || "Failed to load medical records.";
        setError(msg);
      }

      const mappedRows = fetchedRecords.map((r: Record<string, unknown>) => {
        const petId = r.petId || r.pet_id || r.dog_id;
        const dog = dogList.find((d) => String(d.id || d.dog_id) === String(petId));
        return dog && (!r.petName || !String(r.petName || "").includes(" "))
          ? { ...r, petName: dog.name }
          : r;
      });

      const sortedRows = [...mappedRows].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const timeA = new Date((a.date || a.created_at || a.recorded_at || 0) as string | number).getTime();
        const timeB = new Date((b.date || b.created_at || b.recorded_at || 0) as string | number).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setMedicalRecords(sortedRows);

      if (dogList.length > 0) {
        Promise.allSettled(
          dogList.map((d) => medicalService.getDogClearances(String(d.id || d.dog_id || "")))
        ).then((results) => {
          const approved = results.reduce((acc, res) => {
            if (res.status !== "fulfilled") return acc;
            const list = Array.isArray(res.value) ? res.value : Array.isArray(res.value?.data) ? res.value.data : [];
            return (
              acc +
              list.filter((c: Record<string, unknown>) => String(c.status).toLowerCase() === "approved").length
            );
          }, 0);
          setCertificatesIssued(approved);
        });
      } else {
        setCertificatesIssued(0);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(e?.response?.data?.detail || e?.message || "Failed to load medical data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const dogLabel = (d: Record<string, unknown> | undefined) =>
    d?.name ? `${String(d.name)}${d.breed ? ` (${String(d.breed)})` : ""}` : d?.id ? String(d.id) : "";

  const getContextField = (key: string): string => {
    const ctx = selectedDogProfile?.recordContext as Record<string, unknown> | undefined;
    if (ctx && ctx[key] && ctx[key] !== "-") return String(ctx[key]);
    return "Not recorded";
  };

  const openMedicalProfileById = useCallback(async (dogId: string) => {
    const dog = dogs.find((d) => String(d.id || d.dog_id) === String(dogId)) || {
      id: dogId,
      name: "Unnamed Patient",
      breed: "-",
      status: "-",
    };
    setSelectedDogProfile(dog);
    setIsProfileModalOpen(true);
    try {
      setHistoryLoading(true);
      const res = await medicalService.getMedicalHistory(dogId);
      setDogHistory(Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : []);
    } catch {
      setDogHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [dogs]);

  useEffect(() => {
    if (dogIdParam && dogs.length > 0) {
      void openMedicalProfileById(dogIdParam);
    }
  }, [dogIdParam, dogs, openMedicalProfileById]);

  // Filtered & Paginated records
  const filteredRecords = useMemo(() => {
    return medicalRecords.filter((r) => {
      const matchesCategory = categoryFilter === "all" || r.type === categoryFilter;
      if (!matchesCategory) return false;

      // Filter by dogId query param if present
      if (dogIdFilter) {
        const petId = String(r.petId || r.pet_id || r.dog_id || "");
        if (petId !== dogIdFilter) return false;
      }

      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      const searchable = [
        String(r.recordId || ""),
        String(r.petName || ""),
        String(r.petId || ""),
        String(r.vetName || ""),
        String(r.diagnosis || ""),
        String(r.treatment || ""),
        String(r.vaccineName || ""),
        String(r.drugName || ""),
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [medicalRecords, categoryFilter, debouncedSearch, dogIdFilter]);

  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.dog_id || !examForm.triage_diagnosis) {
      addToast("Dog and diagnosis are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.createMedicalExam(examForm);
      addToast("Clinical examination recorded!", "success");
      setIsExamModalOpen(false);
      setExamForm({
        dog_id: "",
        body_condition_score: 5,
        dental_health: "",
        ocular_aural_notes: "",
        coat_condition: "",
        visible_injuries: "",
        triage_diagnosis: "",
      });
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to log examination.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaccineForm.dog_id || !vaccineForm.vaccine_name) {
      addToast("Dog and vaccine name are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.createVaccination(vaccineForm);
      addToast("Vaccination logged successfully!", "success");
      setIsVaccineModalOpen(false);
      setVaccineForm({ dog_id: "", vaccine_name: "", next_due_at: "", lot_number: "" });
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to log vaccination.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSurgery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surgeryForm.dog_id || !surgeryForm.treatment_type) {
      addToast("Dog and procedure type are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.createMedicalTreatment(surgeryForm);
      addToast(`Treatment "${surgeryForm.treatment_type}" recorded!`, "success");
      setIsSurgeryModalOpen(false);
      setSurgeryForm({ dog_id: "", treatment_type: "", description: "", anesthesia_log: "", post_op_notes: "" });
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to record treatment.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionForm.dog_id || !prescriptionForm.drug_name) {
      addToast("Dog and drug name are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.createPrescription(prescriptionForm);
      addToast(`Prescription for ${prescriptionForm.drug_name} issued!`, "success");
      setIsPrescriptionModalOpen(false);
      setPrescriptionForm({
        dog_id: "",
        drug_name: "",
        dosage: "",
        route: "Oral",
        start_at: new Date().toISOString().split("T")[0],
        end_at: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      });
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to issue prescription.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogAdministration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.dog_id || !adminForm.medication_name) {
      addToast("Dog and medication name are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.logMedicationAdministration(adminForm);
      addToast(`Medication administration logged!`, "success");
      setIsAdministrationModalOpen(false);
      setAdminForm({
        dog_id: "",
        medication_name: "",
        dosage: "",
        route: "Oral",
        administered_at: new Date().toISOString(),
        administered_by_id: "",
        notes: "",
      });
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to log administration.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssueCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certDogId) {
      addToast("Dog selection is required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.issueCertificate({ ...certForm, dog_id: certDogId });
      addToast("Clearance certificate issued!", "success");
      setIsCertModalOpen(false);
      setCertForm({ clearance_type: "adoption_surgery", status: "approved", decision_notes: "Healthy, cleared for adoption.", expires_at: "" });
      setCertDogId("");
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to issue certificate.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    try {
      setIsSubmitting(true);
      await medicalService.deleteMedicalRecord(String(selectedRecord.recordId), String(selectedRecord.entityType));
      addToast(`Deleted record ${String(selectedRecord.recordId)}`, "success");
      setIsDeleteModalOpen(false);
      setSelectedRecord(null);
      loadAllData();
      notifyDataChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      const msg = e?.response?.data?.detail || e?.message || "Failed to delete record.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMedicalProfile = async (record: Record<string, unknown>) => {
    const dogId = String(record.petId || record.pet_id || "");
    const dog = dogs.find((d) => d.id === dogId) || {
      id: dogId || "-",
      name: record.petName || "-",
      breed: "-",
      status: record.status || "-",
    };
    setSelectedDogProfile({
      ...dog,
      recordContext: record,
    });
    setIsProfileModalOpen(true);
    if (dogId) {
      try {
        setHistoryLoading(true);
        const res = await medicalService.getMedicalHistory(dogId);
        setDogHistory(Array.isArray(res?.data) ? (res.data as Record<string, unknown>[]) : []);
      } catch {
        setDogHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const countRecordsWith = (...needles: string[]): number =>
    medicalRecords.filter((r) => {
      const hay = [
        String(r.type || ""),
        String(r.record_type || ""),
        String(r.category || ""),
        String(r.diagnosis || ""),
        String(r.procedure || ""),
        String(r.status || ""),
      ]
        .join(" ")
        .toLowerCase();
      return needles.some((n) => hay.includes(n));
    }).length;

  const surgeriesCompleted = countRecordsWith("surgery", "spay", "neuter", "operation", "treatment");
  const vaccinationsAdministered = countRecordsWith("vaccin", "rabies", "booster");

  const stats = [
    { title: "Active Patients", value: `${medicalRecords.length} Records`, trend: "Under Care", color: "#2563EB", icon: <FaStethoscope /> },
    { title: "Surgeries Completed", value: `${surgeriesCompleted} Cases`, trend: "Completed", color: "#10B981", icon: <FaNotesMedical /> },
    { title: "Vaccinations Administered", value: `${vaccinationsAdministered} Records`, trend: "Administered", color: "#F59E0B", icon: <FaSyringe /> },
    { title: "Certificates Issued", value: `${certificatesIssued} Issued`, trend: "Approved", color: "#6366F1", icon: <FaFileMedical /> },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: "recordId", title: "Record ID", render: (_v, row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{String(row.recordId || row.id || "-").slice(0, 8)}</span> },
    { key: "petName", title: "Pet Name & ID", render: (_v, row) => <div><strong>{String(row.petName || "-")}</strong><div style={{ fontSize: "11px", color: "#64748B" }}>ID: {String(row.petId || "-")}</div></div> },
    { key: "vetName", title: "Attending Vet", render: (_v, row) => <span>{String(row.vetName || "-")}</span> },
    { key: "diagnosis", title: "Diagnosis / Type", render: (_v, row) => <span>{String(row.diagnosis && row.diagnosis !== "-" ? row.diagnosis : row.categoryName || row.type || "-")}</span> },
    { key: "treatment", title: "Treatment / Notes", render: (_v, row) => <span style={{ maxWidth: "240px", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(row.treatment || "-")}</span> },
    { key: "date", title: "Date Recorded", render: (_v, row) => <span>{row.date ? formatDateTime(row.date as string) : "-"}</span> },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Medical Records &amp; Clinical Care</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Centralized veterinary management system: patient histories, clinical exams, surgical logs, prescriptions, medication administration, and medical clearance certificates.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaStethoscope />} title="Record Examination" subtitle="Log clinical diagnosis" color="#2563EB" onClick={() => setIsExamModalOpen(true)} />
        </Can>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaSyringe />} title="Log Vaccination" subtitle="Administer booster" color="#10B981" onClick={() => setIsVaccineModalOpen(true)} />
        </Can>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaUserMd />} title="Record Surgery" subtitle="Surgical & anesthesia log" color="#F59E0B" onClick={() => setIsSurgeryModalOpen(true)} />
        </Can>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaPills />} title="Prescribe Drug" subtitle="Issue medication Rx" color="#8B5CF6" onClick={() => setIsPrescriptionModalOpen(true)} />
        </Can>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaClipboardList />} title="Log Administration" subtitle="Record dose given" color="#0D9488" onClick={() => setIsAdministrationModalOpen(true)} />
        </Can>
        <Can permission="create_medical">
          <QuickActionCard icon={<FaFileMedical />} title="Issue Clearance" subtitle="Adoption certificate" color="#6366F1" onClick={() => setIsCertModalOpen(true)} />
        </Can>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Patient Clinical Directory ({filteredRecords.length})
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
              <input
                type="text"
                placeholder="Search patient, diagnosis, vet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value="all">All Medical Categories</option>
              <option value="exams">Clinical Exams</option>
              <option value="vaccinations">Vaccinations</option>
              <option value="treatments">Treatments &amp; Surgeries</option>
              <option value="prescriptions">Prescriptions</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedRecords}
          loading={loading}
          error={error}
          onRetry={loadAllData}
          emptyMessage="No medical records found."
          module="medical"
          serverMode={true}
          totalCount={filteredRecords.length}
          page={page}
          pageSize={pageSize}
          onPageChange={(newPage) => setPage(newPage)}
          hideSearch={true}
          onRowClick={(row) => void openMedicalProfile(row)}
          onDelete={(row) => {
            setSelectedRecord(row);
            setIsDeleteModalOpen(true);
          }}
          renderRowActions={(row: Record<string, unknown>) => (
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button
                onClick={() => void openMedicalProfile(row)}
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
                <FaEye /> Medical Profile
              </button>
            </div>
          )}
        />
      </div>

      {/* Record Examination Modal */}
      <Modal isOpen={isExamModalOpen} onClose={() => setIsExamModalOpen(false)} title="Log Clinical Examination">
        <form onSubmit={handleCreateExam} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={examForm.dog_id} onChange={(e) => setExamForm({ ...examForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Triage Diagnosis *</label>
            <input type="text" required placeholder="e.g. Malnutrition & Dehydration" value={examForm.triage_diagnosis} onChange={(e) => setExamForm({ ...examForm, triage_diagnosis: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Body Condition Score (1-9)</label>
              <input type="number" min="1" max="9" value={examForm.body_condition_score} onChange={(e) => setExamForm({ ...examForm, body_condition_score: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dental Health</label>
              <input type="text" placeholder="e.g. Mild tartar buildup" value={examForm.dental_health} onChange={(e) => setExamForm({ ...examForm, dental_health: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Coat & Skin Condition</label>
            <input type="text" placeholder="e.g. Slightly matted, healthy skin" value={examForm.coat_condition} onChange={(e) => setExamForm({ ...examForm, coat_condition: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Visible Injuries / Exam Findings</label>
            <textarea placeholder="e.g. Laceration on left hind leg..." value={examForm.visible_injuries} onChange={(e) => setExamForm({ ...examForm, visible_injuries: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsExamModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Save Record"}</button>
          </div>
        </form>
      </Modal>

      {/* Log Vaccination Modal */}
      <Modal isOpen={isVaccineModalOpen} onClose={() => setIsVaccineModalOpen(false)} title="Log Vaccination Booster">
        <form onSubmit={handleLogVaccine} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={vaccineForm.dog_id} onChange={(e) => setVaccineForm({ ...vaccineForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Vaccine Name *</label>
            <input type="text" required placeholder="e.g. Rabies Core Booster / DHPP" value={vaccineForm.vaccine_name} onChange={(e) => setVaccineForm({ ...vaccineForm, vaccine_name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Lot Number</label>
              <input type="text" placeholder="e.g. LOT-48213" value={vaccineForm.lot_number} onChange={(e) => setVaccineForm({ ...vaccineForm, lot_number: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Next Due Date</label>
              <input type="date" value={vaccineForm.next_due_at} onChange={(e) => setVaccineForm({ ...vaccineForm, next_due_at: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsVaccineModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Logging..." : "Log Vaccine"}</button>
          </div>
        </form>
      </Modal>

      {/* Record Treatment / Surgery Modal */}
      <Modal isOpen={isSurgeryModalOpen} onClose={() => setIsSurgeryModalOpen(false)} title="Record Treatment & Surgery">
        <form onSubmit={handleScheduleSurgery} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={surgeryForm.dog_id} onChange={(e) => setSurgeryForm({ ...surgeryForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Treatment / Procedure Type *</label>
            <input type="text" required placeholder="e.g. Spay / Neuter / Wound Debridement" value={surgeryForm.treatment_type} onChange={(e) => setSurgeryForm({ ...surgeryForm, treatment_type: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Description *</label>
            <textarea required placeholder="e.g. Ovariohysterectomy, sterile surgical technique..." value={surgeryForm.description} onChange={(e) => setSurgeryForm({ ...surgeryForm, description: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Anesthesia Log</label>
            <input type="text" placeholder="e.g. Isoflurane, 45 minutes, stable vitals" value={surgeryForm.anesthesia_log} onChange={(e) => setSurgeryForm({ ...surgeryForm, anesthesia_log: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Post-Op Notes</label>
            <input type="text" placeholder="e.g. Monitor incision site, soft diet for 48h" value={surgeryForm.post_op_notes} onChange={(e) => setSurgeryForm({ ...surgeryForm, post_op_notes: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsSurgeryModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#F59E0B", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Record Treatment"}</button>
          </div>
        </form>
      </Modal>

      {/* Prescribe Medication Modal */}
      <Modal isOpen={isPrescriptionModalOpen} onClose={() => setIsPrescriptionModalOpen(false)} title="Prescribe Medication">
        <form onSubmit={handleCreatePrescription} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={prescriptionForm.dog_id} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Drug Name *</label>
            <input type="text" required placeholder="e.g. Amoxicillin / Meloxicam" value={prescriptionForm.drug_name} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, drug_name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dosage *</label>
              <input type="text" required placeholder="e.g. 250mg twice daily" value={prescriptionForm.dosage} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Route</label>
              <select value={prescriptionForm.route} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, route: e.target.value })} style={inputStyle}>
                <option value="Oral">Oral</option>
                <option value="Subcutaneous">Subcutaneous (SC)</option>
                <option value="Intramuscular">Intramuscular (IM)</option>
                <option value="Intravenous">Intravenous (IV)</option>
                <option value="Topical">Topical</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Start Date</label>
              <input type="date" value={prescriptionForm.start_at} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, start_at: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>End Date</label>
              <input type="date" value={prescriptionForm.end_at} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, end_at: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsPrescriptionModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#8B5CF6", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Issuing..." : "Issue Prescription"}</button>
          </div>
        </form>
      </Modal>

      {/* Log Medication Administration Modal */}
      <Modal isOpen={isAdministrationModalOpen} onClose={() => setIsAdministrationModalOpen(false)} title="Log Medication Administration">
        <form onSubmit={handleLogAdministration} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={adminForm.dog_id} onChange={(e) => setAdminForm({ ...adminForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Medication Name *</label>
            <input type="text" required placeholder="e.g. Amoxicillin / Paracetamol" value={adminForm.medication_name} onChange={(e) => setAdminForm({ ...adminForm, medication_name: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dosage Administered *</label>
              <input type="text" required placeholder="e.g. 250mg" value={adminForm.dosage} onChange={(e) => setAdminForm({ ...adminForm, dosage: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Route</label>
              <select value={adminForm.route} onChange={(e) => setAdminForm({ ...adminForm, route: e.target.value })} style={inputStyle}>
                <option value="Oral">Oral</option>
                <option value="Subcutaneous">Subcutaneous (SC)</option>
                <option value="Intramuscular">Intramuscular (IM)</option>
                <option value="Intravenous">Intravenous (IV)</option>
                <option value="Topical">Topical</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Administration Notes</label>
            <input type="text" placeholder="e.g. Administered with morning feed, patient accepted well." value={adminForm.notes} onChange={(e) => setAdminForm({ ...adminForm, notes: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsAdministrationModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#0D9488", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Logging..." : "Log Administration"}</button>
          </div>
        </form>
      </Modal>

      {/* Issue Certificate Modal */}
      <Modal isOpen={isCertModalOpen} onClose={() => setIsCertModalOpen(false)} title="Issue Medical Clearance Certificate">
        <form onSubmit={handleIssueCert} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Patient Dog *</label>
            <select required value={certDogId} onChange={(e) => setCertDogId(e.target.value)} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={String(d.id)} value={String(d.id)}>{dogLabel(d)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Clearance Type</label>
            <select value={certForm.clearance_type} onChange={(e) => setCertForm({ ...certForm, clearance_type: e.target.value })} style={inputStyle}>
              <option value="adoption_surgery">Adoption & Surgery Clearance</option>
              <option value="health_clearance">Health & Quarantine Clearance</option>
              <option value="travel_clearance">Travel / Export Clearance</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Decision Notes</label>
            <textarea placeholder="e.g. Healthy, cleared for adoption." value={certForm.decision_notes} onChange={(e) => setCertForm({ ...certForm, decision_notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsCertModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#6366F1", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Generating..." : "Generate Certificate"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Medical Record Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Medical Record">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to delete this record for <strong>{String(selectedRecord?.petName || "")}</strong>?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={handleDelete} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}><FaTrash /> Delete</button>
          </div>
        </div>
      </Modal>

      {/* Comprehensive Dog Medical Profile Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedDogProfile(null);
        }}
        title={`Dog Medical Profile — ${String(selectedDogProfile?.name || selectedDogProfile?.petName || "Patient")}`}
        maxWidth="720px"
      >
        {selectedDogProfile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>
                  {String(selectedDogProfile.name || selectedDogProfile.petName || "-")}
                </h2>
                <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                  Dog ID: <strong style={{ fontFamily: "monospace" }}>{String(selectedDogProfile.id || selectedDogProfile.registration_number || "-")}</strong> &bull; Breed: {String(selectedDogProfile.breed || "-")}
                </div>
              </div>
              <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaHeartbeat /> {String(selectedDogProfile.status || "-")}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Primary Diagnosis</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  {getContextField("diagnosis")}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Attending Veterinarian</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  {getContextField("vetName")}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Treatment / Procedure</div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  {getContextField("treatment")}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Veterinary Clearance Status</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: selectedDogProfile.vet_clearance === false ? "#DC2626" : "#059669", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaCheckCircle /> {selectedDogProfile.vet_clearance_status ? String(selectedDogProfile.vet_clearance_status) : (selectedDogProfile.vet_clearance === false ? "Pending Clearance" : selectedDogProfile.vet_clearance === true ? "Cleared" : "Not recorded")}
                </div>
              </div>
            </div>

            <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaClipboardList color="#2563EB" /> Chronological Medical History &amp; Audit Trail
              </div>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#64748B", fontSize: "13px" }}>Loading medical timeline...</div>
              ) : dogHistory.length === 0 ? (
                <div style={{ background: "#FFFFFF", padding: "12px", borderRadius: "8px", color: "#64748B", fontSize: "13px", textAlign: "center" }}>
                  No medical records logged for this patient.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto" }}>
                  {dogHistory.map((item: Record<string, unknown>, idx: number) => (
                    <div key={idx} style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>
                        {String(item.categoryName || item.entityType || item.type || "Medical Record")} &bull; {item.date || item.created_at || item.exam_date || item.treatment_date || item.administered_at || item.start_at ? formatDateTime((item.date || item.created_at || item.exam_date || item.treatment_date || item.administered_at || item.start_at) as string) : "Not recorded"}
                      </div>
                      <div style={{ color: "#475569", marginTop: "2px" }}>
                        {item.diagnosis && item.diagnosis !== "-" ? `Diagnosis: ${String(item.diagnosis)}` : ""}
                        {item.treatment && item.treatment !== "-" ? `${item.diagnosis && item.diagnosis !== "-" ? " | " : ""}Details: ${String(item.treatment)}` : ""}
                        {(!item.diagnosis || item.diagnosis === "-") && (!item.treatment || item.treatment === "-") ? "Recorded in clinical logs." : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileModalOpen(false);
                  setSelectedDogProfile(null);
                }}
                style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#334155", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MedicalRecords;
