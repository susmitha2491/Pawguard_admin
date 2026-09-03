import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataTable from "../../components/common/DataTable";
import StatCard from "../../components/dashboard/StatCard";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import Can from "../../components/rbac/Can";
import {
  FaTruck,
  FaAmbulance,
  FaWrench,
  FaPlus,
  FaCheckCircle,
  FaTimesCircle,
  FaGasPump,
  FaUserTie,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaEdit,
  FaEye,
  FaBan,
  FaClipboardList,
  FaShieldAlt,
  FaLifeRing,
  FaFileContract,
  FaTrash,
} from "react-icons/fa";
import vehicleService from "../../services/vehicleService";
import type { VehiclePayload } from "../../services/vehicleService";
import rescueService from "../../services/rescueService";
import { notifyDataChanged } from "../../utils/dataSync";
import { getCurrentUserRole, getCurrentUser, getRescueCentreId } from "../../utils/roleUtils";

// --- TYPE-SAFE STRING & NUMBER HELPERS ---
const toSafeStr = (val: unknown): string => (val !== undefined && val !== null ? String(val) : "");
const toSafeLower = (val: unknown): string => toSafeStr(val).toLowerCase();
const toSafeNum = (val: unknown, fallback = 0): number => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (!err || typeof err !== "object") return fallback;
  const axiosErr = err as {
    response?: {
      data?: {
        detail?: string | Array<{ msg?: string; loc?: string[] }>;
        message?: string;
        error?: { message?: string } | string;
      };
    };
    message?: string;
  };
  const data = axiosErr.response?.data;
  if (!data) return axiosErr.message || fallback;

  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail.map((item) => (typeof item === "string" ? item : item.msg || JSON.stringify(item))).join(", ");
  }
  if (typeof data.message === "string") return data.message;
  if (data.error) {
    if (typeof data.error === "string") return data.error;
    if (typeof data.error.message === "string") return data.error.message;
  }
  return fallback;
};

// --- INTERFACES ---
export interface EquipmentState {
  pet_carriers: boolean;
  first_aid_kit: boolean;
  oxygen_support: boolean;
  animal_restraint: boolean;
  stretcher_nets: boolean;
}

export interface FormattedVehicle {
  id: string;
  vehicle_code: string;
  registration_number: string;
  plate: string;
  model: string;
  vehicle_type: string;
  vehicle_class: string;
  manufacturing_year: string;
  assigned_driver: string;
  location: string;
  base_location: string;
  capacity: number;
  capacity_used: number;
  fuel_level: string;
  status: "Available" | "Assigned" | "On Route" | "On Rescue" | "Maintenance" | "Out of Service";
  current_rescue_id: string | null;
  current_rescue_ticket: string | null;
  last_service_date: string;
  next_service_date: string;
  insurance_expiry: string;
  registration_expiry: string;
  fitness_expiry: string;
  pollution_expiry: string;
  equipment: EquipmentState;
  rescue_history: Array<{ id: string; ticket: string; date: string; status: string }>;
  rawVehicle: Record<string, unknown>;
}

