import { PackagePlus } from 'lucide-react';
import { ActiveTab } from '@/src/types/shop';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenRecordPurchase: () => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'margins', label: 'Profit Margin' },
  { id: 'movements', label: 'Movement Log' },
  { id: 'orders', label: 'Order Desk' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onOpenRecordPurchase,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-purple-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('inventory')}
          className="font-display text-xl font-bold tracking-tight text-purple-800 whitespace-nowrap shrink-0 cursor-pointer hover:text-purple-950 transition-colors"
        >
          Nescan Traders
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isActive
                    ? 'text-purple-900'
                    : 'text-zinc-500 hover:text-purple-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-purple-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenRecordPurchase}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" strokeWidth={1.75} />
            <span>Record Purchase</span>
          </button>
        </div>
      </div>

      {/* Mobile compact navigation strip */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-purple-100 px-4 flex items-center justify-between gap-2 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2.5 px-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-purple-700 text-purple-900'
                  : 'border-transparent text-zinc-500 hover:text-purple-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
