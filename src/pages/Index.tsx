import { motion } from 'framer-motion';
import { ProductCard } from '@/components/ProductCard';
import type { Listing } from '@/types/api';
import { useQuery } from '@tanstack/react-query';
import { listListings } from '@/api/listings';

export default function IndexPage() {
  const { data: listingsData } = useQuery({
    queryKey: ['listings'],
    queryFn: () => listListings({ status: 'ACTIVE', limit: 8 }),
  });
  const listings = listingsData?.items ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-black"
    >
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-2">CS2 Skin Marketplace</h1>
        <p className="text-gray-400 mb-12">Browse premium weapon skins</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {listings.map((p) => (
            <ProductCard key={p.id} listing={p as unknown as Listing} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
