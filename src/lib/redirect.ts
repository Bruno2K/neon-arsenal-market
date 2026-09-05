/** Full-page navigation to an external URL (PayPal approval). */
export function redirectToExternal(url: string): void {
  window.location.assign(url);
}