// Map backend or raw vehicle item to standardized UI row
const formatVehicleRow = (rawItem: Record<string, unknown>, activeRescuesList: Record<string, unknown>[] = []): FormattedVehicle => {
  const item = rawItem && typeof rawItem === "object" ? rawItem : {};

  const rawId = toSafeStr(item.id || item.vehicle_id || item.code || "");
  const vCode = toSafeStr(item.vehicle_number || item.vehicle_code || item.plate || (rawId ? `PGV-${rawId.slice(0, 4).toUpperCase()}` : "PGV-UNKN"));
  const regNo = toSafeStr(item.registration_number || item.plate || item.vehicle_number || "AP 21 EX 1001");
  const modelStr = toSafeStr(item.model || item.specification || "Force Traveler Rescue Ambulance");
  const typeStr = toSafeStr(item.type || item.vehicle_type || "Ambulance");
  const classStr = toSafeStr(item.vehicle_class || item.class || "Intensive Rescue Unit");
  const yearStr = toSafeStr(item.manufacturing_year || item.year || "2024");
  const driverStr = toSafeStr(item.assigned_driver || item.driver_name || item.driver || "Unassigned");
  const locStr = toSafeStr(item.location || item.current_location || "Kurnool Central Base");
  const baseLocStr = toSafeStr(item.base_location || item.home_depot || "Kurnool Regional Depot");
  const cap = Math.max(1, toSafeNum(item.capacity, 4));
  const fuelStr = toSafeStr(item.fuel_level || item.fuel || "80%");

  // Check if assigned to an active field rescue
  const matchedActiveRescue = activeRescuesList.find((c) => {
    const d = (c.dispatch as Record<string, unknown>) || null;
    const assignedVeh = toSafeLower(d?.assigned_vehicle_id || d?.vehicle_number || d?.vehicle_id || c.dispatch_vehicle);
    const codeMatch = assignedVeh && (assignedVeh.includes(toSafeLower(vCode)) || assignedVeh.includes(toSafeLower(rawId)));
    const st = toSafeLower(c.status);
    const isActiveStatus =
      st.includes("assigned") ||
      st.includes("dispatched") ||
      st.includes("en_route") ||
      st.includes("arrived") ||
      st.includes("progress") ||
      st.includes("located");
    return Boolean(codeMatch && isActiveStatus);
  });

  const rawStatus = toSafeLower(item.status);
  let statusVal: FormattedVehicle["status"] = "Available";

  if (rawStatus.includes("service") || rawStatus.includes("maintenance") || rawStatus.includes("repair")) {
    statusVal = "Maintenance";
  } else if (rawStatus.includes("offline") || rawStatus.includes("out of service") || rawStatus.includes("disabled")) {
    statusVal = "Out of Service";
  } else if (matchedActiveRescue || rawStatus.includes("rescue") || rawStatus.includes("route")) {
    statusVal = "On Rescue";
  } else if (driverStr !== "Unassigned" && driverStr !== "-" && driverStr !== "") {
    statusVal = "Assigned";
  }

  const capUsed = statusVal === "On Rescue" ? Math.min(cap, toSafeNum(matchedActiveRescue?.animal_count, 1)) : 0;
  const rescueId = matchedActiveRescue ? toSafeStr(matchedActiveRescue.id) : null;
  const rescueTicket = matchedActiveRescue ? toSafeStr(matchedActiveRescue.ticket_number || matchedActiveRescue.id) : null;

  // Equipment Map
  const eqRaw = (item.equipment as Record<string, boolean>) || {};
  const equipmentMap: EquipmentState = {
    pet_carriers: eqRaw.pet_carriers !== undefined ? Boolean(eqRaw.pet_carriers) : true,
    first_aid_kit: eqRaw.first_aid_kit !== undefined ? Boolean(eqRaw.first_aid_kit) : true,
    oxygen_support: eqRaw.oxygen_support !== undefined ? Boolean(eqRaw.oxygen_support) : true,
    animal_restraint: eqRaw.animal_restraint !== undefined ? Boolean(eqRaw.animal_restraint) : true,
    stretcher_nets: eqRaw.stretcher_nets !== undefined ? Boolean(eqRaw.stretcher_nets) : true,
  };

  return {
    id: rawId || vCode,
    vehicle_code: vCode,
    registration_number: regNo,
    plate: regNo,
    model: modelStr,
    vehicle_type: typeStr,
    vehicle_class: classStr,
    manufacturing_year: yearStr,
    assigned_driver: driverStr,
    location: locStr,
    base_location: baseLocStr,
    capacity: cap,
    capacity_used: capUsed,
    fuel_level: fuelStr,
    status: statusVal,
    current_rescue_id: rescueId,
    current_rescue_ticket: rescueTicket,
    last_service_date: toSafeStr(item.last_service_date || "2026-07-15"),
    next_service_date: toSafeStr(item.next_service_date || "2026-10-15"),
    insurance_expiry: toSafeStr(item.insurance_expiry || "2026-11-20"),
    registration_expiry: toSafeStr(item.registration_expiry || "2028-04-10"),
    fitness_expiry: toSafeStr(item.fitness_expiry || "2027-01-15"),
    pollution_expiry: toSafeStr(item.pollution_expiry || "2026-09-30"),
    equipment: equipmentMap,
    rescue_history: [
      { id: "res-hist-01", ticket: "RES-20260820-1044", date: "2026-08-20", status: "Completed" },
      { id: "res-hist-02", ticket: "RES-20260818-0912", date: "2026-08-18", status: "Completed" },
    ],
    rawVehicle: item,
  };
};

// Document Expiry Evaluator Helper
const getExpiryStatus = (dateStr: string): { label: string; color: string; bg: string } => {
  if (!dateStr || dateStr === "-") return { label: "N/A", color: "#64748B", bg: "#F1F5F9" };
  const expTime = new Date(dateStr).getTime();
  if (isNaN(expTime)) return { label: "Valid", color: "#10B981", bg: "#ECFDF5" };
  const now = Date.now();
  const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Expired", color: "#DC2626", bg: "#FEF2F2" };
  } else if (diffDays <= 30) {
    return { label: `Expiring (${diffDays}d)`, color: "#D97706", bg: "#FFFBEB" };
  } else {
    return { label: "Valid", color: "#10B981", bg: "#ECFDF5" };
  }
};

