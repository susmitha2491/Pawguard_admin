import { describe, it, expect, vi, beforeEach } from "vitest";
import petService from "../services/petService";
import api from "../api/axios";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("petService Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch paginated dogs list with query params", async () => {
    const mockApiResponse = {
      data: {
        data: [
          { id: "dog-1", name: "Buddy", breed: "Golden Retriever", status: "available" },
          { id: "dog-2", name: "Max", breed: "Beagle", status: "shelter" },
        ],
        meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
      },
    };

    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockApiResponse);

    const result = await petService.getDogs({ page: 1, limit: 10, status: "available" });

    expect(api.get).toHaveBeenCalledWith("/dogs", expect.objectContaining({
      params: expect.objectContaining({ page: 1, limit: 10, status: "available" }),
    }));
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe("Buddy");
  });

  it("should fetch companion pet safety tag metadata", async () => {
    const mockTagRes = {
      data: {
        data: {
          tag_id: "tag-101",
          raw_token: "token_xyz_789",
          qr_code_url: "https://pawguard.org/qr/101",
        },
      },
    };

    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockTagRes);

    const res = await petService.getCompanionPetSafetyTagMetadata("cp-101");
    expect(api.get).toHaveBeenCalledWith("/companion-pets/cp-101/safety-tag");
    expect(res.data.raw_token).toBe("token_xyz_789");
  });
});
