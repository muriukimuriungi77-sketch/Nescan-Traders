import { useMemo, useState } from 'react';
import { PackagePlus, ShoppingCart } from 'lucide-react';
import { QuickSaleModal } from '@/src/components/StockActionModals';
import { classifyVelocity, formatCurrency } from '@/src/lib/format';
import {
  MovementType,
  PRODUCT_CATEGORIES,
  Product,
  ProductCategory,
  StockMovement,
} from '@/src/types/shop';

interface VelocityViewProps {
  products: Product[];
  movements: StockMovement[];
  onOpenPurchaseForProduct: (product: Product) => void;
  onToast: (msg: string) => void;
}

type VelocityWindow = 7 | 14 | 30;

interface ProductVelocityRow {
  product: Product;
  unitsSoldInWindow: number;
  unitsBoughtInWindow: number;
  revenueInWindow: number;
  dailyRate: number;
  sellThroughPct: number;
  daysCover: number | null;
  tier: ReturnType<typeof classifyVelocity>['tier'];
  toneClass: string;
}

export function VelocityView({
  products,
  movements,
  onOpenPurchaseForProduct,
  onToast,
}: VelocityViewProps) {
  const [windowDays, setWindowDays] = useState<VelocityWindow>(7);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);

  const velocityRows: ProductVelocityRow[] = useMemo(() => {
    const now = Date.now();
    const cutoffMs = now - windowDays * 24 * 60 * 60 * 1000;

    const salesByProduct = new Map<string, { units: number; revenue: number }>();
    const buysByProduct = new Map<string, number>();

    for (const mov of movements) {
      const ts = mov.occurredAt || mov.createdAt;
      const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : now;
      if (ms < cutoffMs) continue;

      if (mov.type === MovementType.SALE) {
        const qty = Math.abs(mov.quantityDelta);
        const curr = salesByProduct.get(mov.productId) || { units: 0, revenue: 0 };
        salesByProduct.set(mov.productId, {
          units: curr.units + qty,
          revenue: curr.revenue + mov.totalValue,
        });
      } else if (mov.type === MovementType.PURCHASE) {
        buysByProduct.set(
          mov.productId,
          (buysByProduct.get(mov.productId) || 0) + Math.abs(mov.quantityDelta)
        );
      }
    }

    const rows = products.map((product) => {
      const sales = salesByProduct.get(product.id) || { units: 0, revenue: 0 };
      const buys = buysByProduct.get(product.id) || 0;
      const dailyRate = sales.units / windowDays;
      const sellThroughPct =
        product.totalBought > 0
          ? Math.min(100, Math.round((product.totalSold / product.totalBought) * 100))
          : 0;
      const daysCover =
        dailyRate > 0 ? Math.round((product.stockQuantity / dailyRate) * 10) / 10 : null;
      const { tier, toneClass } = classifyVelocity(dailyRate);

      return {
        product,
        unitsSoldInWindow: sales.units,
        unitsBoughtInWindow: buys,
        revenueInWindow: sales.revenue,
        dailyRate,
        sellThroughPct,
        daysCover,
        tier,
        toneClass,
      };
    });

    rows.sort((a, b) => b.dailyRate - a.dailyRate || b.product.totalSold - a.product.totalSold);
    return rows;
  }, [products, movements, windowDays]);

  const filteredRows = useMemo(() => {
    if (categoryFilter === 'all') return velocityRows;
    return velocityRows.filter((r) => r.product.category === categoryFilter);
  }, [velocityRows, categoryFilter]);

  const summary = useMemo(() => {
    const totalSoldWindow = velocityRows.reduce(
      (sum, r) => sum + r.unitsSoldInWindow,
      0
    );
    const totalDailyRate = totalSoldWindow / windowDays;
    const fastest = velocityRows[0] || null;
    const criticalCoverCount = velocityRows.filter(
      (r) => r.daysCover !== null && r.daysCover <= 7
    ).length;

    return {
      totalSoldWindow,
      totalDailyRate,
      fastest,
      criticalCoverCount,
    };
  }, [velocityRows, windowDays]);

  const categoryBreakdown = useMemo(() => {
    const totals = PRODUCT_CATEGORIES.map((category) => {
      const catRows = velocityRows.filter((r) => r.product.category === category);
      const sold = catRows.reduce((s, r) => s + r.unitsSoldInWindow, 0);
      const bought = catRows.reduce((s, r) => s + r.product.totalBought, 0);
      const onHand = catRows.reduce((s, r) => s + r.product.stockQuantity, 0);
      const dailyRate = sold / windowDays;
      return { category, sold, bought, onHand, dailyRate };
    });

    const maxSold = Math.max(1, ...totals.map((t) => t.sold));
    return totals
      .sort((a, b) => b.sold - a.sold)
      .map((t) => ({
        ...t,
        barPct: Math.round((t.sold / maxSold) * 100),
      }));
  }, [velocityRows, windowDays]);

  return (
    <div className="py-8 space-y-6 pb-16">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <p className="text-xs font-semibold text-purple-700 tracking-wide">
            Nescan Traders · Turnover & Burn Rate
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900 [text-wrap:balance]">
            Inventory Movement Velocity
          </h1>
        </div>

        <div
          role="tablist"
          aria-label="Velocity measurement window"
          className="flex items-center gap-1 p-1 bg-purple-50/70 rounded-md w-fit"
        >
          {([7, 14, 30] as VelocityWindow[]).map((days) => (
            <button
              key={days}
              type="button"
              role="tab"
              aria-selected={windowDays === days}
              onClick={() => setWindowDays(days)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                windowDays === days
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* 4-Column Velocity KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-purple-100 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-purple-100">
        <div className="p-5">
          <p className="text-xs text-zinc-500">Units Moved ({windowDays}d)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {summary.totalSoldWindow.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Total shop outflow
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Shop Movement Pace</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-purple-800 tabular-nums">
            {summary.totalDailyRate.toFixed(1)} / day
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Average units sold daily
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500">Fastest Moving Item</p>
          <p className="mt-1 font-display text-lg font-bold text-zinc-900 truncate">
            {summary.fastest && summary.fastest.unitsSoldInWindow > 0
              ? summary.fastest.product.name
              : 'No sales yet'}
          </p>
          <p className="mt-0.5 text-xs font-mono text-purple-700 tabular-nums">
            {summary.fastest && summary.fastest.unitsSoldInWindow > 0
              ? `${summary.fastest.dailyRate.toFixed(1)} units/day`
              : 'Record sales to track'}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Runway Under 7 Days</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              summary.criticalCoverCount > 0 ? 'text-amber-700' : 'text-purple-700'
            }`}
          >
            {summary.criticalCoverCount}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Items needing restock soon
          </p>
        </div>
      </div>

      {/* Category Speed Comparison */}
      <section className="bg-white border border-purple-100 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-purple-100">
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Movement Speed by Category
            </h2>
            <p className="text-xs text-zinc-500">
              Compares how fast Sugar, Rice, Beans, Flour & Bakery, Snacks, and Household Essentials leave the shelf.
            </p>
          </div>
          <span className="text-xs font-mono text-purple-700 tabular-nums">
            Window: {windowDays} days
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-900">{cat.category}</span>
                <span className="font-mono text-zinc-600 tabular-nums">
                  {cat.sold} sold ({cat.dailyRate.toFixed(1)}/day) · {cat.onHand} on hand
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

      {/* Item Velocity Filter */}
      <div className="flex items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter velocity table by category"
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
            All Categories
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
      </div>

      {/* Item-by-Item Movement Velocity Table */}
      <div className="bg-white border border-purple-100 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-purple-100 bg-purple-50/60 text-xs text-zinc-600">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-right font-medium">Sold ({windowDays}d)</th>
              <th className="px-4 py-3 text-right font-medium">Pace / Day</th>
              <th className="px-4 py-3 text-right font-medium">Sell-Through</th>
              <th className="px-4 py-3 text-right font-medium">On Hand</th>
              <th className="px-4 py-3 text-right font-medium">Days Left</th>
              <th className="px-4 py-3 text-left font-medium">Movement Tier</th>
              <th className="px-4 py-3 text-right font-medium">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredRows.map((row) => {
              const isUrgent = row.daysCover !== null && row.daysCover <= 7;
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
                      <span className="font-mono">{formatCurrency(row.revenueInWindow)}</span> sales
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-zinc-900 whitespace-nowrap">
                    {row.unitsSoldInWindow}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-purple-800 whitespace-nowrap">
                    {row.dailyRate.toFixed(1)} / day
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-700 whitespace-nowrap">
                    {row.sellThroughPct}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-900 whitespace-nowrap">
                    {row.product.stockQuantity}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
                      isUrgent ? 'text-amber-700' : 'text-zinc-700'
                    }`}
                  >
                    {row.daysCover === null ? '—' : `${row.daysCover} d`}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className={row.toneClass}>{row.tier}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenPurchaseForProduct(row.product)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-800 bg-purple-50 hover:bg-purple-100 rounded cursor-pointer"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Restock</span>
                      </button>
                      <button
                        type="button"
                        disabled={row.product.stockQuantity <= 0}
                        onClick={() => setSellingProduct(row.product)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-purple-700 hover:bg-purple-800 disabled:bg-zinc-200 disabled:text-zinc-500 rounded cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Sell</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sellingProduct && (
        <QuickSaleModal
          product={sellingProduct}
          onClose={() => setSellingProduct(null)}
          onSuccess={onToast}
        />
      )}
    </div>
  );
}
