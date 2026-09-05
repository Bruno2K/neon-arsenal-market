import { useState } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import {
  BarChart3,
  Menu,
  Package,
  ShoppingBag,
  Users,
  Shield,
  Tag,
} from "lucide-react";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const sellerItems = [
  { icon: BarChart3, label: "Visão Geral", href: "/seller" },
  { icon: Tag, label: "Listings", href: "/seller/listings" },
  { icon: Package, label: "Produtos", href: "/seller/products" },
  { icon: ShoppingBag, label: "Pedidos", href: "/seller/orders" },
];

const adminItems = [
  { icon: BarChart3, label: "Visão Geral", href: "/admin" },
  { icon: Users, label: "Vendedores", href: "/admin/sellers" },
  { icon: ShoppingBag, label: "Pedidos", href: "/admin/orders" },
  { icon: Shield, label: "Usuários", href: "/admin/users" },
];

function isActive(pathname: string, href: string) {
  if (href === "/seller" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItems({
  items,
  pathname,
  onNavigate,
}: {
  items: typeof sellerItems;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1" aria-label="Painel">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const items = isAdmin ? adminItems : sellerItems;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-border p-4 lg:flex lg:flex-col">
          <NavItems items={items} pathname={location.pathname} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-2 lg:hidden">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setOpen(true)}
            >
              <Menu className="mr-2 h-4 w-4" />
              Menu do painel
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>{isAdmin ? "Admin" : "Dashboard"}</SheetTitle>
                  <SheetDescription>Navegação do painel</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <NavItems
                    items={items}
                    pathname={location.pathname}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
