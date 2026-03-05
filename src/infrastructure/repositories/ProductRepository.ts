// ─── Infrastructure: ProductRepository ──────────────────────────────────────

import type { IProductRepository } from '@/domain/products/repositories/IProductRepository';
import type {
  Product,
  PaginatedProducts,
  ProductListParams,
  CreateProductData,
  UpdateProductData,
} from '@/domain/products/entities/Product';
import { httpRequest } from '../http/HttpClient';

export class ProductRepository implements IProductRepository {
  async findMany(params?: ProductListParams): Promise<PaginatedProducts> {
    const qs = this.buildQueryString(params);
    return httpRequest<PaginatedProducts>(`/products${qs}`);
  }

  async findById(id: string): Promise<Product> {
    return httpRequest<Product>(`/products/${id}`);
  }

  async create(data: CreateProductData): Promise<Product> {
    return httpRequest<Product>('/products', { method: 'POST', body: data });
  }

  async update(id: string, data: UpdateProductData): Promise<Product> {
    return httpRequest<Product>(`/products/${id}`, { method: 'PATCH', body: data });
  }

  async delete(id: string): Promise<void> {
    await httpRequest<void>(`/products/${id}`, { method: 'DELETE' });
  }

  async findBySeller(): Promise<PaginatedProducts> {
    return httpRequest<PaginatedProducts>('/sellers/me/products');
  }

  // ── Private Helpers ─────────────────────────────────────────────────────
  private buildQueryString(params?: ProductListParams): string {
    if (!params) return '';

    const searchParams = new URLSearchParams();

    if (params.sellerId)               searchParams.set('sellerId',  params.sellerId);
    if (params.isActive !== undefined) searchParams.set('isActive',  String(params.isActive));
    if (params.search)                 searchParams.set('search',    params.search);
    if (params.category)               searchParams.set('category',  params.category);
    if (params.page)                   searchParams.set('page',      String(params.page));
    if (params.limit)                  searchParams.set('limit',     String(params.limit));

    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
  }
}

export const productRepository = new ProductRepository();
