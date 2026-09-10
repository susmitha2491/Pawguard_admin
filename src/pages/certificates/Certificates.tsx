import { useEffect, useState, useMemo, useCallback } from "react";
import DataTable, { type Column } from "../../components/common/DataTable";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
import HealthClearanceCertificateModal from "../../components/certificates/HealthClearanceCertificateModal";
import { useToast } from "../../context/ToastContext";
import { usePermissions } from "../../context/PermissionContext";
import reportsService from "../../services/reportsService";
import medicalService from "../../services/medicalService";
import dogService from "../../services/dogService";
import { notifyDataChanged } from "../../utils/dataSync";
import { getStoredUser } from "../../utils/authStorage";
import { formatDateTime, formatDateOnly } from "../../utils/dateUtils";
import { normalizeRole } from "../../utils/roleUtils";
import {
  FaCertificate,
  FaFileContract,
  FaCheckCircle,
  FaPrint,
  FaPlus,
  FaStethoscope,
  FaExclamationTriangle,
  FaInfoCircle,
  FaUserMd,
  FaCalendarAlt,
  FaEye,
  FaAward,
} from "react-icons/fa";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
  background: "#FFFFFF",
};

const readOnlyFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#334155",
  fontWeight: 600,
  fontSize: "14px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

export interface CertificateRecord {
  certId: string;
  type: string;
  dogId: string;
  dogName: string;
  dogBreed: string;
  pet: string;
  issuedTo: string;
  issuedBy: string;
  vetId?: string;
  date: string;
  status: string;
}

