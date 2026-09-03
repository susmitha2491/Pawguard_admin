import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../../components/auth/AuthLayout";
import LoginCard from "../../components/auth/LoginCard";
import PasswordInput from "../../components/auth/PasswordInput";
import PawGuardLogo from "../../components/common/PawGuardLogo";
import authService from "../../services/auth/authService";
import { FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import "./Login.css";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("The password reset link is invalid or missing. Please request a new reset link.");
      return;
    }
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match. Please try again.");
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPasswordReset(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: unknown; message?: unknown } } };
      const detail = anyErr?.response?.data?.detail ?? anyErr?.response?.data?.message;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to reset your password. The link may be invalid or expired. Please request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  };

  const messageBox = (
    children: React.ReactNode,
    variant: "success" | "error"
  ): React.ReactNode => {
    const isSuccess = variant === "success";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          background: isSuccess ? "#ECFDF5" : "#FEF2F2",
          border: `1px solid ${isSuccess ? "#A7F3D0" : "#FCA5A5"}`,
          color: isSuccess ? "#065F46" : "#991B1B",
          padding: "14px 16px",
          borderRadius: "12px",
          fontSize: "14px",
          lineHeight: 1.5,
        }}
      >
        {isSuccess ? (
          <FaCheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        ) : (
          <FaExclamationTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        )}
        <span>{children}</span>
      </div>
    );
  };

  return (
    <AuthLayout>
      <LoginCard>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <PawGuardLogo size={48} />
        </div>

        <h1 className="login-title">PawGuard</h1>

        <p className="login-subtitle">
          {success ? "Password updated" : "Set a new password"}
        </p>

        {success ? (
          <>
            {messageBox(
              <>
                Your password has been reset successfully. You can now sign in with your new
                password.
              </>,
              "success"
            )}
            <button
              type="button"
              className="login-button"
              onClick={() => navigate("/")}
              style={{ marginTop: "20px" }}
            >
              Back to Sign In
            </button>
          </>
        ) : !token ? (
          <>
            {messageBox(
              <>
                The password reset link is invalid or missing. Please use the link from the reset
                email, or request a new one from the sign-in page.
              </>,
              "error"
            )}
            <button
              type="button"
              className="login-button"
              onClick={() => navigate("/")}
              style={{ marginTop: "20px" }}
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="new-password">New Password</label>
              <PasswordInput
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label htmlFor="confirm-password">Confirm New Password</label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
              />
            </div>

            {error && messageBox(error, "error")}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
              style={{ marginTop: error ? "16px" : undefined }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </LoginCard>
    </AuthLayout>
  );
};

export default ResetPassword;
