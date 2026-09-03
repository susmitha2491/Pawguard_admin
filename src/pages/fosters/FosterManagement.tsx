import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable, { type Column } from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import QuickActionCard from "../../components/dashboard/QuickActionCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaHandHoldingHeart,
  FaHome,
  FaDog,
  FaUndo,
  FaClipboardList,
  FaUserPlus,
  FaHeart,
  FaBoxOpen,
  FaHistory,
  FaStethoscope,
} from "react-icons/fa";
import fosterService, {
  type FosterProfileUpdatePayload,
  type FosterPlacementPayload,
  type FosterProgressLogPayload,
  type FosterSupplyDispatchPayload,
} from "../../services/fosterService";
import petService from "../../services/petService";
import vetService from "../../services/vetService";
import { notifyDataChanged } from "../../utils/dataSync";
import { formatDateTime } from "../../utils/dateUtils";
import { getCurrentUserRole } from "../../utils/roleUtils";

export interface FosterProfileRow {
  id: string;
  foster_family: string;
  status: string;
  active_count: number;
  max_capacity: number;
  is_available: boolean;
  preferences?: string;
  notes?: string;
  background_check_passed?: boolean;
  home_inspection_passed?: boolean;
  created_at?: string;
  user?: any;
  raw: any;
  [key: string]: unknown;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: "14px",
};

const unwrapList = (v: any) =>
  Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : [];

