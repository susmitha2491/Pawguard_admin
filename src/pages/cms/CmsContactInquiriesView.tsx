import React, { useState, useEffect, useCallback, useMemo } from "react";
import DataTable, { type Column } from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import cmsService from "../../services/cmsService";
import { userService } from "../../services/userService";
import type {
  ContactInquiryRecord,
  ContactInquiryStatus,
  ContactInquiryRespondPayload,
} from "../../types/cms";
import {
  FaFilter,
  FaUserCheck,
  FaPaperPlane,
  FaLock,
  FaClock,
  FaCheckCircle,
  FaSpinner,
  FaExclamationCircle,
  FaInbox,
  FaReply,
  FaEye,
  FaSync,
} from "react-icons/fa";

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as { response?: { data?: { detail?: unknown; message?: unknown } } };
    const detail = r?.response?.data?.detail ?? r?.response?.data?.message;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === "string" ? d : d.msg || JSON.stringify(d))).join(", ");
    }
  }
  return fallback;
};

const STATUS_CONFIG: Record<
  ContactInquiryStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  new: { label: "New", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  in_progress: { label: "In Progress", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  waiting_for_user: { label: "Waiting for User", bg: "#F3E8FF", color: "#7E22CE", border: "#E9D5FF" },
  resolved: { label: "Resolved", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
  closed: { label: "Closed", bg: "#F1F5F9", color: "#475569", border: "#CBD5E1" },
};

interface StaffUser {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  role?: string;
}

const CmsContactInquiriesView: React.FC = () => {
  const { addToast } = useToast();

  // Inquiries List State
  const [inquiries, setInquiries] = useState<ContactInquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Staff Users for Assignment
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Selected Inquiry Detail & Response Modal State
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiryRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quick Action / In-Modal Status & Assign Submitting States
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssign, setUpdatingAssign] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");

  // Response Form State
  const [staffResponseText, setStaffResponseText] = useState("");
  const [internalNotesText, setInternalNotesText] = useState("");
  const [responseNewStatus, setResponseNewStatus] = useState<string>("");
  const [sendingResponse, setSendingResponse] = useState(false);

  // Load Staff Users once on mount
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoadingStaff(true);
        const res = await userService.getUsers({ page_size: 100 });
        const usersList: StaffUser[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
          ? res.items
          : [];
        setStaffUsers(usersList);
      } catch {
        // Staff lookup fallback - ignore silently
      } finally {
        setLoadingStaff(false);
      }
    };
    fetchStaff();
  }, []);

  // Fetch Inquiries from Backend
  const fetchInquiries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (categoryFilter && categoryFilter !== "all") {
        params.category = categoryFilter;
      }
      if (assignedFilter && assignedFilter !== "all") {
        params.assigned_to_user_id = assignedFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await cmsService.getContactInquiries(params);
      const items: ContactInquiryRecord[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: ContactInquiryRecord[] })?.data)
        ? (res as unknown as { data: ContactInquiryRecord[] }).data
        : [];

      setInquiries(items);
      const total =
        typeof res?.total === "number"
          ? res.total
          : typeof (res as unknown as { total_count?: number })?.total_count === "number"
          ? (res as unknown as { total_count: number }).total_count
          : items.length;
      setTotalCount(total);
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load contact inquiries from backend API."));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, categoryFilter, assignedFilter, search]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  // Open Inquiry Detail
  const handleOpenDetail = async (inquiry: ContactInquiryRecord) => {
    setSelectedInquiry(inquiry);
    setSelectedAssigneeId(inquiry.assigned_to_user_id || "");
    setStaffResponseText(inquiry.staff_response || "");
    setInternalNotesText(inquiry.internal_notes || "");
    setResponseNewStatus(inquiry.status);
    setDetailModalOpen(true);

    try {
      setLoadingDetail(true);
      const fresh = await cmsService.getContactInquiryById(inquiry.id);
      if (fresh) {
        setSelectedInquiry(fresh);
        setSelectedAssigneeId(fresh.assigned_to_user_id || "");
        setStaffResponseText(fresh.staff_response || "");
        setInternalNotesText(fresh.internal_notes || "");
        setResponseNewStatus(fresh.status);
      }
    } catch {
      // Keep selectedInquiry from row
    } finally {
      setLoadingDetail(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (newStatus: ContactInquiryStatus) => {
    if (!selectedInquiry) return;
    try {
      setUpdatingStatus(true);
      const updated = await cmsService.updateContactInquiryStatus(selectedInquiry.id, {
        status: newStatus,
      });
      addToast(`Inquiry status updated to "${STATUS_CONFIG[newStatus]?.label || newStatus}".`, "success");
      setSelectedInquiry((prev) => (prev ? { ...prev, ...(updated || {}), status: newStatus } : null));
      setResponseNewStatus(newStatus);
      await fetchInquiries();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update inquiry status."), "error");
      // Refresh current inquiry on error to ensure accurate state
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) setSelectedInquiry(fresh);
      } catch {}
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Assignment Change Handler
  const handleAssignChange = async (newAssigneeId: string | null) => {
    if (!selectedInquiry) return;
    try {
      setUpdatingAssign(true);
      const updated = await cmsService.assignContactInquiry(selectedInquiry.id, {
        assigned_to_user_id: newAssigneeId || null,
      });
      const assigneeName =
        staffUsers.find((u) => u.id === newAssigneeId)?.full_name ||
        staffUsers.find((u) => u.id === newAssigneeId)?.email ||
        (newAssigneeId ? "staff member" : "Unassigned");
      addToast(
        newAssigneeId ? `Inquiry assigned to ${assigneeName}.` : "Inquiry unassigned.",
        "success"
      );
      setSelectedInquiry((prev) =>
        prev
          ? {
              ...prev,
              ...(updated || {}),
              assigned_to_user_id: newAssigneeId || null,
            }
          : null
      );
      setSelectedAssigneeId(newAssigneeId || "");
      await fetchInquiries();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update inquiry assignment."), "error");
      // Refresh record on error
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) {
          setSelectedInquiry(fresh);
          setSelectedAssigneeId(fresh.assigned_to_user_id || "");
        }
      } catch {}
    } finally {
      setUpdatingAssign(false);
    }
  };

  // Send Response / Notes Handler
  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;

    if (!staffResponseText.trim() && !internalNotesText.trim() && responseNewStatus === selectedInquiry.status) {
      addToast("Please provide a staff response, internal notes, or change the status.", "info");
      return;
    }

    if (staffResponseText.length > 10000) {
      addToast("Staff response exceeds 10,000 characters limit.", "error");
      return;
    }

    if (internalNotesText.length > 10000) {
      addToast("Internal notes exceed 10,000 characters limit.", "error");
      return;
    }

    try {
      setSendingResponse(true);
      const payload: ContactInquiryRespondPayload = {};
      if (staffResponseText.trim()) payload.staff_response = staffResponseText.trim();
      if (internalNotesText.trim()) payload.internal_notes = internalNotesText.trim();
      if (responseNewStatus) payload.new_status = responseNewStatus as ContactInquiryStatus;

      const updated = await cmsService.respondToContactInquiry(selectedInquiry.id, payload);
      addToast("Response & notes saved successfully.", "success");
      setSelectedInquiry((prev) => (prev ? { ...prev, ...(updated || {}) } : null));
      await fetchInquiries();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to submit inquiry response."), "error");
      // Refresh record to display accurate state
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) setSelectedInquiry(fresh);
      } catch {}
    } finally {
      setSendingResponse(false);
    }
  };

  // Resolve Staff Display Name
  const getStaffName = (staffId?: string | null): string => {
    if (!staffId) return "Unassigned";
    const user = staffUsers.find((u) => u.id === staffId);
    if (!user) return staffId.slice(0, 8) + "...";
    return (
      user.full_name ||
      (user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "") ||
      user.email ||
      staffId
    );
  };

  // Calculate Status Summary Counts from current view or known items
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: totalCount,
      new: 0,
      in_progress: 0,
      waiting_for_user: 0,
      resolved: 0,
      closed: 0,
    };
    inquiries.forEach((item) => {
      if (counts[item.status] !== undefined) {
        counts[item.status]++;
      }
    });
    return counts;
  }, [inquiries, totalCount]);

  // Table Columns
  const columns: Column<ContactInquiryRecord>[] = [
    {
      key: "created_at",
      header: "Received Date",
      render: (_, row) => (
        <div style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>
            {new Date(row.created_at).toLocaleDateString()}
          </div>
          <div style={{ fontSize: "11px", color: "#94A3B8" }}>
            {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      ),
    },
    {
      key: "name",
      header: "Sender",
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "13px" }}>{row.name}</div>
          <div style={{ fontSize: "11.5px", color: "#64748B" }}>{row.email}</div>
          {row.phone && <div style={{ fontSize: "11px", color: "#94A3B8" }}>📞 {row.phone}</div>}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (_, row) => (
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: "11.5px",
            fontWeight: 600,
            background: "#F1F5F9",
            color: "#334155",
            textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}
        >
          {row.category ? row.category.replace(/_/g, " ") : "General"}
        </span>
      ),
    },
    {
      key: "subject",
      header: "Subject & Message",
      render: (_, row) => (
        <div style={{ maxWidth: 320 }}>
          <div
            style={{
              fontWeight: 700,
              color: "#0F172A",
              fontSize: "13px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={row.subject}
          >
            {row.subject}
          </div>
          <div
            style={{
              fontSize: "11.5px",
              color: "#64748B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.message}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (_, row) => {
        const conf = STATUS_CONFIG[row.status] || {
          label: row.status,
          bg: "#F1F5F9",
          color: "#475569",
          border: "#CBD5E1",
        };
        return (
          <span
            style={{
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 700,
              background: conf.bg,
              color: conf.color,
              border: `1px solid ${conf.border}`,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {row.status === "resolved" ? (
              <FaCheckCircle size={10} />
            ) : row.status === "in_progress" ? (
              <FaClock size={10} />
            ) : (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: conf.color,
                  display: "inline-block",
                }}
              />
            )}
            {conf.label}
          </span>
        );
      },
    },
    {
      key: "assigned_to_user_id",
      header: "Assigned Staff",
      render: (_, row) => (
        <div style={{ fontSize: "12px", color: row.assigned_to_user_id ? "#1E293B" : "#94A3B8" }}>
          {row.assigned_to_user_id ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
              <FaUserCheck style={{ color: "#2563EB" }} /> {getStaffName(row.assigned_to_user_id)}
            </span>
          ) : (
            <span>Unassigned</span>
          )}
        </div>
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
            <FaInbox size={22} style={{ color: "#2563EB" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
              Public Contact Inquiries
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Review, assign, and respond to general inquiries, rescue queries, and messages sent via the public website.
          </p>
        </div>

        <button
          onClick={fetchInquiries}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #CBD5E1",
            background: "#F8FAFC",
            color: "#334155",
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: loading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FaSync className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Status Summary Pills / Quick Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        {[
          { key: "all", label: "All Inquiries" },
          { key: "new", label: "New" },
          { key: "in_progress", label: "In Progress" },
          { key: "waiting_for_user", label: "Waiting for User" },
          { key: "resolved", label: "Resolved" },
          { key: "closed", label: "Closed" },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: "12.5px",
                fontWeight: 700,
                border: isActive ? "1px solid #2563EB" : "1px solid #E2E8F0",
                background: isActive ? "#2563EB" : "#F8FAFC",
                color: isActive ? "#FFFFFF" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.label}
              {typeof statusCounts[tab.key] === "number" && statusCounts[tab.key] > 0 && (
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontSize: "11px",
                    background: isActive ? "#1D4ED8" : "#E2E8F0",
                    color: isActive ? "#FFFFFF" : "#475569",
                  }}
                >
                  {statusCounts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
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
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FaExclamationCircle /> {error}
        </div>
      )}

      {/* Filter Toolbar (Search, Category, Staff Assignment) */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Category Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FaFilter size={11} style={{ color: "#64748B" }} />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              color: "#334155",
              fontWeight: 600,
              background: "#FFFFFF",
            }}
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="adoption">Adoption</option>
            <option value="foster">Foster</option>
            <option value="volunteer">Volunteer</option>
            <option value="donation">Donation</option>
            <option value="surrender">Surrender</option>
            <option value="partnership">Partnership</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Staff Assignment Filter */}
        {staffUsers.length > 0 && (
          <select
            value={assignedFilter}
            onChange={(e) => {
              setAssignedFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              color: "#334155",
              fontWeight: 600,
              background: "#FFFFFF",
            }}
          >
            <option value="all">All Assignees</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                Assigned: {u.full_name || u.email || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Inquiries Server-Side DataTable */}
      <DataTable
        columns={columns}
        data={inquiries}
        loading={loading}
        serverMode={true}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={(p) => setPage(p)}
        searchValue={search}
        onSearchChange={(s) => {
          setSearch(s);
          setPage(1);
        }}
        searchMaxWidth="320px"
        emptyMessage="No contact inquiries found matching the selected filters."
        renderRowActions={(row) => (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button
              onClick={() => handleOpenDetail(row)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title="View inquiry details and respond"
            >
              <FaEye /> View & Respond
            </button>
          </div>
        )}
      />

      {/* Detail & Response Modal */}
      {detailModalOpen && selectedInquiry && (
        <Modal
          isOpen={true}
          onClose={() => setDetailModalOpen(false)}
          title={`Inquiry Details: ${selectedInquiry.subject}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              maxHeight: "75vh",
              overflowY: "auto",
            }}
          >
            {loadingDetail && (
              <div style={{ fontSize: "12px", color: "#2563EB", display: "flex", alignItems: "center", gap: 6 }}>
                <FaSpinner className="spin" /> Refreshing latest status...
              </div>
            )}

            {/* Sender & Status Header Card */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                padding: "14px",
                borderRadius: "8px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                  Sender Information
                </div>
                <div style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A", marginTop: 2 }}>
                  {selectedInquiry.name}
                </div>
                <div style={{ fontSize: "12.5px", color: "#475569" }}>
                  📧 <a href={`mailto:${selectedInquiry.email}`} style={{ color: "#2563EB" }}>{selectedInquiry.email}</a>
                </div>
                {selectedInquiry.phone && (
                  <div style={{ fontSize: "12.5px", color: "#475569" }}>
                    📞 {selectedInquiry.phone}
                  </div>
                )}
                <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: 4 }}>
                  Consent given:{" "}
                  {(selectedInquiry.has_consent ?? selectedInquiry.consent) ? (
                    <span style={{ color: "#059669", fontWeight: 700 }}>✓ Yes</span>
                  ) : (
                    <span style={{ color: "#DC2626", fontWeight: 700 }}>✗ No</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                  Metadata & Status
                </div>
                <div style={{ fontSize: "12.5px", color: "#334155", marginTop: 4 }}>
                  Category: <strong>{selectedInquiry.category ? selectedInquiry.category.replace(/_/g, " ") : "General"}</strong>
                </div>
                <div style={{ fontSize: "12.5px", color: "#334155" }}>
                  Received: <strong>{new Date(selectedInquiry.created_at).toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>Status:</span>
                  <select
                    value={selectedInquiry.status}
                    disabled={updatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value as ContactInquiryStatus)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: "12px",
                      fontWeight: 700,
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_for_user">Waiting for User</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  {updatingStatus && <FaSpinner className="spin" size={12} color="#2563EB" />}
                </div>
              </div>
            </div>

            {/* Staff Assignment Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: "#334155", fontWeight: 600 }}>
                <FaUserCheck style={{ color: "#2563EB" }} /> Assigned Staff Member:
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={selectedAssigneeId}
                  disabled={updatingAssign || loadingStaff}
                  onChange={(e) => handleAssignChange(e.target.value || null)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    minWidth: 200,
                  }}
                >
                  <option value="">— Unassigned —</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email || u.id.slice(0, 8)} {u.role ? `(${u.role})` : ""}
                    </option>
                  ))}
                </select>
                {updatingAssign && <FaSpinner className="spin" size={12} color="#2563EB" />}
              </div>
            </div>

            {/* Full Inquiry Message */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 6 }}>
                Subject & Message
              </div>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A", marginBottom: 6 }}>
                  {selectedInquiry.subject}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#1E293B",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedInquiry.message}
                </div>
              </div>
            </div>

            {/* Existing Response History if already responded */}
            {selectedInquiry.staff_response && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "12.5px", color: "#065F46", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <FaCheckCircle /> Existing Staff Response (Sent to User):
                </div>
                <div style={{ fontSize: "13px", color: "#064E3B", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {selectedInquiry.staff_response}
                </div>
                {selectedInquiry.responded_at && (
                  <div style={{ fontSize: "11px", color: "#047857", marginTop: 6 }}>
                    Responded: {new Date(selectedInquiry.responded_at).toLocaleString()}
                    {selectedInquiry.responded_by_user_id && ` by staff ID: ${selectedInquiry.responded_by_user_id.slice(0, 8)}...`}
                  </div>
                )}
              </div>
            )}

            {/* Response & Notes Form */}
            <form onSubmit={handleSendResponse} style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              {/* 1. PUBLIC STAFF RESPONSE (User-Facing) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaReply /> PUBLIC STAFF RESPONSE (Sent to User via Email/Notification)
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>
                    {staffResponseText.length} / 10,000
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={10000}
                  value={staffResponseText}
                  onChange={(e) => setStaffResponseText(e.target.value)}
                  placeholder="Type your official reply to the inquiry sender..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 2. INTERNAL NOTES (Admin & Staff Only) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#991B1B", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaLock /> 🔒 INTERNAL NOTES (Admin & Staff Only — NEVER sent to user)
                  </label>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>
                    {internalNotesText.length} / 10,000
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={internalNotesText}
                  onChange={(e) => setInternalNotesText(e.target.value)}
                  placeholder="Private internal notes, investigation details, staff handoff instructions..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #FCA5A5",
                    background: "#FFFBFB",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* New Status Selection */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155" }}>
                  Set Status on Reply:
                </label>
                <select
                  value={responseNewStatus}
                  onChange={(e) => setResponseNewStatus(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_for_user">Waiting for User</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#334155",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendingResponse}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563EB",
                    color: "#FFF",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: sendingResponse ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {sendingResponse ? <FaSpinner className="spin" /> : <FaPaperPlane />}{" "}
                  Submit Response & Notes
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CmsContactInquiriesView;
