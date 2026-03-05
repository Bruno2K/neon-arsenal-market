import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getProduct } from '@/api/products';
import { listListings } from '@/api/listings';
import { ListingCard } from '@/components/ProductCard';
import { Loader2, AlertCircle } from 'lucide-react';

export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>();

  const { data: product, isLoading: isProductLoading, error: productError } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
    enabled: !!productId,
  });

  const { data: listingsData, isLoading: isListingsLoading } = useQuery({
    queryKey: ['listings', productId],
    queryFn: () => listListings({ productId, status: 'ACTIVE' }),
    enabled: !!productId,
  });
  const listings = listingsData?.items ?? [];

  if (!productId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg">Product not found</p>
        </div>
      </div>
    );
  }

  if (isProductLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg">Failed to load product</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-black"
    >
      <div className="container mx-auto px-4 py-16">
        {/* Product Header */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-gray-800 rounded-lg p-8 mb-12 border border-gray-700"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            {product.weapon} | {product.skinName}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <p className="text-gray-400 text-sm">Exterior</p>
              <p className="text-white font-semibold">{product.exterior}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Rarity</p>
              <p className="text-white font-semibold">{product.rarity}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Stat Trak</p>
              <p className="text-white font-semibold">{product.isStattrak ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Souvenir</p>
              <p className="text-white font-semibold">{product.isSouvenir ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </motion.div>

        {/* Listings Section */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Available Listings</h2>
          {isListingsLoading ? (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
              <p className="text-gray-400">No listings available for this product</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
