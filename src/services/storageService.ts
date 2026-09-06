import api from "../api/axios";

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
        const directUrl = f.download_url || f.file_url || f.public_url || f.url || f.presigned_url;
        if (directUrl && typeof directUrl === "string") {
          resolvedMap[dId] = directUrl.trim();
        }
      });

      return resolvedMap;
    } catch (err) {
      console.warn("Failed to build dog photo map:", err);
      return {};
    }
  },

  /**
   * Complete end-to-end file upload workflow:
   * 1. Get presigned upload URL from backend
   * 2. PUT binary file directly to presigned S3/Supabase URL
   * 3. Confirm upload with backend
   * 4. Retrieve persistent download URL
   */
  uploadFile: async (
    file: File,
    options: {
      folder?: string;
      entity_type?: string;
      entity_id?: string;
    } = {}
  ): Promise<string> => {
    const folder = options.folder || "dogs";
    const entityType = options.entity_type || "dog_profile";

    // 1. Request presigned upload URL
    const uploadRes = await storageService.requestUploadUrl({
      original_filename: file.name,
      mime_type: file.type || "image/jpeg",
      file_size: file.size,
      folder,
      entity_type: entityType,
      entity_id: options.entity_id,
    });

    const { upload_url, file_id } = uploadRes;
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

    // 4. Retrieve presigned download URL (or fallback to base upload URL)
    let persistentUrl = "";
    try {
      const downloadRes = await storageService.getDownloadUrl(file_id);
      persistentUrl = downloadRes.download_url || "";
    } catch {
      /* ignore download_url fetch error and use upload_url fallback */
    }

    if (!persistentUrl && upload_url) {
      persistentUrl = upload_url;
    }

    return persistentUrl;
  },
};

export default storageService;
