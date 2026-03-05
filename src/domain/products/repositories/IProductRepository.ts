// ─── Repository Interface: Products ─────────────────────────────────────────

import type {
  Product,
  PaginatedProducts,
  ProductListParams,
  CreateProductData,
  UpdateProductData,
} from '../entities/Product';

export interface IProductRepository {
  findMany(params?: ProductListParams): Promise<PaginatedProducts>;
  findById(id: string): Promise<Product>;
  create(data: CreateProductData): Promise<Product>;
  update(id: string, data: UpdateProductData): Promise<Product>;
  delete(id: string): Promise<void>;
  findBySeller(): Promise<PaginatedProducts>;
}
