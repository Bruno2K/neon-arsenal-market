import { Shield, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listAdminUsers } from "@/api/admin";

const ROLE_STYLE: Record<string, string> = {
  ADMIN: "bg-destructive/10 text-destructive",
  SELLER: "bg-secondary/10 text-secondary",
  CUSTOMER: "bg-muted text-muted-foreground",
};

export default function AdminUsers() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listAdminUsers,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading text-foreground">Usuários</h1>

      {isLoading && (
        <p className="text-muted-foreground">Carregando usuários...</p>
      )}

      {!isLoading && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Nome
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden sm:table-cell">
                  E-mail
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs">
                  Papel
                </th>
                <th className="text-left p-3 font-heading text-muted-foreground text-xs hidden md:table-cell">
                  Cadastro
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {u.role === "ADMIN" ? (
                          <Shield className="h-4 w-4 text-destructive" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground hidden sm:table-cell">
                    {u.email}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs font-heading px-2 py-1 rounded ${ROLE_STYLE[u.role] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado
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
