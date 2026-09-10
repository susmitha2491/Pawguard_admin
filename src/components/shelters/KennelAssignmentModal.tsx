import React, { useState, useEffect, useMemo } from "react";
import Modal from "../common/Modal";
import Select, { type SelectOption } from "../common/Select";
import shelterService from "../../services/shelterService";
import petService from "../../services/petService";
import { useToast } from "../../context/ToastContext";
import {
  FaShieldAlt,
} from "react-icons/fa";

interface KennelAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFacilityId?: string;
  preselectedKennelId?: string;
  preselectedDogId?: string;
  onSuccess: () => void;
}

const unwrapList = (v: any) =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

export const KennelAssignmentModal: React.FC<KennelAssignmentModalProps> = ({
  isOpen,
  onClose,
  preselectedFacilityId = "",
  preselectedKennelId = "",
  preselectedDogId = "",
  onSuccess,
}) => {
  const { addToast } = useToast();

  const [facilities, setFacilities] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [kennels, setKennels] = useState<any[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);

  const [selectedFacilityId, setSelectedFacilityId] = useState(preselectedFacilityId);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedKennelId, setSelectedKennelId] = useState(preselectedKennelId);
  const [selectedDogId, setSelectedDogId] = useState(preselectedDogId);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [facRes, dogRes] = await Promise.all([
          shelterService.getShelters({ page: 1, page_size: 20 }),
          petService.getPets({ page: 1, page_size: 20 }),
        ]);

        const facList = unwrapList(facRes);
        setFacilities(facList);

        const dogList = unwrapList(dogRes);
        setDogs(dogList);

        if (preselectedFacilityId) {
          const secRes = await shelterService.getFacilitySections(preselectedFacilityId);
          setSections(unwrapList(secRes));
        }
      } catch {
        addToast("Failed to load facilities or animals for assignment.", "error");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isOpen, preselectedFacilityId]);

  const handleFacilityChange = async (facId: string) => {
    setSelectedFacilityId(facId);
    setSelectedSectionId("");
    setSelectedKennelId("");
    setSections([]);
    setKennels([]);
    if (!facId) return;

    try {
      const secRes = await shelterService.getFacilitySections(facId);
      setSections(unwrapList(secRes));
    } catch {
      setSections([]);
    }
  };

  const handleSectionChange = async (secId: string) => {
    setSelectedSectionId(secId);
    setSelectedKennelId("");
    setKennels([]);
    if (!secId) return;

    try {
      const kRes = await shelterService.getSectionKennels(secId);
      setKennels(unwrapList(kRes));
    } catch {
      setKennels([]);
    }
  };

  const selectedDog = dogs.find((d) => (d.id || d.dog_id) === selectedDogId);
  const selectedKennel = kennels.find((k) => k.id === selectedKennelId);

  // Quarantine & Eligibility Info
  const isDogInQuarantine = selectedDog && selectedDog.is_quarantine_passed === false;
  const isKennelFull = selectedKennel?.is_occupied;

  // Conditional validation: require animal and kennel selection, ensuring kennel is available
  const isFormValid = Boolean(selectedKennelId && selectedDogId && !isKennelFull);

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKennelId || !selectedDogId) {
      addToast("Please select both an animal and an available kennel.", "error");
      return;
    }
    if (isKennelFull) {
      addToast("Selected kennel is currently occupied. Please choose an available unit.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await shelterService.assignDogToKennel(selectedKennelId, selectedDogId);
      addToast(
        `Animal ${selectedDog?.name || selectedDogId} assigned to Kennel ${selectedKennel?.identifier || selectedKennelId}!`,
        "success"
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to assign animal to kennel.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const dogOptions: SelectOption[] = useMemo(() => {
    return dogs.map((d) => {
      const dId = String(d.id || d.dog_id || "");
      const isQuarantine = !d.is_quarantine_passed;
      return {
        value: dId,
        label: `${d.name || "Dog"} (${d.registration_number || dId.slice(0, 8)})`,
        sublabel: `Breed: ${d.breed || "Indie"} • ${isQuarantine ? "Quarantine Required" : "Cleared"}`,
        badge: {
          text: isQuarantine ? "Quarantine" : "Cleared",
          bg: isQuarantine ? "#FEF3C7" : "#ECFDF5",
          color: isQuarantine ? "#92400E" : "#059669",
        },
      };
    });
  }, [dogs]);

  const facilityOptions: SelectOption[] = useMemo(() => {
    return facilities.map((f) => ({
      value: String(f.id),
      label: String(f.name || f.id),
      sublabel: `Type: ${f.facility_type || "Shelter"} • Capacity: ${f.capacity || "—"}`,
    }));
  }, [facilities]);

  const sectionOptions: SelectOption[] = useMemo(() => {
    return sections.map((s) => ({
      value: String(s.id),
      label: String(s.name || s.id),
      sublabel: `Section Type: ${s.section_type || "General"}`,
    }));
  }, [sections]);

  const kennelOptions: SelectOption[] = useMemo(() => {
    return kennels.map((k) => {
      const isOcc = Boolean(k.is_occupied);
      return {
        value: String(k.id),
        label: `Unit ${k.identifier || k.id} (Cap: ${k.capacity ?? 1})`,
        sublabel: `Sanitation: ${(k.sanitation_state || "clean").toUpperCase()} • ${isOcc ? "Occupied" : "Available"}`,
        disabled: isOcc,
        badge: {
          text: isOcc ? "Occupied" : "Available",
          bg: isOcc ? "#FEF2F2" : "#ECFDF5",
          color: isOcc ? "#DC2626" : "#059669",
        },
      };
    });
  }, [kennels]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kennel Unit Assignment Workflow" size="lg">
      {loading ? (
        <div style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
          Loading facilities and animal records...
        </div>
      ) : (
        <form onSubmit={handleSubmitAssignment} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Step 1: Select Animal */}
          <div>
            <Select
              label="1. Select Animal / Dog"
              required
              placeholder="Search or select animal..."
              options={dogOptions}
              value={selectedDogId}
              onChange={(val) => setSelectedDogId(String(val))}
              searchable={true}
            />
          </div>

          {/* Quarantine Advisory */}
          {selectedDog && isDogInQuarantine && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", padding: "10px 12px", borderRadius: "6px", fontSize: "12px", color: "#92400E", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaShieldAlt style={{ fontSize: "15px", color: "#D97706" }} />
              <div>
                <strong>Quarantine Advisory:</strong> This animal has not completed medical quarantine. Placement in a <strong>Quarantine</strong> or <strong>Isolation</strong> section is recommended.
              </div>
            </div>
          )}

          {/* Step 2: Select Shelter Facility & Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <Select
                label="2. Shelter Facility"
                required
                placeholder="Choose Facility..."
                options={facilityOptions}
                value={selectedFacilityId}
                onChange={(val) => handleFacilityChange(String(val))}
                searchable={facilityOptions.length >= 5}
              />
            </div>

            <div>
              <Select
                label="3. Facility Section"
                required
                placeholder={!selectedFacilityId ? "Select Facility first..." : "Choose Section..."}
                disabled={!selectedFacilityId || sections.length === 0}
                options={sectionOptions}
                value={selectedSectionId}
                onChange={(val) => handleSectionChange(String(val))}
                searchable={sectionOptions.length >= 5}
              />
            </div>
          </div>

          {/* Step 3: Select Kennel Unit */}
          <div>
            <Select
              label="4. Target Kennel Unit"
              required
              placeholder={!selectedSectionId ? "Select Section first..." : "Choose Kennel Unit..."}
              disabled={!selectedSectionId || kennels.length === 0}
              options={kennelOptions}
              value={selectedKennelId}
              onChange={(val) => setSelectedKennelId(String(val))}
              searchable={kennelOptions.length >= 5}
            />
          </div>

          {/* Selected Kennel Details Card */}
          {selectedKennel && (
            <div style={{ background: selectedKennel.is_occupied ? "#FEF2F2" : "#F0FDF4", padding: "12px", borderRadius: "6px", border: `1px solid ${selectedKennel.is_occupied ? "#FCA5A5" : "#86EFAC"}`, fontSize: "12px" }}>
              <div style={{ fontWeight: 700, color: selectedKennel.is_occupied ? "#991B1B" : "#166534" }}>
                Kennel Unit {selectedKennel.identifier} Status:
              </div>
              <div>Sanitation State: <strong>{(selectedKennel.sanitation_state || "clean").toUpperCase()}</strong></div>
              <div>Availability: <strong>{selectedKennel.is_occupied ? "Occupied / Full" : "Available for immediate placement"}</strong></div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              style={{
                padding: "8px 16px",
                background: isFormValid ? "#2563EB" : "#94A3B8",
                color: "#FFF",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: isFormValid ? "pointer" : "not-allowed",
              }}
            >
              {isSubmitting ? "Confirming Assignment..." : "Confirm Kennel Assignment"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default KennelAssignmentModal;
