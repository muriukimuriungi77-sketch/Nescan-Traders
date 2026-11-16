import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { formatCurrency, formatTimestamp } from '@/src/lib/format';
import {
  MovementType,
  PRODUCT_CATEGORIES,
  ProductCategory,
  StockMovement,
} from '@/src/types/shop';

interface MovementLogViewProps {
  movements: StockMovement[];
  onOpenRecordPurchase: () => void;
}

export function MovementLogView({
  movements,
  onOpenRecordPurchase,
}: MovementLogViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | MovementType>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totals = useMemo(() => {
    let purchaseSpend = 0;
    let unitsBought = 0;
    let salesRevenue = 0;
    let unitsSold = 0;

    for (const mov of movements) {
      if (mov.type === MovementType.PURCHASE) {
        purchaseSpend += mov.totalValue;
        unitsBought += Math.abs(mov.quantityDelta);
      } else if (mov.type === MovementType.SALE) {
        salesRevenue += mov.totalValue;
        unitsSold += Math.abs(mov.quantityDelta);
      }
    }

    return { purchaseSpend, unitsBought, salesRevenue, unitsSold };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return movements.filter((mov) => {
      const typeOk = typeFilter === 'all' || mov.type === typeFilter;
      const catOk = categoryFilter === 'all' || mov.category === categoryFilter;
      const qOk =
        !q ||
        mov.productName.toLowerCase().includes(q) ||
        mov.counterparty.toLowerCase().includes(q) ||
        mov.reason.toLowerCase().includes(q);
      return typeOk && catOk && qOk;
    });
  }, [movements, typeFilter, categoryFilter, searchQuery]);

  return (
    <div className="py-8 space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <p className="text-xs font-semibold text-purple-700 tracking-wide">
            Nescan Traders · Purchases & Sales Audit Trail
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900">
            Inventory Movement Log
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpenRecordPurchase}
          className="px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
        >
          Record Stock Bought
        </button>
      </div>

      {/* 4-Column Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-purple-100 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-purple-100">
        <div className="p-5">
          <p className="text-xs text-zinc-500">Purchase Outlay</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(totals.purchaseSpend)}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Units Bought</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-purple-800 tabular-nums">
            +{totals.unitsBought.toLocaleString()}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-zinc-500">Recorded Sales Value</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {formatCurrency(totals.salesRevenue)}
          </p>
        </div>
        <div className="p-5 border-l border-purple-100 lg:border-l-0">
          <p className="text-xs text-zinc-500">Units Sold</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {totals.unitsSold.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filter movement log by type"
          className="flex items-center gap-1 p-1 bg-purple-50/70 rounded-md overflow-x-auto w-fit max-w-full"
        >
          {[
            { id: 'all' as const, label: 'All Entries' },
            { id: MovementType.PURCHASE, label: 'Stock Bought' },
            { id: MovementType.SALE, label: 'Sales Outflow' },
            { id: MovementType.ADJUSTMENT, label: 'Adjustments' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={typeFilter === tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-zinc-600 hover:text-purple-900'
              }`}
            >
              {tab.label}
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
              placeholder="Search item, supplier, note..."
              className="pl-9 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md w-56"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as 'all' | ProductCategory)
            }
            aria-label="Filter movement log by category"
            className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md cursor-pointer"
          >
            <option value="all">All Categories</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movements Table */}
      {filteredMovements.length === 0 ? (
        <div className="bg-white border border-purple-100 rounded-lg p-12 text-center">
          <ArrowUpDown className="w-8 h-8 text-purple-300 mx-auto" />
          <p className="mt-2 text-sm font-medium text-zinc-900">
            No matching inventory movements
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Stock bought from suppliers, shop sales, and audit adjustments appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-purple-100 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-100 bg-purple-50/60 text-xs text-zinc-600">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Item</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Qty Change</th>
                <th className="px-4 py-3 text-right font-medium">Stock Level</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-left font-medium">Supplier / Counterparty & Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMovements.map((mov) => {
                const isInflow = mov.quantityDelta > 0;
                const displayTime = mov.occurredAt || mov.createdAt;
                return (
                  <tr key={mov.id} className="hover:bg-purple-50/30">
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap tabular-nums">
                      {formatTimestamp(displayTime)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">
                        {mov.productName}
                      </div>
                      <div className="text-[11px] text-zinc-500">{mov.category}</div>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          mov.type === MovementType.PURCHASE
                            ? 'text-purple-800'
                            : mov.type === MovementType.SALE
                            ? 'text-zinc-800'
                            : 'text-amber-700'
                        }`}
                      >
                        {mov.type === MovementType.PURCHASE
                          ? 'Stock Bought'
                          : mov.type === MovementType.SALE
                          ? 'Sale'
                          : 'Adjustment'}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        isInflow ? 'text-purple-700' : 'text-red-700'
                      }`}
                    >
                      {isInflow ? `+${mov.quantityDelta}` : mov.quantityDelta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 tabular-nums whitespace-nowrap">
                      {mov.previousStock} → {mov.newStock}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium text-zinc-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(mov.totalValue)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      <span className="font-medium text-zinc-800">
                        {mov.counterparty}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{mov.reason}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
