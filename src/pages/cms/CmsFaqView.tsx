import { useState, useEffect, useCallback, useMemo } from "react";
import cmsService from "../../services/cmsService";
import type { FaqRecord } from "../../types/cms";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaQuestionCircle,
  FaCheck,
  FaTimes,
  FaSync,
  FaFolder,
  FaSortNumericDown,
  FaGlobe,
} from "react-icons/fa";

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as {
      response?: {
        data?: {
          detail?: unknown;
          message?: unknown;
          error?: { message?: string; details?: unknown };
        };
      };
      message?: string;
    };
    const errorObj = r?.response?.data?.error;
    if (typeof errorObj?.message === "string" && errorObj.message) return errorObj.message;
    const detail = r?.response?.data?.detail ?? r?.response?.data?.message;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
    }
    if (typeof r.message === "string" && r.message) return r.message;
  }
  return fallback;
};

const FAQ_CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "general", label: "General Information" },
  { id: "adoption", label: "Dog Adoption" },
  { id: "rescue", label: "Emergency Rescue" },
  { id: "shelter", label: "Shelter Care" },
  { id: "volunteering", label: "Volunteer Program" },
  { id: "donations", label: "Donations & Finance" },
  { id: "veterinary", label: "Veterinary & Health" },
];

const CmsFaqView = () => {
  const { addToast } = useToast();

  const [rawFaqs, setRawFaqs] = useState<FaqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingFaq, setEditingFaq] = useState<FaqRecord | null>(null);

  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "general",
    sort_order: 1,
    is_published: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchFaqs = useCallback(async () => {
    try {
      setError(null);
      const res = await cmsService.getFaqs({ page_size: 100 });
      const items: FaqRecord[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: FaqRecord[] })?.data)
        ? (res as unknown as { data: FaqRecord[] }).data
        : [];
      setRawFaqs(items);
    } catch (err: unknown) {
      console.error("[CmsFaqView] Error fetching FAQs:", err);
      setError(getErrorMsg(err, "Unable to load FAQ entries from the backend API."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFaqs();
  }, [fetchFaqs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFaqs();
    addToast("FAQ data refreshed from server.", "info");
  };

  // Filtered and sorted dataset
  const filteredFaqs = useMemo(() => {
    return rawFaqs
      .filter((faq) => {
        // Search filter (question or answer)
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchQ = (faq.question || "").toLowerCase().includes(q);
          const matchA = (faq.answer || "").toLowerCase().includes(q);
          const matchCat = (faq.category || "").toLowerCase().includes(q);
          if (!matchQ && !matchA && !matchCat) return false;
        }

        // Category filter
        if (categoryFilter !== "all") {
          const cat = (faq.category || "").toLowerCase().trim();
          if (cat !== categoryFilter.toLowerCase().trim()) return false;
        }

        // Status filter
        if (statusFilter === "published" && !faq.is_published) return false;
        if (statusFilter === "draft" && faq.is_published) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort order ascending
        const orderA = typeof a.sort_order === "number" ? a.sort_order : 999;
        const orderB = typeof b.sort_order === "number" ? b.sort_order : 999;
        if (orderA !== orderB) return orderA - orderB;
        // Then by created_at descending
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
  }, [rawFaqs, search, categoryFilter, statusFilter]);

  // Summary Metrics
  const totalCount = rawFaqs.length;
  const publishedCount = useMemo(() => rawFaqs.filter((f) => f.is_published).length, [rawFaqs]);
  const draftCount = totalCount - publishedCount;

  const openCreateModal = () => {
    setModalMode("create");
    setEditingFaq(null);
    setForm({
      question: "",
      answer: "",
      category: categoryFilter !== "all" ? categoryFilter : "general",
      sort_order: (rawFaqs.length > 0 ? Math.max(...rawFaqs.map((f) => f.sort_order || 0)) + 1 : 1),
      is_published: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (faq: FaqRecord) => {
    setModalMode("edit");
    setEditingFaq(faq);
    setForm({
      question: faq.question || "",
      answer: faq.answer || "",
      category: faq.category || "general",
      sort_order: typeof faq.sort_order === "number" ? faq.sort_order : 1,
      is_published: faq.is_published ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim()) {
      addToast("Question text is required.", "error");
      return;
    }
    if (!form.answer.trim()) {
      addToast("Answer text is required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await cmsService.createFaq({
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category.trim() || "general",
          sort_order: Number(form.sort_order) || 1,
          is_published: form.is_published,
        });
        addToast("FAQ entry created and published to backend.", "success");
      } else if (editingFaq) {
        await cmsService.updateFaq(editingFaq.id, {
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category.trim() || "general",
          sort_order: Number(form.sort_order) || 1,
          is_published: form.is_published,
        });
        addToast("FAQ entry updated successfully.", "success");
      }
      setModalOpen(false);
      await fetchFaqs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save FAQ entry to backend."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (faq: FaqRecord) => {
    try {
      setTogglingId(faq.id);
      const nextStatus = !faq.is_published;
      await cmsService.updateFaq(faq.id, { is_published: nextStatus });
      addToast(
        `FAQ "${faq.question.slice(0, 30)}..." marked as ${nextStatus ? "Published" : "Draft"}.`,
        "success"
      );
      // Optimistic update
      setRawFaqs((prev) =>
        prev.map((f) => (f.id === faq.id ? { ...f, is_published: nextStatus } : f))
      );
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to update publication state."), "error");
      await fetchFaqs();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (faq: FaqRecord) => {
    if (!window.confirm(`Are you sure you want to delete the FAQ entry:\n"${faq.question}"?`)) {
      return;
    }
    try {
      await cmsService.deleteFaq(faq.id);
      addToast("FAQ entry deleted from backend.", "success");
      setRawFaqs((prev) => prev.filter((f) => f.id !== faq.id));
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete FAQ entry."), "error");
      await fetchFaqs();
    }
  };

  const formatCategoryBadge = (cat: string) => {
    const c = (cat || "general").toLowerCase();
    const map: Record<string, { label: string; bg: string; color: string }> = {
      general: { label: "General", bg: "#F1F5F9", color: "#334155" },
      adoption: { label: "Adoption", bg: "#FCE7F3", color: "#9D174D" },
      rescue: { label: "Emergency Rescue", bg: "#FEE2E2", color: "#991B1B" },
      shelter: { label: "Shelters", bg: "#FEF3C7", color: "#92400E" },
      volunteering: { label: "Volunteering", bg: "#EDE9FE", color: "#5B21B6" },
      donations: { label: "Donations", bg: "#D1FAE5", color: "#065F46" },
      veterinary: { label: "Veterinary", bg: "#E0F2FE", color: "#075985" },
    };
    const style = map[c] || { label: cat || "General", bg: "#F1F5F9", color: "#334155" };
    return (
      <span
        style={{
          padding: "3px 8px",
          borderRadius: "6px",
          background: style.bg,
          color: style.color,
          fontWeight: 700,
          fontSize: "11.5px",
          textTransform: "capitalize",
          display: "inline-block",
        }}
      >
        {style.label}
      </span>
    );
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "24px",
        borderRadius: "14px",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)",
      }}
    >
      {/* Header & Actions */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
              FAQ Management
            </h2>
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#2563EB",
                background: "#EFF6FF",
                padding: "2px 8px",
                borderRadius: "999px",
                border: "1px solid #BFDBFE",
              }}
            >
              Public Sync Active
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Create, curate, sort, and publish Frequently Asked Questions synchronized with the public PawGuard portal.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#475569",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaSync className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={openCreateModal}
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
              gap: "8px",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            }}
          >
            <FaPlus /> Add FAQ Entry
          </button>
        </div>
      </div>

      {/* Metric Quick Stats Pills */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Total FAQ Entries</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{loading ? "..." : totalCount}</div>
        </div>
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Live Published</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#15803D", marginTop: 2 }}>{loading ? "..." : publishedCount}</div>
        </div>
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400E", textTransform: "uppercase" }}>Draft / Hidden</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#B45309", marginTop: 2 }}>{loading ? "..." : draftCount}</div>
        </div>
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Active Categories</div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#1D4ED8", marginTop: 2 }}>
            {loading ? "..." : new Set(rawFaqs.map((f) => f.category || "general")).size}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
          background: "#F8FAFC",
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #E2E8F0",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 240 }}>
          <FaSearch size={12} style={{ position: "absolute", left: 12, top: 12, color: "#94A3B8" }} />
          <input
            type="text"
            placeholder="Search FAQs by question, answer text, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              boxSizing: "border-box",
              background: "#FFFFFF",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FaFolder size={12} color="#64748B" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              color: "#334155",
              fontWeight: 600,
              background: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            {FAQ_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FaGlobe size={12} color="#64748B" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              color: "#334155",
              fontWeight: 600,
              background: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            <option value="all">All States</option>
            <option value="published">Published Only</option>
            <option value="draft">Draft Only</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            marginBottom: "18px",
            fontSize: "13.5px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {error}</span>
          <button
            onClick={fetchFaqs}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #F87171",
              background: "#FFF",
              color: "#991B1B",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* FAQ Table */}
      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#475569", fontWeight: 700, width: 70 }}>Order</th>
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Question &amp; Answer</th>
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#475569", fontWeight: 700, width: 140 }}>Category</th>
              <th style={{ padding: "12px 14px", textAlign: "left", color: "#475569", fontWeight: 700, width: 130 }}>Published State</th>
              <th style={{ padding: "12px 14px", textAlign: "right", color: "#475569", fontWeight: 700, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "#2563EB" }}>
                  <FaSpinner className="spin" size={20} />
                  <div style={{ marginTop: 8, fontWeight: 600, fontSize: "13px" }}>Loading live FAQ entries from backend...</div>
                </td>
              </tr>
            ) : filteredFaqs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "#64748B" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                    No FAQ entries found.
                  </div>
                  <div style={{ fontSize: "12.5px" }}>
                    {search || categoryFilter !== "all" || statusFilter !== "all"
                      ? "No records match the selected filter criteria. Try clearing search or category filter."
                      : "No FAQ records have been created in the system yet. Click 'Add FAQ Entry' to publish one."}
                  </div>
                </td>
              </tr>
            ) : (
              filteredFaqs.map((faq) => (
                <tr key={faq.id} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.15s ease" }}>
                  <td style={{ padding: "14px", color: "#64748B", fontWeight: 800, fontSize: "12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#F1F5F9", padding: "3px 6px", borderRadius: 4 }}>
                      <FaSortNumericDown size={10} color="#94A3B8" /> #{faq.sort_order ?? 1}
                    </span>
                  </td>
                  <td style={{ padding: "14px", color: "#0F172A", maxWidth: 480 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 6, color: "#0F172A" }}>
                      <FaQuestionCircle style={{ color: "#2563EB", marginTop: 2, flexShrink: 0 }} />
                      <span>{faq.question}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.5, paddingLeft: 18 }}>
                      {faq.answer}
                    </div>
                  </td>
                  <td style={{ padding: "14px" }}>
                    {formatCategoryBadge(faq.category)}
                  </td>
                  <td style={{ padding: "14px" }}>
                    <button
                      onClick={() => handleTogglePublish(faq)}
                      disabled={togglingId === faq.id}
                      title="Click to toggle publication status"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        border: faq.is_published ? "1px solid #A7F3D0" : "1px solid #FECACA",
                        background: faq.is_published ? "#ECFDF5" : "#FEF2F2",
                        color: faq.is_published ? "#065F46" : "#991B1B",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {togglingId === faq.id ? (
                        <FaSpinner className="spin" size={11} />
                      ) : faq.is_published ? (
                        <FaCheck size={11} color="#059669" />
                      ) : (
                        <FaTimes size={11} color="#DC2626" />
                      )}
                      <span>{faq.is_published ? "Published" : "Draft"}</span>
                    </button>
                  </td>
                  <td style={{ padding: "14px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEditModal(faq)}
                        title="Edit FAQ"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #CBD5E1",
                          background: "#F8FAFC",
                          color: "#334155",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <FaEdit /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(faq)}
                        title="Delete FAQ"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #FCA5A5",
                          background: "#FEF2F2",
                          color: "#991B1B",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "create" ? "Create New FAQ Entry" : "Edit FAQ Entry"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Question *
            </label>
            <input
              type="text"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="e.g. How quickly does PawGuard respond to emergency reports?"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              maxLength={512}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Answer *
            </label>
            <textarea
              rows={4}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="Detailed clear response for public website users..."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box", lineHeight: 1.4 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, background: "#FFF" }}
              >
                {FAQ_CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Display Sort Order
              </label>
              <input
                type="number"
                min={1}
                max={999}
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 1 })}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Publish immediately to public website
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                padding: "9px 16px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#334155",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              style={{
                padding: "9px 20px",
                borderRadius: 6,
                border: "none",
                background: "#2563EB",
                color: "#FFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {submitting ? <FaSpinner className="spin" /> : null}
              {submitting ? "Saving..." : modalMode === "create" ? "Create FAQ" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CmsFaqView;
