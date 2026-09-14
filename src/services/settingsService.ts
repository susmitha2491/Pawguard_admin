import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";

export interface GeneralSettingsPayload {
  platform_name?: string;
  support_email?: string;
  emergency_hotline?: string;
  timezone?: string;
  default_language?: string;
  [key: string]: unknown;
}

export interface PasswordPolicyPayload {
  min_length?: number;
  require_special_char?: boolean;
  require_special?: boolean;
  require_numbers?: boolean;
  require_digit?: boolean;
  require_uppercase?: boolean;
  require_lowercase?: boolean;
  max_age_days?: number;
  password_history_count?: number;
  max_login_attempts?: number;
  lockout_duration_minutes?: number;
  is_active?: boolean;
  session_timeout_minutes?: number;
  totp_mfa_required_for_admins?: boolean;
  [key: string]: unknown;
}

export interface BusinessRulesPayload {
  max_foster_animals_per_family?: number;
  quarantine_period_days?: number;
  rescue_dispatch_timeout_minutes?: number;
  auto_archive_tickets_days?: number;
  rule_value?: string;
  description?: string;
  module?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface EmailSettingsPayload {
  mail_host?: string;
  mail_port?: number;
  mail_from?: string;
  mail_use_tls?: boolean;
  mail_username?: string;
  mail_password?: string;
  smtp_server?: string;
  smtp_port?: number;
  sender_email?: string;
  enable_email_alerts?: boolean;
  [key: string]: unknown;
}

export const settingsService = {
  // GET /settings/system
  getSystemSettings: async () => {
    const response = await api.get("/settings/system");
    return response.data;
  },

  // PUT /settings/system
  updateSystemSettings: async (settings: Record<string, unknown>) => {
    const response = await api.put("/settings/system", settings);
    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "System Settings Modified",
      message: "Global system settings updated by Super Admin.",
      targetRoles: ["super_admin"],
    });
    return response.data;
  },

  // GET /settings/general
  getGeneralSettings: async () => {
    const response = await api.get("/settings/general");
    return response.data;
  },

  // PUT /settings/general
  updateGeneralSettings: async (payload: GeneralSettingsPayload) => {
    const response = await api.put("/settings/general", payload);
    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "General Platform Settings Updated",
      message: "General platform configuration updated.",
      targetRoles: ["super_admin"],
    });
    return response.data;
  },

  // GET /settings/password-policy
  getPasswordPolicy: async () => {
    const response = await api.get("/settings/password-policy");
    return response.data;
  },

  // PUT /settings/password-policy
  updatePasswordPolicy: async (payload: PasswordPolicyPayload) => {
    const response = await api.put("/settings/password-policy", payload);
    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "Password & Security Policy Updated",
      message: "Security and authentication governance rules modified.",
      targetRoles: ["super_admin"],
    });
    return response.data;
  },

  // GET /settings/business-rules
  getBusinessRules: async () => {
    const response = await api.get("/settings/business-rules");
    return response.data;
  },

  // PUT /settings/business-rules/{rule_id}
  updateBusinessRule: async (ruleKeyOrId: string, payload: Record<string, unknown>) => {
    const response = await api.put(`/settings/business-rules/${ruleKeyOrId}`, payload);
    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "Business Operation Rule Updated",
      message: `Operational rule ${ruleKeyOrId} updated by Super Admin.`,
      targetRoles: ["super_admin"],
    });
    return response.data;
  },

  // GET /settings/email
  getEmailSettings: async () => {
    const response = await api.get("/settings/email");
    return response.data;
  },

  // PUT /settings/email
  updateEmailSettings: async (payload: EmailSettingsPayload) => {
    const response = await api.put("/settings/email", payload);
    return response.data;
  },

  // GET /settings/storage
  getStorageSettings: async () => {
    const response = await api.get("/settings/storage");
    return response.data;
  },
};

export default settingsService;
