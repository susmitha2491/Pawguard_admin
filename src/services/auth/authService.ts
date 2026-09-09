import axios from "../../api/axios";
import { notifyAuthChanged } from "../../utils/dataSync";
import { clearAuthData } from "../../utils/authStorage";

export interface LoginPayload {
  email: string;
  password: string;
}

const login = async (payload: LoginPayload) => {
  // Matches exact openapi.json LoginRequest schema
  const requestBody = {
    email: payload.email.trim(),
    password: payload.password,
    device: {
      device_type: "web",
    },
  };

  const response = await axios.post(
    "/auth/login",
    requestBody,
    {
      headers: {
        "X-Client-Type": "web",
      },
    }
  );
  return response;
};

const getMe = async () => {
  try {
    const response = await axios.get("/auth/me");
    return response.data;
  } catch {
    return null;
  }
};

const updateProfile = async (data: Record<string, unknown>) => {
  const response = await axios.put("/auth/me", data);
  return response.data;
};

const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await axios.post("/auth/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
};

const refreshSession = async () => {
  const response = await axios.post("/auth/refresh", {});
  return response.data;
};

const logout = async () => {
  try {
    await axios.post("/auth/logout");
  } catch {
    // Ignore network failures on logout
  } finally {
    clearAuthData();
    notifyAuthChanged();
  }
};

/**
 * Request a password reset link for a registered email (public endpoint).
 * Matches PasswordResetRequest schema: { email }
 */
const requestPasswordReset = async (email: string) => {
  const response = await axios.post("/auth/password/reset/request", {
    email: email.trim(),
  });
  return response;
};

/**
 * Set a new password using the token from the reset email (public endpoint).
 * Matches PasswordResetConfirm schema: { token, new_password }
 */
const confirmPasswordReset = async (token: string, newPassword: string) => {
  const response = await axios.post("/auth/password/reset/confirm", {
    token,
    new_password: newPassword,
  });
  return response;
};

/**
 * Verify TOTP 6-digit MFA code for 2-step login.
 * Matches MFALoginVerifyRequest schema: { pre_auth_token, code, device }
 */
const verifyMfa = async (preAuthToken: string, code: string) => {
  const response = await axios.post("/auth/mfa/verify", {
    pre_auth_token: preAuthToken,
    code: code.trim(),
    device: { device_type: "web" },
  });
  return response;
};

/**
 * Request TOTP enrollment for current authenticated user.
 * Returns QR code image URL and secret key.
 */
const enrollMfa = async () => {
  const response = await axios.post("/auth/mfa/enroll");
  return response.data;
};

/**
 * Confirm TOTP enrollment with a 6-digit code.
 */
const confirmMfaEnroll = async (code: string) => {
  const response = await axios.post("/auth/mfa/enroll/confirm", { code: code.trim() });
  return response.data;
};

/**
 * Disable TOTP MFA for current authenticated user.
 */
const disableMfa = async (code: string) => {
  const response = await axios.post("/auth/mfa/disable", { code: code.trim() });
  return response.data;
};

const authService = {
  login,
  getMe,
  updateProfile,
  changePassword,
  refreshSession,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  verifyMfa,
  enrollMfa,
  confirmMfaEnroll,
  disableMfa,
};

export default authService;