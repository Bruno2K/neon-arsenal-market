import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMe, updateMe } from "../users";

const get = vi.fn();
const patch = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

const user = {
  id: "user-1",
  name: "Buyer",
  email: "buyer@test.com",
  role: "CUSTOMER" as const,
};

describe("users me API", () => {
  beforeEach(() => {
    get.mockReset();
    patch.mockReset();
    get.mockResolvedValue(user);
    patch.mockResolvedValue({ ...user, name: "Novo" });
  });

  it("loads the current profile from GET /users/me", async () => {
    await expect(getMe()).resolves.toEqual(user);
    expect(get).toHaveBeenCalledWith("/users/me");
  });

  it("sends only the PATCH /users/me body (no current password field)", async () => {
    await updateMe({ name: "Novo", password: "secret1" });
    expect(patch).toHaveBeenCalledWith("/users/me", {
      name: "Novo",
      password: "secret1",
    });
  });
});
