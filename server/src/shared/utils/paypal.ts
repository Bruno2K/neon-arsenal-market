import paypal from "@paypal/checkout-server-sdk";

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_SECRET ?? "";
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  if (mode === "production") {
    return new paypal.core.LiveEnvironment(clientId, secret);
  }
  return new paypal.core.SandboxEnvironment(clientId, secret);
}

const client = new paypal.core.PayPalHttpClient(environment());

export async function createPayPalOrder(amount: string, currency = "BRL", orderId: string) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderId,
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
  });
  const response = await client.execute(request);
  return response.result;
}

export async function capturePayPalOrder(orderId: string) {
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  const response = await client.execute(request);
  return response.result;
}

export function getPayPalOrderIdFromResult(result: { id?: string }): string | undefined {
  return result.id;
}

export function getPayPalApprovalLink(result: { links?: Array<{ href?: string; rel?: string }> }): string | undefined {
  const link = result.links?.find((l) => l.rel === "approve");
  return link?.href;
}
