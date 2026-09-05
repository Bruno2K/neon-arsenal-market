import { Link } from "react-router-dom";
import { EmptyState } from "@/components/page-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <EmptyState
        title="Página não encontrada"
        description="Esse endereço não existe neste site."
        action={
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        }
      />
    </div>
  );
}
