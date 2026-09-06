import { Link } from "react-router-dom";
import { HOME_SELLER_CTA, HOME_TRUST_HEADING } from "@/lib/homeDiscovery";

const FOOTER_TRUST_COPY =
  "Cada listing é um item único. O pagamento é pelo PayPal.";

const footerLinkClass =
  "inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="container grid gap-8 py-10 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Neon Arsenal
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {FOOTER_TRUST_COPY}
          </p>
        </div>

        <nav aria-label="Market">
          <p className="text-sm font-medium text-foreground">Market</p>
          <ul className="mt-3 flex flex-col">
            <li>
              <Link to="/products" className={footerLinkClass}>
                Market
              </Link>
            </li>
            <li>
              <Link to="/#home-trust-heading" className={footerLinkClass}>
                {HOME_TRUST_HEADING}
              </Link>
            </li>
            <li>
              <Link to="/register" className={footerLinkClass}>
                {HOME_SELLER_CTA}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Conta">
          <p className="text-sm font-medium text-foreground">Conta</p>
          <ul className="mt-3 flex flex-col">
            <li>
              <Link to="/login" className={footerLinkClass}>
                Entrar
              </Link>
            </li>
            <li>
              <Link to="/register" className={footerLinkClass}>
                Criar conta
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="container py-4 text-xs text-muted-foreground">
          © {year} Neon Arsenal
        </div>
      </div>
    </footer>
  );
}
