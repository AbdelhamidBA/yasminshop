# E-Commerce Platform — Design Spec

**Date:** 2026-08-11
**Source:** `ECommWebsite.md` + 3 reference images (admin dashboard, storefront home, product page)
**Status:** Approved 2026-08-11 (owner resolved open decisions — see §7)

---

## 1. What we're building

A bilingual (French main / Arabic RTL) e-commerce platform for local & imported products, built entirely in Next.js (frontend + backend), with:

- **Storefront** — public catalog, search, cart, pay-on-delivery checkout, client accounts.
- **Admin dashboard** — stats/charts, products, categories, orders, clients, sub-admins, global parameters, notifications with web push on new orders.

Visual direction from the reference images: clean, airy, card-based admin (green/white palette, stat tiles, line chart, recent-orders table); modern storefront with hero, category tiles, product-card grids and promo banners. Dark mode across both.

## 2. Architecture decision

**Chosen: Approach A — Next.js monolith.**

| Approach | Verdict |
|---|---|
| **A. Next.js App Router monolith** (Server Components + Server Actions + API routes, Prisma, single deploy) | **Chosen.** Matches the spec's explicit "Next.js front & backend", one codebase, one deploy, shared types end-to-end. |
| B. Next.js frontend + separate API (NestJS/Express) | Rejected — contradicts spec, doubles infra for no benefit at this scale. |
| C. Headless commerce engine (Medusa/Saleor) + custom UIs | Rejected — the custom admin rules (sub-admin field-level permissions, mass discount, bilingual product content, parameters) fight the framework; heavier ops. |

### Stack

- **Next.js 15+ (App Router, TypeScript)** — RSC for pages, Server Actions for mutations, route handlers for search suggestions / push endpoints.
- **PostgreSQL + Prisma** — relational data (orders/products/categories) is a natural fit.
- **Auth.js (NextAuth v5)**, credentials provider — roles `ADMIN`, `SUB_ADMIN`, `CLIENT`; middleware guards `/admin`; server-side field-level authorization for sub-admin limits.
- **next-intl** — FR default, AR with `dir="rtl"`; UI strings in message files, product/category content stored bilingually in DB.
- **Tailwind CSS v4 + shadcn/ui** — logical properties give RTL nearly free; `next-themes` for dark mode.
- **Recharts** — admin charts.
- **web-push** (VAPID) — push notifications to admin browsers; DB-backed in-app notification bell.
- **Zod** — validation on every server action / route.
- **sharp** — image resize/optimize on upload; files stored on server disk (`uploads/`), served via a route handler. (Swap to S3-compatible storage if hosting requires — see Open Decisions.)

### Route map

```
app/[locale]/
  (storefront)/            home, products, products/[slug], categories/[slug],
                           cart, checkout, order-confirmation/[id],
                           account/orders (logged-in clients)
  (auth)/                  login, register, reset-password
  admin/                   dashboard (stats), clients, products, orders,
                           categories, promo-codes, sub-admins, parameters,
                           notifications
api/                       search-suggestions, push subscribe, uploads
```

## 3. Data model

```
User          id, name, email*, phone, passwordHash, role(ADMIN|SUB_ADMIN|CLIENT),
              address, city, archivedAt, createdAt
Category      id, nameFr, nameAr, slug, parentId? (self-relation = subcategory), archivedAt
Product       id, reference*, nameFr, nameAr, descriptionFr, descriptionAr,
              price, discountPct, quantity, featured(bool), searchHits(int),
              categoryId, subCategoryId?, archivedAt, createdAt
ProductImage  id, productId, url, sortOrder            (min 1 enforced in validation)
Order         id, number(seq), clientId?, customerName, customerPhone, customerAddress,
              status(PENDING|CONFIRMED|DELIVERED|CANCELED),
              subtotal, promoCode?, promoDiscount, deliveryCost, total,
              notes, archivedAt, createdAt
OrderItem     id, orderId, productId, nameSnapshot, unitPrice(snapshot after discount),
              qty, lineTotal
PromoCode     id, code*, percentOff, active, expiresAt?, archivedAt
Setting       key*, value(JSON)   — socialLinks, deliveryCost, freeDeliveryThreshold,
              copyright, siteDescription, keywords, currency, lastChanceThreshold,
              massDiscountPct
Notification  id, type, payload(JSON), readAt, createdAt      (recipient: admin roles)
PushSubscription id, userId, endpoint, keysJson
```

