import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCartMoney, type CartLineView } from "@/lib/cartListingStatus";

export function CartListingAlerts({ line }: { line: CartLineView }) {
  if (line.kind === "error") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="destructive">Erro ao atualizar</Badge>
        <Button type="button" variant="ghost" size="sm" onClick={line.retry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (line.kind === "unavailable") {
    return (
      <p className="mt-2 text-sm text-destructive" role="status">
        {line.name} não está mais disponível
      </p>
    );
  }

  if (line.kind === "price-changed") {
    return (
      <p className="mt-2 text-sm text-muted-foreground" role="status">
        Preço atualizado: {formatCartMoney(line.previousPrice)} →{" "}
        {formatCartMoney(line.currentPrice)}
      </p>
    );
  }

  return null;
}
