import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ASSET_IMAGES,
  LEGACY_DEMO_PRODUCT_IDS,
  SEED_MOVEMENTS,
  STARTER_CATALOG,
} from '@/src/data/catalogSeed';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import {
  CartItem,
  FIELD_LIMITS,
  FulfillmentType,
  MovementType,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  StockMovement,
  ThresholdPreset,
} from '@/src/types/shop';

function sanitizeText(value: string, maxLen: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function sanitizeImageKey(value: string): string {
  const clean = sanitizeText(value, 120);
  if (/^\/src\/assets\/images\/[a-zA-Z0-9_.-]+$/.test(clean)) {
    return clean;
  }
  return ASSET_IMAGES.hero;
}

export function sanitizeSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, FIELD_LIMITS.SKU_MAX);
}

export function normalizeProduct(raw: Product): Product {
  const rawCategory = raw.category as string;
  const category =
    rawCategory === 'Yellow Beans' || rawCategory === 'Special Beans'
      ? ProductCategory.BEANS_PULSES
      : raw.category;
  const costPrice =
    typeof raw.costPrice === 'number' && raw.costPrice >= 0 ? raw.costPrice : 0;
  const price =
    typeof raw.price === 'number' && raw.price >= 0 ? raw.price : 0;
  const totalBought =
    typeof raw.totalBought === 'number' && raw.totalBought >= 0
      ? raw.totalBought
      : raw.stockQuantity;
  const totalSold =
    typeof raw.totalSold === 'number' && raw.totalSold >= 0 ? raw.totalSold : 0;
  return {
    ...raw,
    category,
    costPrice,
    price,
    totalBought,
    totalSold,
    supplierName: raw.supplierName || '',
  };
}

export function normalizeMovement(
  raw: Omit<StockMovement, 'type'> & { type: string },
  productLookup?: Map<string, Product>
): StockMovement {
  const prod = productLookup?.get(raw.productId);
  const mappedType: MovementType =
    raw.type === 'restock'
      ? MovementType.PURCHASE
      : raw.type === MovementType.PURCHASE ||
          raw.type === MovementType.SALE ||
          raw.type === MovementType.ADJUSTMENT
        ? raw.type
        : MovementType.ADJUSTMENT;

  const qtyAbs = Math.abs(typeof raw.quantityDelta === 'number' ? raw.quantityDelta : 0);
  const unitCost =
    typeof raw.unitCost === 'number' ? raw.unitCost : prod?.costPrice ?? 0;
  const unitPrice =
    typeof raw.unitPrice === 'number' ? raw.unitPrice : prod?.price ?? 0;
  const fallbackValue =
    mappedType === MovementType.SALE ? qtyAbs * unitPrice : qtyAbs * unitCost;

  return {
    ...raw,
    type: mappedType,
    category: raw.category ?? prod?.category ?? ProductCategory.HOUSEHOLD_ESSENTIALS,
    unitCost,
    unitPrice,
    totalValue: typeof raw.totalValue === 'number' ? raw.totalValue : fallbackValue,
    counterparty:
      raw.counterparty ||
      (mappedType === MovementType.PURCHASE
        ? prod?.supplierName || 'Wholesale Supplier'
        : 'Shop Counter'),
    reason: raw.reason || 'Inventory movement',
    orderId: raw.orderId || '',
  };
}

export interface SaveShopSettingsPayload {
  thresholdPreset: ThresholdPreset;
  customThreshold: number;
  catalogInitialized: boolean;
}

