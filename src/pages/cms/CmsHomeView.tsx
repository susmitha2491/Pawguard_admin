import React, { useState, useEffect, useCallback } from "react";
import cmsService from "../../services/cmsService";
import type { CmsPageResponse, CmsSectionUpdate, CmsFieldUpdate } from "../../types/cms";
import { useToast } from "../../context/ToastContext";
import {
  FaHome,
  FaSave,
  FaPaperPlane,
  FaUndo,
  FaSpinner,
  FaExclamationTriangle,
  FaUpload,
  FaTrash,
  FaExternalLinkAlt,
  FaSync,
  FaCheckCircle,
  FaImage,
} from "react-icons/fa";
import axios from "axios";

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

const CmsHomeView: React.FC = () => {
  const { addToast } = useToast();
  const [activePage, setActivePage] = useState<CmsPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State for dynamic fields: section_key -> field_key -> value
  const [formFields, setFormFields] = useState<Record<string, Record<string, string>>>({});
  const [seoForm, setSeoForm] = useState({
    name: "Home Page",
    description: "Main landing page hero, mission, and emergency callouts",
    seo_title: "PawGuard - Animal Rescue & Welfare Platform",
    seo_description: "Connecting rescued animals with loving families across the community.",
    seo_keywords: "dog rescue, adoption, animal welfare, shelter",
  });

  const loadHomePage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cmsService.getCmsPageBySlug("home");
      setActivePage(data);
      setSeoForm({
        name: data.name || "Home Page",
        description: data.description || "",
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
        seo_keywords: data.seo_keywords || "",
      });

      // Build field dictionary: section_key -> field_key -> current draft/published value
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
      const msg = getErrorMsg(err, "Failed to load Home CMS page from backend.");
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadHomePage();
  }, [loadHomePage]);

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

      // 1. Request presigned upload URL from backend
      const uploadInit = await cmsService.requestCmsMediaUploadUrl({
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        folder: "cms",
      });

      if (!uploadInit?.upload_url) {
        throw new Error("Backend did not provide a presigned upload URL.");
      }

      // 2. Direct PUT binary upload to presigned storage URL
      await axios.put(uploadInit.upload_url, file, {
        headers: {
          "Content-Type": file.type,
        },
      });

      // 3. Confirm upload with backend
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

      await cmsService.updateCmsPage("home", payload);
      addToast("Home page draft saved successfully!", "success");
      await loadHomePage();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to save draft."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!activePage) return;
    if (!window.confirm("Publish Home page changes live to the public website?")) return;
    try {
      setSubmitting(true);
      await cmsService.publishCmsPage("home");
      addToast("Home page published live to public website successfully!", "success");
      await loadHomePage();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to publish page live."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!activePage) return;
    if (
      !window.confirm(
        "Are you sure you want to discard all unpublished draft edits for the Home page? This will revert to the live published version."
      )
    ) {
      return;
    }
    try {
      setSubmitting(true);
      await cmsService.discardCmsPageDraft("home");
      addToast("Unpublished draft edits discarded.", "info");
      await loadHomePage();
    } catch (err: unknown) {
      addToast(getErrorMsg(err, "Failed to discard draft."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
        }}
      >
        <FaSpinner className="spin" size={28} style={{ color: "#2563EB", marginBottom: 12 }} />
        <div style={{ fontSize: "15px", fontWeight: 600, color: "#1E293B" }}>
          Loading CMS Home Page Content...
        </div>
        <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>
          Retrieving live sections and drafts from PawGuard backend API
        </p>
      </div>
    );
  }

  if (error && !activePage) {
    return (
      <div
        style={{
          padding: "40px 24px",
          background: "#FEF2F2",
          borderRadius: "12px",
          border: "1px solid #FCA5A5",
          color: "#991B1B",
          textAlign: "center",
        }}
      >
        <FaExclamationTriangle size={36} style={{ marginBottom: 12, color: "#DC2626" }} />
        <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700 }}>
          Failed to Load Home CMS Page
        </h3>
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#7F1D1D" }}>{error}</p>
        <button
          onClick={loadHomePage}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: "8px",
            border: "none",
            background: "#DC2626",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "13.5px",
            cursor: "pointer",
          }}
        >
          <FaSync /> Retry Loading
        </button>
      </div>
    );
  }

  const isPublished = activePage?.status === "published";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Banner & Control Bar */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "20px 24px",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <FaHome size={22} style={{ color: "#2563EB" }} />
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
              {activePage?.name || "Home Page"}
            </h2>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 10px",
                borderRadius: 999,
                fontWeight: 700,
                background: isPublished ? "#ECFDF5" : "#FEF3C7",
                color: isPublished ? "#059669" : "#D97706",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <FaCheckCircle size={10} />
              {activePage?.status?.toUpperCase() || "PUBLISHED"}
            </span>
          </div>
          <span style={{ fontSize: "12.5px", color: "#64748B" }}>
            Backend Slug: <code>home</code> | API Endpoint:{" "}
            <code>/portal/admin/cms/pages/home</code>
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleDiscard}
            disabled={submitting}
            title="Revert draft changes to live published version"
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#475569",
              fontWeight: 600,
              fontSize: "13px",
              cursor: submitting ? "not-allowed" : "pointer",
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
              padding: "9px 18px",
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
              boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
            }}
          >
            {submitting ? <FaSpinner className="spin" /> : <FaSave />} Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={submitting}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#10B981",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "13px",
              cursor: submitting ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 4px rgba(16,185,129,0.2)",
            }}
          >
            {submitting ? <FaSpinner className="spin" /> : <FaPaperPlane />} Publish Live
          </button>
        </div>
      </div>

      {/* SEO & Meta Settings Section */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "20px 24px",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: "16px",
            fontWeight: 700,
            color: "#0F172A",
            borderBottom: "1px solid #F1F5F9",
            paddingBottom: "10px",
          }}
        >
          SEO & Page Metadata
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              Page Display Name
            </label>
            <input
              type="text"
              value={seoForm.name}
              onChange={(e) => setSeoForm({ ...seoForm, name: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              SEO Meta Title
            </label>
            <input
              type="text"
              value={seoForm.seo_title}
              onChange={(e) => setSeoForm({ ...seoForm, seo_title: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              SEO Meta Description
            </label>
            <textarea
              rows={2}
              value={seoForm.seo_description}
              onChange={(e) => setSeoForm({ ...seoForm, seo_description: e.target.value })}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label
              style={{
                display: "block",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              SEO Search Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={seoForm.seo_keywords}
              onChange={(e) => setSeoForm({ ...seoForm, seo_keywords: e.target.value })}
              placeholder="e.g. dog rescue, adoption, animal welfare, shelter"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #CBD5E1",
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* Content Sections Editor */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h3 style={{ margin: "0", fontSize: "17px", fontWeight: 800, color: "#0F172A" }}>
          Home Page Content Sections ({activePage?.sections?.length || 0})
        </h3>

        {!activePage?.sections || activePage.sections.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#64748B",
              background: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid #E2E8F0",
            }}
          >
            No configurable content sections found for the Home page.
          </div>
        ) : (
          activePage.sections.map((section) => (
            <div
              key={section.id || section.section_key}
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "20px",
                background: "#FFFFFF",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              {/* Section Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  paddingBottom: "12px",
                  borderBottom: "1px dashed #E2E8F0",
                }}
              >
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1E293B" }}>
                    {section.section_name || section.section_key}
                  </h4>
                  <span style={{ fontSize: "11.5px", color: "#64748B" }}>
                    Section Key: <code>{section.section_key}</code> | Display Order:{" "}
                    {section.display_order}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "11.5px",
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontWeight: 700,
                    background: section.is_active ? "#ECFDF5" : "#FEF2F2",
                    color: section.is_active ? "#059669" : "#DC2626",
                  }}
                >
                  {section.is_active ? "Active on Website" : "Disabled"}
                </span>
              </div>

              {/* Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
                    <div
                      key={field.id || field.field_key}
                      style={{
                        background: "#F8FAFC",
                        padding: "14px 16px",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <label
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#334155",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {isImageField && <FaImage style={{ color: "#3B82F6" }} />}
                          {field.field_key.replace(/_/g, " ").toUpperCase()}
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#64748B",
                              fontWeight: 500,
                              textTransform: "none",
                            }}
                          >
                            ({field.field_type})
                          </span>
                        </label>
                        {isDraftDifferent && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#D97706",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontWeight: 600,
                            }}
                          >
                            <FaExclamationTriangle size={10} /> Unpublished Draft
                          </span>
                        )}
                      </div>

                      {/* Image Field Specific UI */}
                      {isImageField ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {currentVal && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 14,
                                background: "#FFFFFF",
                                padding: "10px",
                                borderRadius: "8px",
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              <img
                                src={currentVal}
                                alt={field.field_key}
                                style={{
                                  width: "120px",
                                  height: "75px",
                                  objectFit: "cover",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                }}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#334155",
                                    wordBreak: "break-all",
                                    marginBottom: 6,
                                  }}
                                >
                                  <code>{currentVal}</code>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <a
                                    href={currentVal}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: "11.5px",
                                      color: "#2563EB",
                                      textDecoration: "none",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontWeight: 600,
                                    }}
                                  >
                                    <FaExternalLinkAlt size={10} /> View Full Image
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFieldChange(section.section_key, field.field_key, "")
                                    }
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      border: "1px solid #FCA5A5",
                                      background: "#FEF2F2",
                                      color: "#991B1B",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <FaTrash size={10} /> Remove
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
                                padding: "8px 12px",
                                borderRadius: 6,
                                border: "1px solid #CBD5E1",
                                fontSize: 13,
                                background: "#FFFFFF",
                                boxSizing: "border-box",
                              }}
                            />
                            <label
                              style={{
                                padding: "8px 14px",
                                borderRadius: 6,
                                background: "#EFF6FF",
                                border: "1px solid #BFDBFE",
                                color: "#1D4ED8",
                                fontSize: "12.5px",
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
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: "1px solid #CBD5E1",
                            fontSize: 13,
                            background: "#FFFFFF",
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
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: "1px solid #CBD5E1",
                            fontSize: 13,
                            background: "#FFFFFF",
                            boxSizing: "border-box",
                          }}
                        />
                      )}

                      {field.published_value && field.published_value !== currentVal && (
                        <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: 4 }}>
                          Live Published: <em>"{field.published_value}"</em>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CmsHomeView;
