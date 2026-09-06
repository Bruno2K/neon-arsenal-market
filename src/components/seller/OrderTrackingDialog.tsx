import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderTracking } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { userFacingApiError } from "@/lib/userFacingApiError";
import type { Order } from "@/types/api";

export function OrderTrackingDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [trackingCode, setTrackingCode] = useState(order?.trackingCode ?? "");
  const [trackingCarrier, setTrackingCarrier] = useState(
    order?.trackingCarrier ?? "",
  );

  const save = useMutation({
    mutationFn: () =>
      updateOrderTracking(order!.id, {
        trackingCode: trackingCode.trim(),
        trackingCarrier: trackingCarrier.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Envio informado" });
      void queryClient.invalidateQueries({ queryKey: ["sellerOrders"] });
      onOpenChange(false);
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!order || !trackingCode.trim() || !trackingCarrier.trim()) return;
    save.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && order) {
          setTrackingCode(order.trackingCode ?? "");
          setTrackingCarrier(order.trackingCarrier ?? "");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informar envio</DialogTitle>
          <DialogDescription>
            Código e transportadora deste pedido. Não altera o status do pedido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="tracking-code">Código</Label>
            <Input
              id="tracking-code"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor="tracking-carrier">Transportadora / método</Label>
            <Input
              id="tracking-carrier"
              value={trackingCarrier}
              onChange={(event) => setTrackingCarrier(event.target.value)}
              className="mt-1.5"
              required
            />
          </div>
          {save.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {userFacingApiError(save.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !trackingCode.trim() ||
                !trackingCarrier.trim()
              }
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
