import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";
import type {
  CmsPageResponse,
  CmsPageUpdate,
  PublicContentResponse,
  PublicContentUpdate,
  SuccessStoryRecord,
  SuccessStoryCreatePayload,
  SuccessStoryUpdatePayload,
  BlogPostRecord,
  BlogPostCreatePayload,
  BlogPostUpdatePayload,
  FaqRecord,
  FaqCreatePayload,
  FaqUpdatePayload,
  ContactLocationRecord,
  ContactLocationCreatePayload,
  ContactLocationUpdatePayload,
  LegalDocRecord,
  LegalDocCreatePayload,
  LegalDocUpdatePayload,
  UrgentAlertRecord,
  UrgentAlertCreatePayload,
  UrgentAlertUpdatePayload,
  UploadUrlResponse,
  CmsMediaUploadPayload,
  ContentStatus,
} from "../types/cms";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

const unwrap = <T,>(body: unknown): T => {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (obj.data !== undefined) return obj.data as T;
  }
  return body as T;
};

const unwrapPaginated = <T,>(body: unknown): PaginatedResult<T> => {
  if (Array.isArray(body)) {
    return {
      items: body,
      total: body.length,
      page: 1,
      page_size: body.length,
      pages: 1,
    };
  }
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const meta = (obj.meta || {}) as Record<string, unknown>;
    const rawItems = Array.isArray(obj.data)
      ? (obj.data as T[])
      : Array.isArray(obj.items)
      ? (obj.items as T[])
      : [];
    const total =
      typeof meta.total === "number"
        ? meta.total
        : typeof meta.total_items === "number"
        ? meta.total_items
        : typeof obj.total === "number"
        ? obj.total
        : rawItems.length;
    const page =
      typeof meta.page === "number"
        ? meta.page
        : typeof obj.page === "number"
        ? obj.page
        : 1;
    const pageSize =
      typeof meta.page_size === "number"
        ? meta.page_size
        : typeof obj.page_size === "number"
        ? obj.page_size
        : 20;
    const pages =
      typeof meta.total_pages === "number"
        ? meta.total_pages
        : typeof obj.pages === "number"
        ? obj.pages
        : Math.ceil(total / pageSize) || 1;

    return {
      items: rawItems,
      total,
      page,
      page_size: pageSize,
      pages,
    };
  }
  return {
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    pages: 1,
  };
};

// ----------------------------------------------------
// CMS Dynamic Pages & Sections
// ----------------------------------------------------

export const getCmsPages = async (): Promise<CmsPageResponse[]> => {
  const response = await api.get("/portal/admin/cms/pages");
  return unwrap<CmsPageResponse[]>(response.data);
};

export const getCmsPageBySlug = async (slug: string): Promise<CmsPageResponse> => {
  const response = await api.get(`/portal/admin/cms/pages/${slug}`);
  return unwrap<CmsPageResponse>(response.data);
};

export const updateCmsPage = async (
  slug: string,
  payload: CmsPageUpdate
): Promise<CmsPageResponse> => {
  const response = await api.put(`/portal/admin/cms/pages/${slug}`, payload);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "CMS Page Draft Updated",
    message: `Updated draft for page "${slug}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<CmsPageResponse>(response.data);
};

export const publishCmsPage = async (slug: string): Promise<CmsPageResponse> => {
  const response = await api.post(`/portal/admin/cms/pages/${slug}/publish`);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "CMS Page Published",
    message: `Published live changes for page "${slug}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<CmsPageResponse>(response.data);
};

