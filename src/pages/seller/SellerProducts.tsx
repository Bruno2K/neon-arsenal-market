import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trash2, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getSellerListings, createListing, updateListing, cancelListing } from '@/api/listings';
import type { Listing } from '@/types/api';

export default function SellerProductsPage() {
  const queryClient = useQueryClient();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productId: '',
    floatValue: '',
    price: '',
    pattern: '',
  });

  const { data: sellerListings, isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: (input: { productId: string; floatValue: number; price: number; pattern?: number }) => createListing(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerListings'] });
      setFormData({ productId: '', floatValue: '', price: '', pattern: '' });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<{ price: number; status: 'ACTIVE' | 'SOLD' | 'RESERVED' | 'CANCELED'; tradeLockUntil: string | null }> }) =>
      updateListing(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerListings'] });
      setEditingId(null);
      setFormData({ productId: '', floatValue: '', price: '', pattern: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cancelListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerListings'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const floatValue = parseFloat(formData.floatValue);
    const price = parseFloat(formData.price);

    if (!formData.productId || isNaN(floatValue) || isNaN(price)) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        input: {
          price,
          status: 'ACTIVE',
        },
      });
    } else {
      createMutation.mutate({
        productId: formData.productId,
        floatValue,
        price,
        pattern: formData.pattern ? parseInt(formData.pattern) : undefined,
      });
    }
  };

  const handleEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setFormData({
      productId: listing.productId,
      floatValue: listing.floatValue.toString(),
      price: listing.price.toString(),
      pattern: listing.pattern?.toString() || '',
    });
    setShowForm(true);
  };

  const handleCancel = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this listing?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">My Listings</h1>
              <p className="text-gray-400">Manage your CS2 skin marketplace listings</p>
            </div>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({ productId: '', floatValue: '', price: '', pattern: '' });
                setShowForm(!showForm);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : 'Create Listing'}
            </Button>
          </div>
        </motion.div>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">
                  {editingId ? 'Edit Listing' : 'Create New Listing'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Product ID*
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., 1, 2, 3..."
                        value={formData.productId}
                        onChange={(e) =>
                          setFormData({ ...formData, productId: e.target.value })
                        }
                        disabled={!!editingId}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Float Value (0-1)*
                      </label>
                      <Input
                        type="number"
                        placeholder="0.15"
                        step="0.01"
                        min="0"
                        max="1"
                        value={formData.floatValue}
                        onChange={(e) =>
                          setFormData({ ...formData, floatValue: e.target.value })
                        }
                        disabled={!!editingId}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Price (USD)*
                      </label>
                      <Input
                        type="number"
                        placeholder="9.99"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">
                        Pattern (optional)
                      </label>
                      <Input
                        type="number"
                        placeholder="1000"
                        value={formData.pattern}
                        onChange={(e) =>
                          setFormData({ ...formData, pattern: e.target.value })
                        }
                        disabled={!!editingId}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending ||
                        updateMutation.isPending
                      }
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {editingId ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        editingId ? 'Update Listing' : 'Create Listing'
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                      }}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Listings Table */}
        {listings.length === 0 ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No listings yet. Create your first listing!</p>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="overflow-x-auto"
          >
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">
                        Skin
                      </th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">
                        Float
                      </th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((listing) => (
                      <motion.tr
                        key={listing.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-700 hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">
                            {listing.product?.weapon} | {listing.product?.skinName}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {listing.product?.exterior}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          {listing.floatValue.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 text-white font-semibold">
                          ${listing.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              listing.status === 'ACTIVE' ? 'default' : 'secondary'
                            }
                          >
                            {listing.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {listing.status === 'ACTIVE' && (
                              <Button
                                size="sm"
                                onClick={() => handleEdit(listing)}
                                disabled={
                                  updateMutation.isPending ||
                                  editingId === listing.id
                                }
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleCancel(listing.id)}
                              disabled={
                                deleteMutation.isPending ||
                                listing.status !== 'ACTIVE'
                              }
                              variant="destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
