import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatDatabaseError } from '@/src/lib/firebase';
import {
  formatCurrency,
  formatOrderStatusLabel,
  formatTimestamp,
  getOrderStatusStyle,
} from '@/src/lib/format';
import {
  confirmOrderAndDeductStock,
  placeShopOrder,
  transitionOrderStatus,
  updateOrderPayment,
} from '@/src/lib/shopService';
import {
  CartItem,
  FIELD_LIMITS,
  FulfillmentType,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
} from '@/src/types/shop';

interface OrderDeskViewProps {
  orders: Order[];
  products: Product[];
  productsMap: Map<string, Product>;
  onInspectOrder: (order: Order) => void;
  onSuccess?: (msg: string) => void;
}

const DESK_FILTERS: { id: 'all' | OrderStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: OrderStatus.PENDING, label: 'Pending' },
  { id: OrderStatus.CONFIRMED, label: 'Confirmed' },
  { id: OrderStatus.READY, label: 'Ready' },
  { id: OrderStatus.COMPLETED, label: 'Completed' },
  { id: OrderStatus.CANCELLED, label: 'Cancelled' },
];

export function OrderDeskView({
  orders,
  products,
  productsMap,
  onInspectOrder,
  onSuccess,
}: OrderDeskViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const kpis = useMemo(() => {
    const pendingCount = orders.filter(
      (o) => o.status === OrderStatus.PENDING
    ).length;
    const activeCount = orders.filter(
      (o) =>
        o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.READY
    ).length;
    const completedRevenue = orders
      .filter(
        (o) =>
          o.status !== OrderStatus.CANCELLED &&
          o.paymentStatus === PaymentStatus.PAID
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const unpaidCount = orders.filter(
      (o) =>
        o.status !== OrderStatus.CANCELLED &&
        o.paymentStatus === PaymentStatus.UNPAID
    ).length;
    return { pendingCount, activeCount, completedRevenue, unpaidCount };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      const statusOk = statusFilter === 'all' || o.status === statusFilter;
      const qOk =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.summaryText.toLowerCase().includes(q);
      return statusOk && qOk;
    });
  }, [orders, statusFilter, searchQuery]);

  async function handleConfirmOrder(order: Order) {
    setErrorMsg(null);
    setBusyOrderId(order.id);
    try {
      await confirmOrderAndDeductStock(order, productsMap);
      onSuccess?.(`Confirmed ${order.orderNumber} and saved stock deduction.`);
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to confirm order.')
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleTransition(order: Order, nextStatus: OrderStatus) {
    setErrorMsg(null);
    setBusyOrderId(order.id);
    try {
      await transitionOrderStatus(order, nextStatus, productsMap);
      onSuccess?.(`Saved ${order.orderNumber} status (${formatOrderStatusLabel(nextStatus)}).`);
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to update order status.')
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleTogglePaid(order: Order) {
    setErrorMsg(null);
    setBusyOrderId(order.id);
    const nextPayment =
      order.paymentStatus === PaymentStatus.PAID
        ? PaymentStatus.UNPAID
        : PaymentStatus.PAID;
    try {
      await updateOrderPayment(order.id, nextPayment, order.paymentMethod);
      onSuccess?.(
        `Saved ${order.orderNumber} payment as ${
          nextPayment === PaymentStatus.PAID ? 'Paid' : 'Unpaid'
        }.`
      );
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to update payment status.')
      );
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="py-8 space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <p className="text-xs font-medium text-purple-700">
            Nescan Traders · Counter & Delivery Orders
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900">
            Customer Order Desk
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setNewOrderOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Order</span>
        </button>
      </div>

      {/* 4-Column Order KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-purple-100 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-purple-100">
        <div className="p-5">
          <p className="text-xs text-zinc-500">Pending Review</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              kpis.pendingCount > 0 ? 'text-amber-700' : 'text-zinc-900'
            }`}
          >
            {kpis.pendingCount}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Confirmed / Ready</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-purple-700 tabular-nums">
            {kpis.activeCount}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500">Collected Order Revenue</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(kpis.completedRevenue)}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Unpaid Orders</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {kpis.unpaidCount}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
          {errorMsg}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter order desk by status"
          className="flex items-center gap-1 p-1 bg-purple-50/70 rounded-md overflow-x-auto w-fit max-w-full"
        >
          {DESK_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, phone..."
            className="pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md w-full sm:w-72"
          />
        </div>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-purple-100 rounded-lg p-12 text-center">
          <p className="text-base font-semibold text-zinc-900">
            No customer orders recorded yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Create a customer order here to reserve or deduct shop stock automatically.
          </p>
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md cursor-pointer"
          >
            New Customer Order
          </button>
        </div>
      ) : (
        <div className="bg-white border border-purple-100 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-100 bg-purple-50/60 text-xs text-zinc-600">
                <th className="px-4 py-3 text-left font-medium">Order</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.map((order) => {
                const isBusy = busyOrderId === order.id;
                return (
                  <tr key={order.id} className="hover:bg-purple-50/30">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-zinc-900">
                        {order.orderNumber}
                      </div>
                      <div className="text-[11px] text-zinc-500 tabular-nums">
                        {formatTimestamp(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-zinc-900">
                        {order.customerName}
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        {order.customerPhone} ·{' '}
                        <span className="capitalize font-sans">
                          {order.fulfillmentType}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-zinc-700 max-w-xs truncate">
                      {order.summaryText}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isBusy || order.status === OrderStatus.CANCELLED}
                        onClick={() => void handleTogglePaid(order)}
                        className={`text-xs font-medium cursor-pointer disabled:opacity-50 ${
                          order.paymentStatus === PaymentStatus.PAID
                            ? 'text-purple-700'
                            : 'text-amber-700 underline underline-offset-2'
                        }`}
                      >
                        {order.paymentMethod.toUpperCase()} ·{' '}
                        {order.paymentStatus === PaymentStatus.PAID
                          ? 'Paid'
                          : 'Mark Paid'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium whitespace-nowrap">
                      <span className={getOrderStatusStyle(order.status)}>
                        {formatOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-zinc-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {order.status === OrderStatus.PENDING && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleConfirmOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 rounded cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm & Deduct</span>
                          </button>
                        )}
                        {order.status === OrderStatus.CONFIRMED && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleTransition(order, OrderStatus.READY)
                            }
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 rounded cursor-pointer disabled:opacity-50"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === OrderStatus.READY && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleTransition(order, OrderStatus.COMPLETED)
                            }
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-purple-900 hover:bg-purple-950 rounded cursor-pointer disabled:opacity-50"
                          >
                            Complete
                          </button>
                        )}
                        {(order.status === OrderStatus.PENDING ||
                          order.status === OrderStatus.CONFIRMED) && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleTransition(order, OrderStatus.CANCELLED)
                            }
                            className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded cursor-pointer disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onInspectOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {newOrderOpen && (
        <ShopOrderModal
          products={products}
          onClose={() => setNewOrderOpen(false)}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}

interface ShopOrderModalProps {
  products: Product[];
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

function ShopOrderModal({ products, onClose, onSuccess }: ShopOrderModalProps) {
  const availableProducts = products.filter(
    (p) => p.stockQuantity > 0 && p.price > 0
  );
  const [customerName, setCustomerName] = useState('Walk-In Customer');
  const [customerPhone, setCustomerPhone] = useState('0700000000');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(
    FulfillmentType.PICKUP
  );
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    PaymentStatus.PAID
  );
  const [deductImmediately, setDeductImmediately] = useState(true);
  const [selectedProdId, setSelectedProdId] = useState(
    availableProducts[0]?.id || ''
  );
  const [lines, setLines] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const total = lines.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0
  );

  function addLineItem() {
    const prod = availableProducts.find((p) => p.id === selectedProdId);
    if (!prod) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === prod.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === prod.id
            ? { ...l, quantity: Math.min(prod.stockQuantity, l.quantity + 1) }
            : l
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
  }

  function updateLineQty(productId: string, nextQty: number) {
    if (nextQty <= 0) {
      setLines((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId
          ? {
              ...l,
              quantity: Math.min(l.product.stockQuantity, nextQty),
            }
          : l
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const orderNum = await placeShopOrder({
        items: lines,
        customerName,
        customerPhone,
        fulfillmentType,
        deliveryAddress,
        notes: deductImmediately
          ? 'Completed at shop counter'
          : 'Pending pickup/dispatch',
        paymentMethod,
        paymentStatus,
        deductImmediately,
      });
      onSuccess?.(`Saved order ${orderNum} to database.`);
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to record order.')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-order-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-xl w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between">
          <div>
            <h2 id="shop-order-title" className="font-display text-lg font-bold text-zinc-900">
              Record Customer Order
            </h2>
            <p className="text-xs text-zinc-500">
              Creates an order and updates inventory movement speed when fulfilled.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                required
                minLength={FIELD_LIMITS.NAME_MIN}
                maxLength={FIELD_LIMITS.NAME_MAX}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                required
                minLength={FIELD_LIMITS.PHONE_MIN}
                maxLength={FIELD_LIMITS.PHONE_MAX}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Add Item from Inventory
              </label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit}) — {formatCurrency(p.price)} [{p.stockQuantity} left]
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!selectedProdId}
              onClick={addLineItem}
              className="px-4 py-2 text-sm font-medium text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-md whitespace-nowrap cursor-pointer"
            >
              Add Item
            </button>
          </div>

          {lines.length > 0 && (
            <ul className="divide-y divide-zinc-100 border border-purple-100 rounded-md px-3">
              {lines.map(({ product, quantity }) => (
                <li
                  key={product.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatCurrency(product.price)} × {quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateLineQty(product.id, quantity - 1)}
                      className="p-1 text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono text-xs tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={quantity >= product.stockQuantity}
                      onClick={() => updateLineQty(product.id, quantity + 1)}
                      className="p-1 text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLineQty(product.id, 0)}
                      className="p-1 text-zinc-400 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Fulfillment
              </label>
              <select
                value={fulfillmentType}
                onChange={(e) => setFulfillmentType(e.target.value as FulfillmentType)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                <option value={FulfillmentType.PICKUP}>Shop Pickup</option>
                <option value={FulfillmentType.DELIVERY}>Local Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                <option value={PaymentMethod.CASH}>Cash</option>
                <option value={PaymentMethod.MPESA}>M-Pesa</option>
                <option value={PaymentMethod.CREDIT}>Shop Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                <option value={PaymentStatus.PAID}>Paid</option>
                <option value={PaymentStatus.UNPAID}>Unpaid</option>
              </select>
            </div>
          </div>

          {fulfillmentType === FulfillmentType.DELIVERY && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Delivery Address
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.ADDRESS_MAX}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Estate, road, or shop landmark"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={deductImmediately}
              onChange={(e) => setDeductImmediately(e.target.checked)}
              className="rounded border-zinc-300 text-purple-700"
            />
            <span>Mark completed & deduct stock immediately</span>
          </label>

          <div className="pt-4 border-t border-purple-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-500 block">Order Total</span>
              <span className="font-mono text-lg font-bold text-zinc-900 tabular-nums">
                {formatCurrency(total)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || lines.length === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Order'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
