/**
 * Pipeline types for Admin Manual Creation & Public Reflection for Dogs and Lost/Found Reports.
 * Aligned with PawGuard backend OpenAPI schemas.
 */

export type DogBreedClassification = "pure" | "mix" | "unknown" | "purebred" | "indie_mix" | "hybrid";
export type DogGender = "male" | "female" | "unknown";
export type DogStatus = "shelter" | "fostered" | "clinic" | "adopted" | "rescued";
export type Species = "dog";

export interface DogProfileCreate {
  name: string;
  breed?: string;
  breed_classification?: DogBreedClassification | string;
  gender?: DogGender | string;
  status?: DogStatus | string;
  is_adoptable?: boolean;
  is_quarantine_passed?: boolean;
  photos?: string[];
  image_urls?: string[];
  photo_url?: string | null;
  age_months?: number;
  estimated_age?: string;
  weight?: number;
  weight_kg?: number;
  description?: string;
  distinctive_markers?: string;
  microchip_id?: string;
  microchip_number?: string;
  medical_notes?: string;
  medical_summary?: string;
  shelter_facility_id?: string;
  managed_facility_id?: string;
  section_id?: string;
  kennel_id?: string;
  foster_home_id?: string;
  temperament?: string;
  ear_shape?: string;
  tail_type?: string;
  color?: string;
  rescue_case_id?: string;
  [key: string]: unknown;
}

export interface DogProfileUpdate {
  name?: string;
  breed?: string;
  breed_classification?: DogBreedClassification | string;
  gender?: DogGender | string;
  status?: DogStatus | string;
  is_adoptable?: boolean;
  is_quarantine_passed?: boolean;
  photos?: string[];
  image_urls?: string[];
  photo_url?: string | null;
  age_months?: number;
  estimated_age?: string;
  weight?: number;
  weight_kg?: number;
  description?: string;
  distinctive_markers?: string;
  microchip_id?: string;
  microchip_number?: string;
  medical_notes?: string;
  medical_summary?: string;
  shelter_facility_id?: string;
  managed_facility_id?: string;
  section_id?: string;
  kennel_id?: string;
  foster_home_id?: string;
  temperament?: string;
  ear_shape?: string;
  tail_type?: string;
  color?: string;
  [key: string]: unknown;
}

export interface StoredFileResponse {
  id: string;
  filename: string;
  object_key: string;
  mime_type: string;
  file_size: number;
  folder: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_uploaded: boolean;
  download_url?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface LostReportCreate {
  pet_name?: string;
  species?: Species | string;
  breed?: string;
  breed_observed?: string;
  gender?: DogGender | string;
  color?: string;
  color_pattern?: string;
  location_address: string;
  last_seen_location?: string;
  lost_at: string;
  last_seen_date?: string;
  photo_urls?: string[];
  photo_url?: string | null;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  description?: string;
  marker_description?: string;
  microchip_id?: string;
  collar_color?: string;
  collar_description?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface FoundReportCreate {
  species?: Species | string;
  breed_observed: string;
  color_observed?: string;
  color_pattern?: string;
  color?: string;
  location_address: string;
  found_location?: string;
  found_at: string;
  found_date?: string;
  photo_urls?: string[];
  photo_url?: string | null;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  description?: string;
  notes?: string;
  marker_description?: string;
  collar_color?: string;
  collar_description?: string;
  is_safe?: boolean;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}
