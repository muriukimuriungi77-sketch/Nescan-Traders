import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  formatCurrency,
  formatOrderStatusLabel,
  formatTimestamp,
  getOrderStatusStyle,
} from '@/src/lib/format';
import { fetchOrderItems } from '@/src/lib/shopService';
import { Order, OrderItem } from '@/src/types/shop';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOrderItems(order.id)
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load order items.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [order]);

  if (!order) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-heading"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-xl w-full overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between gap-4">
          <div>
            <h2 id="receipt-heading" className="font-display text-lg font-bold text-zinc-900">
              Order {order.orderNumber}
            </h2>
            <p className="text-xs text-zinc-500">
              Placed {formatTimestamp(order.createdAt)} ·{' '}
              <span className={getOrderStatusStyle(order.status)}>
                {formatOrderStatusLabel(order.status)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-md cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-md cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 text-xs border-b border-zinc-100 pb-4">
            <div>
              <span className="text-zinc-500 block">Customer</span>
              <span className="font-semibold text-zinc-900">{order.customerName}</span>
              <span className="block text-zinc-600 font-mono mt-0.5">{order.customerPhone}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Fulfillment & Payment</span>
              <span className="font-semibold text-zinc-900 capitalize">
                {order.fulfillmentType} · {order.paymentMethod.toUpperCase()} ({order.paymentStatus})
              </span>
              <span className="block text-zinc-600 mt-0.5">{order.deliveryAddress}</span>
            </div>
          </div>

          {order.notes && (
            <div className="text-xs text-zinc-600 bg-purple-50/50 border border-purple-100 rounded-md px-3 py-2">
              <span className="font-medium text-zinc-800">Note: </span>
              {order.notes}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-zinc-700 mb-2">Itemized Breakdown</h3>
            {loading ? (
              <div className="space-y-2 py-2">
                <div className="h-8 bg-zinc-100 rounded animate-pulse" />
                <div className="h-8 bg-zinc-100 rounded animate-pulse" />
              </div>
            ) : error ? (
              <p className="text-xs text-red-700">{error}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-purple-100 text-xs text-zinc-500">
                    <th className="py-2 text-left font-medium">Item</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Unit Price</th>
                    <th className="py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-zinc-900">{item.productName}</div>
                        <div className="text-xs text-zinc-500 font-mono">
                          {item.sku} · {item.unit}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-zinc-700">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-zinc-700">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium text-zinc-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600">
              Total ({order.itemCount} {order.itemCount === 1 ? 'unit' : 'units'})
            </span>
            <span className="font-mono text-xl font-bold text-zinc-900 tabular-nums">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
