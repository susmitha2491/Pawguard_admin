import { useState, useEffect, useCallback } from "react";
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
} from "react-icons/fa";

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as { response?: { data?: { detail?: unknown; message?: unknown } } };
    const detail = r?.response?.data?.detail ?? r?.response?.data?.message;
    if (typeof detail === "string" && detail) return detail;
  }
  return fallback;
};

const CmsFaqView = () => {
  const { addToast } = useToast();

  const [faqs, setFaqs] = useState<FaqRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingFaq, setEditingFaq] = useState<FaqRecord | null>(null);

  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "general",
    sort_order: 0,
    is_published: true,
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (search.trim()) params.search = search.trim();

      const res = await cmsService.getFaqs(params);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: FaqRecord[] })?.data)
        ? (res as unknown as { data: FaqRecord[] }).data
        : [];
      setFaqs(items);
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load FAQ entries from backend API."));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingFaq(null);
    setForm({
      question: "",
      answer: "",
      category: "general",
      sort_order: 0,
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
      sort_order: faq.sort_order ?? 0,
      is_published: faq.is_published ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      addToast("Question and Answer text are required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await cmsService.createFaq({
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category.trim() || "general",
          sort_order: form.sort_order,
          is_published: form.is_published,
        });
        addToast("FAQ entry created.", "success");
      } else if (editingFaq) {
        await cmsService.updateFaq(editingFaq.id, {
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category.trim() || "general",
          sort_order: form.sort_order,
          is_published: form.is_published,
        });
        addToast("FAQ entry updated.", "success");
      }
      setModalOpen(false);
      await fetchFaqs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save FAQ entry."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (faq: FaqRecord) => {
    if (!window.confirm(`Delete FAQ entry "${faq.question}"?`)) return;
    try {
      await cmsService.deleteFaq(faq.id);
      addToast("Deleted FAQ entry.", "success");
      await fetchFaqs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete FAQ entry."), "error");
    }
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #E2E8F0",
      }}
    >
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
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
            FAQ Management
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Manage Frequently Asked Questions, categories, display ordering, and publication state.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          style={{
            padding: "10px 18px",
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
          }}
        >
          <FaPlus /> Add FAQ Entry
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", minWidth: 260 }}>
          <FaSearch size={12} style={{ position: "absolute", left: 10, top: 11, color: "#94A3B8" }} />
          <input
            type="text"
            placeholder="Search FAQs by question or answer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 30px",
              borderRadius: 6,
              border: "1px solid #CBD5E1",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #CBD5E1",
            fontSize: 13,
            color: "#334155",
            fontWeight: 600,
          }}
        >
          <option value="all">All Categories</option>
          <option value="general">General</option>
          <option value="adoption">Adoption</option>
          <option value="rescue">Rescue & Emergency</option>
          <option value="shelter">Shelters</option>
          <option value="volunteering">Volunteering</option>
        </select>
      </div>

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
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Question & Answer</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Category</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Sort Order</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Published</th>
              <th style={{ padding: "12px", textAlign: "right", color: "#475569", fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#2563EB" }}>
                  <FaSpinner className="spin" size={18} /> Loading FAQ entries...
                </td>
              </tr>
            ) : faqs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                  No FAQ entries found.
                </td>
              </tr>
            ) : (
              faqs.map((faq) => (
                <tr key={faq.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px", color: "#0F172A", maxWidth: 450 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <FaQuestionCircle style={{ color: "#2563EB" }} /> {faq.question}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748B", lineHeight: 1.4 }}>
                      {faq.answer.slice(0, 100)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 4, background: "#F1F5F9", color: "#334155", fontWeight: 600, fontSize: 11.5 }}>
                      {faq.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#64748B", fontWeight: 700 }}>
                    #{faq.sort_order}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {faq.is_published ? (
                      <span style={{ color: "#059669", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                        <FaCheck /> Published
                      </span>
                    ) : (
                      <span style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                        <FaTimes /> Draft
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEditModal(faq)}
                        style={{
                          padding: "5px 9px",
                          borderRadius: 6,
                          border: "1px solid #CBD5E1",
                          background: "#F8FAFC",
                          color: "#334155",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(faq)}
                        style={{
                          padding: "5px 9px",
                          borderRadius: 6,
                          border: "1px solid #FCA5A5",
                          background: "#FEF2F2",
                          color: "#991B1B",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "create" ? "Create FAQ Entry" : "Edit FAQ Entry"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Question *
            </label>
            <input
              type="text"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="e.g. How long does the dog adoption process take?"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Answer *
            </label>
            <textarea
              rows={4}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="Detailed answer text..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
              >
                <option value="general">General</option>
                <option value="adoption">Adoption</option>
                <option value="rescue">Rescue & Emergency</option>
                <option value="shelter">Shelters</option>
                <option value="volunteering">Volunteering</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Display Sort Order
              </label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              Publish immediately on public website
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{ padding: "9px 16px", borderRadius: 6, border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              style={{ padding: "9px 18px", borderRadius: 6, border: "none", background: "#2563EB", color: "#FFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {submitting ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CmsFaqView;
