import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: { findUnique: vi.fn() },
  },
}));

vi.mock("../favorites.repository.js", () => ({
  favoritesRepository: {
    findManyByUserId: vi.fn(),
    create: vi.fn(),
    deleteByUserAndListing: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { favoritesRepository } from "../favorites.repository.js";
import { favoritesService } from "../favorites.service.js";
import { createFavoriteDto } from "../favorites.dto.js";

function uniqueConflict() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
    meta: { target: ["userId", "listingId"] },
  });
}

describe("favoritesService (#106 / SPEC-0004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives owner from the authenticated userId argument, never from body", () => {
    const parsed = createFavoriteDto.parse({ listingId: "listing-1", userId: "attacker" });
    expect(parsed).toEqual({ listingId: "listing-1" });
    expect("userId" in parsed).toBe(false);
  });

  it("lists only the caller's favorites with listingId + listing", async () => {
    vi.mocked(favoritesRepository.findManyByUserId).mockResolvedValue([
      {
        listingId: "listing-1",
        listing: { id: "listing-1", status: "SOLD" },
      },
    ] as never);

    const result = await favoritesService.list("user-1");
    expect(favoritesRepository.findManyByUserId).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({
      items: [{ listingId: "listing-1", listing: { id: "listing-1", status: "SOLD" } }],
    });
  });

  it("returns 404 when the listing does not exist", async () => {
    vi.mocked(prisma.listing.findUnique).mockResolvedValue(null);
    await expect(favoritesService.add("user-1", { listingId: "missing" })).rejects.toMatchObject({
      statusCode: 404,
      message: "Listing not found",
    });
    expect(favoritesRepository.create).not.toHaveBeenCalled();
  });

  it("creates a favorite for the token subject", async () => {
    vi.mocked(prisma.listing.findUnique).mockResolvedValue({ id: "listing-1" } as never);
    vi.mocked(favoritesRepository.create).mockResolvedValue({ id: "fav-1" } as never);

    await expect(favoritesService.add("user-1", { listingId: "listing-1" })).resolves.toEqual({
      listingId: "listing-1",
    });
    expect(favoritesRepository.create).toHaveBeenCalledWith({
      user: { connect: { id: "user-1" } },
      listing: { connect: { id: "listing-1" } },
    });
  });

  it("treats a unique-constraint POST as 200/no-op", async () => {
    vi.mocked(prisma.listing.findUnique).mockResolvedValue({ id: "listing-1" } as never);
    vi.mocked(favoritesRepository.create).mockRejectedValue(uniqueConflict());

    await expect(favoritesService.add("user-1", { listingId: "listing-1" })).resolves.toEqual({
      listingId: "listing-1",
    });
  });

  it("deletes only the caller's row for that listing", async () => {
    vi.mocked(favoritesRepository.deleteByUserAndListing).mockResolvedValue({ count: 0 });
    await favoritesService.remove("user-1", "listing-1");
    expect(favoritesRepository.deleteByUserAndListing).toHaveBeenCalledWith("user-1", "listing-1");
  });
});
