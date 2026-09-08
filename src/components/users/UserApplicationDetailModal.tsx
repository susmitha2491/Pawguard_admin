import { useState, useEffect, useCallback } from "react";
import Modal from "../common/Modal";
import { useToast } from "../../context/ToastContext";
import { usePermissions } from "../../context/PermissionContext";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaFileAlt,
  FaImage,
  FaExternalLinkAlt,
  FaDownload,
  FaHistory,
  FaUser,
  FaInfoCircle,
  FaClipboardList,
} from "react-icons/fa";
import volunteerService from "../../services/volunteerService";
import fosterService from "../../services/fosterService";
import adoptionService from "../../services/adoptionService";
import lostFoundService from "../../services/lostFoundService";
import rescueService from "../../services/rescueService";
import auditService from "../../services/auditService";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";
import { notifyDataChanged } from "../../utils/dataSync";
import IdentityVerificationPanel from "../adoptions/IdentityVerificationPanel";
import type { AdopterIdentityVerification } from "../../types/identityVerification";

export interface ApplicationMediaItem {
  label: string;
  url: string;
  isImage?: boolean;
}

export interface ApplicationHistoryItem {
  event: string;
  status?: string;
  timestamp: string;
  actor?: string;
  notes?: string;
}

export interface UnifiedUserApplication {
  id: string;
  type: "volunteer" | "foster" | "adoption" | "lost_found" | "rescue";
  title: string;
  subtitle?: string;
  status: string; // "pending" | "approved" | "rejected" | "completed"
  statusLabel: string;
  submittedAt: string;
  updatedAt?: string;
  completedAt?: string;
  rawRecord: Record<string, unknown>;
  rejectionReason?: string | null;
  notes?: string | null;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  address?: string;
  mediaUrls?: ApplicationMediaItem[];
  history?: ApplicationHistoryItem[];
}

interface UserApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: UnifiedUserApplication | null;
  userProfile?: {
    id: string;
    name?: string | null;
    full_name?: string | null;
    email: string;
    phone?: string | null;
  } | null;
  onApplicationUpdated?: () => void;
}

const formatFieldName = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const renderFieldValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Not provided</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        style={{
          background: value ? "#DCFCE7" : "#FEE2E2",
          color: value ? "#166534" : "#991B1B",
          padding: "2px 8px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: "#94A3B8", fontStyle: "italic" }}>None</span>;
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {value.map((item, idx) => (
            <span key={idx} style={{ background: "#F1F5F9", color: "#334155", padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>
              {typeof item === "object" ? JSON.stringify(item) : String(item)}
            </span>
          ))}
        </div>
      );
    }
    return <pre style={{ margin: 0, fontSize: "11px", background: "#F8FAFC", padding: "8px", borderRadius: "6px", overflowX: "auto" }}>{JSON.stringify(value, null, 2)}</pre>;
  }
  return String(value);
};

