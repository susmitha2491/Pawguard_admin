import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import DataTable, { type Column } from "../common/DataTable";
import shelterService from "../../services/shelterService";
import petService from "../../services/petService";
import { useToast } from "../../context/ToastContext";
import { getCurrentUserRole } from "../../utils/roleUtils";
import { getDogPhotoUrl } from "../../utils/imageUtils";
import {
  FaPaw,
  FaBroom,
  FaClipboardList,
  FaBuilding,
  FaLayerGroup,
  FaBed,
  FaArrowLeft,
  FaUserPlus,
  FaCheckCircle,
} from "react-icons/fa";

interface KennelDetailsModalProps {
  kennel: any | null;
  isOpen: boolean;
  facilityName?: string;
  sectionName?: string;
  sectionType?: string;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenAssign?: (kennel: any) => void;
  onSelectDog?: (dog: any) => void;
}

const unwrapList = (v: any) =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

export const KennelDetailsModal: React.FC<KennelDetailsModalProps> = ({
  kennel,
  isOpen,
  facilityName = "Shelter Facility",
  sectionName,
  sectionType,
  onClose,
  onRefresh,
  onOpenAssign,
  onSelectDog,
}) => {
  const { addToast } = useToast();
  const [cleaningLogs, setCleaningLogs] = useState<any[]>([]);
  const [occupantDog, setOccupantDog] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // New cleaning log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [sanitationStateAfter, setSanitationStateAfter] = useState<string>("clean");
  const [cleaningMethod, setCleaningMethod] = useState<string>("Deep Steam & Disinfectant Wipe");
  const [cleaningNotes, setCleaningNotes] = useState<string>("");

  const currentRole = getCurrentUserRole();
  const canManageKennels = [
    "super_admin",
    "shelter_manager",
    "rescue_centre_admin",
    "rescue_coordinator",
  ].includes(currentRole || "");

  useEffect(() => {
    if (!kennel?.id || !isOpen) return;

    let isMounted = true;
    const fetchKennelDetails = async () => {
      setLoading(true);
      try {
        const dogId = kennel.occupied_by_dog_id || kennel.assignedDogObject?.id || kennel.dog_id;
        const [logsRes, dogRes] = await Promise.all([
          shelterService.getKennelCleaningLogs(kennel.id).catch(() => ({ data: [] })),
          dogId
            ? petService.getPetById(dogId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!isMounted) return;

        setCleaningLogs(unwrapList(logsRes));
        const rawDog = dogRes?.data || dogRes || kennel.assignedDogObject || null;
        setOccupantDog(rawDog);
      } catch {
        // quiet fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchKennelDetails();
    return () => {
      isMounted = false;
    };
  }, [kennel, isOpen]);

  if (!isOpen || !kennel) return null;

  const resolvedFacility = kennel.facility_name || facilityName || "Shelter Facility";
  const resolvedSection = kennel.section_name || sectionName || "General Ward";
  const resolvedSectionType = kennel.section_type || sectionType || "general";

  const isMaintenance =
    String(kennel.operational_status || kennel.status || "").toLowerCase() === "maintenance" ||
    String(kennel.sanitation_state || "").toLowerCase() === "out_of_service";
  const isInactive = kennel.is_active === false || String(kennel.status || "").toLowerCase() === "inactive";
  const isOccupied = Boolean(kennel.is_occupied || kennel.occupied_by_dog_id || occupantDog);

  let operationalStatusLabel = "Active";
  let operationalStatusBg = "#DCFCE7";
  let operationalStatusColor = "#166534";
  if (isMaintenance) {
    operationalStatusLabel = "Under Maintenance";
    operationalStatusBg = "#FEF3C7";
    operationalStatusColor = "#92400E";
  } else if (isInactive) {
    operationalStatusLabel = "Inactive";
    operationalStatusBg = "#F1F5F9";
    operationalStatusColor = "#64748B";
  }

  const handleQuickSanitize = async () => {
    try {
      setLoading(true);
      await shelterService.updateKennelSanitation(kennel.id);
      addToast(`Kennel "${kennel.identifier}" marked as CLEAN.`, "success");
      if (onRefresh) onRefresh();
      // Refetch cleaning logs
      const logsRes = await shelterService.getKennelCleaningLogs(kennel.id).catch(() => ({ data: [] }));
      setCleaningLogs(unwrapList(logsRes));
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update sanitation state.";
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCleaningLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingLog(true);
      await shelterService.createKennelCleaningLog(kennel.id, {
        sanitation_state_after: sanitationStateAfter as any,
        cleaning_method: cleaningMethod,
        notes: cleaningNotes,
      });
      addToast("Cleaning log recorded successfully!", "success");
      setShowLogForm(false);
      setCleaningNotes("");
      const logsRes = await shelterService.getKennelCleaningLogs(kennel.id).catch(() => ({ data: [] }));
      setCleaningLogs(unwrapList(logsRes));
      if (onRefresh) onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to record cleaning log.";
      addToast(msg, "error");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const cleaningColumns: Column<any>[] = [
    {
      key: "cleaned_at",
      header: "Logged At",
      render: (_v, row) => new Date(row.cleaned_at || row.created_at).toLocaleString(),
    },
    { key: "cleaned_by", header: "Cleaned By", render: (_v, row) => row.cleaned_by || "Staff" },
    {
      key: "sanitation_state_after",
      header: "State After",
      render: (_v, row) => (
        <span style={{ textTransform: "uppercase", fontWeight: 700, fontSize: "11px" }}>
          {row.sanitation_state_after}
        </span>
      ),
    },
    { key: "cleaning_method", header: "Method", render: (_v, row) => row.cleaning_method || "General Cleaning" },
    { key: "notes", header: "Notes", render: (_v, row) => row.notes || "—" },
  ];

  const dogPhoto = occupantDog ? getDogPhotoUrl(occupantDog) : null;
  const dogReg = occupantDog?.registration_number || (occupantDog?.id ? String(occupantDog.id).slice(0, 8) : null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Kennel Unit Details — Unit ${kennel.identifier || kennel.id}`}
      size="lg"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Navigation Breadcrumb / Context Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#F1F5F9",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#334155" }}>
            <FaBuilding style={{ color: "#1E3A8A" }} />
            <strong style={{ color: "#0F172A" }}>{resolvedFacility}</strong>
            <span style={{ color: "#94A3B8" }}>/</span>
            <FaLayerGroup style={{ color: "#0D9488" }} />
            <strong style={{ color: "#0D9488" }}>{resolvedSection}</strong>
            <span
              style={{
                textTransform: "capitalize",
                background: "#E0F2FE",
                color: "#0369A1",
                padding: "1px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                marginLeft: "2px",
              }}
            >
              {resolvedSectionType}
            </span>
            <span style={{ color: "#94A3B8" }}>/</span>
            <FaBed style={{ color: "#7C3AED" }} />
            <strong style={{ color: "#7C3AED" }}>Unit {kennel.identifier}</strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              background: "#FFFFFF",
              color: "#334155",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaArrowLeft /> Back
          </button>
        </div>

        {/* Unit Summary Header Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "12px",
            background: "#F8FAFC",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Kennel Unit ID</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>Unit {kennel.identifier}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{resolvedSection}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Capacity</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#2563EB", marginTop: "2px" }}>
              {kennel.capacity ?? 1} animal(s)
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Physical Limit</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Sanitation Status</div>
            <div style={{ marginTop: "4px" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background:
                    kennel.sanitation_state === "clean"
                      ? "#DCFCE7"
                      : kennel.sanitation_state === "needs_cleaning"
                      ? "#FEF3C7"
                      : "#FEE2E2",
                  color:
                    kennel.sanitation_state === "clean"
                      ? "#166534"
                      : kennel.sanitation_state === "needs_cleaning"
                      ? "#92400E"
                      : "#991B1B",
                }}
              >
                {(kennel.sanitation_state || "clean").toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Operational Status</div>
            <div style={{ marginTop: "4px" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: operationalStatusBg,
                  color: operationalStatusColor,
                }}
              >
                {operationalStatusLabel.toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Occupancy Status</div>
            <div style={{ marginTop: "4px" }}>
              {isOccupied ? (
                <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#FEE2E2", color: "#991B1B" }}>
                  OCCUPIED
                </span>
              ) : (
                <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700, background: "#DCFCE7", color: "#166534" }}>
                  AVAILABLE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current Occupant Section */}
        <div
          style={{
            background: isOccupied ? "#F0FDF4" : "#F8FAFC",
            padding: "16px",
            borderRadius: "8px",
            border: `1px solid ${isOccupied ? "#BBF7D0" : "#E2E8F0"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <h4
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: isOccupied ? "#166534" : "#0F172A",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaPaw style={{ color: isOccupied ? "#16A34A" : "#2563EB" }} /> Assigned Dog
            </h4>

            {!isOccupied && canManageKennels && onOpenAssign && (
              <button
                type="button"
                onClick={() => onOpenAssign(kennel)}
                style={{
                  padding: "6px 12px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaUserPlus /> Allocate Kennel / Assign Dog
              </button>
            )}
          </div>

          {isOccupied && occupantDog ? (
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "10px",
                  background: "#E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "2px solid #CBD5E1",
                }}
              >
                {dogPhoto ? (
                  <img
                    src={dogPhoto}
                    alt={occupantDog.name || "Assigned Dog"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <FaPaw style={{ fontSize: "28px", color: "#94A3B8" }} />
                )}
              </div>

              <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "16px", color: "#0F172A" }}>{occupantDog.name || "Assigned Dog"}</strong>
                  {dogReg && (
                    <code style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                      {dogReg}
                    </code>
                  )}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: occupantDog.is_quarantine_passed ? "#DCFCE7" : "#FEE2E2",
                      color: occupantDog.is_quarantine_passed ? "#166534" : "#991B1B",
                    }}
                  >
                    {occupantDog.is_quarantine_passed ? "QUARANTINE CLEARED" : "IN QUARANTINE"}
                  </span>
                </div>

                <div style={{ color: "#475569", fontSize: "12px" }}>
                  Breed: <strong>{occupantDog.breed || "Mixed Breed"}</strong> • Gender: <strong style={{ textTransform: "capitalize" }}>{occupantDog.gender || "Unknown"}</strong> • Age: <strong>{occupantDog.estimated_age || "Adult"}</strong>
                </div>

                <div style={{ color: "#64748B", fontSize: "12px" }}>
                  Status: <strong style={{ textTransform: "uppercase" }}>{occupantDog.status || "HOUSED"}</strong> • Placement: <strong>{resolvedFacility} › {resolvedSection}</strong>
                </div>
              </div>

              {onSelectDog && (
                <button
                  type="button"
                  onClick={() => onSelectDog(occupantDog)}
                  style={{
                    padding: "8px 14px",
                    background: "#1D4ED8",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FaPaw /> View Pet Details
                </button>
              )}
            </div>
          ) : isOccupied ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "13px", color: "#DC2626" }}>
                Kennel unit is flagged as occupied by Dog: <code>{kennel.occupied_by_dog_id || kennel.assigned_dog_name || "Assigned"}</code>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#166534", fontSize: "13px", fontWeight: 500 }}>
              <FaCheckCircle style={{ color: "#16A34A" }} />
              <span>Kennel unit is currently <strong>AVAILABLE</strong> and ready for animal intake or ward assignment.</span>
            </div>
          )}
        </div>

        {/* Cleaning & Sanitation Log Section */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <FaClipboardList style={{ color: "#0D9488" }} /> Cleaning & Sanitation Logs
            </h4>
            <div style={{ display: "flex", gap: "8px" }}>
              {canManageKennels && (
                <button
                  type="button"
                  onClick={handleQuickSanitize}
                  disabled={loading}
                  style={{
                    padding: "6px 12px",
                    background: "#16A34A",
                    color: "#FFF",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaBroom /> Mark Sanitized (Clean)
                </button>
              )}
              {canManageKennels && (
                <button
                  type="button"
                  onClick={() => setShowLogForm(!showLogForm)}
                  style={{
                    padding: "6px 12px",
                    background: "#2563EB",
                    color: "#FFF",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {showLogForm ? "Cancel Log" : "+ Log Cleaning Event"}
                </button>
              )}
            </div>
          </div>

          {showLogForm && (
            <form
              onSubmit={handleAddCleaningLog}
              style={{
                background: "#EFF6FF",
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid #BFDBFE",
                marginBottom: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#1E3A8A", display: "block", marginBottom: "4px" }}>
                    Sanitation State After *
                  </label>
                  <select
                    value={sanitationStateAfter}
                    onChange={(e) => setSanitationStateAfter(e.target.value)}
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #93C5FD" }}
                  >
                    <option value="clean">Clean</option>
                    <option value="needs_cleaning">Needs Cleaning</option>
                    <option value="disinfecting">Disinfecting</option>
                    <option value="out_of_service">Out of Service</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#1E3A8A", display: "block", marginBottom: "4px" }}>
                    Cleaning Method
                  </label>
                  <input
                    type="text"
                    value={cleaningMethod}
                    onChange={(e) => setCleaningMethod(e.target.value)}
                    placeholder="e.g. Steam Sanitation, Chemical Wipe"
                    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #93C5FD" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontWeight: 600, color: "#1E3A8A", display: "block", marginBottom: "4px" }}>
                  Log Notes
                </label>
                <textarea
                  value={cleaningNotes}
                  onChange={(e) => setCleaningNotes(e.target.value)}
                  placeholder="Additional observations, bedding replaced, disinfectant used, etc."
                  rows={2}
                  style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #93C5FD" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={isSubmittingLog}
                  style={{
                    padding: "6px 16px",
                    background: "#1D4ED8",
                    color: "#FFF",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isSubmittingLog ? "Saving Log..." : "Submit Cleaning Log"}
                </button>
              </div>
            </form>
          )}

          <DataTable
            columns={cleaningColumns}
            data={cleaningLogs}
            loading={loading}
            emptyMessage="No cleaning logs recorded for this kennel unit."
          />
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #E2E8F0",
            paddingTop: "12px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              background: "#F1F5F9",
              color: "#334155",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaArrowLeft /> Back
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            {!isOccupied && canManageKennels && onOpenAssign && (
              <button
                type="button"
                onClick={() => onOpenAssign(kennel)}
                style={{
                  padding: "8px 16px",
                  background: "#2563EB",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaUserPlus /> Assign Animal to Kennel
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default KennelDetailsModal;
