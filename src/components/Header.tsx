import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

function brandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="h-4 w-4 rounded-sm bg-primary" aria-hidden />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Neon Arsenal
      </span>
    </Link>
  );
}

export function Header() {
  const { totalItems } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/products", label: "Market" },
    ...(user?.role === "SELLER" ? [{ to: "/seller", label: "Dashboard" }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const linkClass = (to: string) => {
    const active =
      to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
    return `text-sm transition-colors ${
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        {brandMark()}

        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label="Principal"
        >
          {navLinks.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(item.to)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={
              totalItems > 0 ? `Carrinho, ${totalItems} itens` : "Carrinho"
            }
          >
            <ShoppingCart className="h-4 w-4" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-sm text-muted-foreground">
                {user?.name}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sair
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
            <span className="sr-only">Menu</span>
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="space-y-1 border-t border-border bg-background p-3 md:hidden"
          aria-label="Principal"
        >
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block rounded-md px-3 py-2.5 text-sm ${linkClass(item.to)}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <button
              type="button"
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground"
              onClick={() => {
                logout();
                setMenuOpen(false);
              }}
            >
              Sair
            </button>
          ) : null}
        </nav>
      )}
    </header>
  );
}