export async function saveShopSettings(
  payload: SaveShopSettingsPayload
): Promise<void> {
  const cleanCustom = Math.min(
    10000,
    Math.max(1, Math.round(payload.customThreshold || 10))
  );
  try {
    await setDoc(doc(db, 'shopSettings', 'default'), {
      thresholdPreset: payload.thresholdPreset,
      customThreshold: cleanCustom,
      catalogInitialized: payload.catalogInitialized,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'shopSettings/default');
  }
}

export async function seedStarterInventory(
  legacyIdsToRemove: string[] = [],
  existingThreshold?: { thresholdPreset: ThresholdPreset; customThreshold: number }
): Promise<void> {
  const batch = writeBatch(db);
  const prodLookup = new Map<string, (typeof STARTER_CATALOG)[number]>();

  for (const legacyId of legacyIdsToRemove) {
    if (LEGACY_DEMO_PRODUCT_IDS.has(legacyId)) {
      batch.delete(doc(db, 'products', legacyId));
    }
  }

  for (const item of STARTER_CATALOG) {
    prodLookup.set(item.id, item);
    const productRef = doc(db, 'products', item.id);
    batch.set(productRef, {
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      costPrice: item.costPrice,
      price: item.price,
      stockQuantity: item.stockQuantity,
      totalBought: item.totalBought,
      totalSold: item.totalSold,
      reorderLevel: item.reorderLevel,
      supplierName: item.supplierName,
      imageKey: item.imageKey,
      description: item.description,
      isActive: item.isActive,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const nowMs = Date.now();
  for (const mov of SEED_MOVEMENTS) {
    const item = prodLookup.get(mov.productId);
    if (!item) continue;
    const occurredDate = new Date(nowMs - mov.daysAgo * 24 * 60 * 60 * 1000);
    const qtyAbs = Math.abs(mov.quantityDelta);
    const unitPriceUsed =
      mov.type === MovementType.PURCHASE ? item.costPrice : item.price;

    batch.set(doc(db, 'stockMovements', mov.id), {
      productId: item.id,
      productName: item.name,
      category: item.category,
      type: mov.type,
      quantityDelta: mov.quantityDelta,
      previousStock: mov.previousStock,
      newStock: mov.newStock,
      unitCost: item.costPrice,
      unitPrice: item.price,
      totalValue: qtyAbs * unitPriceUsed,
      counterparty: mov.counterparty,
      reason: mov.reason,
      orderId: '',
      occurredAt: Timestamp.fromDate(occurredDate),
      createdAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'shopSettings', 'default'), {
    thresholdPreset: existingThreshold?.thresholdPreset || 'item',
    customThreshold: Math.min(
      10000,
      Math.max(1, Math.round(existingThreshold?.customThreshold || 10))
    ),
    catalogInitialized: true,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}

export interface ProductFormPayload {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  costPrice: number;
  price: number;
  stockQuantity: number;
  reorderLevel: number;
  supplierName: string;
  imageKey: string;
  description: string;
  isActive: boolean;
}

export async function createProduct(payload: ProductFormPayload): Promise<string> {
  const cleanSku = sanitizeSku(payload.sku);
  if (
    cleanSku.length < FIELD_LIMITS.SKU_MIN ||
    !FIELD_LIMITS.SKU_PATTERN.test(cleanSku)
  ) {
    throw new Error('SKU must be 2–32 characters using letters, numbers, or hyphens.');
  }
  const cleanName = sanitizeText(payload.name, FIELD_LIMITS.NAME_MAX);
  if (cleanName.length < FIELD_LIMITS.NAME_MIN) {
    throw new Error('Product name must be at least 2 characters.');
  }

  const productId = cleanSku.toLowerCase();
  const productRef = doc(db, 'products', productId);

  try {
    const existingSnap = await getDoc(productRef);
    if (existingSnap.exists()) {
      throw new Error(
        `An item with SKU "${cleanSku}" already exists. Edit that item instead or choose another SKU.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err;
    }
  }

  const initialQty = Math.min(1000000, Math.max(0, Math.round(payload.stockQuantity || 0)));
  const cleanCost = Math.min(10000000, Math.max(0, Math.round(payload.costPrice || 0)));
  const cleanPrice = Math.min(10000000, Math.max(0, Math.round(payload.price || 0)));
  const cleanSupplier = sanitizeText(
    payload.supplierName,
    FIELD_LIMITS.SUPPLIER_MAX
  );

  const batch = writeBatch(db);
  batch.set(productRef, {
    sku: cleanSku,
    name: cleanName,
    category: payload.category,
    unit: sanitizeText(payload.unit, FIELD_LIMITS.UNIT_MAX) || '1 unit',
    costPrice: cleanCost,
    price: cleanPrice,
    stockQuantity: initialQty,
    totalBought: initialQty,
    totalSold: 0,
    reorderLevel: Math.min(100000, Math.max(0, Math.round(payload.reorderLevel || 0))),
    supplierName: cleanSupplier,
    imageKey: sanitizeImageKey(payload.imageKey),
    description: sanitizeText(payload.description, FIELD_LIMITS.DESC_MAX),
    isActive: payload.isActive,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (initialQty > 0) {
    const movRef = doc(collection(db, 'stockMovements'));
    batch.set(movRef, {
      productId,
      productName: cleanName,
      category: payload.category,
      type: MovementType.PURCHASE,
      quantityDelta: initialQty,
      previousStock: 0,
      newStock: initialQty,
      unitCost: cleanCost,
      unitPrice: cleanPrice,
      totalValue: initialQty * cleanCost,
      counterparty: cleanSupplier,
      reason: 'Initial stock bought for shop',
      orderId: '',
      occurredAt: Timestamp.now(),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return productId;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, `products/${productId}`);
  }
}

export async function updateProduct(
  existingProduct: Product,
  payload: ProductFormPayload
): Promise<void> {
  const cleanSku = sanitizeSku(payload.sku);
  if (
    cleanSku.length < FIELD_LIMITS.SKU_MIN ||
    !FIELD_LIMITS.SKU_PATTERN.test(cleanSku)
  ) {
    throw new Error('SKU must be 2–32 characters using letters, numbers, or hyphens.');
  }
  const cleanName = sanitizeText(payload.name, FIELD_LIMITS.NAME_MAX);
  if (cleanName.length < FIELD_LIMITS.NAME_MIN) {
    throw new Error('Product name must be at least 2 characters.');
  }

  const norm = normalizeProduct(existingProduct);
  const productRef = doc(db, 'products', existingProduct.id);
  const cleanCost = Math.min(10000000, Math.max(0, Math.round(payload.costPrice || 0)));
  const cleanPrice = Math.min(10000000, Math.max(0, Math.round(payload.price || 0)));
  const nextStock = Math.min(1000000, Math.max(0, Math.round(payload.stockQuantity || 0)));
  const cleanReorder = Math.min(100000, Math.max(0, Math.round(payload.reorderLevel || 0)));
  const stockDelta = nextStock - norm.stockQuantity;

  const batch = writeBatch(db);
  batch.update(productRef, {
    name: cleanName,
    category: payload.category,
    unit: sanitizeText(payload.unit, FIELD_LIMITS.UNIT_MAX) || '1 unit',
    costPrice: cleanCost,
    price: cleanPrice,
    stockQuantity: nextStock,
    reorderLevel: cleanReorder,
    supplierName: sanitizeText(
      payload.supplierName,
      FIELD_LIMITS.SUPPLIER_MAX
    ),
    imageKey: sanitizeImageKey(payload.imageKey),
    description: sanitizeText(payload.description, FIELD_LIMITS.DESC_MAX),
    isActive: payload.isActive,
    updatedAt: serverTimestamp(),
  });

  if (stockDelta !== 0) {
    const movRef = doc(collection(db, 'stockMovements'));
    batch.set(movRef, {
      productId: existingProduct.id,
      productName: cleanName,
      category: payload.category,
      type: MovementType.ADJUSTMENT,
      quantityDelta: stockDelta,
      previousStock: norm.stockQuantity,
      newStock: nextStock,
      unitCost: cleanCost,
      unitPrice: cleanPrice,
      totalValue: Math.abs(stockDelta) * cleanCost,
      counterparty: 'Catalog Edit',
      reason: 'On-hand stock count updated',
      orderId: '',
      occurredAt: Timestamp.now(),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${existingProduct.id}`);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

export async function recordStockPurchase(
  rawProduct: Product,
  quantityBought: number,
  unitCost: number,
  supplierName: string,
  reason: string,
  unitSellPrice?: number
): Promise<void> {
  const product = normalizeProduct(rawProduct);
  const qty = Math.round(quantityBought);
  const cost = Math.min(10000000, Math.max(0, Math.round(unitCost)));
  const nextSellPrice =
    typeof unitSellPrice === 'number' && unitSellPrice >= 0
      ? Math.min(10000000, Math.round(unitSellPrice))
      : product.price;
  if (qty <= 0 || qty > 100000) {
    throw new Error('Purchase quantity must be between 1 and 100,000.');
  }

  const cleanSupplier =
    sanitizeText(supplierName, FIELD_LIMITS.SUPPLIER_MAX) ||
    product.supplierName ||
    'Wholesale Supplier';
  const cleanReason =
    sanitizeText(reason, FIELD_LIMITS.REASON_MAX) || 'Stock purchase intake';
  const nextStock = product.stockQuantity + qty;

  const batch = writeBatch(db);
  batch.update(doc(db, 'products', product.id), {
    costPrice: cost,
    price: nextSellPrice,
    stockQuantity: nextStock,
    totalBought: product.totalBought + qty,
    supplierName: cleanSupplier,
    updatedAt: serverTimestamp(),
  });

  const movRef = doc(collection(db, 'stockMovements'));
  batch.set(movRef, {
    productId: product.id,
    productName: product.name,
    category: product.category,
    type: MovementType.PURCHASE,
    quantityDelta: qty,
    previousStock: product.stockQuantity,
    newStock: nextStock,
    unitCost: cost,
    unitPrice: nextSellPrice,
    totalValue: qty * cost,
    counterparty: cleanSupplier,
    reason: cleanReason,
    orderId: '',
    occurredAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
  }
}

export async function recordQuickSale(
  rawProduct: Product,
  quantitySold: number,
  unitPrice: number,
  customerRef: string,
  reason: string
): Promise<void> {
  const product = normalizeProduct(rawProduct);
  const qty = Math.round(quantitySold);
  const sellPrice = Math.min(10000000, Math.max(1, Math.round(unitPrice)));
  if (qty <= 0 || qty > 100000) {
    throw new Error('Quantity sold must be between 1 and 100,000.');
  }
  if (qty > product.stockQuantity) {
    throw new Error(
      `Only ${product.stockQuantity} ${product.unit} available in stock.`
    );
  }

  const nextStock = product.stockQuantity - qty;
  const cleanCounterparty =
    sanitizeText(customerRef, FIELD_LIMITS.NAME_MAX) || 'Counter Sale';
  const cleanReason =
    sanitizeText(reason, FIELD_LIMITS.REASON_MAX) || 'Shop counter sale';

  const batch = writeBatch(db);
  batch.update(doc(db, 'products', product.id), {
    stockQuantity: nextStock,
    totalSold: product.totalSold + qty,
    updatedAt: serverTimestamp(),
  });

  const movRef = doc(collection(db, 'stockMovements'));
  batch.set(movRef, {
    productId: product.id,
    productName: product.name,
    category: product.category,
    type: MovementType.SALE,
    quantityDelta: -qty,
    previousStock: product.stockQuantity,
    newStock: nextStock,
    unitCost: product.costPrice,
    unitPrice: sellPrice,
    totalValue: qty * sellPrice,
    counterparty: cleanCounterparty,
    reason: cleanReason,
    orderId: '',
    occurredAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
  }
}

export async function adjustProductStock(
  rawProduct: Product,
  quantityDelta: number,
  reason: string
): Promise<void> {
  const product = normalizeProduct(rawProduct);
  const delta = Math.round(quantityDelta);
  if (delta === 0) {
    throw new Error('Stock adjustment cannot be zero.');
  }
  if (delta < -100000 || delta > 100000) {
    throw new Error('Stock adjustment must be within 100,000 units.');
  }
  const nextStock = product.stockQuantity + delta;
  if (nextStock < 0) {
    throw new Error(
      `Cannot reduce stock below 0 (current stock: ${product.stockQuantity}).`
    );
  }
  const cleanReason = sanitizeText(reason, FIELD_LIMITS.REASON_MAX);
  if (cleanReason.length < FIELD_LIMITS.REASON_MIN) {
    throw new Error('Please enter a brief reason for this adjustment.');
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'products', product.id), {
    stockQuantity: nextStock,
    updatedAt: serverTimestamp(),
  });

  const movRef = doc(collection(db, 'stockMovements'));
  batch.set(movRef, {
    productId: product.id,
    productName: product.name,
    category: product.category,
    type: MovementType.ADJUSTMENT,
    quantityDelta: delta,
    previousStock: product.stockQuantity,
    newStock: nextStock,
    unitCost: product.costPrice,
    unitPrice: product.price,
    totalValue: Math.abs(delta) * product.costPrice,
    counterparty: 'Stock Count Audit',
    reason: cleanReason,
    orderId: '',
    occurredAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
  }
}

export interface PlaceOrderParams {
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  notes: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deductImmediately: boolean;
}

export async function placeShopOrder(params: PlaceOrderParams): Promise<string> {
  if (params.items.length === 0) {
    throw new Error('Add at least one item to the order.');
  }
  const cleanName = sanitizeText(params.customerName, FIELD_LIMITS.NAME_MAX);
  const cleanPhone = sanitizeText(params.customerPhone, FIELD_LIMITS.PHONE_MAX);
  if (cleanName.length < FIELD_LIMITS.NAME_MIN) {
    throw new Error('Please enter a valid customer name.');
  }
  if (cleanPhone.length < FIELD_LIMITS.PHONE_MIN) {
    throw new Error('Please enter a valid phone number.');
  }

  if (params.deductImmediately) {
    for (const item of params.items) {
      if (item.product.stockQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${item.product.name} (${item.product.stockQuantity} available).`
        );
      }
    }
  }

  const orderRef = doc(collection(db, 'orders'));
  const randomSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  const orderNumber = `NT-${Date.now().toString().slice(-6)}-${randomSuffix}`;

  const itemCount = params.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = params.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const summaryText = sanitizeText(
    params.items.map((item) => `${item.quantity}x ${item.product.name}`).join(', '),
    FIELD_LIMITS.SUMMARY_MAX
  );

  const batch = writeBatch(db);
  batch.set(orderRef, {
    orderNumber,
    customerName: cleanName,
    customerPhone: cleanPhone,
    fulfillmentType: params.fulfillmentType,
    deliveryAddress:
      params.fulfillmentType === FulfillmentType.DELIVERY
        ? sanitizeText(params.deliveryAddress, FIELD_LIMITS.ADDRESS_MAX)
        : 'Counter Pickup — Nescan Traders',
    notes: sanitizeText(params.notes, FIELD_LIMITS.NOTES_MAX),
    summaryText,
    itemCount,
    totalAmount,
    paymentMethod: params.paymentMethod,
    paymentStatus: params.paymentStatus,
    status: params.deductImmediately ? OrderStatus.COMPLETED : OrderStatus.PENDING,
    stockDeducted: params.deductImmediately,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const item of params.items) {
    const prod = normalizeProduct(item.product);
    const itemRef = doc(collection(db, 'orders', orderRef.id, 'items'));
    batch.set(itemRef, {
      orderId: orderRef.id,
      productId: prod.id,
      productName: sanitizeText(prod.name, FIELD_LIMITS.NAME_MAX),
      sku: prod.sku,
      unit: prod.unit,
      unitPrice: prod.price,
      quantity: item.quantity,
      subtotal: prod.price * item.quantity,
    });

    if (params.deductImmediately) {
      const nextStock = prod.stockQuantity - item.quantity;
      batch.update(doc(db, 'products', prod.id), {
        stockQuantity: nextStock,
        totalSold: prod.totalSold + item.quantity,
        updatedAt: serverTimestamp(),
      });

      const movRef = doc(collection(db, 'stockMovements'));
      batch.set(movRef, {
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        type: MovementType.SALE,
        quantityDelta: -item.quantity,
        previousStock: prod.stockQuantity,
        newStock: nextStock,
        unitCost: prod.costPrice,
        unitPrice: prod.price,
        totalValue: item.quantity * prod.price,
        counterparty: cleanName,
        reason: `Customer order ${orderNumber}`,
        orderId: orderRef.id,
        occurredAt: Timestamp.now(),
        createdAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
    return orderNumber;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, `orders/${orderRef.id}`);
  }
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const itemsPath = `orders/${orderId}/items`;
  try {
    const snap = await getDocs(collection(db, 'orders', orderId, 'items'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<OrderItem, 'id'>),
    }));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.LIST, itemsPath);
  }
}

export async function confirmOrderAndDeductStock(
  order: Order,
  productsMap: Map<string, Product>
): Promise<void> {
  const items = await fetchOrderItems(order.id);
  if (items.length === 0) {
    throw new Error('No line items found for this order.');
  }

  const aggregatedQty = new Map<string, number>();
  for (const item of items) {
    aggregatedQty.set(
      item.productId,
      (aggregatedQty.get(item.productId) || 0) + item.quantity
    );
  }

  for (const [productId, needed] of aggregatedQty.entries()) {
    const prod = productsMap.get(productId);
    if (!prod) {
      throw new Error(`Product ${productId} no longer exists in inventory.`);
    }
    if (prod.stockQuantity < needed) {
      throw new Error(
        `Insufficient stock for ${prod.name}: needs ${needed}, only ${prod.stockQuantity} on hand.`
      );
    }
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', order.id), {
    status: OrderStatus.CONFIRMED,
    stockDeducted: true,
    updatedAt: serverTimestamp(),
  });

  for (const [productId, needed] of aggregatedQty.entries()) {
    const prod = normalizeProduct(productsMap.get(productId)!);
    const nextStock = prod.stockQuantity - needed;
    batch.update(doc(db, 'products', productId), {
      stockQuantity: nextStock,
      totalSold: prod.totalSold + needed,
      updatedAt: serverTimestamp(),
    });

    const movRef = doc(collection(db, 'stockMovements'));
    batch.set(movRef, {
      productId,
      productName: prod.name,
      category: prod.category,
      type: MovementType.SALE,
      quantityDelta: -needed,
      previousStock: prod.stockQuantity,
      newStock: nextStock,
      unitCost: prod.costPrice,
      unitPrice: prod.price,
      totalValue: needed * prod.price,
      counterparty: order.customerName,
      reason: `Order ${order.orderNumber} confirmed`,
      orderId: order.id,
      occurredAt: Timestamp.now(),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function transitionOrderStatus(
  order: Order,
  nextStatus: OrderStatus,
  productsMap: Map<string, Product>
): Promise<void> {
  if (nextStatus === OrderStatus.CANCELLED && order.stockDeducted) {
    const items = await fetchOrderItems(order.id);
    const batch = writeBatch(db);

    batch.update(doc(db, 'orders', order.id), {
      status: OrderStatus.CANCELLED,
      stockDeducted: false,
      updatedAt: serverTimestamp(),
    });

    for (const item of items) {
      const raw = productsMap.get(item.productId);
      if (raw) {
        const prod = normalizeProduct(raw);
        const restoredStock = prod.stockQuantity + item.quantity;
        batch.update(doc(db, 'products', prod.id), {
          stockQuantity: restoredStock,
          totalSold: Math.max(0, prod.totalSold - item.quantity),
          updatedAt: serverTimestamp(),
        });

        const movRef = doc(collection(db, 'stockMovements'));
        batch.set(movRef, {
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          type: MovementType.ADJUSTMENT,
          quantityDelta: item.quantity,
          previousStock: prod.stockQuantity,
          newStock: restoredStock,
          unitCost: prod.costPrice,
          unitPrice: prod.price,
          totalValue: item.quantity * prod.price,
          counterparty: order.customerName,
          reason: `Order ${order.orderNumber} cancelled — stock returned`,
          orderId: order.id,
          occurredAt: Timestamp.now(),
          createdAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
      return;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
    }
  }

  try {
    await updateDoc(doc(db, 'orders', order.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function updateOrderPayment(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentMethod: PaymentMethod
): Promise<void> {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentStatus,
      paymentMethod,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}
