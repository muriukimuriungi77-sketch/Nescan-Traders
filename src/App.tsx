/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { InventoryView } from '@/src/components/InventoryView';
import { MovementLogView } from '@/src/components/MovementLogView';
import { OrderDeskView } from '@/src/components/OrderDeskView';
import { OrderDetailModal } from '@/src/components/OrderDetailModal';
import { ProfitMarginView } from '@/src/components/ProfitMarginView';
import { PurchaseModal } from '@/src/components/StockActionModals';
import { TopBar } from '@/src/components/TopBar';
import { VelocityView } from '@/src/components/VelocityView';
import { LEGACY_DEMO_PRODUCT_IDS, SHOP_CATALOG_IDS } from '@/src/data/catalogSeed';
import {
  db,
  formatDatabaseError,
  handleFirestoreError,
  OperationType,
} from '@/src/lib/firebase';
import {
  normalizeMovement,
  normalizeProduct,
  saveShopSettings,
  seedStarterInventory,
} from '@/src/lib/shopService';
import {
  ActiveTab,
  Order,
  Product,
  ShopSettings,
  StockMovement,
  ThresholdPreset,
} from '@/src/types/shop';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsFromServer, setProductsFromServer] = useState(false);

  const [thresholdPreset, setThresholdPreset] = useState<ThresholdPreset>('item');
  const [customThreshold, setCustomThreshold] = useState<number>(10);
  const [catalogInitialized, setCatalogInitialized] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsExists, setSettingsExists] = useState(false);
  const [settingsFromServer, setSettingsFromServer] = useState(false);

  const [seeding, setSeeding] = useState(false);
  const autoSeedAttempted = useRef(false);
  const settingsBackfillAttempted = useRef(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [purchaseTarget, setPurchaseTarget] = useState<Product | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [inspectedOrder, setInspectedOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const reportListenerError = useCallback(
    (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setSyncError(
          formatDatabaseError(
            wrapped,
            'Database connection error. Please verify your internet connection and refresh.'
          )
        );
      }
    },
    []
  );

  // Live products catalog listener
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const rows: Product[] = snap.docs.map((d) =>
          normalizeProduct({
            id: d.id,
            ...(d.data() as Omit<Product, 'id'>),
          })
        );
        rows.sort(
          (a, b) =>
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        );
        setFirestoreProducts(rows);
        setProductsLoaded(true);
        if (!snap.metadata.fromCache) {
          setProductsFromServer(true);
        }
        setSyncError(null);
      },
      (err) => {
        reportListenerError(err, OperationType.LIST, 'products');
      }
    );
    return () => unsub();
  }, [reportListenerError]);

  // Live shop settings listener (persists threshold filter & initialization flag)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'shopSettings', 'default'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<ShopSettings, 'id'>;
          setThresholdPreset(data.thresholdPreset || 'item');
          setCustomThreshold(
            typeof data.customThreshold === 'number' && data.customThreshold >= 1
              ? data.customThreshold
              : 10
          );
          setCatalogInitialized(Boolean(data.catalogInitialized));
          setSettingsExists(true);
        } else {
          setSettingsExists(false);
        }
        setSettingsLoaded(true);
        if (!snap.metadata.fromCache) {
          setSettingsFromServer(true);
        }
      },
      (err) => {
        reportListenerError(err, OperationType.GET, 'shopSettings/default');
      }
    );
    return () => unsub();
  }, [reportListenerError]);

  const isCatalogSeeded = firestoreProducts.length > 0;

  const handleSeedCatalog = useCallback(
    async (legacyIdsToRemove: string[] = []) => {
      if (seeding) return;
      setSeeding(true);
      try {
        await seedStarterInventory(legacyIdsToRemove, {
          thresholdPreset,
          customThreshold,
        });
        setToastMessage('Nescan Traders shop item list saved to database.');
      } catch (err) {
        setSyncError(
          formatDatabaseError(err, 'Unable to load starter catalog into database.')
        );
      } finally {
        setSeeding(false);
      }
    },
    [seeding, thresholdPreset, customThreshold]
  );

  // Auto-initialize starter shop item list ONLY after confirming server state & catalogInitialized is not set
  useEffect(() => {
    if (!productsLoaded || !settingsLoaded || !productsFromServer || !settingsFromServer) {
      return;
    }

    const hasNewCatalog = firestoreProducts.some((p) =>
      SHOP_CATALOG_IDS.has(p.id)
    );
    const legacyIds = firestoreProducts
      .filter((p) => LEGACY_DEMO_PRODUCT_IDS.has(p.id))
      .map((p) => p.id);

    // Existing databases that already have shop items get marked initialized so edits/deletions are never overwritten
    if (!settingsExists && hasNewCatalog && !settingsBackfillAttempted.current) {
      settingsBackfillAttempted.current = true;
      void saveShopSettings({
        thresholdPreset,
        customThreshold,
        catalogInitialized: true,
      }).catch(() => {});
      return;
    }

    if (catalogInitialized || autoSeedAttempted.current) {
      return;
    }

    if (firestoreProducts.length === 0) {
      autoSeedAttempted.current = true;
      void handleSeedCatalog([]);
    } else if (!hasNewCatalog && legacyIds.length > 0) {
      autoSeedAttempted.current = true;
      void handleSeedCatalog(legacyIds);
    }
  }, [
    productsLoaded,
    settingsLoaded,
    productsFromServer,
    settingsFromServer,
    settingsExists,
    catalogInitialized,
    firestoreProducts,
    thresholdPreset,
    customThreshold,
    handleSeedCatalog,
  ]);

  const handleSaveThreshold = useCallback(
    (nextPreset: ThresholdPreset, nextCustom: number) => {
      setThresholdPreset(nextPreset);
      setCustomThreshold(nextCustom);
      void saveShopSettings({
        thresholdPreset: nextPreset,
        customThreshold: nextCustom,
        catalogInitialized: catalogInitialized || firestoreProducts.length > 0,
      })
        .then(() => {
          setToastMessage('Low-stock threshold preference saved.');
        })
        .catch((err) => {
          setSyncError(
            formatDatabaseError(err, 'Unable to save threshold preference.')
          );
        });
    },
    [catalogInitialized, firestoreProducts.length]
  );

  // Live stock movements listener
  useEffect(() => {
    const movQuery = query(
      collection(db, 'stockMovements'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      movQuery,
      (snap) => {
        const rows: StockMovement[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StockMovement, 'id'>),
        }));
        rows.sort((a, b) => {
          const ta = (a.occurredAt || a.createdAt)?.toMillis?.() || 0;
          const tb = (b.occurredAt || b.createdAt)?.toMillis?.() || 0;
          return tb - ta;
        });
        setMovements(rows);
      },
      (err) => {
        reportListenerError(err, OperationType.LIST, 'stockMovements');
      }
    );

    return () => unsub();
  }, [reportListenerError]);

  // Live orders listener
  useEffect(() => {
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      ordersQuery,
      (snap) => {
        const rows: Order[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Order, 'id'>),
        }));
        setOrders(rows);
      },
      (err) => {
        reportListenerError(err, OperationType.LIST, 'orders');
      }
    );

    return () => unsub();
  }, [reportListenerError]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of firestoreProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [firestoreProducts]);

  const normalizedMovements = useMemo(
    () =>
      movements
        .filter((m) => !m.id.startsWith('seed-'))
        .map((m) => normalizeMovement(m, productsMap)),
    [movements, productsMap]
  );

  function openPurchaseModal(product: Product | null = null) {
    setPurchaseTarget(product);
    setPurchaseModalOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenRecordPurchase={() => openPurchaseModal(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {syncError && (
          <div
            role="alert"
            className="mt-4 p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md flex items-center justify-between gap-4"
          >
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={firestoreProducts}
            loading={!productsLoaded}
            isCatalogSeeded={isCatalogSeeded}
            seeding={seeding}
            thresholdPreset={thresholdPreset}
            customThreshold={customThreshold}
            onSaveThreshold={handleSaveThreshold}
            onSeedCatalog={() => handleSeedCatalog([])}
            onOpenPurchaseForProduct={(prod) => openPurchaseModal(prod)}
            onNavigateVelocity={() => setActiveTab('velocity')}
            onToast={setToastMessage}
          />
        )}

        {activeTab === 'velocity' && (
          <VelocityView
            products={firestoreProducts}
            movements={normalizedMovements}
            onOpenPurchaseForProduct={(prod) => openPurchaseModal(prod)}
            onToast={setToastMessage}
          />
        )}

        {activeTab === 'margins' && (
          <ProfitMarginView
            products={firestoreProducts}
            movements={normalizedMovements}
            onOpenPurchaseForProduct={(prod) => openPurchaseModal(prod)}
            onToast={setToastMessage}
          />
        )}

        {activeTab === 'movements' && (
          <MovementLogView
            movements={normalizedMovements}
            onOpenRecordPurchase={() => openPurchaseModal(null)}
          />
        )}

        {activeTab === 'orders' && (
          <OrderDeskView
            orders={orders}
            products={firestoreProducts}
            productsMap={productsMap}
            onInspectOrder={setInspectedOrder}
            onSuccess={setToastMessage}
          />
        )}
      </main>

      <footer className="border-t border-purple-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            <span className="font-semibold text-purple-800">Nescan Traders</span>
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-zinc-700">Est. 2024</span>
            <span aria-hidden="true"> · </span>
            <span>Sugar, Rice, Beans, Flour & Bakery, Snacks & Household Essentials</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className="hover:text-purple-900 cursor-pointer"
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('velocity')}
              className="hover:text-purple-900 cursor-pointer"
            >
              Velocity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('margins')}
              className="hover:text-purple-900 cursor-pointer"
            >
              Profit Margin
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className="hover:text-purple-900 cursor-pointer"
            >
              Movement Log
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="hover:text-purple-900 cursor-pointer"
            >
              Order Desk
            </button>
          </div>
        </div>
      </footer>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 bg-purple-900 text-white text-xs font-medium px-4 py-2.5 rounded-md shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      {purchaseModalOpen && (
        <PurchaseModal
          products={firestoreProducts}
          initialProduct={purchaseTarget}
          onClose={() => {
            setPurchaseModalOpen(false);
            setPurchaseTarget(null);
          }}
          onSuccess={setToastMessage}
        />
      )}

      <OrderDetailModal
        order={inspectedOrder}
        onClose={() => setInspectedOrder(null)}
      />
    </div>
  );
}
