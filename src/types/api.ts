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
  /** Prisma Decimal JSON string (fraction, e.g. "0.1" = 10%). OpenAPI may still say number. */
  commissionRate?: string | number;
  /** Prisma Decimal JSON string. Prefer GET /commissions/balance for the projection. */
  balance: string | number;
  rating: number;
  isApproved: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: { id: string; name: string; email: string };
}

export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";

/** GET /commissions/balance — Seller.balance projection as a Decimal JSON string. */
export interface CommissionBalance {
  balance: string;
}

/**
 * GET /commissions/transactions — SellerTransaction row.
 * Decimal fields serialize as strings (Prisma Decimal#toJSON).
 * SELLER payload includes `order`; ADMIN list also includes `seller`.
 */
export interface SellerTransaction {
  id: string;
  sellerId: string;
  orderId: string;
  grossAmount: string | number;
  commissionAmount: string | number;
  netAmount: string | number;
  status: PaymentStatus;
  createdAt: string;
  order?: { id: string; createdAt: string };
  seller?: { id: string; storeName: string };
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
  marketHashName?: string | null;
  referencePriceUsd?: string | number | null;
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
  currency: "BRL";
  status: "ACTIVE" | "SOLD" | "RESERVED" | "CANCELED";
  tradeLockUntil?: string | null;
  reservedAt?: string | null;
  reservationExpiresAt?: string | null;
  reservedByOrderId?: string | null;
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
  status?: Listing["status"];
  reservedAt?: string | null;
  reservationExpiresAt?: string | null;
  reservedByOrderId?: string | null;
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
  /** Present when the admin/order API already returns it. Not a PayPal secret. */
  paypalOrderId?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  customer?: User;
}

export interface ApiError {
  error: string;
}

/** GET /reviews/product/:productId — review of a catalog Product, not a listing. */
export interface ReviewUser {
  id: string;
  name: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: ReviewUser;
  product?: { id: string; skinName: string };
}

export interface CreateReviewBody {
  productId: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewBody {
  rating?: number;
  comment?: string;
}

/** GET /favorites — listing may be SOLD and still returned. */
export interface Favorite {
  listingId: string;
  listing?: Listing;
  id?: string;
  userId?: string;
  createdAt?: string;
}

/** POST /favorites 200 — create and duplicate are both `{ listingId }`. */
export interface AddFavoriteResponse {
  listingId: string;
}
