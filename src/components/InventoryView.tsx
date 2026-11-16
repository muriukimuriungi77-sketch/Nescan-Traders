import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Edit3,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import { ProductImage } from '@/src/components/ProductImage';
import {
  ProductFormModal,
  QuickSaleModal,
  StockAdjustModal,
} from '@/src/components/StockActionModals';
import { formatCurrency, getStockStatus } from '@/src/lib/format';
import {
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
  ThresholdPreset,
} from '@/src/types/shop';

interface InventoryViewProps {
  products: Product[];
  loading: boolean;
  isCatalogSeeded: boolean;
  seeding: boolean;
  thresholdPreset: ThresholdPreset;
  customThreshold: number;
  onSaveThreshold: (preset: ThresholdPreset, customThreshold: number) => void;
  onSeedCatalog: () => Promise<void>;
  onOpenPurchaseForProduct: (product: Product) => void;
  onNavigateVelocity: () => void;
  onToast: (msg: string) => void;
}

export function InventoryView({
  products,
  loading,
  isCatalogSeeded,
  seeding,
  thresholdPreset,
  customThreshold,
  onSaveThreshold,
  onSeedCatalog,
  onOpenPurchaseForProduct,
  onNavigateVelocity,
  onToast,
}: InventoryViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState(String(customThreshold));

  useEffect(() => {
    setCustomInput(String(customThreshold));
  }, [customThreshold]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const activeThresholdOverride = useMemo(() => {
    if (thresholdPreset === 'item') return null;
    if (thresholdPreset === 'custom') {
      const parsed = Math.min(
        10000,
        Math.max(1, Math.round(Number(customInput) || customThreshold || 1))
      );
      return parsed;
    }
    return Number(thresholdPreset);
  }, [thresholdPreset, customInput, customThreshold]);

  const metrics = useMemo(() => {
    const totalInvested = products.reduce(
      (sum, p) => sum + p.totalBought * p.costPrice,
      0
    );
    const currentCostValue = products.reduce(
      (sum, p) => sum + p.stockQuantity * p.costPrice,
      0
    );
    const currentRetailValue = products.reduce(
      (sum, p) => sum + p.stockQuantity * p.price,
      0
    );
    const totalBoughtUnits = products.reduce((sum, p) => sum + p.totalBought, 0);
    const totalSoldUnits = products.reduce((sum, p) => sum + p.totalSold, 0);
    const alertCount = products.filter(
      (p) =>
        getStockStatus(
          p.stockQuantity,
          p.reorderLevel,
          p.totalBought,
          activeThresholdOverride
        ).isFlagged
    ).length;

    return {
      totalInvested,
      currentCostValue,
      currentRetailValue,
      totalBoughtUnits,
      totalSoldUnits,
      alertCount,
    };
  }, [products, activeThresholdOverride]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryFilter === 'all' || p.category === categoryFilter;
      const status = getStockStatus(
        p.stockQuantity,
        p.reorderLevel,
        p.totalBought,
        activeThresholdOverride
      );
      const lowOk = !lowStockOnly || status.isFlagged;
      const qOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q);
      return catOk && lowOk && qOk;
    });
  }, [products, categoryFilter, lowStockOnly, searchQuery, activeThresholdOverride]);

  return (
    <div className="py-8 space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <p className="text-xs font-semibold text-purple-700 tracking-wide">
            Nescan Traders · Purchased Stock & Resale Margin
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900 [text-wrap:balance]">
            Shop Inventory Bought to Sell
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isCatalogSeeded && !loading && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void onSeedCatalog()}
              className="px-4 py-2 min-h-[40px] text-xs font-medium text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              {seeding ? 'Loading Shop Items...' : 'Load Shop Item List (25 Items)'}
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateVelocity}
            className="px-4 py-2 min-h-[40px] text-sm font-medium text-purple-900 bg-white border border-purple-200 hover:bg-purple-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            View Movement Speed
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* 4-Column Inventory KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-purple-100 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-purple-100">
        <div className="p-5">
          <p className="text-xs text-zinc-500">Total Bought (Cost Value)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(metrics.totalInvested)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            {metrics.totalBoughtUnits.toLocaleString()} cumulative units bought
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">On-Hand Resale Value</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-purple-800 tabular-nums">
            {formatCurrency(metrics.currentRetailValue)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            Cost basis {formatCurrency(metrics.currentCostValue)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500">Total Units Sold</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {metrics.totalSoldUnits.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            Across {products.length} active SKUs
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Reorder Alerts</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              metrics.alertCount > 0 ? 'text-amber-700' : 'text-purple-700'
            }`}
          >
            {metrics.alertCount}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {activeThresholdOverride !== null
              ? `Items below ${activeThresholdOverride} units`
              : 'Items at or below threshold'}
          </p>
        </div>
      </div>

      {/* Category Tabs & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter inventory by category"
          className="flex items-center gap-1 p-1 bg-purple-50/70 rounded-md overflow-x-auto w-fit max-w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={categoryFilter === 'all'}
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-white text-purple-900 shadow-sm'
                : 'text-zinc-600 hover:text-purple-900'
            }`}
          >
            All Items
          </button>
          {PRODUCT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === c
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item, SKU, supplier..."
              className="pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md w-56"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="threshold-select"
              className="text-xs font-medium text-zinc-500 whitespace-nowrap"
            >
              Flag below:
            </label>
            <select
              id="threshold-select"
              value={thresholdPreset}
              onChange={(e) => {
                const nextPreset = e.target.value as ThresholdPreset;
                const parsedCustom = Math.min(
                  10000,
                  Math.max(1, Math.round(Number(customInput) || customThreshold || 10))
                );
                onSaveThreshold(nextPreset, parsedCustom);
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-zinc-200 rounded-md cursor-pointer"
            >
              <option value="item">Item Threshold</option>
              <option value="5">5 units</option>
              <option value="10">10 units</option>
              <option value="15">15 units</option>
              <option value="25">25 units</option>
              <option value="custom">Custom...</option>
            </select>
            {thresholdPreset === 'custom' && (
              <input
                type="number"
                min={1}
                max={10000}
                aria-label="Custom low stock threshold"
                value={customInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomInput(val);
                  const numeric = Number(val);
                  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 10000) {
                    onSaveThreshold('custom', Math.round(numeric));
                  }
                }}
                onBlur={() => {
                  const clamped = Math.min(
                    10000,
                    Math.max(1, Math.round(Number(customInput) || 1))
                  );
                  setCustomInput(String(clamped));
                  onSaveThreshold('custom', clamped);
                }}
                className="w-16 px-2 py-1.5 text-xs font-mono bg-white border border-purple-300 rounded-md tabular-nums"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setLowStockOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              lowStockOnly
                ? 'border-amber-700 bg-amber-50 text-amber-800'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-purple-300'
            }`}
          >
            {metrics.alertCount > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            )}
            <span>Flagged Only ({metrics.alertCount})</span>
          </button>
        </div>
      </div>

      {/* Master Bought-Inventory Table */}
      {loading ? (
        <div className="bg-white border border-purple-100 rounded-lg p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-purple-50/50 rounded animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-purple-100 rounded-lg p-12 text-center">
          <p className="text-base font-semibold text-zinc-900">
            No matching inventory items
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Adjust your filter or add a new item bought for resale.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-purple-100 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-100 bg-purple-50/60 text-xs text-zinc-600">
                <th className="px-4 py-3 text-left font-medium">Item & Supplier</th>
                <th className="px-4 py-3 text-right font-medium">Buy Cost</th>
                <th className="px-4 py-3 text-right font-medium">Sell Price</th>
                <th className="px-4 py-3 text-right font-medium">Bought</th>
                <th className="px-4 py-3 text-right font-medium">Sold</th>
                <th className="px-4 py-3 text-right font-medium">On Hand</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Stock Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map((product) => {
                const status = getStockStatus(
                  product.stockQuantity,
                  product.reorderLevel,
                  product.totalBought,
                  activeThresholdOverride
                );
                const hasMargin = product.price > 0 && product.costPrice > 0;
                const unitMargin = product.price - product.costPrice;
                const marginPct =
                  product.price > 0
                    ? Math.round((unitMargin / product.price) * 100)
                    : 0;
                const rowTone = status.isOut
                  ? 'bg-red-50/35 hover:bg-red-50/60'
                  : status.isLow
                    ? 'bg-amber-50/40 hover:bg-amber-50/70'
                    : 'hover:bg-purple-50/30';
                const barTone = status.isOut
                  ? 'bg-red-600'
                  : status.isLow
                    ? 'bg-amber-600'
                    : 'bg-purple-700';

                return (
                  <tr key={product.id} className={rowTone}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded overflow-hidden bg-purple-50 border border-purple-100 shrink-0">
                          <ProductImage
                            src={product.imageKey}
                            alt={product.name}
                            category={product.category}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900 truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {product.category} <span aria-hidden="true">·</span>{' '}
                            <span className="font-mono">{product.sku}</span>{' '}
                            <span aria-hidden="true">·</span> {product.unit}
                          </div>
                          {product.supplierName && (
                            <div className="text-[11px] text-zinc-400 truncate">
                              Supplier: {product.supplierName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                      {formatCurrency(product.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-mono font-medium tabular-nums text-zinc-900">
                        {formatCurrency(product.price)}
                      </div>
                      {hasMargin && (
                        <div className="text-[11px] font-mono text-purple-700 tabular-nums">
                          {unitMargin >= 0 ? `+${formatCurrency(unitMargin)}` : formatCurrency(unitMargin)} ({marginPct}%)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {product.totalBought}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                      {product.totalSold}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div
                        className={`font-mono font-semibold tabular-nums ${
                          status.isOut
                            ? 'text-red-700'
                            : status.isLow
                              ? 'text-amber-700'
                              : 'text-zinc-900'
                        }`}
                      >
                        {product.stockQuantity}
                      </div>
                      {status.threshold > 0 && (
                        <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                          min {status.threshold}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        {status.isOut && (
                          <AlertCircle
                            className="w-3.5 h-3.5 text-red-700 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        {status.isLow && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 text-amber-700 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span className={status.toneClass}>{status.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="h-1.5 w-16 bg-purple-100/80 rounded overflow-hidden shrink-0"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full rounded ${barTone}`}
                            style={{ width: `${status.fillPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                          {status.detail}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPurchaseForProduct(product)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-800 bg-purple-50 hover:bg-purple-100 rounded cursor-pointer"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>+ Bought</span>
                        </button>
                        <button
                          type="button"
                          disabled={product.stockQuantity <= 0}
                          onClick={() => setSellingProduct(product)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 disabled:bg-zinc-200 disabled:text-zinc-500 rounded cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Sell</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustingProduct(product)}
                          aria-label={`Adjust stock for ${product.name}`}
                          className="p-1.5 text-zinc-500 hover:text-purple-800 bg-zinc-100 hover:bg-purple-50 rounded cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct(product);
                            setIsProductModalOpen(true);
                          }}
                          aria-label={`Edit ${product.name}`}
                          className="p-1.5 text-zinc-500 hover:text-purple-800 bg-zinc-100 hover:bg-purple-50 rounded cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
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

      {isProductModalOpen && (
        <ProductFormModal
          existingProduct={editingProduct}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSuccess={onToast}
        />
      )}

      {sellingProduct && (
        <QuickSaleModal
          product={sellingProduct}
          onClose={() => setSellingProduct(null)}
          onSuccess={onToast}
        />
      )}

      {adjustingProduct && (
        <StockAdjustModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onSuccess={onToast}
        />
      )}
    </div>
  );
}
