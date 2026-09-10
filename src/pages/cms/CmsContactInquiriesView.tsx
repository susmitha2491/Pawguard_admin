import React, { useState, useEffect, useCallback } from "react";
import DataTable, { type Column } from "../../components/common/DataTable";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import cmsService, { type ContactInquiryStatusCounts } from "../../services/cmsService";
import { userService } from "../../services/userService";
import type {
  ContactInquiryRecord,
  ContactInquiryStatus,
  ContactInquiryRespondPayload,
} from "../../types/cms";
import { formatDateTime } from "../../utils/dateUtils";
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
  FaEnvelope,
  FaPhoneAlt,
  FaEdit,
  FaUser,
} from "react-icons/fa";

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
      return "Contact inquiry could not be found. It may have been archived or removed.";
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
      return "Invalid request data. Please check all fields.";
    }
    if (status && status >= 500) {
      return "Server error while processing contact inquiry. Please try again.";
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

  // Status Counts across all inquiries
  const [statusCounts, setStatusCounts] = useState<ContactInquiryStatusCounts>({
    all: 0,
    new: 0,
    in_progress: 0,
    waiting_for_user: 0,
    resolved: 0,
    closed: 0,
  });

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
  const [isEditingResponse, setIsEditingResponse] = useState(false);

  // Quick Action / In-Modal Status & Assign Submitting States
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssign, setUpdatingAssign] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");

  // Response Form State
  const [staffResponseText, setStaffResponseText] = useState("");
  const [internalNotesText, setInternalNotesText] = useState("");
  const [responseNewStatus, setResponseNewStatus] = useState<ContactInquiryStatus>("in_progress");
  const [sendingResponse, setSendingResponse] = useState(false);

  // Load Staff Users once on mount
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoadingStaff(true);
        const res = await userService.getUsers({ page_size: 100 });
        const usersList: StaffUser[] = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.items)
          ? (res as any).items
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

  // Fetch Status Counts
  const fetchStatusCounts = useCallback(async () => {
    try {
      const counts = await cmsService.getContactInquiryStatusCounts();
      setStatusCounts(counts);
    } catch {
      // Fallback: keep existing counts
    }
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
    fetchStatusCounts();
  }, [fetchInquiries, fetchStatusCounts]);

  // Open Inquiry Detail & Response Modal
  const handleOpenDetail = async (inquiry: ContactInquiryRecord) => {
    setSelectedInquiry(inquiry);
    setSelectedAssigneeId(inquiry.assigned_to_user_id || "");
    setStaffResponseText(inquiry.staff_response || "");
    setInternalNotesText(inquiry.internal_notes || "");
    setResponseNewStatus(inquiry.status === "new" ? "in_progress" : inquiry.status);
    setIsEditingResponse(!inquiry.staff_response);
    setDetailModalOpen(true);

    try {
      setLoadingDetail(true);
      const fresh = await cmsService.getContactInquiryById(inquiry.id);
      if (fresh) {
        setSelectedInquiry(fresh);
        setSelectedAssigneeId(fresh.assigned_to_user_id || "");
        setStaffResponseText(fresh.staff_response || "");
        setInternalNotesText(fresh.internal_notes || "");
        setResponseNewStatus(fresh.status === "new" ? "in_progress" : fresh.status);
        setIsEditingResponse(!fresh.staff_response);
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
      await Promise.all([fetchInquiries(), fetchStatusCounts()]);
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update inquiry status."), "error");
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) setSelectedInquiry(fresh);
      } catch {
        // Silently retain current state on refresh failure
      }
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
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) {
          setSelectedInquiry(fresh);
          setSelectedAssigneeId(fresh.assigned_to_user_id || "");
        }
      } catch {
        // Silently retain current state on refresh failure
      }
    } finally {
      setUpdatingAssign(false);
    }
  };

  // Send Response / Notes Handler
  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry) return;

    if (!staffResponseText.trim() && !internalNotesText.trim() && responseNewStatus === selectedInquiry.status) {
      addToast("Please provide a staff response, internal notes, or choose a new status.", "info");
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
      const payload: ContactInquiryRespondPayload = {
        staff_response: staffResponseText.trim() || null,
        internal_notes: internalNotesText.trim() || null,
        new_status: responseNewStatus || null,
      };

      const updated = await cmsService.respondToContactInquiry(selectedInquiry.id, payload);
      addToast("Response & notes saved successfully.", "success");
      setIsEditingResponse(false);
      setSelectedInquiry((prev) =>
        prev
          ? {
              ...prev,
              ...(updated || {}),
              staff_response: staffResponseText.trim() || prev.staff_response,
              internal_notes: internalNotesText.trim() || prev.internal_notes,
              status: responseNewStatus || prev.status,
              responded_at: new Date().toISOString(),
            }
          : null
      );
      await Promise.all([fetchInquiries(), fetchStatusCounts()]);
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to submit inquiry response."), "error");
      try {
        const fresh = await cmsService.getContactInquiryById(selectedInquiry.id);
        if (fresh) setSelectedInquiry(fresh);
      } catch {
        // Silently retain current state on refresh failure
      }
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

  // Table Columns in Recommended Order
  const columns: Column<ContactInquiryRecord>[] = [
    {
      key: "name",
      header: "Sender",
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "13.5px" }}>
            {row.name || "Anonymous / Website Visitor"}
          </div>
          <div style={{ fontSize: "12px", color: "#2563EB", display: "flex", alignItems: "center", gap: 4 }}>
            <FaEnvelope size={10} style={{ color: "#94A3B8" }} />
            <a
              href={`mailto:${row.email}`}
              style={{ color: "#2563EB", textDecoration: "none" }}
              onClick={(e) => e.stopPropagation()}
            >
              {row.email}
            </a>
          </div>
          {row.phone && (
            <div style={{ fontSize: "11.5px", color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
              <FaPhoneAlt size={10} style={{ color: "#94A3B8" }} />
              <a
                href={`tel:${row.phone}`}
                style={{ color: "#475569", textDecoration: "none" }}
                onClick={(e) => e.stopPropagation()}
              >
                {row.phone}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (_, row) => (
        <span
          style={{
            padding: "4px 9px",
            borderRadius: 6,
            fontSize: "12px",
            fontWeight: 700,
            background: "#F1F5F9",
            color: "#334155",
            border: "1px solid #E2E8F0",
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
        <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 2 }}>
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
              fontSize: "12px",
              color: "#64748B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
            title={row.message}
          >
            {row.message}
          </div>
        </div>
      ),
    },
    {
      key: "assigned_to_user_id",
      header: "Assigned Staff",
      render: (_, row) => (
        <div style={{ fontSize: "12.5px" }}>
          {row.assigned_to_user_id ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, color: "#1E293B" }}>
              <FaUserCheck style={{ color: "#2563EB" }} /> {getStaffName(row.assigned_to_user_id)}
            </span>
          ) : (
            <span style={{ color: "#94A3B8", fontWeight: 500, fontStyle: "italic" }}>
              Unassigned
            </span>
          )}
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
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: "11.5px",
              fontWeight: 800,
              background: conf.bg,
              color: conf.color,
              border: `1px solid ${conf.border}`,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
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
      key: "created_at",
      header: "Received",
      render: (_, row) => (
        <div style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 600, color: "#0F172A" }}>
            {formatDateTime(row.created_at)}
          </div>
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
          onClick={() => {
            fetchInquiries();
            fetchStatusCounts();
          }}
          disabled={loading}
          style={{
            padding: "9px 15px",
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
          <FaSync className={loading ? "spin" : ""} size={12} /> Refresh
        </button>
      </div>

      {/* Status Summary Pills / Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          flexWrap: "wrap",
        }}
      >
        {[
          { key: "all", label: "All Inquiries", count: statusCounts.all },
          { key: "new", label: "New", count: statusCounts.new },
          { key: "in_progress", label: "In Progress", count: statusCounts.in_progress },
          { key: "waiting_for_user", label: "Waiting for User", count: statusCounts.waiting_for_user },
          { key: "resolved", label: "Resolved", count: statusCounts.resolved },
          { key: "closed", label: "Closed", count: statusCounts.closed },
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
              <span
                style={{
                  padding: "1px 7px",
                  borderRadius: 999,
                  fontSize: "11px",
                  background: isActive ? "#1D4ED8" : "#E2E8F0",
                  color: isActive ? "#FFFFFF" : "#475569",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error Alert with Retry */}
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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaExclamationCircle /> {error}
          </div>
          <button
            onClick={() => {
              fetchInquiries();
              fetchStatusCounts();
            }}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #F87171",
              background: "#FFFFFF",
              color: "#991B1B",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
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
            <option value="medical">Medical</option>
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
        searchMaxWidth="360px"
        emptyMessage="No contact inquiries found matching the selected filters."
        onRowClick={(row) => handleOpenDetail(row)}
        renderRowActions={(row) => (
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button
              onClick={() => handleOpenDetail(row)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#1E293B",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
              title="View inquiry details and respond"
            >
              <FaEye size={12} style={{ color: "#2563EB" }} /> View & Respond
            </button>
          </div>
        )}
      />

      {/* VIEW & RESPOND MODAL */}
      {detailModalOpen && selectedInquiry && (
        <Modal
          isOpen={true}
          onClose={() => setDetailModalOpen(false)}
          title="Contact Inquiry"
          maxWidth="680px"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, width: "100%" }}>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
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
              {isEditingResponse && (
                <button
                  type="button"
                  onClick={handleSendResponse}
                  disabled={sendingResponse}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: sendingResponse ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {sendingResponse ? (
                    <>
                      <FaSpinner className="spin" size={13} /> Sending Reply...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane size={12} /> SEND REPLY
                    </>
                  )}
                </button>
              )}
            </div>
          }
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

            {/* Subtitle & Status Header Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "#F8FAFC",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontSize: "12.5px", color: "#64748B" }}>
                Received on:{" "}
                <strong style={{ color: "#0F172A" }}>
                  {formatDateTime(selectedInquiry.created_at)}
                </strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>Status:</span>
                <select
                  value={selectedInquiry.status}
                  disabled={updatingStatus}
                  onChange={(e) => handleStatusChange(e.target.value as ContactInquiryStatus)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: "12px",
                    fontWeight: 700,
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    cursor: "pointer",
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

            {/* CUSTOMER / SENDER INFORMATION */}
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "14px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>
                Customer / Sender Information
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>Name</div>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaUser size={11} style={{ color: "#2563EB" }} />
                    {selectedInquiry.name || "Anonymous Visitor"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>Category</div>
                  <div>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "11.5px",
                        fontWeight: 700,
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        border: "1px solid #BFDBFE",
                        textTransform: "capitalize",
                        display: "inline-block",
                      }}
                    >
                      {selectedInquiry.category ? selectedInquiry.category.replace(/_/g, " ") : "General"}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>Email Address</div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      style={{ color: "#2563EB", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <FaEnvelope size={11} /> {selectedInquiry.email}
                    </a>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>Phone Number</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: selectedInquiry.phone ? "#0F172A" : "#94A3B8" }}>
                    {selectedInquiry.phone ? (
                      <a
                        href={`tel:${selectedInquiry.phone}`}
                        style={{ color: "#0F172A", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <FaPhoneAlt size={11} style={{ color: "#10B981" }} /> {selectedInquiry.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: "11.5px", color: "#64748B", borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
                Consent Status:{" "}
                {(selectedInquiry.has_consent ?? selectedInquiry.consent) ? (
                  <span style={{ color: "#059669", fontWeight: 700 }}>✓ Consent given for contact</span>
                ) : (
                  <span style={{ color: "#DC2626", fontWeight: 700 }}>✗ No consent given</span>
                )}
              </div>
            </div>

            {/* INQUIRY SECTION (Subject & Full Message) */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.5px" }}>
                Inquiry
              </div>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "8px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: "11px", color: "#64748B", marginBottom: 2 }}>Subject</div>
                <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#0F172A", marginBottom: 10 }}>
                  {selectedInquiry.subject}
                </div>

                <div style={{ fontSize: "11px", color: "#64748B", marginBottom: 2 }}>Message</div>
                <div
                  style={{
                    fontSize: "13.5px",
                    color: "#1E293B",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    background: "#FFFFFF",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  {selectedInquiry.message}
                </div>
              </div>
            </div>

            {/* WORKFLOW / ASSIGNMENT */}
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
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    minWidth: 220,
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

            {/* RESPONSE HISTORY / PREVIOUS RESPONSE */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.5px" }}>
                Response History
              </div>

              {selectedInquiry.staff_response ? (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "8px",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
                      <FaCheckCircle size={13} /> Staff Response (Sent to User)
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingResponse(!isEditingResponse)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #86EFAC",
                        background: "#FFFFFF",
                        color: "#166534",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <FaEdit size={10} /> {isEditingResponse ? "Hide Reply Composer" : "Edit Response"}
                    </button>
                  </div>

                  <div style={{ fontSize: "13.5px", color: "#14532D", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "#FFFFFF", padding: "10px 12px", borderRadius: 6, border: "1px solid #DCFCE7" }}>
                    {selectedInquiry.staff_response}
                  </div>

                  <div style={{ fontSize: "11.5px", color: "#15803D", marginTop: 8, display: "flex", gap: 12 }}>
                    {selectedInquiry.responded_at && (
                      <span>Responded: <strong>{formatDateTime(selectedInquiry.responded_at)}</strong></span>
                    )}
                    {selectedInquiry.responded_by_user_id && (
                      <span>Responded by: <strong>{getStaffName(selectedInquiry.responded_by_user_id)}</strong></span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: "#64748B",
                    fontSize: "13px",
                    fontStyle: "italic",
                  }}
                >
                  No response has been sent yet.
                </div>
              )}
            </div>

            {/* INTERNAL NOTES (IF PREVIOUSLY RECORDED) */}
            {selectedInquiry.internal_notes && !isEditingResponse && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "12px", color: "#B45309", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <FaLock size={11} /> INTERNAL NOTES (Private — Staff Only)
                </div>
                <div style={{ fontSize: "13px", color: "#78350F", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {selectedInquiry.internal_notes}
                </div>
              </div>
            )}

            {/* REPLY COMPOSER FORM (RESPOND TO USER & INTERNAL NOTES) */}
            {isEditingResponse && (
              <form
                onSubmit={handleSendResponse}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  borderTop: "2px solid #E2E8F0",
                  paddingTop: 16,
                }}
              >
                {/* 1. PUBLIC STAFF RESPONSE */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: "13px", fontWeight: 800, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 6 }}>
                      <FaReply /> RESPOND TO USER
                    </label>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      {staffResponseText.length} / 10,000
                    </span>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: "11.5px", color: "#64748B" }}>
                    Staff Response — This message will be sent to the user via email / portal communication.
                  </p>
                  <textarea
                    rows={4}
                    maxLength={10000}
                    value={staffResponseText}
                    onChange={(e) => setStaffResponseText(e.target.value)}
                    placeholder="Write your response to the user..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid #93C5FD",
                      fontSize: 13,
                      boxSizing: "border-box",
                      outline: "none",
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* 2. INTERNAL NOTES */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontSize: "13px", fontWeight: 800, color: "#991B1B", display: "flex", alignItems: "center", gap: 6 }}>
                      <FaLock /> INTERNAL NOTES (Optional / Private)
                    </label>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      {internalNotesText.length} / 10,000
                    </span>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: "11.5px", color: "#64748B" }}>
                    Visible only to PawGuard staff (never sent to user).
                  </p>
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={internalNotesText}
                    onChange={(e) => setInternalNotesText(e.target.value)}
                    placeholder="Add internal notes for staff..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: "1px solid #FCA5A5",
                      background: "#FFFBFB",
                      fontSize: 13,
                      boxSizing: "border-box",
                      outline: "none",
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Set Status on Reply */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#334155" }}>
                    Set Status on Reply:
                  </label>
                  <select
                    value={responseNewStatus}
                    onChange={(e) => setResponseNewStatus(e.target.value as ContactInquiryStatus)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      fontWeight: 700,
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_for_user">Waiting for User</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CmsContactInquiriesView;
