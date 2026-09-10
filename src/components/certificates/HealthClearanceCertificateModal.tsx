import React from "react";
import Modal from "../common/Modal";
import { formatDateOnly } from "../../utils/dateUtils";
import {
  FaShieldAlt,
  FaStethoscope,
  FaUserMd,
  FaPrint,
} from "react-icons/fa";

export interface CertificatePreviewData {
  certId: string;
  type: string;
  dogId: string;
  dogName: string;
  dogBreed: string;
  pet?: string;
  issuedTo?: string;
  issuedBy: string;
  vetId?: string;
  date: string;
  status: string;
}

interface HealthClearanceCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: CertificatePreviewData | null;
  assessment?: any | null;
}

export const HealthClearanceCertificateModal: React.FC<HealthClearanceCertificateModalProps> = ({
  isOpen,
  onClose,
  certificate,
  assessment,
}) => {
  if (!isOpen || !certificate) return null;

  return (
    <>
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

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Digital Health / Medical Clearance Certificate"
        maxWidth="920px"
      >
        <div
          id="printable-certificate-card"
          style={{
            border: "2px solid #CBD5E1",
            borderRadius: "12px",
            padding: "18px 28px",
            background: "#FFFFFF",
            position: "relative",
            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Header / Brand */}
          <div style={{ textAlign: "center", borderBottom: "2px solid #E2E8F0", paddingBottom: "10px", marginBottom: "12px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
              <FaShieldAlt style={{ color: "#10B981", fontSize: "20px" }} />
              <span style={{ fontSize: "19px", fontWeight: 900, letterSpacing: "2px", color: "#0F172A", textTransform: "uppercase" }}>
                PAWGUARD
              </span>
            </div>
            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "1.2px" }}>
              ANIMAL HEALTH SERVICES
            </div>
            <h2 style={{ margin: "6px 0 2px", fontSize: "15px", fontWeight: 900, color: "#059669", textTransform: "uppercase", letterSpacing: "1.2px" }}>
              HEALTH / MEDICAL CLEARANCE CERTIFICATE
            </h2>
            <div style={{ fontSize: "12.5px", color: "#334155", fontWeight: 700, marginTop: "2px", fontFamily: "monospace" }}>
              Certificate ID: {certificate.certId}
            </div>
          </div>

          {/* This certifies that & Dog Information (Horizontal 3-column layout) */}
          <div style={{ marginBottom: "10px" }}>
            <p style={{ margin: "0 0 5px", fontSize: "12px", color: "#475569", fontWeight: 600 }}>
              This certifies that:
            </p>
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "8px 16px",
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1.2fr",
                gap: "14px",
                alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "#64748B", fontSize: "10px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                  DOG NAME
                </span>
                <strong style={{ fontSize: "13.5px", color: "#0F172A" }}>{certificate.dogName}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "10px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                  DOG ID
                </span>
                <strong style={{ fontSize: "13.5px", color: "#0F172A", fontFamily: "monospace" }}>
                  DOG-{certificate.dogId.replace(/^DOG-/i, "").slice(0, 8).toUpperCase()}
                </strong>
              </div>
              <div>
                <span style={{ color: "#64748B", fontSize: "10px", display: "block", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                  BREED
                </span>
                <strong style={{ fontSize: "13.5px", color: "#0F172A" }}>{certificate.dogBreed || "Mixed / Domestic"}</strong>
              </div>
            </div>
          </div>

          {/* Medical Assessment Section (Wider horizontal section) */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "5px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaStethoscope style={{ color: "#10B981" }} />
              <span>MEDICAL ASSESSMENT</span>
            </div>
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "12px",
                color: "#334155",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.1fr 1.2fr", gap: "12px", marginBottom: "5px", paddingBottom: "5px", borderBottom: "1px dashed #E2E8F0" }}>
                <div>
                  <span style={{ color: "#10B981", fontWeight: 800 }}>• </span>
                  <span style={{ fontWeight: 600 }}>Clinical examination completed</span>
                </div>
                <div>
                  <span style={{ color: "#64748B", fontWeight: 600 }}>Examination date: </span>
                  <strong style={{ color: "#0F172A" }}>
                    {assessment
                      ? formatDateOnly(assessment.exam_date || assessment.created_at)
                      : formatDateOnly(certificate.date)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#64748B", fontWeight: 600 }}>Assessment reference: </span>
                  <strong style={{ fontFamily: "monospace", color: "#0F172A" }}>
                    {assessment ? `EX-${String(assessment.id).slice(0, 8).toUpperCase()}` : `EX-${certificate.certId.replace("HC-", "")}`}
                  </strong>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <span style={{ color: "#64748B", fontWeight: 600, whiteSpace: "nowrap" }}>Relevant medical / triage finding:</span>
                <strong style={{ color: "#0F172A", fontWeight: 600, lineHeight: 1.35 }}>
                  {assessment?.triage_diagnosis &&
                  !assessment.triage_diagnosis.includes("video") &&
                  !assessment.triage_diagnosis.includes("test")
                    ? assessment.triage_diagnosis
                    : assessment?.body_condition_score
                    ? `Clinical assessment completed with Body Condition Score (BCS) ${assessment.body_condition_score}/9. Normal clinical presentation.`
                    : "Routine clinical physical assessment completed with normal vital signs."}
                </strong>
              </div>
            </div>
          </div>

          {/* Clearance Status Block (Full-width horizontal banner) */}
          <div
            style={{
              background: "#ECFDF5",
              border: "1px solid #A7F3D0",
              borderRadius: "8px",
              padding: "8px 16px",
              marginBottom: "10px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#065F46", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "2px" }}>
              CLEARANCE STATUS
            </div>
            <div style={{ fontSize: "14.5px", fontWeight: 900, color: "#047857", letterSpacing: "0.5px" }}>
              CLEARED – READY FOR ADOPTION
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "11.5px", color: "#065F46", lineHeight: 1.35 }}>
              The above dog has been medically assessed and cleared by the authorized veterinarian as fit/ready for the adoption process.
            </p>
          </div>

          {/* Authorization Section (Horizontal columns) */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "8px 16px",
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr 1fr",
              gap: "14px",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div>
              <span style={{ color: "#64748B", display: "block", fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                AUTHORIZED VETERINARIAN
              </span>
              <strong style={{ fontSize: "13px", color: "#0F172A", display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                <FaUserMd style={{ color: "#6366F1" }} />
                {certificate.issuedBy}
              </strong>
            </div>

            <div>
              <span style={{ color: "#64748B", display: "block", fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                ISSUED DATE
              </span>
              <strong style={{ fontSize: "13px", color: "#0F172A", display: "block", marginTop: "1px" }}>
                {formatDateOnly(certificate.date)}
              </strong>
            </div>

            <div>
              <span style={{ color: "#64748B", display: "block", fontSize: "10px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                CERTIFICATE STATUS
              </span>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "5px",
                  background: "#ECFDF5",
                  color: "#059669",
                  fontWeight: 800,
                  fontSize: "11px",
                  marginTop: "1px",
                  border: "1px solid #A7F3D0",
                }}
              >
                {certificate.status || "APPROVED"}
              </span>
            </div>
          </div>

          {/* Signature & Seal Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              paddingTop: "10px",
              borderTop: "1px dashed #CBD5E1",
            }}
          >
            <div>
              <div style={{ width: "200px", borderBottom: "1.5px solid #64748B", marginBottom: "3px" }} />
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>Veterinarian Authorization / Signature</div>
              <div style={{ fontSize: "10px", color: "#64748B" }}>PawGuard Animal Health Services Registry</div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  border: "2px dashed #10B981",
                  color: "#059669",
                  fontWeight: 900,
                  fontSize: "8px",
                  textAlign: "center",
                  textTransform: "uppercase",
                  lineHeight: 1.15,
                  background: "#F0FDF4",
                }}
              >
                PAWGUARD
                <br />
                OFFICIAL
                <br />
                SEAL
              </div>
            </div>
          </div>

          {/* Modal Actions Footer (Excluded during printing) */}
          <div className="cert-no-print" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "7px 15px",
                borderRadius: "7px",
                border: "1px solid #CBD5E1",
                background: "#F1F5F9",
                fontWeight: 600,
                fontSize: "12.5px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                window.print();
              }}
              style={{
                padding: "7px 16px",
                borderRadius: "7px",
                border: "none",
                background: "#10B981",
                color: "#FFF",
                fontWeight: 700,
                fontSize: "12.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <FaPrint /> Print Certificate
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default HealthClearanceCertificateModal;
