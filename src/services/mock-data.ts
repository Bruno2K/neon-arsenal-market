export type SellerRank = 'bronze' | 'silver' | 'gold' | 'global-elite';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type UserRole = 'customer' | 'seller' | 'admin';

export interface Seller {
  id: string;
  name: string;
  rank: SellerRank;
  rating: number;
  totalSales: number;
  balance: number;
  activeProducts: number;
  approved: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  rarity: Rarity;
  sellerId: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  stock: number;
  tags: string[];
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  items: { productId: string; name: string; price: number; quantity: number }[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
}

export const sellers: Seller[] = [
  { id: 's1', name: 'NeonTrader', rank: 'global-elite', rating: 4.9, totalSales: 15420, balance: 3250, activeProducts: 47, approved: true },
  { id: 's2', name: 'SkinVault', rank: 'gold', rating: 4.7, totalSales: 8930, balance: 1840.5, activeProducts: 32, approved: true },
  { id: 's3', name: 'FragMaster', rank: 'silver', rating: 4.3, totalSales: 3210, balance: 680.25, activeProducts: 18, approved: true },
  { id: 's4', name: 'PixelArms', rank: 'gold', rating: 4.6, totalSales: 6780, balance: 1420.75, activeProducts: 28, approved: true },
  { id: 's5', name: 'NewRecruit', rank: 'bronze', rating: 3.8, totalSales: 120, balance: 45, activeProducts: 5, approved: false },
];

export const products: Product[] = [
  { id: 'p1', name: 'AK-47 | Neon Rider', description: 'Factory New. Vibrant neon geometric design with electric green and pink accents. One of the most sought-after AK skins.', price: 89.99, originalPrice: 129.99, category: 'rifles', rarity: 'legendary', sellerId: 's1', rating: 4.8, reviewCount: 234, inStock: true, stock: 3, tags: ['factory-new', 'popular'] },
  { id: 'p2', name: 'AWP | Dragon Lore', description: 'Minimal Wear. The legendary dragon-themed AWP skin. A true collector\'s item.', price: 1249.99, category: 'rifles', rarity: 'legendary', sellerId: 's1', rating: 5.0, reviewCount: 89, inStock: true, stock: 1, tags: ['rare', 'collector'] },
  { id: 'p3', name: 'M4A4 | Howl', description: 'Field-Tested. Contraband rarity. Iconic wolf design that\'s no longer available in drops.', price: 699.99, originalPrice: 899.99, category: 'rifles', rarity: 'epic', sellerId: 's2', rating: 4.9, reviewCount: 156, inStock: true, stock: 2, tags: ['contraband'] },
  { id: 'p4', name: 'Karambit | Fade', description: 'Factory New. 90/10 fade pattern. Premium knife skin with smooth animation.', price: 459.99, category: 'knives', rarity: 'legendary', sellerId: 's2', rating: 4.7, reviewCount: 198, inStock: true, stock: 4, tags: ['fade'] },
  { id: 'p5', name: 'Desert Eagle | Blaze', description: 'Factory New. Classic fire design that never goes out of style.', price: 34.99, category: 'pistols', rarity: 'rare', sellerId: 's3', rating: 4.5, reviewCount: 312, inStock: true, stock: 8, tags: ['classic'] },
  { id: 'p6', name: 'Glock-18 | Fade', description: 'Factory New. Rainbow fade finish. A pistol round flex.', price: 124.99, category: 'pistols', rarity: 'epic', sellerId: 's4', rating: 4.6, reviewCount: 167, inStock: true, stock: 5, tags: ['fade'] },
  { id: 'p7', name: 'Butterfly Knife | Tiger Tooth', description: 'Factory New. Gold tiger stripe pattern with stunning flip animation.', price: 389.99, category: 'knives', rarity: 'epic', sellerId: 's1', rating: 4.8, reviewCount: 145, inStock: true, stock: 2, tags: ['gold'] },
  { id: 'p8', name: 'Sport Gloves | Hedge Maze', description: 'Field-Tested. Green labyrinth design. Pairs great with green skins.', price: 179.99, originalPrice: 219.99, category: 'gloves', rarity: 'rare', sellerId: 's4', rating: 4.4, reviewCount: 78, inStock: true, stock: 6, tags: ['green'] },
  { id: 'p9', name: 'USP-S | Kill Confirmed', description: 'Minimal Wear. Skull x-ray design with detailed artwork.', price: 54.99, category: 'pistols', rarity: 'rare', sellerId: 's3', rating: 4.3, reviewCount: 201, inStock: true, stock: 10, tags: ['skull'] },
  { id: 'p10', name: 'Prime Account | Level 21', description: 'Full access Prime account ready for competitive play.', price: 24.99, category: 'accounts', rarity: 'uncommon', sellerId: 's2', rating: 4.1, reviewCount: 567, inStock: true, stock: 15, tags: ['prime'] },
  { id: 'p11', name: 'Rank Boost | Gold to MG', description: 'Professional boosting service. Estimated 3-5 days delivery.', price: 49.99, category: 'services', rarity: 'common', sellerId: 's3', rating: 4.0, reviewCount: 89, inStock: true, stock: 99, tags: ['boost'] },
  { id: 'p12', name: 'M4A1-S | Printstream', description: 'Factory New. Clean black and white design. Currently trending.', price: 159.99, category: 'rifles', rarity: 'epic', sellerId: 's4', rating: 4.7, reviewCount: 234, inStock: true, stock: 3, tags: ['trending'] },
];

export const categories = [
  { id: 'rifles', name: 'Rifles', count: 156 },
  { id: 'pistols', name: 'Pistols', count: 89 },
  { id: 'knives', name: 'Knives', count: 67 },
  { id: 'gloves', name: 'Gloves', count: 45 },
  { id: 'accounts', name: 'Accounts', count: 234 },
  { id: 'services', name: 'Services', count: 78 },
];

export const orders: Order[] = [
  { id: 'o1', buyerId: 'u1', sellerId: 's1', items: [{ productId: 'p1', name: 'AK-47 | Neon Rider', price: 89.99, quantity: 1 }], total: 89.99, status: 'completed', createdAt: '2024-08-15' },
  { id: 'o2', buyerId: 'u1', sellerId: 's2', items: [{ productId: 'p4', name: 'Karambit | Fade', price: 459.99, quantity: 1 }], total: 459.99, status: 'processing', createdAt: '2024-09-01' },
  { id: 'o3', buyerId: 'u4', sellerId: 's1', items: [{ productId: 'p2', name: 'AWP | Dragon Lore', price: 1249.99, quantity: 1 }], total: 1249.99, status: 'pending', createdAt: '2024-09-10' },
  { id: 'o4', buyerId: 'u5', sellerId: 's3', items: [{ productId: 'p5', name: 'Desert Eagle | Blaze', price: 34.99, quantity: 2 }], total: 69.98, status: 'completed', createdAt: '2024-08-20' },
  { id: 'o5', buyerId: 'u6', sellerId: 's4', items: [{ productId: 'p8', name: 'Sport Gloves | Hedge Maze', price: 179.99, quantity: 1 }], total: 179.99, status: 'completed', createdAt: '2024-08-25' },
];

export const getSellerById = (id: string) => sellers.find(s => s.id === id);
export const getProductById = (id: string) => products.find(p => p.id === id);
export const getProductsBySeller = (sellerId: string) => products.filter(p => p.sellerId === sellerId);
export const getOrdersBySeller = (sellerId: string) => orders.filter(o => o.sellerId === sellerId);
