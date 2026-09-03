import api from "../api/axios";
import { publishActionEvent } from "../utils/eventSystem";
import { getAccessToken } from "../utils/authStorage";

export interface PetPayload {
  id?: string;
  name: string;
  breed?: string;
  breed_classification?: string;
  gender?: string;
  estimated_age?: string;
  age_months?: number;
  weight?: number;
  color?: string;
  temperament?: string;
  ear_shape?: string;
  tail_type?: string;
  is_spayed_neutered?: boolean;
  is_adoptable?: boolean;
  is_public_visible?: boolean;
  photo_url?: string;
  image_urls?: string[];
  photo_gallery_urls?: string[];
  is_quarantine_passed?: boolean;
  status?: string;
  [key: string]: unknown;
}

export const petService = {
  // GET /dogs (Dog Master / Shelter Intake Records)
  getDogs: async (params?: Record<string, unknown>) => {
    const response = await api.get("/dogs", { params });
    return response.data;
  },

  // GET /companion-pets (Companion Pets across all users when called by Admin)
  getCompanionPets: async (params?: Record<string, unknown>) => {
    const allowedKeys = ["page", "page_size", "sort_by", "sort_order"];
    const cleanParams: Record<string, unknown> = {};
    if (params) {
      for (const k of allowedKeys) {
        if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
          cleanParams[k] = params[k];
        }
      }
    }
    const response = await api.get("/companion-pets", { params: cleanParams });
    const data = response.data;
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const normalized = list.map((cp: any) => ({
      ...cp,
      is_companion_pet: true,
      is_adoptable: cp.is_adoptable === true,
      status: cp.status || "registered",
    }));
    return {
      ...data,
      data: normalized,
    };
  },

  // GET /dogs & /companion-pets — unified or filtered Pet Management query in Admin context
  getPets: async (params?: Record<string, unknown>) => {
    const recordType = (params?.record_type || params?.type || params?.category) as string | undefined;

    // 1. Direct query for Companion Pets Registry screen (GET /api/v1/companion-pets)
    if (recordType === "companion" || recordType === "companion_pets") {
      const cleanParams = { ...params };
      delete cleanParams.record_type;
      delete cleanParams.type;
      delete cleanParams.category;
      if (String(cleanParams.status || "").toLowerCase() === "companion") {
        delete cleanParams.status;
      }
      return petService.getCompanionPets(cleanParams);
    }

    // 2. Direct query for Dog Master Registry screen (GET /api/v1/dogs)
    if (recordType === "master" || recordType === "dog_master") {
      const cleanParams = { ...params };
      delete cleanParams.record_type;
      delete cleanParams.type;
      delete cleanParams.category;
      return petService.getDogs(cleanParams);
    }

    // 3. Default: Unified query combining Dog Master & Companion Pets datasets
    const dogRes = await api.get("/dogs", { params });
    const dogData = dogRes.data;
    const dogList = Array.isArray(dogData?.data) ? dogData.data : Array.isArray(dogData) ? dogData : [];

    try {
      const compRes = await api.get("/companion-pets", { params });
      const compData = compRes.data;
      const compList = Array.isArray(compData?.data) ? compData.data : Array.isArray(compData) ? compData : [];

      if (compList.length > 0) {
        const existingDogIds = new Set(dogList.map((d: any) => d.id || d.dog_id));
        const normalizedCompPets = compList
          .filter((cp: any) => !existingDogIds.has(cp.id) && !existingDogIds.has(cp.original_dog_id))
          .map((cp: any) => ({
            ...cp,
            is_companion_pet: true,
            is_adoptable: cp.is_adoptable === true,
            status: cp.status || "companion",
          }));

        const combined = [...dogList, ...normalizedCompPets];
        const total = (dogData?.meta?.total || dogList.length) + normalizedCompPets.length;

        return {
          ...dogData,
          data: combined,
          meta: { ...(dogData?.meta || {}), total },
        };
      }
    } catch {
      /* fallback to dogList */
    }

    return dogData;
  },

  // In-memory cache to prevent 429 rate limits from repeated paginated scans
  _allDogsPromise: null as Promise<any> | null,
  _lastFetchTime: 0,

  // GET /dogs & /companion-pets — fetch complete dataset across all pages for Admin KPI/table view
  getAllDogs: function (params?: Record<string, unknown>) {
    const now = Date.now();
    if (this._allDogsPromise && now - this._lastFetchTime < 30000 && !params) {
      return this._allDogsPromise;
    }

    this._lastFetchTime = now;
    const promise = (async () => {
      const pageSize = 50;
      const collected: any[] = [];
      try {
        const firstRes = await api.get("/dogs", { params: { ...params, page: 1, page_size: pageSize } });
        const firstBody = firstRes.data;
        const firstList = Array.isArray(firstBody?.data) ? firstBody.data : Array.isArray(firstBody) ? firstBody : [];
        collected.push(...firstList);

        const totalRecords = firstBody?.meta?.total ?? firstBody?.data?.meta?.total ?? collected.length;
        const actualPageSize = firstBody?.meta?.page_size ?? (firstList.length > 0 ? firstList.length : pageSize);
        const totalPages = firstBody?.meta?.total_pages ?? Math.ceil(totalRecords / Math.max(1, actualPageSize));

        for (let p = 2; p <= totalPages; p++) {
          try {
            const pageRes = await api.get("/dogs", { params: { ...params, page: p, page_size: pageSize } });
            const pageBody = pageRes.data;
            const pageList = Array.isArray(pageBody?.data) ? pageBody.data : Array.isArray(pageBody) ? pageBody : [];
            collected.push(...pageList);
          } catch (pErr) {
            console.warn(`Failed to fetch page ${p} of dogs:`, pErr);
          }
        }

        // Merge ALL pages of CompanionPets dataset into global dogs list if accessible
        try {
          const compFirst = await api.get("/companion-pets", { params: { page: 1, page_size: pageSize } });
          const compBody = compFirst.data;
          const compList = Array.isArray(compBody?.data) ? compBody.data : Array.isArray(compBody) ? compBody : [];
          const compTotalPages = compBody?.meta?.total_pages ?? Math.ceil((compBody?.meta?.total ?? compList.length) / pageSize);

          const allCompPets: any[] = [...compList];
          for (let cpPage = 2; cpPage <= compTotalPages; cpPage++) {
            try {
              const pageRes = await api.get("/companion-pets", { params: { page: cpPage, page_size: pageSize } });
              const pageBody = pageRes.data;
              const pageList = Array.isArray(pageBody?.data) ? pageBody.data : Array.isArray(pageBody) ? pageBody : [];
              allCompPets.push(...pageList);
            } catch {
              /* ignore single page error */
            }
          }

          if (allCompPets.length > 0) {
            const existingIds = new Set(collected.map((d: any) => d.id || d.dog_id));
            const normalizedCompanions = allCompPets
              .filter((cp: any) => !existingIds.has(cp.id) && !existingIds.has(cp.original_dog_id))
              .map((cp: any) => ({
                ...cp,
                is_companion_pet: true,
                is_adoptable: cp.is_adoptable === true,
                status: cp.status || "companion",
              }));
            collected.push(...normalizedCompanions);
          }
        } catch {
          /* ignore companion pets fetch failure */
        }

        return {
          success: true,
          data: collected,
          meta: { total: collected.length },
        };
      } catch (err) {
        console.error("petService.getAllDogs Error:", err);
        return { success: false, data: [], meta: { total: 0 } };
      }
    })();

    if (!params) {
      this._allDogsPromise = promise;
    }
    return promise;
  },

  getPetById: async (dogId: string) => {
    const cleanId = String(dogId || "").trim();
    try {
      const response = await api.get(`/dogs/${cleanId}`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const compRes = await api.get(`/companion-pets/${cleanId}`);
        return compRes.data;
      }
      throw err;
    }
  },

  createPet: async (data: Record<string, unknown>) => {
    const response = await api.post("/dogs", data);
    await publishActionEvent({
      module: "shelter",
      action: "create",
      title: "New Dog Intake Registered",
      message: `Dog ${data.name || ""} (${data.breed || "Dog"}) registered in facility database.`,
      targetRoles: [
        "super_admin",
        "rescue_centre_admin",
        "shelter_manager",
        "veterinarian",
        "adoption_coordinator",
      ],
    });
    return response.data;
  },

  updatePet: async (dogId: string, data: Record<string, unknown>) => {
    const response = await api.put(`/dogs/${dogId}`, data);
    await publishActionEvent({
      module: "shelter",
      action: "update",
      title: "Dog Record Updated",
      message: `Profile details for dog ${data.name || dogId} updated.`,
      targetRoles: ["super_admin", "shelter_manager", "veterinarian"],
    });
    return response.data;
  },

  updatePetStatus: async (dogId: string, status: string) => {
    const response = await api.patch(`/dogs/${dogId}/status`, { status });
    await publishActionEvent({
      module: "shelter",
      action: "update",
      title: "Dog Status Changed",
      message: `Status for dog ${dogId} changed to ${status}.`,
      targetRoles: [
        "super_admin",
        "shelter_manager",
        "veterinarian",
        "adoption_coordinator",
      ],
    });
    return response.data;
  },

  markDogAdoptable: async (dogId: string) => {
    let responseData: any;
    try {
      const res = await api.put(`/dogs/${dogId}`, { is_adoptable: true });
      responseData = res.data;
    } catch {
      try {
        const res = await api.patch(`/dogs/${dogId}/status`, { is_adoptable: true, status: "shelter" });
        responseData = res.data;
      } catch {
        const res = await api.put(`/dogs/${dogId}`, { is_adoptable: true, status: "shelter" });
        responseData = res.data;
      }
    }

    await publishActionEvent({
      module: "shelter",
      action: "update",
      title: "Dog Marked Ready for Adoption",
      message: `Dog ${dogId} cleared for adoption listing.`,
      targetRoles: [
        "super_admin",
        "shelter_manager",
        "adoption_coordinator",
        "rescue_centre_admin",
      ],
    });
    return responseData;
  },

  deletePet: async (dogId: string) => {
    const response = await api.delete(`/dogs/${dogId}`);
    await publishActionEvent({
      module: "shelter",
      action: "delete",
      title: "Dog Record Archived",
      message: `Dog record ${dogId} archived from active shelter count.`,
      targetRoles: ["super_admin", "shelter_manager"],
    });
    return response.data;
  },

  /**
   * Fetch staff-only QR image blob for an active Dog Master profile.
   * Calls GET /api/v1/dogs/{dog_id}/qr-image
   */
  getDogQrImage: async (dogId: string): Promise<Blob> => {
    const cleanId = String(dogId || "").trim();
    if (!cleanId) throw new Error("Dog ID is required.");

    const token = getAccessToken();
    const reqHeaders: Record<string, string> = {};
    if (token) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }

    const response = await api.get(`/dogs/${cleanId}/qr-image`, {
      headers: reqHeaders,
      responseType: "blob",
    });
    if (response.data instanceof Blob) {
      return response.data;
    }
    throw new Error("QR endpoint did not return a valid image blob.");
  },

  // GET /dogs/{dog_id}/safety-tag - authenticated Safety Tag metadata for Dog Master record
  getSafetyTagMetadata: async (dogId: string) => {
    const cleanId = String(dogId || "").trim();
    if (!cleanId) throw new Error("Dog ID is required.");
    const response = await api.get(`/dogs/${cleanId}/safety-tag`);
    return response.data;
  },

  // POST /dogs/{dog_id}/safety-tag - provision/generate a new permanent Safety Tag for a Dog Master record
  // Pass forceReissue=true to force re-issuance (POST /dogs/{dog_id}/safety-tag?force_reissue=true)
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

  // POST /companion-pets/safety-tag/scan - public scan endpoint
  scanSafetyTag: async (token: string) => {
    const response = await api.post(`/companion-pets/safety-tag/scan`, { token });
    return response.data;
  },

  // POST /dogs/safety-tag/resolve - resolve a Dog Master Safety Tag token to canonical dog record
  resolveDogSafetyTag: async (token: string) => {
    const clean = String(token || "").trim();
    if (!clean) {
      throw new Error("Safety Tag token is required.");
    }
    const response = await api.post(`/dogs/safety-tag/resolve`, { raw_token: clean });
    return response.data;
  },

  getPublicDogScan: async (identifier: string) => {
    const rawInput = String(identifier || "").trim();
    if (!rawInput) {
      throw new Error("Safety Tag token or Dog identifier is required.");
    }

    let clean = rawInput;
    const lowerInput = rawInput.toLowerCase();
    const isExplicitCompanionPath = lowerInput.includes("companion-pets") || lowerInput.includes("companion_pets");
    const isExplicitDogPath = lowerInput.includes("/dogs");

    // 1. Extract raw token if identifier is a full scan URL (e.g., https://.../scan?token=CMP-12345)
    if (clean.includes("token=")) {
      try {
        const match = clean.match(/token=([^&/#]+)/i);
        if (match && match[1]) {
          clean = decodeURIComponent(match[1].trim());
        }
      } catch {
        /* fallback */
      }
    }

    // 2. Extract UUID if identifier contains an embedded UUID (e.g., /api/v1/companion-pets/7dcf1c50-69ad-4e12-89ab-123456789abc)
    const uuidMatch = clean.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    const extractedUuid = uuidMatch ? uuidMatch[0] : null;

    if (extractedUuid) {
      // If path explicitly indicates companion-pets, resolve directly via companion-pets endpoints
      if (isExplicitCompanionPath) {
        try {
          const compRes = await api.get(`/companion-pets/${extractedUuid}/public-scan`);
          return compRes.data;
        } catch {
          const petRes = await api.get(`/companion-pets/${extractedUuid}`);
          return petRes.data;
        }
      }

      // If path explicitly indicates dogs, resolve directly via dogs endpoints
      if (isExplicitDogPath) {
        try {
          const response = await api.get(`/dogs/${extractedUuid}/public-scan`);
          return response.data;
        } catch {
          const dogRes = await api.get(`/dogs/${extractedUuid}`);
          return dogRes.data;
        }
      }

      // Standalone UUID: try dogs public-scan first, fall back to companion-pets
      try {
        const response = await api.get(`/dogs/${extractedUuid}/public-scan`);
        return response.data;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const compRes = await api.get(`/companion-pets/${extractedUuid}/public-scan`);
          return compRes.data;
        }
        throw err;
      }
    }

    const upperToken = clean.toUpperCase();
    const isDogToken = upperToken.startsWith("DGD");
    const isCompanionToken = upperToken.startsWith("CMP") || upperToken.startsWith("PET");

    // 2. If token is explicitly a Dog Safety Tag token ("DGD...")
    if (isDogToken) {
      try {
        const resolveRes = await api.post(`/dogs/safety-tag/resolve`, { raw_token: clean });
        const resBody = resolveRes?.data || resolveRes;
        const resObj = resBody?.data || resBody;
        const dogObj = resObj?.dog || resObj;
        return {
          ...dogObj,
          id: resObj?.dog_id || dogObj?.id || resObj?.tag_id,
          dog_id: resObj?.dog_id || dogObj?.id || resObj?.tag_id,
          is_active: resObj?.is_active ?? dogObj?.is_active ?? true,
          token_prefix: resObj?.token_prefix || dogObj?.token_prefix,
          scan_count: resObj?.scan_count ?? dogObj?.scan_count,
          last_scanned_at: resObj?.last_scanned_at || dogObj?.last_scanned_at,
          raw_token: clean,
        };
      } catch (err: any) {
        const status = err?.response?.status;
        const apiMsg =
          err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message;
        if (status === 404) {
          throw new Error(`Dog Safety Tag token "${clean}" was not found in the PawGuard database.`, { cause: err });
        }
        throw new Error(apiMsg || `Failed to resolve Dog Safety Tag token "${clean}".`, { cause: err });
      }
    }

    // 3. If token is explicitly a Companion Pet Safety Tag token ("CMP..." / "PET...")
    if (isCompanionToken) {
      try {
        const scanRes = await api.post(`/companion-pets/safety-tag/scan`, { token: clean });
        const resBody = scanRes?.data || scanRes;
        const resObj = resBody?.data || resBody;
        const petObj = resObj?.companion_pet || resObj?.pet || resObj?.dog || resObj?.public_info || resObj;
        return {
          ...petObj,
          id: resObj?.pet_id || resObj?.dog_id || petObj?.id || petObj?.pet_id || resObj?.id,
          dog_id: resObj?.pet_id || resObj?.dog_id || petObj?.id || petObj?.pet_id || resObj?.id,
          is_active: resObj?.is_active ?? petObj?.is_active ?? true,
          token_prefix: resObj?.token_prefix || petObj?.token_prefix,
          scan_count: resObj?.scan_count ?? petObj?.scan_count,
          last_scanned_at: resObj?.last_scanned_at || petObj?.last_scanned_at,
          raw_token: clean,
        };
      } catch (err: any) {
        const status = err?.response?.status;
        const apiMsg =
          err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message;
        if (status === 404) {
          throw new Error(`Companion Pet Safety Tag token "${clean}" was not found in the PawGuard database.`, { cause: err });
        }
        throw new Error(apiMsg || `Failed to scan Companion Pet Safety Tag token "${clean}".`, { cause: err });
      }
    }

    // 4. For generic/unprefixed tokens: try Dog resolver first, fall through to Companion scanner ONLY on 404
    try {
      const resolveRes = await api.post(`/dogs/safety-tag/resolve`, { raw_token: clean });
      const resBody = resolveRes?.data || resolveRes;
      const resObj = resBody?.data || resBody;
      const dogObj = resObj?.dog || resObj;
      if (resObj && (resObj.dog_id || dogObj.id || dogObj.name)) {
        return {
          ...dogObj,
          id: resObj?.dog_id || dogObj?.id || resObj?.tag_id,
          dog_id: resObj?.dog_id || dogObj?.id || resObj?.tag_id,
          is_active: resObj?.is_active ?? dogObj?.is_active ?? true,
          token_prefix: resObj?.token_prefix || dogObj?.token_prefix,
          scan_count: resObj?.scan_count ?? dogObj?.scan_count,
          last_scanned_at: resObj?.last_scanned_at || dogObj?.last_scanned_at,
          raw_token: clean,
        };
      }
    } catch (dogErr: any) {
      const status = dogErr?.response?.status;
      if (status !== 404) {
        const apiMsg =
          dogErr?.response?.data?.error?.message ||
          dogErr?.response?.data?.detail ||
          dogErr?.response?.data?.message ||
          dogErr?.message;
        throw new Error(apiMsg || `Failed to resolve Safety Tag token "${clean}".`, { cause: dogErr });
      }
    }

    // Attempt Companion Pet scan on 404 fallback for generic token
    try {
      const scanRes = await api.post(`/companion-pets/safety-tag/scan`, { token: clean });
      const resBody = scanRes?.data || scanRes;
      const resObj = resBody?.data || resBody;
      const petObj = resObj?.companion_pet || resObj?.pet || resObj?.dog || resObj?.public_info || resObj;
      if (resObj && (resObj.pet_id || resObj.dog_id || petObj.id || petObj.name)) {
        return {
          ...petObj,
          id: resObj?.pet_id || resObj?.dog_id || petObj?.id || petObj?.pet_id || resObj?.id,
          dog_id: resObj?.pet_id || resObj?.dog_id || petObj?.id || petObj?.pet_id || resObj?.id,
          is_active: resObj?.is_active ?? petObj?.is_active ?? true,
          token_prefix: resObj?.token_prefix || petObj?.token_prefix,
          scan_count: resObj?.scan_count ?? petObj?.scan_count,
          last_scanned_at: resObj?.last_scanned_at || petObj?.last_scanned_at,
          raw_token: clean,
        };
      }
    } catch (compErr: any) {
      const apiMsg =
        compErr?.response?.data?.error?.message ||
        compErr?.response?.data?.detail ||
        compErr?.response?.data?.message ||
        compErr?.message;
      throw new Error(apiMsg || `Safety Tag token "${clean}" could not be verified or is invalid.`, { cause: compErr });
    }

    throw new Error(`Safety Tag token "${clean}" could not be verified or is invalid.`);
  },

  /**
   * Returns the exact, unaltered backend-authoritative safety token for a dog record.
   * Strictly returns raw_token if available, otherwise "-". Never substitutes registration_number or dog.id as a token.
   */
  formatSafetyToken: (dog?: { id?: string; registration_number?: string; raw_token?: string } | null): string => {
    if (!dog) return "-";
    if (dog.raw_token && typeof dog.raw_token === "string" && dog.raw_token.trim()) {
      return dog.raw_token.trim().toUpperCase();
    }
    return "-";
  },

  // =========================================================================
  // COMPANION PET SAFETY TAG ENDPOINTS
  // =========================================================================

  // POST /companion-pets/{pet_id}/safety-tag - provision/generate Safety Tag for a Companion Pet
  provisionCompanionPetSafetyTag: async (petId: string, forceReissue = false) => {
    const cleanId = String(petId || "").trim();
    if (!cleanId) throw new Error("Companion Pet ID is required for Safety Tag provisioning.");
    const url = forceReissue
      ? `/companion-pets/${cleanId}/safety-tag?force_reissue=true`
      : `/companion-pets/${cleanId}/safety-tag`;
    const response = await api.post(url);
    return response.data;
  },

  // GET /companion-pets/{pet_id}/safety-tag - get Safety Tag metadata for a Companion Pet
  getCompanionPetSafetyTagMetadata: async (petId: string) => {
    const cleanId = String(petId || "").trim();
    if (!cleanId) throw new Error("Companion Pet ID is required.");
    const response = await api.get(`/companion-pets/${cleanId}/safety-tag`);
    return response.data;
  },

  // DELETE /companion-pets/{pet_id}/safety-tag - revoke Safety Tag for a Companion Pet
  revokeCompanionPetSafetyTag: async (petId: string) => {
    const cleanId = String(petId || "").trim();
    if (!cleanId) throw new Error("Companion Pet ID is required.");
    const response = await api.delete(`/companion-pets/${cleanId}/safety-tag`);
    return response.data;
  },

  // GET /companion-pets/{pet_id}/public-scan - public scan by Companion Pet ID
  getCompanionPetPublicScan: async (petId: string) => {
    const cleanId = String(petId || "").trim();
    if (!cleanId) throw new Error("Companion Pet ID is required.");
    const response = await api.get(`/companion-pets/${cleanId}/public-scan`);
    return response.data;
  },

  // POST /companion-pets/safety-tag/scan - public scan by Companion Pet Safety Tag Token
  scanCompanionPetSafetyTag: async (token: string) => {
    const clean = String(token || "").trim();
    if (!clean) throw new Error("Safety Tag token is required.");
    const response = await api.post(`/companion-pets/safety-tag/scan`, { token: clean });
    return response.data;
  },
};

export default petService;

