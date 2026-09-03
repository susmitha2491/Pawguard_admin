import { useState } from "react";
import Modal from "../common/Modal";
import authService from "../../services/auth/authService";
import { FaEnvelope, FaPaperPlane, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordModal = ({ isOpen, onClose, initialEmail = "" }: ForgotPasswordModalProps) => {
  // State starts fresh on each open; the parent remounts this component via `key`
  // whenever the modal is opened, so no reset-on-effect is needed.
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(trimmed);
      setSent(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: unknown; message?: unknown } } };
      const detail = anyErr?.response?.data?.detail ?? anyErr?.response?.data?.message;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to send the reset link. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const inputContainerStyle: React.CSSProperties = {
    position: "relative",
    marginBottom: "16px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "48px",
    padding: "0 44px 0 42px",
    border: "1px solid #DBE4EE",
    borderRadius: "12px",
    background: "#F8FAFC",
    fontSize: "14.5px",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    height: "48px",
    border: "none",
    borderRadius: "12px",
    background: "#1E3A8A",
    color: "#FFFFFF",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background 0.2s ease",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Forgot Password" maxWidth="440px">
      {sent ? (
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
            <FaCheckCircle size={46} color="#16A34A" />
          </div>
          <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            Check your inbox
          </h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "#64748B" }}>
            If an account exists for <strong style={{ color: "#0F172A" }}>{email.trim()}</strong>, a
            password reset link has been sent. Please check your inbox (and spam folder) and follow
            the link to set a new password.
          </p>
          <button
            onClick={onClose}
            style={{ ...buttonStyle, marginTop: "20px", background: "#E2E8F0", color: "#334155" }}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ margin: "0 0 18px", fontSize: "14px", lineHeight: 1.6, color: "#64748B" }}>
            Enter the email address associated with your account and we&apos;ll send you a link to
            reset your password.
          </p>

          <div style={inputContainerStyle}>
            <FaEnvelope
              size={15}
              style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }}
            />
            <input
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                padding: "10px 12px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "16px",
                lineHeight: 1.4,
              }}
            >
              <FaExclamationTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Sending..." : <><FaPaperPlane size={14} /> Send Reset Link</>}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default ForgotPasswordModal;
