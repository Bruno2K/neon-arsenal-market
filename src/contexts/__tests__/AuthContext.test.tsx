import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";
import type { User } from "@/types/api";

const me = vi.fn();
const logoutApi = vi.fn();
const updateMe = vi.fn();
const getStoredAccessToken = vi.fn();

vi.mock("@/api/auth", () => ({
  me: (...args: unknown[]) => me(...args),
  logout: (...args: unknown[]) => logoutApi(...args),
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  getStoredAccessToken: () => getStoredAccessToken() as string | null,
}));

vi.mock("@/api/users", () => ({
  updateMe: (...args: unknown[]) => updateMe(...args),
  getMe: vi.fn(),
}));

const customer: User = {
  id: "c1",
  name: "Buyer",
  email: "buyer@test.com",
  role: "CUSTOMER",
};

function Probe() {
  const { user, updateProfile, logout, isLoading } = useAuth();
  if (isLoading) return <div>auth-loading</div>;
  return (
    <div>
      <span data-testid="name">{user?.name ?? "anon"}</span>
      <button
        type="button"
        onClick={() => {
          void updateProfile({ name: "Novo Nome" });
        }}
      >
        save-name
      </button>
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
      >
        sair
      </button>
    </div>
  );
}

describe("AuthContext profile and logout", () => {
  beforeEach(() => {
    me.mockReset();
    logoutApi.mockReset();
    updateMe.mockReset();
    getStoredAccessToken.mockReset();
    getStoredAccessToken.mockReturnValue("access");
    me.mockResolvedValue(customer);
    logoutApi.mockResolvedValue(undefined);
    updateMe.mockResolvedValue({ ...customer, name: "Novo Nome" });
  });

  it("PATCH /users/me updates the in-memory user name", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByTestId("name")).toHaveTextContent("Buyer");
    screen.getByRole("button", { name: "save-name" }).click();

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({ name: "Novo Nome" });
      expect(screen.getByTestId("name")).toHaveTextContent("Novo Nome");
    });
  });

  it("logout calls the revoke helper then drops the user", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(await screen.findByTestId("name")).toHaveTextContent("Buyer");
    screen.getByRole("button", { name: "sair" }).click();

    await waitFor(() => {
      expect(logoutApi).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("name")).toHaveTextContent("anon");
    });
  });
});
