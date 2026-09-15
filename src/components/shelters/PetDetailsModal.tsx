import React, { useState } from "react";
import Modal from "../common/Modal";
import { getDogPhotoUrl } from "../../utils/imageUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";
import {
  FaPaw,
  FaHome,
  FaHeartbeat,
  FaTruck,
  FaHandsHelping,
  FaInfoCircle,
  FaChevronDown,
  FaChevronUp,
  FaBed,
  FaTimes,
} from "react-icons/fa";

interface PetDetailsModalProps {
  isOpen: boolean;
  dog: any | null;
  facilityName?: string;
  onClose: () => void;
  onAllocateKennel?: (dog: any) => void;
}

export const PetDetailsModal: React.FC<PetDetailsModalProps> = ({
  isOpen,
  dog,
  facilityName = "Shelter Facility",
  onClose,
  onAllocateKennel,
}) => {
  const [showSystemInfo, setShowSystemInfo] = useState(false);

  if (!isOpen || !dog) return null;

  const currentRole = getCurrentUserRole();
  const canManageKennels = [
    "super_admin",
    "shelter_manager",
    "rescue_centre_admin",
    "rescue_coordinator",
  ].includes(currentRole || "");

  const photoUrl = getDogPhotoUrl(dog);
  const statusStr = String(dog.status || dog.placement_status || "SHELTER").toUpperCase();
  const isAdopted = dog.status === "adopted" || dog.is_adopted;
  const isQuarantine = dog.is_quarantine_passed === false;

  let statusBg = "#EFF6FF";
  let statusColor = "#1D4ED8";
  if (isAdopted) {
    statusBg = "#DCFCE7";
    statusColor = "#166534";
  } else if (isQuarantine) {
    statusBg = "#FEE2E2";
    statusColor = "#991B1B";
  } else if (statusStr === "ADOPTABLE") {
    statusBg = "#FEF3C7";
    statusColor = "#92400E";
  }

  const dogReg = dog.registration_number || (dog.id ? String(dog.id).slice(0, 8) : "N/A");
  const dogBreed = dog.breed || "Mixed Breed / Indie";
  const dogSpecies = dog.species || "Canine / Dog";
  const dogGender = dog.gender ? String(dog.gender).charAt(0).toUpperCase() + String(dog.gender).slice(1) : "Unknown";
  const dogAge = dog.estimated_age || (dog.age_months ? `${Math.floor(dog.age_months / 12)}y ${dog.age_months % 12}m` : "Adult");
  const dogColor = dog.color || "—";
  const dogWeight = dog.weight ? `${dog.weight} kg` : "—";
  const dogSpayed = dog.is_spayed_neutered !== undefined ? (dog.is_spayed_neutered ? "Yes (Neutered/Spayed)" : "No") : "Unspecified";

  const shelterPlacement = dog.shelter_name || facilityName || "Shelter Care";
  const sectionPlacement = dog.section_name || "General Ward";
  const kennelPlacement = dog.kennel_identifier || (dog.kennel_id ? `Unit ${dog.kennel_id}` : "Unassigned");
  const placementStatus = dog.kennel_id || dog.kennel_identifier ? "Currently Housed" : "Awaiting Kennel Allocation";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pet Details — ${dog.name || "Animal Record"}`}
      size="lg"
      maxWidth="740px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(82vh - 80px)", overflowY: "auto", paddingRight: "4px" }}>
        
        {/* HEADER SECTION: Photo, Name, Registration #, Status Badge */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
            background: "#F8FAFC",
            padding: "16px 18px",
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
            flexWrap: "wrap",
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={dog.name || "Pet Photo"}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "12px",
                objectFit: "cover",
                border: "2px solid #CBD5E1",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "12px",
                background: "#E0E7FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                flexShrink: 0,
              }}
            >
              🐶
            </div>
          )}

          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
                {dog.name || "Unnamed Dog"}
              </h2>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: statusBg,
                  color: statusColor,
                  letterSpacing: "0.5px",
                }}
              >
                {statusStr}
              </span>
            </div>

            <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <span>Registration #: <strong style={{ color: "#334155", fontFamily: "monospace" }}>{dogReg}</strong></span>
              <span>•</span>
              <span>Breed: <strong style={{ color: "#334155" }}>{dogBreed}</strong></span>
            </div>
          </div>
        </div>

        {/* SECTION A: BASIC INFORMATION */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FaPaw style={{ color: "#2563EB" }} /> Basic Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Species</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogSpecies}</div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Gender</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogGender}</div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Age</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogAge}</div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Color</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogColor}</div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Weight</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogWeight}</div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Spayed / Neutered</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>{dogSpayed}</div>
            </div>
          </div>
        </div>

        {/* SECTION B: CURRENT SHELTER PLACEMENT */}
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FaHome style={{ color: "#15803D" }} /> Current Shelter Placement
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#166534", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Shelter Facility</div>
              <div style={{ fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>{shelterPlacement}</div>
            </div>
            <div>
              <div style={{ color: "#166534", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Section / Ward</div>
              <div style={{ fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>{sectionPlacement}</div>
            </div>
            <div>
              <div style={{ color: "#166534", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Kennel Unit</div>
              <div style={{ fontWeight: 800, color: kennelPlacement !== "Unassigned" ? "#1D4ED8" : "#94A3B8", marginTop: "2px" }}>
                {kennelPlacement}
              </div>
            </div>
            <div>
              <div style={{ color: "#166534", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Placement Status</div>
              <div style={{ fontWeight: 700, color: "#166534", marginTop: "2px" }}>{placementStatus}</div>
            </div>
          </div>
        </div>

        {/* SECTION C: HEALTH & MEDICAL */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FaHeartbeat style={{ color: "#DC2626" }} /> Health & Medical Status
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Medical Status</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {dog.medical_status || dog.health_status || (isQuarantine ? "Under Quarantine" : "Normal / Good")}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Quarantine Status</div>
              <div style={{ fontWeight: 700, color: isQuarantine ? "#DC2626" : "#166534", marginTop: "2px" }}>
                {isQuarantine ? "In Quarantine / Isolation" : "Cleared"}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Vaccination Status</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {dog.vaccination_status || (dog.is_vaccinated ? "Vaccinated" : "Up to Date")}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Adoption Clearance</div>
              <div style={{ fontWeight: 700, color: dog.is_fit_for_adoption ? "#166534" : "#D97706", marginTop: "2px" }}>
                {dog.is_fit_for_adoption ? "Fit for Adoption" : (!isQuarantine ? "Medically Cleared" : "Pending Clearance")}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION D: RESCUE / OPERATIONAL INFORMATION */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FaTruck style={{ color: "#D97706" }} /> Rescue & Operational Information
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Rescue Reference</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {dog.case_number || dog.rescue_case_number || (dog.rescue_case_id ? `Case ${String(dog.rescue_case_id).slice(0, 8)}` : "Direct Shelter Intake")}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Intake / Arrival Date</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {dog.intake_date || dog.created_at ? new Date(dog.intake_date || dog.created_at).toLocaleDateString() : "—"}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Operational Status</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {statusStr}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION E: ADOPTION & FOSTER STATUS */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FaHandsHelping style={{ color: "#7C3AED" }} /> Adoption & Placement Status
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Adoption Status</div>
              <div style={{ fontWeight: 700, color: isAdopted ? "#166534" : "#1E293B", marginTop: "2px" }}>
                {isAdopted ? "Adopted" : (dog.is_adoptable ? "Adoptable" : "In Shelter Care")}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Foster Status</div>
              <div style={{ fontWeight: 700, color: "#1E293B", marginTop: "2px" }}>
                {dog.is_fostered ? "In Foster Home" : "In Shelter Facility"}
              </div>
            </div>
            <div>
              <div style={{ color: "#64748B", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>Public Visibility</div>
              <div style={{ fontWeight: 700, color: dog.is_public_visible ? "#166534" : "#64748B", marginTop: "2px" }}>
                {dog.is_public_visible ? "Publicly Listed" : "Internal Roster"}
              </div>
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE SECTION: SYSTEM INFORMATION */}
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setShowSystemInfo(!showSystemInfo)}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              color: "#64748B",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FaInfoCircle /> System Information (Technical Identifiers)
            </span>
            {showSystemInfo ? <FaChevronUp /> : <FaChevronDown />}
          </button>

          {showSystemInfo && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", fontSize: "11px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <span style={{ color: "#64748B" }}>Dog Master ID: </span>
                <code style={{ background: "#E2E8F0", padding: "1px 4px", borderRadius: "3px" }}>{dog.id || dog.dog_id || "—"}</code>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Microchip ID: </span>
                <code style={{ background: "#E2E8F0", padding: "1px 4px", borderRadius: "3px" }}>{dog.microchip_number || dog.microchip_id || "—"}</code>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Rescue Case ID: </span>
                <code style={{ background: "#E2E8F0", padding: "1px 4px", borderRadius: "3px" }}>{dog.rescue_case_id || "—"}</code>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Record Version: </span>
                <span style={{ color: "#334155" }}>{dog.version ?? "1"}</span>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Created At: </span>
                <span style={{ color: "#334155" }}>{dog.created_at ? new Date(dog.created_at).toLocaleString() : "—"}</span>
              </div>
              <div>
                <span style={{ color: "#64748B" }}>Last Updated: </span>
                <span style={{ color: "#334155" }}>{dog.updated_at ? new Date(dog.updated_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* MODAL ACTIONS BAR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid #E2E8F0", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaTimes /> Close Pet Details
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            {canManageKennels && onAllocateKennel && (
              <button
                type="button"
                onClick={() => onAllocateKennel(dog)}
                style={{
                  padding: "8px 16px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FaBed /> {kennelPlacement !== "Unassigned" ? "Change Kennel" : "Allocate Kennel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PetDetailsModal;
