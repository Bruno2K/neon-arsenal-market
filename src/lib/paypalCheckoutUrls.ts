const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function absoluteHttpUrl(path: string, origin: string): string {
  const url = new URL(path, origin);
  if (!HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error("PayPal return URLs must be absolute http(s) URLs");
  }
  return url.href;
}

/**
 * Absolute PayPal return/cancel URLs for `POST /payments/create`.
 * The backend DTO requires `z.string().url()` when these are sent.
 */
export function paypalCheckoutUrls(
  orderId: string,
  origin: string = window.location.origin,
): { returnUrl: string; cancelUrl: string } {
  if (!orderId) {
    throw new Error("orderId is required");
  }
  const encodedId = encodeURIComponent(orderId);
  return {
    returnUrl: absoluteHttpUrl(`/orders/${encodedId}/return`, origin),
    cancelUrl: absoluteHttpUrl(`/orders/${encodedId}/cancel`, origin),
  };
}
