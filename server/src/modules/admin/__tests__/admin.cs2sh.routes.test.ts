import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { errorHandler } from "../../../shared/errors/index.js";
import { signAccessToken } from "../../../shared/utils/jwt.js";

const getCs2ShImportStatus = vi.fn();
const tryStartCs2ShCatalogImport = vi.fn();

vi.mock("../../products/cs2shImport.service.js", () => ({
  getCs2ShImportStatus: (...args: unknown[]) => getCs2ShImportStatus(...args),
  tryStartCs2ShCatalogImport: (...args: unknown[]) => tryStartCs2ShCatalogImport(...args),
}));

const { adminRoutes } = await import("../admin.routes.js");

function listen(app: express.Express) {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function adminToken() {
  return signAccessToken({
    sub: "admin-1",
    email: "admin@test.local",
    role: "ADMIN",
  });
}

describe("/admin/catalog/cs2sh-import", () => {
  let server: Server;
  let baseUrl: string;
  const originalKey = process.env.CS2SH_API_KEY;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/admin", adminRoutes);
    app.use(errorHandler);
    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  beforeEach(() => {
    getCs2ShImportStatus.mockReset();
    tryStartCs2ShCatalogImport.mockReset();
    getCs2ShImportStatus.mockReturnValue({ running: false, lastResult: null });
    tryStartCs2ShCatalogImport.mockReturnValue(true);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CS2SH_API_KEY;
    else process.env.CS2SH_API_KEY = originalKey;
  });

  it("returns 401 without a bearer token", async () => {
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("returns 403 for CUSTOMER", async () => {
    const token = signAccessToken({
      sub: "customer-1",
      email: "buyer@test.local",
      role: "CUSTOMER",
    });
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });

  it("GET returns in-process status for ADMIN", async () => {
    getCs2ShImportStatus.mockReturnValue({
      running: true,
      lastResult: { skipped: false, generationId: "gen-1", productsUpserted: 10, schemaSkipped: 0, listingsUpserted: 2 },
    });
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      running: true,
      lastResult: { productsUpserted: 10, listingsUpserted: 2 },
    });
  });

  it("POST returns 503 when CS2SH_API_KEY is missing", async () => {
    delete process.env.CS2SH_API_KEY;
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "A chave da API cs2.sh não está configurada",
    });
    expect(tryStartCs2ShCatalogImport).not.toHaveBeenCalled();
  });

  it("POST returns 202 and starts the import in the background", async () => {
    process.env.CS2SH_API_KEY = "test-key";
    getCs2ShImportStatus.mockReturnValue({ running: true, lastResult: null });
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      status: "started",
      running: true,
    });
    expect(tryStartCs2ShCatalogImport).toHaveBeenCalledTimes(1);
  });

  it("POST returns 409 when an import is already running", async () => {
    process.env.CS2SH_API_KEY = "test-key";
    tryStartCs2ShCatalogImport.mockReturnValue(false);
    const response = await fetch(`${baseUrl}/admin/catalog/cs2sh-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "A importação do catálogo cs2.sh já está em andamento",
    });
  });
});
