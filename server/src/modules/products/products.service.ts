import { prisma } from "../../shared/database/index.js";
import { productsRepository } from "./products.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from "./products.dto.js";

export const productsService = {
  async list(query: ListProductsQuery) {
    const where: { sellerId?: string; isActive?: boolean; name?: { contains: string; mode: "insensitive" } } = {};
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.isActive !== undefined) where.isActive = query.isActive === "true";
    if (query.search) where.name = { contains: query.search, mode: "insensitive" };
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await productsRepository.findMany({
      skip,
      take: query.limit,
      where: Object.keys(where).length ? where : undefined,
    });
    return { items, total, page: query.page, limit: query.limit };
  },

  async getById(id: string) {
    const product = await productsRepository.findById(id);
    if (!product) throw new AppError(404, "Product not found");
    return product;
  },

  async create(userId: string, input: CreateProductInput) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");
    return productsRepository.create({
      seller: { connect: { id: seller.id } },
      name: input.name,
      description: input.description,
      price: input.price,
      stock: input.stock,
    });
  },

  async update(productId: string, userId: string, role: string, input: UpdateProductInput) {
    const product = await productsRepository.findById(productId);
    if (!product) throw new AppError(404, "Product not found");
    const sellerId = (product as { seller: { id: string } }).seller?.id;
    if (role !== "ADMIN" && sellerId) {
      const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
      if (!seller || seller.userId !== userId) throw new AppError(403, "Not your product");
    }
    return productsRepository.update(productId, input);
  },

  async delete(productId: string, userId: string, role: string) {
    const product = await productsRepository.findById(productId);
    if (!product) throw new AppError(404, "Product not found");
    const sellerId = (product as { seller: { id: string } }).seller?.id;
    if (sellerId && role !== "ADMIN") {
      const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
      if (!seller || seller.userId !== userId) throw new AppError(403, "Not your product");
    }
    await productsRepository.delete(productId);
    return { success: true };
  },

  async getBySellerUserId(userId: string) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new AppError(404, "Seller not found");
    const { items, total } = await productsRepository.findMany({
      skip: 0,
      take: 100,
      where: { sellerId: seller.id },
    });
    return { items, total };
  },
};
