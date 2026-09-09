import { AppError } from "../../shared/errors/AppError.js";
import { getPayPalApiBaseUrl, getPayPalApiTimeoutMs } from "../../shared/config/paypal.js";
import { withPaypalOperation } from "../../shared/observability/paypal.js";
import { isTimeoutError } from "../../shared/resilience/retry.js";
import {
  getPayPalAccessToken,
  mapPayPalHttpError,
  parsePayPalRefundResource,
  type ParsedPayPalRefund,
} from "../../shared/utils/paypal.js";

/**
 * Minimum Payments v2 read used by reconciliation when a provider refund id is
 * already durable. The GET is attempted once; persisted sweep backoff owns retry.
 */
export async function getPayPalRefund(providerRefundId: string): Promise<ParsedPayPalRefund> {
  if (!providerRefundId.trim()) {
    throw new AppError(400, "PayPal refund id is required");
  }

  return withPaypalOperation("refunds_get", async () => {
    const token = await getPayPalAccessToken();
    const url = `${getPayPalApiBaseUrl()}/v2/payments/refunds/${encodeURIComponent(providerRefundId)}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(getPayPalApiTimeoutMs()),
      });
      if (!response.ok) {
        throw new AppError(502, `PayPal RefundsGet failed: ${response.status}`);
      }
      return parsePayPalRefundResource(await response.json());
    } catch (err) {
      if (isTimeoutError(err)) throw new AppError(504, "PayPal RefundsGet timed out");
      throw mapPayPalHttpError(err);
    }
  });
}
