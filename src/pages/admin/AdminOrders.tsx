import { Clock, CheckCircle, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listAdminOrders } from "@/api/admin";

export default function AdminOrders() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: listAdminOrders,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading text-foreground">Pedidos</h1>

      {isLoading && (
        <p className="text-muted-foreground">Carregando pedidos...</p>
      )}

      {!isLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  ID
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">
                  Total
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">
                  Data
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Pagamento
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3 text-muted-foreground font-mono text-xs">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="p-3 text-primary font-heading hidden sm:table-cell">
                    ${Number(o.totalAmount).toFixed(2)}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs font-heading px-2 py-1 rounded ${
                        o.paymentStatus === "PAID"
                          ? "bg-primary/10 text-primary"
                          : o.paymentStatus === "REFUNDED"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-heading px-2 py-1 rounded ${
                        o.status === "DELIVERED"
                          ? "bg-primary/10 text-primary"
                          : o.status === "SHIPPED"
                            ? "bg-secondary/10 text-secondary"
                            : o.status === "CANCELLED"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {o.status === "PENDING" && <Clock className="h-3 w-3" />}
                      {o.status === "SHIPPED" && <Truck className="h-3 w-3" />}
                      {o.status === "DELIVERED" && (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Nenhum pedido encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
