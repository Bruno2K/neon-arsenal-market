import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { marketPath, parseMarketQuery } from "@/lib/marketQuery";

function brandMark() {
  return (
    <Link
      to="/"
      className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Neon Arsenal, página inicial"
    >
      <span className="h-4 w-4 rounded-sm bg-primary" aria-hidden />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Neon Arsenal
      </span>
    </Link>
  );
}

function HeaderSearch({
  id,
  className,
  onSubmitted,
}: {
  id: string;
  className?: string;
  onSubmitted?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQ =
    location.pathname === "/products" ? parseMarketQuery(searchParams).q : "";
  const [draft, setDraft] = useState(urlQ);

  useEffect(() => {
    setDraft(urlQ);
  }, [urlQ]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = draft.trim();
    navigate(term ? marketPath({ q: term }) : "/products");
    onSubmitted?.();
  };

  return (
    <form role="search" onSubmit={submit} className={className}>
      <label htmlFor={id} className="sr-only">
        Buscar no Market
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Buscar skins"
          autoComplete="off"
          className="h-9 min-h-9 pl-8"
        />
      </div>
    </form>
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
    ...(user?.role === "CUSTOMER"
      ? [{ to: "/account/orders", label: "Pedidos" }]
      : []),
    ...(user?.role === "SELLER" ? [{ to: "/seller", label: "Dashboard" }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const linkClass = (to: string) => {
    const active =
      to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
    return `inline-flex min-h-11 items-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
            <Link
              key={item.to}
              to={item.to}
              className={linkClass(item.to)}
              aria-current={
                (
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to)
                )
                  ? "page"
                  : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <HeaderSearch
          id="header-search"
          className="mx-2 min-w-0 max-w-[14rem] flex-1 sm:max-w-[16rem] md:mx-3"
        />

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Link
                to="/account"
                className="max-w-[10rem] truncate text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {user?.name}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                Sair
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" asChild>
                <Link to="/register">Register</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/login")}
              >
                Login
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-haspopup="true"
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
          <HeaderSearch
            id="header-search-mobile"
            className="mb-2"
            onSubmitted={() => setMenuOpen(false)}
          />
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block rounded-md px-3 py-2.5 text-sm ${linkClass(item.to)}`}
              aria-current={
                (
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to)
                )
                  ? "page"
                  : undefined
              }
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link
                to="/account"
                className={`block rounded-md px-3 py-2.5 text-sm ${linkClass("/account")}`}
                onClick={() => setMenuOpen(false)}
              >
                {user?.name ?? "Minha conta"}
              </Link>
              <button
                type="button"
                className="block min-h-11 w-full rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  void logout();
                  setMenuOpen(false);
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/register"
              className={`block rounded-md px-3 py-2.5 text-sm ${linkClass("/register")}`}
              onClick={() => setMenuOpen(false)}
            >
              Register
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