export const discardCmsPageDraft = async (slug: string): Promise<CmsPageResponse> => {
  const response = await api.post(`/portal/admin/cms/pages/${slug}/discard`);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "CMS Page Draft Discarded",
    message: `Discarded unpublished draft for page "${slug}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<CmsPageResponse>(response.data);
};

export const getCmsHomePage = async (): Promise<CmsPageResponse> => {
  return getCmsPageBySlug("home");
};

export const updateCmsHomePage = async (
  payload: CmsPageUpdate
): Promise<CmsPageResponse> => {
  return updateCmsPage("home", payload);
};

export const publishCmsHomePage = async (): Promise<CmsPageResponse> => {
  return publishCmsPage("home");
};

export const discardCmsHomePageDraft = async (): Promise<CmsPageResponse> => {
  return discardCmsPageDraft("home");
};

// ----------------------------------------------------
// Public Content Settings (About & Mission)
// ----------------------------------------------------

export const getPublicContent = async (): Promise<PublicContentResponse> => {
  const response = await api.get("/settings/public-content");
  return unwrap<PublicContentResponse>(response.data);
};

export const updatePublicContent = async (
  payload: PublicContentUpdate
): Promise<PublicContentResponse> => {
  const response = await api.put("/settings/public-content", payload);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "Public Content Updated",
    message: "Updated About Us and Mission content.",
    targetRoles: ["super_admin"],
  });
  return unwrap<PublicContentResponse>(response.data);
};

// ----------------------------------------------------
// Success Stories
// ----------------------------------------------------

export const getSuccessStories = async (params?: {
  status?: string;
  search?: string;
  is_featured?: boolean;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<SuccessStoryRecord>> => {
  const response = await api.get("/portal/admin/success-stories", { params });
  return unwrapPaginated<SuccessStoryRecord>(response.data);
};

export const getSuccessStoryById = async (storyId: string): Promise<SuccessStoryRecord> => {
  const response = await api.get(`/portal/admin/success-stories/${storyId}`);
  return unwrap<SuccessStoryRecord>(response.data);
};

export const createSuccessStory = async (
  payload: SuccessStoryCreatePayload
): Promise<SuccessStoryRecord> => {
  const response = await api.post("/portal/admin/success-stories", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "Success Story Created",
    message: `Created success story "${payload.title}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<SuccessStoryRecord>(response.data);
};

export const updateSuccessStory = async (
  storyId: string,
  payload: SuccessStoryUpdatePayload
): Promise<SuccessStoryRecord> => {
  const response = await api.put(`/portal/admin/success-stories/${storyId}`, payload);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "Success Story Updated",
    message: `Updated success story ${storyId}.`,
    targetRoles: ["super_admin"],
  });
  return unwrap<SuccessStoryRecord>(response.data);
};

export const deleteSuccessStory = async (storyId: string): Promise<void> => {
  await api.delete(`/portal/admin/success-stories/${storyId}`);
  await publishActionEvent({
    module: "cms",
    action: "delete",
    title: "Success Story Deleted",
    message: `Deleted success story ${storyId}.`,
    targetRoles: ["super_admin"],
  });
};

export const publishSuccessStory = async (storyId: string): Promise<SuccessStoryRecord> => {
  const response = await api.post(`/portal/admin/success-stories/${storyId}/publish`);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "Success Story Published",
    message: `Published success story ${storyId}.`,
    targetRoles: ["super_admin"],
  });
  return unwrap<SuccessStoryRecord>(response.data);
};

export const discardSuccessStory = async (storyId: string): Promise<SuccessStoryRecord> => {
  const response = await api.post(`/portal/admin/success-stories/${storyId}/discard`);
  return unwrap<SuccessStoryRecord>(response.data);
};

export const bulkDeleteSuccessStories = async (storyIds: string[]): Promise<void> => {
  await api.post("/portal/admin/success-stories/bulk/delete", { story_ids: storyIds });
};

export const bulkStatusSuccessStories = async (
  storyIds: string[],
  status: ContentStatus
): Promise<void> => {
  await api.post("/portal/admin/success-stories/bulk/status", {
    story_ids: storyIds,
    status,
  });
};

// ----------------------------------------------------
// Articles / Awareness (Blog Posts)
// ----------------------------------------------------

