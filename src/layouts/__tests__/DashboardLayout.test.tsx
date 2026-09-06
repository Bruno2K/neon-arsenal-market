import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DashboardLayout from "../DashboardLayout";

vi.mock("@/components/Header", () => ({
  Header: () => <div>header</div>,
}));

vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: () => null,
}));

function renderAdminNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/admin" element={<div>overview</div>} />
          <Route path="/admin/catalog" element={<div>catalog-page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardLayout admin nav", () => {
  it("exposes Catálogo next to Visão Geral", () => {
    renderAdminNav("/admin");
    const links = screen.getAllByRole("link", { name: "Catálogo" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/admin/catalog");
    expect(
      screen.getAllByRole("link", { name: "Visão Geral" })[0],
    ).toHaveAttribute("href", "/admin");
  });

  it("marks Catálogo current on /admin/catalog", () => {
    renderAdminNav("/admin/catalog");
    const links = screen.getAllByRole("link", { name: "Catálogo" });
    expect(
      links.some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(screen.getByText("catalog-page")).toBeTruthy();
  });
});
