# Phase 4: Orders & Clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Tasks are enumerative; the implemented codebase idioms are authoritative (admin tables/dialogs/actions from Phase 2, storefront forms from Phase 3).

**Goal:** Admin manages orders end-to-end (list, detail, status flow with stock effects, manual creation, update, archive, printable invoice) and clients (list, detail, update, archive). Shoppers can register, reset passwords, and see My Orders. Sub-admins can change order status only.

## Global Constraints

- Everything from Phases 1–3 plans still binds (millimes, catalogs parity, logical utilities, archivedAt, scalar guards, server-side authz per page/action, Base UI idioms, conventional commits + Claude trailer, version-drift rule).
- **Spec §6d bindings implemented here:** CONFIRM re-checks stock (`qty ≤ quantity` per line, product VISIBLE-ish: exists && !archived) **inside the decrement transaction**; `nameArSnapshot` added so Arabic views show Arabic names; `requirePageStaff()` on clients/orders pages; storefront e2e gains a money-value assertion.
- **Status engine (spec):** transitions allowed: PENDING→CONFIRMED, PENDING→CANCELED, CONFIRMED→DELIVERED, CONFIRMED→CANCELED. Stock: →CONFIRMED decrements each line's product quantity; CONFIRMED→CANCELED re-adds. DELIVERED/CANCELED are terminal (no further transitions). Order items editable only while PENDING. Promo policy at confirm: **honor the snapshot** (totals frozen at order creation; documented).
- **Roles:** status change = `requireStaff` (sub-admin allowed); everything else on orders (manual create, update, archive/restore) = `requireAdmin`. Clients: mutations `requireAdmin`; pages `requirePageStaff`.
- Status badge palette (reference image): PENDING amber, CONFIRMED blue, DELIVERED green, CANCELED red — via Badge + theme-safe classes (e.g. `bg-amber-500/15 text-amber-600 dark:text-amber-400` pattern), defined ONCE in a shared `order-status-badge.tsx`.
- Registration is public: creates a CLIENT user (email unique → fieldError), auto-signs-in via the credentials flow. Password reset: token model, request action always returns ok (no email oracle), dev logs the reset URL to the server console; token single-use, 1h expiry, hashed at rest.
- Every task: tsc + npm test green before commit; UI tasks HTTP-verified with role jars; the user's pm2 dev server on port 3000 is REUSED, never killed. Manual order #1 (customerName 'Oussama…') must never be mutated by tests/scripts.

---

### Task 1: Migration (nameArSnapshot + PasswordResetToken) + snapshot wiring + e2e money assertion

- `prisma/schema.prisma`: `OrderItem` gains `nameArSnapshot String @default("")` (default for painless migrate; backfill SQL `UPDATE "OrderItem" SET "nameArSnapshot" = "nameSnapshot"`); new model `PasswordResetToken {id cuid, userId + user relation (Cascade), tokenHash String @unique, expiresAt DateTime, usedAt DateTime?, createdAt now} @@index([userId])`. Hand-edit migration for the backfill.
- `placeOrder` (checkout actions): items createMany gains `nameArSnapshot: product.nameAr`.
- Confirmation page + (future) order views: render `locale === 'ar' ? (item.nameArSnapshot || item.nameSnapshot) : item.nameSnapshot` — implement in the confirmation page now.
- `e2e/storefront.spec.ts`: add the money-value assertion (total row shows `240.300`).
- Gates incl. both e2e suites once. Commit `feat: add arabic snapshots and password reset tokens`.

### Task 2: Order status engine + orders data-access + actions (TDD core)

