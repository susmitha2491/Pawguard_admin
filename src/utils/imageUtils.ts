/**
 * Image and media URL resolution utilities for PawGuard.
 * Ensures all media stored in Supabase private buckets or backend storage
 * is properly proxied through the backend media streaming endpoints.
 */

/**
 * Resolves any raw media URL, relative storage key, or bucket URL
 * into a valid, browser-loadable image URL.
 */
export const resolveImageUrl = (rawUrl?: string | null): string => {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // 1. Immediate local blob URLs and base64 data URIs (used during upload/preview)
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  // 2. Rewrite Supabase direct bucket URLs to backend media proxy endpoint
  // e.g. https://...storage.supabase.co/storage/v1/object/public/pawguard-media/adoptions/xxx.jpg
  if (trimmed.includes("storage.supabase.co") && trimmed.includes("/pawguard-media/")) {
    const filePath = trimmed.split("/pawguard-media/")[1];
    if (filePath) {
      return `/api/v1/storage/media/original/${filePath.replace(/^\/+/, "")}`;
    }
  }

  // 3. Absolute URL pointing to backend media endpoint (strip origin for reliable relative proxying)
  if (trimmed.includes("/api/v1/storage/media/")) {
    const pathIdx = trimmed.indexOf("/api/v1/storage/media/");
    return trimmed.substring(pathIdx);
  }

  // 4. Relative backend media route
  if (trimmed.startsWith("/api/v1/storage/media/")) {
    return trimmed;
  }
  if (trimmed.startsWith("/storage/media/")) {
    return `/api/v1${trimmed}`;
  }

  // 5. Raw storage object keys (e.g., "dogs/xxx.jpg", "adoptions/xxx.jpg", "lost_found/xxx.jpg", "shelters/xxx.jpg", "cms/xxx.jpg")
  if (
    trimmed.startsWith("dogs/") ||
    trimmed.startsWith("adoptions/") ||
    trimmed.startsWith("lost_found/") ||
    trimmed.startsWith("shelters/") ||
    trimmed.startsWith("cms/")
  ) {
    return `/api/v1/storage/media/original/${trimmed}`;
  }

  // 6. External or standard HTTP/HTTPS URLs
  return trimmed;
};

/**
 * Extracts and resolves the authoritative displayable photo URL for a dog/pet object.
 */
export const getDogPhotoUrl = (dog: any, photoMap?: Record<string, string>): string => {
  if (!dog) return "";
  const dId = dog?.id || dog?.dog_id || dog?.registration_number;
  if (dId && photoMap && photoMap[dId]) {
    const mapped = resolveImageUrl(photoMap[dId]);
    if (mapped) return mapped;
  }

  // 1. Photo variants dictionary returned by backend DogProfileResponse
  if (dog.photo_variants && typeof dog.photo_variants === "object") {
    const variantUrl =
      dog.photo_variants.card ||
      dog.photo_variants.original ||
      dog.photo_variants.detail ||
      dog.photo_variants.thumb;
    if (typeof variantUrl === "string" && variantUrl.trim()) {
      const resolved = resolveImageUrl(variantUrl);
      if (resolved) return resolved;
    }
  }

  // 2. Direct photo_url / image_url / avatar_url
  if (typeof dog.photo_url === "string" && dog.photo_url.trim()) {
    const resolved = resolveImageUrl(dog.photo_url);
    if (resolved) return resolved;
  }
  if (typeof dog.image_url === "string" && dog.image_url.trim()) {
    const resolved = resolveImageUrl(dog.image_url);
    if (resolved) return resolved;
  }
  if (typeof dog.avatar_url === "string" && dog.avatar_url.trim()) {
    const resolved = resolveImageUrl(dog.avatar_url);
    if (resolved) return resolved;
  }

  // 3. image_urls array
  if (Array.isArray(dog.image_urls) && dog.image_urls.length > 0) {
    for (const u of dog.image_urls) {
      if (typeof u === "string" && u.trim()) {
        const resolved = resolveImageUrl(u);
        if (resolved) return resolved;
      }
    }
  }

  // 4. photo_gallery_urls array
  if (Array.isArray(dog.photo_gallery_urls) && dog.photo_gallery_urls.length > 0) {
    for (const u of dog.photo_gallery_urls) {
      if (typeof u === "string" && u.trim()) {
        const resolved = resolveImageUrl(u);
        if (resolved) return resolved;
      }
    }
  }

  // 5. photos array
  if (Array.isArray(dog.photos) && dog.photos.length > 0) {
    for (const p of dog.photos) {
      if (typeof p === "string" && p.trim()) {
        const resolved = resolveImageUrl(p);
        if (resolved) return resolved;
      }
      if (p && typeof p.url === "string" && p.url.trim()) {
        const resolved = resolveImageUrl(p.url);
        if (resolved) return resolved;
      }
    }
  }

  // 6. Local storage fallback cache
  if (dId) {
    const cached = localStorage.getItem(`pawguard_dog_photo_${dId}`) || sessionStorage.getItem(`pawguard_dog_photo_${dId}`);
    if (cached) return resolveImageUrl(cached);
  }

  return "";
};
