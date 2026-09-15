import type { Router } from "express";

/**
 * AUD-016 (PR11): route-inventory helper. Walks a router's own layer stack
 * (`router.stack`) to recover the literal `METHOD /path` operations it
 * registers, with Express's `:param` syntax normalized to OpenAPI's `{param}`.
 *
 * Assumption: every entry in `apiModules` (`server/src/app.ts`) is a *flat*
 * router — it registers routes directly via `router.get/post/patch/...` and
 * does not itself `router.use()` a nested sub-router. That holds for every
 * module under `server/src/modules` today.
 *
 * AUD-001-CORRECTION-2 (PR11 review): this helper does not silently pretend
 * to have a complete inventory if that assumption is ever violated. A nested
 * router mounted via `router.use(path, subRouter)` is, like any other
 * middleware-only layer, missing `layer.route` — so treating "no `layer.route`"
 * as "ignorable middleware" would silently skip every operation the nested
 * router registers, which is exactly the "route can drift silently
 * undocumented" failure this helper exists to prevent. Every non-route layer
 * is therefore explicitly classified as either ordinary middleware (ignored)
 * or a nested router (fails closed with a thrown error) before being skipped.
 *
 * Nested-router detection: Express's `Router()` factory returns a function
 * that itself carries a `.stack` array (the sub-router's own layer stack) —
 * verified against the installed `express` version in
 * `routeInventory.nested-router.test.ts`. An ordinary middleware function
 * (e.g. `authenticate`, `requireRole("ADMIN")`) never has a `.stack` property.
 * This is a structural (duck-typed) signal, not a guess against `layer.name`,
 * which is not a stable/documented Express contract. If a future module
 * legitimately needs a nested router, this helper must be extended to
 * recurse — it must not be changed to swallow the thrown error instead.
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
  handle?: unknown;
}

export class NestedRouterNotSupportedError extends Error {
  constructor(prefix: string, layerName: string | undefined) {
    super(
      `routeInventory: a middleware layer mounted under prefix "${prefix}" ` +
        `(name: ${layerName ?? "<anonymous>"}) looks like a nested Express router ` +
        `(its handle has its own .stack array). This helper only supports flat ` +
        `routers and refuses to silently omit a nested router's operations from ` +
        `the inventory. Extend listRouterOperations to recurse into nested ` +
        `routers, or restructure server/src/app.ts's apiModules manifest so ` +
        `every entry is a flat router.`
    );
    this.name = "NestedRouterNotSupportedError";
  }
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

/** True when a non-route layer's handle is itself an Express router (has its own `.stack` array). */
function isNestedRouterLayer(layer: ExpressRouteLayer): boolean {
  const handle = layer.handle as { stack?: unknown } | undefined;
  return Array.isArray(handle?.stack);
}

/**
 * All "METHOD /normalized/path" operations a single flat router registers,
 * unsorted, may contain duplicates across HTTP methods sharing a path.
 *
 * Throws `NestedRouterNotSupportedError` instead of silently omitting
 * operations if `router` (or anything it mounts) is not flat.
 */
export function listRouterOperations(prefix: string, router: Router): string[] {
  const operations: string[] = [];
  for (const layer of getLayers(router)) {
    if (!layer.route) {
      if (isNestedRouterLayer(layer)) {
        throw new NestedRouterNotSupportedError(prefix, layer.name);
      }
      // Ordinary middleware layer (e.g. router.use(authenticate)); not an operation.
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
