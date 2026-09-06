import { describe, expect, it } from "vitest";
import { RESOURCE_ID_MAX, resourceIdSchema } from "../httpLimits.js";
import { registerDto } from "../../../modules/auth/auth.dto.js";
import { listingIdParamsDto, updateListingDto } from "../../../modules/listings/listings.dto.js";

describe("HTTP input limits", () => {
  it("rejects resource ids longer than 128 characters", () => {
    const tooLong = "x".repeat(RESOURCE_ID_MAX + 1);
    expect(resourceIdSchema("Order ID").safeParse(tooLong).success).toBe(false);
    expect(listingIdParamsDto.safeParse({ id: tooLong }).success).toBe(false);
    expect(listingIdParamsDto.safeParse({ id: "listing-1" }).success).toBe(true);
  });

  it("rejects ADMIN at self-registration", () => {
    expect(
      registerDto.safeParse({
        name: "A",
        email: "a@test.local",
        password: "secret1",
        role: "ADMIN",
      }).success
    ).toBe(false);
  });

  it("strips client listing status from the generic update DTO", () => {
    expect(updateListingDto.parse({ price: 12.5, status: "SOLD" })).toEqual({ price: 12.5 });
  });
});
