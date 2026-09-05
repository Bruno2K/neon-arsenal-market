import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetLifecycleForTests } from "../state.js";
import { resetShutdownForTests, runGracefulShutdown } from "../shutdown.js";

vi.mock("../../database/prisma.js", () => ({
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../observability/sdk.js", () => ({
  shutdownTelemetry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return `http://127.0.0.1:${port}`;
}

describe("graceful shutdown", () => {
  afterEach(() => {
    resetShutdownForTests();
    resetLifecycleForTests();
    vi.clearAllMocks();
  });

  it("stops jobs, refuses new HTTP work, and releases database and telemetry", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    });
    const baseUrl = await listen(server);
    const stopJobs = vi.fn();
    const disconnectDb = vi.fn().mockResolvedValue(undefined);
    const shutdownTelemetryFn = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    await expect(fetch(baseUrl)).resolves.toMatchObject({ status: 200 });

    const first = runGracefulShutdown({
      server,
      stopJobs,
      disconnectDb,
      shutdownTelemetryFn,
      drainMs: 50,
      exit,
    });
    const second = runGracefulShutdown({
      server,
      stopJobs,
      disconnectDb,
      shutdownTelemetryFn,
      drainMs: 50,
      exit,
    });
    await Promise.all([first, second]);

    expect(stopJobs).toHaveBeenCalledOnce();
    expect(disconnectDb).toHaveBeenCalledOnce();
    expect(shutdownTelemetryFn).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
    await expect(fetch(baseUrl)).rejects.toThrow();
  });

  it("still releases later resources when HTTP close fails", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200).end("ok");
    });
    await listen(server);
    vi.spyOn(server, "close").mockImplementation((cb) => {
      cb?.(new Error("close failed"));
      return server;
    });
    const disconnectDb = vi.fn().mockResolvedValue(undefined);
    const shutdownTelemetryFn = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    await runGracefulShutdown({
      server,
      stopJobs: vi.fn(),
      disconnectDb,
      shutdownTelemetryFn,
      drainMs: 20,
      exit,
    });

    expect(disconnectDb).toHaveBeenCalledOnce();
    expect(shutdownTelemetryFn).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
    vi.mocked(server.close).mockRestore();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
