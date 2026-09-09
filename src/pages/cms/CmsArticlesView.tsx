import { useState, useEffect, useCallback, useRef } from "react";
import type React from "react";
import cmsService from "../../services/cmsService";
import type { BlogPostRecord, ContentStatus } from "../../types/cms";
import Modal from "../../components/common/Modal";
import { useToast } from "../../context/ToastContext";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaPaperPlane,
  FaSpinner,
  FaUpload,
  FaNewspaper,
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

const CmsArticlesView = () => {
  const { addToast } = useToast();

  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPost, setEditingPost] = useState<BlogPostRecord | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    cover_image_url: "",
    category: "general",
    tags: "",
    author: "PawGuard Editorial",
    status: "draft" as ContentStatus,
  });

  const [submitting, setSubmitting] = useState(false);

  // Cover Image Media State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>("");
  const [mediaFileId, setMediaFileId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, unknown> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await cmsService.getBlogPosts(params);
      const items = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray((res as unknown as { data?: BlogPostRecord[] })?.data)
        ? (res as unknown as { data: BlogPostRecord[] }).data
        : [];
      setPosts(items);
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load awareness articles from backend API."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingPost(null);
    setForm({
      title: "",
      slug: "",
      excerpt: "",
      body: "",
      cover_image_url: "",
      category: "general",
      tags: "",
      author: "PawGuard Editorial",
      status: "draft",
    });
    setImagePreview(null);
    setImageFileName("");
    setMediaFileId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setModalOpen(true);
  };

  const openEditModal = (post: BlogPostRecord) => {
    setModalMode("edit");
    setEditingPost(post);
    setForm({
      title: post.title || "",
      slug: post.slug || "",
      excerpt: post.excerpt || "",
      body: post.body || "",
      cover_image_url: post.cover_image_url || "",
      category: post.category || "general",
      tags: post.tags || "",
      author: post.author || "PawGuard Editorial",
      status: post.status || "draft",
    });
    setImagePreview(post.cover_image_url || null);
    setImageFileName(getDisplayFileName(post.cover_image_url));
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
        entity_type: "blog",
      });

      let finalKey = res.object_key;

      if (res.upload_url) {
        const uploadRes = await fetch(res.upload_url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(
            `Failed to upload cover media to storage provider (${uploadRes.status} ${uploadRes.statusText})`
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
        cover_image_url: finalKey,
      }));
      addToast("Cover image uploaded successfully!", "success");
    } catch (err: unknown) {
      setImagePreview(form.cover_image_url || null);
      setImageFileName(getDisplayFileName(form.cover_image_url));
      addToast(getErrorMsg(err, "Failed to upload cover media."), "error");
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
          console.warn("Could not delete uploaded cover media from storage:", err);
        });
      }

      setForm((prev) => ({ ...prev, cover_image_url: "" }));
      setImagePreview(null);
      setImageFileName("");
      setMediaFileId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      addToast("Cover image removed.", "info");
    } finally {
      setRemovingImage(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.excerpt.trim() || !form.body.trim()) {
      addToast("Title, Excerpt, and Body text are required.", "error");
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === "create") {
        await cmsService.createBlogPost({
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          excerpt: form.excerpt.trim(),
          body: form.body.trim(),
          cover_image_url: form.cover_image_url.trim() || null,
          category: form.category.trim() || "general",
          tags: form.tags.trim() || null,
          author: form.author.trim() || null,
          status: form.status,
        });
        addToast(`Article "${form.title}" created.`, "success");
      } else if (editingPost) {
        await cmsService.updateBlogPost(editingPost.id, {
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          excerpt: form.excerpt.trim(),
          body: form.body.trim(),
          cover_image_url: form.cover_image_url.trim() || null,
          category: form.category.trim() || "general",
          tags: form.tags.trim() || null,
          author: form.author.trim() || null,
          status: form.status,
        });
        addToast(`Updated article "${form.title}".`, "success");
      }
      setModalOpen(false);
      await fetchPosts();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save article."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (post: BlogPostRecord) => {
    try {
      await cmsService.publishBlogPost(post.id);
      addToast(`Published article "${post.title}".`, "success");
      await fetchPosts();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to publish article."), "error");
    }
  };

  const handleDelete = async (post: BlogPostRecord) => {
    if (!window.confirm(`Delete article "${post.title}" permanently?`)) return;
    try {
      await cmsService.deleteBlogPost(post.id);
      addToast(`Deleted article "${post.title}".`, "success");
      await fetchPosts();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to delete article."), "error");
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
      {/* Toolbar */}
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
            Articles & Awareness Hub
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
            Publish educational articles, stray welfare awareness guides, and community announcements.
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
          <FaPlus /> New Article
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
            placeholder="Search articles by title or keyword..."
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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

      {/* Articles Table */}
      <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Article Title</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Category</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Author</th>
              <th style={{ padding: "12px", textAlign: "left", color: "#475569", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "12px", textAlign: "right", color: "#475569", fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#2563EB" }}>
                  <FaSpinner className="spin" size={18} /> Loading articles...
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748B" }}>
                  No awareness articles found.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px", color: "#0F172A", fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {post.cover_image_url ? (
                        <img
                          src={post.cover_image_url}
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
                          <FaNewspaper />
                        </div>
                      )}
                      <div>
                        <div>{post.title}</div>
                        <div style={{ fontSize: "11px", color: "#64748B", fontWeight: 400 }}>
                          Slug: <code>{post.slug}</code>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px", color: "#334155", fontWeight: 600 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: "#EFF6FF", color: "#2563EB", fontSize: 11.5 }}>
                      {post.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px", color: "#64748B", fontSize: 12 }}>
                    {post.author || "Editorial"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background:
                          post.status === "published"
                            ? "#ECFDF5"
                            : post.status === "draft"
                            ? "#FEF3C7"
                            : "#F1F5F9",
                        color:
                          post.status === "published"
                            ? "#059669"
                            : post.status === "draft"
                            ? "#D97706"
                            : "#475569",
                      }}
                    >
                      {post.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {post.status !== "published" && (
                        <button
                          onClick={() => handlePublish(post)}
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
                        onClick={() => openEditModal(post)}
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
                        onClick={() => handleDelete(post)}
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
        title={modalMode === "create" ? "Create Awareness Article" : `Edit Article — ${editingPost?.title}`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Article Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Essential Rabies Vaccination & Prevention Guide"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Category
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="health, adoption, safety..."
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Author
              </label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Excerpt / Summary *
            </label>
            <textarea
              rows={2}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short summary for article cards..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Full Body Content *
            </label>
            <textarea
              rows={7}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Detailed article body..."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Cover Image
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />

            {!imagePreview && !form.cover_image_url ? (
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
                {uploadingImage ? <FaSpinner className="spin" /> : <FaUpload />} Upload Cover Image
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
                      alt="Cover preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={() => {
                        // If image fails to load
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
                    title={imageFileName || "Uploaded cover image"}
                  >
                    {imageFileName || "Uploaded cover image"}
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
              {submitting ? "Saving..." : "Save Article"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CmsArticlesView;
