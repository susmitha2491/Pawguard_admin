import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import DataTable, { type Column } from "../common/DataTable";
import shelterService from "../../services/shelterService";
import dogService from "../../services/dogService";
import PetDetailsModal from "./PetDetailsModal";
import SectionDetailsModal from "./SectionDetailsModal";
import KennelDetailsModal from "./KennelDetailsModal";
import {
  FaBuilding,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaBed,
  FaPaw,
  FaUserMd,
  FaExclamationTriangle,
  FaEdit,
  FaLayerGroup,
  FaEye,
} from "react-icons/fa";

interface ShelterDetailsModalProps {
  facilityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEditFacility?: (facility: any) => void;
  onAddSection?: (facility: any) => void;
  onAddKennel?: (facility: any) => void;
  onAssignAnimal?: (facility: any, dog?: any) => void;
}

const unwrapList = (v: any) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  if (Array.isArray(v?.data?.items)) return v.data.items;
  if (Array.isArray(v?.items)) return v.items;
  return [];
};

const EXITED_STATUSES = new Set([
  "adopted",
  "transferred",
  "released",
  "rehomed",
  "deceased",
  "returned",
  "archived",
  "exited",
  "placed",
]);

const isDogCurrentlyHoused = (d: any): boolean => {
  if (!d || typeof d !== "object") return false;
  const status = String(d.status || d.lifecycle_status || d.placement_status || "").toLowerCase().trim();
  if (EXITED_STATUSES.has(status)) return false;
  if (d.is_adopted === true || d.is_deceased === true || d.is_transferred === true) {
    return false;
  }
  return true;
};

