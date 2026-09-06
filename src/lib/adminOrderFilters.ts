export const ADMIN_ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const ADMIN_PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];
export type AdminPaymentStatus = (typeof ADMIN_PAYMENT_STATUSES)[number];

function isOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function parseAdminOrderStatus(
  value: string | null | undefined,
): AdminOrderStatus | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return isOneOf(trimmed, ADMIN_ORDER_STATUSES) ? trimmed : undefined;
}

export function parseAdminPaymentStatus(
  value: string | null | undefined,
): AdminPaymentStatus | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return isOneOf(trimmed, ADMIN_PAYMENT_STATUSES) ? trimmed : undefined;
}

export function adminOrderListQuery(params?: {
  status?: string;
  paymentStatus?: string;
}): { status?: AdminOrderStatus; paymentStatus?: AdminPaymentStatus } {
  const status = parseAdminOrderStatus(params?.status);
  const paymentStatus = parseAdminPaymentStatus(params?.paymentStatus);
  return {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  };
}

export function hasAdminOrderFilters(params: {
  status?: string;
  paymentStatus?: string;
}): boolean {
  return Boolean(params.status || params.paymentStatus);
}
