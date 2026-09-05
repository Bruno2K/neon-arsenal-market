import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import type { Listing } from "@/types/api";
import { cartSnapshotNeedsUpdate } from "@/lib/cartListingStatus";

export interface CartItem {
  listing: Listing;
  priceWhenAdded: Listing["price"];
}

interface CartContextType {
  items: CartItem[];
  addItem: (listing: Listing) => void;
  updateListing: (listing: Listing) => void;
  removeItem: (listingId: string) => void;
  removeItems: (listingIds: string[]) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (listing: Listing) => {
    // Check if listing is already in cart
    if (items.some((i) => i.listing.id === listing.id)) {
      return; // Already in cart, each listing is unique
    }
    // Check if listing is available
    if (listing.status !== "ACTIVE") {
      return; // Cannot add non-active listings
    }
    setItems((prev) => [...prev, { listing, priceWhenAdded: listing.price }]);
  };

  const updateListing = useCallback((listing: Listing) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => item.listing.id === listing.id);
      if (index === -1) return prev;
      const current = prev[index].listing;
      if (!cartSnapshotNeedsUpdate(current, listing)) return prev;
      const next = [...prev];
      next[index] = { ...next[index], listing };
      return next;
    });
  }, []);

  const removeItem = (listingId: string) =>
    setItems((prev) => prev.filter((i) => i.listing.id !== listingId));

  const removeItems = (listingIds: string[]) => {
    const ids = new Set(listingIds);
    setItems((prev) => prev.filter((i) => !ids.has(i.listing.id)));
  };

  const clearCart = () => setItems([]);
  const totalItems = items.length; // Each item is unique, no quantity
  const totalPrice = items.reduce((s, i) => s + Number(i.listing.price), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateListing,
        removeItem,
        removeItems,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
