import { useQuery } from "@tanstack/react-query";
import { listAdminUsers } from "@/api/admin";
import { EmptyState, ErrorState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminUsers() {
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Erro ao carregar os usuários"
        description={
          error instanceof Error
            ? error.message
            : "Tente novamente em instantes."
        }
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contas cadastradas na plataforma. Esta página é apenas leitura.
        </p>
      </div>

      {users.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
