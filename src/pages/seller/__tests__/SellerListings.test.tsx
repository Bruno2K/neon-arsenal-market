import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SellerListings from "../SellerListings";
import type { Listing, Product, Seller, User } from "@/types/api";

const getSellerMe = vi.fn();
const getSellerListings = vi.fn();
const listProducts = vi.fn();
const authState = {
  user: {
    id: "seller-user",
    name: "Seller",
    email: "seller@test.com",
    role: "SELLER",
  } as User,
};

vi.mock("@/api", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
  getSellerListings: (...args: unknown[]) => getSellerListings(...args),
  createListing: vi.fn(),
  updateListing: vi.fn(),
  updateListingPrice: vi.fn(),
  cancelListing: vi.fn(),
}));

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function seller(): Seller {
  return {
    id: "seller-1",
    userId: "user-1",
    storeName: "NeonTrader Store",
    balance: 0,
    rating: 0,
    isApproved: true,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    isStattrak: false,
    isSouvenir: false,
    imageUrl: "https://cs2.sh/image/ak-redline.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  const catalog = product();
  return {
    id: "listing-1",
    productId: catalog.id,
    sellerId: "seller-1",
    floatValue: 0.25,
    pattern: 123,
    price: 18.5,
    currency: "USD",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: catalog,
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
    ...overrides,
  };
}

describe("SellerListings", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    getSellerMe.mockReset();
    getSellerListings.mockReset();
    listProducts.mockReset();
    getSellerMe.mockResolvedValue(seller());
    getSellerListings.mockResolvedValue({ items: [listing()], total: 1 });
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: 20,
    });
    authState.user = {
      id: "seller-user",
      name: "Seller",
      email: "seller@test.com",
      role: "SELLER",
    };
  });

  it("keeps unique-item listing CRUD on /seller/listings", async () => {
    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "Novo Listing" }),
    ).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline (Field-Tested)")).toBeTruthy();
    expect(screen.getByTitle("Editar")).toBeTruthy();
    expect(screen.getByTitle("Atualizar preço")).toBeTruthy();
    expect(screen.getByTitle("Cancelar listing")).toBeTruthy();
    expect(screen.getByLabelText("Editar")).toBeTruthy();
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("shows an empty state when the seller has no listings", async () => {
    getSellerListings.mockResolvedValue({ items: [], total: 0 });

    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhum listing")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Novo Listing" }).length).toBe(
      2,
    );
  });

  it("shows an error state that can be retried", async () => {
    getSellerMe.mockRejectedValue(new Error("sessão expirada"));

    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Erro ao carregar listings")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeTruthy();
  });

  it("redirects ADMIN to /admin instead of showing Seller not found", async () => {
    authState.user = {
      id: "admin-user",
      name: "Admin",
      email: "admin@test.com",
      role: "ADMIN",
    };
    getSellerMe.mockRejectedValue(new Error("Seller not found"));

    render(
      <MemoryRouter initialEntries={["/seller/listings"]}>
        <Routes>
          <Route path="/seller/listings" element={<SellerListings />} />
          <Route path="/admin" element={<div>admin-home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("admin-home")).toBeTruthy();
    expect(screen.queryByText("Erro ao carregar listings")).toBeNull();
    expect(screen.queryByText("Seller not found")).toBeNull();
    expect(getSellerMe).not.toHaveBeenCalled();
    expect(getSellerListings).not.toHaveBeenCalled();
  });

  it("shows a catalog thumbnail in each listing row", async () => {
    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    const thumb = document.querySelector(
      'img[src="https://cs2.sh/image/ak-redline.png"]',
    );
    expect(thumb).toBeTruthy();
  });

  it("shows a product preview in the edit listing dialog", async () => {
    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByLabelText("Editar"));
    expect(await screen.findByText("Editar listing")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "AK-47 | Redline (Field-Tested)" }),
    ).toHaveAttribute("src", "https://cs2.sh/image/ak-redline.png");
  });

  it("searches the catalog instead of listing only the first 100 products", async () => {
    const awp = product({
      id: "awp-asiimov-ft",
      weapon: "AWP",
      skinName: "Asiimov",
      imageUrl: "https://cs2.sh/image/awp-asiimov.png",
    });
    listProducts.mockResolvedValue({
      items: [product(), awp],
      total: 21924,
      page: 1,
      limit: 20,
    });

    render(
      <MemoryRouter>
        <SellerListings />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Novo Listing" }),
    );
    expect(await screen.findByText("Novo listing")).toBeTruthy();
    expect(
      await screen.findByRole("option", {
        name: "AK-47 | Redline (Field-Tested)",
      }),
    ).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(listProducts).not.toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(screen.getByText("Mostrando 2 de 21924")).toBeTruthy();

    const option = screen.getByRole("option", {
      name: "AWP | Asiimov (Field-Tested)",
    });
    expect(
      option.querySelector('img[src="https://cs2.sh/image/awp-asiimov.png"]'),
    ).toBeTruthy();

    fireEvent.click(option);
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "AWP | Asiimov (Field-Tested)" }),
      ).toHaveAttribute("src", "https://cs2.sh/image/awp-asiimov.png");
    });
  });
});
