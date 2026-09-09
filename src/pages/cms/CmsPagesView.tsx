import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import cmsService from "../../services/cmsService";
import type { CmsPageResponse, CmsSectionUpdate, CmsFieldUpdate } from "../../types/cms";
import { useToast } from "../../context/ToastContext";
import {
  FaSave,
  FaPaperPlane,
  FaUndo,
  FaSpinner,
  FaSearch,
  FaFileAlt,
  FaExclamationTriangle,
  FaUpload,
  FaTrash,
  FaExternalLinkAlt,
  FaImage,
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

const CmsPagesView = () => {
  const { addToast } = useToast();
  const [pages, setPages] = useState<CmsPageResponse[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("home");
  const [activePage, setActivePage] = useState<CmsPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form State for active editing
  const [formFields, setFormFields] = useState<Record<string, Record<string, string>>>({});
  const [seoForm, setSeoForm] = useState({
    name: "",
    description: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
  });

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await cmsService.getCmsPages();
      const list = Array.isArray(res) ? res : [];
      setPages(list);
      if (list.length > 0 && !selectedSlug) {
        setSelectedSlug(list[0].slug);
      }
    } catch (err: unknown) {
      setError(getErrorMsg(err, "Failed to load CMS pages catalog."));
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  const loadPageDetail = useCallback(async (slug: string) => {
    try {
      setDetailLoading(true);
      const data = await cmsService.getCmsPageBySlug(slug);
      setActivePage(data);
      setSeoForm({
        name: data.name || "",
        description: data.description || "",
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
        seo_keywords: data.seo_keywords || "",
      });

      // Build field dictionary: section_key -> field_key -> current value
      const fieldsMap: Record<string, Record<string, string>> = {};
      if (Array.isArray(data.sections)) {
        data.sections.forEach((sec) => {
          fieldsMap[sec.section_key] = {};
          if (Array.isArray(sec.fields)) {
            sec.fields.forEach((f) => {
              fieldsMap[sec.section_key][f.field_key] =
                f.draft_value !== undefined && f.draft_value !== null
                  ? f.draft_value
                  : f.published_value || "";
            });
          }
        });
      }
      setFormFields(fieldsMap);
    } catch (err: unknown) {
      addToast(getErrorMsg(err, `Failed to load page detail for "${slug}".`), "error");
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (selectedSlug) {
      loadPageDetail(selectedSlug);
    }
  }, [selectedSlug, loadPageDetail]);

  const handleFieldChange = (sectionKey: string, fieldKey: string, val: string) => {
    setFormFields((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [fieldKey]: val,
      },
    }));
  };

  const handleImageUpload = async (
    sectionKey: string,
    fieldKey: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select a valid image file (JPEG, PNG, WebP).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size exceeds 5MB limit.", "error");
      return;
    }

    try {
      setUploadingFieldKey(`${sectionKey}.${fieldKey}`);

      const uploadInit = await cmsService.requestCmsMediaUploadUrl({
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        folder: "cms",
      });

      if (!uploadInit?.upload_url) {
        throw new Error("Backend did not provide a presigned upload URL.");
      }

      await axios.put(uploadInit.upload_url, file, {
        headers: {
          "Content-Type": file.type,
        },
      });

      let finalUrl = uploadInit.object_key;
      if (uploadInit.file_id) {
        const confirmed = await cmsService.confirmCmsMediaUpload(uploadInit.file_id);
        if (confirmed && typeof confirmed === "object") {
          const conf = confirmed as { public_url?: string; object_key?: string };
          finalUrl = conf.public_url || conf.object_key || finalUrl;
        }
      }

      handleFieldChange(sectionKey, fieldKey, finalUrl);
      addToast("Image uploaded and linked successfully.", "success");
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to upload image file."), "error");
    } finally {
      setUploadingFieldKey(null);
      e.target.value = "";
    }
  };

  const handleSaveDraft = async () => {
    if (!activePage) return;
    try {
      setSubmitting(true);
      const sectionsUpdate: CmsSectionUpdate[] = Object.entries(formFields).map(
        ([secKey, fieldsDict]) => {
          const fieldsArray: CmsFieldUpdate[] = Object.entries(fieldsDict).map(
            ([fKey, fVal]) => ({
              field_key: fKey,
              value: fVal,
            })
          );
          return {
            section_key: secKey,
            fields: fieldsArray,
          };
        }
      );

      const payload = {
        name: seoForm.name,
        description: seoForm.description,
        seo_title: seoForm.seo_title,
        seo_description: seoForm.seo_description,
        seo_keywords: seoForm.seo_keywords,
        sections: sectionsUpdate,
      };

      await cmsService.updateCmsPage(activePage.slug, payload);
      addToast(`Draft saved successfully for page "${activePage.name || activePage.slug}".`, "success");
      await loadPageDetail(activePage.slug);
      await fetchPages();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save draft."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!activePage) return;
    try {
      setSubmitting(true);
      await cmsService.publishCmsPage(activePage.slug);
      addToast(`Page "${activePage.name || activePage.slug}" published live to public website!`, "success");
      await loadPageDetail(activePage.slug);
      await fetchPages();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to publish page."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!activePage) return;
    if (!window.confirm("Are you sure you want to discard all unpublished draft edits for this page?")) return;
    try {
      setSubmitting(true);
      await cmsService.discardCmsPageDraft(activePage.slug);
      addToast(`Unpublished draft discarded for page "${activePage.name || activePage.slug}".`, "info");
      await loadPageDetail(activePage.slug);
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to discard draft."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPages = pages.filter((p) =>
    (p.name || p.slug).toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
      {/* Left Sidebar: Pages Catalog */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          height: "fit-content",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
          CMS Pages
        </h3>

        <div style={{ position: "relative", marginBottom: "12px" }}>
          <FaSearch size={12} style={{ position: "absolute", left: 10, top: 10, color: "#94A3B8" }} />
          <input
            type="text"
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px 6px 28px",
              borderRadius: "6px",
              border: "1px solid #CBD5E1",
              fontSize: "12.5px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
            <FaSpinner className="spin" size={16} /> Loading pages...
          </div>
        ) : filteredPages.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "#94A3B8", fontSize: "12.5px" }}>
            No pages found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filteredPages.map((p) => {
              const isSelected = p.slug === selectedSlug;
              const isPublished = p.status === "published";

              return (
                <button
                  key={p.id || p.slug}
                  onClick={() => setSelectedSlug(p.slug)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: isSelected ? "#EFF6FF" : "transparent",
                    color: isSelected ? "#2563EB" : "#334155",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FaFileAlt style={{ color: isSelected ? "#2563EB" : "#94A3B8" }} />
                    <span>{p.name || p.slug}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "10.5px",
                      padding: "2px 6px",
                      borderRadius: 999,
                      fontWeight: 700,
                      background: isPublished ? "#ECFDF5" : "#FEF3C7",
                      color: isPublished ? "#059669" : "#D97706",
                    }}
                  >
                    {p.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Area: Page Section Editor */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
        }}
      >
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

        {detailLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#2563EB", fontSize: "14px" }}>
            <FaSpinner className="spin" size={24} style={{ marginBottom: 8 }} />
            <div>Loading page content...</div>
          </div>
        ) : !activePage ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
            Select a page from the left sidebar to edit its sections.
          </div>
        ) : (
          <div>
            {/* Header Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #E2E8F0",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
                  {activePage.name || activePage.slug}
                </h2>
                <span style={{ fontSize: "12px", color: "#64748B" }}>
                  Slug: <code>{activePage.slug}</code> | Status: <strong>{activePage.status}</strong>
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleDiscard}
                  disabled={submitting}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FaUndo /> Discard Draft
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FaSave /> Save Draft
                </button>
                <button
                  onClick={handlePublish}
                  disabled={submitting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#10B981",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FaPaperPlane /> Publish Live
                </button>
              </div>
            </div>

            {/* SEO & Meta Settings Section */}
            <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "10px", marginBottom: "24px", border: "1px solid #E2E8F0" }}>
              <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                Page Metadata & SEO
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Page Display Name
                  </label>
                  <input
                    type="text"
                    value={seoForm.name}
                    onChange={(e) => setSeoForm({ ...seoForm, name: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    SEO Meta Title
                  </label>
                  <input
                    type="text"
                    value={seoForm.seo_title}
                    onChange={(e) => setSeoForm({ ...seoForm, seo_title: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    SEO Meta Description
                  </label>
                  <textarea
                    rows={2}
                    value={seoForm.seo_description}
                    onChange={(e) => setSeoForm({ ...seoForm, seo_description: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Sections & Fields Editor */}
            <h4 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
              Content Sections ({activePage.sections?.length || 0})
            </h4>

            {!activePage.sections || activePage.sections.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                No configurable content sections defined for this page yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {activePage.sections.map((section) => (
                  <div
                    key={section.id || section.section_key}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "16px",
                      background: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: "1px dashed #E2E8F0",
                      }}
                    >
                      <div>
                        <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#1E293B" }}>
                          {section.section_name || section.section_key}
                        </h5>
                        <span style={{ fontSize: "11px", color: "#64748B" }}>
                          Key: <code>{section.section_key}</code>
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          background: section.is_active ? "#ECFDF5" : "#FEF2F2",
                          color: section.is_active ? "#059669" : "#DC2626",
                        }}
                      >
                        {section.is_active ? "Active Section" : "Disabled"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {section.fields?.map((field) => {
                        const currentVal =
                          formFields[section.section_key]?.[field.field_key] ??
                          field.draft_value ??
                          field.published_value ??
                          "";

                        const isDraftDifferent =
                          field.published_value &&
                          field.draft_value &&
                          field.published_value !== field.draft_value;

                        const isImageField =
                          field.field_type === "image" ||
                          field.field_key.includes("image") ||
                          field.field_key.includes("photo");

                        const isUploading = uploadingFieldKey === `${section.section_key}.${field.field_key}`;

                        return (
                          <div key={field.id || field.field_key}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                                {isImageField && <FaImage style={{ color: "#3B82F6" }} />}
                                {field.field_key.replace(/_/g, " ").toUpperCase()}
                              </label>
                              {isDraftDifferent && (
                                <span style={{ fontSize: "11px", color: "#D97706", display: "flex", alignItems: "center", gap: 4 }}>
                                  <FaExclamationTriangle size={10} /> Unpublished Draft Changes
                                </span>
                              )}
                            </div>

                            {isImageField ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {currentVal && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 12,
                                      background: "#F8FAFC",
                                      padding: "8px",
                                      borderRadius: "6px",
                                      border: "1px solid #E2E8F0",
                                    }}
                                  >
                                    <img
                                      src={currentVal}
                                      alt={field.field_key}
                                      style={{
                                        width: "100px",
                                        height: "60px",
                                        objectFit: "cover",
                                        borderRadius: "4px",
                                        border: "1px solid #CBD5E1",
                                      }}
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: "11.5px", color: "#334155", wordBreak: "break-all", marginBottom: 4 }}>
                                        <code>{currentVal}</code>
                                      </div>
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <a
                                          href={currentVal}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            fontSize: "11px",
                                            color: "#2563EB",
                                            textDecoration: "none",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            fontWeight: 600,
                                          }}
                                        >
                                          <FaExternalLinkAlt size={9} /> View
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleFieldChange(section.section_key, field.field_key, "")
                                          }
                                          style={{
                                            padding: "2px 6px",
                                            borderRadius: 4,
                                            border: "1px solid #FCA5A5",
                                            background: "#FEF2F2",
                                            color: "#991B1B",
                                            fontSize: "10.5px",
                                            fontWeight: 600,
                                            cursor: "pointer",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <FaTrash size={9} /> Remove
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div style={{ display: "flex", gap: 8 }}>
                                  <input
                                    type="text"
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleFieldChange(section.section_key, field.field_key, e.target.value)
                                    }
                                    placeholder="Image URL (https://...)"
                                    style={{
                                      flex: 1,
                                      padding: "8px 10px",
                                      borderRadius: 6,
                                      border: "1px solid #CBD5E1",
                                      fontSize: 13,
                                      boxSizing: "border-box",
                                    }}
                                  />
                                  <label
                                    style={{
                                      padding: "8px 12px",
                                      borderRadius: 6,
                                      background: "#EFF6FF",
                                      border: "1px solid #BFDBFE",
                                      color: "#1D4ED8",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      cursor: isUploading ? "not-allowed" : "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {isUploading ? (
                                      <>
                                        <FaSpinner className="spin" /> Uploading...
                                      </>
                                    ) : (
                                      <>
                                        <FaUpload /> Upload Image
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled={isUploading}
                                      onChange={(e) =>
                                        handleImageUpload(section.section_key, field.field_key, e)
                                      }
                                      style={{ display: "none" }}
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : field.field_type === "textarea" || field.field_type === "html" ? (
                              <textarea
                                rows={3}
                                value={currentVal}
                                onChange={(e) =>
                                  handleFieldChange(section.section_key, field.field_key, e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #CBD5E1",
                                  fontSize: 13,
                                  boxSizing: "border-box",
                                }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) =>
                                  handleFieldChange(section.section_key, field.field_key, e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #CBD5E1",
                                  fontSize: 13,
                                  boxSizing: "border-box",
                                }}
                              />
                            )}

                            {field.published_value && (
                              <div style={{ fontSize: "11px", color: "#64748B", marginTop: 2 }}>
                                Live Value: <em>"{field.published_value}"</em>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CmsPagesView;
