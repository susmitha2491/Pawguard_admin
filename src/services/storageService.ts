import api from "../api/axios";

import { resolveImageUrl } from "../utils/imageUtils";

export interface StorageUploadPayload {
  original_filename: string;
  mime_type: string;
  file_size: number;
  folder?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface StorageUploadResponse {
  upload_url: string;
  object_key: string;
  file_id: string;
}

export interface StorageDownloadResponse {
  download_url: string;
  object_key: string;
  file_id: string;
}

export const storageService = {
  /**
   * Request a presigned upload URL from the backend storage API.
   */
  requestUploadUrl: async (payload: StorageUploadPayload): Promise<StorageUploadResponse> => {
    const response = await api.post("/storage/upload-url", payload);
    const data = response.data?.data || response.data;
    return data as StorageUploadResponse;
  },

  /**
   * Confirm that a file has been uploaded to storage.
   */
  confirmUpload: async (fileId: string): Promise<unknown> => {
    const response = await api.put(`/storage/${fileId}/confirm`);
    return response.data;
  },

  /**
   * Delete a stored file by file ID from storage and database.
   */
  deleteFile: async (fileId: string): Promise<void> => {
    await api.delete(`/storage/${fileId}`);
  },

  /**
   * Retrieve a presigned download URL for a stored file.
   */
  getDownloadUrl: async (fileId: string): Promise<StorageDownloadResponse> => {
    const response = await api.get(`/storage/${fileId}/download-url`);
    const data = response.data?.data || response.data;
    return data as StorageDownloadResponse;
  },

  /**
   * Retrieve all files in the storage system (admin query).
   */
  getStoredFiles: async (params?: Record<string, unknown>): Promise<any[]> => {
    const response = await api.get("/storage", { params });
    const body = response.data;
    const data = body?.data || body?.items || body || [];
    return Array.isArray(data) ? data : [];
  },

  /**
   * List confirmed storage files associated with a specific entity.
   */
  getFilesByEntity: async (entityType: string, entityId: string): Promise<any[]> => {
    const response = await api.get(`/storage/entity/${entityType}/${entityId}`);
    const body = response.data;
    const data = body?.data || body || [];
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetch confirmed storage files and map dogId to embedded photo download URL directly.
   * Uses direct embedded URLs from backend storage payload to avoid N+1 per-file HTTP calls.
   */
  buildPhotoMapForDogs: async (): Promise<Record<string, string>> => {
    try {
      const response = await api.get("/storage", { params: { page_size: 200 } });
      const body = response.data;
      const files = body?.data || body?.items || body || [];
      const confirmed = Array.isArray(files) 
        ? files.filter((f: any) => f.entity_type === "dog_profile" && f.is_uploaded)
        : [];
        
      const resolvedMap: Record<string, string> = {};
      confirmed.forEach((f: any) => {
        const dId = f.entity_id;
        if (!dId) return;
        const directUrl = f.object_key
          ? `/api/v1/storage/media/original/${f.object_key}`
          : f.download_url || f.file_url || f.public_url || f.url || f.presigned_url;
        if (directUrl && typeof directUrl === "string") {
          resolvedMap[dId] = resolveImageUrl(directUrl);
        }
      });

      return resolvedMap;
    } catch (err) {
      console.warn("Failed to build dog photo map:", err);
      return {};
    }
  },

  /**
   * Upload an image file directly (supports adoption_images, lost_found, dogs).
   * Attempts direct POST /storage/upload-file multipart endpoint first,
   * falling back to the presigned storage upload workflow.
   */
  uploadImage: async (file: File, folder = "dogs"): Promise<string> => {
    // 1. Map folder name to valid backend FileFolder enum: "dogs" | "lost_found" | "shelters" | "adoptions"
    let backendFolder = folder;
    if (folder === "adoption_images" || folder === "adoptions") {
      backendFolder = "adoptions";
    } else if (folder === "dog_images" || folder === "dogs") {
      backendFolder = "dogs";
    } else if (folder === "lost_found") {
      backendFolder = "lost_found";
    } else if (folder === "shelters") {
      backendFolder = "shelters";
    }

    // 2. Try direct upload endpoint POST /storage/upload-file with multipart/form-data and query folder parameter
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/storage/upload-file", formData, {
        params: { folder: backendFolder },
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data?.data || res.data;
      if (data?.object_key) {
        return `/api/v1/storage/media/original/${data.object_key}`;
      }
      const rawUrl =
        data?.cdn_url ||
        data?.url ||
        data?.file_url ||
        data?.download_url ||
        data?.media_url ||
        data?.photo_url ||
        (typeof data === "string" ? data : "");
      if (rawUrl && typeof rawUrl === "string") {
        return resolveImageUrl(rawUrl);
      }
    } catch {
      // Fall through to presigned upload pipeline
    }

    return await storageService.uploadFile(file, {
      folder: backendFolder,
      entity_type: backendFolder === "lost_found" ? "lost_found" : "dog_profile",
    });
  },

  /**
   * Complete end-to-end file upload workflow:
   * 1. Get presigned upload URL from backend
   * 2. PUT binary file directly to presigned S3/Supabase URL
   * 3. Confirm upload with backend
   * 4. Return persistent media stream URL
   */
  uploadFile: async (
    file: File,
    options: {
      folder?: string;
      entity_type?: string;
      entity_id?: string;
    } = {}
  ): Promise<string> => {
    let folder = options.folder || "dogs";
    if (folder === "adoption_images") {
      folder = "adoptions";
    }
    const entityType = options.entity_type || (folder === "lost_found" ? "lost_found" : "dog_profile");

    // 1. Request presigned upload URL
    const uploadRes = await storageService.requestUploadUrl({
      original_filename: file.name,
      mime_type: file.type || "image/jpeg",
      file_size: file.size,
      folder,
      entity_type: entityType,
      entity_id: options.entity_id,
    });

    const { upload_url, file_id, object_key } = uploadRes;
    if (!upload_url || !file_id) {
      throw new Error("Failed to generate storage upload URL.");
    }

    // 2. Upload file binary directly to presigned S3 / Supabase URL via PUT
    const s3Response = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "image/jpeg",
      },
      body: file,
    });

    if (!s3Response.ok) {
      throw new Error(`Storage upload failed with HTTP status ${s3Response.status}`);
    }

    // 3. Confirm upload with backend
    await storageService.confirmUpload(file_id);

    // 4. Return backend media stream URL if object_key is known
    if (object_key) {
      return `/api/v1/storage/media/original/${object_key}`;
    }

    // 5. Retrieve presigned download URL fallback
    let persistentUrl = "";
    try {
      const downloadRes = await storageService.getDownloadUrl(file_id);
      persistentUrl = downloadRes.download_url || "";
    } catch {
      /* ignore download_url fetch error and use upload_url fallback */
    }

    if (!persistentUrl && upload_url) {
      persistentUrl = upload_url.split("?")[0];
    }

    return resolveImageUrl(persistentUrl);
  },
};

export default storageService;
