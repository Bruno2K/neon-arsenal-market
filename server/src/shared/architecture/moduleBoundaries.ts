/**
 * Explicit modular-monolith import graph (issue #59, SPEC-0006, ADR 0016).
 *
 * Folder names stay products (Catalog) and commissions (Ledger).
 * This file is the executable contract; docs/architecture/modular-monolith.md
 * must stay aligned with it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const DOMAIN_MODULE_FOLDERS = [
  "auth",
  "users",
  "sellers",
  "products",
  "listings",
  "orders",
  "payments",
  "commissions",
  "reviews",
  "admin",
  "audit",
] as const;

export type DomainModuleFolder = (typeof DOMAIN_MODULE_FOLDERS)[number];

export const LOGICAL_MODULE_NAMES = {
  auth: "Auth",
  users: "Users",
  sellers: "Sellers",
  products: "Catalog",
  listings: "Listings",
  orders: "Orders",
  payments: "Payments",
  commissions: "Ledger",
  reviews: "Reviews",
  admin: "Admin",
  audit: "Audit",
} as const satisfies Record<DomainModuleFolder, string>;

export const REQUIRED_LOGICAL_MODULES = [
  "Auth",
  "Users",
  "Sellers",
  "Catalog",
  "Listings",
  "Orders",
  "Payments",
  "Ledger",
  "Reviews",
  "Admin",
] as const;

/** Production module → module edges. Every module may also import shared/. */
export const ALLOWED_MODULE_EDGES: Record<DomainModuleFolder, readonly DomainModuleFolder[]> = {
  auth: [],
  users: [],
  sellers: ["audit"],
  products: [],
  listings: ["audit"],
  orders: ["audit"],
  payments: ["audit"],
  commissions: ["audit"],
  reviews: [],
  admin: ["sellers", "orders", "products", "audit"],
  audit: [],
};

export type ImportKind = "package" | "shared" | "module" | "unknown";

export type ResolvedImport = {
  specifier: string;
  kind: ImportKind;
  targetModule: DomainModuleFolder | null;
};

export type ImportViolation = {
  file: string;
  specifier: string;
  fromModule: DomainModuleFolder | "shared" | "composition";
  toModule: DomainModuleFolder | "shared" | "unknown";
  reason: string;
};

const IMPORT_FROM_RE =
  /\b(?:import|export)(?:\s+type)?\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT_RE = /\bimport\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const COMPOSITION_ROOTS: ReadonlyArray<{
  relativeFromSrc: string;
  allowedModules: readonly DomainModuleFolder[];
}> = [
  { relativeFromSrc: "app.ts", allowedModules: DOMAIN_MODULE_FOLDERS },
  { relativeFromSrc: join("shared", "jobs", "reservationExpiryJob.ts"), allowedModules: ["listings"] },
  {
    relativeFromSrc: join("shared", "jobs", "paypalReconciliationJob.ts"),
    allowedModules: ["payments"],
  },
  {
    relativeFromSrc: join("shared", "jobs", "sellerLedgerReconciliationJob.ts"),
    allowedModules: ["commissions"],
  },
  { relativeFromSrc: join("shared", "jobs", "outboxDispatcherJob.ts"), allowedModules: [] },
];

export function isDomainModuleFolder(value: string): value is DomainModuleFolder {
  return (DOMAIN_MODULE_FOLDERS as readonly string[]).includes(value);
}

export function isModuleEdgeAllowed(
  fromModule: DomainModuleFolder,
  toModule: DomainModuleFolder
): boolean {
  if (fromModule === toModule) return true;
  return ALLOWED_MODULE_EDGES[fromModule].includes(toModule);
}

export function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const text = stripComments(source);
  for (const re of [IMPORT_FROM_RE, SIDE_EFFECT_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(text);
    while (match) {
      specifiers.add(match[1]);
      match = re.exec(text);
    }
  }
  return [...specifiers];
}

export function resolveImportTarget(
  fromFile: string,
  specifier: string,
  srcRoot: string
): ResolvedImport {
  if (!specifier.startsWith(".")) {
    return { specifier, kind: "package", targetModule: null };
  }

  const fromDir = dirname(fromFile);
  const resolved = resolve(fromDir, specifier);
  const rel = relative(srcRoot, resolved).split(sep);

  if (rel[0] === "shared" || rel[0] === "..") {
    if (rel[0] === "shared") {
      return { specifier, kind: "shared", targetModule: null };
    }
  }

  if (rel[0] === "modules" && rel[1] && isDomainModuleFolder(rel[1])) {
    return { specifier, kind: "module", targetModule: rel[1] };
  }

  return { specifier, kind: "unknown", targetModule: null };
}

export function scanProductionTypeScriptFiles(root: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === "__tests__") continue;
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts")) continue;
      if (entry.endsWith(".test.ts") || entry.endsWith(".integration.test.ts")) continue;
      files.push(full);
    }
  }

  walk(root);
  return files.sort();
}

function moduleOfProductionFile(file: string, srcRoot: string): DomainModuleFolder | null {
  const rel = relative(srcRoot, file).split(sep);
  if (rel[0] === "modules" && rel[1] && isDomainModuleFolder(rel[1])) {
    return rel[1];
  }
  return null;
}

function compositionRootFor(file: string, srcRoot: string) {
  const rel = relative(srcRoot, file);
  return COMPOSITION_ROOTS.find((root) => root.relativeFromSrc === rel) ?? null;
}

export function findImportViolations(srcRoot: string): ImportViolation[] {
  const violations: ImportViolation[] = [];
  const moduleRoot = join(srcRoot, "modules");
  const sharedRoot = join(srcRoot, "shared");

  for (const file of scanProductionTypeScriptFiles(moduleRoot)) {
    const fromModule = moduleOfProductionFile(file, srcRoot);
    if (!fromModule) continue;
    const source = readFileSync(file, "utf8");
    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveImportTarget(file, specifier, srcRoot);
      if (resolved.kind === "package" || resolved.kind === "shared") continue;
      if (resolved.kind === "module" && resolved.targetModule) {
        if (isModuleEdgeAllowed(fromModule, resolved.targetModule)) continue;
        violations.push({
          file: relative(srcRoot, file),
          specifier,
          fromModule,
          toModule: resolved.targetModule,
          reason: `${fromModule} must not import ${resolved.targetModule}`,
        });
        continue;
      }
      violations.push({
        file: relative(srcRoot, file),
        specifier,
        fromModule,
        toModule: "unknown",
        reason: "production module import must resolve to shared/ or an allowed module",
      });
    }
  }

  for (const file of scanProductionTypeScriptFiles(sharedRoot)) {
    const source = readFileSync(file, "utf8");
    const composition = compositionRootFor(file, srcRoot);
    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveImportTarget(file, specifier, srcRoot);
      if (resolved.kind !== "module" || !resolved.targetModule) continue;
      if (composition && composition.allowedModules.includes(resolved.targetModule)) {
        continue;
      }
      violations.push({
        file: relative(srcRoot, file),
        specifier,
        fromModule: composition ? "composition" : "shared",
        toModule: resolved.targetModule,
        reason: composition
          ? `composition root may not import ${resolved.targetModule}`
          : "shared/ production code outside documented jobs must not import modules/",
      });
    }
  }

  return violations;
}

export function requiredLogicalModulesAreMapped(): boolean {
  const mapped = new Set(Object.values(LOGICAL_MODULE_NAMES));
  return REQUIRED_LOGICAL_MODULES.every((name) => mapped.has(name));
}
