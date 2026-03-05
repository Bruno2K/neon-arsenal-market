// ─── Domain Entity: Product ──────────────────────────────────────────────────
// Core product entity aligned with the Prisma schema.

export interface ProductSeller {
  id: string;
  storeName: string;
  rating: number;
}

export type ProductCategory = "rifles" | "pistols" | "knives" | "gloves" | "accounts" | "services" | "other";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  sellerId: string;
  imageUrl?: string | null;
  category?: ProductCategory | null;
  seller?: ProductSeller;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListParams {
  sellerId?: string;
  isActive?: boolean;
  search?: string;
  category?: ProductCategory;
  page?: number;
  limit?: number;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
  category?: ProductCategory;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
  imageUrl?: string | null;
  category?: ProductCategory | null;
}
