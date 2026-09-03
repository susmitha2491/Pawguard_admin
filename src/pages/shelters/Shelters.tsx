import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaHome,
  FaBed,
  FaPlus,
  FaEdit,
  FaTrash,
  FaLayerGroup,
  FaPaw,
  FaEye,
  FaBroom,
} from "react-icons/fa";
import shelterService from "../../services/shelterService";
import ShelterDetailsModal from "../../components/shelters/ShelterDetailsModal";
import KennelDetailsModal from "../../components/shelters/KennelDetailsModal";
import KennelAssignmentModal from "../../components/shelters/KennelAssignmentModal";
import { notifyDataChanged } from "../../utils/dataSync";
import { getCurrentUser, normalizeRole, getRescueCentreId } from "../../utils/roleUtils";

const FACILITY_TYPES = ["shelter", "clinic", "foster_home", "partner"];
const FACILITY_STATUSES = ["active", "inactive", "maintenance"];
const SECTION_TYPES = ["quarantine", "isolation", "surgical", "puppy", "general", "adoption"];

const emptyRegisterForm = {
  name: "",
  address: "",
  phone: "",
  facility_type: "shelter",
  total_capacity: "",
};

const emptySectionForm = {
  facility_id: "",
  name: "",
  section_type: "general",
  capacity: "",
};

const emptyKennelForm = {
  section_id: "",
  identifier: "",
  capacity: "1",
};

const unwrapList = (v: any) =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : [];

interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

