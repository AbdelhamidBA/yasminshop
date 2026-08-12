# Phase 6: Hardening & Reference-Image UI/UX Pass

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Implemented idioms authoritative. This phase carries the accumulated §6b–§6f deferred riders plus a dedicated visual polish pass aligning the UI with `docs/reference-images/`.

**Goal:** Close the security/robustness hardening backlog accumulated across Phases 1–5, resolve the localized-error-message debt, and do a focused UI/UX pass so the storefront and admin match the three reference images (admin dashboard, storefront home, product page) in polish and feel — without regressing any tested behavior.

## Global Constraints

- Everything from Phases 1–5 binds. The user's pm2 dev server on port 3000 is reused; `touch next.config.ts` after catalog/schema edits; seeds + manual order #1 never mutated by tests. Docker Postgres must be up for this phase (Phase 6 is verification-heavy) — if it is down at start, STOP and report that Phase 6 needs the DB (unlike Phase 5's tasks, most of Phase 6 is verification/QA and cannot be meaningfully code-gated alone).
- **No behavior regressions:** every task ends with the full unit suite + all e2e specs green ×1 (×2 in the final task). Visual changes must not break existing e2e locators — update locators in the SAME commit if a rename is unavoidable, and prefer additive/aria-labelled changes.
- Conventional commits + Claude trailer; per task tsc + npm test + build green before commit.

## Reference-image alignment targets (study all three in docs/reference-images/)

- **Admin dashboard** (ecomm-admin-example.jpg): airy green/white, rounded stat cards with subtle tinted icon chips + up/down % deltas, a smooth area sales chart, an inventory-alerts style list, a donut with center total + legend %, recent-orders with avatar-ish customer cells and colored status pills, top-products as image cards with sold count + revenue.
- **Storefront home** (ecomm-client-mainpage.jpg): bold hero with a product-collage, trust-badges strip (free shipping / secure / returns / support), "Shop by Categories" tile row, "New Arrivals" and "Best Sellers" product-card grids with rating stars + wishlist heart + quick-add, a promo/flash banner, a footer feature strip.
- **Product page** (ecomm-client-productpage.jpg): breadcrumb, large gallery with thumb strip, title + rating, price, short description, qty + add-to-cart + wishlist/compare row, category/tag line, share row, Description/Reviews tabs, "Related products" grid.

Note: rating/reviews, wishlist, compare, and social-share are NOT in the data model or spec — do NOT build backend for them. The visual pass may add tasteful static/decorative affordances ONLY where they don't imply missing functionality (e.g. trust-badges strip, category tiles, hero polish, footer feature strip are safe; fake star ratings / wishlist hearts that do nothing are NOT — omit them). Keep scope to real features styled well.

---

### Task 1: Localized validation messages (the cross-phase zod-i18n rider)

- The recurring deferred item (Tasks P2-T6/T8/T11, etc.): server zod field errors surface raw English under inputs in FR/AR admin + client forms. Fix centrally: establish a message-KEY convention for ALL schemas (they should already emit keys for client-facing ones; sweep the admin schemas — catalog/parameters — to emit keys too), and a shared `fieldErrorText(code, t)` helper that maps a fieldErrors code through the form's error namespace with a generic `validation` fallback (never echo the raw code/English). Update every admin form's error-line rendering (categories, products, parameters, promo codes, orders customer edit, sub-admins) to use it. Add any missing `errors.*` keys to both catalogs.
- Verify: submit whitespace-only/empty required fields in a couple of admin dialogs over HTTP → localized message (not English) in both locales. Gates + full e2e green. Commit `fix: localize all form validation messages`.

### Task 2: Security hardening batch (rate limits, token invalidation, upload/push hardening)

- Reset-token: on successful `resetPassword`, invalidate the user's other outstanding tokens (`updateMany usedAt` in the existing tx) — the OWASP rider.
- Rate limiting: a small in-memory (or DB-backed) fixed-window limiter for the unauthenticated public write surfaces — `registerClient`, `requestPasswordReset`, `placeOrder`, `checkPromo`, `POST /api/search-hits` — keyed by IP (from headers) with sane limits; over-limit → a typed `rateLimited` failure / 429. Keep it simple and documented (single-instance memory store is fine for the VPS target; note multi-instance would need shared store).
- Upload hardening: `POST /api/uploads` content-length precheck before buffering; `GET /api/uploads/[...path]` requires `.webp` extension + adds `X-Content-Type-Options: nosniff`; explicit `sharp` `limitInputPixels`.
- Push: move the VAPID env/dynamic-import surface behind `server-only` (the §P5-T5 rider) so `@/lib/push` stays purely testable; `sw.js` notificationclick matches an admin URL before reusing a tab.
- `@/server` VISIBLE constant `Object.freeze`d; cart-revival integer≥0 price + length caps.
- Verify each over HTTP where possible (rate limit trips after N; upload rejects non-webp GET; reset invalidates siblings via throwaway script). Add unit tests for the limiter + reset-sibling-invalidation. Gates + full e2e green. Commit `feat: security hardening batch (rate limits, token and upload hardening)`.

