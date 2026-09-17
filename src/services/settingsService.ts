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

  // Save / Upsert system setting via POST /settings/system with existing cleanup
  saveSystemSetting: async (key: string, value: string, category = "general", description?: string) => {
    try {
      const existingRes = await api.get("/settings/system");
      const list = Array.isArray(existingRes.data?.data)
        ? existingRes.data.data
        : Array.isArray(existingRes.data)
        ? existingRes.data
        : [];
      const existing = list.find((item: { id?: string; key?: string }) => item.key === key);
      if (existing && existing.id) {
        try {
          await api.delete(`/settings/system/${existing.id}`);
        } catch {
          /* ignore deletion errors if already removed */
        }
      }
    } catch {
      /* ignore fetch errors */
    }

    const response = await api.post("/settings/system", {
      key,
      value: String(value),
      category,
      description: description || `System setting for ${key}`,
      is_encrypted: false,
      is_editable: true,
    });

    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "System Setting Updated",
      message: `System setting "${key}" updated by Super Admin.`,
      targetRoles: ["super_admin"],
    });

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
    const cleanPayload: Record<string, unknown> = {};
    if (payload.min_length !== undefined) cleanPayload.min_length = Number(payload.min_length);
    if (payload.require_uppercase !== undefined) cleanPayload.require_uppercase = Boolean(payload.require_uppercase);
    if (payload.require_lowercase !== undefined) cleanPayload.require_lowercase = Boolean(payload.require_lowercase);
    if (payload.require_digit !== undefined) cleanPayload.require_digit = Boolean(payload.require_digit);
    else if (payload.require_numbers !== undefined) cleanPayload.require_digit = Boolean(payload.require_numbers);
    if (payload.require_special_char !== undefined) cleanPayload.require_special_char = Boolean(payload.require_special_char);
    else if (payload.require_special !== undefined) cleanPayload.require_special_char = Boolean(payload.require_special);
    if (payload.max_age_days !== undefined) cleanPayload.max_age_days = Number(payload.max_age_days);
    if (payload.password_history_count !== undefined) cleanPayload.password_history_count = Number(payload.password_history_count);
    if (payload.max_login_attempts !== undefined) cleanPayload.max_login_attempts = Number(payload.max_login_attempts);
    if (payload.lockout_duration_minutes !== undefined) cleanPayload.lockout_duration_minutes = Number(payload.lockout_duration_minutes);
    if (payload.is_active !== undefined) cleanPayload.is_active = Boolean(payload.is_active);

    const response = await api.put("/settings/password-policy", cleanPayload);
    await publishActionEvent({
      module: "settings",
      action: "update",
      title: "Password & Security Policy Updated",
      message: "Security and authentication governance rules modified.",
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

