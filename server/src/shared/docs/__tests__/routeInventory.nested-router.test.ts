import { describe, expect, it } from "vitest";
import express, { Router } from "express";
import {
  NestedRouterNotSupportedError,
  listManifestOperations,
  listRouterOperations,
} from "../routeInventory.js";

/**
 * AUD-001-CORRECTION-2 (PR11 review): proves the nested-router detection this
 * helper relies on actually matches the installed Express version's real
 * `Router()` shape, rather than being an untested guess. If a future Express
 * upgrade changes that shape, this test — not the exact-match OpenAPI
 * contract test — is the one that should fail first and explain why.
 */
describe("routeInventory — flat-router contract (AUD-016 / AUD-001-CORRECTION-2)", () => {
  it("inventories every route a flat router registers", () => {
    const router = Router();
    router.get("/", (_req, res) => res.end());
    router.get("/:id", (_req, res) => res.end());
    router.post("/:id/approve", (_req, res) => res.end());

    const operations = listRouterOperations("/sellers", router);

    expect(operations.sort()).toEqual([
      "GET /sellers",
      "GET /sellers/{id}",
      "POST /sellers/{id}/approve",
    ]);
  });

  it("does not turn ordinary middleware into a documented operation", () => {
    const router = Router();
    const authenticate = (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
      next();
    router.use(authenticate);
    router.use("/scoped", authenticate);
    router.get("/", (_req, res) => res.end());

    const operations = listRouterOperations("/orders", router);

    expect(operations).toEqual(["GET /orders"]);
  });

  it(
    "fails closed with NestedRouterNotSupportedError instead of silently omitting a nested " +
      "router's operations",
    () => {
      const nested = Router();
      nested.get("/", (_req, res) => res.end());
      nested.get("/:id", (_req, res) => res.end());

      const outer = Router();
      outer.use("/nested", nested);
      outer.get("/top-level", (_req, res) => res.end());

      expect(() => listRouterOperations("/admin", outer)).toThrow(NestedRouterNotSupportedError);
      expect(() => listRouterOperations("/admin", outer)).toThrow(/nested Express router/);
    }
  );

  it("propagates the fail-closed error through listManifestOperations for any manifest entry", () => {
    const nested = Router();
    nested.get("/", (_req, res) => res.end());
    const outer = Router();
    outer.use("/nested", nested);

    const flat = Router();
    flat.get("/", (_req, res) => res.end());

    expect(() =>
      listManifestOperations([
        { prefix: "/flat", router: flat },
        { prefix: "/nested-parent", router: outer },
      ])
    ).toThrow(NestedRouterNotSupportedError);
  });

  it("confirms the installed express Router() actually exposes .stack on its handle (the signal this helper depends on)", () => {
    const nested = Router();
    const outer = Router();
    outer.use("/nested", nested);

    const nestedLayer = (outer as unknown as { stack: Array<{ handle: unknown; route?: unknown }> }).stack.find(
      (layer) => !layer.route
    );

    expect(nestedLayer).toBeDefined();
    expect(Array.isArray((nestedLayer?.handle as { stack?: unknown } | undefined)?.stack)).toBe(true);
  });
});
