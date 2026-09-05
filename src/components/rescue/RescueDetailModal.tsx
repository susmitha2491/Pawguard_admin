import React, { useState } from "react";
import Modal from "../common/Modal";
import RescueAssignModal from "./RescueAssignModal";
import LocationMapPreview from "../common/LocationMapPreview";
import rescueService from "../../services/rescueService";
import { rescueStatusBadge, dispatchStage } from "../../utils/rescueStatus";
import { useToast } from "../../context/ToastContext";
import { notifyDataChanged } from "../../utils/dataSync";
import {
  FaDog,
  FaUser,
  FaUserCheck,
  FaExclamationTriangle,
  FaInfoCircle,
  FaCheck,
  FaTimes,
  FaCamera,
} from "react-icons/fa";

export interface RescueDetailData {
  id: string;
  ticket_number: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_alternate_phone?: string;
  reporter_email?: string;
  is_anonymous?: boolean | string;
  location_address: string;
  location_landmark?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  animal_count?: number | string;
  physical_condition?: string;
  behavioral_indicators?: string;
  environmental_factors?: string;
  severity: string;
  is_urgent?: boolean | string;
  status: string;
  rejection_rationale?: string;
  coordinator_id?: string | null;
  coordinator_name?: string;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string;
  assigned_vehicle_id?: string | null;
  assigned_vehicle_number?: string;
  dispatch_driver?: string;
  dispatch_agents?: string;
  dispatch_vehicle?: string;
  dispatch_equipment?: string;
  dispatched_at?: string;
  located_at?: string;
  rescued_at?: string;
  admitted_at?: string;
  created_at: string;
  updated_at?: string;
  reporter_notes?: string;
  media_evidence?: string[] | string;
  dispatch?: Record<string, unknown> | null;
  reports?: Record<string, unknown>[];
  rawItem?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RescueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rescue: RescueDetailData | null;
  onRefresh?: () => void | Promise<void>;
  users?: Record<string, unknown>[];
  vehicles?: Record<string, unknown>[];
}

const toSafeStr = (val: unknown): string => (val !== undefined && val !== null ? String(val) : "");
const toSafeLower = (val: unknown): string => toSafeStr(val).toLowerCase();

