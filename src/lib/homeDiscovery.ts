import type { Product } from "@/types/api";
import { similarItemsMarketPath } from "@/lib/listingCartCta";
import { MARKET_EXTERIORS, marketPath } from "@/lib/marketQuery";

export const HOME_VALUE_PROP =
  "Skins CS2 de item único, anunciadas por vendedores. A reserva começa no checkout; o pagamento é pelo PayPal.";

export const HOME_NEW_HEADING = "Recém-anunciados";
export const HOME_NEW_SORT_COPY =
  "Listings ativos, ordenados do mais recente para o mais antigo.";

export const HOME_SHORTCUTS_HEADING = "Descobrir no Market";
export const HOME_SHORTCUTS_COPY =
  "Atalhos para skins do catálogo. Cada um abre o Market nessa skin.";

export const HOME_TRUST_HEADING = "Como comprar";
export const HOME_TRUST_ITEMS = [
  "Cada listing é um item único.",
  "A reserva acontece no checkout, quando o pagamento começa.",
  "O pagamento é pelo PayPal. A confirmação vem do PayPal, não desta tela.",
  "Vendedores passam por aprovação administrativa.",
] as const;

export const HOME_SELLER_CTA = "Vender no Neon Arsenal";
export const HOME_EMPTY_TITLE = "Nenhum listing ativo";
export const HOME_EMPTY_DESCRIPTION =
  "Ainda não há itens no Market. Cadastre-se como vendedor para anunciar.";

export const HOME_CATALOG_SHORTCUT_LIMIT = 6;
export const HOME_LISTING_RAIL_LIMIT = 8;

export const HOME_EXTERIOR_LINKS = MARKET_EXTERIORS.filter(Boolean).map(
  (exterior) => ({
    exterior,
    label: exterior,
    href: marketPath({ exterior }),
  }),
);

export interface CatalogShortcut {
  productId: string;
  label: string;
  href: string;
}

/** Distinct weapon+skin from the catalog, each with a real Market productId query. */
export function catalogDiscoveryLinks(
  products: Product[],
  limit = HOME_CATALOG_SHORTCUT_LIMIT,
): CatalogShortcut[] {
  const seen = new Set<string>();
  const links: CatalogShortcut[] = [];
  for (const product of products) {
    const id = product.id.trim();
    if (!id) continue;
    const key = `${product.weapon}\0${product.skinName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      productId: id,
      label: `${product.weapon} | ${product.skinName}`,
      href: similarItemsMarketPath(id),
    });
    if (links.length >= limit) break;
  }
  return links;
}

export function listingsCountLabel(total: number): string {
  return total === 1 ? "1 listing ativo" : `${total} listings ativos`;
}

export function approvedSellersCountLabel(total: number): string {
  return total === 1 ? "1 vendedor aprovado" : `${total} vendedores aprovados`;
}
