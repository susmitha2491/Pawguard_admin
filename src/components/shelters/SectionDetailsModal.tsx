import React from "react";
import Modal from "../common/Modal";
import DataTable, { type Column } from "../common/DataTable";
import { getCurrentUserRole } from "../../utils/roleUtils";
import {
  FaLayerGroup,
  FaBuilding,
  FaBed,
  FaPaw,
  FaEye,
  FaArrowLeft,
  FaPlus,
} from "react-icons/fa";

interface SectionDetailsModalProps {
  isOpen: boolean;
  section: any | null;
  facility: any | null;
  kennels: any[];
  animals?: any[];
  onClose: () => void;
  onSelectKennel: (kennel: any) => void;
  onSelectDog: (dog: any) => void;
  onAddKennel?: (facility: any, section: any) => void;
}

export const SectionDetailsModal: React.FC<SectionDetailsModalProps> = ({
  isOpen,
  section,
  facility,
  kennels,
  animals = [],
  onClose,
  onSelectKennel,
  onSelectDog,
  onAddKennel,
}) => {
  if (!isOpen || !section) return null;

  const currentRole = getCurrentUserRole();
  const canManageKennels = [
    "super_admin",
    "shelter_manager",
    "rescue_centre_admin",
  ].includes(currentRole || "");

  const facilityName = facility?.name || "Shelter Facility";
  const sectionName = section.name || "Section / Ward";
  const sectionType = String(section.section_type || "general").toLowerCase();

  // Filter kennels belonging to this section
  const sectionIdStr = String(section.id || section.section_id || "").toLowerCase().trim();
  const sectionKennels = kennels.filter((k) => {
    if (!k) return false;
    const kSecId = String(k.section_id || "").toLowerCase().trim();
    if (kSecId && sectionIdStr) {
      return kSecId === sectionIdStr;
    }
    return k.section_name === section.name;
  });

  // Calculate strict physical kennel metrics for this section
  const configuredKennelsCount = sectionKennels.length;
  const occupiedKennelsCount = sectionKennels.filter((k) => k.is_occupied).length;
  const availableKennelsCount = Math.max(0, configuredKennelsCount - occupiedKennelsCount);
  const sectionCapacity = section.capacity ? Number(section.capacity) : configuredKennelsCount;
  const occupancyPct =
    configuredKennelsCount > 0
      ? Math.round((occupiedKennelsCount / configuredKennelsCount) * 100)
      : 0;

  // Enrich section kennels with dog details if not already populated
  const enrichedSectionKennels = sectionKennels.map((k) => {
    const assignedDog = animals.find(
      (a) =>
        String(a.kennel_id ?? a.kennelId ?? "").toLowerCase().trim() === String(k.id).toLowerCase().trim() ||
        (k.occupied_by_dog_id && String(a.id ?? "").toLowerCase().trim() === String(k.occupied_by_dog_id ?? "").toLowerCase().trim())
    );

    return {
      ...k,
      assignedDogObject: assignedDog || null,
      displayDogName: k.assigned_dog_name || assignedDog?.name || null,
      displayDogReg: k.assigned_dog_reg || assignedDog?.registration_number || (k.occupied_by_dog_id ? String(k.occupied_by_dog_id).slice(0, 8) : null),
    };
  });

  const columns: Column<any>[] = [
    {
      key: "identifier",
      header: "Kennel Unit ID",
      render: (_v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FaBed style={{ color: "#7C3AED", fontSize: "14px" }} />
          <strong style={{ color: "#0F172A", fontSize: "13px" }}>
            Unit {row.identifier || (row.id ? String(row.id).slice(0, 8) : "—")}
          </strong>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (_v, row) => (
        <span style={{ fontWeight: 600, color: "#334155" }}>
          {row.capacity ?? 1} animal{row.capacity === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      key: "sanitation_state",
      header: "Sanitation Status",
      render: (_v, row) => {
        const st = String(row.sanitation_state || "clean").toLowerCase();
        let bg = "#DCFCE7";
        let color = "#166534";
        if (st === "needs_cleaning") {
          bg = "#FEF3C7";
          color = "#92400E";
        } else if (st === "disinfecting" || st === "out_of_service") {
          bg = "#FEE2E2";
          color = "#991B1B";
        }
        return (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: bg,
              color,
              display: "inline-block",
            }}
          >
            {st.replace(/_/g, " ").toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Occupancy Status",
      render: (_v, row) => {
        const isMaintenance =
          String(row.operational_status || row.status || "").toLowerCase() === "maintenance" ||
          String(row.sanitation_state || "").toLowerCase() === "out_of_service";
        const isInactive = row.is_active === false || String(row.status || "").toLowerCase() === "inactive";

        if (isMaintenance) {
          return (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#FEF3C7",
                color: "#92400E",
              }}
            >
              MAINTENANCE
            </span>
          );
        }
        if (isInactive) {
          return (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#F1F5F9",
                color: "#64748B",
              }}
            >
              INACTIVE
            </span>
          );
        }
        if (row.is_occupied) {
          return (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#FEE2E2",
                color: "#991B1B",
              }}
            >
              OCCUPIED
            </span>
          );
        }
        return (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: "#DCFCE7",
              color: "#166534",
            }}
          >
            AVAILABLE
          </span>
        );
      },
    },
    {
      key: "assigned_dog",
      header: "Assigned Dog",
      render: (_v, row) => {
        if (row.is_occupied && (row.displayDogName || row.assignedDogObject)) {
          const dogObj = row.assignedDogObject;
          return (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (dogObj) onSelectDog(dogObj);
              }}
              style={{
                cursor: dogObj ? "pointer" : "default",
                display: "inline-block",
              }}
              title={dogObj ? "Click to view Pet Details" : undefined}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#1D4ED8",
                  textDecoration: dogObj ? "underline" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <FaPaw style={{ fontSize: "12px" }} />
                {row.displayDogName || dogObj?.name || "Assigned Dog"}
              </div>
              {row.displayDogReg && (
                <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                  <code style={{ background: "#F1F5F9", padding: "1px 4px", borderRadius: "3px" }}>
                    {row.displayDogReg}
                  </code>
                </div>
              )}
            </div>
          );
        }
        if (row.is_occupied && row.occupied_by_dog_id) {
          return (
            <code style={{ fontSize: "11px", color: "#64748B", background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px" }}>
              Dog: {String(row.occupied_by_dog_id).slice(0, 8)}...
            </code>
          );
        }
        return <span style={{ color: "#94A3B8", fontWeight: 500 }}>—</span>;
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (_v, row) => (
        <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onSelectKennel(row)}
            style={{
              padding: "4px 10px",
              background: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaEye /> View Unit
          </button>
          {row.assignedDogObject && (
            <button
              type="button"
              onClick={() => onSelectDog(row.assignedDogObject)}
              style={{
                padding: "4px 10px",
                background: "#F0FDF4",
                color: "#166534",
                border: "1px solid #BBF7D0",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaPaw /> View Dog
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Section / Ward Details — ${sectionName}`}
      size="xl"
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
            <strong style={{ color: "#0F172A" }}>{facilityName}</strong>
            <span style={{ color: "#94A3B8" }}>/</span>
            <FaLayerGroup style={{ color: "#0D9488" }} />
            <strong style={{ color: "#0D9488" }}>{sectionName}</strong>
            <span
              style={{
                textTransform: "capitalize",
                background: "#E0F2FE",
                color: "#0369A1",
                padding: "1px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                marginLeft: "4px",
              }}
            >
              {sectionType} Ward
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            {canManageKennels && onAddKennel && (
              <button
                type="button"
                onClick={() => onAddKennel(facility, section)}
                style={{
                  padding: "6px 12px",
                  background: "#7C3AED",
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
                <FaPlus /> Add Kennel to Section
              </button>
            )}
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
              <FaArrowLeft /> Back to Facility
            </button>
          </div>
        </div>

        {/* Section KPI Summary Bar */}
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
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Section / Ward</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>{sectionName}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Type: {sectionType}</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Section Capacity</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1E3A8A" }}>{sectionCapacity || "Unspecified"}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Ward Limit</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Configured Kennels</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#7C3AED" }}>{configuredKennelsCount}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Physical Units</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Occupied Kennels</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: occupiedKennelsCount > 0 ? "#DC2626" : "#64748B" }}>
              {occupiedKennelsCount}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Housed Dogs</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Available Kennels</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: availableKennelsCount > 0 ? "#16A34A" : "#64748B" }}>
              {availableKennelsCount}
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Ready for Dogs</div>
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Kennel Occupancy</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: occupancyPct > 90 ? "#DC2626" : "#0F172A" }}>
              {occupancyPct}%
            </div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>Of Configured Units</div>
          </div>
        </div>

        {/* Section Physical Kennels Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <FaBed style={{ color: "#7C3AED" }} /> Kennel Units in {sectionName} ({configuredKennelsCount})
            </h4>
            <div style={{ fontSize: "12px", color: "#64748B" }}>
              Click any row to inspect kennel details and sanitation logs.
            </div>
          </div>

          <DataTable
            columns={columns}
            data={enrichedSectionKennels}
            loading={false}
            onRowClick={(row) => onSelectKennel(row)}
            emptyMessage={`No physical kennel units configured in ${sectionName}. Click "Add Kennel to Section" to register units.`}
          />
        </div>

        {/* Modal Footer Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            borderTop: "1px solid #E2E8F0",
            paddingTop: "12px",
            marginTop: "8px",
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
            <FaArrowLeft /> Back to Facility Details
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SectionDetailsModal;
