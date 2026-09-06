import type { PriceHistory } from "@/types/api";

export const PRICE_HISTORY_EMPTY = "Sem alterações de preço ainda";
export const PRICE_HISTORY_HEADING = "Histórico de preços deste listing";
export const PRICE_HISTORY_COPY =
  "Alterações feitas pelo vendedor neste listing. Não é um índice de mercado Steam.";

export function sparklinePoints(
  entries: PriceHistory[],
  width = 160,
  height = 36,
): string {
  if (entries.length === 0) return "";
  const prices = entries.map((entry) => Number(entry.newPrice));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  return prices
    .map((price, index) => {
      const x =
        entries.length === 1
          ? width / 2
          : (index / (entries.length - 1)) * width;
      const y = height - ((price - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
