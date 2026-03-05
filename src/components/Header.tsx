// ─── Component: Header ───────────────────────────────────────────────────────
// Sticky top navigation bar.
// - Role-aware links (SELLER → Dashboard, ADMIN → Admin Panel)
// - Authenticated user menu: Meus Pedidos, Perfil, Sair
// - Unauthenticated: Login button

import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  Crosshair,
  LogOut,
  ShoppingBag,
  Settings,
  Store,
} from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function Header() {
  const { totalItems } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Primary nav links (always visible)
  const navLinks = [
    { to: '/',        label: 'Home'   },
    { to: '/products', label: 'Market' },
    ...(user?.role === 'SELLER' ? [{ to: '/seller', label: 'Dashboard' }] : []),
    ...(user?.role === 'ADMIN'  ? [{ to: '/admin',  label: 'Admin'     }] : []),
  ];

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2">
          <Crosshair className="h-6 w-6 text-primary" />
          <span className="font-heading text-xl text-primary neon-text tracking-wider">
            SKINMARKET
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <Link
            to="/cart"
            className="relative p-2 hover:text-primary transition-colors text-muted-foreground"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </Link>

          {/* Auth section */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-heading text-primary">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
                <span className="text-sm text-foreground hidden sm:inline max-w-[120px] truncate">
                  {user?.name}
                </span>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
                    {/* User info */}
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-xs font-medium text-foreground truncate">
                        {user?.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <Link
                        to="/orders"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Meus Pedidos
                      </Link>

                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Perfil
                      </Link>

                      {/* Seller apply — only for CUSTOMERs */}
                      {user?.role === 'CUSTOMER' && (
                        <Link
                          to="/seller/apply"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Store className="h-4 w-4" />
                          Tornar-se Vendedor
                        </Link>
                      )}

                      {/* Dashboard shortcut for SELLER/ADMIN */}
                      {user?.role === 'SELLER' && (
                        <Link
                          to="/seller"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <User className="h-4 w-4" />
                          Meu Dashboard
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-border py-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate('/login')}>
              <User className="h-4 w-4 mr-1" /> Login
            </Button>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border p-4 space-y-1 bg-background">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="block text-sm text-muted-foreground hover:text-primary py-2 px-3 rounded-md hover:bg-muted transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated && (
            <>
              <Link
                to="/orders"
                className="block text-sm text-muted-foreground hover:text-primary py-2 px-3 rounded-md hover:bg-muted transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Meus Pedidos
              </Link>
              <Link
                to="/profile"
                className="block text-sm text-muted-foreground hover:text-primary py-2 px-3 rounded-md hover:bg-muted transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Perfil
              </Link>
              <button
                type="button"
                className="block w-full text-left text-sm text-destructive py-2 px-3 rounded-md hover:bg-destructive/10 transition-colors"
                onClick={() => { handleLogout(); setMenuOpen(false); }}
              >
                Sair
              </button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
