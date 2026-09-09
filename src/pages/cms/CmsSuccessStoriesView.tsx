import { useState, useEffect, useCallback, useRef } from "react";
import type React from "react";
import cmsService from "../../services/cmsService";
import type { SuccessStoryRecord, ContentStatus } from "../../types/cms";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaPaperPlane,
  FaStar,
  FaSpinner,
  FaUpload,
  FaImage,
} from "react-icons/fa";

const getErrorMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === "object") {
    const r = err as {
      response?: {
        data?: {
          error?: {
            message?: string;
            details?: Array<{ loc?: (string | number)[]; msg?: string; message?: string }> | string;
          };
          detail?: string | Array<{ loc?: (string | number)[]; msg?: string }>;
          message?: string;
        };
      };
      message?: string;
    };

    const data = r?.response?.data;
    if (data) {
      if (typeof data.error?.message === "string" && data.error.message.trim()) {
        const baseMsg = data.error.message.trim();
        if (Array.isArray(data.error.details) && data.error.details.length > 0) {
          const detailMsgs = data.error.details
            .map((d) => {
              const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== "body").join(".") : "";
              const msg = d.msg || d.message || "";
              return field && msg ? `${field}: ${msg}` : msg;
            })
            .filter(Boolean);
          if (detailMsgs.length > 0 && !baseMsg.includes(detailMsgs[0])) {
            return `${baseMsg} (${detailMsgs.join(", ")})`;
          }
        }
        return baseMsg;
      }

      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const detailMsgs = data.detail
          .map((d) => {
            const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== "body").join(".") : "";
            const msg = d.msg || "";
            return field && msg ? `${field}: ${msg}` : msg;
          })
          .filter(Boolean);
        if (detailMsgs.length > 0) {
          return `Validation error: ${detailMsgs.join(", ")}`;
        }
      }

      if (typeof data.detail === "string" && data.detail.trim()) {
        return data.detail.trim();
      }
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
      }
    }

    if (typeof r.message === "string" && r.message.trim()) {
      if (!r.message.toLowerCase().includes("request failed with status code")) {
        return r.message.trim();
      }
    }
  }
  return fallback;
};

const getDisplayFileName = (urlOrKey?: string | null): string => {
  if (!urlOrKey) return "";
  try {
    const clean = urlOrKey.split("?")[0];
    const segments = clean.split("/");
    const last = segments[segments.length - 1];
    return decodeURIComponent(last) || "image.jpg";
  } catch {
    return "image.jpg";
  }
};

