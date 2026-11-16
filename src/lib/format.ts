import { Timestamp } from 'firebase/firestore';
import { OrderStatus } from '@/src/types/shop';

export function formatCurrency(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function formatTimestamp(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') {
    return 'Just now';
  }
  const date = ts.toDate();
  return date.toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return 'Pending Review';
    case OrderStatus.CONFIRMED:
      return 'Confirmed';
    case OrderStatus.READY:
      return 'Ready';
    case OrderStatus.COMPLETED:
      return 'Completed';
    case OrderStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

export function getOrderStatusStyle(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return 'text-amber-700';
    case OrderStatus.CONFIRMED:
      return 'text-purple-700';
    case OrderStatus.READY:
      return 'text-purple-800 font-semibold';
    case OrderStatus.COMPLETED:
      return 'text-zinc-700';
    case OrderStatus.CANCELLED:
      return 'text-red-700';
    default:
      return 'text-zinc-600';
  }
}

export function getStockStatus(
  stockQuantity: number,
  reorderLevel: number,
  totalBought = 0,
  thresholdOverride?: number | null
): {
  label: string;
  detail: string;
  toneClass: string;
  isLow: boolean;
  isOut: boolean;
  isFlagged: boolean;
  threshold: number;
  fillPct: number;
} {
  const hasCustomThreshold =
    typeof thresholdOverride === 'number' && thresholdOverride > 0;
  const threshold = hasCustomThreshold ? thresholdOverride : reorderLevel;
  const hasStockHistory = totalBought > 0 || stockQuantity > 0;

  if (!hasCustomThreshold && !hasStockHistory) {
    return {
      label: 'Not stocked yet',
      detail: threshold > 0 ? `Threshold: ${threshold}` : 'No threshold set',
      toneClass: 'text-zinc-500',
      isLow: false,
      isOut: false,
      isFlagged: false,
      threshold,
      fillPct: 0,
    };
  }

  if (stockQuantity <= 0) {
    return {
      label: hasStockHistory ? 'Out of stock' : 'Below threshold',
      detail:
        threshold > 0
          ? hasCustomThreshold
            ? `0 of < ${threshold} min`
            : `0 of ${threshold} min`
          : 'Restock needed',
      toneClass: 'text-red-700 font-semibold',
      isLow: false,
      isOut: true,
      isFlagged: true,
      threshold,
      fillPct: 0,
    };
  }

  const isBelowThreshold = hasCustomThreshold
    ? stockQuantity < threshold
    : reorderLevel > 0 && stockQuantity <= reorderLevel;

  if (isBelowThreshold) {
    const fillPct =
      threshold > 0
        ? Math.max(8, Math.min(100, Math.round((stockQuantity / threshold) * 100)))
        : 20;
    return {
      label: 'Low stock',
      detail: hasCustomThreshold
        ? `${stockQuantity} left (< ${threshold})`
        : `${stockQuantity} left (min ${threshold})`,
      toneClass: 'text-amber-700 font-semibold',
      isLow: true,
      isOut: false,
      isFlagged: true,
      threshold,
      fillPct,
    };
  }

  const fillPct =
    threshold > 0
      ? Math.min(100, Math.round((stockQuantity / (threshold * 2)) * 100))
      : 100;

  return {
    label: 'In stock',
    detail: threshold > 0 ? `${stockQuantity} on hand (min ${threshold})` : `${stockQuantity} on hand`,
    toneClass: 'text-purple-700 font-medium',
    isLow: false,
    isOut: false,
    isFlagged: false,
    threshold,
    fillPct,
  };
}

export type VelocityTier = 'Fast Mover' | 'Steady' | 'Slow Mover' | 'Idle';

export function classifyVelocity(dailyRate: number): {
  tier: VelocityTier;
  toneClass: string;
} {
  if (dailyRate >= 3.5) {
    return { tier: 'Fast Mover', toneClass: 'text-purple-800 font-semibold' };
  }
  if (dailyRate >= 1.2) {
    return { tier: 'Steady', toneClass: 'text-purple-700' };
  }
  if (dailyRate > 0) {
    return { tier: 'Slow Mover', toneClass: 'text-amber-700' };
  }
  return { tier: 'Idle', toneClass: 'text-zinc-500' };
}
