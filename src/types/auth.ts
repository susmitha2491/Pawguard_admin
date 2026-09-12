export type UserRole =
  | "super_admin"
  | "rescue_centre_admin"
  | "rescue_coordinator"
  | "rescue_agent"
  | "veterinarian"
  | "shelter_manager"
  | "adoption_coordinator"
  | "foster_coordinator"
  | "volunteer_coordinator"
  | "inventory_manager"
  | "finance_user"
  | "volunteer"
  | "foster_family"
  | "donor"
  | "general_public_user";

export interface User {
  id?: string | number;
  email: string;
  full_name?: string;
  name?: string;
  phone?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  mfa_enabled?: boolean;
  roles?: string[];
  created_at?: string;
  updated_at?: string;
  role?: string | UserRole | Record<string, unknown>;
  role_name?: string;
  user_type?: string;
  type?: string;
  avatar?: string;
  department?: string;
}

export interface MenuItem {
  name: string;
  path: string;
  iconName: string;
  badge?: string | number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time?: string;
  created_at?: string;
  type:
    | "emergency"
    | "rescue"
    | "medical"
    | "medical_reminder"
    | "medical_updated"
    | "adoption"
    | "system"
    | "volunteer"
    | "user_created"
    | "user_updated"
    | "user_deleted"
    | "shelter_added"
    | "animal_registered"
    | "animal_updated"
    | "adoption_submitted"
    | "adoption_approved"
    | "adoption_rejected"
    | "inventory_changed"
    | "inventory_alert"
    | "certificate_generated"
    | "finance_action"
    | "role_permission_changed"
    | "donation"
    | "donation_completed"
    | "donation_received"
    | "donation_pending"
    | "donation_failed"
    | "donation_refunded"
    | "donation_receipt"
    | "receipt"
    | "80g_receipt"
    | "tax_receipt"
    | "sponsorship"
    | "sponsorship_created"
    | "sponsorship_payment"
    | "sponsorship_reminder"
    | "sponsorship_renewal"
    | "sponsorship_cancelled"
    | "sponsorship_expired"
    | "sponsored_dog_update"
    | "sponsored_dog_medical"
    | "donor_profile"
    | "contribution"
    | "contribution_update"
    | "broadcast"
    | "info"
    | "general"
    | string;
  read: boolean;
  user_id?: string;
  role_required?: string[];
  event_type?: string;
  data?: Record<string, unknown>;
  module?: string;
  is_broadcast?: boolean;
  action_url?: string | null;
}