export const ShelterDetailsModal: React.FC<ShelterDetailsModalProps> = ({
  facilityId,
  isOpen,
  onClose,
  onEditFacility,
  onAddSection,
  onAddKennel,
  onAssignAnimal,
}) => {
  const [activeTab, setActiveTab] = useState<"kennels" | "info" | "animals" | "medical">("kennels");
  const [loading, setLoading] = useState(true);
  const [facility, setFacility] = useState<any | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [kennels, setKennels] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedPetForDetails, setSelectedPetForDetails] = useState<any | null>(null);
  const [selectedSectionForDetails, setSelectedSectionForDetails] = useState<any | null>(null);
  const [selectedKennelForDetails, setSelectedKennelForDetails] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facilityId || !isOpen) {
      setFacility(null);
      setSections([]);
      setKennels([]);
      setAnimals([]);
      setSelectedPetForDetails(null);
      setSelectedSectionForDetails(null);
      setSelectedKennelForDetails(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Reset state immediately on modal open / facility change to prevent stale data leaks
    setFacility(null);
    setSections([]);
    setKennels([]);
    setAnimals([]);
    setSelectedPetForDetails(null);
    setSelectedSectionForDetails(null);
    setSelectedKennelForDetails(null);
    setError(null);
    setLoading(true);

    let isMounted = true;
    const fetchFacilityDetails = async () => {
      try {
        const targetFacIdStr = String(facilityId).toLowerCase().trim();

        // 1. Fetch Facility Details and Facility Sections for selected facilityId
        const [facRes, secRes] = await Promise.all([
          shelterService.getShelterById(facilityId).catch(() => null),
          shelterService.getFacilitySections(facilityId).catch(() => ({ data: [] })),
        ]);

        if (!isMounted) return;

        const facData = facRes?.data || facRes;
        setFacility(facData);

        const rawSecList = unwrapList(secRes);
        // Ensure sections belong strictly to this facility
        const secList = rawSecList.filter((sec: any) => {
          if (!sec) return false;
          const sFacId = sec.facility_id || sec.shelter_id || sec.shelter_facility_id;
          if (sFacId && String(sFacId).toLowerCase().trim() !== targetFacIdStr) return false;
          return true;
        });
        setSections(secList);

        // 2. Parallel fetch kennels strictly for sections belonging to this facility
        const kennelPromises = secList.map(async (sec: any) => {
          const sId = sec.id || sec.section_id;
          if (!sId) return [];
          try {
            const kRes = await shelterService.getSectionKennels(sId);
            const kList = unwrapList(kRes).map((k: any) => ({
              ...k,
              facility_id: facilityId,
              facility_name: facData?.name || "Shelter Facility",
              section_id: sId,
              section_name: sec.name,
              section_type: sec.section_type,
            }));
            return kList;
          } catch {
            return [];
          }
        });

        const kennelResults = await Promise.allSettled(kennelPromises);
        if (!isMounted) return;

        const facilityKennels: any[] = [];
        kennelResults.forEach((res) => {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            facilityKennels.push(...res.value);
          }
        });

        // Deduplicate kennels by ID
        const seenKennelIds = new Set<string>();
        const uniqueFacilityKennels = facilityKennels.filter((k: any) => {
          const kId = String(k.id || k.kennel_id || "").toLowerCase().trim();
          if (!kId) return true;
          if (seenKennelIds.has(kId)) return false;
          seenKennelIds.add(kId);
          return true;
        });

        const kennelIdsSet = new Set<string>(
          uniqueFacilityKennels.map((k: any) => String(k.id || k.kennel_id || "").toLowerCase().trim()).filter(Boolean)
        );
        const occupiedDogIdsSet = new Set<string>(
          uniqueFacilityKennels
            .map((k: any) => (k.occupied_by_dog_id ? String(k.occupied_by_dog_id).toLowerCase().trim() : null))
            .filter((id): id is string => Boolean(id))
        );

        // 3. Fetch full dataset of dogs across pages from Dog Master
        const dogsRes = await dogService.getAllDogs().catch(() => ({ data: [] }));
        if (!isMounted) return;

        const rawDogs = unwrapList(dogsRes);

        // 4. Strict Facility Isolation & Active Housing Filter:
        // Exclude dogs that have completed exit lifecycles (ADOPTED, TRANSFERRED, RELEASED, REHOMED, DECEASED, RETURNED)
        // RULE 1: If a dog explicitly has a shelter_id/facility_id, it MUST equal selectedFacilityId! Never leak dogs from other shelters!
        // RULE 2: If a dog has NO explicit shelter_id, it is included ONLY if it has an exact kennel assignment in this facility!
        const rawFacilityDogs = rawDogs.filter((d: any) => {
          if (!d || typeof d !== "object") return false;

          // Exclude dogs that are no longer physically housed at the shelter
          if (!isDogCurrentlyHoused(d)) return false;

          const dId = String(d.id || d.dog_id || "").toLowerCase().trim();
          const rawShelterId =
            d.shelter_facility_id ??
            d.shelter_id ??
            d.facility_id ??
            d.shelterId ??
            d.organization_id;

          const dShelterId = rawShelterId ? String(rawShelterId).toLowerCase().trim() : null;

          if (dShelterId) {
            // Explicit shelter ID present: MUST match target facility ID exactly!
            return dShelterId === targetFacIdStr;
          }

          // No explicit shelter ID present: match ONLY if assigned to a kennel/occupied slot in this facility
          const matchesOccupiedDogId = Boolean(dId) && occupiedDogIdsSet.has(dId);
          const rawKennelId = d.kennel_id ?? d.kennelId;
          const dKennelId = rawKennelId ? String(rawKennelId).toLowerCase().trim() : null;
          const matchesKennelId = dKennelId ? kennelIdsSet.has(dKennelId) : false;

          return matchesOccupiedDogId || matchesKennelId;
        });

        // 5. Strict Deduplication: Prevent duplicate dog records
        const seenDogIds = new Set<string>();
        const facilityDogs = rawFacilityDogs.filter((d: any) => {
          const key = String(d.id || d.dog_id || d.registration_number || "").toLowerCase().trim();
          if (!key) return true;
          if (seenDogIds.has(key)) return false;
          seenDogIds.add(key);
          return true;
        });

        // Enrich kennels with assigned dog details, clearing stale occupied slots for adopted/exited dogs
        const enrichedKennels = uniqueFacilityKennels.map((k: any) => {
          const assignedDog = facilityDogs.find(
            (d: any) =>
              String(d.kennel_id ?? d.kennelId ?? "").toLowerCase().trim() === String(k.id).toLowerCase().trim() ||
              String(d.id ?? "").toLowerCase().trim() === String(k.occupied_by_dog_id ?? "").toLowerCase().trim()
          );

          // Check if occupied_by_dog_id refers to an exited dog
          let isOccupiedByCurrentDog = Boolean(assignedDog);
          if (!isOccupiedByCurrentDog && k.occupied_by_dog_id) {
            const rawOccDog = rawDogs.find(
              (rd: any) => String(rd.id || rd.dog_id || "").toLowerCase().trim() === String(k.occupied_by_dog_id).toLowerCase().trim()
            );
            if (rawOccDog && isDogCurrentlyHoused(rawOccDog)) {
              isOccupiedByCurrentDog = true;
            }
          } else if (!isOccupiedByCurrentDog && k.is_occupied && !k.occupied_by_dog_id) {
            isOccupiedByCurrentDog = true;
          }

          return {
            ...k,
            is_occupied: isOccupiedByCurrentDog,
            assigned_dog_name: assignedDog?.name || null,
            assigned_dog_reg: assignedDog?.registration_number || null,
            assignedDogObject: assignedDog || null,
          };
        });

        // Enrich dogs with assigned kennel & section identifiers
        const enrichedDogs = facilityDogs.map((d: any) => {
          const kennel = enrichedKennels.find(
            (k: any) =>
              String(k.id).toLowerCase().trim() === String(d.kennel_id ?? d.kennelId ?? "").toLowerCase().trim() ||
              String(k.occupied_by_dog_id ?? "").toLowerCase().trim() === String(d.id).toLowerCase().trim()
          );
          return {
            ...d,
            section_name: kennel?.section_name || d.section_name || "General",
            kennel_identifier: kennel?.identifier ? `Unit ${kennel.identifier}` : (d.kennel_identifier || "Unassigned"),
          };
        });

        setKennels(enrichedKennels);
        setAnimals(enrichedDogs);
      } catch (err: any) {
        if (isMounted) {
          setError(
            err?.response?.data?.detail ||
              err?.response?.data?.message ||
              "Unable to load facility data."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFacilityDetails();
    return () => {
      isMounted = false;
    };
  }, [facilityId, isOpen]);

  if (!isOpen) return null;

  // Single-Modal Navigation Stack: Exactly one modal is rendered at a time without stacking
  if (selectedPetForDetails) {
    return (
      <PetDetailsModal
        isOpen={true}
        dog={selectedPetForDetails}
        facilityName={facility?.name || "Shelter Facility"}
        onClose={() => setSelectedPetForDetails(null)}
        onAllocateKennel={(dog) => {
          setSelectedPetForDetails(null);
          if (onAssignAnimal) onAssignAnimal(facility, dog);
        }}
      />
    );
  }

  if (selectedKennelForDetails) {
    return (
      <KennelDetailsModal
        isOpen={true}
        kennel={selectedKennelForDetails}
        facilityName={facility?.name || "Shelter Facility"}
        sectionName={selectedKennelForDetails.section_name}
        sectionType={selectedKennelForDetails.section_type}
        onClose={() => setSelectedKennelForDetails(null)}
        onSelectDog={(dog) => setSelectedPetForDetails(dog)}
        onOpenAssign={
          onAssignAnimal
            ? () => {
                const k = selectedKennelForDetails;
                setSelectedKennelForDetails(null);
                onAssignAnimal(facility, k.assignedDogObject);
              }
            : undefined
        }
      />
    );
  }

  if (selectedSectionForDetails) {
    return (
      <SectionDetailsModal
        isOpen={true}
        section={selectedSectionForDetails}
        facility={facility}
        kennels={kennels}
        animals={animals}
        onClose={() => setSelectedSectionForDetails(null)}
        onSelectKennel={(k) => setSelectedKennelForDetails(k)}
        onSelectDog={(dog) => setSelectedPetForDetails(dog)}
        onAddKennel={
          onAddKennel
            ? () => {
                setSelectedSectionForDetails(null);
                onAddKennel(facility);
              }
            : undefined
        }
      />
    );
  }

  // Facility Capacity & Physical Kennel KPI calculations strictly scoped to this facility
  const declaredCap = Number(facility?.total_capacity ?? facility?.capacity ?? 0);
  const configuredSectionsCount = sections.length;
  const configuredKennelsCount = kennels.length;
  const occupiedKennelsCount = kennels.filter((k) => k.is_occupied).length;
  const availableKennelsCount = Math.max(0, configuredKennelsCount - occupiedKennelsCount);
  const animalsHousedCount = animals.length;

  // Occupancy percentage based on declared facility capacity (or physical kennels if no capacity declared)
  const occupancyBase = declaredCap > 0 ? declaredCap : configuredKennelsCount;
  const occupancyCount = declaredCap > 0 ? animalsHousedCount : occupiedKennelsCount;
  const occupancyPct = occupancyBase > 0 ? Math.round((occupancyCount / occupancyBase) * 100) : 0;

  const medicalQuarantineAnimals = animals.filter((a) => {
    if (!a || typeof a !== "object") return false;
    const isQuarantineNotPassed = a.is_quarantine_passed === false;
    const st = String(a.status || "").toLowerCase().trim();
    return isQuarantineNotPassed || st === "clinic" || st === "quarantine" || st === "medical_hold";
  });

  const sectionColumns: Column<any>[] = [
    {
      key: "name",
      header: "Section / Ward Name",
      render: (_v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FaLayerGroup style={{ color: "#0D9488", fontSize: "14px" }} />
          <strong style={{ color: "#0F172A", fontSize: "13px" }}>{row.name}</strong>
        </div>
      ),
    },
    {
      key: "section_type",
      header: "Ward Type",
      render: (_v, row) => (
        <span
          style={{
            textTransform: "capitalize",
            background: "#EFF6FF",
            color: "#1D4ED8",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid #BFDBFE",
          }}
        >
          {row.section_type || "general"}
        </span>
      ),
    },
    {
      key: "capacity",
      header: "Ward Capacity",
      render: (_v, row) => <span style={{ fontWeight: 600, color: "#334155" }}>{row.capacity ?? "Unspecified"}</span>,
    },
    {
      key: "configured_kennels",
      header: "Configured Kennels",
      render: (_v, row) => {
        const secKennels = kennels.filter(
          (k) => String(k.section_id).toLowerCase() === String(row.id).toLowerCase() || k.section_name === row.name
        );
        return <span style={{ fontWeight: 600, color: "#7C3AED" }}>{secKennels.length} unit(s)</span>;
      },
    },
    {
      key: "occupied_kennels",
      header: "Occupied",
      render: (_v, row) => {
        const secKennels = kennels.filter(
          (k) => String(k.section_id).toLowerCase() === String(row.id).toLowerCase() || k.section_name === row.name
        );
        const occupied = secKennels.filter((k) => k.is_occupied).length;
        return (
          <span style={{ color: occupied > 0 ? "#DC2626" : "#64748B", fontWeight: occupied > 0 ? 700 : 500 }}>
            {occupied}
          </span>
        );
      },
    },
    {
      key: "available_kennels",
      header: "Available",
      render: (_v, row) => {
        const secKennels = kennels.filter(
          (k) => String(k.section_id).toLowerCase() === String(row.id).toLowerCase() || k.section_name === row.name
        );
        const occupied = secKennels.filter((k) => k.is_occupied).length;
        const avail = Math.max(0, secKennels.length - occupied);
        return <span style={{ color: "#16A34A", fontWeight: 700 }}>{avail}</span>;
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSectionForDetails(row);
          }}
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
          <FaEye /> View Section
        </button>
      ),
    },
  ];

  const kennelColumns: Column<any>[] = [
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
    { key: "section_name", header: "Section / Ward", render: (_v, row) => row.section_name || "General" },
    { key: "capacity", header: "Capacity", render: (_v, row) => row.capacity ?? 1 },
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
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: bg,
              color,
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
                padding: "2px 8px",
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
                padding: "2px 8px",
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
                padding: "2px 8px",
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
              padding: "2px 8px",
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
      key: "assigned_dog_name",
      header: "Assigned Dog",
      render: (_v, row) => {
        if (row.is_occupied && row.assigned_dog_name) {
          const assignedDog =
            row.assignedDogObject ||
            animals.find(
              (a) =>
                String(a.kennel_id ?? a.kennelId ?? "").toLowerCase().trim() === String(row.id).toLowerCase().trim() ||
                (row.occupied_by_dog_id &&
                  String(a.id ?? "").toLowerCase().trim() === String(row.occupied_by_dog_id ?? "").toLowerCase().trim())
            );
          return (
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (assignedDog) setSelectedPetForDetails(assignedDog);
              }}
              style={{ cursor: assignedDog ? "pointer" : "default" }}
              title={assignedDog ? "Click to view Pet Details" : undefined}
            >
              <strong style={{ color: "#1D4ED8", textDecoration: assignedDog ? "underline" : "none" }}>
                {row.assigned_dog_name}
              </strong>
              {row.assigned_dog_reg && (
                <div style={{ fontSize: "11px", color: "#64748B" }}>
                  <code>{row.assigned_dog_reg}</code>
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
        return <span style={{ color: "#94A3B8" }}>—</span>;
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedKennelForDetails(row);
          }}
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
      ),
    },
  ];

  const animalColumns: Column<any>[] = [
    {
      key: "registration_number",
      header: "Registration #",
      render: (_v, row) => (
        <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>
          {row.registration_number || (row.id ? row.id.slice(0, 8) : "N/A")}
        </code>
      ),
    },
    { key: "name", header: "Dog Name", render: (_v, row) => <strong>{row.name}</strong> },
    { key: "breed", header: "Breed", render: (_v, row) => row.breed || "-" },
    { key: "gender", header: "Gender", render: (_v, row) => <span style={{ textTransform: "capitalize" }}>{row.gender || "-"}</span> },
    { key: "section_name", header: "Section / Ward", render: (_v, row) => <span>{row.section_name || "General"}</span> },
    { key: "kennel_identifier", header: "Kennel", render: (_v, row) => <span>{row.kennel_identifier || "Unassigned"}</span> },
    {
      key: "status",
      header: "Status",
      render: (_v, row) => (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 700,
            background: "#F1F5F9",
            color: "#334155",
            textTransform: "uppercase",
          }}
        >
          {row.status || "SHELTER"}
        </span>
      ),
    },
    {
      key: "medical_status",
      header: "Medical Status",
      render: (_v, row) => {
        const isQuarantine = row.is_quarantine_passed === false;
        if (isQuarantine) {
          return (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                background: "#FEF2F2",
                color: "#991B1B",
              }}
            >
              QUARANTINE
            </span>
          );
        }
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
              background: "#DCFCE7",
              color: "#166534",
            }}
          >
            CLEARED
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPetForDetails(row);
          }}
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
          <FaEye /> View Pet
        </button>
      ),
    },
  ];

  const medicalColumns: Column<any>[] = [
    {
      key: "registration_number",
      header: "Reg #",
      render: (_v, row) => <code>{row.registration_number || (row.id ? row.id.slice(0, 8) : "N/A")}</code>,
    },
    { key: "name", header: "Dog Name", render: (_v, row) => <strong>{row.name}</strong> },
    { key: "breed", header: "Breed", render: (_v, row) => row.breed || "-" },
    { key: "kennel_identifier", header: "Kennel Unit", render: (_v, row) => row.kennel_identifier || "Unassigned" },
    {
      key: "is_quarantine_passed",
      header: "Quarantine / Isolation Status",
      render: (_v, row) =>
        row.is_quarantine_passed === false ? (
          <span style={{ color: "#DC2626", fontWeight: 700 }}>In Quarantine / Isolation</span>
        ) : (
          <span style={{ color: "#16A34A", fontWeight: 600 }}>Cleared</span>
        ),
    },
    {
      key: "status",
      header: "Medical Status",
      render: (_v, row) => (
        <span
          style={{
            textTransform: "uppercase",
            fontSize: "11px",
            fontWeight: 700,
            color: "#1D4ED8",
            background: "#EFF6FF",
            padding: "2px 8px",
            borderRadius: "4px",
          }}
        >
          {row.status || "MEDICAL_HOLD"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPetForDetails(row);
          }}
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
          <FaEye /> View Pet
        </button>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={facility?.name ? `Facility Details — ${facility.name}` : "Shelter Facility Details"}
      size="xl"
    >
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
          <div className="spinner" style={{ marginBottom: "12px" }}>
            Loading facility details...
          </div>
        </div>
      ) : error ? (
        <div style={{ padding: "24px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#991B1B" }}>
          <FaExclamationTriangle style={{ marginRight: "8px" }} />
          {error}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Actions & Basic Info */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ fontSize: "13px", color: "#64748B" }}>
              Facility ID: <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>{facility?.id}</code> &bull; Type: <strong style={{ textTransform: "capitalize" }}>{facility?.facility_type || "shelter"}</strong> &bull; Status: <strong style={{ textTransform: "capitalize", color: facility?.status === "active" ? "#166534" : "#991B1B" }}>{facility?.status || "active"}</strong>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {onEditFacility && (
                <button
                  type="button"
                  onClick={() => onEditFacility(facility)}
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
                  <FaEdit style={{ color: "#2563EB" }} /> Edit Facility
                </button>
              )}
              {onAddSection && (
                <button
                  type="button"
                  onClick={() => onAddSection(facility)}
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
                  <FaLayerGroup style={{ color: "#0D9488" }} /> Add Section
                </button>
              )}
              {onAddKennel && (
                <button
                  type="button"
                  onClick={() => onAddKennel(facility)}
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
                  <FaBed style={{ color: "#7C3AED" }} /> Add Kennel Unit
                </button>
              )}
              {onAssignAnimal && (
                <button
                  type="button"
                  onClick={() => onAssignAnimal(facility)}
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
                  <FaPaw style={{ color: "#EA580C" }} /> Assign Animal
                </button>
              )}
            </div>
          </div>

          {/* Facility Capacity & Physical Kennel Summary Bar */}
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
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Facility Capacity</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>{declaredCap || "Unspecified"}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Overall Building Max</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Animals Housed</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#1E3A8A" }}>{animalsHousedCount}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>In Facility Care</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Sections / Wards</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#0D9488" }}>{configuredSectionsCount}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Configured Wards</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Configured Kennels</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#7C3AED" }}>{configuredKennelsCount}</div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Physical Units</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Available Kennels</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: availableKennelsCount > 0 ? "#16A34A" : "#64748B" }}>
                {availableKennelsCount}
              </div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>{occupiedKennelsCount} Occupied</div>
            </div>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748B", fontWeight: 600 }}>Facility Occupancy</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: occupancyPct > 90 ? "#DC2626" : "#0F172A" }}>
                {occupancyPct}%
              </div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>Of Facility Capacity</div>
            </div>
          </div>

          {/* Tabs Navigation Header */}
          <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", paddingBottom: "8px", overflowX: "auto" }}>
            {[
              { id: "kennels", label: `Sections & Kennels (${configuredKennelsCount})`, icon: <FaBed /> },
              { id: "info", label: "Overview & Contact", icon: <FaBuilding /> },
              { id: "animals", label: `Current Animals (${animalsHousedCount})`, icon: <FaPaw /> },
              { id: "medical", label: `Medical & Quarantine (${medicalQuarantineAnimals.length})`, icon: <FaUserMd /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: activeTab === tab.id ? "#1E3A8A" : "#F1F5F9",
                  color: activeTab === tab.id ? "#FFFFFF" : "#475569",
                  transition: "all 0.2s",
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Sections & Kennels (Primary View) */}
          {activeTab === "kennels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Informative Guidance Banner if Sections or Kennels are not yet configured */}
              {sections.length === 0 && (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <FaLayerGroup style={{ color: "#D97706", fontSize: "16px", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ fontSize: "13px", color: "#92400E", lineHeight: 1.4 }}>
                      <strong>No physical sections or wards configured yet.</strong>
                      <div style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>
                        This facility has an overall capacity of {declaredCap || "unspecified"}, but no physical sections (e.g. Quarantine, General, Recovery) have been registered. Click <strong>Add Section</strong> to configure wards and kennel units.
                      </div>
                    </div>
                  </div>
                  {onAddSection && (
                    <button
                      type="button"
                      onClick={() => onAddSection(facility)}
                      style={{
                        padding: "6px 12px",
                        background: "#0D9488",
                        color: "#FFF",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaLayerGroup /> Add Section
                    </button>
                  )}
                </div>
              )}

              {sections.length > 0 && kennels.length === 0 && (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <FaBed style={{ color: "#2563EB", fontSize: "16px", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ fontSize: "13px", color: "#1E40AF", lineHeight: 1.4 }}>
                      <strong>No physical kennel units configured yet.</strong>
                      <div style={{ fontSize: "12px", color: "#1D4ED8", marginTop: "2px" }}>
                        Sections are set up, but no individual kennel units have been registered. Click <strong>Add Kennel Unit</strong> to register units for dog allocation.
                      </div>
                    </div>
                  </div>
                  {onAddKennel && (
                    <button
                      type="button"
                      onClick={() => onAddKennel(facility)}
                      style={{
                        padding: "6px 12px",
                        background: "#7C3AED",
                        color: "#FFF",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaBed /> Add Kennel Unit
                    </button>
                  )}
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Facility Sections & Wards ({sections.length})
                  </h4>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Click any row to open Section Details and view its kennels.
                  </div>
                </div>
                <DataTable
                  columns={sectionColumns}
                  data={sections}
                  loading={loading}
                  onRowClick={(row) => setSelectedSectionForDetails(row)}
                  emptyMessage="No sections configured for this facility."
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Registered Kennel Units ({kennels.length})
                  </h4>
                  <div style={{ fontSize: "12px", color: "#64748B" }}>
                    Click any unit to open Kennel Details and sanitation records.
                  </div>
                </div>
                <DataTable
                  columns={kennelColumns}
                  data={kennels}
                  loading={loading}
                  onRowClick={(row) => setSelectedKennelForDetails(row)}
                  emptyMessage="No kennels configured for this facility."
                />
              </div>
            </div>
          )}

          {/* Tab 2: Overview & Contact */}
          {activeTab === "info" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "12px" }}>
                  <FaBuilding style={{ marginRight: "6px", color: "#1E3A8A" }} /> Facility Overview
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div><strong>Facility Name:</strong> {facility?.name || "Unspecified"}</div>
                  <div><strong>Shelter ID:</strong> <code style={{ background: "#E2E8F0", padding: "2px 6px", borderRadius: "4px" }}>{facility?.id}</code></div>
                  <div><strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{facility?.facility_type || "shelter"}</span></div>
                  <div>
                    <strong>Operational Status:</strong>{" "}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: facility?.status === "active" ? "#DCFCE7" : "#FEE2E2",
                        color: facility?.status === "active" ? "#166534" : "#991B1B",
                      }}
                    >
                      {(facility?.status || "active").toUpperCase()}
                    </span>
                  </div>
                  <div><strong>Created Date:</strong> {facility?.created_at ? new Date(facility.created_at).toLocaleDateString() : "N/A"}</div>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "12px" }}>
                  <FaMapMarkerAlt style={{ marginRight: "6px", color: "#DC2626" }} /> Contact & Location Details
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                  <div><FaMapMarkerAlt style={{ color: "#94A3B8", marginRight: "4px" }} /> <strong>Address:</strong> {facility?.address || "Address not specified"}</div>
                  <div><FaPhoneAlt style={{ color: "#94A3B8", marginRight: "4px" }} /> <strong>Contact Phone:</strong> {facility?.phone || "Phone not provided"}</div>
                  <div>
                    <strong>GPS Coordinates:</strong>{" "}
                    {facility?.latitude && facility?.longitude ? `${facility.latitude}, ${facility.longitude}` : "Coordinates unconfigured"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Current Animals (Strict Facility Scope) */}
          {activeTab === "animals" && (
            <div>
              <DataTable
                columns={animalColumns}
                data={animals}
                loading={loading}
                onRowClick={(row) => setSelectedPetForDetails(row)}
                emptyMessage="No dogs are currently housed in this facility."
              />
            </div>
          )}

          {/* Tab 4: Medical & Quarantine (Strict Facility Scope) */}
          {activeTab === "medical" && (
            <div>
              <DataTable
                columns={medicalColumns}
                data={medicalQuarantineAnimals}
                loading={loading}
                onRowClick={(row) => setSelectedPetForDetails(row)}
                emptyMessage="No critical, medical, or quarantine cases in this facility."
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ShelterDetailsModal;
