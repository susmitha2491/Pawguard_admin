import api from "../api/axios";

export interface DogPayload {
  id?: string;
  name: string;
  breed?: string;
  age?: number;
  gender?: string;
  ear_shape?: string;
  tail_type?: string;
  status?: string;
  description?: string;
  is_adoptable?: boolean;
  is_public_visible?: boolean;
  photo_url?: string;
  image_urls?: string[];
  photo_gallery_urls?: string[];
  registration_number?: string;
  [key: string]: unknown;
}

export const dogService = {
  // GET /dogs
  getDogs: async (params?: Record<string, unknown>) => {
    const response = await api.get("/dogs", { params });
    return response.data;
  },

  // GET /dogs — fetch page 1 (or requested params) without scanning all pages sequentially
  getAllDogs: async (params?: Record<string, unknown>) => {
    const pageSize = (params?.page_size as number) || 50;
    const response = await api.get("/dogs", { params: { page: 1, page_size: pageSize, ...params } });
    const body = response.data;
    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return { success: true, data: list, meta: body?.meta };
  },

  // POST /dogs
  createDog: async (data: DogPayload) => {
    const response = await api.post("/dogs", data);
    return response.data;
  },

  // GET /dogs/{dog_id}
  getDogById: async (dogId: string) => {
    const response = await api.get(`/dogs/${dogId}`);
    return response.data;
  },

  // PUT /dogs/{dog_id}
  updateDog: async (dogId: string, data: Partial<DogPayload>) => {
    const response = await api.put(`/dogs/${dogId}`, data);
    return response.data;
  },

  // DELETE /dogs/{dog_id}
  deleteDog: async (dogId: string) => {
    const response = await api.delete(`/dogs/${dogId}`);
    return response.data;
  },

  // GET /dogs/{dog_id}/safety-tag - authenticated Safety Tag metadata for Dog Master record
  getSafetyTagMetadata: async (dogId: string) => {
    const response = await api.get(`/dogs/${dogId}/safety-tag`);
    return response.data;
  },

  // POST /dogs/{dog_id}/safety-tag - provision/generate a permanent Safety Tag for a Dog Master record
  provisionSafetyTag: async (dogId: string, forceReissue = false) => {
    const url = forceReissue ? `/dogs/${dogId}/safety-tag?force_reissue=true` : `/dogs/${dogId}/safety-tag`;
    const response = await api.post(url);
    return response.data;
  },

  // DELETE /dogs/{dog_id}/safety-tag - revoke/deactivate a Dog Master record's Safety Tag
  revokeSafetyTag: async (dogId: string) => {
    const response = await api.delete(`/dogs/${dogId}/safety-tag`);
    return response.data;
  },

  // POST /dogs/safety-tag/resolve - resolve Safety Tag token to canonical dog record
  resolveSafetyTag: async (token: string) => {
    const clean = String(token || "").trim();
    const response = await api.post(`/dogs/safety-tag/resolve`, { raw_token: clean, token: clean });
    return response.data;
  },
};

export default dogService;