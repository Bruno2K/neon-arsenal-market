import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminUsers from "../AdminUsers";
import type { User } from "@/types/api";

const listAdminUsers = vi.fn();

vi.mock("@/api/admin", () => ({
  listAdminUsers: (...args: unknown[]) => listAdminUsers(...args),
}));

function user(): User {
  return {
    id: "user-1",
    name: "Admin User",
    email: "admin@skinmarket.gg",
    role: "ADMIN",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
}

function renderUsers() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminUsers", () => {
  beforeEach(() => {
    listAdminUsers.mockReset();
  });

  it("lists users as read-only", async () => {
    listAdminUsers.mockResolvedValue([user()]);

    renderUsers();

    expect(await screen.findByText("Usuários")).toBeTruthy();
    expect(screen.getByText("Admin User")).toBeTruthy();
    expect(screen.getByText("admin@skinmarket.gg")).toBeTruthy();
    expect(screen.getByText("ADMIN")).toBeTruthy();
    expect(listAdminUsers).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Suspender" })).toBeNull();
  });
});
