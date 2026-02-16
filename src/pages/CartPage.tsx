import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice, totalItems } = useCart();

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-heading text-foreground mb-2">Carrinho Vazio</h1>
        <p className="text-muted-foreground mb-6">Adicione itens do marketplace para começar</p>
        <Button asChild><Link to="/products">Explorar Market</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-heading text-foreground mb-8">Carrinho ({totalItems})</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, quantity }) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
            >
              <div className={`h-20 w-20 rounded-md rarity-bg-${product.rarity} flex items-center justify-center flex-shrink-0`}>
                <span className="text-xs font-heading text-foreground/60">{product.name.split(' | ')[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${product.id}`} className="font-heading text-sm text-foreground hover:text-primary transition-colors truncate block normal-case">
                  {product.name}
                </Link>
                <span className="text-primary font-heading text-lg">${product.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity - 1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(product.id, quantity + 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(product.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Summary */}
        <div className="p-6 rounded-lg border border-border bg-card h-fit space-y-4 sticky top-24">
          <h2 className="font-heading text-lg text-foreground">Resumo</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de serviço</span>
              <span>${(totalPrice * 0.05).toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-heading text-lg text-foreground">
              <span>Total</span>
              <span className="text-primary">${(totalPrice * 1.05).toFixed(2)}</span>
            </div>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link to="/checkout">Finalizar Compra</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
