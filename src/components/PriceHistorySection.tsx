import type { PriceHistory } from "@/types/api";
import {
  PRICE_HISTORY_COPY,
  PRICE_HISTORY_EMPTY,
  PRICE_HISTORY_HEADING,
  sparklinePoints,
} from "@/lib/priceHistoryView";

export function PriceHistorySection({
  entries,
}: {
  entries: PriceHistory[] | undefined;
}) {
  const items = entries ?? [];
  const points = sparklinePoints(items);

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold tracking-tight text-foreground">
        {PRICE_HISTORY_HEADING}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{PRICE_HISTORY_COPY}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{PRICE_HISTORY_EMPTY}</p>
      ) : (
        <>
          {items.length > 1 ? (
            <svg
              viewBox="0 0 160 36"
              className="mb-3 h-9 w-40 text-foreground"
              role="img"
              aria-label="Tendência das alterações de preço deste listing"
            >
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                points={points}
              />
            </svg>
          ) : null}
          <ul className="space-y-2 text-sm text-muted-foreground">
            {items.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3">
                <span>{new Date(entry.changedAt).toLocaleDateString()}</span>
                <span className="tabular-nums">
                  R$ {Number(entry.oldPrice).toFixed(2)} → R${" "}
                  {Number(entry.newPrice).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
