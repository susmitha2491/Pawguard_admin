import React, { useState, useRef } from "react";
import { FaTrash, FaSpinner, FaCloudUploadAlt, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import storageService from "../../services/storageService";

export interface ImageUploaderProps {
  label?: string;
  folder?: "adoption_images" | "lost_found" | "dogs" | "general" | string;
  multiple?: boolean;
  value?: string | string[];
  onChange: (urlOrUrls: any) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  maxSizeMb?: number;
  disabled?: boolean;
  helperText?: string;
}

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label = "Upload Image",
  folder = "adoption_images",
  multiple = false,
  value,
  onChange,
  onUploadingChange,
  maxSizeMb = 5,
  disabled = false,
  helperText = "Supported: JPG, PNG, WEBP (Max 5MB)",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize current values into a list of URLs
  const currentUrls: string[] = Array.isArray(value)
    ? value.filter(Boolean)
    : typeof value === "string" && value.trim()
    ? [value.trim()]
    : [];

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || disabled || uploading) return;
    setError(null);

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
        setError(`"${file.name}" is not an accepted image format. Only JPG, PNG, and WEBP are supported.`);
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`"${file.name}" exceeds the maximum file size limit of ${maxSizeMb}MB.`);
        return;
      }
      validFiles.push(file);
      if (!multiple) break; // Only take the first file in single-image mode
    }

    if (validFiles.length === 0) return;

    try {
      setUploading(true);
      if (onUploadingChange) onUploadingChange(true);

      const uploadedUrls: string[] = [];
      for (const file of validFiles) {
        const url = await storageService.uploadImage(file, folder);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error("Image upload failed. Please try again.");
      }

      if (multiple) {
        const combined = [...currentUrls, ...uploadedUrls];
        onChange(combined);
      } else {
        onChange(uploadedUrls[0]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "Image upload failed. Please try again.";
      setError(msg);
    } finally {
      setUploading(false);
      if (onUploadingChange) onUploadingChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (indexToRemove: number) => {
    if (disabled || uploading) return;
    if (multiple) {
      const updated = currentUrls.filter((_, idx) => idx !== indexToRemove);
      onChange(updated);
    } else {
      onChange("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {label && (
        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
          {label}
        </label>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || uploading}
      />

      {/* Previews */}
      {currentUrls.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "4px" }}>
          {currentUrls.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              style={{
                position: "relative",
                width: multiple ? "90px" : "120px",
                height: multiple ? "90px" : "120px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "2px solid #E2E8F0",
                background: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={url}
                alt={`Upload preview ${idx + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  // Fallback broken image styling
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={disabled || uploading}
                title="Remove image"
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  background: "rgba(220, 38, 38, 0.9)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "50%",
                  width: "22px",
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: disabled || uploading ? "not-allowed" : "pointer",
                  fontSize: "10px",
                  transition: "background 0.2s",
                }}
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button / drop area */}
      {(!currentUrls.length || multiple) && (
        <div
          onClick={() => {
            if (!disabled && !uploading) {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
          style={{
            border: "2px dashed #CBD5E1",
            borderRadius: "8px",
            padding: "16px 20px",
            textAlign: "center",
            background: uploading ? "#F8FAFC" : "#FFFFFF",
            cursor: disabled || uploading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease-in-out",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {uploading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#2563EB", fontWeight: 600, fontSize: "13px" }}>
              <FaSpinner className="fa-spin" style={{ animation: "spin 1s linear infinite" }} />
              Uploading image to storage...
            </div>
          ) : (
            <>
              <div style={{ color: "#2563EB", fontSize: "24px" }}>
                <FaCloudUploadAlt />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                Click to browse or drag & drop image
              </div>
              <div style={{ fontSize: "11px", color: "#64748B" }}>{helperText}</div>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#DC2626",
            fontSize: "12px",
            fontWeight: 600,
            background: "#FEF2F2",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #FCA5A5",
          }}
        >
          <FaExclamationCircle />
          {error}
        </div>
      )}

      {/* Success banner if uploaded in single mode */}
      {!multiple && currentUrls.length > 0 && !uploading && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#059669", fontSize: "12px", fontWeight: 600 }}>
          <FaCheckCircle /> Image ready and attached
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
