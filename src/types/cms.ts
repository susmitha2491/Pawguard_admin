export type ContentStatus = "draft" | "published" | "archived";
export type AlertSeverity = "info" | "warning" | "critical";
export type LegalDocumentType = "terms" | "privacy" | "adoption_agreement" | "data_usage" | "other";

export interface CmsFieldResponse {
  id: string;
  field_key: string;
  field_type: string;
  published_value?: string | null;
  draft_value?: string | null;
  published_url?: string | null;
  draft_url?: string | null;
}

export interface CmsFieldUpdate {
  field_key: string;
  field_type?: string;
  value?: string | null;
}

export interface CmsSectionResponse {
  id: string;
  section_key: string;
  section_name: string;
  display_order: number;
  is_active: boolean;
  fields: CmsFieldResponse[];
}

export interface CmsSectionUpdate {
  section_key: string;
  section_name?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
  fields?: CmsFieldUpdate[] | null;
}

export interface CmsPageResponse {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  status: ContentStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  sections: CmsSectionResponse[];
}

export interface CmsPageUpdate {
  name?: string | null;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  sections?: CmsSectionUpdate[] | null;
}

export interface PublicContentResponse {
  about_us: string;
  mission: string;
  updated_at?: string | null;
}

export interface PublicContentUpdate {
  about_us: string;
  mission: string;
}

export interface SuccessStoryRecord {
  id: string;
  title: string;
  summary: string;
  body: string;
  hero_image_url?: string | null;
  dog_id?: string | null;
  status: ContentStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  slug?: string | null;
  is_featured: boolean;
  sort_order: number;
}

export interface SuccessStoryCreatePayload {
  title: string;
  summary: string;
  body: string;
  hero_image_url?: string | null;
  dog_id?: string | null;
  status?: ContentStatus;
  slug?: string | null;
  is_featured?: boolean;
  sort_order?: number;
}

export interface SuccessStoryUpdatePayload {
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  hero_image_url?: string | null;
  dog_id?: string | null;
  status?: ContentStatus | null;
  slug?: string | null;
  is_featured?: boolean | null;
  sort_order?: number | null;
}

export interface BlogPostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image_url?: string | null;
  category: string;
  status: ContentStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  tags?: string | null;
  author?: string | null;
}

export interface BlogPostCreatePayload {
  title: string;
  slug?: string | null;
  excerpt: string;
  body: string;
  cover_image_url?: string | null;
  category?: string;
  status?: ContentStatus;
  tags?: string | null;
  author?: string | null;
}

export interface BlogPostUpdatePayload {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  body?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  status?: ContentStatus | null;
  tags?: string | null;
  author?: string | null;
}

export interface FaqRecord {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaqCreatePayload {
  question: string;
  answer: string;
  category?: string;
  sort_order?: number;
  is_published?: boolean;
}

export interface FaqUpdatePayload {
  question?: string | null;
  answer?: string | null;
  category?: string | null;
  sort_order?: number | null;
  is_published?: boolean | null;
}

export interface ContactLocationRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string | null;
  operating_hours?: string | null;
  is_emergency_hotline: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContactLocationCreatePayload {
  name: string;
  address: string;
  phone: string;
  email?: string | null;
  operating_hours?: string | null;
  is_emergency_hotline?: boolean;
  sort_order?: number;
}

export interface ContactLocationUpdatePayload {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  operating_hours?: string | null;
  is_emergency_hotline?: boolean | null;
  sort_order?: number | null;
}

export interface LegalDocRecord {
  id: string;
  slug: string;
  title: string;
  document_type: LegalDocumentType;
  body: string;
  version: string;
  status: ContentStatus;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LegalDocCreatePayload {
  slug: string;
  title: string;
  document_type?: LegalDocumentType;
  body: string;
  version?: string;
  status?: ContentStatus;
}

export interface LegalDocUpdatePayload {
  slug?: string | null;
  title?: string | null;
  document_type?: LegalDocumentType | null;
  body?: string | null;
  version?: string | null;
  status?: ContentStatus | null;
}

export interface UrgentAlertRecord {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UrgentAlertCreatePayload {
  title: string;
  message: string;
  severity?: AlertSeverity;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number;
}

export interface UrgentAlertUpdatePayload {
  title?: string | null;
  message?: string | null;
  severity?: AlertSeverity | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  sort_order?: number | null;
}

export interface CmsMediaUploadPayload {
  original_filename: string;
  mime_type: string;
  file_size: number;
  folder?: string;
  entity_type?: string;
  entity_id?: string | null;
}

export interface UploadUrlResponse {
  upload_url: string;
  file_id: string;
  object_key: string;
  expires_in?: number;
}