- `src/lib/orders.ts` (pure, TDD): `type OrderStatus` re-export; `ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]>` per the constraint; `canTransition(from, to): boolean`; `stockDelta(from, to): 'decrement' | 'restock' | 'none'` (PENDING→CONFIRMED decrement; CONFIRMED→CANCELED restock; else none). Tests: full matrix (valid + invalid transitions), delta cases.
- `src/server/orders.ts` (server-only): `listOrders({status?, q?, includeArchived, page, pageSize})` — q matches number (numeric string → number equals) or customerName/customerPhone contains-insensitive; includes `_count.items`, client email; newest first + id tiebreak; $transaction with count. `getOrder(id)` full (items + client). `type OrderRow/OrderDetail` exports.
- `src/app/[locale]/admin/orders/actions.ts`:
  - `changeOrderStatus(id, to)` — **requireStaff**; scalar-guard id + `to` in enum; load order (notFound); `canTransition` else `failure('invalidTransition')`; interactive `$transaction`: on decrement → per line load product, `failure('insufficientStock')` if `qty > product.quantity` or product archived (abort tx — return typed failure, NOT throw, using tx rollback via thrown sentinel caught outside), decrement via `updateMany`; on restock → increment quantities (products may be archived — still restock); update order status. Honor-snapshot promo (no re-validation — documented).
  - `updateOrderCustomer(id, formData)` — requireAdmin; only while not archived; checkoutSchema-like fields (reuse `checkoutSchema` minus promo).
  - `archiveOrder(id)`/`restoreOrder(id)` — requireAdmin; P2025→notFound mapping (learn from ledgered pattern — handle it this time).
- Throwaway live verification (fixture order with 'E2E TMP' customer + fixture product, hard-deleted): confirm decrements, cancel restores, invalid transition rejected, insufficient stock rejected without partial write. Commit `feat: add order status engine with stock effects`.

### Task 3: Admin orders UI (list + detail)

