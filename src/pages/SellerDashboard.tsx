import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listOrders } from '@/api/orders';
import { getSellerListings } from '@/api/listings';
import type { Listing, Order } from '@/types/api';

export default function SellerDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => listOrders(),
  });

  const { data: sellerListings = [] } = useQuery({
    queryKey: ['sellerListings'],
    queryFn: () => getSellerListings(),
  });

  useEffect(() => {
    if (sellerListings && 'items' in sellerListings) {
      setListings((sellerListings as { items: Listing[]; total: number }).items);
    } else if (Array.isArray(sellerListings)) {
      setListings(sellerListings);
    }
  }, [sellerListings]);

  // Calculate metrics
  const totalRevenue = orders.reduce((sum, order) => {
    const orderSum = order.items?.reduce((itemSum, i) => itemSum + Number(i.priceSnapshot || 0), 0) || 0;
    return sum + orderSum;
  }, 0);

  const activeListings = listings.filter((l) => l.status === 'ACTIVE').length;

  const firstItem = orders[0]?.items?.[0];

  const stats = [
    {
      label: 'Active Listings',
      value: activeListings,
      icon: Package,
      color: 'text-blue-500',
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      label: 'Orders',
      value: orders.length,
      icon: TrendingUp,
      color: 'text-purple-500',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6"
    >
      <div className="container mx-auto max-w-7xl">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }}>
          <h1 className="text-4xl font-bold text-white mb-2">Seller Dashboard</h1>
          <p className="text-gray-400 mb-8">Manage your CS2 skin marketplace inventory</p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.1 }}
            >
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-gray-400">No orders yet</p>
              ) : (
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order) => {
                    const itemsSummary = order.items
                      ?.slice(0, 2)
                      .map((i) => i.listing?.product ? `${i.listing.product.weapon} | ${i.listing.product.skinName}` : 'Item')
                      .join(', ') ?? '—';
                    const hasMore = order.items && order.items.length > 2 ? '…' : '';

                    return (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div>
                          <p className="text-white font-semibold">{firstItem?.listing?.product?.weapon ?? 'Item'}</p>
                          <p className="text-gray-400 text-sm">{itemsSummary}{hasMore}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            $
                            {order.items
                              ?.reduce((sum, i) => sum + Number(i.priceSnapshot || 0), 0)
                              .toFixed(2) || '0.00'}
                          </p>
                          <Badge variant={order.status === 'COMPLETED' ? 'default' : 'secondary'}>
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
