import { Outlet, useLocation, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import {
  BarChart3,
  Package,
  ShoppingBag,
  Users,
  Shield,
  Tag,
} from "lucide-react";

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

export default function DashboardLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const items = isAdmin ? adminItems : sellerItems;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <aside className="hidden lg:flex w-56 flex-col border-r border-border sticky top-16 h-[calc(100vh-4rem)] p-4">
          <nav className="space-y-1">
            {items.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
