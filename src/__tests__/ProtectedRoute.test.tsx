import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "../components/layout/ProtectedRoute/ProtectedRoute";
import { AUTH_STORAGE_KEYS } from "../utils/authStorage";

// Mock authService.getMe to avoid external network calls during route protection tests
vi.mock("../services/auth/authService", () => ({
  default: {
    getMe: vi.fn().mockResolvedValue({ data: { user: { role: "super_admin" } } }),
  },
}));

describe("ProtectedRoute Route Guard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should redirect unauthenticated users to the Login page '/'", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Protected Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Dashboard")).toBeNull();
  });

  it("should allow Super Admin to access protected routes", () => {
    const superAdminUser = {
      id: "admin-1",
      email: "admin@pawguard.org",
      role: "super_admin",
      permissions: [],
    };
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(superAdminUser));

    render(
      <MemoryRouter initialEntries={["/system-settings"]}>
        <Routes>
          <Route path="/" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
            <Route path="/system-settings" element={<div>System Settings Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("System Settings Page")).toBeInTheDocument();
  });

  it("should redirect unauthorized role to '/403' Error Page", () => {
    const rescueAgent = {
      id: "agent-1",
      email: "agent@pawguard.org",
      role: "rescue_agent",
      permissions: ["view_rescues"],
    };
    sessionStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(rescueAgent));

    render(
      <MemoryRouter initialEntries={["/finance"]}>
        <Routes>
          <Route path="/" element={<div>Login Page</div>} />
          <Route path="/403" element={<div>Access Denied 403</div>} />
          <Route element={<ProtectedRoute allowedRoles={["finance_user", "super_admin"]} />}>
            <Route path="/finance" element={<div>Finance Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Access Denied 403")).toBeInTheDocument();
    expect(screen.queryByText("Finance Dashboard")).toBeNull();
  });
});
