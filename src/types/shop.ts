import { Timestamp } from 'firebase/firestore';

export enum ProductCategory {
  SUGAR = 'Sugar',
  RICE = 'Rice',
  BEANS_PULSES = 'Beans & Pulses',
  FLOUR_BAKERY = 'Flour & Bakery',
  SNACKS_SWEETS = 'Snacks & Sweets',
  HOUSEHOLD_ESSENTIALS = 'Household Essentials',
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  ProductCategory.SUGAR,
  ProductCategory.RICE,
  ProductCategory.BEANS_PULSES,
  ProductCategory.FLOUR_BAKERY,
  ProductCategory.SNACKS_SWEETS,
  ProductCategory.HOUSEHOLD_ESSENTIALS,
];

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum FulfillmentType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
}

export enum PaymentMethod {
  CASH = 'cash',
  MPESA = 'mpesa',
  CREDIT = 'credit',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
}

export enum MovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
}

export type ActiveTab = 'inventory' | 'velocity' | 'margins' | 'movements' | 'orders';

export type ThresholdPreset = 'item' | '5' | '10' | '15' | '25' | 'custom';

export interface ShopSettings {
  id: string;
  thresholdPreset: ThresholdPreset;
  customThreshold: number;
  catalogInitialized: boolean;
  updatedAt?: Timestamp | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  costPrice: number;
  price: number;
  stockQuantity: number;
  totalBought: number;
  totalSold: number;
  reorderLevel: number;
  supplierName: string;
  imageKey: string;
  description: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  type: MovementType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  unitPrice: number;
  totalValue: number;
  counterparty: string;
  reason: string;
  orderId: string;
  occurredAt?: Timestamp | null;
  createdAt?: Timestamp | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  notes: string;
  summaryText: string;
  itemCount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  stockDeducted: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export const FIELD_LIMITS = {
  SKU_MIN: 2,
  SKU_MAX: 32,
  SKU_PATTERN: /^[A-Z0-9-]+$/,
  NAME_MIN: 2,
  NAME_MAX: 100,
  UNIT_MIN: 1,
  UNIT_MAX: 30,
  SUPPLIER_MAX: 100,
  DESC_MAX: 300,
  PHONE_MIN: 5,
  PHONE_MAX: 24,
  ADDRESS_MAX: 200,
  NOTES_MAX: 300,
  SUMMARY_MAX: 300,
  REASON_MIN: 2,
  REASON_MAX: 200,
} as const;
