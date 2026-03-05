import { createContext, useContext, useState, ReactNode } from 'react';
import type { Listing } from '@/types/api';

export interface CartItem {
  listing: Listing;
}

interface CartContextType {
  items: CartItem[];
  addItem: (listing: Listing) => void;
  removeItem: (listingId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (listing: Listing) => {
    // Check if listing is already in cart
    if (items.some(i => i.listing.id === listing.id)) {
      return; // Already in cart, each listing is unique
    }
    // Check if listing is available
    if (listing.status !== 'ACTIVE') {
      return; // Cannot add non-active listings
    }
    setItems(prev => [...prev, { listing }]);
  };

  const removeItem = (listingId: string) => setItems(prev => prev.filter(i => i.listing.id !== listingId));

  const clearCart = () => setItems([]);
  const totalItems = items.length; // Each item is unique, no quantity
  const totalPrice = items.reduce((s, i) => s + Number(i.listing.price), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
