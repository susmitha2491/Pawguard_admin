import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthData,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  clearAuthData,
  isSessionExpired,
  getSessionTimeoutMinutes,
  setSessionTimeoutMinutes,
} from "../utils/authStorage";

describe("Auth Storage & Session Inactivity Engine", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearAuthData(false);
  });

  it("should set user metadata and access token in sessionStorage without storing refresh token in JS storage", () => {
    const mockData = {
      user: { id: "u-123", email: "coordinator@pawguard.org", role: "rescue_coordinator" },
      access_token: "mock_jwt_access_token_123",
      refresh_token: "mock_jwt_refresh_token_456",
    };

    setAuthData(mockData, false, true);

    expect(getStoredUser()).toEqual(mockData.user);
    expect(getAccessToken()).toBe("mock_jwt_access_token_123");
    // SEC-01 verification: Refresh token is strictly handled via HttpOnly cookie and returns null from storage helpers
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("should clear session user metadata and tokens on clearAuthData", () => {
    setAuthData({ user: { id: "u-1" }, access_token: "token_abc" }, false, true);
    expect(getAccessToken()).toBe("token_abc");

    clearAuthData(false);

    expect(getStoredUser()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should enforce session inactivity timeout correctly", () => {
    setSessionTimeoutMinutes(30);
    expect(getSessionTimeoutMinutes()).toBe(30);

    const user = { id: "u-2", email: "staff@pawguard.org" };
    setAuthData({ user }, false, true);

    expect(isSessionExpired()).toBe(false);
  });
});
