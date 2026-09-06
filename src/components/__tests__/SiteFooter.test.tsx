import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SiteFooter } from "../SiteFooter";
import { HOME_SELLER_CTA, HOME_TRUST_HEADING } from "@/lib/homeDiscovery";

function renderFooter() {
  return render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe("SiteFooter", () => {
  it("exposes at least three real storefront links and no invented legal routes", () => {
    renderFooter();

    expect(screen.getByText("Neon Arsenal")).toBeTruthy();
    expect(
      screen.getByText(
        "Cada listing é um item único. O pagamento é pelo PayPal.",
      ),
    ).toBeTruthy();

    const market = screen.getByRole("link", { name: "Market" });
    expect(market).toHaveAttribute("href", "/products");

    const howItWorks = screen.getByRole("link", { name: HOME_TRUST_HEADING });
    expect(howItWorks).toHaveAttribute("href", "/#home-trust-heading");

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: HOME_SELLER_CTA })).toHaveAttribute(
      "href",
      "/register",
    );

    const realHrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter(
        (href) =>
          href === "/products" || href === "/login" || href === "/register",
      );
    expect(new Set(realHrefs).size).toBeGreaterThanOrEqual(3);

    expect(screen.queryByRole("link", { name: /termos/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /privacidade/i })).toBeNull();
    expect(screen.queryByText("SKINMARKET")).toBeNull();
    expect(document.querySelector(".scan-lines")).toBeNull();
    expect(document.querySelector(".neon-text")).toBeNull();
  });
});
