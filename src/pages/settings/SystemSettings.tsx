import { useState, useEffect } from "react";
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
  FaClock,
  FaExclamationTriangle,
} from "react-icons/fa";
import settingsService from "../../services/settingsService";
import { notifyDataChanged } from "../../utils/dataSync";
import { extractErrorMessage } from "../../utils/errorUtils";
import { getSessionTimeoutMinutes, setSessionTimeoutMinutes } from "../../utils/authStorage";

const SystemSettings = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "security" | "business" | "email">("general");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // General Settings
  const [generalForm, setGeneralForm] = useState({
    platform_name: "PawGuard Shelter & Rescue Management System",
    support_email: "support@pawguard.org",
    emergency_hotline: "+91 1800-PAWGUARD",
    timezone: "Asia/Kolkata (IST)",
    default_language: "English",
  });

  // Security Settings
  const [securityForm, setSecurityForm] = useState({
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

  // Business Rules
  const [businessForm, setBusinessForm] = useState({
    max_foster_animals_per_family: 3,
    quarantine_period_days: 14,
    rescue_dispatch_timeout_minutes: 45,
    auto_archive_tickets_days: 30,
  });

  // Email Config
  const [emailForm, setEmailForm] = useState({
    smtp_server: "smtp.pawguard.org",
    smtp_port: 587,
    sender_email: "notifications@pawguard.org",
    enable_email_alerts: true,
    mail_username: "",
  });

  const fetchAllSettings = async () => {
    try {
      setLoading(true);
      setBackendError(null);

      const [genRes, secRes, bizRes, mailRes, sysRes] = await Promise.allSettled([
        settingsService.getGeneralSettings(),
        settingsService.getPasswordPolicy(),
        settingsService.getBusinessRules(),
        settingsService.getEmailSettings(),
        settingsService.getSystemSettings(),
      ]);

      const errors: string[] = [];

      if (genRes.status === "fulfilled" && genRes.value) {
        const data = genRes.value.data || genRes.value;
        setGeneralForm((prev) => ({ ...prev, ...data }));
      } else if (genRes.status === "rejected") {
        errors.push(`General Config: ${extractErrorMessage(genRes.reason, "Failed to load general settings")}`);
      }

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

      // Check system settings for persisted session_timeout_minutes
      if (sysRes.status === "fulfilled" && sysRes.value) {
        const items = Array.isArray(sysRes.value.data)
          ? sysRes.value.data
          : Array.isArray(sysRes.value)
          ? sysRes.value
          : [];
        const timeoutSetting = items.find((s: { key?: string; value?: string }) => s.key === "session_timeout_minutes");
        if (timeoutSetting && timeoutSetting.value) {
          const parsed = parseInt(timeoutSetting.value, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            setSecurityForm((prev) => ({ ...prev, session_timeout_minutes: parsed }));
            setSessionTimeoutMinutes(parsed);
          }
        }
      }

      if (bizRes.status === "fulfilled" && bizRes.value) {
        const data = bizRes.value.data || bizRes.value;
        if (Array.isArray(data)) {
          setBusinessForm((prev) => {
            const updated = { ...prev };
            data.forEach((item: any) => {
              const k = item.rule_key || item.key;
              const v = item.rule_value !== undefined ? item.rule_value : item.value;
              if (k && k in updated) {
                (updated as any)[k] = typeof (updated as any)[k] === "number" ? Number(v) : v;
              }
            });
            return updated;
          });
        } else if (data && typeof data === "object") {
          setBusinessForm((prev) => ({ ...prev, ...data }));
        }
      } else if (bizRes.status === "rejected") {
        errors.push(`Business Rules: ${extractErrorMessage(bizRes.reason, "Failed to load business rules")}`);
      }

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
    } catch (err: any) {
      setBackendError(extractErrorMessage(err, "Failed to load settings configuration."));
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
      addToast("General platform settings saved successfully!", "success");
      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: any) {
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

      // 2. Update local session-timeout configuration used by authStorage/useInactivityTimeout & broadcast cross-tab
      setSessionTimeoutMinutes(safeTimeout);

      // 3. Attempt to persist the backend-supported password/security policy fields
      let policyWarning: string | null = null;
      try {
        await settingsService.updatePasswordPolicy(securityForm);
      } catch (policyErr: any) {
        policyWarning = extractErrorMessage(policyErr, "database entity relations failed to load during serialization");
      }

      if (policyWarning) {
        setBackendError(`Notice: Session Inactivity Auto-Lockout (${safeTimeout} mins) saved & active. Password policy response: ${policyWarning}`);
        addToast(`Session Inactivity Auto-Lockout (${safeTimeout} mins) saved successfully!`, "success");
      } else {
        addToast("Security & Password governance policy saved successfully!", "success");
      }

      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: any) {
      const msg = extractErrorMessage(err, "Failed to update security settings.");
      setBackendError(`Security Policy Update Error: ${msg}`);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setBackendError(null);
      const ruleEntries = Object.entries(businessForm);
      await Promise.all(
        ruleEntries.map(([rule_key, val]) =>
          settingsService.updateBusinessRule(rule_key, {
            rule_value: String(val),
            module: "general",
            is_active: true,
          })
        )
      );
      addToast("Business operation rules updated successfully!", "success");
      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: any) {
      const msg = extractErrorMessage(err, "Failed to update business rules.");
      setBackendError(`Business Rules Update Error: ${msg}`);
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
      const payload = {
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
      addToast("Email server configuration updated successfully!", "success");
      notifyDataChanged();
      await fetchAllSettings();
    } catch (err: any) {
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
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>System & Global Administration</h1>
              <span
                style={{
                  background: "rgba(37, 99, 235, 0.2)",
                  color: "#60A5FA",
                  border: "1px solid rgba(96, 165, 250, 0.4)",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Super Admin Privileged
              </span>
            </div>
            <p style={{ margin: 0, color: "#94A3B8", fontSize: "14px" }}>
              Configure platform governance, security enforcement, business operational limits, and server policies.
            </p>
          </div>

          <button
            onClick={() => void fetchAllSettings()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#334155",
              color: "#FFFFFF",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <FaSync className={loading ? "dash-spin" : undefined} />
            Refresh Configuration
          </button>
        </div>
      </div>

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

      {/* Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard title="Governance Mode" value="Enforced" icon={<FaShieldAlt />} color="#2563EB" />
        <StatCard title="MFA Enforcement" value="Mandatory" icon={<FaLock />} color="#10B981" />
        <StatCard title="Quarantine Period" value={`${businessForm.quarantine_period_days} Days`} icon={<FaClock />} color="#F59E0B" />
        <StatCard title="Session Inactivity" value={`${securityForm.session_timeout_minutes} Mins`} icon={<FaSlidersH />} color="#8B5CF6" />
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", marginBottom: "24px", gap: "8px" }}>
        {[
          { key: "general", label: "General Config", icon: <FaCogs /> },
          { key: "security", label: "Security & MFA", icon: <FaShieldAlt /> },
          { key: "business", label: "Business Rules", icon: <FaSlidersH /> },
          { key: "email", label: "Email Notifications", icon: <FaEnvelope /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 700,
              border: "none",
              borderBottom: activeTab === tab.key ? "3px solid #2563EB" : "3px solid transparent",
              background: "transparent",
              color: activeTab === tab.key ? "#2563EB" : "#64748B",
              cursor: "pointer",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "24px" }}>
        {activeTab === "general" && (
          <form onSubmit={handleSaveGeneral} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "680px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Platform Identity & Emergency Settings
            </h3>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Platform Display Name *
              </label>
              <input
                type="text"
                value={generalForm.platform_name}
                onChange={(e) => setGeneralForm({ ...generalForm, platform_name: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  System Support Email *
                </label>
                <input
                  type="email"
                  value={generalForm.support_email}
                  onChange={(e) => setGeneralForm({ ...generalForm, support_email: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Emergency Rescue Hotline *
                </label>
                <input
                  type="text"
                  value={generalForm.emergency_hotline}
                  onChange={(e) => setGeneralForm({ ...generalForm, emergency_hotline: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Operational Timezone
                </label>
                <input
                  type="text"
                  value={generalForm.timezone}
                  onChange={(e) => setGeneralForm({ ...generalForm, timezone: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Default System Language
                </label>
                <input
                  type="text"
                  value={generalForm.default_language}
                  onChange={(e) => setGeneralForm({ ...generalForm, default_language: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                width: "fit-content",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <FaSave /> {saving ? "Saving Changes..." : "Save General Settings"}
            </button>
          </form>
        )}

        {activeTab === "security" && (
          <form onSubmit={handleSaveSecurity} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "680px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Authentication Governance & TOTP Policy
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Minimum Password Length
                </label>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={securityForm.min_length}
                  onChange={(e) => setSecurityForm({ ...securityForm, min_length: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Max Login Retries Before Lockout
                </label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={securityForm.max_login_attempts}
                  onChange={(e) => setSecurityForm({ ...securityForm, max_login_attempts: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Session Inactivity Auto-Lockout (Minutes)
              </label>
              <div style={{ fontSize: "12px", color: "#64748B", marginBottom: "6px" }}>
                Automatically signs users out after the configured period of inactivity.
              </div>
              <input
                type="number"
                min={5}
                max={120}
                value={securityForm.session_timeout_minutes}
                onChange={(e) => setSecurityForm({ ...securityForm, session_timeout_minutes: Math.max(0, Number(e.target.value)) })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Max Password Age (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={securityForm.max_age_days}
                  onChange={(e) => setSecurityForm({ ...securityForm, max_age_days: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Password History Count
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={securityForm.password_history_count}
                  onChange={(e) => setSecurityForm({ ...securityForm, password_history_count: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Lockout Duration (Mins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={securityForm.lockout_duration_minutes}
                  onChange={(e) => setSecurityForm({ ...securityForm, lockout_duration_minutes: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F8FAFC", padding: "16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={securityForm.require_uppercase}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_uppercase: e.target.checked })}
                />
                Require Uppercase Letter
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={securityForm.require_lowercase}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_lowercase: e.target.checked })}
                />
                Require Lowercase Letter
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={securityForm.require_digit}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_digit: e.target.checked, require_numbers: e.target.checked })}
                />
                Require Digit / Number
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={securityForm.require_special_char}
                  onChange={(e) => setSecurityForm({ ...securityForm, require_special_char: e.target.checked, require_special: e.target.checked })}
                />
                Require Special Character
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#F8FAFC", padding: "16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600, color: "#0F172A", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={securityForm.totp_mfa_required_for_admins}
                  onChange={(e) => setSecurityForm({ ...securityForm, totp_mfa_required_for_admins: e.target.checked })}
                />
                Mandatory TOTP MFA Enforcement for Administrative Roles
              </label>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#64748B" }}>
                When enabled, Super Administrators, Rescue Centre Admins, and Shelter Managers are required to verify a 6-digit TOTP code upon login.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                width: "fit-content",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <FaSave /> {saving ? "Updating..." : "Save Security Policy"}
            </button>
          </form>
        )}

        {activeTab === "business" && (
          <form onSubmit={handleSaveBusiness} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "680px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Operational Limits & Business Rules
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Max Active Fosters per Foster Family
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={businessForm.max_foster_animals_per_family}
                  onChange={(e) => setBusinessForm({ ...businessForm, max_foster_animals_per_family: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Mandatory Quarantine Period (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={businessForm.quarantine_period_days}
                  onChange={(e) => setBusinessForm({ ...businessForm, quarantine_period_days: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Rescue Dispatch Timeout (Minutes)
                </label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={businessForm.rescue_dispatch_timeout_minutes}
                  onChange={(e) => setBusinessForm({ ...businessForm, rescue_dispatch_timeout_minutes: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Auto-Archive Inactive Tickets (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  max={180}
                  value={businessForm.auto_archive_tickets_days}
                  onChange={(e) => setBusinessForm({ ...businessForm, auto_archive_tickets_days: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                width: "fit-content",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <FaSave /> {saving ? "Saving Rules..." : "Save Business Rules"}
            </button>
          </form>
        )}

        {activeTab === "email" && (
          <form onSubmit={handleSaveEmail} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "680px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
              Notification Server & Email Relay Settings
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  SMTP Host Server
                </label>
                <input
                  type="text"
                  value={emailForm.smtp_server}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_server: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={emailForm.smtp_port}
                  onChange={(e) => setEmailForm({ ...emailForm, smtp_port: Number(e.target.value) })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Sender Email Address
              </label>
              <input
                type="email"
                value={emailForm.sender_email}
                onChange={(e) => setEmailForm({ ...emailForm, sender_email: e.target.value })}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                width: "fit-content",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "14px",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              <FaSave /> {saving ? "Saving Config..." : "Save Email Config"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SystemSettings;