### Task 3: JWT session revocation (the top §6b/§6e rider)

- The load-bearing security carry: a live session currently survives password reset AND client/sub-admin archive/role change until token expiry. Add a `tokenVersion Int @default(0)` to User; bump it on password reset, archive, and any role/credential change; embed it in the JWT (`jwt` callback) and re-check it in the `session` callback (or a lightweight per-request check on staff routes) against the DB — mismatch → invalidate. Migration additive. Balance cost: a DB read per request is acceptable on the admin surface; for the storefront keep it cheap (only staff/account pages need freshness). Document the chosen granularity.
- Verify: log in, reset password in another context (or bump version via script), confirm the old session is rejected on next protected navigation; archived staff session dies. Unit-test the version-check callback logic (pure part). Gates + full e2e green (login flows must still pass). Commit `feat: add JWT session revocation via token version`.

### Task 4: Storefront visual pass — home + shell (reference-image aligned)

- Home (ecomm-client-mainpage.jpg): polish the hero (stronger type scale, product-collage-ish layout using real featured products, CTA), add a **trust-badges strip** (free shipping / secure payment / easy returns / support — static, i18n text, lucide icons), a **"Shop by Categories"** tile row (real categories → link to `/products?cat=`), keep the four product sections but restyle cards toward the reference (cleaner card, price prominence, hover). Footer feature strip. All theme-safe + RTL + i18n; NO fake ratings/wishlist.
- ProductCard restyle (shared) toward the reference card without adding non-functional affordances.
- Verify both locales render, e2e storefront spec still green (locators!). Gates. Commit `feat: storefront home visual pass toward reference design`.

### Task 5: Storefront visual pass — product & catalog pages

- Product page (ecomm-client-productpage.jpg): breadcrumb polish, gallery + thumb-strip layout matching the reference proportions, title/price/description hierarchy, qty+add-to-cart row styling, category/tag line, a **Description** section styled as the reference's tab area (single "Description" tab is honest since Reviews aren't built — or a plain titled section; do NOT fake a Reviews tab), related-products grid restyle. Catalog page: filter sidebar + product grid polish, result count + sort styling.
- Verify both locales, e2e still green. Gates. Commit `feat: storefront product and catalog visual pass`.

### Task 6: Admin visual pass — dashboard + tables (reference-image aligned)

- Dashboard (ecomm-admin-example.jpg): stat cards get tinted icon chips + the up/down delta styling (delta data is available or computable — if a period-over-period delta isn't in getDashboardStats, either add it cheaply to the stats layer or omit the delta rather than fake it), the sales area chart + donut refined, recent-orders + top-products styled toward the reference. Admin table/list consistency pass (spacing, status pills, empty states) across orders/products/clients/categories/promo/sub-admins. Sidebar active-state + the collapsed-state polish.
- If adding a real delta: extend Task-1(P5) stats with a previous-period comparison (revenue/orders/clients % change) — bounded, tested. Otherwise omit deltas honestly.
- Verify admin e2e specs still green (locators!), both roles/locales. Gates. Commit `feat: admin dashboard and tables visual pass`.

### Task 7: Final hardening sweep + full verification + gates

- Sweep the remaining small ledger riders: Arabic gender-agreement fixes across admin catalogs; `break-inside-avoid` on invoice print rows; Base UI `type="button"`/`nativeButton` dev-overlay warning (add `nativeButton={false}` or the documented fix on `Button render={<a>}` sites); pagination windowing for long lists; My-Orders pagination; move `OrderStatusBadge`/notification bell shared components to a neutral dir if desired; `isUniqueViolationOn` string-branch polish; multi-line order-confirm deadlock (sort items by productId + map P2034→retryable); archived-order status message (`orderArchived` vs `invalidTransition`); a11y labels (stepper +/-, breadcrumb nav, gallery aria).
- Full verification: unit suite, all e2e specs ×2, tsc, build, prisma migrate status, a lint pass (decide whether to clear the accepted `set-state-in-effect` idiom repo-wide or leave documented). Add a short "deferred/known-limitations" note to the README (SMTP for reset emails still needed; single-instance rate limiter; push delivery browser-manual).
- Commit `chore: final hardening sweep and verification`.

## Exit criteria

Localized validation everywhere; rate limits on public writes; reset-token sibling invalidation; upload/push hardening; JWT revocation on credential/role/archive change; storefront + admin visually aligned with the reference images (real features only, no fake affordances); all accumulated ledger riders closed or explicitly documented; unit + all e2e specs green ×2; tsc/build/migrate/lint clean; README known-limitations noted. This completes the platform per the original spec.