export const getBlogPosts = async (params?: {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<BlogPostRecord>> => {
  const response = await api.get("/portal/admin/blog", { params });
  return unwrapPaginated<BlogPostRecord>(response.data);
};

export const getBlogPostById = async (postId: string): Promise<BlogPostRecord> => {
  const response = await api.get(`/portal/admin/blog/${postId}`);
  return unwrap<BlogPostRecord>(response.data);
};

export const createBlogPost = async (
  payload: BlogPostCreatePayload
): Promise<BlogPostRecord> => {
  const response = await api.post("/portal/admin/blog", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "Blog Article Created",
    message: `Created awareness article "${payload.title}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<BlogPostRecord>(response.data);
};

export const updateBlogPost = async (
  postId: string,
  payload: BlogPostUpdatePayload
): Promise<BlogPostRecord> => {
  const response = await api.put(`/portal/admin/blog/${postId}`, payload);
  await publishActionEvent({
    module: "cms",
    action: "update",
    title: "Blog Article Updated",
    message: `Updated article ${postId}.`,
    targetRoles: ["super_admin"],
  });
  return unwrap<BlogPostRecord>(response.data);
};

export const deleteBlogPost = async (postId: string): Promise<void> => {
  await api.delete(`/portal/admin/blog/${postId}`);
  await publishActionEvent({
    module: "cms",
    action: "delete",
    title: "Blog Article Deleted",
    message: `Deleted article ${postId}.`,
    targetRoles: ["super_admin"],
  });
};

export const publishBlogPost = async (postId: string): Promise<BlogPostRecord> => {
  const response = await api.post(`/portal/admin/blog/${postId}/publish`);
  return unwrap<BlogPostRecord>(response.data);
};

export const discardBlogPost = async (postId: string): Promise<BlogPostRecord> => {
  const response = await api.post(`/portal/admin/blog/${postId}/discard`);
  return unwrap<BlogPostRecord>(response.data);
};

export const bulkDeleteBlogPosts = async (postIds: string[]): Promise<void> => {
  await api.post("/portal/admin/blog/bulk/delete", { post_ids: postIds });
};

export const bulkStatusBlogPosts = async (
  postIds: string[],
  status: ContentStatus
): Promise<void> => {
  await api.post("/portal/admin/blog/bulk/status", {
    post_ids: postIds,
    status,
  });
};

// ----------------------------------------------------
// FAQ Management
// ----------------------------------------------------

export const getFaqs = async (params?: {
  category?: string;
  is_published?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<FaqRecord>> => {
  const response = await api.get("/portal/admin/faq", { params });
  return unwrapPaginated<FaqRecord>(response.data);
};

export const getFaqById = async (entryId: string): Promise<FaqRecord> => {
  const response = await api.get(`/portal/admin/faq/${entryId}`);
  return unwrap<FaqRecord>(response.data);
};

export const createFaq = async (payload: FaqCreatePayload): Promise<FaqRecord> => {
  const response = await api.post("/portal/admin/faq", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "FAQ Entry Created",
    message: `Created FAQ question "${payload.question}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<FaqRecord>(response.data);
};

export const updateFaq = async (
  entryId: string,
  payload: FaqUpdatePayload
): Promise<FaqRecord> => {
  const response = await api.put(`/portal/admin/faq/${entryId}`, payload);
  return unwrap<FaqRecord>(response.data);
};

export const deleteFaq = async (entryId: string): Promise<void> => {
  await api.delete(`/portal/admin/faq/${entryId}`);
};

export const bulkDeleteFaqs = async (entryIds: string[]): Promise<void> => {
  await api.post("/portal/admin/faq/bulk/delete", { entry_ids: entryIds });
};

export const bulkStatusFaqs = async (
  entryIds: string[],
  is_published: boolean
): Promise<void> => {
  await api.post("/portal/admin/faq/bulk/status", {
    entry_ids: entryIds,
    is_published,
  });
};

// ----------------------------------------------------
// Contact Locations & Hotline
// ----------------------------------------------------

export const getContactLocations = async (): Promise<ContactLocationRecord[]> => {
  const response = await api.get("/portal/admin/contact");
  return unwrap<ContactLocationRecord[]>(response.data);
};

export const getContactLocationById = async (
  locationId: string
): Promise<ContactLocationRecord> => {
  const response = await api.get(`/portal/admin/contact/${locationId}`);
  return unwrap<ContactLocationRecord>(response.data);
};

export const createContactLocation = async (
  payload: ContactLocationCreatePayload
): Promise<ContactLocationRecord> => {
  const response = await api.post("/portal/admin/contact", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "Contact Location Added",
    message: `Added contact location "${payload.name}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<ContactLocationRecord>(response.data);
};

export const updateContactLocation = async (
  locationId: string,
  payload: ContactLocationUpdatePayload
): Promise<ContactLocationRecord> => {
  const response = await api.put(`/portal/admin/contact/${locationId}`, payload);
  return unwrap<ContactLocationRecord>(response.data);
};

export const deleteContactLocation = async (locationId: string): Promise<void> => {
  await api.delete(`/portal/admin/contact/${locationId}`);
};

// ----------------------------------------------------
// Legal Documents
// ----------------------------------------------------

export const getLegalDocuments = async (params?: {
  document_type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResult<LegalDocRecord>> => {
  const response = await api.get("/portal/admin/legal", { params });
  return unwrapPaginated<LegalDocRecord>(response.data);
};

export const getLegalDocumentById = async (docId: string): Promise<LegalDocRecord> => {
  const response = await api.get(`/portal/admin/legal/${docId}`);
  return unwrap<LegalDocRecord>(response.data);
};

export const createLegalDocument = async (
  payload: LegalDocCreatePayload
): Promise<LegalDocRecord> => {
  const response = await api.post("/portal/admin/legal", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "Legal Document Created",
    message: `Created legal document "${payload.title}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<LegalDocRecord>(response.data);
};

export const updateLegalDocument = async (
  docId: string,
  payload: LegalDocUpdatePayload
): Promise<LegalDocRecord> => {
  const response = await api.put(`/portal/admin/legal/${docId}`, payload);
  return unwrap<LegalDocRecord>(response.data);
};

export const deleteLegalDocument = async (docId: string): Promise<void> => {
  await api.delete(`/portal/admin/legal/${docId}`);
};

export const publishLegalDocument = async (docId: string): Promise<LegalDocRecord> => {
  const response = await api.post(`/portal/admin/legal/${docId}/publish`);
  return unwrap<LegalDocRecord>(response.data);
};

export const discardLegalDocument = async (docId: string): Promise<LegalDocRecord> => {
  const response = await api.post(`/portal/admin/legal/${docId}/discard`);
  return unwrap<LegalDocRecord>(response.data);
};

// ----------------------------------------------------
// Urgent Emergency Alerts
// ----------------------------------------------------

export const getUrgentAlerts = async (): Promise<UrgentAlertRecord[]> => {
  const response = await api.get("/portal/admin/urgent-alerts");
  return unwrap<UrgentAlertRecord[]>(response.data);
};

export const createUrgentAlert = async (
  payload: UrgentAlertCreatePayload
): Promise<UrgentAlertRecord> => {
  const response = await api.post("/portal/admin/urgent-alerts", payload);
  await publishActionEvent({
    module: "cms",
    action: "create",
    title: "Emergency Alert Broadcast",
    message: `Created urgent alert "${payload.title}".`,
    targetRoles: ["super_admin"],
  });
  return unwrap<UrgentAlertRecord>(response.data);
};

export const updateUrgentAlert = async (
  alertId: string,
  payload: UrgentAlertUpdatePayload
): Promise<UrgentAlertRecord> => {
  const response = await api.put(`/portal/admin/urgent-alerts/${alertId}`, payload);
  return unwrap<UrgentAlertRecord>(response.data);
};

export const deleteUrgentAlert = async (alertId: string): Promise<void> => {
  await api.delete(`/portal/admin/urgent-alerts/${alertId}`);
};

// ----------------------------------------------------
// CMS Media Upload Endpoint
// ----------------------------------------------------

export type { CmsMediaUploadPayload };

export interface CmsMediaUploadRequest extends Partial<CmsMediaUploadPayload> {
  // Legacy aliases
  filename?: string;
  content_type?: string;
  size_bytes?: number;
}

export const requestCmsMediaUploadUrl = async (
  payload: CmsMediaUploadRequest
): Promise<UploadUrlResponse> => {
  const backendPayload = {
    original_filename: payload.original_filename || payload.filename || "upload.jpg",
    mime_type: payload.mime_type || payload.content_type || "image/jpeg",
    file_size: payload.file_size ?? payload.size_bytes ?? 0,
    folder: payload.folder || "cms",
    entity_type: payload.entity_type || "cms",
    entity_id: payload.entity_id || null,
  };
  const response = await api.post("/portal/admin/cms/media/upload-url", backendPayload);
  return unwrap<UploadUrlResponse>(response.data);
};

export const confirmCmsMediaUpload = async (fileId: string): Promise<unknown> => {
  const response = await api.post(`/portal/admin/cms/media/${fileId}/confirm`);
  return unwrap<unknown>(response.data);
};

export const deleteCmsMedia = async (fileId: string): Promise<void> => {
  await api.delete(`/storage/${fileId}`);
};

const cmsService = {
  getCmsPages,
  getCmsPageBySlug,
  updateCmsPage,
  publishCmsPage,
  discardCmsPageDraft,
  getCmsHomePage,
  updateCmsHomePage,
  publishCmsHomePage,
  discardCmsHomePageDraft,
  getPublicContent,
  updatePublicContent,
  getSuccessStories,
  getSuccessStoryById,
  createSuccessStory,
  updateSuccessStory,
  deleteSuccessStory,
  publishSuccessStory,
  discardSuccessStory,
  bulkDeleteSuccessStories,
  bulkStatusSuccessStories,
  getBlogPosts,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  publishBlogPost,
  discardBlogPost,
  bulkDeleteBlogPosts,
  bulkStatusBlogPosts,
  getFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  bulkDeleteFaqs,
  bulkStatusFaqs,
  getContactLocations,
  getContactLocationById,
  createContactLocation,
  updateContactLocation,
  deleteContactLocation,
  getLegalDocuments,
  getLegalDocumentById,
  createLegalDocument,
  updateLegalDocument,
  deleteLegalDocument,
  publishLegalDocument,
  discardLegalDocument,
  getUrgentAlerts,
  createUrgentAlert,
  updateUrgentAlert,
  deleteUrgentAlert,
  requestCmsMediaUploadUrl,
  confirmCmsMediaUpload,
  deleteCmsMedia,
};

export default cmsService;
