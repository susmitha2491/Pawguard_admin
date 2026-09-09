import { useState, useEffect, useCallback } from "react";
import cmsService from "../../services/cmsService";
import type { LegalDocRecord, LegalDocumentType, ContentStatus } from "../../types/cms";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaPaperPlane,
  FaSpinner,
  FaFileContract,
} from "react-icons/fa";

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as { response?: { data?: { detail?: unknown; message?: unknown } } };
    const detail = r?.response?.data?.detail ?? r?.response?.data?.message;
    if (typeof detail === "string" && detail) return detail;
  }
  return fallback;
};

const CmsLegalView = () => {
  const { addToast } = useToast();

  const [docs, setDocs] = useState<LegalDocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingDoc, setEditingDoc] = useState<LegalDocRecord | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    document_type: "terms" as LegalDocumentType,
    body: "",
    version: "1.0",
    status: "draft" as ContentStatus,
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (typeFilter !== "all") params.document_type = typeFilter;
      if (search.trim()) params.search = search.trim();

      const res = await cmsService.getLegalDocuments(params);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: LegalDocRecord[] })?.data)
        ? (res as unknown as { data: LegalDocRecord[] }).data
        : [];
      setDocs(items);
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load legal documents from backend API."));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingDoc(null);
    setForm({
      title: "",
      slug: "",
      document_type: "terms",
      body: "",
      version: "1.0",
      status: "draft",
    });
    setModalOpen(true);
  };

  const openEditModal = (doc: LegalDocRecord) => {
    setModalMode("edit");
    setEditingDoc(doc);
    setForm({
      title: doc.title || "",
      slug: doc.slug || "",
      document_type: doc.document_type || "terms",
      body: doc.body || "",
      version: doc.version || "1.0",
      status: doc.status || "draft",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.body.trim()) {
      addToast("Title, Slug, and Document Body are required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await cmsService.createLegalDocument({
          title: form.title.trim(),
          slug: form.slug.trim(),
          document_type: form.document_type,
          body: form.body.trim(),
          version: form.version.trim() || "1.0",
          status: form.status,
        });
        addToast(`Legal document "${form.title}" created.`, "success");
      } else if (editingDoc) {
        await cmsService.updateLegalDocument(editingDoc.id, {
          title: form.title.trim(),
          slug: form.slug.trim(),
          document_type: form.document_type,
          body: form.body.trim(),
          version: form.version.trim() || "1.0",
          status: form.status,
        });
        addToast(`Updated legal document "${form.title}".`, "success");
      }
      setModalOpen(false);
      await fetchDocs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save legal document."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (doc: LegalDocRecord) => {
    try {
      await cmsService.publishLegalDocument(doc.id);
      addToast(`Published legal document "${doc.title}".`, "success");
      await fetchDocs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to publish legal document."), "error");
    }
  };

  const handleDelete = async (doc: LegalDocRecord) => {
    if (!window.confirm(`Delete legal document "${doc.title}"?`)) return;
    try {
      await cmsService.deleteLegalDocument(doc.id);
      addToast(`Deleted legal document "${doc.title}".`, "success");
      await fetchDocs();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete legal document."), "error");
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
            Legal Documents & Policy Agreements
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Manage Privacy Policy, Terms of Service, Adoption Agreements, and Data Usage compliance policies.
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
          <FaPlus /> New Legal Document
        </button>
      </div>

      {/* Filters */}
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
            placeholder="Search documents by title or slug..."
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #CBD5E1",
            fontSize: 13,
            color: "#334155",
            fontWeight: 600,
          }}
        >
          <option value="all">All Document Types</option>
          <option value="terms">Terms of Service</option>
          <option value="privacy">Privacy Policy</option>
          <option value="adoption_agreement">Adoption Agreement</option>
          <option value="data_usage">Data Usage</option>
          <option value="other">Other</option>
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

      {/* Documents Table */}
      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Document Title</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Type</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Version</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px", textAlign: "right", color: "#475569", fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#2563EB" }}>
                  <FaSpinner className="spin" size={18} /> Loading legal documents...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                  No legal documents found.
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px", color: "#0F172A", fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <FaFileContract style={{ color: "#2563EB" }} />
                      <div>
                        <div>{doc.title}</div>
                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 400 }}>
                          Slug: <code>{doc.slug}</code>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 4, background: "#EFF6FF", color: "#2563EB", fontWeight: 700, fontSize: 11.5 }}>
                      {doc.document_type}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#475569", fontWeight: 700 }}>
                    v{doc.version || "1.0"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background:
                          doc.status === "published"
                            ? "#ECFDF5"
                            : doc.status === "draft"
                            ? "#FEF3C7"
                            : "#F1F5F9",
                        color:
                          doc.status === "published"
                            ? "#059669"
                            : doc.status === "draft"
                            ? "#D97706"
                            : "#475569",
                      }}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {doc.status !== "published" && (
                        <button
                          onClick={() => handlePublish(doc)}
                          style={{
                            padding: "5px 9px",
                            borderRadius: 6,
                            border: "none",
                            background: "#10B981",
                            color: "#FFF",
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <FaPaperPlane /> Publish
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(doc)}
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
                        onClick={() => handleDelete(doc)}
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

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "create" ? "Create Legal Document" : `Edit Document — ${editingDoc?.title}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Document Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. PawGuard Terms of Service"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                URL Slug *
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="terms-of-service"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Document Type
              </label>
              <select
                value={form.document_type}
                onChange={(e) => setForm({ ...form, document_type: e.target.value as LegalDocumentType })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
              >
                <option value="terms">Terms of Service</option>
                <option value="privacy">Privacy Policy</option>
                <option value="adoption_agreement">Adoption Agreement</option>
                <option value="data_usage">Data Usage</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Version
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="1.0"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Document Text Body *
            </label>
            <textarea
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Full legal document clause text..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
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
              {submitting ? "Saving..." : "Save Document"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CmsLegalView;