const FosterManagement = () => {
  const isRescueCentreAdmin = getCurrentUserRole() === "rescue_centre_admin";
  const [activeTab, setActiveTab] = useState<"profiles" | "placements">("profiles");
  const [fosters, setFosters] = useState<FosterProfileRow[]>([]);
  const [dogs, setDogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  if (isRescueCentreAdmin) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2 style={{ color: "#DC2626", fontWeight: 800 }}>Access Restricted</h2>
        <p style={{ color: "#64748B", maxWidth: "600px", margin: "12px auto" }}>
          Foster Management is reserved for Foster Coordinators and Super Administrators. Rescue Centre Admin access is restricted to centre rescue operations, dispatch, vehicle fleet, and dog master management.
        </p>
      </div>
    );
  }
  const [searchParams] = useSearchParams();

  // Search & Pagination & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(() => searchParams.get("action") === "apply");
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(() => searchParams.get("action") === "place");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [selectedFoster, setSelectedFoster] = useState<FosterProfileRow | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<any | null>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [suppliesList, setSuppliesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const [applyForm, setApplyForm] = useState({
    preferences: "Dogs only, Medium size",
    max_capacity: 2,
    notes: "",
  });

  const [placeForm, setPlaceForm] = useState<FosterPlacementPayload>({
    dog_id: "",
    notes: "",
  });
  const [placeTargetProfileId, setPlaceTargetProfileId] = useState("");

  const [editForm, setEditForm] = useState<FosterProfileUpdatePayload & { id: string }>({
    id: "",
    status: "approved",
    is_available: true,
    max_capacity: 2,
    preferences: "",
    notes: "",
    background_check_passed: true,
    home_inspection_passed: true,
  });

  const [returnNotes, setReturnNotes] = useState("");

  const [progressForm, setProgressForm] = useState<FosterProgressLogPayload>({
    weight_kg: 15.0,
    behavior_notes: "Settled well, friendly with family",
    feeding_notes: "Normal appetite, ate full portion",
    medication_notes: "None",
    exercise_minutes: 30,
    mood_rating: 5,
    notes: "Doing great overall.",
  });

  const [supplyForm, setSupplyForm] = useState<FosterSupplyDispatchPayload>({
    item_type: "food",
    description: "20lb Bag of Canine Food",
    quantity: 1,
  });

  const fetchFosters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fosterService.getFosterProfiles();
      const list = unwrapList(response);

      const formatted: FosterProfileRow[] = list.map((item: any) => {
        const user = item.user || {};
        const name = user.full_name || user.name || user.email || item.foster_name || item.id || "Foster Parent";
        return {
          id: String(item.id || item.profile_id || ""),
          foster_family: String(name),
          status: String(item.status || (item.is_available ? "approved" : "applied")),
          active_count: Number(item.active_count ?? item.placements_count ?? 0),
          max_capacity: Number(item.max_capacity ?? 1),
          is_available: item.is_available !== undefined ? Boolean(item.is_available) : true,
          preferences: item.preferences || "",
          notes: item.notes || "",
          background_check_passed: Boolean(item.background_check_passed),
          home_inspection_passed: Boolean(item.home_inspection_passed),
          created_at: item.created_at || item.date || item.updated_at || "",
          user,
          raw: item,
        };
      });

      formatted.sort((a, b) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });

      setFosters(formatted);
      fetchPlacements(formatted);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || "Failed to load foster profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  const [activePlacements, setActivePlacements] = useState<any[]>([]);

  const fetchPlacements = useCallback(async (fosterProfiles: FosterProfileRow[]) => {
    try {
      const activeProfiles = fosterProfiles.filter((f) => Number(f.active_count || 0) > 0);
      if (activeProfiles.length === 0) {
        setActivePlacements([]);
        return;
      }
      const results = await Promise.allSettled(
        activeProfiles.map((f) => fosterService.getProfilePlacements(f.id))
      );
      const allPlacements: any[] = [];
      results.forEach((res, idx) => {
        if (res.status === "fulfilled" && res.value) {
          const list = unwrapList(res.value);
          const f = activeProfiles[idx];
          list.forEach((p: any) => {
            if (p.is_active || p.status === "active" || (!p.returned_at && p.status !== "converted_to_adopt")) {
              allPlacements.push({ ...p, foster_family: f.foster_family, profile_id: f.id });
            }
          });
        }
      });
      setActivePlacements(allPlacements);
    } catch {
      setActivePlacements([]);
    }
  }, []);

  const fetchDogs = useCallback(async () => {
    try {
      const dogsRes = await petService.getPets();
      const list = unwrapList(dogsRes);
      setDogs(
        list.map((d: any) => ({
          id: d.id || d.dog_id || "",
          name: d.name || "Dog",
          label: `${d.name || "Dog"} (${d.registration_number || String(d.id || "").slice(0, 8)})`,
        }))
      );
    } catch {
      setDogs([]);
    }
  }, []);

  useEffect(() => {
    fetchFosters();
    fetchDogs();
  }, [fetchFosters, fetchDogs]);

  useEffect(() => {
    if (searchParams.get("action")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // Derived metrics
  const totalActiveHomes = fosters.filter((f) => f.is_available || f.status === "approved").length;
  const totalPetsInFoster = activePlacements.length;
  const totalAvailableSlots = fosters.reduce((sum, f) => sum + Math.max(0, (f.max_capacity || 1) - (f.active_count || 0)), 0);
  const pendingApplicationsCount = fosters.filter((f) => f.status === "applied" || f.status === "pending").length;

  const filteredFosters = useMemo(() => {
    return fosters.filter((f) => {
      const matchesStatus = statusFilter === "all" || f.status.toLowerCase() === statusFilter.toLowerCase();
      if (!matchesStatus) return false;

      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      const searchable = [
        f.id,
        f.foster_family,
        f.status,
        f.preferences || "",
        f.notes || "",
        f.user?.email || "",
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [fosters, statusFilter, debouncedSearch]);

  const paginatedFosters = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFosters.slice(start, start + pageSize);
  }, [filteredFosters, page]);

  const handleApproveProfile = async (profileId: string) => {
    try {
      setIsSubmitting(true);
      await fosterService.updateProfile(profileId, {
        status: "approved",
        is_available: true,
        background_check_passed: true,
        home_inspection_passed: true,
      });
      addToast("Foster profile approved successfully!", "success");
      fetchFosters();
      notifyDataChanged();
      setSelectedFoster((prev) => (prev && prev.id === profileId ? { ...prev, status: "approved", is_available: true } : prev));
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to approve profile.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectProfile = async (profileId: string) => {
    try {
      setIsSubmitting(true);
      await fosterService.updateProfile(profileId, {
        status: "rejected",
        is_available: false,
      });
      addToast("Foster profile rejected.", "info");
      fetchFosters();
      notifyDataChanged();
      setSelectedFoster((prev) => (prev && prev.id === profileId ? { ...prev, status: "rejected", is_available: false } : prev));
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to reject profile.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await fosterService.apply(applyForm);
      addToast("Registered new foster profile!", "success");
      setIsApplyModalOpen(false);
      setApplyForm({ preferences: "Dogs only, Medium size", max_capacity: 2, notes: "" });
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to register foster profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeTargetProfileId || !placeForm.dog_id) {
      addToast("Foster family and dog selection are required.", "error");
      return;
    }

    const targetFoster = fosters.find((f) => f.id === placeTargetProfileId);
    if (targetFoster && targetFoster.active_count >= targetFoster.max_capacity) {
      addToast(`Cannot place dog: Foster family "${targetFoster.foster_family}" is at maximum capacity (${targetFoster.active_count}/${targetFoster.max_capacity}).`, "error");
      return;
    }

    const existingPlacement = activePlacements.find(
      (p) => String(p.dog_id || p.dog?.id) === placeForm.dog_id && (p.is_active || !p.returned_at)
    );
    if (existingPlacement) {
      addToast(`Cannot place dog: This animal is already placed in active foster care with family "${existingPlacement.foster_family}".`, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await fosterService.placeDog(placeTargetProfileId, placeForm);
      await petService.updatePet(placeForm.dog_id, {
        status: "fostered",
        shelter_status: "In Foster Care",
        is_adoptable: true,
      }).catch(() => null);

      addToast("Animal placed in foster home & Dog Master Profile updated!", "success");
      setIsPlaceModalOpen(false);
      setPlaceForm({ dog_id: "", notes: "" });
      setPlaceTargetProfileId("");
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to place dog in foster care.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    try {
      setIsSubmitting(true);
      await fosterService.updateProfile(editForm.id, {
        status: editForm.status,
        is_available: editForm.is_available,
        max_capacity: Number(editForm.max_capacity),
        preferences: editForm.preferences,
        notes: editForm.notes,
        background_check_passed: editForm.background_check_passed,
        home_inspection_passed: editForm.home_inspection_passed,
      });
      addToast("Updated foster profile details!", "success");
      setIsEditModalOpen(false);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    const dogId = String(selectedPlacement.dog_id || selectedPlacement.dog?.id || "");
    try {
      setIsSubmitting(true);
      await fosterService.returnDog(selectedPlacement.id, returnNotes);
      if (dogId) {
        await petService.updatePet(dogId, {
          status: "shelter_care",
          shelter_status: "In Shelter",
          is_adoptable: true,
        }).catch(() => null);
      }
      addToast("Dog returned from foster care to shelter & Dog Master updated!", "success");
      setIsReturnModalOpen(false);
      setSelectedPlacement(null);
      setReturnNotes("");
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to return dog.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    try {
      setIsSubmitting(true);
      await fosterService.logProgress(selectedPlacement.id, progressForm);
      addToast("Logged foster progress report!", "success");
      setIsProgressModalOpen(false);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to log progress.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlacement?.id) return;
    try {
      setIsSubmitting(true);
      await fosterService.logSupplyDispatch(selectedPlacement.id, supplyForm);
      addToast("Logged supply dispatch for foster placement!", "success");
      setIsSupplyModalOpen(false);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to log supply dispatch.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertToAdopt = async (placementId: string, dogId?: string) => {
    try {
      setIsSubmitting(true);
      await fosterService.convertToAdopt(placementId);
      if (dogId) {
        await petService.updatePet(dogId, {
          status: "adopted",
          shelter_status: "Adopted",
          is_adoptable: false,
        }).catch(() => null);
      }
      addToast("Placement converted into permanent adoption & Dog Master updated!", "success");
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to convert to adoption.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestMedical = async (dogId: string, notes?: string) => {
    if (!dogId) return;
    try {
      setIsSubmitting(true);
      await vetService.bookAppointment({
        pet_id: dogId,
        appointment_type: "Foster Care Medical Check",
        notes: notes || "Medical evaluation requested for fostered animal.",
        scheduled_at: new Date().toISOString(),
      });
      addToast("Veterinary medical check request booked successfully!", "success");
      notifyDataChanged();
    } catch (err: any) {
      addToast(err?.response?.data?.detail || "Failed to book medical evaluation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFoster) return;
    try {
      setIsSubmitting(true);
      await fosterService.deleteProfile(selectedFoster.id);
      addToast(`Deleted foster profile ${selectedFoster.foster_family}`, "success");
      setIsDeleteModalOpen(false);
      setSelectedFoster(null);
      fetchFosters();
      notifyDataChanged();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to delete profile.";
      addToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFosterDetail = async (foster: FosterProfileRow) => {
    setSelectedFoster(foster);
    setIsDetailModalOpen(true);
    try {
      const placementsRes = await fosterService.getProfilePlacements(foster.id);
      const list = unwrapList(placementsRes);
      if (list.length > 0 && list[0].id) {
        const [logsRes, suppRes] = await Promise.allSettled([
          fosterService.getProgressLogs(list[0].id),
          fosterService.getSupplyDispatches(list[0].id),
        ]);
        setProgressLogs(logsRes.status === "fulfilled" ? unwrapList(logsRes.value) : []);
        setSuppliesList(suppRes.status === "fulfilled" ? unwrapList(suppRes.value) : []);
      }
    } catch {
      setProgressLogs([]);
      setSuppliesList([]);
    }
  };

  const stats = [
    { title: "Total Foster Families", value: `${fosters.length} Registered`, trend: `${pendingApplicationsCount} Pending Applications`, color: "#2563EB", icon: <FaHome /> },
    { title: "Active Foster Homes", value: `${totalActiveHomes} Active`, trend: "Available", color: "#10B981", icon: <FaHandHoldingHeart /> },
    { title: "Pets in Foster Care", value: `${totalPetsInFoster} Fostered`, trend: "In Homes", color: "#F59E0B", icon: <FaDog /> },
    { title: "Available Care Slots", value: `${totalAvailableSlots} Capacity`, trend: "Open Slots", color: "#6366F1", icon: <FaClipboardList /> },
  ];

  const columns: Column<FosterProfileRow>[] = [
    {
      key: "id",
      title: "Profile ID",
      render: (_v, row) => <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{row.id.slice(0, 8)}</span>,
    },
    {
      key: "foster_family",
      title: "Foster Family / Parent",
      render: (_v, row) => (
        <div>
          <strong>{row.foster_family}</strong>
          {row.user?.email && <div style={{ fontSize: "11px", color: "#64748B" }}>{row.user.email}</div>}
        </div>
      ),
    },
    {
      key: "status",
      title: "Status & Vetting",
      render: (_v, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 800,
              display: "inline-block",
              width: "fit-content",
              textTransform: "uppercase",
              background: row.status === "approved" ? "#ECFDF5" : row.status === "applied" ? "#FEF3C7" : "#F1F5F9",
              color: row.status === "approved" ? "#047857" : row.status === "applied" ? "#B45309" : "#475569",
            }}
          >
            {row.status}
          </span>
          <div style={{ fontSize: "11px", color: "#64748B", display: "flex", gap: "6px" }}>
            <span>Bg Check: {row.background_check_passed ? "✓ Clear" : "Pending"}</span>
            <span>Home Insp: {row.home_inspection_passed ? "✓ Passed" : "Pending"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "active_count",
      title: "Capacity & Placements",
      render: (_v, row) => (
        <div>
          <strong style={{ color: "#2563EB" }}>{row.active_count} Fostered</strong> / {row.max_capacity} Max
        </div>
      ),
    },
    {
      key: "preferences",
      title: "Preferences",
      render: (_v, row) => <span>{row.preferences || "Any"}</span>,
    },
    {
      key: "created_at",
      title: "Registered Date",
      render: (_v, row) => <span>{row.created_at ? formatDateTime(row.created_at) : "-"}</span>,
    },
  ];

  return (
    <div>
      {/* Header Banner */}
      <div style={{ marginBottom: "24px", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", padding: "24px", borderRadius: "16px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>Foster Management Ecosystem</h1>
        <p style={{ margin: "6px 0 0", color: "#94A3B8", fontSize: "14px" }}>
          Onboard temporary foster caregivers, place rescued animals in loving homes, track progress &amp; supply dispatches, and convert placements to permanent adoption.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "20px", padding: "14px 18px", borderRadius: "10px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Quick Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        <Can permission="create_foster">
          <QuickActionCard icon={<FaUserPlus />} title="Register Fosterer" subtitle="Onboard caregiver" color="#2563EB" onClick={() => setIsApplyModalOpen(true)} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaHandHoldingHeart />} title="Place Animal" subtitle="Assign dog to foster home" color="#10B981" onClick={() => setIsPlaceModalOpen(true)} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaClipboardList />} title="Progress Logs" subtitle="Track health & behavior" color="#F59E0B" onClick={() => setActiveTab("placements")} />
        </Can>
        <Can permission="manage_foster">
          <QuickActionCard icon={<FaBoxOpen />} title="Supply Dispatch" subtitle="Log food & medical supplies" color="#6366F1" onClick={() => setActiveTab("placements")} />
        </Can>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Workspace Navigation Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #E2E8F0" }}>
        <button
          onClick={() => setActiveTab("profiles")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "profiles" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "profiles" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Foster Caregivers &amp; Applications ({fosters.length})
        </button>
        <button
          onClick={() => setActiveTab("placements")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: activeTab === "placements" ? "3px solid #2563EB" : "3px solid transparent",
            background: "none",
            color: activeTab === "placements" ? "#2563EB" : "#64748B",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
          }}
        >
          Active Foster Placements ({activePlacements.length})
        </button>
      </div>

      {activeTab === "profiles" ? (
        <div className="soft-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
              Foster Caregivers Directory
            </h3>
            {loading && <span style={{ fontSize: "13px", color: "#2563EB", fontWeight: 600 }}>Loading...</span>}
          </div>

          <DataTable
            columns={columns}
            data={paginatedFosters}
            module="foster"
            serverMode={true}
            totalCount={filteredFosters.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchValue={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setPage(1);
            }}
            leftHeaderControls={
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="all">All Statuses</option>
                <option value="applied">Applied (Pending Review)</option>
                <option value="approved">Approved &amp; Active</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
              </select>
            }
            onRowClick={(row) => void openFosterDetail(row)}
            renderRowActions={(row: FosterProfileRow) => (
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => void openFosterDetail(row)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #93C5FD",
                    background: "#EFF6FF",
                    color: "#1D4ED8",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Inspect Profile
                </button>
                {(row.status === "applied" || row.status === "pending") && (
                  <>
                    <button
                      disabled={isSubmitting}
                      onClick={() => void handleApproveProfile(row.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#047857",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => void handleRejectProfile(row.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#991B1B",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {row.status === "approved" && (
                  <button
                    onClick={() => {
                      setPlaceTargetProfileId(row.id);
                      setIsPlaceModalOpen(true);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #A7F3D0",
                      background: "#ECFDF5",
                      color: "#047857",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Place Dog
                  </button>
                )}
              </div>
            )}
          />
        </div>
      ) : (
        <div className="soft-card" style={{ padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#0F172A" }}>
            Active Foster Placements
          </h3>
          {activePlacements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B" }}>
              <FaDog size={36} color="#CBD5E1" style={{ marginBottom: "12px" }} />
              <div>No active animal foster placements logged in the backend.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activePlacements.map((p, idx) => (
                <div key={p.id || idx} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "16px", color: "#0F172A" }}>
                      Dog ID: {String(p.dog_id || p.dog?.id || "-")} &bull; Family: {p.foster_family}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                      Placed At: {p.placed_at ? formatDateTime(p.placed_at) : "N/A"} &bull; Placement ID: <span style={{ fontFamily: "monospace" }}>{String(p.id).slice(0, 8)}</span>
                    </div>
                    {p.notes && <div style={{ fontSize: "13px", color: "#334155", marginTop: "6px" }}>Notes: {p.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setSelectedPlacement(p);
                        setIsProgressModalOpen(true);
                      }}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaClipboardList /> Log Progress
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlacement(p);
                        setIsSupplyModalOpen(true);
                      }}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #C084FC", background: "#F3E8FF", color: "#7E22CE", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaBoxOpen /> Log Supply
                    </button>
                    <button
                      onClick={() => void handleRequestMedical(String(p.dog_id || p.dog?.id || ""))}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #6EE7B7", background: "#ECFDF5", color: "#047857", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaStethoscope /> Request Vet Check
                    </button>
                    <button
                      onClick={() => void handleConvertToAdopt(p.id, String(p.dog_id || p.dog?.id || ""))}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #F472B6", background: "#FDF2F8", color: "#DB2777", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaHeart /> Convert to Adopt
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlacement(p);
                        setIsReturnModalOpen(true);
                      }}
                      style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontWeight: 600, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <FaUndo /> Return to Shelter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply Modal */}
      <Modal isOpen={isApplyModalOpen} onClose={() => setIsApplyModalOpen(false)} title="Register Foster Caregiver Profile">
        <form onSubmit={handleApplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Preferences</label>
            <input type="text" placeholder="e.g. Medium dogs, Medical Recovery" value={applyForm.preferences} onChange={(e) => setApplyForm({ ...applyForm, preferences: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Maximum Capacity</label>
            <input type="number" min="1" max="10" value={applyForm.max_capacity} onChange={(e) => setApplyForm({ ...applyForm, max_capacity: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Experience</label>
            <textarea placeholder="e.g. Fenced backyard, prior fostering experience" value={applyForm.notes} onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsApplyModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Registering..." : "Register Profile"}</button>
          </div>
        </form>
      </Modal>

      {/* Place Dog Modal */}
      <Modal isOpen={isPlaceModalOpen} onClose={() => setIsPlaceModalOpen(false)} title="Place Dog in Foster Home">
        <form onSubmit={handlePlaceSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Foster Caregiver Family *</label>
            <select required value={placeTargetProfileId} onChange={(e) => setPlaceTargetProfileId(e.target.value)} style={inputStyle}>
              <option value="">Select foster parent...</option>
              {fosters.filter((f) => f.is_available).map((f) => (
                <option key={f.id} value={f.id}>{f.foster_family} (Capacity: {f.active_count}/{f.max_capacity})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Dog *</label>
            <select required value={placeForm.dog_id} onChange={(e) => setPlaceForm({ ...placeForm, dog_id: e.target.value })} style={inputStyle}>
              <option value="">Select dog...</option>
              {dogs.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Placement Notes</label>
            <textarea placeholder="e.g. Placing for post-surgery recovery, 4-6 weeks." value={placeForm.notes} onChange={(e) => setPlaceForm({ ...placeForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsPlaceModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Placing..." : "Confirm Placement"}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Foster Caregiver Profile">
        <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Profile Status</label>
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })} style={inputStyle}>
              <option value="applied">Applied (Pending)</option>
              <option value="approved">Approved &amp; Active</option>
              <option value="rejected">Rejected</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Max Capacity</label>
              <input type="number" min="1" max="10" value={editForm.max_capacity || 2} onChange={(e) => setEditForm({ ...editForm, max_capacity: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Available for Placement</label>
              <select value={editForm.is_available ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, is_available: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Yes (Available)</option>
                <option value="false">No (Busy / Max Capacity)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Background Check Passed</label>
              <select value={editForm.background_check_passed ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, background_check_passed: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Passed (Verified)</option>
                <option value="false">Pending / Failed</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Home Inspection Passed</label>
              <select value={editForm.home_inspection_passed ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, home_inspection_passed: e.target.value === "true" })} style={inputStyle}>
                <option value="true">Passed (Fenced Yard Verified)</option>
                <option value="false">Pending Inspection</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Notes / Vetting Summary</label>
            <textarea placeholder="e.g. Background check clear, home inspection completed." value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </Modal>

      {/* Return Dog Modal */}
      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Return Dog to Shelter">
        <form onSubmit={handleReturnSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Confirm returning dog from placement <strong>{selectedPlacement?.id?.slice(0, 8)}</strong> to shelter facility?
          </p>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Return Notes</label>
            <textarea placeholder="e.g. Fully recovered, ready to return to shelter." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} style={{ ...inputStyle, minHeight: "60px" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsReturnModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Returning..." : "Confirm Return"}</button>
          </div>
        </form>
      </Modal>

      {/* Progress Log Modal */}
      <Modal isOpen={isProgressModalOpen} onClose={() => setIsProgressModalOpen(false)} title="Log Foster Progress Report">
        <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Weight (kg)</label>
              <input type="number" step="0.1" value={progressForm.weight_kg || 15} onChange={(e) => setProgressForm({ ...progressForm, weight_kg: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Mood Rating (1-5)</label>
              <input type="number" min="1" max="5" value={progressForm.mood_rating || 5} onChange={(e) => setProgressForm({ ...progressForm, mood_rating: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Behavior Notes</label>
            <input type="text" placeholder="e.g. Playful and settled well, no anxiety signs." value={progressForm.behavior_notes || ""} onChange={(e) => setProgressForm({ ...progressForm, behavior_notes: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Feeding &amp; Medication Notes</label>
            <input type="text" placeholder="e.g. Ate full portion, gave morning antibiotic" value={progressForm.feeding_notes || ""} onChange={(e) => setProgressForm({ ...progressForm, feeding_notes: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsProgressModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Logging..." : "Log Progress"}</button>
          </div>
        </form>
      </Modal>

      {/* Log Supply Dispatch Modal */}
      <Modal isOpen={isSupplyModalOpen} onClose={() => setIsSupplyModalOpen(false)} title="Log Supply Dispatch">
        <form onSubmit={handleSupplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Supply Item Type</label>
            <select value={supplyForm.item_type} onChange={(e) => setSupplyForm({ ...supplyForm, item_type: e.target.value as any })} style={inputStyle}>
              <option value="food">Canine Food</option>
              <option value="crate">Crate / Carrier</option>
              <option value="medication">Medication / Supplements</option>
              <option value="bedding">Bedding &amp; Blankets</option>
              <option value="toys">Toys &amp; Enrichment</option>
              <option value="other">Other Supplies</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Description</label>
            <input type="text" placeholder="e.g. 20lb bag of puppy food" value={supplyForm.description || ""} onChange={(e) => setSupplyForm({ ...supplyForm, description: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>Quantity</label>
            <input type="number" min="1" value={supplyForm.quantity || 1} onChange={(e) => setSupplyForm({ ...supplyForm, quantity: Number(e.target.value) })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsSupplyModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#6366F1", color: "#FFF", fontWeight: 600 }}>{isSubmitting ? "Dispatching..." : "Log Supply"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Foster Profile">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ color: "#334155", margin: 0 }}>
            Are you sure you want to delete foster profile <strong>{selectedFoster?.foster_family}</strong>?
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#F1F5F9" }}>Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={handleDelete} style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 600 }}>Delete</button>
          </div>
        </div>
      </Modal>

      {/* Detailed Profile & History Modal */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Foster Application Review — ${selectedFoster?.foster_family || "Caregiver"}`} maxWidth="750px">
        {selectedFoster && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Header Box */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedFoster.foster_family}</h2>
                <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>
                  Profile / Application ID: <span style={{ fontFamily: "monospace" }}>{selectedFoster.id}</span>
                </div>
                {selectedFoster.user?.email && (
                  <div style={{ fontSize: "13px", color: "#334155", marginTop: "2px" }}>
                    Email: <strong>{selectedFoster.user.email}</strong> {selectedFoster.user?.phone ? `• Phone: ${selectedFoster.user.phone}` : ""}
                  </div>
                )}
              </div>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  background: selectedFoster.status === "approved" ? "#D1FAE5" : selectedFoster.status === "applied" || selectedFoster.status === "pending" ? "#FEF3C7" : selectedFoster.status === "rejected" ? "#FEE2E2" : "#F1F5F9",
                  color: selectedFoster.status === "approved" ? "#047857" : selectedFoster.status === "applied" || selectedFoster.status === "pending" ? "#B45309" : selectedFoster.status === "rejected" ? "#B91C1C" : "#475569",
                }}
              >
                {selectedFoster.status}
              </span>
            </div>

            {/* Application Overview & Preferences Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Capacity &amp; Placements</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#2563EB", marginTop: "4px" }}>
                  {selectedFoster.active_count || 0} Active / {selectedFoster.max_capacity || 1} Max Capacity
                </div>
              </div>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Care Preferences</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "4px" }}>
                  {selectedFoster.preferences || "Any"}
                </div>
              </div>
            </div>

            {/* Residence, Household & Questionnaire Details */}
            {selectedFoster.notes && (
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                  Application Questionnaire &amp; Residence Information
                </div>
                <div style={{ fontSize: "13px", color: "#334155", whiteSpace: "pre-line", lineHeight: "1.5" }}>
                  {selectedFoster.notes}
                </div>
              </div>
            )}

            {/* Verification & Inspection Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Background Check</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: selectedFoster.background_check_passed ? "#059669" : "#D97706", marginTop: "4px" }}>
                  {selectedFoster.background_check_passed ? "✓ Passed / Verified" : "Pending Verification"}
                </div>
                {selectedFoster.raw?.background_check_notes && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Notes: {selectedFoster.raw.background_check_notes}</div>
                )}
              </div>
              <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Home Inspection</div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: selectedFoster.home_inspection_passed ? "#059669" : "#D97706", marginTop: "4px" }}>
                  {selectedFoster.home_inspection_passed ? "✓ Passed / Verified Yard" : "Pending Inspection"}
                </div>
                {selectedFoster.raw?.home_inspection_notes && (
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>Notes: {selectedFoster.raw.home_inspection_notes}</div>
                )}
              </div>
            </div>

            {/* Recent History / Progress Logs */}
            <div style={{ background: "#F1F5F9", borderRadius: "10px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaHistory color="#2563EB" /> Recent Progress Logs &amp; Supply Dispatches
              </div>
              {progressLogs.length === 0 && suppliesList.length === 0 ? (
                <div style={{ background: "#FFF", padding: "12px", borderRadius: "8px", color: "#64748B", fontSize: "13px", textAlign: "center" }}>
                  No recent logs registered for this profile.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                  {progressLogs.map((log, idx) => (
                    <div key={idx} style={{ background: "#FFF", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "12px" }}>
                      <strong>Progress Log:</strong> Weight: {log.weight_kg || "-"}kg &bull; Behavior: {log.behavior_notes || "-"}
                    </div>
                  ))}
                  {suppliesList.map((sup, idx) => (
                    <div key={idx} style={{ background: "#FFF", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0", fontSize: "12px" }}>
                      <strong>Supply Dispatch:</strong> Item: {sup.item_type} &bull; {sup.description} (Qty: {sup.quantity})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {(selectedFoster.status === "applied" || selectedFoster.status === "pending") && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleApproveProfile(selectedFoster.id)}
                    style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#10B981", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    Accept/Approve
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleRejectProfile(selectedFoster.id)}
                    style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: "#EF4444", color: "#FFF", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
                  >
                    Reject
                  </button>
                </>
              )}
              <button type="button" onClick={() => setIsDetailModalOpen(false)} style={{ padding: "10px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FosterManagement;
