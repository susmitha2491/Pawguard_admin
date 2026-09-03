import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import PasswordInput from "./PasswordInput";
import ForgotPasswordModal from "./ForgotPasswordModal";
import authService from "../../services/auth/authService";
import { getDashboardPathForRole, normalizeRole } from "../../utils/roleUtils";
import { notifyAuthChanged } from "../../utils/dataSync";
import { getRememberMe, getRememberedEmail, setAuthData, setRememberedEmail, updateLastActivity } from "../../utils/authStorage";

const LoginForm = () => {
  const [email, setEmail] = useState<string>(() => getRememberedEmail());
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberMe());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  // MFA 2-step state
  const [mfaStep, setMfaStep] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let msg: string | null = null;
    try {
      msg = sessionStorage.getItem("session_expired_message");
      if (msg) {
        sessionStorage.removeItem("session_expired_message");
      }
    } catch {
      // Ignore storage errors
    }
    if (!msg && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "true") {
        msg = "Your session has expired. Please sign in again.";
      }
    }
    if (msg) {
      setErrorMsg(msg);
    }
  }, []);

  const resolveUserObject = (payload: unknown): any => {
    if (!payload || typeof payload !== "object") return null;

    const obj = payload as Record<string, unknown>;

    if (obj.user && typeof obj.user === "object") {
      return obj.user;
    }

    if (obj.data && typeof obj.data === "object" && (obj.data as Record<string, unknown>).user) {
      return (obj.data as Record<string, unknown>).user;
    }

    return obj;
  };

  const unifyAuthPayload = (response: any) => {
    if (!response) return {};
    return response?.data?.data || response?.data || response;
  };

  const processAuthenticatedSession = async (loginPayload: any, response: any) => {
    const inlineUser = resolveUserObject(loginPayload);
    const accessToken = loginPayload?.access_token || response?.data?.data?.access_token || response?.data?.access_token;
    const refreshToken = loginPayload?.refresh_token || response?.data?.data?.refresh_token || response?.data?.refresh_token;

    let userObj: any = inlineUser;
    if (!userObj || typeof userObj !== "object") {
      userObj = { email: email.trim() };
    } else if (!userObj.email) {
      userObj.email = email.trim();
    }

    const userRole = normalizeRole(userObj);
    if (!userRole) {
      throw new Error("Access Denied: The Admin Portal is restricted to authorized internal staff only.");
    }
    userObj.role = userRole;

    setAuthData(
      {
        user: userObj,
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      rememberMe
    );
    setRememberedEmail(rememberMe ? email.trim() : "");

    try {
      const meResponse = await authService.getMe();
      if (meResponse) {
        const meData = meResponse?.data || meResponse;
        const fetchedUser = resolveUserObject(meData);
        if (fetchedUser && typeof fetchedUser === "object") {
          userObj = { ...userObj, ...fetchedUser, role: userRole };
          setAuthData(
            {
              user: userObj,
              access_token: accessToken,
              refresh_token: refreshToken,
            },
            rememberMe
          );
        }
      }
    } catch {
      // Fallback to authenticated login user object
    }

    notifyAuthChanged();
    navigate(getDashboardPathForRole(userRole), { replace: true });
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Please enter your email address and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await authService.login({
        email: email.trim(),
        password,
      });

      setErrorMsg(null);
      updateLastActivity();

      const loginPayload = unifyAuthPayload(response);

      // Check if TOTP MFA step is required by backend
      if (loginPayload?.mfa_required || loginPayload?.requires_mfa || loginPayload?.pre_auth_token) {
        setPreAuthToken(loginPayload.pre_auth_token || "");
        setMfaStep(true);
        return;
      }

      await processAuthenticatedSession(loginPayload, response);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
          setErrorMsg(
            "The PawGuard backend is waking up (cold start). Please wait a few seconds and try signing in again."
          );
        } else if (!error.response) {
          const origin = typeof window !== "undefined" ? window.location.origin : "this origin";
          setErrorMsg(
            `Unable to connect to PawGuard backend. Please verify your connection, or ensure backend CORS policy allows requests from '${origin}'.`
          );
        } else {
          const backendErr = error.response.data?.error;
          const msg =
            backendErr?.message ||
            error.response.data?.message ||
            error.response.data?.detail ||
            "Invalid email or password. Please check your credentials.";
          setErrorMsg(String(msg));
        }
      } else if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg("Authentication failed. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.trim().length !== 6) {
      setErrorMsg("Please enter a valid 6-digit TOTP authentication code.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const response = await authService.verifyMfa(preAuthToken, mfaCode);
      const verifyPayload = unifyAuthPayload(response);
      await processAuthenticatedSession(verifyPayload, response);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const backendErr = error.response?.data?.error;
        const msg =
          backendErr?.message ||
          error.response?.data?.message ||
          error.response?.data?.detail ||
          "Invalid MFA TOTP verification code. Please try again.";
        setErrorMsg(String(msg));
      } else if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg("MFA verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (mfaStep) {
    return (
      <form onSubmit={handleVerifyMfaSubmit} style={{ width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700, color: "#0F172A" }}>
            🔐 Two-Factor Authentication
          </h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
            Enter the 6-digit TOTP security code from your authenticator app.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              color: "#991B1B",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              lineHeight: 1.4,
            }}
          >
            ⚠️ <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="mfa-code" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
            6-Digit TOTP Security Code *
          </label>
          <input
            id="mfa-code"
            type="text"
            maxLength={6}
            placeholder="e.g. 123456"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ""))}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "18px",
              letterSpacing: "4px",
              textAlign: "center",
              fontWeight: 700,
            }}
            required
            autoFocus
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => {
              setMfaStep(false);
              setMfaCode("");
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{ flex: 2 }}
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} style={{ width: "100%" }}>
      {errorMsg && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "12.5px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            lineHeight: 1.4,
          }}
        >
          ⚠️ <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="email">Email Address</label>
        <input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <label htmlFor="password">Password</label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="login-options" style={{ marginBottom: "16px" }}>
        <label htmlFor="remember">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me
        </label>

        <a href="#forgot" onClick={(e) => { e.preventDefault(); setForgotOpen(true); }}>
          Forgot Password?
        </a>
      </div>

      <button
        type="submit"
        className="login-button"
        disabled={loading}
      >
        {loading ? "Logging In..." : "Login"}
      </button>

      <ForgotPasswordModal
        key={forgotOpen ? "forgot-open" : "forgot-closed"}
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={email.trim()}
      />
    </form>
  );
};

export default LoginForm;