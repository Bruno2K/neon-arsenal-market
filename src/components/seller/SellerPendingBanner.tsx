export const SELLER_PENDING_BANNER_TITLE = "Sua loja aguarda aprovação";
export const SELLER_PENDING_BANNER_BODY =
  "Você poderá anunciar depois que um admin aprovar.";

export function SellerPendingBanner() {
  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-border bg-card p-4"
    >
      <p className="text-sm font-semibold tracking-tight">
        {SELLER_PENDING_BANNER_TITLE}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {SELLER_PENDING_BANNER_BODY}
      </p>
    </div>
  );
}
