import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import cmsService from "../../services/cmsService";
import type {
  ContactLocationRecord,
  ContactLocationCreatePayload,
  ContactLocationUpdatePayload,
} from "../../types/cms";
import DataTable, { type Column } from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import { formatDateTime } from "../../utils/dateUtils";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaPhoneAlt,
  FaClock,
  FaMapMarkerAlt,
  FaEnvelope,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaSync,
  FaEllipsisV,
  FaEye,
  FaChevronDown,
  FaChevronUp,
  FaShieldAlt,
  FaBuilding,
  FaCheck,
  FaCopy,
} from "react-icons/fa";

/**
 * Enhanced error message parser providing user-friendly, descriptive messages.
 */
const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as {
      response?: {
        status?: number;
        data?: { detail?: unknown; message?: unknown; error?: { message?: string } };
      };
    };
    const status = r?.response?.status;
    const detail =
      r?.response?.data?.detail ??
      r?.response?.data?.message ??
      r?.response?.data?.error?.message;

    if (status === 404) {
      return "Contact location could not be found. It may have already been deleted.";
    }
    if (status === 401 || status === 403) {
      return "You do not have permission to perform this action.";
    }
    if (status === 422) {
      if (typeof detail === "string" && detail) return `Validation error: ${detail}`;
      if (Array.isArray(detail) && detail.length > 0) {
        return detail
          .map((d: any) => (typeof d === "object" ? d.msg || JSON.stringify(d) : String(d)))
          .join("; ");
      }
      return "Invalid data provided. Please check all required fields.";
    }
    if (status && status >= 500) {
      return "Unable to update/delete contact location. Please try again.";
    }

    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((d: any) => (typeof d === "object" ? d.msg || JSON.stringify(d) : String(d)))
        .join("; ");
    }
  }
  return fallback;
};

