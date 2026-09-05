import type { OutboxEventStatus, Prisma } from "@prisma/client";

export const OutboxEventType = {
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
} as const;

export type OutboxEventTypeName = (typeof OutboxEventType)[keyof typeof OutboxEventType];

export type OutboxEnqueueInput = {
  type: OutboxEventTypeName;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
};

export type ClaimedOutboxEvent = {
  id: string;
  type: string;
  aggregateId: string;
  payload: Prisma.JsonValue;
  status: OutboxEventStatus;
  attempts: number;
  availableAt: Date;
  claimedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
};

export type OutboxClient = {
  outboxEvent: {
    create: (args: { data: Prisma.OutboxEventUncheckedCreateInput }) => Promise<unknown>;
    updateMany: (args: {
      where: Prisma.OutboxEventWhereInput;
      data: Prisma.OutboxEventUncheckedUpdateManyInput;
    }) => Promise<{ count: number }>;
  };
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};
