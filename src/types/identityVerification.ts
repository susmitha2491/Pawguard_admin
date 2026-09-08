/**
 * Types and interfaces for Adopter Identity Verification in PawGuard Admin Web
 */

export type IdentityVerificationStatus =
  | "NOT_STARTED"
  | "OTP_PENDING"
  | "VERIFICATION_PENDING"
  | "VERIFIED"
  | "FAILED"
  | "MANUAL_REVIEW";

export type DigiLockerStatus =
  | "NOT_CONNECTED"
  | "AUTHORIZATION_REQUIRED"
  | "AUTHORIZATION_PENDING"
  | "DOCUMENT_RETRIEVAL_PENDING"
  | "DOCUMENT_RECEIVED"
  | "DOCUMENT_VERIFICATION_PENDING"
  | "VERIFIED"
  | "FAILED"
  | "MANUAL_REVIEW";

export type DocumentVerificationStatus =
  | "NOT_PROVIDED"
  | "NOT_RETRIEVED"
  | "RETRIEVAL_PENDING"
  | "VERIFICATION_PENDING"
  | "VERIFIED"
  | "FAILED"
  | "MANUAL_REVIEW";

export interface IdentityDocumentInfo {
  doc_type?: "aadhaar" | "passport" | "driving_license" | "voter_id" | "pan" | string;
  doc_label?: string;
  is_required: boolean;
  status: DocumentVerificationStatus;
  masked_identifier?: string | null;
  provider?: string | null;
  retrieved_at?: string | null;
  verified_at?: string | null;
  reference_id?: string | null;
  notes?: string | null;
}

export interface IdentityAuditTrailEntry {
  id?: string;
  event:
    | "VERIFICATION_INITIATED"
    | "OTP_VERIFICATION_ATTEMPTED"
    | "VERIFICATION_COMPLETED"
    | "VERIFICATION_FAILED"
    | "DIGILOCKER_AUTHORIZATION_INITIATED"
    | "DOCUMENT_RETRIEVAL_PENDING"
    | "DOCUMENT_RETRIEVED"
    | "DOCUMENT_VERIFICATION_COMPLETED"
    | "MANUAL_REVIEW_REQUESTED"
    | "MANUAL_REVIEW_COMPLETED"
    | string;
  event_label?: string;
  timestamp: string;
  actor?: string | null;
  notes?: string | null;
}

export interface AdopterIdentityVerification {
  application_id?: string;
  adopter_id?: string;
  verification_status: IdentityVerificationStatus;
  verification_method?: "digilocker" | "aadhaar_otp" | "manual_upload" | string;
  provider?: string | null;
  masked_identifier?: string | null;
  verification_timestamp?: string | null;
  reference_id?: string | null;
  aadhaar_status: IdentityVerificationStatus;
  digilocker_status: DigiLockerStatus;
  primary_id: IdentityDocumentInfo;
  secondary_id?: IdentityDocumentInfo | null;
  manual_review_status?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  manual_review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  audit_trail?: IdentityAuditTrailEntry[];
}
