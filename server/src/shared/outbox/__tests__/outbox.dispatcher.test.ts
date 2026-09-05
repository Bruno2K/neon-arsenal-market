import { describe, it, expect, vi, beforeEach } from "vitest";
import { OUTBOX_MAX_ATTEMPTS, outboxBackoffDelayMs } from "../../config/outbox.js";
import type { ClaimedOutboxEvent } from "../outbox.types.js";

vi.mock("../../database/index.js", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock("../outbox.repository.js", () => ({
  outboxRepository: {
    claimBatch: vi.fn(),
    markPublished: vi.fn(),
    scheduleRetry: vi.fn(),
    markFailed: vi.fn(),
  },
}));

vi.mock("../../observability/metrics.js", () => ({
  appMetrics: {
    outboxPublished: vi.fn(),
    outboxRetry: vi.fn(),
    outboxFailed: vi.fn(),
  },
}));

import { prisma } from "../../database/index.js";
import { appMetrics } from "../../observability/metrics.js";
import { outboxRepository } from "../outbox.repository.js";
import { dispatchOutboxEvents } from "../outbox.dispatcher.js";

function claimed(overrides: Partial<ClaimedOutboxEvent> = {}): ClaimedOutboxEvent {
  return {
    id: "evt-1",
    type: "PAYMENT_CONFIRMED",
    aggregateId: "order-1",
    payload: { orderId: "order-1", paymentStatus: "PAID", status: "CONFIRMED" },
    status: "PROCESSING",
    attempts: 1,
    availableAt: new Date("2026-09-05T00:00:00.000Z"),
    claimedAt: new Date("2026-09-05T00:00:01.000Z"),
    lastError: null,
    createdAt: new Date("2026-09-05T00:00:00.000Z"),
    ...overrides,
  };
}

describe("dispatchOutboxEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([]);
    vi.mocked(outboxRepository.markPublished).mockResolvedValue(true);
    vi.mocked(outboxRepository.scheduleRetry).mockResolvedValue(true);
    vi.mocked(outboxRepository.markFailed).mockResolvedValue(true);
  });

  it("is a no-op when nothing is claimable", async () => {
    const result = await dispatchOutboxEvents();
    expect(result).toEqual({ claimed: 0, published: 0, retried: 0, failed: 0, skipped: 0 });
    expect(outboxRepository.markPublished).not.toHaveBeenCalled();
    expect(appMetrics.outboxPublished).not.toHaveBeenCalled();
  });

  it("publishes a claimed row once and records the metric on the status transition", async () => {
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([claimed()]);

    const result = await dispatchOutboxEvents();

    expect(result.published).toBe(1);
    expect(outboxRepository.markPublished).toHaveBeenCalledWith("evt-1");
    expect(appMetrics.outboxPublished).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("does not increment the publish metric when the row is already published", async () => {
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([claimed()]);
    vi.mocked(outboxRepository.markPublished).mockResolvedValue(false);

    const result = await dispatchOutboxEvents();

    expect(result.skipped).toBe(1);
    expect(result.published).toBe(0);
    expect(appMetrics.outboxPublished).not.toHaveBeenCalled();
  });

  it("schedules bounded exponential backoff when the handler throws", async () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([claimed({ attempts: 2 })]);

    const result = await dispatchOutboxEvents({
      now,
      handle: async () => {
        throw new Error("handler boom");
      },
    });

    expect(result.retried).toBe(1);
    expect(outboxRepository.scheduleRetry).toHaveBeenCalledWith(
      "evt-1",
      new Date(now.getTime() + outboxBackoffDelayMs(2)),
      "handler boom"
    );
    expect(appMetrics.outboxRetry).toHaveBeenCalledTimes(1);
    expect(outboxRepository.markFailed).not.toHaveBeenCalled();
  });

  it("marks FAILED after the last attempt and does not retry", async () => {
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([
      claimed({ attempts: OUTBOX_MAX_ATTEMPTS }),
    ]);

    const result = await dispatchOutboxEvents({
      handle: async () => {
        throw new Error("still broken");
      },
    });

    expect(result.failed).toBe(1);
    expect(outboxRepository.markFailed).toHaveBeenCalledWith("evt-1", "still broken");
    expect(outboxRepository.scheduleRetry).not.toHaveBeenCalled();
    expect(appMetrics.outboxFailed).toHaveBeenCalledTimes(1);
  });

  it("skips a row already in PUBLISHED without calling the handler", async () => {
    const handle = vi.fn();
    vi.mocked(outboxRepository.claimBatch).mockResolvedValue([claimed({ status: "PUBLISHED" })]);

    const result = await dispatchOutboxEvents({ handle });

    expect(handle).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(outboxRepository.markPublished).not.toHaveBeenCalled();
  });
});

describe("outboxBackoffDelayMs", () => {
  it("doubles from a 1s base and caps at five minutes", () => {
    expect(outboxBackoffDelayMs(1)).toBe(1_000);
    expect(outboxBackoffDelayMs(2)).toBe(2_000);
    expect(outboxBackoffDelayMs(3)).toBe(4_000);
    expect(outboxBackoffDelayMs(20)).toBe(5 * 60 * 1000);
  });
});
