import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Listing } from "@/types/api";
import { cartSnapshotNeedsUpdate } from "@/lib/cartListingStatus";
import { loadCartFromStorage, saveCartToStorage } from "@/lib/cartStorage";
import {
  CART_ADDED_MESSAGE,
  CART_DUPLICATE_MESSAGE,
  CART_REMOVED_MESSAGE,
} from "@/lib/listingCartCta";
import { useToast } from "@/hooks/use-toast";

export type AddItemResult = "added" | "duplicate" | "unavailable";

export interface CartItem {
  listing: Listing;
  priceWhenAdded: Listing["price"];
}

interface CartContextType {
  items: CartItem[];
  addItem: (listing: Listing) => AddItemResult;
  updateListing: (listing: Listing) => void;
  removeItem: (listingId: string) => void;
  removeItems: (listingIds: string[]) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() =>
    loadCartFromStorage().map((item) => ({
      listing: item.listing,
      priceWhenAdded: item.priceWhenAdded ?? item.listing.price,
    })),
  );
  const { toast } = useToast();

  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  const addItem = (listing: Listing): AddItemResult => {
    if (listing.status !== "ACTIVE") {
      return "unavailable";
    }
    if (items.some((item) => item.listing.id === listing.id)) {
      toast({ title: CART_DUPLICATE_MESSAGE });
      return "duplicate";
    }
    setItems((prev) => {
      if (prev.some((item) => item.listing.id === listing.id)) {
        return prev;
      }
      return [...prev, { listing, priceWhenAdded: listing.price }];
    });
    toast({ title: CART_ADDED_MESSAGE });
    return "added";
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

  const removeItem = (listingId: string) => {
    if (!items.some((item) => item.listing.id === listingId)) {
      return;
    }
    setItems((prev) => prev.filter((item) => item.listing.id !== listingId));
    toast({ title: CART_REMOVED_MESSAGE });
  };

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
