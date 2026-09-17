import "@testing-library/jest-dom/vitest";
import { expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Global mock for BroadcastChannel if absent in jsdom
if (typeof window !== "undefined" && !("BroadcastChannel" in window)) {
  class MockBroadcastChannel {
    name: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  (window as unknown as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
}

// Global mock for window.location navigation
if (typeof window !== "undefined") {
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      href: "http://localhost/",
      pathname: "/",
      search: "",
      hash: "",
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
  });
}