**Archiving is soft-delete everywhere** (`archivedAt`): archived rows are hidden from default lists, visible under an "Archived" filter, restorable.

### Business rules

- **Effective price** = `price × (1 − effectiveDiscount)`, where `effectiveDiscount = massDiscountPct ?? product.discountPct`. Mass discount is a Settings override — applying it doesn't overwrite per-product discounts, and "remove from all" is clearing one setting (per spec's one-click requirement). Per-product values survive underneath.
- **Stock ↔ status:** `→ CONFIRMED` decrements each item's product quantity (validating availability); `CONFIRMED → CANCELED` re-adds it. `DELIVERED` has no stock effect. Order items are editable only while `PENDING` (avoids diff-reconciliation bugs after stock was taken).
- **Delivery cost:** from Settings, added at checkout; waived when subtotal (after discounts/promo) ≥ `freeDeliveryThreshold`.
- **Promo code:** percentage off subtotal, validated server-side at checkout (active + not expired).
- **Home sections:** New = latest by `createdAt`; Featured = `featured` flag; Last Chance = `0 < quantity ≤ lastChanceThreshold`; Most Searched = top `searchHits` (incremented when a product is opened from search suggestions/results).
- **Sub-admin enforcement is server-side:** product mutations from a `SUB_ADMIN` accept only `quantity`; order mutations accept only `status`. Everything else is read-only for them; Sub Admins section invisible to them.
- **Cart** lives client-side (localStorage + context) — no DB cart. Checkout re-validates prices, stock, and promo server-side and creates the order. Pay on delivery is the single payment method.
- **Guest checkout is allowed:** a guest orders with name/phone/address only (`Order.clientId` null, customer fields filled). Logged-in clients get those fields prefilled and the order linked to their account. Accounts still exist (login/register/reset per spec) and unlock the **My Orders** page (`account/orders`) listing the client's own orders with status.
- **Invoice:** print-ready order view (browser print dialog) with shop info from Parameters.
- **New-order flow:** order created → Notification row + web push to subscribed admin/sub-admin browsers → bell badge in admin header.

## 4. Spec gaps — assumptions made

These are things `ECommWebsite.md` doesn't specify. Each has a default chosen; overridable at review:

