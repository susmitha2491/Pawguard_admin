/**
 * Shared API error message extraction utility.
 * Gracefully extracts user-facing error details from various backend error formats
 * without exposing technical HTTP codes, raw Axios objects, or stack traces.
 */
export const extractErrorMessage = (err: any, fallback = "An unexpected error occurred."): string => {
  if (!err) return fallback;

  // 1. Standard PawGuard backend error object: err.response.data.error.message
  if (err?.response?.data?.error?.message && typeof err.response.data.error.message === "string") {
    return err.response.data.error.message;
  }

  // 2. String in err.response.data.error
  if (typeof err?.response?.data?.error === "string") {
    return err.response.data.error;
  }

  // 3. Object in err.response.data.error with message or msg
  if (err?.response?.data?.error && typeof err.response.data.error === "object") {
    const objMsg = err.response.data.error.message || err.response.data.error.msg;
    if (typeof objMsg === "string" && objMsg.trim() !== "") {
      return objMsg;
    }
  }

  // 4. FastAPI detail string
  if (typeof err?.response?.data?.detail === "string") {
    return err.response.data.detail;
  }

  // 5. FastAPI validation error list in detail
  if (Array.isArray(err?.response?.data?.detail) && err.response.data.detail.length > 0) {
    const messages = err.response.data.detail
      .map((item: any) => (typeof item === "string" ? item : item?.msg || item?.message || JSON.stringify(item)))
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  // 6. Generic response message: err.response.data.message
  if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim() !== "") {
    return err.response.data.message;
  }

  // 7. Contextual 409 Conflict fallback (e.g. duplicate volunteer application)
  if (err?.response?.status === 409) {
    return "An active volunteer application or registered profile already exists for this applicant.";
  }

  // 8. Plain JS error message (avoiding raw axios status code strings like 'Request failed with status code 409')
  if (typeof err?.message === "string" && err.message.trim() !== "" && !err.message.includes("status code")) {
    return err.message;
  }

  return fallback;
};

export default extractErrorMessage;
