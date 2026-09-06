import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FavoriteButton } from "../FavoriteButton";

const listFavorites = vi.fn();
const addFavorite = vi.fn();
const removeFavorite = vi.fn();
const toast = vi.fn();

const authState = {
  isAuthenticated: false,
  user: null as { id: string; role: string } | null,
};

vi.mock("@/api/favorites", () => ({
  listFavorites: (...args: unknown[]) => listFavorites(...args),
  addFavorite: (...args: unknown[]) => addFavorite(...args),
  removeFavorite: (...args: unknown[]) => removeFavorite(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useOptionalAuth: () => authState,
  useAuth: () => authState,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function renderButton() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/listing/listing-1"]}>
        <Routes>
          <Route
            path="/listing/:id"
            element={<FavoriteButton listingId="listing-1" />}
          />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FavoriteButton", () => {
  beforeEach(() => {
    listFavorites.mockReset();
    addFavorite.mockReset();
    removeFavorite.mockReset();
    toast.mockReset();
    authState.isAuthenticated = false;
    authState.user = null;
    sessionStorage.clear();
    localStorage.clear();
    listFavorites.mockResolvedValue([]);
    addFavorite.mockResolvedValue({
      id: "f1",
      userId: "u1",
      listingId: "listing-1",
    });
  });

  it("sends guests to login with from instead of a fake local wishlist", async () => {
    renderButton();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    );
    expect(await screen.findByText("login-page")).toBeTruthy();
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it("toggles a favorite for an authenticated customer", async () => {
    authState.isAuthenticated = true;
    authState.user = { id: "u1", role: "CUSTOMER" };
    renderButton();
    expect(
      await screen.findByRole("button", { name: "Adicionar aos favoritos" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    );
    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith("listing-1");
    });
  });

  it("treats a duplicate POST 200 as success", async () => {
    authState.isAuthenticated = true;
    authState.user = { id: "u1", role: "CUSTOMER" };
    addFavorite.mockResolvedValue({ listingId: "listing-1" });
    renderButton();
    fireEvent.click(
      await screen.findByRole("button", { name: "Adicionar aos favoritos" }),
    );
    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith("listing-1");
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("rolls back and toasts when the API fails", async () => {
    authState.isAuthenticated = true;
    authState.user = { id: "u1", role: "CUSTOMER" };
    addFavorite.mockRejectedValue(new Error("listing missing"));
    renderButton();
    fireEvent.click(
      await screen.findByRole("button", { name: "Adicionar aos favoritos" }),
    );
    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("does not claim success when a seller would get 403", async () => {
    authState.isAuthenticated = true;
    authState.user = { id: "s1", role: "SELLER" };
    renderButton();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    );
    expect(addFavorite).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("posts the one-shot pending favorite after a customer logs in", async () => {
    sessionStorage.setItem("pendingFavoriteListingId", "listing-1");
    authState.isAuthenticated = true;
    authState.user = { id: "u1", role: "CUSTOMER" };
    renderButton();
    await waitFor(() => {
      expect(addFavorite).toHaveBeenCalledWith("listing-1");
    });
    expect(sessionStorage.getItem("pendingFavoriteListingId")).toBeNull();
  });

  it("does not present sessionStorage pending as a saved list", async () => {
    sessionStorage.setItem("pendingFavoriteListingId", "listing-1");
    renderButton();
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(listFavorites).not.toHaveBeenCalled();
    expect(screen.queryByText("Nenhum favorito")).toBeNull();
  });
});
