import { useMemo, useState } from 'react';
import { Edit3, PackagePlus, Search } from 'lucide-react';
import { ProductFormModal } from '@/src/components/StockActionModals';
import { formatCurrency } from '@/src/lib/format';
import {
  MovementType,
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
  StockMovement,
} from '@/src/types/shop';

interface ProfitMarginViewProps {
  products: Product[];
  movements: StockMovement[];
  onOpenPurchaseForProduct: (product: Product) => void;
  onToast: (msg: string) => void;
}

type MarginSort = 'marginPct' | 'unitProfit' | 'realizedProfit' | 'projectedProfit';

interface ProductMarginRow {
  product: Product;
  hasBothPrices: boolean;
  unitProfit: number;
  marginPct: number;
  markupPct: number;
  soldUnits: number;
  realizedRevenue: number;
  realizedCost: number;
  realizedProfit: number;
  projectedOnHandProfit: number;
}

export function ProfitMarginView({
  products,
  movements,
  onOpenPurchaseForProduct,
  onToast,
}: ProfitMarginViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<MarginSort>('marginPct');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const marginRows: ProductMarginRow[] = useMemo(() => {
    const realizedByProduct = new Map<
      string,
      { units: number; revenue: number; cost: number }
    >();

    for (const mov of movements) {
      if (mov.type !== MovementType.SALE) continue;
      const qty = Math.abs(mov.quantityDelta);
      const curr = realizedByProduct.get(mov.productId) || {
        units: 0,
        revenue: 0,
        cost: 0,
      };
      const prod = products.find((p) => p.id === mov.productId);
      const effectiveUnitCost =
        mov.unitCost > 0 ? mov.unitCost : prod?.costPrice ?? 0;

      realizedByProduct.set(mov.productId, {
        units: curr.units + qty,
        revenue: curr.revenue + mov.totalValue,
        cost: curr.cost + qty * effectiveUnitCost,
      });
    }

    return products.map((product) => {
      const hasBothPrices = product.costPrice > 0 && product.price > 0;
      const unitProfit = hasBothPrices ? product.price - product.costPrice : 0;
      const marginPct = hasBothPrices
        ? (unitProfit / product.price) * 100
        : 0;
      const markupPct = hasBothPrices
        ? (unitProfit / product.costPrice) * 100
        : 0;

      const realized = realizedByProduct.get(product.id) || {
        units: 0,
        revenue: 0,
        cost: 0,
      };
      const realizedProfit =
        realized.cost > 0 ? realized.revenue - realized.cost : 0;
      const projectedOnHandProfit = hasBothPrices
        ? product.stockQuantity * unitProfit
        : 0;

      return {
        product,
        hasBothPrices,
        unitProfit,
        marginPct,
        markupPct,
        soldUnits: realized.units,
        realizedRevenue: realized.revenue,
        realizedCost: realized.cost,
        realizedProfit,
        projectedOnHandProfit,
      };
    });
  }, [products, movements]);

  const summary = useMemo(() => {
    const realizedRevenue = marginRows.reduce(
      (sum, r) => sum + r.realizedRevenue,
      0
    );
    const realizedCost = marginRows.reduce((sum, r) => sum + r.realizedCost, 0);
    const realizedProfit = marginRows.reduce(
      (sum, r) => sum + r.realizedProfit,
      0
    );
    const avgRealizedMarginPct =
      realizedRevenue > 0 ? (realizedProfit / realizedRevenue) * 100 : 0;
    const projectedOnHandProfit = marginRows.reduce(
      (sum, r) => sum + r.projectedOnHandProfit,
      0
    );

    const pricedRows = marginRows.filter((r) => r.hasBothPrices);
    const avgCatalogMarginPct =
      pricedRows.length > 0
        ? pricedRows.reduce((s, r) => s + r.marginPct, 0) / pricedRows.length
        : 0;

    const topMarginRow =
      [...pricedRows].sort((a, b) => b.marginPct - a.marginPct)[0] || null;

    return {
      realizedRevenue,
      realizedCost,
      realizedProfit,
      avgRealizedMarginPct,
      avgCatalogMarginPct,
      projectedOnHandProfit,
      pricedCount: pricedRows.length,
      topMarginRow,
    };
  }, [marginRows]);

  const categoryMargins = useMemo(() => {
    const stats = PRODUCT_CATEGORIES.map((category) => {
      const rows = marginRows.filter((r) => r.product.category === category);
      const priced = rows.filter((r) => r.hasBothPrices);
      const avgMarginPct =
        priced.length > 0
          ? priced.reduce((s, r) => s + r.marginPct, 0) / priced.length
          : 0;
      const realizedProfit = rows.reduce((s, r) => s + r.realizedProfit, 0);
      const projectedProfit = rows.reduce(
        (s, r) => s + r.projectedOnHandProfit,
        0
      );
      return {
        category,
        pricedCount: priced.length,
        totalCount: rows.length,
        avgMarginPct,
        realizedProfit,
        projectedProfit,
      };
    });

    const maxMargin = Math.max(1, ...stats.map((s) => Math.max(0, s.avgMarginPct)));
    return stats
      .sort((a, b) => b.avgMarginPct - a.avgMarginPct || b.realizedProfit - a.realizedProfit)
      .map((s) => ({
        ...s,
        barPct:
          s.avgMarginPct > 0
            ? Math.min(100, Math.round((s.avgMarginPct / maxMargin) * 100))
            : 0,
      }));
  }, [marginRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = marginRows.filter((r) => {
      const catOk = categoryFilter === 'all' || r.product.category === categoryFilter;
      const qOk =
        !q ||
        r.product.name.toLowerCase().includes(q) ||
        r.product.sku.toLowerCase().includes(q);
      return catOk && qOk;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'unitProfit') {
        return b.unitProfit - a.unitProfit || a.product.name.localeCompare(b.product.name);
      }
      if (sortBy === 'realizedProfit') {
        return b.realizedProfit - a.realizedProfit || b.marginPct - a.marginPct;
      }
      if (sortBy === 'projectedProfit') {
        return b.projectedOnHandProfit - a.projectedOnHandProfit || b.marginPct - a.marginPct;
      }
      return b.marginPct - a.marginPct || b.unitProfit - a.unitProfit || a.product.name.localeCompare(b.product.name);
    });

    return filtered;
  }, [marginRows, categoryFilter, searchQuery, sortBy]);

  return (
    <div className="py-8 space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <p className="text-xs font-semibold text-purple-700 tracking-wide">
            Nescan Traders · Cost vs. Selling Price Analysis
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900 [text-wrap:balance]">
            Profit Margin Breakdown
          </h1>
        </div>
        <div className="text-xs text-zinc-500 font-mono tabular-nums">
          {summary.pricedCount} of {products.length} items with buy & sell prices set
        </div>
      </div>

      {/* 4-Column Margin KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-purple-100 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-purple-100">
        <div className="p-5">
          <p className="text-xs text-zinc-500">Realized Sales Revenue</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(summary.realizedRevenue)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            COGS {formatCurrency(summary.realizedCost)}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Realized Gross Profit</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              summary.realizedProfit < 0 ? 'text-red-700' : 'text-purple-800'
            }`}
          >
            {formatCurrency(summary.realizedProfit)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            Projected on-hand {formatCurrency(summary.projectedOnHandProfit)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500">Average Margin</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {(summary.realizedRevenue > 0
              ? summary.avgRealizedMarginPct
              : summary.avgCatalogMarginPct
            ).toFixed(1)}
            %
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            {summary.realizedRevenue > 0
              ? 'Weighted realized margin'
              : 'Across priced shop items'}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Highest Margin Item</p>
          <p className="mt-1 font-display text-lg font-bold text-zinc-900 truncate">
            {summary.topMarginRow
              ? summary.topMarginRow.product.name
              : 'No priced items yet'}
          </p>
          <p className="mt-0.5 text-xs font-mono text-purple-700 tabular-nums">
            {summary.topMarginRow
              ? `${summary.topMarginRow.marginPct.toFixed(1)}% (+${formatCurrency(summary.topMarginRow.unitProfit)}/unit)`
              : 'Set buy & sell prices'}
          </p>
        </div>
      </div>

      {/* Category Margin Comparison */}
      <section className="bg-white border border-purple-100 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-purple-100">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Average Margin by Category
            </h2>
            <p className="text-xs text-zinc-500">
              Calculates automatically as you enter buying costs and selling prices for shop stock.
            </p>
          </div>
          <span className="text-xs font-mono text-purple-700 tabular-nums">
            Margin = (Sell − Buy) / Sell
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {categoryMargins.map((cat) => (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-900">
                  {cat.category}{' '}
                  <span className="text-zinc-400 font-normal tabular-nums">
                    ({cat.pricedCount}/{cat.totalCount} priced)
                  </span>
                </span>
                <span className="font-mono text-zinc-600 tabular-nums">
                  {cat.avgMarginPct.toFixed(1)}% avg · Realized{' '}
                  {formatCurrency(cat.realizedProfit)} · On-hand{' '}
                  {formatCurrency(cat.projectedProfit)}
                </span>
              </div>
              <div className="h-2.5 w-full bg-purple-50 rounded overflow-hidden">
                <div
                  className="h-full bg-purple-700 rounded transition-all duration-200"
                  style={{ width: `${cat.barPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter profit margins by category"
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
              placeholder="Search item or SKU..."
              className="pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md w-52"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MarginSort)}
            aria-label="Sort profit margin table"
            className="px-3 py-1.5 text-xs font-medium bg-white border border-zinc-200 rounded-md cursor-pointer"
          >
            <option value="marginPct">Sort: Highest Margin %</option>
            <option value="unitProfit">Sort: Highest Profit / Unit</option>
            <option value="realizedProfit">Sort: Realized Profit</option>
            <option value="projectedProfit">Sort: Projected On-Hand Profit</option>
          </select>
        </div>
      </div>

      {/* Item Margin Table */}
      <div className="bg-white border border-purple-100 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-purple-100 bg-purple-50/60 text-xs text-zinc-600">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-right font-medium">Buy Cost</th>
              <th className="px-4 py-3 text-right font-medium">Sell Price</th>
              <th className="px-4 py-3 text-right font-medium">Profit / Unit</th>
              <th className="px-4 py-3 text-right font-medium">Margin %</th>
              <th className="px-4 py-3 text-right font-medium">Realized Profit</th>
              <th className="px-4 py-3 text-right font-medium">On-Hand Profit</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredRows.map((row) => {
              const isLoss = row.hasBothPrices && row.unitProfit < 0;
              return (
                <tr key={row.product.id} className="hover:bg-purple-50/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">
                      {row.product.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {row.product.category} <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono">{row.product.unit}</span>{' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono tabular-nums">
                        {row.product.stockQuantity} on hand
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-600 whitespace-nowrap">
                    {formatCurrency(row.product.costPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium tabular-nums text-zinc-900 whitespace-nowrap">
                    {formatCurrency(row.product.price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                      !row.hasBothPrices
                        ? 'text-zinc-400 font-normal'
                        : isLoss
                          ? 'text-red-700'
                          : 'text-purple-800'
                    }`}
                  >
                    {!row.hasBothPrices
                      ? '—'
                      : row.unitProfit >= 0
                        ? `+${formatCurrency(row.unitProfit)}`
                        : formatCurrency(row.unitProfit)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {row.hasBothPrices ? (
                      <div>
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            isLoss ? 'text-red-700' : 'text-zinc-900'
                          }`}
                        >
                          {row.marginPct.toFixed(1)}%
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                          {row.markupPct.toFixed(0)}% markup
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {row.product.price > 0 ? 'Set buy cost' : 'Unpriced'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900 whitespace-nowrap">
                    {formatCurrency(row.realizedProfit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                    {formatCurrency(row.projectedOnHandProfit)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenPurchaseForProduct(row.product)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-800 bg-purple-50 hover:bg-purple-100 rounded cursor-pointer"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>+ Bought</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(row.product)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-purple-50 hover:text-purple-900 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Prices</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingProduct && (
        <ProductFormModal
          existingProduct={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={onToast}
        />
      )}
    </div>
  );
}
