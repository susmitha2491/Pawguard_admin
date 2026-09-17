import { describe, it, expect, beforeEach } from "vitest";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../utils/rbac";
import { normalizeRole, isInternalRole } from "../utils/roleUtils";
import { AUTH_STORAGE_KEYS } from "../utils/authStorage";

describe("RBAC & Role Utility Engine", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should correctly normalize role representations", () => {
    expect(normalizeRole({ role: "super_admin" })).toBe("super_admin");
    expect(normalizeRole({ roles: ["shelter_manager"] })).toBe("shelter_manager");
    expect(normalizeRole({ role: "veterinarian" })).toBe("veterinarian");
    expect(normalizeRole({ role: "INVALID_ROLE" })).toBeNull();
  });

  it("should identify internal staff roles vs public roles", () => {
    expect(isInternalRole({ role: "super_admin" })).toBe(true);
    expect(isInternalRole({ role: "rescue_coordinator" })).toBe(true);
    expect(isInternalRole({ role: "shelter_manager" })).toBe(true);
    expect(isInternalRole({ role: "general_public" })).toBe(false);
  });

  it("should grant Super Admin unrestricted permission checks", () => {
    const superAdminUser = {
      id: "admin-1",
      email: "admin@pawguard.org",
      role: "super_admin",
      permissions: [],
    };
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(superAdminUser));

    expect(hasPermission("view_users")).toBe(true);
    expect(hasPermission("delete_shelter")).toBe(true);
    expect(hasAnyPermission(["view_finance", "non_existent_perm"])).toBe(true);
    expect(hasAllPermissions(["view_users", "manage_settings"])).toBe(true);
  });

  it("should evaluate explicit permission lists for non-superadmin roles", () => {
    const vetUser = {
      id: "vet-1",
      email: "vet@pawguard.org",
      role: "veterinarian",
      permissions: ["view_medical", "edit_medical", "view_animals"],
    };
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(vetUser));

    expect(hasPermission("view_medical")).toBe(true);
    expect(hasPermission("manage_settings")).toBe(false);
    expect(hasAnyPermission(["manage_settings", "view_medical"])).toBe(true);
    expect(hasAllPermissions(["view_medical", "manage_settings"])).toBe(false);
  });
});
