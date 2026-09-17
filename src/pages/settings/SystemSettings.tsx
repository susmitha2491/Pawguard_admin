import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../components/dashboard/StatCard";
import { useToast } from "../../context/ToastContext";
import {
  FaSlidersH,
  FaShieldAlt,
  FaCogs,
  FaEnvelope,
  FaSave,
  FaSync,
  FaLock,
  FaUserShield,
  FaHistory,
  FaDatabase,
  FaArrowRight,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaKey,
} from "react-icons/fa";
import settingsService from "../../services/settingsService";
import type {
  GeneralSettingsPayload,
  PasswordPolicyPayload,
  EmailSettingsPayload,
} from "../../services/settingsService";
import { notifyDataChanged } from "../../utils/dataSync";
import { extractErrorMessage } from "../../utils/errorUtils";
import { getSessionTimeoutMinutes, setSessionTimeoutMinutes } from "../../utils/authStorage";

type SettingsTab = "general" | "security" | "rbac" | "audit" | "notifications" | "backup";

const SystemSettings: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // 1. General Settings Form (Persisted via GET/PUT /settings/general)
  const [generalForm, setGeneralForm] = useState<GeneralSettingsPayload>({
    platform_name: "PawGuard Shelter & Rescue Management System",
    support_email: "support@pawguard.org",
    emergency_hotline: "+91 1800-PAWGUARD",
    timezone: "Asia/Kolkata (IST)",
    default_language: "English",
  });

  // 2. Security Settings Form (Persisted via GET/PUT /settings/password-policy & POST /settings/system)
  const [securityForm, setSecurityForm] = useState<PasswordPolicyPayload>({
    min_length: 10,
    require_uppercase: true,
    require_lowercase: true,
    require_digit: true,
    require_special_char: true,
    require_special: true,
    require_numbers: true,
    max_age_days: 90,
    password_history_count: 5,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    is_active: true,
    session_timeout_minutes: getSessionTimeoutMinutes(),
    totp_mfa_required_for_admins: true,
  });

  // 3. Notification Relay Form (Persisted via GET/PUT /settings/email)
  const [emailForm, setEmailForm] = useState<EmailSettingsPayload>({
    smtp_server: "smtp.pawguard.org",
    smtp_port: 587,
    sender_email: "notifications@pawguard.org",
    enable_email_alerts: true,
    mail_username: "",
    mail_password: "",
  });

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      setBackendError(null);

      const [genRes, secRes, mailRes, sysRes] = await Promise.allSettled([
        settingsService.getGeneralSettings(),
        settingsService.getPasswordPolicy(),
        settingsService.getEmailSettings(),
        settingsService.getSystemSettings(),
      ]);

      const errors: string[] = [];

      // General Settings
      if (genRes.status === "fulfilled" && genRes.value) {
        const data = genRes.value.data || genRes.value;
        setGeneralForm((prev) => ({ ...prev, ...data }));
      } else if (genRes.status === "rejected") {
        errors.push(`General Config: ${extractErrorMessage(genRes.reason, "Failed to load general settings")}`);
      }

      // Security Policy
      if (secRes.status === "fulfilled" && secRes.value) {
        const data = secRes.value.data || secRes.value;
        setSecurityForm((prev) => {
          const updated = { ...prev, ...data };
          if (data.require_special !== undefined && data.require_special_char === undefined) {
            updated.require_special_char = Boolean(data.require_special);
          }
          if (data.require_special_char !== undefined) {
            updated.require_special = Boolean(data.require_special_char);
          }
          if (data.require_digit !== undefined && data.require_numbers === undefined) {
            updated.require_numbers = Boolean(data.require_digit);
          }
          if (data.require_numbers !== undefined && data.require_digit === undefined) {
            updated.require_digit = Boolean(data.require_numbers);
          }
          if (data.session_timeout_minutes !== undefined && Number(data.session_timeout_minutes) > 0) {
            const timeout = Number(data.session_timeout_minutes);
            updated.session_timeout_minutes = timeout;
            setSessionTimeoutMinutes(timeout);
          }
          return updated;
        });
      } else if (secRes.status === "rejected") {
        errors.push(`Security Policy: ${extractErrorMessage(secRes.reason, "Failed to load security policy")}`);
      }

      // Check system settings key-value store for persisted session timeout
      if (sysRes.status === "fulfilled" && sysRes.value) {
        const items = Array.isArray(sysRes.value.data)
          ? sysRes.value.data
          : Array.isArray(sysRes.value)
          ? sysRes.value
          : [];
        const timeoutSetting = items.find((s: { key?: string; value?: string }) => s.key === "session_timeout_minutes");
        if (timeoutSetting && timeoutSetting.value) {
          const parsed = parseInt(timeoutSetting.value, 10);
          if (!isNaN(parsed) && parsed >= 5 && parsed <= 120) {
            setSecurityForm((prev) => ({ ...prev, session_timeout_minutes: parsed }));
            setSessionTimeoutMinutes(parsed);
          }
        }
      }

      // Email Settings
      if (mailRes.status === "fulfilled" && mailRes.value) {
        const data = mailRes.value.data || mailRes.value;
        setEmailForm((prev) => ({
          ...prev,
          ...data,
          smtp_server: data.mail_host || data.smtp_server || prev.smtp_server,
          smtp_port: data.mail_port !== undefined ? Number(data.mail_port) : (data.smtp_port !== undefined ? Number(data.smtp_port) : prev.smtp_port),
          sender_email: data.mail_from || data.sender_email || prev.sender_email,
          enable_email_alerts: data.mail_use_tls !== undefined ? Boolean(data.mail_use_tls) : (data.enable_email_alerts !== undefined ? Boolean(data.enable_email_alerts) : prev.enable_email_alerts),
        }));
      } else if (mailRes.status === "rejected") {
        errors.push(`Email Config: ${extractErrorMessage(mailRes.reason, "Failed to load email config")}`);
      }

      if (errors.length > 0) {
        setBackendError(errors.join(" | "));
      }
    } catch (err: unknown) {
      setBackendError(extractErrorMessage(err, "Failed to load platform settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllSettings();
  }, []);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setBackendError(null);
      await settingsService.updateGeneralSettings(generalForm);
      addToast("General platform configuration saved successfully!", "success");
      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to save general platform settings.");
      setBackendError(`General Settings Save Error: ${msg}`);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setBackendError(null);

      const rawTimeout = Number(securityForm.session_timeout_minutes);
      if (isNaN(rawTimeout) || rawTimeout < 5 || rawTimeout > 120) {
        addToast("Session Inactivity Auto-Lockout must be between 5 and 120 minutes.", "error");
        setSaving(false);
        return;
      }
      const safeTimeout = Math.floor(rawTimeout);

      // 1. Persist session inactivity timeout value using backend-supported system setting endpoint
      await settingsService.saveSystemSetting(
        "session_timeout_minutes",
        String(safeTimeout),
        "security",
        "Session inactivity auto-lockout in minutes"
      );

      // 2. Update local session-timeout configuration used by authStorage & broadcast cross-tab
      setSessionTimeoutMinutes(safeTimeout);

      // 3. Persist backend-supported password/security policy fields
      let policyWarning: string | null = null;
      try {
        await settingsService.updatePasswordPolicy(securityForm);
      } catch (policyErr: unknown) {
        policyWarning = extractErrorMessage(policyErr, "Failed to update password policy fields");
      }

      if (policyWarning) {
        setBackendError(`Notice: Session Inactivity Auto-Lockout (${safeTimeout} mins) saved & active. Password policy update: ${policyWarning}`);
        addToast(`Session Inactivity Auto-Lockout (${safeTimeout} mins) saved successfully!`, "success");
      } else {
        addToast("Security & Password governance policy saved successfully!", "success");
      }

      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to update security settings.");
      setBackendError(`Security Policy Update Error: ${msg}`);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setBackendError(null);
      const payload: EmailSettingsPayload = {
        ...emailForm,
        mail_host: emailForm.smtp_server,
        mail_port: Number(emailForm.smtp_port),
        mail_from: emailForm.sender_email,
        mail_use_tls: Boolean(emailForm.enable_email_alerts),
        smtp_server: emailForm.smtp_server,
        smtp_port: Number(emailForm.smtp_port),
        sender_email: emailForm.sender_email,
        enable_email_alerts: Boolean(emailForm.enable_email_alerts),
      };
      await settingsService.updateEmailSettings(payload);
      addToast("Transactional email relay settings saved successfully!", "success");
      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, "Failed to update email settings.");
      setBackendError(`Email Settings Update Error: ${msg}`);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "4px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderRadius: "16px",
          padding: "24px",
          color: "#FFFFFF",
          marginBottom: "24px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em" }}>
                System Administration & Governance
              </h1>
              <span
                style={{
                  background: "rgba(37, 99, 235, 0.2)",
                  color: "#60A5FA",
                  border: "1px solid rgba(96, 165, 250, 0.4)",
                  padding: "3px 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Super Admin Privileged
              </span>
            </div>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px", lineHeight: "1.5" }}>
              Global platform controls, authentication governance, security standards, communication relay, and organizational oversight.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchAllSettings()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#334155",
              color: "#FFFFFF",
              border: "1px solid #475569",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            <FaSync className={loading ? "dash-spin" : undefined} />
            Refresh Configuration
          </button>
        </div>
      </div>

      {/* Backend Error Alert Banner */}
      {backendError && (
        <div
          style={{
            marginBottom: "24px",
            padding: "16px 20px",
            borderRadius: "12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            fontSize: "13.5px",
          }}
        >
          <FaExclamationTriangle size={18} style={{ color: "#DC2626", marginTop: "2px", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>
              Backend Settings Service Alert
            </div>
            <div>{backendError}</div>
          </div>
        </div>
      )}

      {/* Real-Data Governance KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title="Session Inactivity Policy"
          value={`${securityForm.session_timeout_minutes || 30} Mins`}
          icon={<FaSlidersH />}
          color="#2563EB"
        />
        <StatCard
          title="Administrative MFA"
          value={securityForm.totp_mfa_required_for_admins ? "Mandatory" : "Optional"}
          icon={<FaLock />}
          color="#10B981"
        />
        <StatCard
          title="Password Standard"
          value={`Min ${securityForm.min_length || 10} Chars`}
          icon={<FaShieldAlt />}
          color="#8B5CF6"
        />
        <StatCard
          title="Notification Relay"
          value={emailForm.enable_email_alerts ? "Relay Active" : "Disabled"}
          icon={<FaEnvelope />}
          color="#F59E0B"
        />
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #CBD5E1",
          marginBottom: "24px",
          gap: "6px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {[
          { key: "general", label: "General Configuration", icon: <FaCogs /> },
          { key: "security", label: "Security & Authentication", icon: <FaShieldAlt /> },
          { key: "rbac", label: "Roles & Permissions", icon: <FaUserShield /> },
          { key: "audit", label: "Audit & Compliance", icon: <FaHistory /> },
          { key: "notifications", label: "Notification Relay", icon: <FaEnvelope /> },
          { key: "backup", label: "Data & Backup Governance", icon: <FaDatabase /> },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as SettingsTab)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 18px",
              fontSize: "14px",
              fontWeight: 700,
              border: "none",
              borderBottom: activeTab === tab.key ? "3px solid #2563EB" : "3px solid transparent",
              background: "transparent",
              color: activeTab === tab.key ? "#2563EB" : "#64748B",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease-in-out",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels Container */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          border: "1px solid #E2E8F0",
          padding: "28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {/* TAB 1: General Configuration */}
        {activeTab === "general" && (
          <form onSubmit={handleSaveGeneral} style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "760px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Platform Identity & Public Support Configuration
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                Configure global identity, official support channels, and emergency rescue contact numbers displayed across the PawGuard application.
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Platform Display Name *
              </label>
              <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                The official organizational title displayed in browser headers, notifications, and public views.
              </div>
              <input
                type="text"
                value={generalForm.platform_name || ""}
                onChange={(e) => setGeneralForm({ ...generalForm, platform_name: e.target.value })}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Central Support Email *
                </label>
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                  Primary administrative support inbox for staff and public inquiries.
                </div>
                <input
                  type="email"
                  value={generalForm.support_email || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, support_email: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Emergency Rescue Hotline *
                </label>
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                  Toll-free or regional telephone contact for public rescue dispatch.
                </div>
                <input
                  type="text"
                  value={generalForm.emergency_hotline || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, emergency_hotline: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Operational Timezone
                </label>
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                  Standard timezone used for timestamping rescues, shifts, and medical logs.
                </div>
                <input
                  type="text"
                  value={generalForm.timezone || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, timezone: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Default System Language
                </label>
                <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                  Base language utilized across the administrative interface.
                </div>
                <input
                  type="text"
                  value={generalForm.default_language || ""}
                  onChange={(e) => setGeneralForm({ ...generalForm, default_language: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ paddingTop: "8px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "11px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                <FaSave /> {saving ? "Saving Changes..." : "Save General Settings"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Security & Authentication */}
        {activeTab === "security" && (
          <form onSubmit={handleSaveSecurity} style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "760px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Authentication Governance & Password Security Policy
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                Enforce organization-wide credential security rules, session auto-lockouts, and multi-factor authentication requirements as mandated by PRR Section 6.
              </p>
            </div>

            {/* Session Timeout */}
            <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Session Inactivity Auto-Lockout (Minutes) *
              </label>
              <div style={{ fontSize: "12.5px", color: "#64748B", marginBottom: "10px", lineHeight: "1.4" }}>
                Per PRR Section 6.1.5 (Session Governance), user sessions automatically terminate across all browser tabs when inactive. Allowed bounds: 5 to 120 minutes.
              </div>
              <input
                type="number"
                min={5}
                max={120}
                value={securityForm.session_timeout_minutes || 30}
                onChange={(e) => setSecurityForm({ ...securityForm, session_timeout_minutes: Number(e.target.value) })}
                style={{ width: "160px", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: 600 }}
                required
              />
            </div>

            {/* Password Complexity & Length */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Minimum Password Length
                </label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={securityForm.min_length || 10}
                  onChange={(e) => setSecurityForm({ ...securityForm, min_length: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Max Failed Login Attempts (Lockout)
                </label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={securityForm.max_login_attempts || 5}
                  onChange={(e) => setSecurityForm({ ...securityForm, max_login_attempts: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Max Password Age (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={securityForm.max_age_days || 90}
                  onChange={(e) => setSecurityForm({ ...securityForm, max_age_days: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Password History Retention
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={securityForm.password_history_count || 5}
                  onChange={(e) => setSecurityForm({ ...securityForm, password_history_count: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Account Lockout Duration (Mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={securityForm.lockout_duration_minutes || 15}
                  onChange={(e) => setSecurityForm({ ...securityForm, lockout_duration_minutes: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Character Complexity Checkboxes */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
                background: "#F8FAFC",
                padding: "18px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(securityForm.require_uppercase)}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_uppercase: e.target.checked })}
                />
                Require Uppercase Letter (A-Z)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(securityForm.require_lowercase)}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_lowercase: e.target.checked })}
                />
                Require Lowercase Letter (a-z)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(securityForm.require_digit || securityForm.require_numbers)}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_digit: e.target.checked, require_numbers: e.target.checked })}
                />
                Require Numeric Digit (0-9)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(securityForm.require_special_char || securityForm.require_special)}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_special_char: e.target.checked, require_special: e.target.checked })}
                />
                Require Special Character (!@#$...)
              </label>
            </div>

            {/* MFA Policy */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "#EFF6FF",
                padding: "18px",
                borderRadius: "10px",
                border: "1px solid #BFDBFE",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 700, color: "#1E3A8A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(securityForm.totp_mfa_required_for_admins)}
                  onChange={(e) => setSecurityForm({ ...securityForm, totp_mfa_required_for_admins: e.target.checked })}
                />
                Enforce Multi-Factor Authentication (TOTP) for Privileged Roles
              </label>
              <p style={{ margin: 0, fontSize: "13px", color: "#3B82F6", lineHeight: "1.4" }}>
                Mandates 2-Step Verification for Super Administrators, Rescue Centre Admins, and Shelter Managers per PRR Section 6.1.5.
              </p>
            </div>

            {/* PII Masking Governance Notice */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                background: "#F8FAFC",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
                fontSize: "13px",
                color: "#475569",
              }}
            >
              <FaInfoCircle size={18} style={{ color: "#3B82F6", marginTop: "2px", flexShrink: 0 }} />
              <div>
                <strong style={{ color: "#0F172A" }}>PRR Section 6.1.3 Compliance Notice:</strong> Personal Identifying Information (PII) including reporter contact phone numbers, home addresses, and donor financial specifics are masked in general operational data grids, accessible only to authorized coordinators and Super Administrators.
              </div>
            </div>

            <div style={{ paddingTop: "8px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "11px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                <FaSave /> {saving ? "Saving Policy..." : "Save Security Policy"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: Roles & Permissions Governance */}
        {activeTab === "rbac" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Role-Based Access Control (RBAC) Governance
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                The Super Administrator maintains sole authority over organizational role configurations, permission matrix overrides, and staff privilege boundaries (PRR Section 2.1 & 6.1.1).
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                  Platform Scope
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
                  15 Roles (14 Admin + 1 Public)
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  11 Administrative + 3 Community + 1 Public
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                  Permission Modules
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#0F172A" }}>
                  12 Scopes
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  Covering 120+ granular action codes
                </div>
              </div>

              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                  Enforcement Layer
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#10B981" }}>
                  Server & Client
                </div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>
                  Dual-tier route and API gate checks
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                Manage Roles, Permissions & User Provisioning
              </h4>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                To configure specific permission matrices, assign staff roles, provision new user accounts, or manage security role overrides, navigate to the dedicated Roles & Permissions management module.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => navigate("/roles-permissions")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "11px 22px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  <FaKey /> Open Roles & Permissions Management <FaArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Audit & Compliance Governance */}
        {activeTab === "audit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Central Immutable Audit Logging & Governance
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                As mandated by PRR Section 6.1.2, all critical platform mutations are recorded in an immutable audit stream with full pre-state and post-state diff tracking.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                  Mandatory Audit Record Schema
                </h4>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                  <li><strong>User ID:</strong> Authenticated staff identifier</li>
                  <li><strong>Timestamp:</strong> High-precision UTC record time</li>
                  <li><strong>IP Address:</strong> Request origin network address</li>
                  <li><strong>Action Code:</strong> Specific operation identifier</li>
                  <li><strong>Pre-State / Post-State:</strong> Entity diff snapshot</li>
                </ul>
              </div>

              <div style={{ background: "#F8FAFC", padding: "18px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                  Audited Operational Events
                </h4>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                  <li>Rescue case status overrides & dispatches</li>
                  <li>Veterinary medical clearances & surgery logs</li>
                  <li>Adoption vetting approvals & lease signings</li>
                  <li>Financial transactions & expense allocations</li>
                  <li>Staff role updates & user state toggles</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                Inspect Live System Audit Logs
              </h4>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569", lineHeight: "1.5" }}>
                View, filter, search, and export the centralized platform audit logs to maintain complete institutional accountability.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => navigate("/audit-logs")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "11px 22px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  <FaHistory /> View Central Audit Logs <FaArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Notification Relay Configuration */}
        {activeTab === "notifications" && (
          <form onSubmit={handleSaveEmail} style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "760px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Transactional Email & Notification Relay Settings
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                Configure the platform SMTP relay service used for automated dispatch alerts, password recovery, donor tax receipts, and adoption milestones.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={emailForm.smtp_server || ""}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_server: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  placeholder="smtp.pawguard.org"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={emailForm.smtp_port || 587}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_port: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Sender Email Address
                </label>
                <input
                  type="email"
                  value={emailForm.sender_email || ""}
                  onChange={(e) => setEmailForm({ ...emailForm, sender_email: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  placeholder="notifications@pawguard.org"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={emailForm.mail_username || ""}
                  onChange={(e) => setEmailForm({ ...emailForm, mail_username: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "#F8FAFC",
                padding: "18px",
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 700, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(emailForm.enable_email_alerts)}
                  onChange={(e) => setEmailForm({ ...emailForm, enable_email_alerts: e.target.checked })}
                />
                Enable Transactional Notification Relay (TLS Encrypted)
              </label>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
                Enables immediate background email delivery for urgent rescue assignments and automated adoption documents.
              </p>
            </div>

            <div style={{ paddingTop: "8px" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "11px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
                }}
              >
                <FaSave /> {saving ? "Saving Relay..." : "Save Notification Relay"}
              </button>
            </div>
          </form>
        )}

        {/* TAB 6: Data Governance & Backup Policy */}
        {activeTab === "backup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", marginBottom: "4px" }}>
                Data Governance & Backup Architecture
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#64748B", lineHeight: "1.5" }}>
                PRR Section 2.1 designates Super Administrator oversight for organizational data backups, disaster recovery policies, and database replication integrity.
              </p>
            </div>

            <div
              style={{
                background: "#F8FAFC",
                padding: "20px",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FaCheckCircle size={18} style={{ color: "#10B981" }} />
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                  Automated Infrastructure Backup Schedules
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: "13.5px", color: "#475569", lineHeight: "1.6" }}>
                To maintain zero-loss data recovery, database snapshots and storage bucket backups are executed automatically at the cloud infrastructure layer on a continuous daily schedule:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                <li><strong>PostgreSQL Database Snapshots:</strong> Automated 24-hour full snapshots with Point-in-Time Recovery (PITR) up to 7 days.</li>
                <li><strong>Media Asset Storage (S3 / Cloudinary):</strong> Geographically replicated object storage with object versioning enabled.</li>
                <li><strong>Disaster Recovery RPO / RTO:</strong> Recovery Point Objective (RPO) &lt; 1 hour; Recovery Time Objective (RTO) &lt; 4 hours.</li>
              </ul>
            </div>

            <div
              style={{
                background: "#FFFBEB",
                padding: "16px 20px",
                borderRadius: "10px",
                border: "1px solid #FDE68A",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                fontSize: "13px",
                color: "#92400E",
              }}
            >
              <FaInfoCircle size={18} style={{ color: "#D97706", marginTop: "2px", flexShrink: 0 }} />
              <div>
                <strong>Operational Policy:</strong> Adhering to strict security isolation guidelines, manual database dumps are prohibited from client-side interfaces. All backup restorations must be authorized via Super Administrator change control tickets and executed via infrastructure CLI pipelines.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;
