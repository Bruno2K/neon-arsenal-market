import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listOrders } from '@/api/orders';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Order } from '@/types/api';

export default function SellerOrdersPage() {
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['sellerOrders'],
    queryFn: () => listOrders(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg">Failed to load orders</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6"
    >
      <div className="container mx-auto max-w-7xl">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
          <h1 className="text-4xl font-bold text-white mb-2">Orders</h1>
          <p className="text-gray-400 mb-8">Manage your CS2 skin marketplace orders</p>
        </motion.div>

        {orders.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-12 text-center">
              <p className="text-gray-400">No orders yet</p>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-4"
          >
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const itemsSummary = order.items
    ?.slice(0, 2)
    .map((i) => i.listing?.product ? `${i.listing.product.weapon} | ${i.listing.product.skinName}` : 'Item')
    .join(', ') ?? '—';
  const hasMore = order.items && order.items.length > 2 ? '…' : '';

  const total = order.items?.reduce((sum, i) => sum + Number(i.priceSnapshot || 0), 0) || 0;

  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">Order #{order.id}</h3>
            <p className="text-gray-400 text-sm mb-3">
              {itemsSummary}
              {hasMore}
            </p>
            <div className="flex items-center gap-4">
              <Badge variant={order.status === 'COMPLETED' ? 'default' : 'secondary'}>
                {order.status}
              </Badge>
              {order.createdAt && (
                <p className="text-gray-400 text-sm">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-2xl font-bold">${total.toFixed(2)}</p>
            <p className="text-gray-400 text-sm">{order.items?.length ?? 0} items</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
