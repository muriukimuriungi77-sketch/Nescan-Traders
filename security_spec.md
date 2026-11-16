# Nescan Traders Security Specification

## 1. Access Scope & Structural Safety
1. **Direct Shop Access (Sign-In Deferred)**: Google Sign-In is omitted per user request; add Firebase Auth gating before sharing the URL outside the shop.
2. **Default-Deny Safety Net**: All undeclared collections and paths are explicitly denied via `match /{document=**} { allow read, write: if false; }`.

## 2. Data & State Integrity Invariants
1. **Product Schema & Media Allowlist**: Every document in `/products/{productId}` must enforce exact key allowlisting (`hasAll`/`hasOnly`), immutable `sku` (`^[A-Z0-9-]+$`) and `createdAt`, non-negative pricing/stock counters, valid shop categories, and local image paths matching `^/src/assets/images/[a-zA-Z0-9_.-]+$`.
2. **Immutable Arithmetic Stock Ledger**: `/stockMovements/{movementId}` is strictly append-only (`allow update, delete: if false;`), requires `existsAfter()` verification of the referenced product, enforces sign parity (`purchase` > 0, `sale` < 0), and verifies `newStock == previousStock + quantityDelta`.
3. **Order State Machine & Terminal Locking**: Orders must start as `pending` or `completed`, transition strictly along `pending -> confirmed -> ready -> completed` (or `pending/confirmed -> cancelled`), block all updates once `cancelled`, and forbid order deletion (`allow delete: if false;`).
4. **Order Line Item Consistency**: Every `/orders/{orderId}/items/{itemId}` enforces `subtotal == unitPrice * quantity`, parent order existence via `existsAfter()`, and product existence via `exists()`.
5. **Shop Settings Schema Guard**: `/shopSettings/{settingId}` enforces allowlisted threshold presets, bounded custom thresholds (`1..10000`), boolean `catalogInitialized`, server timestamp `updatedAt == request.time`, and disables deletion (`allow delete: if false;`).

## 3. Red Team Audit ("Dirty Dozen" Attack Vectors Blocked)
1. **Unauthenticated Read/Write**: Client with `request.auth == null` reading `products` or `orders` -> `PERMISSION_DENIED`.
2. **Non-Owner Google Account Read (PII Blanket Test)**: Authenticated user with another verified email reading `orders` (`customerPhone`, `deliveryAddress`) -> `PERMISSION_DENIED`.
3. **Email Spoofing Attack**: Token claiming `email: 'muriukimuriungi77@gmail.com'` with `email_verified: false` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: Creating/updating a product with extra field `{ isAdmin: true }` -> `PERMISSION_DENIED` (`hasOnly` check).
5. **External / JavaScript URL Injection in `imageKey`**: Setting `imageKey: "javascript:alert(1)"` or external URL -> `PERMISSION_DENIED` (`matches('^/src/assets/images/...')`).
6. **Falsified Stock Ledger Arithmetic**: Creating a `stockMovement` with `previousStock: 10, quantityDelta: 5, newStock: 99` -> `PERMISSION_DENIED`.
7. **Ledger Tampering / Deletion**: Updating or deleting an existing `/stockMovements/{id}` document -> `PERMISSION_DENIED`.
8. **Negative Sale / Positive Purchase Inversion**: Creating a `sale` movement with `quantityDelta: +10` -> `PERMISSION_DENIED`.
9. **Order State Shortcutting**: Updating an order directly from `pending` to `completed` -> `PERMISSION_DENIED`.
10. **Cancelled Order Resurrection**: Updating a `cancelled` order back to `confirmed` -> `PERMISSION_DENIED`.
11. **Order Line-Item Subtotal Tampering**: Creating an `OrderItem` with `unitPrice: 300, quantity: 2, subtotal: 1` -> `PERMISSION_DENIED`.
12. **Resource / ID Poisoning**: Creating a document with an oversized or non-alphanumeric ID (`../secret`) -> `PERMISSION_DENIED` (`isValidId`).