1. **Product has no Name field in the spec** (only reference/description/…), yet search is "by name". → Added `nameFr`/`nameAr`.
2. **Bilingual content:** admin enters product & category names/descriptions in both FR and AR (two fields). UI chrome comes from translation files.
3. **Guest checkout is allowed** (owner decision): orders can be placed with just name/phone/address; accounts remain available and link orders when logged in.
4. **Promo codes have no admin screen in the spec.** Added a minimal Promo Codes management (admin-only) — a code the cart accepts must be defined somewhere.
5. **Order statuses:** spec names Canceled/Pending/Confirmed "etc." → flow is `PENDING → CONFIRMED → DELIVERED`, `CANCELED` from Pending/Confirmed. Finance stats count Confirmed + Delivered.
6. **"Last Chance"** = low stock, threshold configurable in Parameters (default 5).
7. **"Most Searched"** = per-product hit counter incremented via search interactions.
8. **Featured** = boolean flag on product (not in spec's product definition).
9. **Password reset needs email** → SMTP credentials required in production; dev logs the reset link.
10. **Currency** not specified → a Parameter, default TND.
11. **Hosting** not specified → assumes a Node server (VPS) with persistent disk for uploads. Serverless hosting (Vercel) would require S3-type storage instead.

## 5. Build phases

Too large for one plan — six sequential sub-projects, each getting its own implementation plan → build → review cycle:

1. **Foundation** — scaffold, Tailwind/shadcn, next-intl FR/AR + RTL, dark mode, Prisma schema + seed, Auth.js with roles, base layouts (storefront shell, admin sidebar with 2 blocks + collapsed state).
2. **Admin catalog** — Categories CRUD (with subcategories), Products CRUD (multi-image upload, discount, archive), Parameters screen, promo codes.
3. **Storefront catalog & checkout** — home sections, product listing + filters (price/category/subcategory/availability), search with suggestions, product page, cart + promo, COD checkout with delivery-cost logic.
4. **Orders & clients** — admin orders (list, manual add, details, status flow with stock effects, update, archive, printable invoice), clients management, client auth pages wired to checkout, client My Orders page.
5. **Dashboard & notifications** — stats + charts (day/week/month/year), finances, orders-by-status; in-app notifications + web push; Sub Admins management; mass discount control.
6. **Hardening** — responsive/RTL/dark-mode QA pass on every screen, SEO meta from Parameters, empty/error states, performance.

## 6. Error handling & testing

- Zod-validated inputs on all server actions; typed error results surfaced as toasts/inline errors; stock-validation failures at checkout return per-item messages.
- Checkout and status-change stock mutations run in Prisma transactions.
- **Tests:** Vitest unit tests for the money/stock/promo domain logic (effective price, delivery threshold, status transitions); Playwright smoke tests for the two critical journeys (client checkout; admin order confirmation). TDD during implementation per superpowers workflow.

## 6b. Phase 1 carry-forward constraints (from the 2026-08-11 final branch review)

Phase 1 (Foundation) merged clean — 17 commits, all task-reviewed, final 3-lens review + browser QA passed. These review findings are **binding on later phases** (copy the relevant ones into each phase plan's Global Constraints):

- **Phase 2+ (every phase):** A layout `redirect()` does NOT stop page components from executing — every data-bearing admin page, server action, and API route must repeat its own server-side role check (`sub-admins/page.tsx` models the pattern). The middleware matcher skips dotted URLs and all of `/api/*`, so it is never the only guard.
- **Phase 2 (first migration):** add `@@index` on all hot FK columns — `Product.categoryId/subCategoryId`, `ProductImage.productId`, `OrderItem.orderId/productId`, `Order.clientId`, `Category.parentId`, `PushSubscription.userId` (Postgres does not auto-index FKs).
- **Phase 2 (before adding shadcn components):** `components.json` has `"rtl": false`; vendored primitives (`dropdown-menu`, `button`) carry physical `pl-/pr-` classes that will look wrong in Arabic — enable RTL generation or audit/override vendored primitives used in AR-facing UI.
- **Phase 3:** the language switcher drops query strings (`usePathname` excludes search params) — append `useSearchParams()` when filtered listings land. Storefront pages render dynamically because the header calls `auth()`; consider PPR/Suspense split if performance matters.
- **Phase 4/5 (before archive/role-management UI ships):** JWT-only sessions (30-day) have no revocation — an archived/demoted admin keeps access until token expiry. Decide: DB re-check in admin layout, tokenVersion claim, or short maxAge + rolling refresh. Also make login/logout redirects locale-aware (currently drop `/ar` to `/fr`; NEXT_LOCALE cookie partially mitigates).
- **Phase 6 (hardening):** credentials rate limiting + dummy-hash on unknown email (timing oracle); `AUTH_TRUST_HOST`/`AUTH_URL` env documentation for the VPS reverse-proxy deploy; RTL icon mirroring (`PanelLeft*` don't flip); fonts (Geist was dropped); per-locale `metadata`/SEO (no `<title>` today); derive middleware locale regex from `routing.locales`.
- Cosmetic riders: role string-union duplicated across next-auth types/auth.config/Prisma enum; welcome-heading `", "` separator (Arabic comma); `AGENTS.md`/`CLAUDE.md` are scaffold-generated; package name `ecom-platrome`.

## 7. Owner decisions (resolved 2026-08-11)

1. **Guest checkout** — ✅ allowed (name/phone/address; account optional).
2. **Currency** — ✅ TND.
3. **Hosting** — ✅ VPS/Node with persistent disk; images stored locally under `uploads/`.
4. **Client order history** — ✅ include a My Orders page for logged-in clients.
5. **SMTP provider** for password-reset emails — still needed before production launch; dev logs the reset link. Not blocking implementation.