const RowActionMenu: React.FC<{ actions: RowActionItem[] }> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Actions Menu"
        style={{
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid #CBD5E1",
          background: isOpen ? "#F1F5F9" : "#FFFFFF",
          color: "#475569",
          fontSize: "15px",
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        ⋮
      </button>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            padding: "4px 0",
            minWidth: "160px",
            zIndex: 100,
          }}
        >
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setIsOpen(false);
                act.onClick();
              }}
              style={{
                width: "100%",
                padding: "8px 14px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                fontSize: "13px",
                fontWeight: 500,
                color: act.danger ? "#DC2626" : "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {act.icon}
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Shelters = () => {
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser);
  const userRescueCentreId = getRescueCentreId(currentUser);
  const userShelterId = (currentUser as any)?.shelter_id || (currentUser as any)?.shelter?.id || (currentUser as any)?.assigned_shelter_id;

  const canManageKennels = currentRole === "super_admin" || currentRole === "shelter_manager";

  const [activeTab, setActiveTab] = useState<"facilities" | "kennels">("facilities");
  const [shelters, setShelters] = useState<any[]>([]);
  const [allShelters, setAllShelters] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination for Facilities
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Filters for Kennels Tab
  const [kennelSearch, setKennelSearch] = useState("");
  const [kennelFacilityFilter, setKennelFacilityFilter] = useState("");
  const [kennelSanitationFilter, setKennelSanitationFilter] = useState("");
  const [kennelSectionTypeFilter, setKennelSectionTypeFilter] = useState("");
  const [kennelOccupancyFilter, setKennelOccupancyFilter] = useState("");

  // Kennels Data State
  const [allSections, setAllSections] = useState<any[]>([]);
  const [allKennels, setAllKennels] = useState<any[]>([]);
  const [kennelsLoading, setKennelsLoading] = useState(false);

  // Dashboard Aggregates State
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);

  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(() => searchParams.get("action") === "add");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isKennelCreateModalOpen, setIsKennelCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [preselectedKennelForAssign, setPreselectedKennelForAssign] = useState<any | null>(null);

  // Details View Modals
  const [viewShelterId, setViewShelterId] = useState<string | null>(null);
  const [isShelterDetailsOpen, setIsShelterDetailsOpen] = useState(false);
  const [selectedKennelForDetails, setSelectedKennelForDetails] = useState<any | null>(null);
  const [isKennelDetailsOpen, setIsKennelDetailsOpen] = useState(false);

  // Form states
  const [selectedFacility, setSelectedFacility] = useState<any | null>(null);
  const [registerForm, setRegisterForm] = useState({ ...emptyRegisterForm });
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    phone: "",
    facility_type: "shelter",
    total_capacity: "",
    status: "active",
  });
  const [sectionForm, setSectionForm] = useState({ ...emptySectionForm });
  const [kennelForm, setKennelForm] = useState({ ...emptyKennelForm });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search Debounce handler (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Facilities
  const fetchShelters = async () => {
    try {
      setLoading(true);
      setError(null);

      if (currentRole === "rescue_centre_admin" && !userRescueCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator.");
        setShelters([]);
        setLoading(false);
        return;
      }

      const queryParams: Record<string, any> = {
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        facility_type: typeFilter || undefined,
        page,
        page_size: pageSize,
      };

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        queryParams.rescue_centre_id = userRescueCentreId;
      } else if (currentRole === "shelter_manager" && userShelterId) {
        queryParams.shelter_id = userShelterId;
      }

      const response = await shelterService.getShelters(queryParams);
      let facilityList = unwrapList(response);

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        facilityList = facilityList.filter((f: any) => {
          const fCentreId = f.rescue_centre_id || f.rescue_center_id || f.organization_id || f.facility_id;
          return !fCentreId || String(fCentreId) === String(userRescueCentreId);
        });
      } else if (currentRole === "shelter_manager" && userShelterId) {
        facilityList = facilityList.filter((f: any) => {
          const fShelterId = f.id || f.shelter_id || f.facility_id;
          return !fShelterId || String(fShelterId).toLowerCase() === String(userShelterId).toLowerCase();
        });
      }

      const total = response?.meta?.total ?? response?.data?.meta?.total ?? facilityList.length;
      setTotalCount(total);
      setShelters(facilityList);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to load shelter facilities from backend API."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch All Facilities for dropdowns & aggregates
  const fetchAllShelters = async () => {
    try {
      const queryParams: Record<string, any> = { page: 1, page_size: 50 };
      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        queryParams.rescue_centre_id = userRescueCentreId;
      } else if (currentRole === "shelter_manager" && userShelterId) {
        queryParams.shelter_id = userShelterId;
      }

      const response = await shelterService.getShelters(queryParams);
      let facs = unwrapList(response);
      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        facs = facs.filter((f: any) => {
          const fCentreId = f.rescue_centre_id || f.rescue_center_id || f.organization_id || f.facility_id;
          return !fCentreId || String(fCentreId) === String(userRescueCentreId);
        });
      }
      setAllShelters(facs);
    } catch {
      setAllShelters([]);
    }
  };

  // Fetch Dashboard aggregate stats
  const fetchDashboardStats = async () => {
    try {
      const stats = await shelterService.getShelterDashboard().catch(() => null);
      if (stats) {
        setDashboardStats(stats?.data || stats);
      }
    } catch {
      // quiet fallback
    }
  };

  // Fetch all Kennels across facilities for Kennels Tab
  const fetchAllKennelsWorkspace = async () => {
    setKennelsLoading(true);
    try {
      const queryParams: Record<string, any> = { page: 1, page_size: 50 };
      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        queryParams.rescue_centre_id = userRescueCentreId;
      } else if (currentRole === "shelter_manager" && userShelterId) {
        queryParams.shelter_id = userShelterId;
      }
      const facsRes = await shelterService.getShelters(queryParams);
      let facList = unwrapList(facsRes);

      if (currentRole === "rescue_centre_admin" && userRescueCentreId) {
        facList = facList.filter((f: any) => {
          const fCentreId = f.rescue_centre_id || f.rescue_center_id || f.organization_id || f.facility_id;
          return !fCentreId || String(fCentreId) === String(userRescueCentreId);
        });
      } else if (currentRole === "shelter_manager" && userShelterId) {
        facList = facList.filter((f: any) => {
          const fShelterId = f.id || f.shelter_id || f.facility_id;
          return !fShelterId || String(fShelterId).toLowerCase() === String(userShelterId).toLowerCase();
        });
      }

      const fetchedSections: any[] = [];
      let fetchedKennels: any[] = [];

      for (const fac of facList) {
        try {
          const secRes = await shelterService.getFacilitySections(fac.id);
          const secList = unwrapList(secRes);

          for (const sec of secList) {
            fetchedSections.push({ ...sec, facility_name: fac.name, facility_id: fac.id });
            try {
              const kRes = await shelterService.getSectionKennels(sec.id);
              const kList = unwrapList(kRes).map((k: any) => ({
                ...k,
                facility_id: fac.id,
                facility_name: fac.name,
                section_name: sec.name,
                section_type: sec.section_type,
              }));
              fetchedKennels = [...fetchedKennels, ...kList];
            } catch {
              // ignore single section error
            }
          }
        } catch {
          // ignore single facility error
        }
      }

      setAllSections(fetchedSections);
      setAllKennels(fetchedKennels);
    } catch {
      // quiet catch
    } finally {
      setKennelsLoading(false);
    }
  };

  useEffect(() => {
    fetchShelters();
  }, [debouncedSearch, statusFilter, typeFilter, page, pageSize]);

  useEffect(() => {
    fetchAllShelters();
    fetchDashboardStats();
    fetchAllKennelsWorkspace();
  }, []);

  useEffect(() => {
    if (activeTab === "kennels") {
      fetchAllKennelsWorkspace();
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setIsRegisterModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (searchParams.get("action") === "allocate") {
      setIsAssignModalOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // Handler for Registering Facility
  const handleRegisterFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name) {
      addToast("Facility name is required", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await shelterService.createShelter({
        name: registerForm.name,
        address: registerForm.address ? registerForm.address.trim() : "Unspecified",
        phone: registerForm.phone ? registerForm.phone.trim() : "N/A",
        facility_type: registerForm.facility_type as any,
        total_capacity: registerForm.total_capacity ? Number(registerForm.total_capacity) : undefined,
      });
      addToast(`Facility "${registerForm.name}" registered successfully!`, "success");
      setIsRegisterModalOpen(false);
      setRegisterForm({ ...emptyRegisterForm });
      fetchShelters();
      fetchAllShelters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to register facility.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Editing Facility
  const handleEditFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    const facilityId = selectedFacility?.id;
    if (!facilityId) {
      addToast("Could not determine facility to update.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await shelterService.updateFacility(facilityId, {
        name: editForm.name,
        address: editForm.address,
        phone: editForm.phone,
        facility_type: editForm.facility_type as any,
        total_capacity: editForm.total_capacity ? Number(editForm.total_capacity) : undefined,
        status: editForm.status as any,
      });
      addToast(`Facility "${editForm.name}" updated successfully!`, "success");
      setIsEditModalOpen(false);
      fetchShelters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update facility.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Deleting Facility
  const handleDeleteFacility = async () => {
    if (!selectedFacility?.id) return;
    try {
      setIsSubmitting(true);
      await shelterService.deleteFacility(selectedFacility.id);
      addToast(`Facility "${selectedFacility.name}" deleted.`, "success");
      setIsDeleteModalOpen(false);
      fetchShelters();
      fetchAllShelters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to delete facility.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Creating Section
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.facility_id || !sectionForm.name) {
      addToast("Facility and Section Name are required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await shelterService.createFacilitySection(sectionForm.facility_id, {
        name: sectionForm.name,
        section_type: sectionForm.section_type as any,
        capacity: sectionForm.capacity ? Number(sectionForm.capacity) : undefined,
      });
      addToast(`Section "${sectionForm.name}" created successfully!`, "success");
      setIsSectionModalOpen(false);
      setSectionForm({ ...emptySectionForm });
      fetchAllKennelsWorkspace();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to create section.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Creating Kennel
  const handleCreateKennel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kennelForm.section_id || !kennelForm.identifier) {
      addToast("Section and Kennel Identifier are required.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      await shelterService.createSectionKennel(kennelForm.section_id, {
        identifier: kennelForm.identifier,
        capacity: kennelForm.capacity ? Number(kennelForm.capacity) : 1,
      });
      addToast(`Kennel Unit "${kennelForm.identifier}" created successfully!`, "success");
      setIsKennelCreateModalOpen(false);
      setKennelForm({ ...emptyKennelForm });
      fetchAllKennelsWorkspace();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to create kennel unit.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Quick Sanitation
  const handleQuickSanitizeRow = async (kennelId: string, identifier: string) => {
    try {
      await shelterService.updateKennelSanitation(kennelId);
      addToast(`Kennel "${identifier}" marked as CLEAN.`, "success");
      fetchAllKennelsWorkspace();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update sanitation state.";
      addToast(msg, "error");
    }
  };

  // Aggregate Calculation for Summary KPIs from REAL Backend Data
  const computedStats = useMemo(() => {
    const totalShelters = allShelters.length || totalCount;
    const activeShelters = allShelters.filter((s) => s.status === "active").length;
    const totalCapacity = allShelters.reduce((acc, s) => acc + (Number(s.total_capacity) || 0), 0);
    const occupiedKennelsCount = allKennels.filter((k) => k.is_occupied).length;
    const totalKennelsCount = allKennels.length;
    const availableKennelsCount = Math.max(0, totalKennelsCount - occupiedKennelsCount);

    // Occupancy Rate calculated strictly from real data
    const effectiveCapacity = totalCapacity || totalKennelsCount;
    const occupancyPct = effectiveCapacity > 0
      ? Math.min(100, Math.round(((dashboardStats?.occupied_spaces ?? occupiedKennelsCount) / effectiveCapacity) * 100))
      : 0;

    return {
      totalShelters,
      activeShelters,
      totalCapacity: dashboardStats?.total_capacity ?? totalCapacity,
      occupiedCount: dashboardStats?.occupied_spaces ?? occupiedKennelsCount,
      availableCount: dashboardStats?.available_spaces ?? availableKennelsCount,
      occupancyPct,
    };
  }, [allShelters, totalCount, allKennels, dashboardStats]);

  // Filtered Kennels list for Kennels tab
  const filteredKennels = useMemo(() => {
    return allKennels.filter((k) => {
      const matchesSearch =
        !kennelSearch ||
        k.identifier.toLowerCase().includes(kennelSearch.toLowerCase()) ||
        k.section_name?.toLowerCase().includes(kennelSearch.toLowerCase()) ||
        k.facility_name?.toLowerCase().includes(kennelSearch.toLowerCase());
      const matchesFacility = !kennelFacilityFilter || k.facility_id === kennelFacilityFilter;
      const matchesSanitation = !kennelSanitationFilter || k.sanitation_state === kennelSanitationFilter;
      const matchesSectionType = !kennelSectionTypeFilter || k.section_type === kennelSectionTypeFilter;
      const matchesOccupancy =
        !kennelOccupancyFilter ||
        (kennelOccupancyFilter === "occupied" ? k.is_occupied : !k.is_occupied);

      return matchesSearch && matchesFacility && matchesSanitation && matchesSectionType && matchesOccupancy;
    });
  }, [allKennels, kennelSearch, kennelFacilityFilter, kennelSanitationFilter, kennelSectionTypeFilter, kennelOccupancyFilter]);

  const facilityColumns: Column<any>[] = [
    {
      key: "name",
      header: "Facility Name",
      render: (_v, row) => (
        <div>
          <strong style={{ fontSize: "14px", color: "#0F172A" }}>{row.name}</strong>
          {row.id && (
            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
              ID: <code style={{ background: "#F1F5F9", padding: "1px 5px", borderRadius: "3px" }}>{row.id}</code>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "facility_type",
      header: "Type",
      render: (_v, row) => (
        <span style={{ textTransform: "capitalize", background: "#F1F5F9", color: "#334155", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, border: "1px solid #E2E8F0" }}>
          {row.facility_type || "shelter"}
        </span>
      ),
    },
    { key: "address", header: "Location / Address", render: (_v, row) => row.address || "Unspecified" },
    { key: "phone", header: "Contact Phone", render: (_v, row) => row.phone || "—" },
    { key: "total_capacity", header: "Capacity", render: (_v, row) => <span style={{ fontWeight: 600, color: "#0F172A" }}>{row.total_capacity ?? "Unspecified"}</span> },
    {
      key: "status",
      header: "Status",
      render: (_v, row) => {
        const st = (row.status || "active").toLowerCase();
        const isAct = st === "active";
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 600,
              background: isAct ? "#F0FDF4" : "#FEF2F2",
              color: isAct ? "#166534" : "#991B1B",
              border: `1px solid ${isAct ? "#DCFCE7" : "#FCA5A5"}`,
            }}
          >
            {st.toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (_v, row) => {
        const actions: RowActionItem[] = [
          {
            label: "View Details",
            icon: <FaEye style={{ color: "#2563EB" }} />,
            onClick: () => {
              setViewShelterId(row.id);
              setIsShelterDetailsOpen(true);
            },
          },
          {
            label: "Edit Facility",
            icon: <FaEdit style={{ color: "#475569" }} />,
            onClick: () => {
              setSelectedFacility(row);
              setEditForm({
                name: row.name || "",
                address: row.address || "",
                phone: row.phone || "",
                facility_type: row.facility_type || "shelter",
                total_capacity: row.total_capacity !== undefined ? String(row.total_capacity) : "",
                status: row.status || "active",
              });
              setIsEditModalOpen(true);
            },
          },
          {
            label: "Delete Facility",
            icon: <FaTrash />,
            danger: true,
            onClick: () => {
              setSelectedFacility(row);
              setIsDeleteModalOpen(true);
            },
          },
        ];
        return <RowActionMenu actions={actions} />;
      },
    },
  ];

  const kennelWorkspaceColumns: Column<any>[] = [
    {
      key: "identifier",
      header: "Kennel Unit",
      render: (_v, row) => (
        <div>
          <strong style={{ fontSize: "14px", color: "#0F172A" }}>{row.identifier}</strong>
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            Section: <strong>{row.section_name || "General"}</strong> • {row.facility_name || "Facility"}
          </div>
        </div>
      ),
    },
    {
      key: "section_type",
      header: "Section Category",
      render: (_v, row) => (
        <span style={{ textTransform: "capitalize", background: "#F8FAFC", color: "#334155", border: "1px solid #E2E8F0", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
          {row.section_type || "general"}
        </span>
      ),
    },
    { key: "capacity", header: "Capacity", render: (_v, row) => <span style={{ fontWeight: 600 }}>{row.capacity ?? 1}</span> },
    {
      key: "sanitation_state",
      header: "Sanitation",
      render: (_v, row) => {
        const st = row.sanitation_state || "clean";
        const isClean = st === "clean";
        return (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 600,
              background: isClean ? "#F0FDF4" : "#FEF3C7",
              color: isClean ? "#166534" : "#92400E",
              border: `1px solid ${isClean ? "#DCFCE7" : "#FDE68A"}`,
            }}
          >
            {st.toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "is_occupied",
      header: "Occupancy Status",
      render: (_v, row) =>
        row.is_occupied ? (
          <span style={{ color: "#DC2626", fontWeight: 600, fontSize: "12px" }}>Occupied</span>
        ) : (
          <span style={{ color: "#16A34A", fontWeight: 600, fontSize: "12px" }}>Available</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_v, row) => {
        const actions: RowActionItem[] = [
          {
            label: "View Unit Details",
            icon: <FaEye style={{ color: "#2563EB" }} />,
            onClick: () => {
              setSelectedKennelForDetails(row);
              setIsKennelDetailsOpen(true);
            },
          },
        ];

        if (canManageKennels && !row.is_occupied) {
          actions.push({
            label: "Assign Animal",
            icon: <FaPaw style={{ color: "#EA580C" }} />,
            onClick: () => {
              setPreselectedKennelForAssign(row);
              setIsAssignModalOpen(true);
            },
          });
        }

        if (canManageKennels && row.sanitation_state !== "clean") {
          actions.push({
            label: "Mark Clean",
            icon: <FaBroom style={{ color: "#16A34A" }} />,
            onClick: () => handleQuickSanitizeRow(row.id, row.identifier),
          });
        }

        return <RowActionMenu actions={actions} />;
      },
    },
  ];

  return (
    <div className="shelters-page" style={{ padding: "4px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
            Shelter Facilities
          </h1>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", margin: "4px 0 0" }}>
            Physical shelter infrastructure, section architecture, kennel units, and animal placement management.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Can permission={["create_shelters", "edit_shelters", "manage_shelters"]}>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              style={{
                padding: "8px 14px",
                background: "#1E3A8A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <FaPlus /> Register Facility
            </button>
            <button
              onClick={() => {
                setSectionForm({ ...emptySectionForm, facility_id: allShelters[0]?.id || "" });
                setIsSectionModalOpen(true);
              }}
              style={{
                padding: "8px 14px",
                background: "#FFFFFF",
                color: "#334155",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaLayerGroup style={{ color: "#0D9488" }} /> Add Section
            </button>
            <button
              onClick={() => setIsKennelCreateModalOpen(true)}
              style={{
                padding: "8px 14px",
                background: "#FFFFFF",
                color: "#334155",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FaBed style={{ color: "#7C3AED" }} /> Add Kennel Unit
            </button>
            {canManageKennels && (
              <button
                onClick={() => {
                  setPreselectedKennelForAssign(null);
                  setIsAssignModalOpen(true);
                }}
                style={{
                  padding: "8px 14px",
                  background: "#FFFFFF",
                  color: "#334155",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  fontSize: "13px",
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
          </Can>
        </div>
      </div>

      {/* Summary KPI Bar — Clean Neutral Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div
          onClick={() => {
            setActiveTab("facilities");
            setStatusFilter("");
          }}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Total Facilities
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginTop: "4px" }}>
            {computedStats.totalShelters}
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("facilities");
            setStatusFilter("active");
          }}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Active Facilities
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#166534", marginTop: "4px" }}>
            {computedStats.activeShelters}
          </div>
        </div>

        <div
          onClick={() => setActiveTab("facilities")}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Total Capacity
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#0F172A", marginTop: "4px" }}>
            {computedStats.totalCapacity}
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("kennels");
            setKennelOccupancyFilter("occupied");
          }}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Occupied Kennels
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#1E3A8A", marginTop: "4px" }}>
            {computedStats.occupiedCount}
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab("kennels");
            setKennelOccupancyFilter("available");
          }}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Available Kennels
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#15803D", marginTop: "4px" }}>
            {computedStats.availableCount}
          </div>
        </div>

        <div
          onClick={() => setActiveTab("facilities")}
          style={{
            background: "#FFFFFF",
            padding: "14px 16px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Occupancy Rate
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: computedStats.occupancyPct > 85 ? "#DC2626" : "#0F172A", marginTop: "4px" }}>
            {computedStats.occupancyPct}%
          </div>
        </div>
      </div>

      {/* Main Tab Navigation — 2 Clean Enterprise Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("facilities")}
          style={{
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            borderBottom: activeTab === "facilities" ? "2px solid #2563EB" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "facilities" ? "#2563EB" : "#64748B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaHome /> Shelter Facilities ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kennels")}
          style={{
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            borderBottom: activeTab === "kennels" ? "2px solid #2563EB" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "kennels" ? "#2563EB" : "#64748B",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaBed /> Physical Kennels & Sections ({allKennels.length})
        </button>
      </div>

      {/* TAB 1: Facilities Directory */}
      {activeTab === "facilities" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {error && (
            <div style={{ padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "6px", color: "#991B1B", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <DataTable
            columns={facilityColumns}
            data={shelters}
            loading={loading}
            error={error}
            onRetry={fetchShelters}
            emptyMessage="No shelter facilities registered in the system."
            serverMode={true}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchValue={search}
            onSearchChange={(s) => {
              setSearch(s);
              setPage(1);
            }}
            searchMaxWidth="100%"
            onRowClick={(row) => {
              if (row?.id) {
                setViewShelterId(row.id);
                setIsShelterDetailsOpen(true);
              }
            }}
            leftHeaderControls={
              <>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Operational Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Facility Types</option>
                  <option value="shelter">Shelter</option>
                  <option value="clinic">Clinic</option>
                  <option value="foster_home">Foster Home</option>
                  <option value="partner">Partner</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </>
            }
          />
        </div>
      )}

      {/* TAB 2: Physical Kennels Workspace */}
      {activeTab === "kennels" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <DataTable
            columns={kennelWorkspaceColumns}
            data={filteredKennels}
            loading={kennelsLoading}
            emptyMessage="No physical kennel units found matching current criteria."
            searchValue={kennelSearch}
            onSearchChange={(s) => setKennelSearch(s)}
            onRowClick={(row) => {
              setSelectedKennelForDetails(row);
              setIsKennelDetailsOpen(true);
            }}
            leftHeaderControls={
              <>
                <select
                  value={kennelFacilityFilter}
                  onChange={(e) => setKennelFacilityFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Facilities</option>
                  {allShelters.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

                <select
                  value={kennelSanitationFilter}
                  onChange={(e) => setKennelSanitationFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Sanitation States</option>
                  <option value="clean">Clean</option>
                  <option value="needs_cleaning">Needs Cleaning</option>
                  <option value="disinfecting">Disinfecting</option>
                  <option value="out_of_service">Out of Service</option>
                </select>

                <select
                  value={kennelSectionTypeFilter}
                  onChange={(e) => setKennelSectionTypeFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Section Categories</option>
                  {SECTION_TYPES.map((st) => (
                    <option key={st} value={st}>{st.toUpperCase()}</option>
                  ))}
                </select>

                <select
                  value={kennelOccupancyFilter}
                  onChange={(e) => setKennelOccupancyFilter(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                >
                  <option value="">All Occupancy States</option>
                  <option value="available">Available Units</option>
                  <option value="occupied">Occupied Units</option>
                </select>
              </>
            }
          />
        </div>
      )}

      {/* MODAL 1: Register Shelter Facility */}
      <Modal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} title="Register New Shelter Facility">
        <form onSubmit={handleRegisterFacility} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Facility Name *</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              placeholder="e.g. Central PawGuard Haven"
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Facility Type</label>
            <select
              value={registerForm.facility_type}
              onChange={(e) => setRegisterForm({ ...registerForm, facility_type: e.target.value })}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              {FACILITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Address / Location</label>
            <input
              type="text"
              value={registerForm.address}
              onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
              placeholder="Street address, city"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Phone Contact</label>
              <input
                type="text"
                value={registerForm.phone}
                onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                placeholder="+1-555-0199"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Total Capacity</label>
              <input
                type="number"
                value={registerForm.total_capacity}
                onChange={(e) => setRegisterForm({ ...registerForm, total_capacity: e.target.value })}
                placeholder="e.g. 100"
                min={1}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Registering..." : "Register Facility"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Shelter Facility */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Facility — ${selectedFacility?.name}`}>
        <form onSubmit={handleEditFacility} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Facility Name *</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Facility Type</label>
              <select
                value={editForm.facility_type}
                onChange={(e) => setEditForm({ ...editForm, facility_type: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              >
                {FACILITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Operational Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              >
                {FACILITY_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Address</label>
            <input
              type="text"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Phone</label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Total Capacity</label>
              <input
                type="number"
                value={editForm.total_capacity}
                onChange={(e) => setEditForm({ ...editForm, total_capacity: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Delete Facility Confirmation */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Delete Facility">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", fontSize: "14px", margin: 0 }}>
            Are you sure you want to remove facility <strong>{selectedFacility?.name}</strong>?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteFacility}
              disabled={isSubmitting}
              style={{ padding: "8px 16px", background: "#DC2626", color: "#FFF", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: Create Section */}
      <Modal isOpen={isSectionModalOpen} onClose={() => setIsSectionModalOpen(false)} title="Add Section to Shelter Facility">
        <form onSubmit={handleCreateSection} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Target Facility *</label>
            <select
              value={sectionForm.facility_id}
              onChange={(e) => setSectionForm({ ...sectionForm, facility_id: e.target.value })}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              <option value="">-- Choose Facility --</option>
              {allShelters.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Section Name *</label>
            <input
              type="text"
              value={sectionForm.name}
              onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
              placeholder="e.g. North Quarantine Block A"
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Section Type</label>
              <select
                value={sectionForm.section_type}
                onChange={(e) => setSectionForm({ ...sectionForm, section_type: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              >
                {SECTION_TYPES.map((st) => (
                  <option key={st} value={st}>{st.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Section Capacity</label>
              <input
                type="number"
                value={sectionForm.capacity}
                onChange={(e) => setSectionForm({ ...sectionForm, capacity: e.target.value })}
                placeholder="e.g. 20"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsSectionModalOpen(false)}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", background: "#0D9488", color: "#FFF", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Creating..." : "Create Section"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Create Kennel Unit */}
      <Modal isOpen={isKennelCreateModalOpen} onClose={() => setIsKennelCreateModalOpen(false)} title="Add Physical Kennel Unit">
        <form onSubmit={handleCreateKennel} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Target Section *</label>
            <select
              value={kennelForm.section_id}
              onChange={(e) => setKennelForm({ ...kennelForm, section_id: e.target.value })}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
            >
              <option value="">-- Choose Section --</option>
              {allSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.facility_name} — {s.name} ({s.section_type || "general"})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Kennel Identifier *</label>
              <input
                type="text"
                value={kennelForm.identifier}
                onChange={(e) => setKennelForm({ ...kennelForm, identifier: e.target.value })}
                placeholder="e.g. K-101"
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>Capacity</label>
              <input
                type="number"
                value={kennelForm.capacity}
                onChange={(e) => setKennelForm({ ...kennelForm, capacity: e.target.value })}
                min={1}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setIsKennelCreateModalOpen(false)}
              style={{ padding: "8px 16px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: "8px 16px", background: "#7C3AED", color: "#FFF", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
            >
              {isSubmitting ? "Adding..." : "Add Kennel Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details View Modals */}
      <ShelterDetailsModal
        facilityId={viewShelterId}
        isOpen={isShelterDetailsOpen}
        onClose={() => {
          setIsShelterDetailsOpen(false);
          setViewShelterId(null);
        }}
        onEditFacility={(fac) => {
          setIsShelterDetailsOpen(false);
          setSelectedFacility(fac);
          setEditForm({
            name: fac.name || "",
            address: fac.address || "",
            phone: fac.phone || "",
            facility_type: fac.facility_type || "shelter",
            total_capacity: fac.total_capacity !== undefined ? String(fac.total_capacity) : "",
            status: fac.status || "active",
          });
          setIsEditModalOpen(true);
        }}
        onAddSection={(fac) => {
          setIsShelterDetailsOpen(false);
          setSectionForm({ ...emptySectionForm, facility_id: fac.id });
          setIsSectionModalOpen(true);
        }}
        onAddKennel={() => {
          setIsShelterDetailsOpen(false);
          setKennelForm({ ...emptyKennelForm });
          setIsKennelCreateModalOpen(true);
        }}
        onAssignAnimal={(fac) => {
          setIsShelterDetailsOpen(false);
          setPreselectedKennelForAssign({ facility_id: fac.id });
          setIsAssignModalOpen(true);
        }}
      />

      <KennelDetailsModal
        kennel={selectedKennelForDetails}
        isOpen={isKennelDetailsOpen}
        onClose={() => {
          setIsKennelDetailsOpen(false);
          setSelectedKennelForDetails(null);
        }}
        onRefresh={() => fetchAllKennelsWorkspace()}
        onOpenAssign={(kennel) => {
          setPreselectedKennelForAssign(kennel);
          setIsAssignModalOpen(true);
        }}
      />

      <KennelAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setPreselectedKennelForAssign(null);
        }}
        preselectedFacilityId={preselectedKennelForAssign?.facility_id || ""}
        preselectedKennelId={preselectedKennelForAssign?.id || ""}
        onSuccess={() => {
          fetchShelters();
          fetchAllKennelsWorkspace();
          notifyDataChanged();
        }}
      />
    </div>
  );
};

export default Shelters;
