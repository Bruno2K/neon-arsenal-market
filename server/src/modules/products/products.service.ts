import { productsRepository } from "./products.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateProductInput, UpdateProductInput, ListProductsQuery } from "./products.dto.js";

export const productsService = {
  async list(query: ListProductsQuery) {
    const where: any = {};

    if (query.game) where.game = query.game;
    if (query.weapon) where.weapon = { contains: query.weapon, mode: "insensitive" };
    if (query.exterior) where.exterior = query.exterior;
    if (query.rarity) where.rarity = query.rarity;
    if (query.isStattrak !== undefined) where.isStattrak = query.isStattrak;

    if (query.search) {
      where.OR = [
        { weapon: { contains: query.search, mode: "insensitive" } },
        { skinName: { contains: query.search, mode: "insensitive" } },
        { collection: { contains: query.search, mode: "insensitive" } },
      ];
    }

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

  async create(_userId: string, role: string, input: CreateProductInput) {
    // Only ADMIN can create products (catalog entries)
    if (role !== "ADMIN") {
      throw new AppError(403, "Only admins can create product catalog entries");
    }

    return productsRepository.create({
      game: input.game || "CS2",
      weapon: input.weapon,
      skinName: input.skinName,
      rarity: input.rarity,
      exterior: input.exterior,
      collection: input.collection,
      imageUrl: input.imageUrl || null,
      isStattrak: input.isStattrak || false,
      isSouvenir: input.isSouvenir || false,
    });
  },

  async update(productId: string, _userId: string, role: string, input: UpdateProductInput) {
    const product = await productsRepository.findById(productId);
    if (!product) throw new AppError(404, "Product not found");

    // Only ADMIN can update products (catalog entries)
    if (role !== "ADMIN") {
      throw new AppError(403, "Only admins can update product catalog entries");
    }

    return productsRepository.update(productId, input);
  },

  async delete(productId: string, _userId: string, role: string) {
    const product = await productsRepository.findById(productId);
    if (!product) throw new AppError(404, "Product not found");

    // Only ADMIN can delete products (catalog entries)
    if (role !== "ADMIN") {
      throw new AppError(403, "Only admins can delete product catalog entries");
    }

    await productsRepository.delete(productId);
    return { success: true };
  },
};
