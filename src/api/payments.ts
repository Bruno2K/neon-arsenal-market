import { api } from "./client";

export interface CreatePaymentBody {
  orderId: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreatePaymentResponse {
  approvalUrl?: string;
  orderId?: string;
  [key: string]: unknown;
}

export function createPaymentLink(
  body: CreatePaymentBody,
): Promise<CreatePaymentResponse> {
  return api.post<CreatePaymentResponse>("/payments/create", body);
}

export interface CapturePaymentBody {
  orderId: string;
}

export interface CapturePaymentResponse {
  orderId: string;
  paymentStatus: "PAID" | "PENDING";
  paypalStatus?: string;
}

/** Merchant capture after PayPal approval. Does not set PAID from the client. */
export function capturePayment(
  body: CapturePaymentBody,
): Promise<CapturePaymentResponse> {
  return api.post<CapturePaymentResponse>("/payments/capture", body);
}
