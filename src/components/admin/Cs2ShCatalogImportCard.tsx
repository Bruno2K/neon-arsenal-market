import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCs2ShImportStatus, startCs2ShImport } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { userFacingApiError } from "@/lib/userFacingApiError";
import { useToast } from "@/hooks/use-toast";

function statusCopy(
  status:
    | {
        running: boolean;
        lastResult: {
          skipped: boolean;
          productsUpserted: number;
          listingsUpserted: number;
        } | null;
      }
    | undefined,
  isError: boolean,
): string {
  if (isError) {
    return "Não foi possível ler o status da importação.";
  }
  if (status?.running) {
    return "Importação em andamento neste processo da API.";
  }
  const last = status?.lastResult;
  if (!last) {
    return "Nenhuma importação neste processo. Defina CS2SH_API_KEY no Render e use o botão, ou CS2SH_IMPORT=true no próximo deploy.";
  }
  if (last.skipped) {
    return "A última tentativa pulou o import: a chave da API cs2.sh não está configurada.";
  }
  return `Última importação neste processo: ${last.productsUpserted} produtos e ${last.listingsUpserted} listings demo.`;
}

export function Cs2ShCatalogImportCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusQuery = useQuery({
    queryKey: ["admin-cs2sh-import"],
    queryFn: getCs2ShImportStatus,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  });
  const startImport = useMutation({
    mutationFn: startCs2ShImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cs2sh-import"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Importação do catálogo cs2.sh iniciada" });
    },
    onError: (error) => {
      toast({
        title: "Não foi possível importar o catálogo",
        description: userFacingApiError(error),
        variant: "destructive",
      });
    },
  });

  return (
    <section
      aria-labelledby="cs2sh-catalog-heading"
      className="space-y-3 rounded-md border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="cs2sh-catalog-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Catálogo cs2.sh
          </h2>
          <p className="text-sm text-muted-foreground">
            No Render não há shell. Importe skins tradable pela API; o
            PostgreSQL guarda o resultado.
          </p>
        </div>
        <Button
          type="button"
          disabled={startImport.isPending || statusQuery.data?.running === true}
          onClick={() => startImport.mutate()}
        >
          {statusQuery.data?.running || startImport.isPending
            ? "Importando…"
            : "Importar catálogo"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {statusCopy(statusQuery.data ?? undefined, statusQuery.isError)}
      </p>
    </section>
  );
}