export const UserApplicationDetailModal = ({
  isOpen,
  onClose,
  application,
  userProfile,
  onApplicationUpdated,
}: UserApplicationDetailModalProps) => {
  const { addToast } = useToast();
  const { has } = usePermissions();
  const currentUserRole = getCurrentUserRole();
  const isSuperAdmin = currentUserRole === "super_admin";

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [approvalNotesInput, setApprovalNotesInput] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [auditLogs, setAuditLogs] = useState<ApplicationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [identityVerification, setIdentityVerification] = useState<AdopterIdentityVerification | null>(null);

  // Fetch identity verification data for adoption applications
  useEffect(() => {
    if (!application || !isOpen || application.type !== "adoption") {
      setIdentityVerification(null);
      return;
    }
    let isMounted = true;
    void adoptionService.getAdopterIdentityVerification(String(application.id)).then((res) => {
      if (isMounted) {
        setIdentityVerification(res?.data || res || null);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [application, isOpen]);

  // Fetch application audit history from backend when modal opens
  const fetchAuditHistory = useCallback(async () => {
    if (!application || !isOpen) return;
    setLoadingHistory(true);
    try {
      const queryUserId = userProfile?.id;
      const res = await auditService.getAuditLogs({
        user_id: queryUserId,
        limit: 50,
      });
      const items = Array.isArray((res as any)?.data) ? (res as any).data : Array.isArray(res) ? res : [];
      const matched: ApplicationHistoryItem[] = items
        .filter((entry: any) => {
          const msg = String(entry.message || "").toLowerCase();
          const target = String(entry.target_id || entry.entity_id || entry.resource_id || "").toLowerCase();
          const appTarget = String(application.id).toLowerCase();
          return target.includes(appTarget) || msg.includes(appTarget) || entry.module === application.type;
        })
        .map((entry: any) => ({
          event: entry.action || entry.title || "Audit Entry",
          status: entry.status || entry.action,
          timestamp: entry.created_at || entry.timestamp || new Date().toISOString(),
          actor: entry.actor_name || entry.user_id || "System / Admin",
          notes: entry.message || entry.details,
        }));

      setAuditLogs(matched);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [application, isOpen, userProfile?.id]);

  useEffect(() => {
    if (isOpen && application) {
      void fetchAuditHistory();
    }
  }, [isOpen, application, fetchAuditHistory]);

  if (!application) return null;

  const statusKey = application.status;
  const isPending = statusKey === "pending";
  const isApproved = statusKey === "approved";
  const isRejected = statusKey === "rejected";
  const isCompleted = statusKey === "completed";

  // Build list of display fields excluding structural metadata
  const ignoredKeys = new Set([
    "id",
    "applicationId",
    "ticketNumber",
    "dog_id",
    "adopter_id",
    "user_id",
    "created_at",
    "updated_at",
    "submitted_at",
    "completed_at",
    "dog",
    "adopter",
    "user",
    "photo_url",
    "photo_urls",
    "media_evidence",
    "adoption_agreement_url",
    "microchip_doc_url",
    "vet_bill_url",
    "photo_proof_url",
    "avatar_url",
    "profile_picture_url",
  ]);

  const formFields = Object.entries(application.rawRecord).filter(([key]) => !ignoredKeys.has(key));

  // Extract all media/document items
  const mediaList: ApplicationMediaItem[] = application.mediaUrls ? [...application.mediaUrls] : [];
  const rec = application.rawRecord;
  if (typeof rec.photo_url === "string" && rec.photo_url) {
    mediaList.push({ label: "Primary Photo", url: rec.photo_url, isImage: true });
  }
  if (Array.isArray(rec.photo_urls)) {
    rec.photo_urls.forEach((u: any, idx: number) => {
      if (typeof u === "string" && u) mediaList.push({ label: `Uploaded Photo #${idx + 1}`, url: u, isImage: true });
    });
  }
  if (Array.isArray(rec.media_evidence)) {
    rec.media_evidence.forEach((u: any, idx: number) => {
      if (typeof u === "string" && u) mediaList.push({ label: `Media Evidence #${idx + 1}`, url: u, isImage: true });
    });
  }
  if (typeof rec.adoption_agreement_url === "string" && rec.adoption_agreement_url) {
    mediaList.push({ label: "Adoption Agreement Document", url: rec.adoption_agreement_url, isImage: false });
  }
  if (typeof rec.microchip_doc_url === "string" && rec.microchip_doc_url) {
    mediaList.push({ label: "Microchip Verification Document", url: rec.microchip_doc_url, isImage: false });
  }
  if (typeof rec.vet_bill_url === "string" && rec.vet_bill_url) {
    mediaList.push({ label: "Veterinary Bill / Medical Proof", url: rec.vet_bill_url, isImage: false });
  }
  if (typeof rec.photo_proof_url === "string" && rec.photo_proof_url) {
    mediaList.push({ label: "Ownership Photo Proof", url: rec.photo_proof_url, isImage: true });
  }

  // Handle Application Approval Action
  const handleApproveConfirm = async () => {
    try {
      setIsSubmittingAction(true);
      const appId = application.id;

      if (application.type === "volunteer") {
        await volunteerService.approveApplication(appId, approvalNotesInput.trim() || undefined);
      } else if (application.type === "foster") {
        await fosterService.updateProfile(appId, {
          status: "approved",
          vetting_notes: approvalNotesInput.trim() || "Approved by Super Admin",
        });
      } else if (application.type === "adoption") {
        const petName = String(rec.petName || rec.dog_name || "Pet");
        const adopterId = (rec.adopter_id || userProfile?.id) as string;
        await adoptionService.updateAdoptionStatus(appId, "approved", adopterId, petName);
        if (approvalNotesInput.trim()) {
          await adoptionService.updateAdoptionDetails(appId, { vetting_officer_notes: approvalNotesInput.trim() });
        }
      } else if (application.type === "lost_found") {
        await lostFoundService.resolveMatch(appId, true);
      } else if (application.type === "rescue") {
        await rescueService.approveRescueRequest(appId, { status: "verified" });
      }

      addToast(`${application.title} APPROVED successfully!`, "success");
      notifyDataChanged();
      setIsApproveDialogOpen(false);
      setApprovalNotesInput("");
      onClose();
      if (onApplicationUpdated) onApplicationUpdated();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to approve application.";
      addToast(String(msg), "error");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Application Rejection Action
  const handleRejectConfirm = async () => {
    if (!rejectionReasonInput.trim()) {
      addToast("Please provide a reason for rejecting the application.", "error");
      return;
    }

    try {
      setIsSubmittingAction(true);
      const appId = application.id;
      const reason = rejectionReasonInput.trim();

      if (application.type === "volunteer") {
        await volunteerService.rejectApplication(appId, reason);
      } else if (application.type === "foster") {
        await fosterService.updateProfile(appId, {
          status: "rejected",
          vetting_notes: reason,
        });
      } else if (application.type === "adoption") {
        const petName = String(rec.petName || rec.dog_name || "Pet");
        const adopterId = (rec.adopter_id || userProfile?.id) as string;
        await adoptionService.updateAdoptionDetails(appId, {
          status: "rejected",
          vetting_officer_notes: reason,
        });
        await adoptionService.updateAdoptionStatus(appId, "rejected", adopterId, petName);
      } else if (application.type === "lost_found") {
        await lostFoundService.resolveMatch(appId, false);
      } else if (application.type === "rescue") {
        await rescueService.rejectRescueRequest(appId, reason);
      }

      addToast(`${application.title} REJECTED.`, "success");
      notifyDataChanged();
      setIsRejectDialogOpen(false);
      setRejectionReasonInput("");
      onClose();
      if (onApplicationUpdated) onApplicationUpdated();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Failed to reject application.";
      addToast(String(msg), "error");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${application.title} Details — ID: ${application.id}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxHeight: "80vh", overflowY: "auto", paddingRight: "4px" }}>
          {/* Header & Status Card */}
          <div
            style={{
              background: isPending ? "#FFFBEB" : isApproved ? "#F0FDF4" : isCompleted ? "#EFF6FF" : "#FEF2F2",
              border: `1px solid ${isPending ? "#FDE68A" : isApproved ? "#BBF7D0" : isCompleted ? "#BFDBFE" : "#FCA5A5"}`,
              padding: "16px",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    background: "#FFFFFF",
                    color: "#0F172A",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "1px solid #CBD5E1",
                    textTransform: "uppercase",
                  }}
                >
                  {application.type.replace("_", " ")}
                </span>
                <span
                  style={{
                    background: isPending ? "#FEF3C7" : isApproved ? "#DCFCE7" : isCompleted ? "#DBEAFE" : "#FEE2E2",
                    color: isPending ? "#B45309" : isApproved ? "#15803D" : isCompleted ? "#1E40AF" : "#B91C1C",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {application.statusLabel}
                </span>
              </div>
              <h3 style={{ margin: "8px 0 2px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
                {application.title}
              </h3>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                Submitted: <strong>{formatDateTime(application.submittedAt)}</strong>
                {application.updatedAt && (
                  <span> &bull; Updated: <strong>{formatDateTime(application.updatedAt)}</strong></span>
                )}
              </div>
            </div>

            {/* Application-Specific Action Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isPending && (isSuperAdmin || has("approve_adoptions") || has("manage_volunteers")) && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovalNotesInput("");
                      setIsApproveDialogOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "#16A34A",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: isSubmittingAction ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <FaCheckCircle size={14} /> Approve Application
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectionReasonInput("");
                      setIsRejectDialogOpen(true);
                    }}
                    disabled={isSubmittingAction}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      background: "#DC2626",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: isSubmittingAction ? "wait" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <FaTimesCircle size={14} /> Reject Application
                  </button>
                </>
              )}

              {isApproved && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontSize: "13px", fontWeight: 700 }}>
                  <FaCheckCircle size={15} /> Application Approved
                </div>
              )}

              {isRejected && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#991B1B", fontSize: "13px", fontWeight: 700 }}>
                  <FaTimesCircle size={15} /> Application Rejected
                </div>
              )}

              {isCompleted && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1E40AF", fontSize: "13px", fontWeight: 700 }}>
                  <FaCheckCircle size={15} /> Application Completed
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Applicant Information */}
          <div>
            <h4 style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaUser size={12} /> Applicant Information
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <div>
                <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Full Name</label>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                  {application.applicantName || userProfile?.full_name || userProfile?.name || "Not provided"}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Email Address</label>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#2563EB", marginTop: "2px" }}>
                  {application.applicantEmail || userProfile?.email || "Not provided"}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Phone Number</label>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                  {application.applicantPhone || userProfile?.phone || "Not provided"}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Address / Location</label>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#334155", marginTop: "2px" }}>
                  {application.address || (rec.location_address as string) || (rec.home_inspection_address as string) || "Not provided"}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>User ID (UUID)</label>
                <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#475569", marginTop: "2px" }}>
                  {userProfile?.id || (rec.user_id as string) || (rec.adopter_id as string) || "Not available"}
                </div>
              </div>
            </div>
          </div>

          {/* Identity Verification Panel (Adoption Applications) */}
          {application.type === "adoption" && (
            <IdentityVerificationPanel
              verification={identityVerification}
              applicantName={application.applicantName || userProfile?.name || userProfile?.full_name || "Applicant"}
              onRequestManualReview={async (notes) => {
                try {
                  await adoptionService.requestIdentityManualReview(String(application.id), notes);
                  addToast("Identity manual review note saved successfully", "success");
                  const res = await adoptionService.getAdopterIdentityVerification(String(application.id));
                  setIdentityVerification(res?.data || res || null);
                } catch (err: any) {
                  addToast(err?.message || "Failed to submit manual review", "error");
                }
              }}
            />
          )}

          {/* Section 2: Complete Submitted Form Data */}
          <div>
            <h4 style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaClipboardList size={12} /> Submitted Form Data &amp; Answers
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              {formFields.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", color: "#64748B", fontSize: "13px", fontStyle: "italic" }}>
                  No additional form fields available.
                </div>
              ) : (
                formFields.map(([key, val]) => (
                  <div key={key} style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #F1F5F9" }}>
                    <label style={{ display: "block", fontSize: "11px", color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: "3px" }}>
                      {formatFieldName(key)}
                    </label>
                    <div style={{ fontSize: "13px", color: "#1E293B", wordBreak: "break-word" }}>
                      {renderFieldValue(val)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 3: Uploaded Documents & Media */}
          <div>
            <h4 style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaFileAlt size={12} /> Uploaded Documents &amp; Media ({mediaList.length})
            </h4>
            {mediaList.length === 0 ? (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px", color: "#94A3B8", fontSize: "13px", fontStyle: "italic" }}>
                No uploaded documents or media files attached to this application.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {mediaList.map((media, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      borderRadius: "10px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {media.isImage ? <FaImage size={16} color="#2563EB" /> : <FaFileAlt size={16} color="#6D28D9" />}
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {media.label}
                      </span>
                    </div>

                    {media.isImage && (
                      <img
                        src={media.url}
                        alt={media.label}
                        style={{ width: "100%", height: "110px", objectFit: "cover", borderRadius: "6px", border: "1px solid #E2E8F0" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    )}

                    <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
                      <a
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "#EFF6FF",
                          color: "#1D4ED8",
                          fontSize: "12px",
                          fontWeight: 600,
                          textAlign: "center",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        <FaExternalLinkAlt size={11} /> Open File
                      </a>
                      <a
                        href={media.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "#F1F5F9",
                          color: "#475569",
                          fontSize: "12px",
                          fontWeight: 600,
                          textAlign: "center",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <FaDownload size={11} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Application History & Audit Timeline */}
          <div>
            <h4 style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaHistory size={12} /> Application History &amp; Timeline
            </h4>
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Event 1: Initial Submission */}
                <div style={{ display: "flex", gap: "12px", borderLeft: "2px solid #2563EB", paddingLeft: "12px" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A" }}>Application Submitted</div>
                    <div style={{ fontSize: "11px", color: "#64748B" }}>
                      {formatDateTime(application.submittedAt)} &bull; Submitted by {application.applicantName || userProfile?.name || "Applicant"}
                    </div>
                  </div>
                </div>

                {/* Rejection Reason display if rejected */}
                {isRejected && application.rejectionReason && (
                  <div style={{ display: "flex", gap: "12px", borderLeft: "2px solid #DC2626", paddingLeft: "12px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#991B1B" }}>Application Rejected</div>
                      <div style={{ fontSize: "12px", color: "#991B1B", marginTop: "2px", background: "#FEF2F2", padding: "8px 10px", borderRadius: "6px", border: "1px solid #FCA5A5" }}>
                        <strong>Rejection Reason:</strong> {application.rejectionReason}
                      </div>
                    </div>
                  </div>
                )}

                {/* Audit log history entries */}
                {loadingHistory ? (
                  <div style={{ fontSize: "12px", color: "#64748B" }}>Loading history entries...</div>
                ) : (
                  auditLogs.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "12px", borderLeft: "2px solid #94A3B8", paddingLeft: "12px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>{item.event}</div>
                        <div style={{ fontSize: "11px", color: "#64748B" }}>
                          {formatDateTime(item.timestamp)} &bull; {item.actor || "Admin"}
                        </div>
                        {item.notes && <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{item.notes}</div>}
                      </div>
                    </div>
                  ))
                )}

                {/* Event Final: Approved / Completed */}
                {isApproved && (
                  <div style={{ display: "flex", gap: "12px", borderLeft: "2px solid #16A34A", paddingLeft: "12px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>Application Approved</div>
                      <div style={{ fontSize: "11px", color: "#15803D" }}>
                        {application.updatedAt ? formatDateTime(application.updatedAt) : "Reviewed and verified"} &bull; Super Admin
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={isApproveDialogOpen}
        onClose={() => setIsApproveDialogOpen(false)}
        title={`Approve ${application.title}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.4 }}>
            <FaInfoCircle size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
            Are you sure you want to approve this <strong>{application.title}</strong>? This decision will be persisted to the backend API and reflected on the public website.
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Approval Notes / Remarks (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Provide approval notes or instructions..."
              value={approvalNotesInput}
              onChange={(e) => setApprovalNotesInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isSubmittingAction}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApproveConfirm}
              disabled={isSubmittingAction}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#16A34A",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isSubmittingAction ? "wait" : "pointer",
              }}
            >
              {isSubmittingAction ? "Approving..." : "Confirm Approval"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rejection Rationale Modal */}
      <Modal
        isOpen={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
        title={`Reject ${application.title}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.4 }}>
            ⚠️ Rejection requires providing an explicit reason. This reason will be persisted to the backend and visible to the applicant.
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Rejection Rationale / Reason *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Enter specific reason for rejection..."
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={isSubmittingAction}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectConfirm}
              disabled={isSubmittingAction || !rejectionReasonInput.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#DC2626",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isSubmittingAction ? "wait" : "pointer",
              }}
            >
              {isSubmittingAction ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default UserApplicationDetailModal;