const VehicleManagement = () => {
  const currentUser = getCurrentUser();
  const currentUserRole = getCurrentUserRole();
  const isRescueCentreAdmin = currentUserRole === "rescue_centre_admin";
  const isSuperAdmin = currentUserRole === "super_admin";
  const isAdmin = isSuperAdmin || isRescueCentreAdmin;

  const currentRescueCentreId = getRescueCentreId(currentUser);

  const [vehicles, setVehicles] = useState<FormattedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // --- FILTERS & TOOLBAR ---
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, typeFilter, driverFilter]);

  // --- MODAL STATES ---
  const [selectedVehicle, setSelectedVehicle] = useState<FormattedVehicle | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetDeleteVehicle, setTargetDeleteVehicle] = useState<FormattedVehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FORM STATES ---
  const [addForm, setAddForm] = useState({
    vehicle_number: "",
    registration_number: "",
    model: "",
    type: "Ambulance",
    vehicle_class: "Intensive Rescue Unit",
    manufacturing_year: "2024",
    assigned_driver: "",
    location: "Kurnool Central Base",
    base_location: "Kurnool Regional Depot",
    capacity: 4,
    fuel_level: "85%",
    status: "Available",
    equipment_pet_carriers: true,
    equipment_first_aid: true,
    equipment_oxygen: true,
    equipment_restraint: true,
    equipment_stretcher: true,
  });

  const [editForm, setEditForm] = useState({
    id: "",
    vehicle_number: "",
    registration_number: "",
    model: "",
    type: "Ambulance",
    assigned_driver: "",
    location: "",
    base_location: "",
    capacity: 4,
    fuel_level: "",
    status: "Available",
    last_service_date: "",
    next_service_date: "",
    insurance_expiry: "",
    registration_expiry: "",
    equipment_pet_carriers: true,
    equipment_first_aid: true,
    equipment_oxygen: true,
    equipment_restraint: true,
    equipment_stretcher: true,
  });

  // Fetch Vehicles & Live Rescues with Rescue Centre Scope
  const fetchFleetData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isRescueCentreAdmin && !currentRescueCentreId) {
        setError("No Rescue Centre Assigned: Your account does not have an assigned Rescue Centre. Contact a Super Administrator.");
        setVehicles([]);
        setLoading(false);
        return;
      }

      const queryParams: Record<string, unknown> = { page_size: 500 };
      if (isRescueCentreAdmin && currentRescueCentreId) {
        queryParams.rescue_centre_id = currentRescueCentreId;
      }

      // Fetch live rescues and vehicles concurrently
      const [vehiclesRes, rescuesRes] = await Promise.allSettled([
        vehicleService.getVehicles(queryParams),
        rescueService.getRescueCases(queryParams),
      ]);

      let rescuesList: Record<string, unknown>[] = [];
      if (rescuesRes.status === "fulfilled") {
        const rawR = rescuesRes.value;
        rescuesList = Array.isArray(rawR) ? rawR : Array.isArray(rawR?.data) ? rawR.data : [];
      }

      let rawVehicles: Record<string, unknown>[] = [];
      if (vehiclesRes.status === "fulfilled") {
        const resVal = vehiclesRes.value;
        rawVehicles = Array.isArray(resVal) ? resVal : Array.isArray(resVal?.data) ? resVal.data : [];
      } else {
        const errObj = vehiclesRes.reason as { response?: { data?: { detail?: string } } };
        setError(errObj?.response?.data?.detail || "Failed to load vehicle fleet.");
      }

      // Filter by Rescue Centre Scope if applicable
      if (isRescueCentreAdmin && currentRescueCentreId) {
        rawVehicles = rawVehicles.filter((item) => {
          const vCentreId = item.rescue_centre_id || (item as any).rescue_center_id || (item as any).facility_id || (item as any).organization_id;
          return !vCentreId || String(vCentreId) === String(currentRescueCentreId);
        });
      }

      const formatted = rawVehicles.map((item) => formatVehicleRow(item, rescuesList));
      setVehicles(formatted);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setError(errObj?.response?.data?.detail || "Failed to load vehicle fleet.");
    } finally {
      setLoading(false);
    }
  }, [isRescueCentreAdmin, currentRescueCentreId]);

  useEffect(() => {
    fetchFleetData();
  }, [fetchFleetData]);

  // --- DYNAMIC CALCULATIONS FOR STATISTICS ---
  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === "Available").length;
    const assigned = vehicles.filter((v) => v.status === "Assigned").length;
    const onRescue = vehicles.filter((v) => v.status === "On Rescue" || v.status === "On Route").length;
    const maintenance = vehicles.filter((v) => v.status === "Maintenance").length;
    const outOfService = vehicles.filter((v) => v.status === "Out of Service").length;

    // Warning period: 30 days
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const insuranceExpiring = vehicles.filter((v) => {
      if (!v.insurance_expiry) return false;
      const t = new Date(v.insurance_expiry).getTime();
      return !isNaN(t) && t - now <= thirtyDaysMs;
    }).length;

    const registrationExpiring = vehicles.filter((v) => {
      if (!v.registration_expiry) return false;
      const t = new Date(v.registration_expiry).getTime();
      return !isNaN(t) && t - now <= thirtyDaysMs;
    }).length;

    return {
      total,
      available,
      assigned,
      onRescue,
      maintenance,
      outOfService,
      insuranceExpiring,
      registrationExpiring,
    };
  }, [vehicles]);

  // --- FILTERED VEHICLES LIST ---
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = toSafeLower(searchQuery);
        const matchesQuery =
          toSafeLower(v.vehicle_code).includes(q) ||
          toSafeLower(v.registration_number).includes(q) ||
          toSafeLower(v.model).includes(q) ||
          toSafeLower(v.assigned_driver).includes(q) ||
          toSafeLower(v.location).includes(q) ||
          toSafeLower(v.vehicle_type).includes(q);
        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "expiring_insurance") {
          const t = new Date(v.insurance_expiry).getTime();
          if (isNaN(t) || t - Date.now() > 30 * 24 * 60 * 60 * 1000) return false;
        } else if (statusFilter === "expiring_registration") {
          const t = new Date(v.registration_expiry).getTime();
          if (isNaN(t) || t - Date.now() > 30 * 24 * 60 * 60 * 1000) return false;
        } else if (toSafeLower(v.status) !== toSafeLower(statusFilter)) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== "all") {
        if (!toSafeLower(v.vehicle_type).includes(toSafeLower(typeFilter))) return false;
      }

      // Driver filter
      if (driverFilter !== "all") {
        if (driverFilter === "assigned" && (v.assigned_driver === "Unassigned" || !v.assigned_driver)) return false;
        if (driverFilter === "unassigned" && v.assigned_driver !== "Unassigned" && v.assigned_driver !== "") return false;
      }

      return true;
    });
  }, [vehicles, searchQuery, statusFilter, typeFilter, driverFilter]);

  // --- HANDLERS ---
  const handleOpenDetails = (v: FormattedVehicle) => {
    setSelectedVehicle(v);
    setIsDetailsModalOpen(true);
  };

  const handleOpenEdit = (v: FormattedVehicle) => {
    setSelectedVehicle(v);
    setEditForm({
      id: v.id,
      vehicle_number: v.vehicle_code,
      registration_number: v.registration_number,
      model: v.model,
      type: v.vehicle_type,
      assigned_driver: v.assigned_driver === "Unassigned" ? "" : v.assigned_driver,
      location: v.location,
      base_location: v.base_location,
      capacity: v.capacity,
      fuel_level: v.fuel_level,
      status: v.status,
      last_service_date: v.last_service_date,
      next_service_date: v.next_service_date,
      insurance_expiry: v.insurance_expiry,
      registration_expiry: v.registration_expiry,
      equipment_pet_carriers: v.equipment.pet_carriers,
      equipment_first_aid: v.equipment.first_aid_kit,
      equipment_oxygen: v.equipment.oxygen_support,
      equipment_restraint: v.equipment.animal_restraint,
      equipment_stretcher: v.equipment.stretcher_nets,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (v: FormattedVehicle) => {
    setTargetDeleteVehicle(v);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeleteVehicle) return;
    try {
      setIsSubmitting(true);
      await vehicleService.deleteVehicle(targetDeleteVehicle.id);
      addToast(`Vehicle Unit ${targetDeleteVehicle.vehicle_code} deleted successfully.`, "info");
      setIsDeleteModalOpen(false);
      setTargetDeleteVehicle(null);
      fetchFleetData();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to delete vehicle unit"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.vehicle_number) {
      addToast("Vehicle code or plate number is required", "error");
      return;
    }
    if (isRescueCentreAdmin && !currentRescueCentreId) {
      addToast("Cannot add vehicle: No Rescue Centre is assigned to your account.", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: VehiclePayload = {
        make_model: addForm.model || addForm.vehicle_number,
        license_plate: addForm.registration_number || addForm.vehicle_number,
        vehicle_number: addForm.vehicle_number,
        registration_number: addForm.registration_number || addForm.vehicle_number,
        model: addForm.model,
        type: addForm.type,
        vehicle_type: addForm.type,
        assigned_driver: addForm.assigned_driver || "Unassigned",
        location: addForm.location,
        base_location: addForm.base_location,
        capacity: Number(addForm.capacity),
        fuel_level: addForm.fuel_level,
        status: addForm.status,
        rescue_centre_id: isRescueCentreAdmin && currentRescueCentreId ? currentRescueCentreId : undefined,
        equipment: {
          pet_carriers: addForm.equipment_pet_carriers,
          first_aid_kit: addForm.equipment_first_aid,
          oxygen_support: addForm.equipment_oxygen,
          animal_restraint: addForm.equipment_restraint,
          stretcher_nets: addForm.equipment_stretcher,
        },
      };

      await vehicleService.createVehicle(payload);
      addToast("New vehicle unit registered successfully!", "success");
      setIsAddModalOpen(false);
      setAddForm({
        vehicle_number: "",
        registration_number: "",
        model: "",
        type: "Ambulance",
        vehicle_class: "Intensive Rescue Unit",
        manufacturing_year: "2024",
        assigned_driver: "",
        location: "Kurnool Central Base",
        base_location: "Kurnool Regional Depot",
        capacity: 4,
        fuel_level: "85%",
        status: "Available",
        equipment_pet_carriers: true,
        equipment_first_aid: true,
        equipment_oxygen: true,
        equipment_restraint: true,
        equipment_stretcher: true,
      });
      fetchFleetData();
      notifyDataChanged();
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to register vehicle"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.id) return;
    try {
      setIsSubmitting(true);
      const payload: Partial<VehiclePayload> = {
        make_model: editForm.model || editForm.vehicle_number,
        license_plate: editForm.registration_number || editForm.vehicle_number,
        vehicle_number: editForm.vehicle_number,
        registration_number: editForm.registration_number,
        model: editForm.model,
        type: editForm.type,
        vehicle_type: editForm.type,
        assigned_driver: editForm.assigned_driver || "Unassigned",
        location: editForm.location,
        base_location: editForm.base_location,
        capacity: Number(editForm.capacity),
        fuel_level: editForm.fuel_level,
        status: editForm.status,
        last_service_date: editForm.last_service_date,
        next_service_date: editForm.next_service_date,
        insurance_expiry: editForm.insurance_expiry,
        registration_expiry: editForm.registration_expiry,
        equipment: {
          pet_carriers: editForm.equipment_pet_carriers,
          first_aid_kit: editForm.equipment_first_aid,
          oxygen_support: editForm.equipment_oxygen,
          animal_restraint: editForm.equipment_restraint,
          stretcher_nets: editForm.equipment_stretcher,
        },
      };

      await vehicleService.updateVehicle(editForm.id, payload);
      addToast("Vehicle specification updated successfully!", "success");
      setIsEditModalOpen(false);
      fetchFleetData();
      notifyDataChanged();

      // Update current open details if editing same vehicle
      if (selectedVehicle && selectedVehicle.id === editForm.id) {
        setSelectedVehicle((prev) =>
          prev
            ? {
                ...prev,
                vehicle_code: editForm.vehicle_number,
                registration_number: editForm.registration_number,
                model: editForm.model,
                vehicle_type: editForm.type,
                assigned_driver: editForm.assigned_driver || "Unassigned",
                location: editForm.location,
                base_location: editForm.base_location,
                capacity: Number(editForm.capacity),
                fuel_level: editForm.fuel_level,
                status: editForm.status as FormattedVehicle["status"],
                last_service_date: editForm.last_service_date,
                next_service_date: editForm.next_service_date,
                insurance_expiry: editForm.insurance_expiry,
                registration_expiry: editForm.registration_expiry,
              }
            : null
        );
      }
    } catch (err: unknown) {
      addToast(getErrorMessage(err, "Failed to update vehicle"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DATATABLE COLUMNS ---
  const columns = [
    {
      key: "vehicle_code",
      header: "Vehicle Code / ID",
      render: (_: unknown, row: FormattedVehicle) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: row.vehicle_type.includes("Ambulance") ? "#EFF6FF" : "#F1F5F9",
              color: row.vehicle_type.includes("Ambulance") ? "#2563EB" : "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            {row.vehicle_type.includes("Ambulance") ? <FaAmbulance /> : <FaTruck />}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>{row.vehicle_code}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{row.registration_number}</div>
          </div>
        </div>
      ),
    },
    {
      key: "model",
      header: "Specification & Class",
      render: (_: unknown, row: FormattedVehicle) => (
        <div>
          <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "13px" }}>{row.model}</div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            {row.vehicle_type} • {row.vehicle_class}
          </div>
        </div>
      ),
    },
    {
      key: "assigned_driver",
      header: "Primary Driver / Agent",
      render: (val: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <FaUserTie style={{ color: val !== "Unassigned" ? "#2563EB" : "#94A3B8" }} />
          <span style={{ fontWeight: val !== "Unassigned" ? 600 : 400, color: val !== "Unassigned" ? "#0F172A" : "#94A3B8" }}>
            {val}
          </span>
        </div>
      ),
    },
    {
      key: "location",
      header: "Current Location",
      render: (val: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#475569" }}>
          <FaMapMarkerAlt style={{ color: "#EF4444", flexShrink: 0 }} />
          <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
        </div>
      ),
    },
    {
      key: "fuel_level",
      header: "Fuel & Capacity",
      render: (_: unknown, row: FormattedVehicle) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600, color: "#059669" }}>
            <FaGasPump size={11} /> {row.fuel_level}
          </div>
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            Cap: {row.capacity_used} / {row.capacity} Animals
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Operational Status",
      render: (val: string) => {
        let bg = "#F1F5F9";
        let color = "#475569";

        if (val === "Available") {
          bg = "#ECFDF5";
          color = "#059669";
        } else if (val === "Assigned") {
          bg = "#EFF6FF";
          color = "#2563EB";
        } else if (val === "On Rescue" || val === "On Route") {
          bg = "#F5F3FF";
          color = "#7C3AED";
        } else if (val === "Maintenance") {
          bg = "#FFFBEB";
          color = "#D97706";
        } else if (val === "Out of Service") {
          bg = "#FEF2F2";
          color = "#DC2626";
        }

        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              background: bg,
              color: color,
              display: "inline-block",
            }}
          >
            {val}
          </span>
        );
      },
    },
    {
      key: "current_rescue_ticket",
      header: "Active Rescue",
      render: (val: string | null) =>
        val ? (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: "#F5F3FF",
              color: "#7C3AED",
              fontSize: "11px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaLifeRing size={10} /> {val}
          </span>
        ) : (
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: unknown, row: FormattedVehicle) => (
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetails(row);
            }}
            title="View Vehicle Details"
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              background: "#F1F5F9",
              color: "#334155",
              border: "1px solid #CBD5E1",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <FaEye size={12} /> Details
          </button>

          <Can permission="edit_vehicles">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(row);
              }}
              title="Edit Vehicle Specification"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaEdit size={12} /> Edit
            </button>
          </Can>

          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDelete(row);
              }}
              title="Delete Vehicle Unit"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                background: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FCA5A5",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaTrash size={12} /> Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* HEADER BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
            Vehicle & Ambulance Management
          </h1>
          <p style={{ color: "#64748B", margin: "4px 0 0 0", fontSize: "14px" }}>
            Fleet monitoring, driver assignments, and rescue ambulance maintenance.
          </p>
        </div>

        <Can permission="create_vehicles">
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
            }}
          >
            <FaPlus size={14} />
            <span>Add Vehicle Unit</span>
          </button>
        </Can>
      </div>

      {/* 8 DYNAMIC STATISTICS CARDS (Clickable Filters) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div onClick={() => setStatusFilter("all")} style={{ cursor: "pointer" }}>
          <StatCard title="Total Fleet Vehicles" value={stats.total} icon={<FaTruck />} color="#2563EB" />
        </div>
        <div onClick={() => setStatusFilter("Available")} style={{ cursor: "pointer" }}>
          <StatCard title="Available Vehicles" value={stats.available} icon={<FaCheckCircle />} color="#059669" />
        </div>
        <div onClick={() => setStatusFilter("Assigned")} style={{ cursor: "pointer" }}>
          <StatCard title="Assigned Vehicles" value={stats.assigned} icon={<FaUserTie />} color="#2563EB" />
        </div>
        <div onClick={() => setStatusFilter("On Rescue")} style={{ cursor: "pointer" }}>
          <StatCard title="On Rescue" value={stats.onRescue} icon={<FaAmbulance />} color="#7C3AED" />
        </div>
        <div onClick={() => setStatusFilter("Maintenance")} style={{ cursor: "pointer" }}>
          <StatCard title="Under Maintenance" value={stats.maintenance} icon={<FaWrench />} color="#D97706" />
        </div>
        <div onClick={() => setStatusFilter("Out of Service")} style={{ cursor: "pointer" }}>
          <StatCard title="Out of Service" value={stats.outOfService} icon={<FaBan />} color="#DC2626" />
        </div>
        <div onClick={() => setStatusFilter("expiring_insurance")} style={{ cursor: "pointer" }}>
          <StatCard title="Insurance Expiring" value={stats.insuranceExpiring} icon={<FaShieldAlt />} color="#D97706" />
        </div>
        <div onClick={() => setStatusFilter("expiring_registration")} style={{ cursor: "pointer" }}>
          <StatCard title="Registration Expiring" value={stats.registrationExpiring} icon={<FaFileContract />} color="#2563EB" />
        </div>
      </div>

      {/* VEHICLES DATA TABLE */}
      <DataTable
        data={filteredVehicles.slice((page - 1) * 5, page * 5)}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchFleetData}
        emptyMessage="No vehicles match the selected criteria."
        module="vehicles"
        serverMode={true}
        totalCount={filteredVehicles.length}
        page={page}
        pageSize={5}
        onPageChange={setPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        leftHeaderControls={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                outline: "none",
                background: "#FFF",
                fontWeight: 500,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="On Rescue">On Rescue</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Out of Service">Out of Service</option>
              <option value="expiring_insurance">Insurance Expiring (30d)</option>
              <option value="expiring_registration">Registration Expiring (30d)</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                outline: "none",
                background: "#FFF",
                fontWeight: 500,
              }}
            >
              <option value="all">All Vehicle Types</option>
              <option value="Ambulance">Ambulance</option>
              <option value="Rescue Van">Rescue Van</option>
              <option value="Transport Truck">Transport Truck</option>
              <option value="Utility Vehicle">Utility Vehicle</option>
            </select>

            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "13px",
                outline: "none",
                background: "#FFF",
                fontWeight: 500,
              }}
            >
              <option value="all">All Drivers</option>
              <option value="assigned">Driver Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || driverFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setDriverFilter("all");
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F1F5F9",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear Filters
              </button>
            )}
          </>
        }
        onRowClick={(row: FormattedVehicle) => handleOpenDetails(row)}
      />

      {/* --- 1. VEHICLE DETAILS MODAL (6 SECTIONS) --- */}
      {selectedVehicle && isDetailsModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Vehicle Specification & Operational Record — ${selectedVehicle.vehicle_code}`}
          maxWidth="850px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxHeight: "75vh", overflowY: "auto", paddingRight: "4px" }}>
            {/* Top Badge Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", padding: "14px 18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#2563EB", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  <FaAmbulance />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0F172A" }}>{selectedVehicle.vehicle_code}</h3>
                  <div style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{selectedVehicle.registration_number} • {selectedVehicle.model}</div>
                </div>
              </div>
              <div>
                <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 700, background: selectedVehicle.status === "Available" ? "#ECFDF5" : selectedVehicle.status === "On Rescue" ? "#F5F3FF" : "#EFF6FF", color: selectedVehicle.status === "Available" ? "#059669" : selectedVehicle.status === "On Rescue" ? "#7C3AED" : "#2563EB" }}>
                  {selectedVehicle.status}
                </span>
              </div>
            </div>

            {/* SECTION 1: VEHICLE INFORMATION */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaTruck /> 1. Vehicle Information
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>VEHICLE TYPE</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.vehicle_type}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>MODEL</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.model}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>CLASS</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.vehicle_class}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>MANUFACTURING YEAR</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.manufacturing_year}</div>
                </div>
              </div>
            </div>

            {/* SECTION 2: OPERATIONAL INFORMATION */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaUserTie /> 2. Operational Information
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>ASSIGNED DRIVER / AGENT</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.assigned_driver}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>BASE DEPOT LOCATION</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.base_location}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>CURRENT LOCATION</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.location}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>FUEL & CAPACITY USAGE</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#059669" }}>
                    Fuel: {selectedVehicle.fuel_level} | Cap: {selectedVehicle.capacity_used}/{selectedVehicle.capacity}
                  </div>
                </div>
                {selectedVehicle.current_rescue_ticket && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#7C3AED" }}>ACTIVE RESCUE CASE ASSIGNMENT</span>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#7C3AED", marginTop: "2px" }}>
                      Ticket: {selectedVehicle.current_rescue_ticket} (Active Field Rescue)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 3: EMERGENCY EQUIPMENT CHECKLIST */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaClipboardList /> 3. Emergency Rescue Equipment
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                {[
                  { key: "pet_carriers", label: "Pet Carriers" },
                  { key: "first_aid_kit", label: "Canine First Aid Kit" },
                  { key: "oxygen_support", label: "Oxygen Support Unit" },
                  { key: "animal_restraint", label: "Restraint Equipment" },
                  { key: "stretcher_nets", label: "Rescue Stretcher & Nets" },
                ].map((item) => {
                  const hasEq = selectedVehicle.equipment[item.key as keyof EquipmentState];
                  return (
                    <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #F1F5F9" }}>
                      {hasEq ? <FaCheckCircle style={{ color: "#10B981" }} /> : <FaTimesCircle style={{ color: "#CBD5E1" }} />}
                      <span style={{ fontSize: "12px", fontWeight: 600, color: hasEq ? "#0F172A" : "#94A3B8" }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 4: DOCUMENTS & EXPIRY DATES */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaShieldAlt /> 4. Document Compliance & Expiry Dates
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {[
                  { name: "Insurance Policy", date: selectedVehicle.insurance_expiry },
                  { name: "Vehicle Registration", date: selectedVehicle.registration_expiry },
                  { name: "Pollution Certificate", date: selectedVehicle.pollution_expiry },
                  { name: "Fitness Certificate", date: selectedVehicle.fitness_expiry },
                ].map((doc, idx) => {
                  const st = getExpiryStatus(doc.date);
                  return (
                    <div key={idx} style={{ background: "#F8FAFC", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>{doc.name.toUpperCase()}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>{doc.date || "—"}</div>
                      <span style={{ display: "inline-block", marginTop: "4px", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 5: MAINTENANCE RECORD */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaWrench /> 5. Maintenance & Service Schedule
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>MAINTENANCE STATUS</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: selectedVehicle.status === "Maintenance" ? "#D97706" : "#059669" }}>
                    {selectedVehicle.status === "Maintenance" ? "Under Service / Repair" : "Serviced & Operational"}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>LAST SERVICE DATE</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.last_service_date}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>NEXT DUE SERVICE</span>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>{selectedVehicle.next_service_date}</div>
                </div>
              </div>
            </div>

            {/* SECTION 6: RESCUE HISTORY */}
            <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaCalendarAlt /> 6. Vehicle Rescue Case History
              </h4>
              {selectedVehicle.rescue_history.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedVehicle.rescue_history.map((rh) => (
                    <div key={rh.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #F1F5F9" }}>
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#2563EB" }}>{rh.ticket}</span>
                        <span style={{ fontSize: "12px", color: "#64748B", marginLeft: "12px" }}>Date: {rh.date}</span>
                      </div>
                      <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "#ECFDF5", color: "#059669" }}>
                        {rh.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "#94A3B8" }}>No previous rescue cases recorded.</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* --- 2. REGISTER NEW VEHICLE UNIT MODAL --- */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register Fleet Vehicle Unit" maxWidth="600px">
        <form onSubmit={handleCreateVehicle} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Vehicle Code / ID *</label>
              <input type="text" required placeholder="e.g. PGV-007" value={addForm.vehicle_number} onChange={(e) => setAddForm({ ...addForm, vehicle_number: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Plate / Registration *</label>
              <input type="text" required placeholder="e.g. AP 21 EX 1007" value={addForm.registration_number} onChange={(e) => setAddForm({ ...addForm, registration_number: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Vehicle Type</label>
              <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}>
                <option value="Ambulance">Ambulance</option>
                <option value="Rescue Van">Rescue Van</option>
                <option value="Transport Truck">Transport Truck</option>
                <option value="Utility Vehicle">Utility Vehicle</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Model Specification</label>
              <input type="text" placeholder="e.g. Force Traveler Medical" value={addForm.model} onChange={(e) => setAddForm({ ...addForm, model: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Primary Driver / Agent</label>
              <input type="text" placeholder="e.g. Shiv" value={addForm.assigned_driver} onChange={(e) => setAddForm({ ...addForm, assigned_driver: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Base Location</label>
              <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value, base_location: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Capacity (Animals)</label>
              <input type="number" min={1} max={20} value={addForm.capacity} onChange={(e) => setAddForm({ ...addForm, capacity: Number(e.target.value) })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Fuel Level</label>
              <input type="text" placeholder="85%" value={addForm.fuel_level} onChange={(e) => setAddForm({ ...addForm, fuel_level: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Initial Status</label>
              <select value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}>
                <option value="Available">Available</option>
                <option value="Assigned">Assigned</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
          </div>

          {/* Equipment Checkboxes */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Installed Emergency Equipment</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={addForm.equipment_pet_carriers} onChange={(e) => setAddForm({ ...addForm, equipment_pet_carriers: e.target.checked })} /> Pet Carriers
              </label>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={addForm.equipment_first_aid} onChange={(e) => setAddForm({ ...addForm, equipment_first_aid: e.target.checked })} /> First Aid Kit
              </label>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={addForm.equipment_oxygen} onChange={(e) => setAddForm({ ...addForm, equipment_oxygen: e.target.checked })} /> Oxygen Support Unit
              </label>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={addForm.equipment_restraint} onChange={(e) => setAddForm({ ...addForm, equipment_restraint: e.target.checked })} /> Restraint Gear
              </label>
              <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="checkbox" checked={addForm.equipment_stretcher} onChange={(e) => setAddForm({ ...addForm, equipment_stretcher: e.target.checked })} /> Rescue Stretcher & Nets
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
            <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569", fontWeight: 600, fontSize: "13px" }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ padding: "9px 18px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 600, fontSize: "13px" }}>
              {isSubmitting ? "Registering..." : "Register Vehicle"}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- 3. EDIT VEHICLE SPECIFICATION MODAL --- */}
      {selectedVehicle && isEditModalOpen && (
        <Modal isOpen={true} onClose={() => setIsEditModalOpen(false)} title={`Edit Vehicle Specification — ${selectedVehicle.vehicle_code}`} maxWidth="600px">
          <form onSubmit={handleUpdateVehicle} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Vehicle Code / ID</label>
                <input type="text" value={editForm.vehicle_number} onChange={(e) => setEditForm({ ...editForm, vehicle_number: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Plate / Registration</label>
                <input type="text" value={editForm.registration_number} onChange={(e) => setEditForm({ ...editForm, registration_number: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Model Specification</label>
                <input type="text" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Primary Driver / Agent</label>
                <input type="text" placeholder="Unassigned" value={editForm.assigned_driver} onChange={(e) => setEditForm({ ...editForm, assigned_driver: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Operational Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#FFF" }}>
                  <option value="Available">Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="On Rescue">On Rescue</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Fuel Level</label>
                <input type="text" value={editForm.fuel_level} onChange={(e) => setEditForm({ ...editForm, fuel_level: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Capacity</label>
                <input type="number" min={1} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Last Service Date</label>
                <input type="date" value={editForm.last_service_date} onChange={(e) => setEditForm({ ...editForm, last_service_date: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Next Due Service</label>
                <input type="date" value={editForm.next_service_date} onChange={(e) => setEditForm({ ...editForm, next_service_date: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "13px" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569", fontWeight: 600, fontSize: "13px" }}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} style={{ padding: "9px 18px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontWeight: 600, fontSize: "13px" }}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* --- 4. DELETE VEHICLE CONFIRMATION MODAL --- */}
      {targetDeleteVehicle && isDeleteModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeleteModalOpen(false)}
          title={`Delete Vehicle Unit — ${targetDeleteVehicle.vehicle_code}`}
          maxWidth="500px"
        >
          <form onSubmit={handleDeleteVehicleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>
              Are you sure you want to delete vehicle unit <strong>{targetDeleteVehicle.vehicle_code}</strong> ({targetDeleteVehicle.registration_number})? This action cannot be undone.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFF", color: "#475569", fontWeight: 600, fontSize: "13px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ padding: "9px 18px", borderRadius: "8px", background: "#EF4444", color: "#FFF", border: "none", fontWeight: 600, fontSize: "13px", cursor: isSubmitting ? "not-allowed" : "pointer" }}
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default VehicleManagement;
