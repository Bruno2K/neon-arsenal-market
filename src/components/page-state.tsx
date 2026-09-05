import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Action = ReactNode;

export function PageSkeleton({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="container space-y-4 py-10" role="status" aria-label={label}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: Action;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center" role="status">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: Action;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center" role="alert">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
