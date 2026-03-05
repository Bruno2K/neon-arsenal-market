import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import express from "express";
import { healthRoutes } from "../health.routes.js";

vi.mock("../../database/index.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));
vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn() },
}));

const app = express();
app.use(healthRoutes);

describe("Health routes", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe("GET /health", () => {
    it("returns 200 and status ok", async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok" });
    });
  });

  describe("GET /ready", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns 200 when DB is reachable", async () => {
      const { prisma } = await import("../../database/index.js");
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
      const res = await fetch(`${baseUrl}/ready`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ready" });
    });

    it("returns 503 when DB fails", async () => {
      const { prisma } = await import("../../database/index.js");
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"));
      const res = await fetch(`${baseUrl}/ready`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ status: "unavailable" });
    });
  });
});
