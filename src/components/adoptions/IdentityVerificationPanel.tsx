import React, { useState } from "react";
import {
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaLock,
  FaClock,
  FaHistory,
  FaChevronDown,
  FaChevronUp,
  FaSpinner,
} from "react-icons/fa";
import type { AdopterIdentityVerification } from "../../types/identityVerification";
import { formatDateTime } from "../../utils/dateUtils";
import { usePermissions } from "../../context/PermissionContext";

interface IdentityVerificationPanelProps {
  verification?: AdopterIdentityVerification | null;
  applicantName?: string;
  onRequestManualReview?: (notes?: string) => Promise<void>;
  isLoading?: boolean;
}

/** Utility helper to safely format masked identity identifiers */
const formatMaskedId = (id?: string | null): string => {
  if (!id || id.trim() === "") return "•••• •••• ••••";
  const clean = id.replace(/\s+/g, "");
  if (clean.length > 4) {
    const last4 = clean.slice(-4);
    return `XXXX-XXXX-${last4}`;
  }
  return id;
};

/** Status Badge Color Mapper */
const getStatusBadgeStyle = (status?: string | null) => {
  const s = String(status || "").toUpperCase().trim();
  switch (s) {
    case "VERIFIED":
    case "DOCUMENT_RECEIVED":
    case "APPROVED":
      return { bg: "#DCFCE7", color: "#15803D", border: "#86EFAC", icon: <FaCheckCircle /> };
    case "VERIFICATION_PENDING":
    case "OTP_PENDING":
    case "AUTHORIZATION_PENDING":
    case "DOCUMENT_RETRIEVAL_PENDING":
    case "DOCUMENT_VERIFICATION_PENDING":
    case "RETRIEVAL_PENDING":
    case "PENDING":
      return { bg: "#FEF3C7", color: "#B45309", border: "#FCD34D", icon: <FaClock /> };
    case "MANUAL_REVIEW":
    case "AUTHORIZATION_REQUIRED":
      return { bg: "#FFEDD5", color: "#C2410C", border: "#FDBA74", icon: <FaExclamationTriangle /> };
    case "FAILED":
    case "REJECTED":
      return { bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5", icon: <FaTimesCircle /> };
    case "NOT_CONNECTED":
    case "NOT_STARTED":
    case "NOT_PROVIDED":
    case "NOT_RETRIEVED":
    default:
      return { bg: "#F1F5F9", color: "#64748B", border: "#CBD5E1", icon: <FaLock /> };
  }
};

/** Human-readable status labels */
const formatStatusLabel = (status?: string | null): string => {
  if (!status) return "Not Started";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export const IdentityVerificationPanel: React.FC<IdentityVerificationPanelProps> = ({
  verification,
  applicantName = "Applicant",
  onRequestManualReview,
  isLoading = false,
}) => {
  const { has, canView, canManage } = usePermissions();
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // RBAC Permission Checks
  const canViewIdentity = has("view_adoptions") || has("edit_adoptions") || has("approve_adoptions") || canView("adoptions");
  const canManageReview = has("edit_adoptions") || has("manage_adoptions") || has("approve_adoptions") || canManage("adoptions");

  if (!canViewIdentity) {
    return (
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
          borderRadius: "10px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "#64748B",
          fontSize: "13px",
        }}
      >
        <FaLock size={16} />
        <span>You do not have permission to view sensitive identity verification details.</span>
      </div>
    );
  }

  // Fallback defaults if no backend verification data object provided
  const data: AdopterIdentityVerification = verification || {
    verification_status: "NOT_STARTED",
    aadhaar_status: "NOT_STARTED",
    digilocker_status: "NOT_CONNECTED",
    primary_id: {
      doc_type: "aadhaar",
      doc_label: "Aadhaar eKYC",
      is_required: true,
      status: "NOT_RETRIEVED",
    },
    secondary_id: null, // Optional, genuine absence
  };

  const mainBadge = getStatusBadgeStyle(data.verification_status);
  const aadhaarBadge = getStatusBadgeStyle(data.aadhaar_status);
  const digiLockerBadge = getStatusBadgeStyle(data.digilocker_status);
  const primaryBadge = getStatusBadgeStyle(data.primary_id.status);
  const secondaryBadge = data.secondary_id
    ? getStatusBadgeStyle(data.secondary_id.status)
    : getStatusBadgeStyle("NOT_PROVIDED");

  const handleManualReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRequestManualReview) return;
    try {
      setIsSubmittingReview(true);
      await onRequestManualReview(reviewNotes);
      setShowReviewForm(false);
      setReviewNotes("");
    } catch {
      // Error handled by parent toast
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          background: "#1E293B",
          color: "#FFFFFF",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38BDF8",
            }}
          >
            {isLoading ? <FaSpinner className="animate-spin" size={18} /> : <FaShieldAlt size={20} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#F8FAFC" }}>
              Adopter Identity Verification
            </h3>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
              {applicantName} &bull; Provider: <strong>{data.provider || "DigiLocker / UIDAI"}</strong>
              {data.reference_id && (
                <> &bull; Ref: <span style={{ fontFamily: "monospace" }}>{data.reference_id}</span></>
              )}
            </div>
          </div>
        </div>

        {/* Overall Status Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: mainBadge.bg,
            color: mainBadge.color,
            border: `1px solid ${mainBadge.border}`,
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {mainBadge.icon}
          <span>{formatStatusLabel(data.verification_status)}</span>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Verification Sub-Statuses */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Aadhaar Authentication Status */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Aadhaar Authentication Status
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                UIDAI eKYC Verification
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: aadhaarBadge.bg,
                  color: aadhaarBadge.color,
                  border: `1px solid ${aadhaarBadge.border}`,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {aadhaarBadge.icon}
                {formatStatusLabel(data.aadhaar_status)}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#475569" }}>
              Masked Identifier: <strong style={{ fontFamily: "monospace" }}>{formatMaskedId(data.masked_identifier)}</strong>
            </div>
          </div>

          {/* DigiLocker Document Status */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              DigiLocker Authorization Status
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                DigiLocker Integration
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: digiLockerBadge.bg,
                  color: digiLockerBadge.color,
                  border: `1px solid ${digiLockerBadge.border}`,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {digiLockerBadge.icon}
                {formatStatusLabel(data.digilocker_status)}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#475569" }}>
              Last Verified: {data.verification_timestamp ? formatDateTime(data.verification_timestamp) : "Pending Backend Sync"}
            </div>
          </div>
        </div>

        {/* Primary & Secondary Government ID Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Primary Government ID (Required) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "12px 14px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    marginRight: "6px",
                  }}
                >
                  Required
                </span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
                  Primary Government ID
                </span>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: primaryBadge.bg,
                  color: primaryBadge.color,
                  border: `1px solid ${primaryBadge.border}`,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {primaryBadge.icon}
                {formatStatusLabel(data.primary_id.status)}
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div>Document Type: <strong>{data.primary_id.doc_label || data.primary_id.doc_type || "Aadhaar eKYC"}</strong></div>
              <div>Masked Ref: <strong style={{ fontFamily: "monospace" }}>{formatMaskedId(data.primary_id.masked_identifier || data.masked_identifier)}</strong></div>
              {data.primary_id.provider && <div>Provider: {data.primary_id.provider}</div>}
              {data.primary_id.verified_at && (
                <div style={{ fontSize: "11px", color: "#64748B" }}>Verified At: {formatDateTime(data.primary_id.verified_at)}</div>
              )}
            </div>
          </div>

          {/* Secondary Government ID (Optional) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    background: "#64748B",
                    color: "#FFFFFF",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    marginRight: "6px",
                  }}
                >
                  Optional
                </span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
                  Secondary Government ID
                </span>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: secondaryBadge.bg,
                  color: secondaryBadge.color,
                  border: `1px solid ${secondaryBadge.border}`,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {secondaryBadge.icon}
                {data.secondary_id ? formatStatusLabel(data.secondary_id.status) : "Not Provided"}
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#334155", display: "flex", flexDirection: "column", gap: "4px" }}>
              {data.secondary_id ? (
                <>
                  <div>Document Type: <strong>{data.secondary_id.doc_label || data.secondary_id.doc_type || "Passport / Driving License"}</strong></div>
                  <div>Masked Ref: <strong style={{ fontFamily: "monospace" }}>{formatMaskedId(data.secondary_id.masked_identifier)}</strong></div>
                  {data.secondary_id.verified_at && (
                    <div style={{ fontSize: "11px", color: "#64748B" }}>Verified At: {formatDateTime(data.secondary_id.verified_at)}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "12px", color: "#64748B", fontStyle: "italic", marginTop: "4px" }}>
                  No secondary ID submitted. (Absence of secondary ID does not impact adoption evaluation).
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual Review Alert & Actions */}
        {(data.verification_status === "MANUAL_REVIEW" || data.manual_review_status === "PENDING" || showReviewForm) && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FFD8A8", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#C2410C", fontWeight: 700, fontSize: "13px" }}>
              <FaExclamationTriangle />
              <span>Identity Verification Requires Manual Review</span>
            </div>
            {data.manual_review_notes && (
              <div style={{ fontSize: "12px", color: "#9A3412", marginTop: "4px" }}>
                Reason: {data.manual_review_notes}
              </div>
            )}
            {canManageReview && onRequestManualReview && !showReviewForm && (
              <button
                type="button"
                onClick={() => setShowReviewForm(true)}
                style={{
                  marginTop: "8px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#C2410C",
                  color: "#FFF",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Log Manual Review Action
              </button>
            )}
          </div>
        )}

        {/* Manual Review Submission Form */}
        {showReviewForm && canManageReview && (
          <form
            onSubmit={handleManualReviewSubmit}
            style={{
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
              Submit Identity Verification Manual Review Notes
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Enter manual document review findings or notes..."
              rows={2}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "12px",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReview}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {isSubmittingReview ? "Submitting..." : "Save Review Note"}
              </button>
            </div>
          </form>
        )}

        {/* Verification Audit Trail Toggle & Timeline */}
        {data.audit_trail && data.audit_trail.length > 0 && (
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
            <button
              type="button"
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#2563EB",
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <FaHistory size={12} />
              <span>Identity Verification Audit History ({data.audit_trail.length})</span>
              {showAuditTrail ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
            </button>

            {showAuditTrail && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.audit_trail.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#0F172A" }}>{item.event_label || item.event}</strong>
                      {item.notes && <div style={{ color: "#64748B", fontSize: "11px" }}>{item.notes}</div>}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748B", textAlign: "right" }}>
                      <div>{formatDateTime(item.timestamp)}</div>
                      {item.actor && <div style={{ fontStyle: "italic" }}>By: {item.actor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IdentityVerificationPanel;
