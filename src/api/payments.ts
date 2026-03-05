import { api } from "./client";

export interface CreatePaymentBody {
  orderId: string;
}

export interface CreatePaymentResponse {
  approvalUrl?: string;
  orderId?: string;
  [key: string]: unknown;
}

export function createPaymentLink(body: CreatePaymentBody): Promise<CreatePaymentResponse> {
  return api.post<CreatePaymentResponse>("/payments/create", body);
}