- Replace orders placeholder page: `requirePageStaff`; status filter tabs (all + 4 statuses, URL `?status=`), search input (`?q=`), archived toggle, paginated table per the reference image: `#<number>`, customer (name + phone small), date (`Intl.DateTimeFormat` locale-aware), items count, total (formatMillimes + currency), `OrderStatusBadge`, actions (view detail; ADMIN: archive/restore).
- `src/components/admin/order-status-badge.tsx` (shared, palette per Global Constraints).
- Detail page `/admin/orders/[id]`: `requirePageStaff`; customer card (name/phone/address/notes/client-account link if clientId); items table (locale-aware snapshot names, unit, qty, line total); totals card (subtotal/promo code+discount/delivery/total); **status control**: current badge + allowed-next buttons (from ALLOWED_TRANSITIONS) calling `changeOrderStatus` with confirm dialog for CANCELED, toasts incl. `insufficientStock` detail; ADMIN-only: edit-customer dialog (reuse form idiom), archive; link to invoice page. i18n `adminOrders.*` blocks (FR/AR) — enumerate keys yourself, keep both catalogs identical (parity test enforces).
- HTTP-verify matrix (admin/sub-admin: sub-admin sees status buttons but NOT edit/archive; both locales; manual order #1 renders fine). Commit `feat: add admin orders list and detail with status control`.

### Task 4: Manual order creation (ADMIN)

- `/admin/orders/new`: ADMIN-only page (sub-admin redirect like products/new). Client form: product picker (searchable select or simple table add rows: choose product via a search input reusing `/api/search-suggestions`? NO — that endpoint is storefront-visible-only which is fine (only sellable products); qty per line, remove line), customer fields (reuse checkout field set), optional promo code input.
- `createManualOrder(formData)` action — **requireAdmin**; reuses the placeOrder core: extract the shared order-creation logic from checkout actions into `src/server/create-order.ts` (`createOrderCore({lines, customer, promoCode, clientId}) → {orderId}` — the 9-step body minus form parsing) and refactor `placeOrder` to call it (NO behavior change — storefront e2e must stay green); manual action parses its own form then calls the same core. Notification row created likewise.
- Commit `feat: add manual order creation reusing the checkout core`.

### Task 5: Invoice printable page

- `/admin/orders/[id]/invoice`: `requirePageStaff`; print-optimized layout (white bg, black text, no nav/sidebar — route OUTSIDE the admin layout group or override; simplest: nested route with its own minimal layout); shop identity from Parameters (siteDescription/copyright/social), order number/date, customer block, items table (locale-aware names), totals, COD note; a visible "Print" button (`window.print()`, client leaf) hidden in `@media print`; `@media print` CSS in a local `<style>` or globals addition.
- HTTP-verify render both locales. Commit `feat: add printable order invoice`.

### Task 6: Clients admin (list/detail/update/archive)

- `src/server/clients.ts`: `listClients({q?, includeArchived, page, pageSize})` — role CLIENT only; q on name/email/phone; includes `_count.orders`; `getClient(id)` with recent orders (10, newest). Actions: `updateClient(id, formData)` (name/phone/address/city — NOT email/password), `archiveClient(id)`/`restoreClient(id)` — all requireAdmin; archived client can't log in (already enforced in authorize()).
- Replace clients placeholder page (requirePageStaff): table (name, email, phone, orders count, joined date, archived badge; ADMIN actions edit dialog/archive) + search + archived toggle + pagination. Detail page `/admin/clients/[id]`: profile card + orders table (linking to order detail). i18n `adminClients.*` both catalogs.
- HTTP-verify matrix (sub-admin read-only). Commit `feat: add clients management`.

### Task 7: Client auth (register + password reset)

- `/register` (storefront (auth) group): public page; form name/email/password(min 8)/confirm; `registerClient` action — public, zod message KEYS, email-taken → fieldError (P2002), creates CLIENT user (bcrypt), then the CLIENT auto-signs-in client-side via the same signIn('credentials') flow the login form uses (call signIn in the client after ok result — reuse login-form idiom) → redirect home. Login page gains a register link (and vice versa).
- Password reset: `/reset-password` (request: email input; `requestPasswordReset` action — ALWAYS ok, creates token (random 32B, store sha256 hash), expiry 1h; DEV: `console.log` the reset URL) and `/reset-password/[token]` (new password form; `resetPassword` action — hash lookup, unexpired, unused → set passwordHash, mark usedAt; invalid → generic error). Login page gains forgot-password link. i18n `authPages.*` both catalogs.
- HTTP-verify: register a fixture user over the real flow (curl the action is impractical — verify page renders + do the register via a throwaway Playwright mini-run OR defer interaction to Task 9 e2e and verify pages render + actions compile; choose e2e-defer, document). Commit `feat: add client registration and password reset`.

### Task 8: My Orders (storefront)

- `/account/orders`: client-facing page — auth required (ANY logged-in role; redirect to /login otherwise), lists the session user's orders (newest first): number, date, status badge (reuse OrderStatusBadge — move it to a shared location or import from admin components; it's presentational), total, expandable/linked lines? Keep simple list + detail inline (items with locale-aware snapshot names). Header user menu: logged-in header link to My Orders (replace or augment the logout-only area). i18n `myOrders.*` both catalogs.
- HTTP-verify with client jar (own orders only — filter `clientId: session.user.id`; ADMIN's view here shows their own orders too, fine). Commit `feat: add client my-orders page`.

### Task 9: Phase e2e + gates

- `e2e/admin-orders.spec.ts` (serial): storefront guest places an order (reuse journey helpers — E2E Client 2); admin opens orders list → detail → CONFIRM → product stock visibly decremented (check the products page quantity input value); CANCEL a second e2e order from PENDING (no stock change); sub-admin can change status but sees no edit/archive.
- `e2e/client-auth.spec.ts` (serial): register fixture client (email e2e-client@local.test), lands logged-in; place an order; My Orders shows it; logout.
- cleanup.ts: also delete PasswordResetTokens + users with email prefix `e2e-client`, plus their orders/notifications (before user delete). Full suite ×2; all gates. Commit `test: add orders and client-auth e2e journeys`.

## Exit criteria

Orders: list/filter/search/detail/status flow with stock effects proven by e2e (confirm decrements, cancel restores), manual creation via shared core, invoice prints, archive works, sub-admin limited to status. Clients: CRUD-lite + archived-login-block. Register/reset/My Orders live. All catalogs parity-green; suites (unit + 3 e2e specs) green ×2; tsc/build/migrate clean.
