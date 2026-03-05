import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Crosshair } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function Header() {
  const { totalItems } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/products', label: 'Market' },
    ...(user?.role === 'SELLER' ? [{ to: '/seller', label: 'Dashboard' }] : []),
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Crosshair className="h-6 w-6 text-primary" />
          <span className="font-heading text-xl text-primary neon-text tracking-wider">SKINMARKET</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/cart" className="relative p-2 hover:text-primary transition-colors text-muted-foreground">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-secondary text-secondary-foreground text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={logout}>Sair</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate('/login')}>
              <User className="h-4 w-4 mr-1" /> Login
            </Button>
          )}

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-border p-4 space-y-1 bg-background">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className="block text-sm text-muted-foreground hover:text-primary py-2 px-3 rounded-md hover:bg-muted transition-colors" onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
