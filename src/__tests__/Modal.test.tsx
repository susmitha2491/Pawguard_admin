import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../components/common/Modal";

describe("Modal Accessibility & Behavior Component", () => {
  it("should render modal with dialog role, title, and aria-modal when isOpen is true", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Dialog Title">
        <p>Modal content body</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test Dialog Title");
    expect(screen.getByText("Modal content body")).toBeInTheDocument();
  });

  it("should call onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test Modal">
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when clicking the close button", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Close Button Modal">
        <div>Content</div>
      </Modal>
    );

    const closeBtn = screen.getByRole("button", { name: /Close Escape Test Modal dialog|Close Close Button Modal dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
