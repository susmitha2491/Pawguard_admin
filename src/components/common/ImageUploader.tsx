import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { FaTrash, FaSpinner, FaCloudUploadAlt, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import storageService from "../../services/storageService";
import { resolveImageUrl } from "../../utils/imageUtils";

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

interface PreviewItem {
  id: string;
  url: string;
  isObjectUrl: boolean;
  isUploading: boolean;
  file?: File;
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

  // Track all created object URLs to revoke on removal or unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Internal preview items containing local previews (object URLs) and remote uploaded URLs
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);

  // Normalize incoming value prop
  const propUrls = useMemo<string[]>(() => {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    }
    if (typeof value === "string" && value.trim() !== "") {
      return [value.trim()];
    }
    return [];
  }, [value]);

  // Synchronize incoming propUrls when not in active local upload
  useEffect(() => {
    if (uploading) return;

    setPreviewItems((prev) => {
      // Check if current items already match propUrls exactly
      const currentRemoteUrls = prev.filter((p) => !p.isObjectUrl).map((p) => p.url);
      if (
        currentRemoteUrls.length === propUrls.length &&
        currentRemoteUrls.every((u, idx) => u === propUrls[idx])
      ) {
        return prev;
      }

      // Rebuild preview items from propUrls
      return propUrls.map((url) => ({
        id: url,
        url,
        isObjectUrl: false,
        isUploading: false,
      }));
    });
  }, [propUrls, uploading]);

  // Cleanup all object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore cleanup errors
        }
      });
      urls.clear();
    };
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
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
        if (!multiple) break; // In single mode, take only the first file
      }

      if (validFiles.length === 0) return;

      // 1. Generate immediate local object URLs for instant preview
      const newItems: PreviewItem[] = validFiles.map((file) => {
        const objectUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(objectUrl);
        return {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          url: objectUrl,
          isObjectUrl: true,
          isUploading: true,
          file,
        };
      });

      // Update preview state immediately so images appear instantly in the box
      if (multiple) {
        setPreviewItems((prev) => [...prev, ...newItems]);
      } else {
        // Clean up old object URLs if single mode
        setPreviewItems((prev) => {
          prev.forEach((item) => {
            if (item.isObjectUrl) {
              URL.revokeObjectURL(item.url);
              objectUrlsRef.current.delete(item.url);
            }
          });
          return newItems;
        });
      }

      setUploading(true);
      if (onUploadingChange) onUploadingChange(true);

      // 2. Perform backend storage upload asynchronously
      try {
        const uploadedMap = new Map<string, string>(); // newItems.id -> remoteUrl

        for (const item of newItems) {
          if (!item.file) continue;
          try {
            const uploadedUrl = await storageService.uploadImage(item.file, folder);
            if (uploadedUrl) {
              uploadedMap.set(item.id, uploadedUrl);
            }
          } catch (fileErr: any) {
            const errMsg =
              fileErr?.response?.data?.detail ||
              fileErr?.response?.data?.message ||
              fileErr?.message ||
              `Failed to upload ${item.file.name}`;
            setError(errMsg);
          }
        }

        // 3. Update preview items: replace object URLs with remote URLs
        setPreviewItems((prev) => {
          const updated = prev
            .map((item) => {
              if (uploadedMap.has(item.id)) {
                const remoteUrl = uploadedMap.get(item.id)!;
                // Revoke the temporary local object URL
                if (item.isObjectUrl) {
                  URL.revokeObjectURL(item.url);
                  objectUrlsRef.current.delete(item.url);
                }
                return {
                  ...item,
                  url: remoteUrl,
                  isObjectUrl: false,
                  isUploading: false,
                };
              }
              // If this item was one of the newly added items but upload failed, drop it
              if (newItems.some((n) => n.id === item.id) && !uploadedMap.has(item.id)) {
                if (item.isObjectUrl) {
                  URL.revokeObjectURL(item.url);
                  objectUrlsRef.current.delete(item.url);
                }
                return null;
              }
              return item;
            })
            .filter((item): item is PreviewItem => item !== null);

          // Notify parent onChange with updated remote URLs
          const finalRemoteUrls = updated
            .filter((item) => !item.isObjectUrl && item.url)
            .map((item) => item.url);

          if (multiple) {
            onChange(finalRemoteUrls);
          } else {
            onChange(finalRemoteUrls[0] || "");
          }

          return updated;
        });
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Image upload failed. Please try again.";
        setError(msg);
      } finally {
        setUploading(false);
        if (onUploadingChange) onUploadingChange(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [disabled, uploading, maxSizeMb, multiple, onUploadingChange, folder, onChange]
  );

  const handleRemove = (indexToRemove: number) => {
    if (disabled) return;

    setPreviewItems((prev) => {
      const itemToRemove = prev[indexToRemove];
      if (itemToRemove && itemToRemove.isObjectUrl) {
        try {
          URL.revokeObjectURL(itemToRemove.url);
          objectUrlsRef.current.delete(itemToRemove.url);
        } catch {
          // ignore
        }
      }

      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      const remainingRemoteUrls = updated
        .filter((item) => !item.isObjectUrl && item.url)
        .map((item) => item.url);

      if (multiple) {
        onChange(remainingRemoteUrls);
      } else {
        onChange(remainingRemoteUrls[0] || "");
      }

      return updated;
    });
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

      {/* Previews Grid */}
      {previewItems.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "6px",
            alignItems: "center",
          }}
        >
          {previewItems.map((item, idx) => (
            <div
              key={item.id || `${item.url}-${idx}`}
              style={{
                position: "relative",
                width: multiple ? "100px" : "130px",
                height: multiple ? "100px" : "130px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "2px solid #CBD5E1",
                background: "#0F172A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxSizing: "border-box",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <img
                src={resolveImageUrl(item.url)}
                alt={label ? `${label} preview ${idx + 1}` : `Dog photo preview ${idx + 1}`}
                style={{
                  width: "100%",
                  height: "100%",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "cover",
                  display: "block",
                  borderRadius: "6px",
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.opacity = "0.4";
                }}
              />

              {/* Uploading progress overlay */}
              {item.isUploading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.65)",
                    backdropFilter: "blur(2px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    gap: "4px",
                    zIndex: 5,
                  }}
                >
                  <FaSpinner
                    className="fa-spin"
                    style={{
                      animation: "spin 1s linear infinite",
                      fontSize: "18px",
                      color: "#60A5FA",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                    }}
                  >
                    UPLOADING
                  </span>
                </div>
              )}

              {/* Red remove button inside preview box */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(idx);
                }}
                disabled={disabled}
                title="Remove photo"
                style={{
                  position: "absolute",
                  top: "6px",
                  right: "6px",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  border: "2px solid #FFFFFF",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: "11px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  zIndex: 10,
                  transition: "background 0.2s, transform 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#B91C1C";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#DC2626";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button / drop area */}
      {(!previewItems.length || multiple) && (
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
            padding: previewItems.length > 0 ? "12px 16px" : "16px 20px",
            textAlign: "center",
            background: uploading ? "#F8FAFC" : "#FFFFFF",
            cursor: disabled || uploading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease-in-out",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          {uploading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#2563EB",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              <FaSpinner className="fa-spin" style={{ animation: "spin 1s linear infinite" }} />
              Uploading photo(s) to storage...
            </div>
          ) : (
            <>
              <div style={{ color: "#2563EB", fontSize: previewItems.length > 0 ? "20px" : "24px" }}>
                <FaCloudUploadAlt />
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#1E293B" }}>
                {previewItems.length > 0
                  ? "Click to add another photo or drag & drop"
                  : "Click to browse or drag & drop photo"}
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
      {!multiple && previewItems.length > 0 && !uploading && !previewItems.some((p) => p.isUploading) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#059669",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <FaCheckCircle /> Photo ready and attached
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
