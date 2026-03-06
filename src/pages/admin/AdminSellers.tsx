import { CheckCircle, XCircle, Users, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSellers } from "@/api/sellers";
import { adminApproveSeller } from "@/api/admin";
import { Button } from "@/components/ui/button";

export default function AdminSellers() {
  const queryClient = useQueryClient();
  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: listSellers,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      adminApproveSeller(id, isApproved),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading text-foreground">Vendedores</h1>

      {isLoading && (
        <p className="text-muted-foreground">Carregando vendedores...</p>
      )}

      {!isLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Loja
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">
                  Usuário
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">
                  Comissão
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">
                  Saldo
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Status
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-foreground">
                        {s.storeName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">
                    {s.user?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {(Number(s.commissionRate ?? 0.1) * 100).toFixed(0)}%
                  </td>
                  <td className="p-3 text-primary font-heading hidden md:table-cell">
                    ${Number(s.balance).toFixed(2)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs font-heading px-2 py-1 rounded ${s.isApproved ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}`}
                    >
                      {s.isApproved ? "Aprovado" : "Pendente"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {!s.isApproved ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approveMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({
                              id: s.id,
                              isApproved: true,
                            })
                          }
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1 text-primary" />
                          )}
                          Aprovar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approveMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({
                              id: s.id,
                              isApproved: false,
                            })
                          }
                        >
                          <XCircle className="h-3 w-3 mr-1 text-destructive" />
                          Suspender
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sellers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Nenhum vendedor cadastrado
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
