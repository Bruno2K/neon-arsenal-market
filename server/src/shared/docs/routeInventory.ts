import type { Router } from "express";

/**
 * AUD-016 (PR11): route-inventory helper. Walks a router's own layer stack
 * (`router.stack`) to recover the literal `METHOD /path` operations it
 * registers, with Express's `:param` syntax normalized to OpenAPI's `{param}`.
 *
 * Assumption: every entry in `apiModules` (`server/src/app.ts`) is a *flat*
 * router — it registers routes directly via `router.get/post/patch/...` and
 * does not itself `router.use()` a nested sub-router. That holds for every
 * module under `server/src/modules` today. If a future module nests routers,
 * this helper must be extended to recurse; it intentionally does not silently
 * skip that case pretending to have a complete inventory.
 */

export interface RouteManifestEntry {
  prefix: string;
  router: Router;
}

interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  name?: string;
}

function normalizePath(prefix: string, routePath: string): string {
  const combined = routePath === "/" ? prefix : `${prefix}${routePath}`;
  const withBraces = combined.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  return withBraces === "" ? "/" : withBraces;
}

function getLayers(router: Router): ExpressRouteLayer[] {
  const stack = (router as unknown as { stack?: ExpressRouteLayer[] }).stack;
  if (!Array.isArray(stack)) {
    throw new Error(
      "routeInventory: router.stack is not an array — Express internals may have changed shape."
    );
  }
  return stack;
}

/** All "METHOD /normalized/path" operations a single flat router registers, unsorted, may contain duplicates across HTTP methods sharing a path. */
export function listRouterOperations(prefix: string, router: Router): string[] {
  const operations: string[] = [];
  for (const layer of getLayers(router)) {
    if (!layer.route) {
      // Non-route middleware layer (e.g. router.use(authenticate)); not an operation.
      continue;
    }
    const path = normalizePath(prefix, layer.route.path);
    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (!enabled || method === "_all") continue;
      operations.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

/** Deduplicated, sorted "METHOD /path" operations across an entire manifest. */
export function listManifestOperations(manifest: RouteManifestEntry[]): string[] {
  const all = manifest.flatMap(({ prefix, router }) => listRouterOperations(prefix, router));
  return Array.from(new Set(all)).sort();
}
