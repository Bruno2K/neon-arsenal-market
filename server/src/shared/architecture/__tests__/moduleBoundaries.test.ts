import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_MODULE_EDGES,
  DOMAIN_MODULE_FOLDERS,
  LOGICAL_MODULE_NAMES,
  extractImportSpecifiers,
  findImportViolations,
  isModuleEdgeAllowed,
  requiredLogicalModulesAreMapped,
  resolveImportTarget,
} from "../moduleBoundaries.js";

const srcRoot = resolveSrcRoot();

function resolveSrcRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..");
}

describe("SPEC-0006 modular monolith map", () => {
  it("maps Auth, Users, Sellers, Catalog, Listings, Orders, Payments, Ledger, Reviews, and Admin", () => {
    expect(requiredLogicalModulesAreMapped()).toBe(true);
    expect(LOGICAL_MODULE_NAMES.products).toBe("Catalog");
    expect(LOGICAL_MODULE_NAMES.commissions).toBe("Ledger");
    expect(DOMAIN_MODULE_FOLDERS).toContain("products");
    expect(DOMAIN_MODULE_FOLDERS).toContain("commissions");
    expect(DOMAIN_MODULE_FOLDERS).toContain("audit");
  });

  it("encodes Admin composition and Audit write edges only", () => {
    expect(ALLOWED_MODULE_EDGES.admin).toEqual(["sellers", "orders", "products", "audit"]);
    expect(ALLOWED_MODULE_EDGES.payments).toEqual(["audit"]);
    expect(ALLOWED_MODULE_EDGES.orders).toEqual(["audit"]);
    expect(ALLOWED_MODULE_EDGES.listings).toEqual(["audit"]);
    expect(ALLOWED_MODULE_EDGES.sellers).toEqual(["audit"]);
    expect(ALLOWED_MODULE_EDGES.commissions).toEqual(["audit"]);
    expect(ALLOWED_MODULE_EDGES.auth).toEqual([]);
    expect(ALLOWED_MODULE_EDGES.reviews).toEqual([]);
    expect(isModuleEdgeAllowed("payments", "orders")).toBe(false);
    expect(isModuleEdgeAllowed("orders", "listings")).toBe(false);
    expect(isModuleEdgeAllowed("reviews", "products")).toBe(false);
    expect(isModuleEdgeAllowed("admin", "sellers")).toBe(true);
    expect(isModuleEdgeAllowed("payments", "audit")).toBe(true);
  });
});

describe("import specifier parsing", () => {
  it("reads static, type, multiline, and dynamic imports", () => {
    const source = `
      import { auditRepository } from "../audit/audit.repository.js";
      import type { AuditActor } from "../audit/audit.types.js";
      import {
        listingsService,
      } from "../../modules/listings/listings.service.js";
      export { ordersRepository } from "../orders/orders.repository.js";
      const loaded = await import("../payments/payments.service.js");
      export const label = "from 'not-an-import'";
    `;
    expect(extractImportSpecifiers(source)).toEqual([
      "../audit/audit.repository.js",
      "../audit/audit.types.js",
      "../../modules/listings/listings.service.js",
      "../orders/orders.repository.js",
      "../payments/payments.service.js",
    ]);
  });

  it("resolves relative module and shared targets", () => {
    const fromPayments = join(srcRoot, "modules", "payments", "payments.service.ts");
    expect(resolveImportTarget(fromPayments, "../audit/audit.repository.js", srcRoot)).toEqual({
      specifier: "../audit/audit.repository.js",
      kind: "module",
      targetModule: "audit",
    });
    expect(resolveImportTarget(fromPayments, "../../shared/utils/paypal.js", srcRoot)).toEqual({
      specifier: "../../shared/utils/paypal.js",
      kind: "shared",
      targetModule: null,
    });
    expect(resolveImportTarget(fromPayments, "@prisma/client", srcRoot)).toEqual({
      specifier: "@prisma/client",
      kind: "package",
      targetModule: null,
    });
  });
});

describe("production source graph", () => {
  it("has no forbidden production module imports", () => {
    const violations = findImportViolations(srcRoot);
    expect(violations).toEqual([]);
  });

  it("rejects a synthetic Payments → Orders service import", () => {
    const paymentsFile = join(srcRoot, "modules", "payments", "payments.service.ts");
    const resolved = resolveImportTarget(
      paymentsFile,
      "../orders/orders.service.js",
      srcRoot
    );
    expect(resolved.targetModule).toBe("orders");
    expect(isModuleEdgeAllowed("payments", "orders")).toBe(false);
  });
});
