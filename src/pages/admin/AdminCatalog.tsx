import { Cs2ShCatalogImportCard } from "@/components/admin/Cs2ShCatalogImportCard";

export default function AdminCatalog() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importação do catálogo cs2.sh. Não exige SSH no Render.
        </p>
      </div>
      <Cs2ShCatalogImportCard />
    </div>
  );
}
