import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { IMAGE_OPTIONS } from '@/src/data/catalogSeed';
import { formatDatabaseError } from '@/src/lib/firebase';
import { formatCurrency } from '@/src/lib/format';
import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  ProductFormPayload,
  recordQuickSale,
  recordStockPurchase,
  updateProduct,
} from '@/src/lib/shopService';
import {
  FIELD_LIMITS,
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
} from '@/src/types/shop';

interface PurchaseModalProps {
  products: Product[];
  initialProduct?: Product | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function PurchaseModal({
  products,
  initialProduct,
  onClose,
  onSuccess,
}: PurchaseModalProps) {
  const defaultProd = initialProduct || products[0] || null;
  const [selectedProductId, setSelectedProductId] = useState(
    defaultProd?.id || ''
  );
  const currentProduct =
    products.find((p) => p.id === selectedProductId) || defaultProd;

  const [quantity, setQuantity] = useState('20');
  const [unitCost, setUnitCost] = useState(
    currentProduct && currentProduct.costPrice > 0
      ? String(currentProduct.costPrice)
      : ''
  );
  const [unitSellPrice, setUnitSellPrice] = useState(
    currentProduct && currentProduct.price > 0
      ? String(currentProduct.price)
      : ''
  );
  const [supplierName, setSupplierName] = useState(
    currentProduct?.supplierName || ''
  );
  const [reason, setReason] = useState('Supplier stock delivery for resale');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSelectProduct(nextId: string) {
    setSelectedProductId(nextId);
    const next = products.find((p) => p.id === nextId);
    if (next) {
      setUnitCost(next.costPrice > 0 ? String(next.costPrice) : '');
      setUnitSellPrice(next.price > 0 ? String(next.price) : '');
      setSupplierName(next.supplierName || '');
    }
  }

  const qtyNum = Math.max(0, Math.round(Number(quantity) || 0));
  const costNum = Math.max(0, Math.round(Number(unitCost) || 0));
  const sellNum =
    unitSellPrice.trim() === ''
      ? undefined
      : Math.max(0, Math.round(Number(unitSellPrice) || 0));
  const totalSpend = qtyNum * costNum;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentProduct) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      await recordStockPurchase(
        currentProduct,
        qtyNum,
        costNum,
        supplierName,
        reason,
        sellNum
      );
      onSuccess?.(`Saved ${qtyNum} ${currentProduct.unit} bought for ${currentProduct.name}.`);
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to record stock purchase.')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-lg w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between">
          <div>
            <h2 id="purchase-modal-title" className="font-display text-lg font-bold text-zinc-900">
              Record Stock Bought
            </h2>
            <p className="text-xs text-zinc-500">
              Log new inventory purchased from suppliers to sell at the shop.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          {!currentProduct ? (
            <p className="text-sm text-zinc-600">
              Add a product first before recording a stock purchase.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Item Bought
                </label>
                <select
                  value={currentProduct.id}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) — On hand: {p.stockQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Units Bought
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Buy Cost / Unit (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Sell Price / Unit (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unitSellPrice}
                    onChange={(e) => setUnitSellPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Supplier / Wholesaler (Optional)
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.SUPPLIER_MAX}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Wholesale Depot"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Batch / Receipt Note
                </label>
                <input
                  type="text"
                  required
                  minLength={FIELD_LIMITS.REASON_MIN}
                  maxLength={FIELD_LIMITS.REASON_MAX}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
                />
              </div>

              <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-md flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-500 block">New Stock Level</span>
                  <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                    {currentProduct.stockQuantity} → {currentProduct.stockQuantity + qtyNum}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 block">Purchase Outlay</span>
                  <span className="font-mono text-sm font-bold text-purple-900 tabular-nums">
                    {formatCurrency(totalSpend)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-purple-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || qtyNum <= 0 || unitCost.trim() === ''}
                  className="px-5 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Record Stock Bought'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

interface QuickSaleModalProps {
  product: Product;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function QuickSaleModal({
  product,
  onClose,
  onSuccess,
}: QuickSaleModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState(
    product.price > 0 ? String(product.price) : ''
  );
  const [customerRef, setCustomerRef] = useState('Counter Retail Sale');
  const [reason, setReason] = useState('Direct shop sale');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const qtyNum = Math.max(0, Math.round(Number(quantity) || 0));
  const priceNum = Math.max(0, Math.round(Number(unitPrice) || 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      await recordQuickSale(product, qtyNum, priceNum, customerRef, reason);
      onSuccess?.(`Saved sale of ${qtyNum} ${product.unit} (${product.name}).`);
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to record sale.')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-md w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between">
          <div>
            <h2 id="sale-modal-title" className="font-display text-lg font-bold text-zinc-900">
              Record Shop Sale
            </h2>
            <p className="text-xs text-zinc-500">
              {product.name} · Available: {product.stockQuantity} {product.unit}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Units Sold
              </label>
              <input
                type="number"
                min={1}
                max={Math.max(1, product.stockQuantity)}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Selling Price / Unit (KES)
              </label>
              <input
                type="number"
                min={1}
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Buyer / Counter Reference
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.NAME_MAX}
              value={customerRef}
              onChange={(e) => setCustomerRef(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Note
            </label>
            <input
              type="text"
              required
              minLength={FIELD_LIMITS.REASON_MIN}
              maxLength={FIELD_LIMITS.REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
            />
          </div>

          <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-md flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500 block">Remaining After Sale</span>
              <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                {product.stockQuantity - qtyNum} {product.unit}
              </span>
            </div>
            <div className="text-right">
              <span className="text-zinc-500 block">Sale Revenue</span>
              <span className="font-mono text-sm font-bold text-purple-900 tabular-nums">
                {formatCurrency(qtyNum * priceNum)}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-purple-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                qtyNum <= 0 ||
                qtyNum > product.stockQuantity ||
                priceNum <= 0
              }
              className="px-5 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Recording...' : 'Confirm Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface StockAdjustModalProps {
  product: Product;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function StockAdjustModal({
  product,
  onClose,
  onSuccess,
}: StockAdjustModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('remove');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('Physical shelf count adjustment');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));
  const delta = mode === 'add' ? numericAmount : -numericAmount;
  const projectedStock = product.stockQuantity + delta;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      await adjustProductStock(product, delta, reason);
      onSuccess?.(`Saved ${product.name} stock adjustment (${delta > 0 ? `+${delta}` : delta}).`);
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to adjust stock.')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adj-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-md w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between">
          <div>
            <h2 id="adj-modal-title" className="font-display text-lg font-bold text-zinc-900">
              Audit / Adjust Stock
            </h2>
            <p className="text-xs text-zinc-500">
              {product.name} · Current: {product.stockQuantity} {product.unit}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 bg-purple-50/70 rounded-md">
            <button
              type="button"
              onClick={() => setMode('remove')}
              className={`py-2 text-xs font-medium rounded cursor-pointer ${
                mode === 'remove'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              Remove (- Shrinkage)
            </button>
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`py-2 text-xs font-medium rounded cursor-pointer ${
                mode === 'add'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              Add (+ Found Stock)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Quantity ({product.unit})
              </label>
              <input
                type="number"
                min={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
            <div className="p-2.5 bg-purple-50/50 border border-purple-100 rounded-md">
              <span className="block text-[11px] text-zinc-500">New Stock Level</span>
              <span
                className={`font-mono text-base font-semibold tabular-nums ${
                  projectedStock < 0 ? 'text-red-700' : 'text-zinc-900'
                }`}
              >
                {projectedStock}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Adjustment Reason
            </label>
            <input
              type="text"
              required
              minLength={FIELD_LIMITS.REASON_MIN}
              maxLength={FIELD_LIMITS.REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
            />
          </div>

          <div className="pt-3 border-t border-purple-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || projectedStock < 0 || numericAmount <= 0}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProductFormModalProps {
  existingProduct: Product | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function ProductFormModal({
  existingProduct,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const [sku, setSku] = useState(existingProduct?.sku || '');
  const [name, setName] = useState(existingProduct?.name || '');
  const [category, setCategory] = useState<ProductCategory>(
    existingProduct?.category || ProductCategory.SUGAR
  );
  const [unit, setUnit] = useState(existingProduct?.unit || 'packet');
  const [costPrice, setCostPrice] = useState(
    existingProduct ? String(existingProduct.costPrice) : '0'
  );
  const [price, setPrice] = useState(
    existingProduct ? String(existingProduct.price) : '0'
  );
  const [stockQuantity, setStockQuantity] = useState(
    existingProduct ? String(existingProduct.stockQuantity) : '0'
  );
  const [reorderLevel, setReorderLevel] = useState(
    existingProduct ? String(existingProduct.reorderLevel) : '5'
  );
  const [supplierName, setSupplierName] = useState(
    existingProduct?.supplierName || ''
  );
  const [imageKey, setImageKey] = useState(
    existingProduct?.imageKey || IMAGE_OPTIONS[0].key
  );
  const [description, setDescription] = useState(
    existingProduct?.description || ''
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);

    const payload: ProductFormPayload = {
      sku,
      name,
      category,
      unit,
      costPrice: Number(costPrice),
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      reorderLevel: Number(reorderLevel),
      supplierName,
      imageKey,
      description,
      isActive: true,
    };

    try {
      if (existingProduct) {
        await updateProduct(existingProduct, payload);
        onSuccess?.(`Saved changes to ${name} in database.`);
      } else {
        await createProduct(payload);
        onSuccess?.(`Saved new item ${name} to database.`);
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to save product.')
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingProduct) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteProduct(existingProduct.id);
      onSuccess?.(`Removed ${existingProduct.name} from inventory.`);
      onClose();
    } catch (err) {
      setErrorMsg(
        formatDatabaseError(err, 'Unable to delete product.')
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prod-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white border border-purple-100 rounded-lg max-w-xl w-full shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-purple-100 bg-purple-50/40 flex items-center justify-between">
          <h2 id="prod-modal-title" className="font-display text-lg font-bold text-zinc-900">
            {existingProduct ? `Edit ${existingProduct.name}` : 'Add New Stock Item'}
          </h2>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Item Name
              </label>
              <input
                type="text"
                required
                minLength={FIELD_LIMITS.NAME_MIN}
                maxLength={FIELD_LIMITS.NAME_MAX}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. White Cane Sugar"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                SKU Code
              </label>
              <input
                type="text"
                required
                disabled={Boolean(existingProduct)}
                maxLength={FIELD_LIMITS.SKU_MAX}
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. SGR-WHT-2KG"
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md disabled:bg-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Unit Size
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.UNIT_MAX}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. 2 kg bag"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Buy Cost (KES)
              </label>
              <input
                type="number"
                min={0}
                required
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Sell Price (KES)
              </label>
              <input
                type="number"
                min={0}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {existingProduct ? 'On Hand' : 'Units Bought'}
              </label>
              <input
                type="number"
                min={0}
                required
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Reorder Alert
              </label>
              <input
                type="number"
                min={0}
                required
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Primary Supplier
              </label>
              <input
                type="text"
                maxLength={FIELD_LIMITS.SUPPLIER_MAX}
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Mumias Wholesale"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Photo Preset
              </label>
              <select
                value={imageKey}
                onChange={(e) => setImageKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md bg-white"
              >
                {IMAGE_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md"
            />
          </div>

          <div className="pt-4 border-t border-purple-100 flex items-center justify-between gap-3">
            {existingProduct ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete()}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md cursor-pointer ${
                    confirmDelete
                      ? 'text-white bg-red-700 hover:bg-red-800'
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmDelete ? 'Confirm Delete' : 'Delete Item'}</span>
                </button>
                {confirmDelete && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                  >
                    Keep
                  </button>
                )}
              </div>
            ) : (
              <span />
            )}

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
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