const Certificates = () => {
  const { addToast } = useToast();
  const { has, can } = usePermissions();

  // Authenticated user / veterinarian info
  const currentUser = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const isVeterinarian = useMemo(() => normalizeRole(currentUser) === "veterinarian", [currentUser]);

  const canCreateAdoptionCert =
    !isVeterinarian &&
    (has("create_adoptions") ||
      has("manage_adoptions") ||
      has("create_adoption") ||
      has("approve_adoptions") ||
      can("create", "adoptions") ||
      can("approve", "adoptions"));

  const canCreateHealthCert =
    isVeterinarian ||
    has("create_medical") ||
    has("manage_medical") ||
    has("create_certificates") ||
    can("create", "medical") ||
    can("create", "certificates");
  const vetDisplayName = useMemo(() => {
    if (!currentUser) return "Dr. Authenticated Veterinarian";
    const firstName = currentUser.first_name ? String(currentUser.first_name).trim() : "";
    const lastName = currentUser.last_name ? String(currentUser.last_name).trim() : "";
    if (firstName) {
      return `Dr. ${firstName} ${lastName}`.trim();
    }
    if (currentUser.full_name) {
      return `Dr. ${String(currentUser.full_name).trim()}`;
    }
    if (currentUser.username) {
      const formatted = String(currentUser.username).replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `Dr. ${formatted}`;
    }
    return "Dr. Attending Veterinarian";
  }, [currentUser]);

  // Data states
  const [certData, setCertData] = useState<CertificateRecord[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals state
  const [isAdoptionModalOpen, setIsAdoptionModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);

  // Forms
  const [adoptionForm, setAdoptionForm] = useState({ dogId: "", issuedTo: "" });
  const [healthForm, setHealthForm] = useState({
    dogId: "",
    examId: "",
    decisionNotes: "Medically assessed and confirmed healthy. Approved and ready for adoption.",
  });

  // Map of completed exams per dog ID
  const examsByDogId = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const exam of exams) {
      const dogId = String(exam.dog_id || "");
      if (!dogId) continue;
      if (!map.has(dogId)) {
        map.set(dogId, []);
      }
      map.get(dogId)!.push(exam);
    }
    // Sort exams per dog by date descending
    map.forEach((list) => {
      list.sort((a, b) => {
        const da = new Date(a.exam_date || a.created_at || 0).getTime();
        const db = new Date(b.exam_date || b.created_at || 0).getTime();
        return db - da;
      });
    });
    return map;
  }, [exams]);

  const dogName = useCallback(
    (dogId: string) => {
      const dog = dogs.find((d) => d.id === dogId);
      return dog?.name ? `${dog.name}${dog.breed ? ` (${dog.breed})` : ""}` : dogId;
    },
    [dogs]
  );

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [dogsRes, examsRes] = await Promise.all([
        dogService.getAllDogs({ page_size: 100 }),
        medicalService.getExams({ page_size: 100 }),
      ]);

      const dogsList = Array.isArray(dogsRes?.data) ? dogsRes.data : [];
      const examsList = Array.isArray(examsRes?.data?.items)
        ? examsRes.data.items
        : Array.isArray(examsRes?.data)
        ? examsRes.data
        : [];

      setDogs(dogsList);
      setExams(examsList);

      // Fetch clearances across dogs in batches
      const clearancePromises = dogsList.map(async (d: any) => {
        try {
          const list = await medicalService.getDogClearances(d.id);
          return (Array.isArray(list) ? list : []).map((clr: any) => {
            const rawId = String(clr.id || "");
            const formattedCertId = rawId ? `HC-${rawId.slice(0, 8).toUpperCase()}` : `HC-${Math.floor(1000 + Math.random() * 9000)}`;
            const isHealthClearance = clr.clearance_type === "health_clearance" || !clr.clearance_type?.includes("adoption");

            return {
              certId: formattedCertId,
              type: isHealthClearance ? "Health Clearance" : "Adoption Clearance",
              dogId: String(d.id),
              dogName: d.name || "Canine Patient",
              dogBreed: d.breed || "Mixed Breed",
              pet: d.name ? `${d.name} (DOG-${String(d.id).slice(0, 8).toUpperCase()})` : `DOG-${String(d.id).slice(0, 8).toUpperCase()}`,
              issuedTo: clr.decision_notes || "Medically cleared – Ready for Adoption",
              issuedBy: clr.authorized_by_id ? (currentUser?.id === clr.authorized_by_id ? vetDisplayName : `Dr. Attending Veterinarian`) : vetDisplayName,
              vetId: clr.authorized_by_id,
              date: clr.authorized_at || clr.created_at || new Date().toISOString(),
              status: clr.status ? String(clr.status).toUpperCase() : "APPROVED",
            };
          });
        } catch {
          return [];
        }
      });

      const settled = await Promise.all(clearancePromises);
      const allRows: CertificateRecord[] = settled.flat().sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setCertData(allRows);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, vetDisplayName]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  // Options for dog select dropdown, prioritizing dogs with completed medical assessments
  const dogOptions = useMemo(() => {
    return dogs
      .map((d) => {
        const hasExam = examsByDogId.has(d.id);
        const examCount = examsByDogId.get(d.id)?.length || 0;
        return {
          value: String(d.id),
          label: d.name ? `${d.name} (${d.breed || "Mixed Breed"})` : String(d.id),
          sublabel: `ID: DOG-${String(d.id).slice(0, 8).toUpperCase()} • ${hasExam ? `✓ Medically Assessed (${examCount} exam${examCount > 1 ? "s" : ""})` : "⚠️ No Assessment Recorded"}`,
          hasExam,
        };
      })
      .sort((a, b) => {
        // Medically assessed dogs first
        if (a.hasExam && !b.hasExam) return -1;
        if (!a.hasExam && b.hasExam) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [dogs, examsByDogId]);

  // When selected dog changes in Health Clearance form, auto-link its latest exam
  const selectedDogExams = useMemo(() => {
    if (!healthForm.dogId) return [];
    return examsByDogId.get(healthForm.dogId) || [];
  }, [healthForm.dogId, examsByDogId]);

  const selectedExam = useMemo(() => {
    if (!selectedDogExams.length) return null;
    if (healthForm.examId) {
      return selectedDogExams.find((e) => e.id === healthForm.examId) || selectedDogExams[0];
    }
    return selectedDogExams[0];
  }, [selectedDogExams, healthForm.examId]);

  const existingClearanceForSelectedDog = useMemo(() => {
    if (!healthForm.dogId) return null;
    return certData.find((c) => c.dogId === healthForm.dogId);
  }, [healthForm.dogId, certData]);

  const handleDogSelect = (val: string | number) => {
    const dogId = String(val);
    const availableExams = examsByDogId.get(dogId) || [];
    const latestExamId = availableExams.length > 0 ? availableExams[0].id : "";
    setHealthForm((prev) => ({
      ...prev,
      dogId,
      examId: latestExamId,
    }));
  };

  const handleIssueHealthCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateHealthCert) {
      addToast("You do not have permission to issue health certificates.", "error");
      return;
    }
    if (!healthForm.dogId) {
      addToast("Please select an eligible dog.", "error");
      return;
    }
    if (selectedDogExams.length === 0) {
      addToast(
        "Cannot issue certificate: Dog must have a completed Medical Assessment first.",
        "error"
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const notes = healthForm.decisionNotes?.trim() || "Medically assessed and confirmed healthy. Approved and ready for adoption.";

      // 1. Issue formal Health Clearance Certificate via backend API
      await medicalService.issueCertificate({
        dog_id: healthForm.dogId,
        clearance_type: "health_clearance",
        status: "approved",
        decision_notes: notes,
      });

      // 2. Mark dog as medically cleared and ready for adoption in the Dog Master record (without marking as adopted)
      try {
        await dogService.updateAdoptability(healthForm.dogId, {
          is_adoptable: true,
          is_quarantine_passed: true,
        });
      } catch {
        // Adoptability update secondary fallback
      }

      addToast(
        `Health Clearance Certificate issued for ${dogName(healthForm.dogId)}! Dog is medically cleared & ready for adoption.`,
        "success"
      );

      setIsHealthModalOpen(false);
      setHealthForm({
        dogId: "",
        examId: "",
        decisionNotes: "Medically assessed and confirmed healthy. Approved and ready for adoption.",
      });

      await loadAllData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to issue certificate.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateAdoptionCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateAdoptionCert) {
      addToast("You do not have permission to generate adoption certificates.", "error");
      return;
    }
    if (!adoptionForm.dogId || !adoptionForm.issuedTo) {
      addToast("Dog and Recipient are required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await medicalService.issueCertificate({
        dog_id: adoptionForm.dogId,
        clearance_type: "adoption_clearance",
        decision_notes: `Issued to ${adoptionForm.issuedTo}`,
      });
      addToast(`Adoption Certificate generated for ${dogName(adoptionForm.dogId)}!`, "success");
      setIsAdoptionModalOpen(false);
      setAdoptionForm({ dogId: "", issuedTo: "" });
      await loadAllData();
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || err?.message || "Failed to generate certificate.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintCertificates = async () => {
    try {
      addToast("Exporting medical clearance report (PDF)...", "info");
      await reportsService.generateAndDownloadReport({ report_type: "medical", format: "pdf" });
      addToast("Certificates report exported!", "success");
    } catch (err: any) {
      addToast(err?.message || "Failed to export certificates.", "error");
    }
  };

  // Linked medical assessment for previewed certificate
  const previewAssessment = useMemo(() => {
    if (!previewCert) return null;
    const dogExams = examsByDogId.get(previewCert.dogId) || [];
    return dogExams[0] || null;
  }, [previewCert, examsByDogId]);

  // Statistics
  const healthCertCount = certData.filter((c) => c.type === "Health Clearance" || String(c.type).includes("health")).length;
  const adoptionCertCount = certData.filter((c) => c.type === "Adoption Clearance" || String(c.type).includes("adoption")).length;
  const verifiedCount = certData.filter((c) => /approved|issued|active|verified/i.test(String(c.status ?? ""))).length;

  const stats = [
    {
      title: "Total Certificates",
      value: `${certData.length} Issued`,
      trend: `${verifiedCount} Verified Valid`,
      color: "#2563EB",
      icon: <FaCertificate />,
    },
    ...(canCreateAdoptionCert
      ? [
          {
            title: "Adoption Certificates",
            value: `${adoptionCertCount} Forms`,
            trend: "Phase 5 Handover",
            color: "#10B981",
            icon: <FaFileContract />,
          },
        ]
      : []),
    {
      title: "Health Clearance Certificates",
      value: `${healthCertCount} Records`,
      trend: "Ready for Adoption",
      color: "#059669",
      icon: <FaCheckCircle />,
    },
  ];

  const columns: Column<CertificateRecord>[] = [
    {
      key: "certId",
      title: "Certificate ID",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCertificate style={{ color: row.type === "Health Clearance" ? "#10B981" : "#2563EB" }} />
          <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#0F172A" }}>{row.certId}</span>
        </div>
      ),
    },
    {
      key: "type",
      title: "Certificate Type",
      render: (row) => (
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 700,
            background: row.type === "Health Clearance" ? "#ECFDF5" : "#EFF6FF",
            color: row.type === "Health Clearance" ? "#065F46" : "#1E40AF",
            border: `1px solid ${row.type === "Health Clearance" ? "#A7F3D0" : "#BFDBFE"}`,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {row.type === "Health Clearance" ? <FaStethoscope size={11} /> : <FaFileContract size={11} />}
          {row.type}
        </span>
      ),
    },
    {
      key: "pet",
      title: "Pet Name & ID",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A" }}>{row.pet}</div>
          {row.dogBreed && <div style={{ fontSize: "12px", color: "#64748B" }}>{row.dogBreed}</div>}
        </div>
      ),
    },
    {
      key: "issuedTo",
      title: "Clearance Purpose / Remarks",
      render: (row) => (
        <div style={{ maxWidth: "260px", color: "#334155", fontSize: "13px", lineHeight: 1.4 }}>
          {row.issuedTo || "Medically cleared – Ready for Adoption"}
        </div>
      ),
    },
    {
      key: "issuedBy",
      title: "Authorized By",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0F172A", fontWeight: 600 }}>
          <FaUserMd style={{ color: "#6366F1" }} />
          <span>{row.issuedBy}</span>
        </div>
      ),
    },
    {
      key: "date",
      title: "Issue Date",
      render: (row) => (
        <span style={{ color: "#475569", fontSize: "13px" }}>
          {row.date ? formatDateOnly(row.date) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (row) => (
        <span
          style={{
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 700,
            background: "#ECFDF5",
            color: "#047857",
            border: "1px solid #A7F3D0",
          }}
        >
          {row.status || "APPROVED"}
        </span>
      ),
    },
    {
      key: "certId",
      title: "Actions",
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewCert(row);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#1E293B",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <FaEye size={12} color="#6366F1" /> View Cert
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Print Specific CSS to isolate certificate card on print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-certificate-card, #printable-certificate-card * {
            visibility: visible !important;
          }
          #printable-certificate-card {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 900px !important;
            margin: 0 auto !important;
            padding: 24px 32px !important;
            background: #FFFFFF !important;
            border: 2px solid #0F172A !important;
            box-shadow: none !important;
            z-index: 999999 !important;
          }
          .cert-no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div
        style={{
          marginBottom: "24px",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          padding: "24px",
          borderRadius: "16px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Certificates & Legal Agreements</h1>
            <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
              Official Veterinary Health Clearance certifications & digital clearance records confirming pets are medically assessed and ready for adoption.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.08)", padding: "8px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)" }}>
            <FaUserMd style={{ color: "#38BDF8" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F5F9" }}>Attending: {vetDisplayName}</span>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        {canCreateAdoptionCert && (
          <QuickActionCard
            icon={<FaPlus />}
            title="Generate Adoption Cert"
            subtitle="Phase 5 Adoption Handover"
            color="#2563EB"
            onClick={() => setIsAdoptionModalOpen(true)}
          />
        )}
        {canCreateHealthCert && (
          <QuickActionCard
            icon={<FaCertificate />}
            title="Issue Health Clearance Cert"
            subtitle="Vet medical clearance for adoption"
            color="#10B981"
            onClick={() => setIsHealthModalOpen(true)}
          />
        )}
        <QuickActionCard
          icon={<FaPrint />}
          title="Export Medical Report"
          subtitle="Download clearance summary PDF"
          color="#6366F1"
          onClick={handlePrintCertificates}
        />
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Registry Table */}
      <div className="soft-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Issued Digital Certificates Registry
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
              Official repository of formal health clearance certificates issued by veterinarians. Click any row to view the official certificate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAllData()}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↻ Refresh Registry
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
            Loading issued certificates...
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={certData}
            onRowClick={(row) => setPreviewCert(row)}
            onView={(row) => setPreviewCert(row)}
            emptyMessage="No certificates issued yet. Issue a Health Clearance Certificate above for a medically assessed dog."
          />
        )}
      </div>

      {/* ========================================================= */}
      {/* Issue Health Clearance Certificate Modal (Veterinarian Flow) */}
      {/* ========================================================= */}
      {canCreateHealthCert && (
        <Modal
          isOpen={isHealthModalOpen}
          onClose={() => setIsHealthModalOpen(false)}
          title="Issue Vet Health Clearance Certificate"
          maxWidth="640px"
        >
          <form onSubmit={handleIssueHealthCert} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* PRD Flow Notice */}
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <FaAward style={{ color: "#16A34A", fontSize: "18px", marginTop: "2px", flexShrink: 0 }} />
              <div style={{ fontSize: "12.5px", color: "#166534", lineHeight: 1.5 }}>
                <strong>Veterinary Health Clearance Workflow (PRD):</strong>
                <br />
                This formal certificate confirms the dog has undergone a completed medical assessment and is certified as medically fit and <strong>Ready for Adoption</strong>.
              </div>
            </div>

            {/* Step A: Select Dog */}
            <div>
              <Select
                label="Select Dog for Medical Clearance *"
                required
                searchable
                placeholder="Search dog name, breed, or ID..."
                options={dogOptions}
                value={healthForm.dogId}
                onChange={handleDogSelect}
              />
            </div>

            {/* Step B: Linked Completed Medical Assessment */}
            {healthForm.dogId && (
              <div>
                {selectedDogExams.length > 0 ? (
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13.5px", color: "#0F172A" }}>
                        <FaStethoscope style={{ color: "#10B981" }} />
                        <span>Linked Completed Medical Assessment</span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background: "#ECFDF5",
                          color: "#059669",
                          border: "1px solid #A7F3D0",
                        }}
                      >
                        ✓ Clinical Exam Completed
                      </span>
                    </div>

                    {selectedDogExams.length > 1 && (
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Choose Assessment Record
                        </label>
                        <select
                          value={selectedExam?.id || ""}
                          onChange={(e) => setHealthForm((prev) => ({ ...prev, examId: e.target.value }))}
                          style={inputStyle}
                        >
                          {selectedDogExams.map((ex: any) => (
                            <option key={ex.id} value={ex.id}>
                              Exam on {formatDateTime(ex.exam_date || ex.created_at)} — {ex.triage_diagnosis || "Clinical Checkup"}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedExam && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                        <div>
                          <span style={{ color: "#64748B", display: "block" }}>Triage Diagnosis:</span>
                          <strong style={{ color: "#0F172A" }}>{selectedExam.triage_diagnosis || "Routine Clinical Assessment"}</strong>
                        </div>
                        <div>
                          <span style={{ color: "#64748B", display: "block" }}>Body Condition Score (BCS):</span>
                          <strong style={{ color: "#0F172A" }}>{selectedExam.body_condition_score ? `${selectedExam.body_condition_score}/9 (Normal)` : "5/9 (Normal)"}</strong>
                        </div>
                        <div>
                          <span style={{ color: "#64748B", display: "block" }}>Exam Date:</span>
                          <span style={{ color: "#334155" }}>{formatDateTime(selectedExam.exam_date || selectedExam.created_at)}</span>
                        </div>
                        <div>
                          <span style={{ color: "#64748B", display: "block" }}>Assessment Ref:</span>
                          <span style={{ fontFamily: "monospace", color: "#64748B" }}>EX-{String(selectedExam.id).slice(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "10px",
                      padding: "14px",
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                    }}
                  >
                    <FaExclamationTriangle style={{ color: "#DC2626", fontSize: "18px", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ fontSize: "12.5px", color: "#991B1B", lineHeight: 1.5 }}>
                      <strong>No Completed Medical Assessment Found:</strong>
                      <br />
                      This dog has not undergone a clinical medical assessment yet. In accordance with PawGuard PRD clinical protocol, you must complete a Clinical Exam in the Medical Suite before issuing a Health Clearance Certificate.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing Active Clearance Notice */}
            {existingClearanceForSelectedDog && (
              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  fontSize: "12px",
                  color: "#1E40AF",
                }}
              >
                <FaInfoCircle style={{ color: "#3B82F6", flexShrink: 0 }} />
                <span>
                  <strong>Active Clearance Exists:</strong> {existingClearanceForSelectedDog.certId} was issued on {formatDateOnly(existingClearanceForSelectedDog.date)}. Submitting will record a renewed health certificate.
                </span>
              </div>
            )}

            {/* Step C: Clearance Status (PRD Specified) */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Clearance Status
              </label>
              <div style={readOnlyFieldStyle}>
                <FaCheckCircle style={{ color: "#10B981" }} />
                <span>Cleared – Ready for Adoption</span>
              </div>
            </div>

            {/* Step D & E: Authorizing Veterinarian & Date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Authorizing Veterinarian
                </label>
                <div style={readOnlyFieldStyle}>
                  <FaUserMd style={{ color: "#6366F1" }} />
                  <span>{vetDisplayName}</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Clearance Date
                </label>
                <div style={readOnlyFieldStyle}>
                  <FaCalendarAlt style={{ color: "#0EA5E9" }} />
                  <span>{formatDateOnly(new Date().toISOString())}</span>
                </div>
              </div>
            </div>

            {/* Step F: Certificate Remarks / Notes */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Certificate Remarks / Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Dog completed physical assessment. Dewormed, vaccinated, and certified fit for adoption placement."
                value={healthForm.decisionNotes}
                onChange={(e) => setHealthForm({ ...healthForm, decisionNotes: e.target.value })}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F1F5F9",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !healthForm.dogId || selectedDogExams.length === 0}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: !healthForm.dogId || selectedDogExams.length === 0 ? "#94A3B8" : "#10B981",
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: !healthForm.dogId || selectedDogExams.length === 0 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FaCertificate />
                {isSubmitting ? "Issuing Certificate..." : "Issue Health Clearance Certificate"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* Generate Adoption Certificate Modal (Adoption Coordinator Flow) */}
      {/* ========================================================= */}
      {canCreateAdoptionCert && (
        <Modal
          isOpen={isAdoptionModalOpen}
          onClose={() => setIsAdoptionModalOpen(false)}
          title="Generate Formal Adoption Certificate"
          maxWidth="560px"
        >
          <form onSubmit={handleGenerateAdoptionCert} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <Select
                label="Dog *"
                required
                searchable
                placeholder="Search and select dog..."
                options={dogOptions}
                value={adoptionForm.dogId}
                onChange={(val) => setAdoptionForm({ ...adoptionForm, dogId: String(val) })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Recipient / Adopter Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sarah Jenkins"
                value={adoptionForm.issuedTo}
                onChange={(e) => setAdoptionForm({ ...adoptionForm, issuedTo: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setIsAdoptionModalOpen(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F1F5F9",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFF",
                  fontWeight: 600,
                }}
              >
                {isSubmitting ? "Generating..." : "Generate Certificate"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* Official Digital Health Clearance Certificate Modal Preview */}
      {/* ========================================================= */}
      <HealthClearanceCertificateModal
        isOpen={!!previewCert}
        onClose={() => setPreviewCert(null)}
        certificate={previewCert}
        assessment={previewAssessment}
      />
    </div>
  );
};

export default Certificates;