const CmsSuccessStoriesView = () => {
  const { addToast } = useToast();

  const [stories, setStories] = useState<SuccessStoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [featuredFilter, setFeaturedFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingStory, setEditingStory] = useState<SuccessStoryRecord | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    summary: "",
    body: "",
    hero_image_url: "",
    dog_id: "",
    is_featured: false,
    sort_order: 0,
    status: "draft" as ContentStatus,
  });

  const [submitting, setSubmitting] = useState(false);

  // Hero Image Media State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>("");
  const [mediaFileId, setMediaFileId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (statusFilter !== "all") params.status = statusFilter;
      if (featuredFilter === "featured") params.is_featured = true;
      if (featuredFilter === "standard") params.is_featured = false;
      if (search.trim()) params.search = search.trim();

      const res = await cmsService.getSuccessStories(params);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: SuccessStoryRecord[] })?.data)
        ? (res as unknown as { data: SuccessStoryRecord[] }).data
        : [];
      setStories(items);
      if (res && typeof res === "object" && typeof (res as unknown as { total?: number }).total === "number") {
        setTotal((res as unknown as { total: number }).total);
        setTotalPages((res as unknown as { pages: number }).pages || 1);
      } else {
        setTotal(items.length);
        setTotalPages(1);
      }
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load success stories from backend API."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, featuredFilter, search, page, pageSize]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingStory(null);
    setForm({
      title: "",
      slug: "",
      summary: "",
      body: "",
      hero_image_url: "",
      dog_id: "",
      is_featured: false,
      sort_order: 0,
      status: "draft",
    });
    setImagePreview(null);
    setImageFileName("");
    setMediaFileId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  };

  const openEditModal = (story: SuccessStoryRecord) => {
    setModalMode("edit");
    setEditingStory(story);
    setForm({
      title: story.title || "",
      slug: story.slug || "",
      summary: story.summary || "",
      body: story.body || "",
      hero_image_url: story.hero_image_url || "",
      dog_id: story.dog_id || "",
      is_featured: story.is_featured ?? false,
      sort_order: story.sort_order ?? 0,
      status: story.status || "draft",
    });
    setImagePreview(story.hero_image_url || null);
    setImageFileName(getDisplayFileName(story.hero_image_url));
    setMediaFileId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-uploading the same file still triggers onChange
    e.target.value = "";

    // Client-side file validation matching backend requirements
    const allowedImageMimes = ["image/jpeg", "image/png", "image/webp"];
    const mimeType = (file.type || "image/jpeg").toLowerCase();
    if (file.type && !allowedImageMimes.includes(mimeType)) {
      addToast("Only JPEG, PNG, and WebP images are allowed.", "error");
      return;
    }

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB limit for images per backend
    if (file.size > MAX_IMAGE_SIZE) {
      addToast(
        `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of 10 MB.`,
        "error"
      );
      return;
    }

    if (file.size <= 0) {
      addToast("Selected file is empty.", "error");
      return;
    }

    // Set immediate preview
    const localBlobUrl = URL.createObjectURL(file);
    setImagePreview(localBlobUrl);
    setImageFileName(file.name);

    try {
      setUploadingImage(true);
      const res = await cmsService.requestCmsMediaUploadUrl({
        original_filename: file.name,
        mime_type: mimeType,
        file_size: file.size,
        folder: "cms",
        entity_type: "success_story",
      });

      let finalKey = res.object_key;

      // Directly PUT bytes to upload_url, then confirm
      if (res.upload_url) {
        const uploadRes = await fetch(res.upload_url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(
            `Failed to upload media file to storage provider (${uploadRes.status} ${uploadRes.statusText})`
          );
        }

        if (res.file_id) {
          const confirmRes = await cmsService.confirmCmsMediaUpload(res.file_id);
          if (confirmRes && typeof confirmRes === "object" && "object_key" in confirmRes) {
            finalKey = (confirmRes as { object_key: string }).object_key || finalKey;
          }
        }
      }

      setMediaFileId(res.file_id || null);
      setForm((prev) => ({
        ...prev,
        hero_image_url: finalKey,
      }));
      addToast("Image uploaded successfully!", "success");
    } catch (err: unknown) {
      setImagePreview(form.hero_image_url || null);
      setImageFileName(getDisplayFileName(form.hero_image_url));
      addToast(getErrorMsg(err, "Failed to upload media file."), "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (uploadingImage || removingImage) return;

    try {
      setRemovingImage(true);
      if (mediaFileId) {
        await cmsService.deleteCmsMedia(mediaFileId).catch((err) => {
          console.warn("Could not delete uploaded media file from storage:", err);
        });
      }

      setForm((prev) => ({ ...prev, hero_image_url: "" }));
      setImagePreview(null);
      setImageFileName("");
      setMediaFileId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      addToast("Image removed.", "info");
    } finally {
      setRemovingImage(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim() || !form.body.trim()) {
      addToast("Title, Summary, and Body are required fields.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await cmsService.createSuccessStory({
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          summary: form.summary.trim(),
          body: form.body.trim(),
          hero_image_url: form.hero_image_url.trim() || null,
          dog_id: form.dog_id.trim() || null,
          is_featured: form.is_featured,
          sort_order: form.sort_order,
          status: form.status,
        });
        addToast(`Success story "${form.title}" created.`, "success");
      } else if (editingStory) {
        await cmsService.updateSuccessStory(editingStory.id, {
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          summary: form.summary.trim(),
          body: form.body.trim(),
          hero_image_url: form.hero_image_url.trim() || null,
          dog_id: form.dog_id.trim() || null,
          is_featured: form.is_featured,
          sort_order: form.sort_order,
          status: form.status,
        });
        addToast(`Updated story "${form.title}".`, "success");
      }
      setModalOpen(false);
      await fetchStories();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save success story."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (story: SuccessStoryRecord) => {
    try {
      await cmsService.publishSuccessStory(story.id);
      addToast(`Published success story "${story.title}".`, "success");
      await fetchStories();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to publish story."), "error");
    }
  };

  const handleDelete = async (story: SuccessStoryRecord) => {
    if (!window.confirm(`Delete success story "${story.title}" permanently?`)) return;
    try {
      await cmsService.deleteSuccessStory(story.id);
      addToast(`Deleted story "${story.title}".`, "success");
      await fetchStories();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete story."), "error");
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
      {/* Header Toolbar */}
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
            Success Stories
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Manage inspirational adoption and rescue stories showcased on the public platform.
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
          <FaPlus /> New Story
        </button>
      </div>

      {/* Filter Toolbar */}
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
            placeholder="Search stories by title or text..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #CBD5E1",
            fontSize: 13,
            color: "#334155",
            fontWeight: 600,
          }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={featuredFilter}
          onChange={(e) => {
            setFeaturedFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #CBD5E1",
            fontSize: 13,
            color: "#334155",
            fontWeight: 600,
          }}
        >
          <option value="all">All Stories</option>
          <option value="featured">Featured Only</option>
          <option value="standard">Standard Only</option>
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

      {/* Stories Table */}
      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Story Title</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Featured</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Created</th>
              <th style={{ padding: "12px", textAlign: "right", color: "#475569", fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#2563EB" }}>
                  <FaSpinner className="spin" size={18} /> Loading stories...
                </td>
              </tr>
            ) : stories.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                  No success stories found matching your filter criteria.
                </td>
              </tr>
            ) : (
              stories.map((story) => (
                <tr key={story.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px", color: "#0F172A", fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {story.hero_image_url ? (
                        <img
                          src={story.hero_image_url}
                          alt=""
                          style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            background: "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94A3B8",
                          }}
                        >
                          <FaImage />
                        </div>
                      )}
                      <div>
                        <div>{story.title}</div>
                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 400 }}>
                          {story.summary.slice(0, 60)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {story.is_featured ? (
                      <span style={{ color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 12 }}>
                        <FaStar /> Featured
                      </span>
                    ) : (
                      <span style={{ color: "#94A3B8", fontSize: 12 }}>Standard</span>
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background:
                          story.status === "published"
                            ? "#ECFDF5"
                            : story.status === "draft"
                            ? "#FEF3C7"
                            : "#F1F5F9",
                        color:
                          story.status === "published"
                            ? "#059669"
                            : story.status === "draft"
                            ? "#D97706"
                            : "#475569",
                      }}
                    >
                      {story.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#64748B", fontSize: 12 }}>
                    {new Date(story.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {story.status !== "published" && (
                        <button
                          onClick={() => handlePublish(story)}
                          title="Publish story"
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
                        onClick={() => openEditModal(story)}
                        title="Edit story"
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
                        onClick={() => handleDelete(story)}
                        title="Delete story"
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

      {/* Pagination Controls */}
      {total > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            fontSize: "12.5px",
            color: "#64748B",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} stories
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: page <= 1 ? "#F1F5F9" : "#FFFFFF",
                  color: page <= 1 ? "#94A3B8" : "#334155",
                  fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>
              <span style={{ fontWeight: 600, color: "#1E293B" }}>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: page >= totalPages ? "#F1F5F9" : "#FFFFFF",
                  color: page >= totalPages ? "#94A3B8" : "#334155",
                  fontWeight: 600,
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === "create" ? "Create New Success Story" : `Edit Story — ${editingStory?.title}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Story Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. From Stray to Star: Barnaby's Journey"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Summary Excerpt *
            </label>
            <textarea
              rows={2}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Short 1-2 sentence overview for cards..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Full Story Content *
            </label>
            <textarea
              rows={6}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Detailed narrative of rescue, treatment, foster care, and home placement..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Hero Image
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />

            {!imagePreview && !form.hero_image_url ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  padding: "9px 16px",
                  borderRadius: "6px",
                  border: "1px dashed #CBD5E1",
                  background: "#F8FAFC",
                  color: "#2563EB",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  transition: "all 0.15s ease",
                }}
              >
                {uploadingImage ? <FaSpinner className="spin" /> : <FaUpload />} Upload Image
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                }}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: "#E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid #CBD5E1",
                  }}
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Hero preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={() => {
                        // If signed URL fails or expires, preserve state but clear broken image
                      }}
                    />
                  ) : (
                    <FaImage style={{ color: "#94A3B8", fontSize: "20px" }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#1E293B",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={imageFileName || "Uploaded image"}
                  >
                    {imageFileName || "Uploaded image"}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage || removingImage}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "5px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#334155",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {uploadingImage ? <FaSpinner className="spin" /> : <FaUpload />} Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={uploadingImage || removingImage}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "5px",
                        border: "1px solid #FCA5A5",
                        background: "#FEF2F2",
                        color: "#991B1B",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {removingImage ? <FaSpinner className="spin" /> : <FaTrash />} Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13 }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                />
                Feature on Homepage
              </label>
            </div>
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
              {submitting ? "Saving..." : "Save Story"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CmsSuccessStoriesView;
