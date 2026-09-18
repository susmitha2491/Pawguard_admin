import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import PasswordInput from "./PasswordInput";
import ForgotPasswordModal from "./ForgotPasswordModal";
import authService from "../../services/auth/authService";
import userService from "../../services/userService";
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
    // Consume and remove the expired query parameter so refreshing does not repeatedly display the expiration banner
    if (typeof window !== "undefined" && window.location.search.includes("expired=")) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("expired");
        const cleanUrl = url.pathname + (url.search ? url.search : "") + url.hash;
        window.history.replaceState({}, document.title, cleanUrl || "/");
      } catch {
        navigate("/", { replace: true });
      }
    }
  }, [navigate]);

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

      // Fetch user summary for complete profile including rescue_centre_id
      try {
        const userId = userObj.id || userObj.user_id || userObj.userId;
        if (userId) {
          const summary = await userService.getUserSummary(String(userId));
          if (summary && typeof summary === "object") {
            userObj = { ...userObj, ...summary, role: userRole };
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
        // Ignore summary fetch failure, use me response
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

      if (loginPayload?.mfa_required || loginPayload?.requires_mfa) {
        setErrorMsg("This account requires Multi-Factor Authentication (MFA) on the backend, but MFA is disabled in this portal. Please sign in with an account configured for standard password authentication.");
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