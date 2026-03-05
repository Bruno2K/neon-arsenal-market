/** API types aligned with backend responses */

export type Role = "ADMIN" | "SELLER" | "CUSTOMER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ProductSeller {
  id: string;
  storeName: string;
  user?: { name: string; id?: string };
  rating?: number;
}

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  commissionRate?: number;
  balance: number;
  rating: number;
  isApproved: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: { id: string; name: string; email: string };
}

// Product catalog base (skin model definition)
export interface Product {
  id: string;
  game: string;
  weapon: string;
  skinName: string;
  rarity: string;
  exterior: string;
  collection?: string | null;
  imageUrl?: string | null;
  isStattrak: boolean;
  isSouvenir: boolean;
  createdAt: string;
  updatedAt: string;
  listings?: Listing[];
  _count?: {
    listings: number;
  };
}

// Individual listing (unique skin item for sale)
export interface Listing {
  id: string;
  productId: string;
  sellerId: string;
  floatValue: number;
  pattern?: number | null;
  price: number;
  currency: string;
  status: "ACTIVE" | "SOLD" | "RESERVED" | "CANCELED";
  tradeLockUntil?: string | null;
  steamAssetId?: string | null;
  createdAt: string;
  soldAt?: string | null;
  updatedAt: string;
  product: Product;
  seller: ProductSeller;
}

export interface PriceHistory {
  id: string;
  listingId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
}

export interface ListProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ListListingsResponse {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateOrderItem {
  listingId: string;
}

export interface CreateOrderBody {
  items: CreateOrderItem[];
}

export interface OrderItemListing {
  id: string;
  product: {
    id: string;
    weapon: string;
    skinName: string;
    exterior: string;
  };
}

export interface OrderItemSeller {
  id: string;
  storeName: string;
}

export interface OrderItem {
  id: string;
  listingId: string;
  sellerId: string;
  priceSnapshot: number;
  listing?: OrderItemListing;
  seller?: OrderItemSeller;
}

export interface Order {
  id: string;
  customerId?: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  trackingCode?: string | null;
  trackingCarrier?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  customer?: User;
}

export interface ApiError {
  error: string;
}
