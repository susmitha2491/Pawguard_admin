import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import QuickActionCard from "../components/dashboard/QuickActionCard";

describe("QuickActionCard Component", () => {
  it("should render card title and description with default attributes", () => {
    render(
      <MemoryRouter>
        <QuickActionCard
          title="Register New Pet"
          subtitle="Intake & registration form"
          dataTestId="register-pet-btn"
        />
      </MemoryRouter>
    );

    const btn = screen.getByTestId("register-pet-btn");
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("Register New Pet")).toBeInTheDocument();
    expect(screen.getByText("Intake & registration form")).toBeInTheDocument();
  });

  it("should handle click events cleanly", () => {
    const handleClick = vi.fn();
    render(
      <MemoryRouter>
        <QuickActionCard
          title="Dispatch Vehicle"
          onClick={handleClick}
          className="custom-action-card"
        />
      </MemoryRouter>
    );

    const btn = screen.getByText("Dispatch Vehicle");
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