const CmsContactView: React.FC = () => {
  const { addToast } = useToast();

  // Data state
  const [locations, setLocations] = useState<ContactLocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "hotlines" | "centers">("all");

  // View Details Modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<ContactLocationRecord | null>(null);
  const [showTechnicalInfo, setShowTechnicalInfo] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Create / Edit Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingLocation, setEditingLocation] = useState<ContactLocationRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    operating_hours: "",
    is_emergency_hotline: false,
    sort_order: 0,
  });

  // Delete Confirmation Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<ContactLocationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Active Dropdown menu state
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch contact locations from backend (Single Source of Truth)
  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await cmsService.getContactLocations();
      const list = Array.isArray(res) ? res : [];
      // Sort by sort_order ascending, then name
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
      setLocations(list);
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load contact locations from backend API."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Client-side search and filtering
  const filteredLocations = useMemo(() => {
    let result = locations;

    if (typeFilter === "hotlines") {
      result = result.filter((loc) => loc.is_emergency_hotline);
    } else if (typeFilter === "centers") {
      result = result.filter((loc) => !loc.is_emergency_hotline);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          loc.phone.toLowerCase().includes(q) ||
          (loc.email && loc.email.toLowerCase().includes(q)) ||
          loc.address.toLowerCase().includes(q) ||
          (loc.operating_hours && loc.operating_hours.toLowerCase().includes(q))
      );
    }

    return result;
  }, [locations, searchQuery, typeFilter]);

  // Summary counts
  const hotlineCount = useMemo(() => locations.filter((l) => l.is_emergency_hotline).length, [locations]);
  const centerCount = useMemo(() => locations.filter((l) => !l.is_emergency_hotline).length, [locations]);

  // Modal handlers
  const handleOpenViewDetails = (loc: ContactLocationRecord) => {
    setSelectedLocation(loc);
    setShowTechnicalInfo(false);
    setCopiedId(false);
    setViewModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleOpenCreate = () => {
    setFormMode("create");
    setEditingLocation(null);
    setForm({
      name: "",
      address: "",
      phone: "",
      email: "",
      operating_hours: "24/7 Emergency Dispatch",
      is_emergency_hotline: false,
      sort_order: locations.length > 0 ? Math.max(...locations.map((l) => l.sort_order || 0)) + 1 : 0,
    });
    setFormErrors({});
    setFormModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleOpenEdit = (loc: ContactLocationRecord) => {
    setFormMode("edit");
    setEditingLocation(loc);
    setForm({
      name: loc.name || "",
      address: loc.address || "",
      phone: loc.phone || "",
      email: loc.email || "",
      operating_hours: loc.operating_hours || "",
      is_emergency_hotline: loc.is_emergency_hotline ?? false,
      sort_order: loc.sort_order ?? 0,
    });
    setFormErrors({});
    setFormModalOpen(true);
    setActiveDropdownId(null);
    if (viewModalOpen) setViewModalOpen(false);
  };

  const handleOpenDelete = (loc: ContactLocationRecord) => {
    setLocationToDelete(loc);
    setDeleteModalOpen(true);
    setActiveDropdownId(null);
    if (viewModalOpen) setViewModalOpen(false);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Location / Hotline name is required.";
    if (!form.address.trim()) errors.address = "Physical address is required.";
    if (!form.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (form.phone.trim().length < 5 || form.phone.trim().length > 32) {
      errors.phone = "Phone number must be between 5 and 32 characters.";
    }
    if (form.email && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save / Update Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      if (formMode === "create") {
        const payload: ContactLocationCreatePayload = {
          name: form.name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          operating_hours: form.operating_hours.trim() || null,
          is_emergency_hotline: form.is_emergency_hotline,
          sort_order: Number(form.sort_order) || 0,
        };
        await cmsService.createContactLocation(payload);
        addToast("Contact location created successfully.", "success");
      } else if (editingLocation) {
        const payload: ContactLocationUpdatePayload = {
          name: form.name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          operating_hours: form.operating_hours.trim() || null,
          is_emergency_hotline: form.is_emergency_hotline,
          sort_order: Number(form.sort_order) || 0,
        };
        await cmsService.updateContactLocation(editingLocation.id, payload);
        addToast("Contact location updated successfully.", "success");
      }
      setFormModalOpen(false);
      await fetchLocations();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save contact location."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;
    try {
      setDeleting(true);
      await cmsService.deleteContactLocation(locationToDelete.id);
      addToast("Contact location deleted successfully.", "success");
      setDeleteModalOpen(false);
      setLocationToDelete(null);
      await fetchLocations();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete contact location."), "error");
    } finally {
      setDeleting(false);
    }
  };

  // DataTable Columns Configuration
  const columns: Column<ContactLocationRecord>[] = [
    {
      key: "name",
      header: "Contact / Location",
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontWeight: 800, color: "#0F172A", fontSize: "13.5px" }}>
            {row.name}
          </div>
          {row.is_emergency_hotline ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#DC2626", fontSize: "11px", fontWeight: 700 }}>
              <FaExclamationCircle size={10} /> 24/7 Emergency Dispatch
            </div>
          ) : (
            <div style={{ color: "#64748B", fontSize: "11px", fontWeight: 500 }}>
              Rescue & Adoption Center
            </div>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#1E293B", fontSize: "13px" }}>
          <FaPhoneAlt size={12} style={{ color: row.is_emergency_hotline ? "#DC2626" : "#2563EB" }} />
          <span>{row.phone}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (_, row) => (
        row.email ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#475569" }}>
            <FaEnvelope size={11} style={{ color: "#94A3B8" }} />
            <a href={`mailto:${row.email}`} style={{ color: "#2563EB", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
              {row.email}
            </a>
          </div>
        ) : (
          <span style={{ color: "#94A3B8", fontSize: "12px" }}>—</span>
        )
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: "12px", color: "#334155", maxWidth: "260px" }}>
          <FaMapMarkerAlt size={12} style={{ color: "#64748B", marginTop: 2, flexShrink: 0 }} />
          <span style={{ lineHeight: 1.4 }}>{row.address}</span>
        </div>
      ),
    },
    {
      key: "operating_hours",
      header: "Operating Hours",
      render: (_, row) => (
        row.operating_hours ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#475569" }}>
            <FaClock size={11} style={{ color: "#D97706" }} />
            <span>{row.operating_hours}</span>
          </div>
        ) : (
          <span style={{ color: "#94A3B8", fontSize: "12px" }}>—</span>
        )
      ),
    },
    {
      key: "is_emergency_hotline",
      header: "Type",
      render: (_, row) => (
        row.is_emergency_hotline ? (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11.5px",
              fontWeight: 800,
              background: "#FEF2F2",
              color: "#DC2626",
              border: "1px solid #FCA5A5",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <FaShieldAlt size={10} /> Emergency Hotline
          </span>
        ) : (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "11.5px",
              fontWeight: 700,
              background: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <FaBuilding size={10} /> Contact Location
          </span>
        )
      ),
    },
    {
      key: "status",
      header: "Status",
      render: () => (
        <span
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            fontSize: "11.5px",
            fontWeight: 800,
            background: "#ECFDF5",
            color: "#059669",
            border: "1px solid #A7F3D0",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#059669",
              display: "inline-block",
            }}
          />
          Active
        </span>
      ),
    },
  ];

  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #E2E8F0",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FaPhoneAlt size={20} style={{ color: "#2563EB" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
              Contact Locations & Emergency Hotlines
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Manage public rescue contact centers, shelter addresses, and 24/7 emergency dispatch phone hotlines.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={fetchLocations}
            disabled={loading}
            style={{
              padding: "9px 15px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#334155",
              fontWeight: 700,
              fontSize: "13px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
            title="Refresh contact locations from backend database"
          >
            <FaSync className={loading ? "spin" : ""} size={12} /> Refresh
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#2563EB",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
            }}
          >
            <FaPlus size={12} /> Add Contact Location
          </button>
        </div>
      </div>

      {/* Summary Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setTypeFilter("all")}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "12.5px",
            fontWeight: 700,
            border: typeFilter === "all" ? "1px solid #2563EB" : "1px solid #E2E8F0",
            background: typeFilter === "all" ? "#2563EB" : "#F8FAFC",
            color: typeFilter === "all" ? "#FFFFFF" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          All Locations
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "999px",
              fontSize: "11px",
              background: typeFilter === "all" ? "#1D4ED8" : "#E2E8F0",
              color: typeFilter === "all" ? "#FFFFFF" : "#475569",
            }}
          >
            {locations.length}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter("hotlines")}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "12.5px",
            fontWeight: 700,
            border: typeFilter === "hotlines" ? "1px solid #DC2626" : "1px solid #E2E8F0",
            background: typeFilter === "hotlines" ? "#DC2626" : "#F8FAFC",
            color: typeFilter === "hotlines" ? "#FFFFFF" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FaShieldAlt size={10} /> Emergency Hotlines
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "999px",
              fontSize: "11px",
              background: typeFilter === "hotlines" ? "#B91C1C" : "#E2E8F0",
              color: typeFilter === "hotlines" ? "#FFFFFF" : "#475569",
            }}
          >
            {hotlineCount}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter("centers")}
          style={{
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "12.5px",
            fontWeight: 700,
            border: typeFilter === "centers" ? "1px solid #2563EB" : "1px solid #E2E8F0",
            background: typeFilter === "centers" ? "#2563EB" : "#F8FAFC",
            color: typeFilter === "centers" ? "#FFFFFF" : "#475569",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FaBuilding size={10} /> Contact Locations
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "999px",
              fontSize: "11px",
              background: typeFilter === "centers" ? "#1D4ED8" : "#E2E8F0",
              color: typeFilter === "centers" ? "#FFFFFF" : "#475569",
            }}
          >
            {centerCount}
          </span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            marginBottom: "16px",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FaExclamationCircle /> {error}
        </div>
      )}

      {/* Main DataTable with Search & Dropdown Actions */}
      <DataTable
        columns={columns}
        data={filteredLocations}
        loading={loading}
        pageSize={10}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchMaxWidth="360px"
        emptyMessage={
          searchQuery
            ? "No contact locations found matching your search query."
            : "No contact locations or hotlines configured yet."
        }
        onRowClick={(row) => handleOpenViewDetails(row)}
        renderRowActions={(row) => {
          const isDropdownOpen = activeDropdownId === row.id;
          return (
            <div
              style={{ position: "relative", display: "inline-block" }}
              ref={isDropdownOpen ? dropdownRef : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdownId(isDropdownOpen ? null : row.id);
                }}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: isDropdownOpen ? "#E2E8F0" : "#F8FAFC",
                  color: "#334155",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Location options"
              >
                <FaEllipsisV size={12} />
              </button>

              {isDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "36px",
                    zIndex: 100,
                    background: "#FFFFFF",
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    border: "1px solid #E2E8F0",
                    minWidth: "150px",
                    padding: "4px 0",
                    animation: "fadeIn 0.15s ease",
                  }}
                >
                  <button
                    onClick={() => handleOpenViewDetails(row)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#1E293B",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <FaEye size={12} style={{ color: "#2563EB" }} /> View Details
                  </button>

                  <button
                    onClick={() => handleOpenEdit(row)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#1E293B",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <FaEdit size={12} style={{ color: "#D97706" }} /> Edit
                  </button>

                  <div style={{ height: "1px", background: "#F1F5F9", margin: "4px 0" }} />

                  <button
                    onClick={() => handleOpenDelete(row)}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#DC2626",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <FaTrash size={11} style={{ color: "#DC2626" }} /> Delete
                  </button>
                </div>
              )}
            </div>
          );
        }}
      />

      {/* VIEW DETAILS MODAL */}
      {viewModalOpen && selectedLocation && (
        <Modal
          isOpen={true}
          onClose={() => setViewModalOpen(false)}
          title="Contact Location Details"
          maxWidth="560px"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
              <button
                onClick={() => setViewModalOpen(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={() => handleOpenEdit(selectedLocation)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FaEdit size={12} /> Edit
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "70vh", overflowY: "auto" }}>
            {/* Header Badge Card */}
            <div
              style={{
                background: selectedLocation.is_emergency_hotline ? "#FEF2F2" : "#EFF6FF",
                padding: "16px",
                borderRadius: "10px",
                border: selectedLocation.is_emergency_hotline ? "1px solid #FCA5A5" : "1px solid #BFDBFE",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: selectedLocation.is_emergency_hotline ? "#DC2626" : "#1D4ED8", marginBottom: 2 }}>
                    {selectedLocation.is_emergency_hotline ? "🚨 Emergency Hotline" : "🏢 Contact Location"}
                  </div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
                    {selectedLocation.name}
                  </h3>
                </div>

                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                  }}
                >
                  Active
                </span>
              </div>
            </div>

            {/* Main Key-Value Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Phone Number
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                  <FaPhoneAlt size={11} style={{ color: "#2563EB" }} />
                  {selectedLocation.phone}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Email Address
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: selectedLocation.email ? "#0F172A" : "#94A3B8" }}>
                  {selectedLocation.email ? (
                    <a href={`mailto:${selectedLocation.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>
                      {selectedLocation.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", gridColumn: "span 2" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Physical Address
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#0F172A", display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <FaMapMarkerAlt size={12} style={{ color: "#64748B", marginTop: 2, flexShrink: 0 }} />
                  <span>{selectedLocation.address}</span>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Operating Hours
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: selectedLocation.operating_hours ? "#0F172A" : "#94A3B8", display: "flex", alignItems: "center", gap: 6 }}>
                  <FaClock size={11} style={{ color: "#D97706" }} />
                  {selectedLocation.operating_hours || "—"}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Display Sort Order
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0F172A" }}>
                  {selectedLocation.sort_order ?? 0}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", gridColumn: "span 2" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Emergency Hotline
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: selectedLocation.is_emergency_hotline ? "#DC2626" : "#475569" }}>
                  {selectedLocation.is_emergency_hotline ? "Yes (Highlighted on Public Website & Emergency Banners)" : "No (Standard Location)"}
                </div>
              </div>
            </div>

            {/* Collapsible Technical Information */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setShowTechnicalInfo(!showTechnicalInfo)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#F8FAFC",
                  border: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                <span>Technical Information</span>
                {showTechnicalInfo ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
              </button>

              {showTechnicalInfo && (
                <div style={{ padding: "12px 14px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748B" }}>Record ID (UUID):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <code style={{ fontSize: "11px", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, color: "#334155" }}>
                        {selectedLocation.id}
                      </code>
                      <button
                        onClick={() => handleCopyId(selectedLocation.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: copiedId ? "#059669" : "#64748B",
                          padding: 2,
                        }}
                        title="Copy UUID"
                      >
                        {copiedId ? <FaCheck size={11} /> : <FaCopy size={11} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Created At:</span>
                    <span style={{ color: "#1E293B", fontWeight: 600 }}>
                      {selectedLocation.created_at ? formatDateTime(selectedLocation.created_at) : "—"}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Updated At:</span>
                    <span style={{ color: "#1E293B", fontWeight: 600 }}>
                      {selectedLocation.updated_at ? formatDateTime(selectedLocation.updated_at) : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setFormModalOpen(false)}
          title={formMode === "create" ? "Add Contact Location" : `Edit Location — ${editingLocation?.name}`}
          maxWidth="560px"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                disabled={submitting}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        border: "2px solid #FFF",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Saving...
                  </>
                ) : formMode === "create" ? (
                  "Create Location"
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Location / Hotline Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Kurnool Central Rescue Base Hotline"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: formErrors.name ? "1px solid #EF4444" : "1px solid #CBD5E1",
                  fontSize: 13,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              {formErrors.name && (
                <span style={{ color: "#DC2626", fontSize: "11.5px", marginTop: 2, display: "block" }}>
                  {formErrors.name}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Physical Address *
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Plot 14, Central Base Area, Kurnool, AP"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: formErrors.address ? "1px solid #EF4444" : "1px solid #CBD5E1",
                  fontSize: 13,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              {formErrors.address && (
                <span style={{ color: "#DC2626", fontSize: "11.5px", marginTop: 2, display: "block" }}>
                  {formErrors.address}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Phone Number *
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91-98765-43210"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: formErrors.phone ? "1px solid #EF4444" : "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {formErrors.phone && (
                  <span style={{ color: "#DC2626", fontSize: "11.5px", marginTop: 2, display: "block" }}>
                    {formErrors.phone}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@pawguard.example.com"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: formErrors.email ? "1px solid #EF4444" : "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {formErrors.email && (
                  <span style={{ color: "#DC2626", fontSize: "11.5px", marginTop: 2, display: "block" }}>
                    {formErrors.email}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={form.operating_hours}
                  onChange={(e) => setForm({ ...form, operating_hours: e.target.value })}
                  placeholder="e.g. 24/7 Emergency Dispatch or Mon-Sat 9am-6pm"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Display Sort Order
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 4,
                padding: "10px 12px",
                borderRadius: 6,
                background: form.is_emergency_hotline ? "#FEF2F2" : "#F8FAFC",
                border: form.is_emergency_hotline ? "1px solid #FCA5A5" : "1px solid #E2E8F0",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: form.is_emergency_hotline ? "#DC2626" : "#334155", cursor: "pointer", width: "100%" }}>
                <input
                  type="checkbox"
                  checked={form.is_emergency_hotline}
                  onChange={(e) => setForm({ ...form, is_emergency_hotline: e.target.checked })}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span>Highlight as 24/7 Primary Emergency Rescue Hotline</span>
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && locationToDelete && (
        <Modal
          isOpen={true}
          onClose={() => !deleting && setDeleteModalOpen(false)}
          title="Delete Contact Location?"
          maxWidth="460px"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {deleting ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        border: "2px solid #FFF",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <FaTrash size={11} /> Delete
                  </>
                )}
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FaExclamationTriangle size={20} />
              </div>
              <div>
                <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                  Delete Contact Location?
                </h4>
                <p style={{ margin: 0, fontSize: "13.5px", color: "#475569", lineHeight: 1.5 }}>
                  Are you sure you want to delete this contact location? This will remove it from the PawGuard contact information shown on the public website.
                </p>
              </div>
            </div>

            {/* Target Location Card */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A" }}>
                {locationToDelete.name}
              </div>
              <div style={{ fontSize: "12px", color: "#475569" }}>
                📞 {locationToDelete.phone}
              </div>
              <div style={{ fontSize: "12px", color: "#64748B" }}>
                📍 {locationToDelete.address}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CmsContactView;
