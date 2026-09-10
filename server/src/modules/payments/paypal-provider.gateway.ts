import { AppError } from "../../shared/errors/AppError.js";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalApprovalLink,
  getPayPalOrder,
  isPayPalOrderAlreadyCapturedError,
  refundPayPalCapture,
  type PayPalCheckoutUrls,
  type PayPalOrderStatus,
  type PayPalRefundStatus,
} from "../../shared/utils/paypal.js";
import { getPayPalRefund } from "./paypal-refunds.client.js";

export type PaypalProviderOrder = {
  id?: string;
  status?: PaypalOrderStatus;
  captureId?: string;
  approvalUrl?: string;
};

export type PaypalProviderRefund = {
  id: string;
  status: PaypalRefundStatus;
};

export type PaypalOrderStatus = PayPalOrderStatus;
export type PaypalRefundStatus = PayPalRefundStatus;

export type PaypalRefundFailureReason =
  | "paypal_timeout"
  | "paypal_request_in_progress"
  | "paypal_throttled"
  | "paypal_provider_unavailable"
  | "reconciliation_technical_failure";

export interface PaypalProviderGateway {
  createOrder(input: {
    amount: string;
    currency: "BRL";
    orderId: string;
    checkoutUrls?: PayPalCheckoutUrls;
  }): Promise<PaypalProviderOrder>;
  getOrder(paypalOrderId: string): Promise<PaypalProviderOrder>;
  captureOrder(paypalOrderId: string): Promise<PaypalProviderOrder>;
  refundCapture(captureId: string, requestId: string): Promise<PaypalProviderRefund>;
  getRefund(providerRefundId: string): Promise<PaypalProviderRefund>;
  classifyRefundFailure(error: unknown): PaypalRefundFailureReason;
}

/**
 * The single application-facing PayPal seam. SDK/HTTP helpers, response-link
 * parsing, capture replay recovery, and provider error classification stay here.
 */
export const paypalProvider: PaypalProviderGateway = {
  async createOrder(input) {
    const order = await createPayPalOrder(
      input.amount,
      input.currency,
      input.orderId,
      input.checkoutUrls
    );
    return {
      id: order.id,
      status: order.status,
      captureId: order.captureId,
      approvalUrl: getPayPalApprovalLink(order),
    };
  },

  getOrder(paypalOrderId) {
    return getPayPalOrder(paypalOrderId);
  },

  async captureOrder(paypalOrderId) {
    try {
      return await capturePayPalOrder(paypalOrderId);
    } catch (error) {
      if (isPayPalOrderAlreadyCapturedError(error)) {
        return getPayPalOrder(paypalOrderId);
      }
      throw error;
    }
  },

  refundCapture(captureId, requestId) {
    return refundPayPalCapture(captureId, requestId);
  },

  getRefund(providerRefundId) {
    return getPayPalRefund(providerRefundId);
  },

  classifyRefundFailure(error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (error instanceof AppError && error.statusCode === 504) return "paypal_timeout";
    if (/PREVIOUS_REQUEST_IN_PROGRESS|failed: 409/i.test(message)) {
      return "paypal_request_in_progress";
    }
    if (/failed: 429/i.test(message)) return "paypal_throttled";
    if (/failed: 5\d\d/i.test(message)) return "paypal_provider_unavailable";
    return "reconciliation_technical_failure";
  },
};