export const RescueDetailModal: React.FC<RescueDetailModalProps> = ({
  isOpen,
  onClose,
  rescue,
  onRefresh,
  users = [],
  vehicles = [],
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"details" | "tracking">("details");
  const [isAssignSubModalOpen, setIsAssignSubModalOpen] = useState(false);
  const [isRejectSubModalOpen, setIsRejectSubModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!rescue) return null;

  const statusLower = toSafeLower(rescue.status);
  const isPending = ["reported", "pending", "new", "submitted", "awaiting_triage"].includes(statusLower);

  const stage = dispatchStage({ status: rescue.status, dispatch: rescue.dispatch });

  const isUrgent = rescue.is_urgent === true || rescue.is_urgent === "Yes" || String(rescue.is_urgent) === "true";

  // Parse media items
  const mediaList: string[] = Array.isArray(rescue.media_evidence)
    ? rescue.media_evidence
    : typeof rescue.media_evidence === "string" && rescue.media_evidence.trim() && rescue.media_evidence !== "-"
    ? rescue.media_evidence.split(",").map((s) => s.trim())
    : Array.isArray(rescue.rawItem?.media_urls)
    ? (rescue.rawItem?.media_urls as string[])
    : [];

  const handleOpenAssignModal = () => {
    setIsAssignSubModalOpen(true);
  };

  const handleVerifyCase = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const realId = String((rescue.rawItem as any)?.id || (rescue.rawItem as any)?.request_id || (rescue.raw as any)?.id || rescue.id);
      await rescueService.approveRescueRequest(realId, {
        status: "verified",
        severity: rescue.severity,
        is_urgent: isUrgent,
      });
      addToast(`Rescue case #${rescue.ticket_number || rescue.id} verified successfully!`, "success");
      notifyDataChanged();
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to verify rescue case", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const realId = String((rescue.rawItem as any)?.id || (rescue.rawItem as any)?.request_id || (rescue.raw as any)?.id || rescue.id);
      await rescueService.rejectRescueRequest(realId, rejectionReason.trim());
      addToast(`Rescue request #${rescue.ticket_number || rescue.id} closed / rejected.`, "info");
      setIsRejectSubModalOpen(false);
      setRejectionReason("");
      notifyDataChanged();
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      addToast(e?.response?.data?.detail || e?.response?.data?.message || "Failed to reject rescue request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = statusLower === "verified";
  const isAcceptedOrActive = ["accepted", "dispatched", "in_progress", "en_route", "located", "secured"].includes(statusLower);
  const isTerminal = ["completed", "admitted", "rejected", "cancelled", "failed"].includes(statusLower);

  return (
    <>
      <Modal
        isOpen={isOpen && !isAssignSubModalOpen}
        onClose={onClose}
        title={`Rescue Case Details — ${rescue.ticket_number || rescue.id}`}
        size="lg"
      >
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", marginBottom: "16px" }}>
          <button
            onClick={() => setActiveTab("details")}
            style={{
              padding: "8px 16px",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              background: "transparent",
              color: activeTab === "details" ? "#2563EB" : "#64748B",
              borderBottom: activeTab === "details" ? "2px solid #2563EB" : "none",
              cursor: "pointer",
            }}
          >
            Incident &amp; Assignment Details
          </button>
          <button
            onClick={() => setActiveTab("tracking")}
            style={{
              padding: "8px 16px",
              fontWeight: 700,
              fontSize: "13px",
              border: "none",
              background: "transparent",
              color: activeTab === "tracking" ? "#2563EB" : "#64748B",
              borderBottom: activeTab === "tracking" ? "2px solid #2563EB" : "none",
              cursor: "pointer",
            }}
          >
            Rescue Lifecycle &amp; Progress Stepper
          </button>
        </div>

        {activeTab === "details" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* TOP KPI BANNER */}
            <div
              style={{
                background: "#F8FAFC",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Ticket / Case ID</div>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>{rescue.ticket_number || rescue.id}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Severity &amp; Urgency</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: rescue.severity === "critical" ? "#DC2626" : "#EA580C", textTransform: "uppercase" }}>
                    {rescue.severity || "MEDIUM"}
                  </span>
                  {isUrgent && (
                    <span style={{ background: "#FEF2F2", color: "#DC2626", padding: "1px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: 800 }}>
                      URGENT
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Rescue Status</div>
                <div>{rescueStatusBadge(rescue.status)}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Dispatch Stage</div>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, background: stage.bg, color: stage.color }}>
                  {stage.label}
                </span>
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Reported Time</div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{rescue.created_at || "-"}</div>
              </div>
            </div>

            {/* DOG / ANIMAL CONDITION INFO */}
            <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaDog color="#6366F1" size={14} /> Animal &amp; Physical Condition Info
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div><strong>Animal Count:</strong> {rescue.animal_count || "1"}</div>
                <div><strong>Physical Condition:</strong> <span style={{ textTransform: "capitalize" }}>{toSafeStr(rescue.physical_condition || "-").replace(/_/g, " ")}</span></div>
                <div><strong>Behavioral Indicators:</strong> {toSafeStr(rescue.behavioral_indicators || "-")}</div>
                <div><strong>Environmental Factors:</strong> {toSafeStr(rescue.environmental_factors || "-")}</div>
              </div>
            </div>

            {/* REPORTER INFORMATION */}
            <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaUser color="#2563EB" size={14} /> Field Reporter Details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div><strong>Reporter Name:</strong> {rescue.is_anonymous ? "Anonymous Reporter" : rescue.reporter_name || "Unknown"}</div>
                <div><strong>Phone Number:</strong> {toSafeStr(rescue.reporter_phone || "Not provided")}</div>
                {rescue.reporter_alternate_phone && rescue.reporter_alternate_phone !== "-" && (
                  <div><strong>Alt Phone:</strong> {rescue.reporter_alternate_phone}</div>
                )}
                {rescue.reporter_email && rescue.reporter_email !== "-" && (
                  <div><strong>Email:</strong> {rescue.reporter_email}</div>
                )}
              </div>
              {rescue.reporter_notes && rescue.reporter_notes !== "-" && (
                <div style={{ marginTop: "10px", background: "#F8FAFC", padding: "10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E2E8F0" }}>
                  <strong style={{ color: "#475569" }}><FaInfoCircle size={11} style={{ marginRight: "4px" }} /> Reporter Description / Notes:</strong>
                  <div style={{ color: "#334155", marginTop: "2px" }}>{rescue.reporter_notes}</div>
                </div>
              )}
            </div>

            {/* REJECTION RATIONALE IF PRESENT */}
            {rescue.rejection_rationale && rescue.rejection_rationale !== "-" && (
              <div style={{ background: "#FEF2F2", padding: "12px 14px", borderRadius: "10px", border: "1px solid #FCA5A5" }}>
                <strong style={{ color: "#DC2626", display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  <FaExclamationTriangle size={12} style={{ marginRight: "6px" }} /> Rejection / Case Closure Rationale:
                </strong>
                <span style={{ fontSize: "13px", color: "#991B1B" }}>{rescue.rejection_rationale}</span>
              </div>
            )}

            {/* MEDIA EVIDENCE / PHOTOS */}
            {mediaList.length > 0 && (
              <div style={{ background: "#FFF", padding: "14px", borderRadius: "10px", border: "1px solid #CBD5E1" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaCamera color="#D97706" size={14} /> Field Media Evidence &amp; Photos ({mediaList.length})
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {mediaList.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        width: "90px",
                        height: "90px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid #CBD5E1",
                        background: "#F1F5F9",
                      }}
                    >
                      <img
                        src={url}
                        alt={`Evidence ${idx + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* LOCATION MAP PREVIEW */}
            <div>
              <LocationMapPreview
                latitude={rescue.latitude}
                longitude={rescue.longitude}
                locationAddress={rescue.location_address}
                locationLandmark={rescue.location_landmark}
                height="220px"
                title="Rescue Incident Field Location"
              />
            </div>

            {/* CURRENT OPERATIONAL ASSIGNMENT */}
            <div style={{ background: "#EFF6FF", padding: "14px", borderRadius: "10px", border: "1px solid #93C5FD" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1E40AF", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaUserCheck size={14} /> Current Operational Assignment
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "13px", color: "#1E3A8A" }}>
                <div><strong>Assigned Coordinator:</strong> {rescue.coordinator_name || rescue.coordinator_id || "Unassigned"}</div>
                <div><strong>Assigned Rescue Agent:</strong> {rescue.assigned_agent_name || rescue.dispatch_agents || rescue.assigned_agent_id || "Unassigned"}</div>
                <div><strong>Assigned Vehicle:</strong> {rescue.assigned_vehicle_number || rescue.dispatch_vehicle || rescue.assigned_vehicle_id || "Unassigned"}</div>
                <div><strong>Dispatch Driver:</strong> {rescue.dispatch_driver || "Unassigned"}</div>
                {rescue.dispatch_equipment && rescue.dispatch_equipment !== "-" && (
                  <div><strong>Equipment / Notes:</strong> {rescue.dispatch_equipment}</div>
                )}
              </div>
            </div>

            {/* RESCUE CENTRE ADMIN ACTIONS (STATUS-AWARE) */}
            {!isTerminal && (
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px", flexWrap: "wrap" }}>
                {isPending && (
                  <>
                    <button
                      type="button"
                      onClick={handleVerifyCase}
                      disabled={isSubmitting}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#10B981",
                        color: "#FFF",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaCheck size={12} /> Verify Case
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRejectSubModalOpen(true)}
                      disabled={isSubmitting}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#EF4444",
                        color: "#FFF",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaTimes size={12} /> Reject Request
                    </button>
                  </>
                )}

                {(isVerified || isAcceptedOrActive) && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenAssignModal}
                      disabled={isSubmitting}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#2563EB",
                        color: "#FFF",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaUserCheck size={12} /> Assign Coordinator / Dispatch Team
                    </button>

                    {isVerified && (
                      <button
                        type="button"
                        onClick={() => setIsRejectSubModalOpen(true)}
                        disabled={isSubmitting}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#EF4444",
                          color: "#FFF",
                          fontWeight: 700,
                          fontSize: "13px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <FaTimes size={12} /> Reject Request
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* TIMELINE STEPPER TAB */
          <div style={{ padding: "12px 0" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "16px", color: "#0F172A" }}>
              Chronological Rescue Lifecycle Progress
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { title: "Rescue Request Submitted", time: rescue.created_at, done: true },
                { title: "Coordinator Reviewed & Verified", time: rescue.created_at, done: !isPending },
                { title: "Dispatch Team & Vehicle Assigned", time: rescue.dispatched_at || "-", done: Boolean(rescue.dispatch || rescue.assigned_agent_id || rescue.dispatch_agents) },
                { title: "Agent En Route to Field Scene", time: rescue.dispatched_at || "-", done: ["en_route", "in_progress", "located", "secured", "rescued", "admitted", "completed"].includes(statusLower) },
                { title: "Agent Arrived & Dog Located", time: rescue.located_at || "-", done: rescue.located_at !== undefined && rescue.located_at !== "-" },
                { title: "Dog Rescued & Secured", time: rescue.rescued_at || "-", done: rescue.rescued_at !== undefined && rescue.rescued_at !== "-" },
                { title: "Transferred to Shelter / Vet Clinic", time: rescue.admitted_at || "-", done: rescue.admitted_at !== undefined && rescue.admitted_at !== "-" },
                { title: "Rescue Mission Completed", time: rescue.updated_at || "-", done: ["completed", "admitted"].includes(statusLower) },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: step.done ? "#10B981" : "#E2E8F0",
                      color: step.done ? "#FFF" : "#64748B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {step.done ? "✓" : i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: step.done ? "#0F172A" : "#94A3B8" }}>{step.title}</div>
                    <div style={{ fontSize: "11px", color: "#64748B" }}>Timestamp: {step.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ASSIGNMENT MODAL */}
      <RescueAssignModal
        isOpen={isAssignSubModalOpen}
        onClose={() => setIsAssignSubModalOpen(false)}
        rescue={rescue}
        onRefresh={onRefresh}
        users={users}
        vehicles={vehicles}
      />

      {/* REJECT MODAL */}
      <Modal
        isOpen={isRejectSubModalOpen}
        onClose={() => setIsRejectSubModalOpen(false)}
        title={`Reject Rescue Request — ${rescue.ticket_number || rescue.id}`}
      >
        <form onSubmit={handleRejectSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#334155" }}>
              Rejection Rationale / Reason for Closing Case *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide reason for rejecting or closing this rescue request (e.g. Duplicate report, invalid address, animal already safe)..."
              rows={4}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => setIsRejectSubModalOpen(false)}
              style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFF", fontSize: "13px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", borderRadius: "6px", background: "#EF4444", color: "#FFF", border: "none", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default RescueDetailModal;
