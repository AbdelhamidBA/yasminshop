# Phase 3: Storefront Catalog & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shopper can browse the bilingual storefront (home sections, filtered/paginated catalog, search with suggestions, product pages), build a cart, apply a promo code, and place a pay-on-delivery order as a guest or logged-in client — with all prices, stock, and promo rules re-validated server-side.

**Architecture:** Server Components fetch via `src/server/storefront.ts`; the cart is a client-side localStorage context (no DB cart); checkout is one server action that ignores client prices, recomputes everything from the DB (effective price honors the `massDiscountPct` setting), validates stock/promo/bounds, and creates a `PENDING` Order + items + a `NEW_ORDER` Notification row in one transaction (stock decrements only on CONFIRMED — Phase 4). Products gain a URL slug. UI follows the established Base UI idioms.

**Tech Stack:** Existing stack only (no new dependencies).

## Global Constraints

- Everything from the Phase 1/2 plans' Global Constraints still binds: integer millimes; fr/ar catalogs key-identical with non-empty leaves (test-enforced); Tailwind logical utilities only in project-authored code; `archivedAt` soft delete; server-side role checks on every data-bearing page/action/route; conventional commits ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; version-drift rule; Base UI (NOT Radix) shadcn: `render={...}` not `asChild`, Select `items` prop, MenuItem `onClick`.
- **Spec §6c bindings implemented in this phase:** promo validation checks `archivedAt === null && active && (expiresAt === null || expiresAt > now)`; every storefront product query filters archived categories (product's category — and subcategory when set — must be non-archived); `.max(MAX_MILLIMES)` bounds on all millimes schema fields before order snapshotting; seed regenerated with a real uploaded webp; client-facing zod schemas use **message keys** (e.g. `'required'`) that the UI translates — never default English messages; the language switcher preserves query strings.
- **Storefront pricing rule (spec):** effective price = `effectivePriceMillimes(price, discountPct, massDiscountPct)` where `massDiscountPct` comes from the Setting row (seeded `null`; Phase 5 adds its control). Admin screens keep passing `null`; the storefront reads the setting.
- **Checkout math (spec):** `subtotal = Σ(effectiveUnitPrice × qty)`; `promoDiscount = round(subtotal × pct/100)`; `afterPromo = subtotal − promoDiscount`; `deliveryCost = afterPromo ≥ freeDeliveryThreshold ? 0 : deliveryCostSetting`; `total = afterPromo + deliveryCost`. All integer millimes.
- Raw client-supplied ids/args in actions and routes get scalar guards before any Prisma filter (the Phase 2 fix-wave idiom).
- Public order-confirmation URLs use the Order **id** (cuid — unguessable), never the sequential number.
- `MAX_MILLIMES = 2_000_000_000` (safely under Int4 max) — exported from `@/lib/money`.
- Environment: Windows 10, Node 22, Docker Postgres (`docker compose up -d`), seeded logins from Phase 1. Per task: `npx tsc --noEmit` + `npm test` green before committing; UI tasks verify over HTTP with curl (+ session jar only where login matters — most storefront checks are anonymous); kill dev servers/orphans on port 3000 after.

---

### Task 1: Product slugs, millimes bounds, seed v2, query-preserving language switcher

**Files:**
- Modify: `prisma/schema.prisma` (Product gains `slug String @unique`), `src/lib/money.ts` (+`MAX_MILLIMES`), `src/lib/schemas/catalog.ts` (bounds), `src/app/[locale]/admin/products/actions.ts` (slug generation on create), `prisma/seed.ts` (slugs, uploaded webp image, richer catalog), `src/components/language-switcher.tsx` (preserve query string), `src/lib/money.test.ts` / `src/lib/schemas/catalog.test.ts` (extend)
- Create: `prisma/migrations/<ts>_add_product_slug/` (hand-edited SQL with backfill)

**Interfaces:**
- Produces: `Product.slug` (unique, URL-safe, generated from `nameFr` create-only via `ensureUniqueSlug(slugify(nameFr) || 'produit', …)`); `MAX_MILLIMES` from `@/lib/money`; bounded schemas (`priceMillimes`, `deliveryCostMillimes`, `freeDeliveryThresholdMillimes` all `.max(MAX_MILLIMES)`); seed with ~8 products across 3 root categories (2 with children), every product carrying a real `/api/uploads/products/seed-*.webp` image (the seed generates the webp files with sharp directly into `uploads/products/` — same visual pipeline as real uploads), at least: 2 featured, 2 low-stock (qty ≤ 5), 1 with `discountPct > 0`, 1 out-of-stock (qty 0), spread of prices for range-filter testing, plus one seeded promo code `BIENVENUE10` (10%, active, no expiry); language switcher keeps `?query=strings` across locale switches.

- [ ] **Step 1: Schema + migration with backfill.** Add `slug String @unique` to Product (after `reference`). Run `npx prisma migrate dev --create-only --name add_product_slug`, then edit the generated SQL to:

```sql
ALTER TABLE "Product" ADD COLUMN "slug" TEXT;
UPDATE "Product" SET "slug" = lower("reference") WHERE "slug" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
```

Then `npx prisma migrate dev` to apply. `npx prisma migrate status` up to date.

- [ ] **Step 2: Bounds (TDD).** Add `export const MAX_MILLIMES = 2_000_000_000;` to `src/lib/money.ts`. Extend tests: `parseDinarsToMillimes` unchanged; add schema tests asserting `priceMillimes: MAX_MILLIMES + 1` and `deliveryCostMillimes: MAX_MILLIMES + 1000` are rejected while `MAX_MILLIMES` passes. Apply `.max(MAX_MILLIMES)` to `productSchema.priceMillimes`, `parametersSchema.deliveryCostMillimes`, `parametersSchema.freeDeliveryThresholdMillimes`.

- [ ] **Step 3: Slug generation in `createProduct`.** After the category-pair validation, generate `slug` exactly like categories do (`ensureUniqueSlug(slugify(parsed.data.nameFr) || 'produit', async (s) => (await prisma.product.count({where: {slug: s}})) > 0)`) and include it in the create data. `updateProduct` never touches slug. P2002 can now also fire on slug — keep mapping to `referenceTaken` only when `error.meta?.target` includes `reference`; a slug collision retries once with a fresh `ensureUniqueSlug` then rethrows (extract a small helper; keep it simple).

- [ ] **Step 4: Seed v2.** Rewrite the catalog portion of `prisma/seed.ts` (users + settings untouched): 3 roots (Électronique / Maison / Mode with Arabic names) + children (Audio under Électronique; Cuisine under Maison); ~8 products with explicit unique `slug` values, bilingual names/descriptions, prices between 9.900 and 899.000 DT, the mix required above; for each product the seed ensures its webp exists by generating a small colored placeholder with sharp (`sharp({create:…}).webp()`) written to `uploads/products/seed-<slug>.webp` and referencing `/api/uploads/products/seed-<slug>.webp`; upsert-idempotent (re-runs clean); seeded promo `BIENVENUE10` upserted by code. Run `npx prisma db seed` twice to prove idempotency.

- [ ] **Step 5: Language switcher query preservation.** In `src/components/language-switcher.tsx`, read `useSearchParams()` and preserve it as a string href: `const qs = params.toString(); router.replace(qs ? \`${pathname}?${qs}\` : pathname, {locale: other});` (string hrefs are valid without a `pathnames` config). If Next demands a Suspense boundary for `useSearchParams` at build time, wrap the component usage site and document it.

- [ ] **Step 6: Gates + commit.** `npm test` (extended suites green), `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (admin suite must still pass — createProduct now also writes slug). Commit: `feat: add product slugs, millimes bounds, seed v2 with real images`.

---

### Task 2: Checkout math + promo validation + mass discount read (TDD)

**Files:**
- Create: `src/lib/checkout.ts`, `src/lib/checkout.test.ts`, `src/server/promo.ts`
- Modify: `src/server/settings.ts` (+`getMassDiscountPct`)

**Interfaces:**
- `@/lib/checkout` (pure): `type CartTotalsInput = {items: Array<{unitPriceMillimes: number; qty: number}>; promoPercentOff: number | null; deliveryCostMillimes: number; freeDeliveryThresholdMillimes: number}`; `computeCartTotals(input): {subtotalMillimes: number; promoDiscountMillimes: number; deliveryCostMillimes: number; totalMillimes: number}` implementing the Global Constraints formula (empty cart → all zeros with deliveryCost 0).
- `@/server/promo`: `validatePromoCode(code: string): Promise<{code: string; percentOff: number} | null>` — uppercases/trims input, scalar-guards it, returns null unless `archivedAt === null && active && (expiresAt === null || expiresAt > new Date())`.
- `@/server/settings`: `getMassDiscountPct(): Promise<number | null>` — reads the `massDiscountPct` Setting row directly; returns the number when the stored JSON value is an integer 0–100, else `null`.

- [ ] **Step 1 (TDD):** tests first for `computeCartTotals`: no promo below threshold (delivery charged); promo pushing afterPromo over threshold (delivery FREE — promo applies before the threshold test); promo below threshold (delivery still charged); exact-threshold boundary (≥ → free); rounding (10% of 9_990 → 999); empty cart → zeros; multi-line subtotal. RED → implement → GREEN.
- [ ] **Step 2:** implement `src/server/promo.ts` and `getMassDiscountPct` per the interfaces (both `server-only` modules; promo lookup via `prisma.promoCode.findUnique({where: {code}})` after guard+uppercase).
- [ ] **Step 3:** verify promo semantics against the live DB with a throwaway script (BIENVENUE10 valid; a created-then-archived fixture code invalid; expired fixture invalid; fixtures hard-deleted). Gates; commit `feat: add checkout totals, promo validation, and mass discount read`.

---

### Task 3: Storefront data-access

**Files:**
- Create: `src/server/storefront.ts`

**Interfaces (all `server-only`; every query applies the visibility filter):**
- `const VISIBLE = {archivedAt: null, category: {archivedAt: null}, OR: [{subCategoryId: null}, {subCategory: {archivedAt: null}}]}` — the binding archived-category filter, applied to EVERY function below.
- `getHomeSections(lastChanceThreshold: number)` → `{newest, featured, lastChance, mostSearched}` — each `ProductCardData[]` max 8: newest by `createdAt desc`; featured `featured: true`; lastChance `quantity > 0 AND quantity <= threshold`; mostSearched `searchHits > 0` by `searchHits desc`.
- `type ProductCardData` = select of `{id, slug, nameFr, nameAr, priceMillimes, discountPct, quantity, images(first by sortOrder asc, id asc)}` — export the type.
- `listStorefrontProducts(params: {q?, categorySlug?, subCategorySlug?, minPriceMillimes?, maxPriceMillimes?, inStock?, sort?: 'new'|'priceAsc'|'priceDesc', page: number, pageSize: number})` → `{products: ProductCardData[], total: number}` (findMany + count in a `$transaction`); q searches nameFr/nameAr/reference insensitive; category filter resolves slug → id and matches `categoryId` OR `subCategoryId` in that category's tree; price range on `priceMillimes` (raw price — good enough for filtering; note: discounts not applied to range, documented); `inStock` → `quantity > 0`; sort maps to `createdAt desc` / `priceMillimes asc` / `desc`; secondary `orderBy id asc` everywhere for stable pagination.
- `getStorefrontProduct(slug: string)` → full product (all images ordered `sortOrder asc, id asc`, category + subCategory names) or null; only when VISIBLE.
- `getRelatedProducts(productId: string, categoryId: string)` → up to 4 VISIBLE `ProductCardData` from the same category, excluding the product.
- `listVisibleCategoryTree()` → roots + children `{id, nameFr, nameAr, slug}` (non-archived), for the filter sidebar and nav.

- [ ] Implement; verify with a throwaway read-only script against the seeded catalog (counts per section; archived-category exclusion by temporarily… NO — read-only: instead assert the seeded expectations: newest ≤ 8, featured = the seeded featured count, lastChance matches seeded low-stock count, out-of-stock product absent from lastChance but present in listing with inStock unset and absent with inStock true; price range narrows results; category slug filter works for a child slug). Gates; commit `feat: add storefront data-access with visibility filtering`.

---

### Task 4: Search suggestions + search-hit endpoints

**Files:**
- Create: `src/app/api/search-suggestions/route.ts`, `src/app/api/search-hits/route.ts`

**Interfaces:**
- `GET /api/search-suggestions?q=…` (public): q trimmed; length < 2 → `{suggestions: []}`; else up to 8 VISIBLE products matching nameFr/nameAr/reference contains-insensitive → `{suggestions: [{id, slug, nameFr, nameAr, priceMillimes, discountPct, imageUrl}]}` (first image url or null). `Cache-Control: no-store`.
- `POST /api/search-hits` (public, fire-and-forget): JSON `{productId}`; scalar-guard productId (non-empty string ≤ 40 chars) else 400; `updateMany({where: {id: productId, archivedAt: null}, data: {searchHits: {increment: 1}}})`; always `{ok: true}` 200 on valid shape (even when no row matched — no existence oracle). Abuse note: unauthenticated counter inflation is accepted (spec's "most searched" is heuristic) — documented in code comment.

- [ ] Implement both; verify over HTTP: q=cas returns the Casque suggestion with image url; q=x → empty; Arabic query matches; POST increments (check via psql/throwaway read before+after on a seed product, then decrement back… NO writes outside APIs: instead create the increment via the API itself and accept +1 on a seed product — harmless (searchHits is a heuristic; note in report), or better use the E2E-style approach: read searchHits before, POST, read after, expect +1, leave it (document). Malformed body → 400; object-injection body `{productId: {not: ''}}` → 400. Gates; commit `feat: add search suggestions and search-hit endpoints`.

---

### Task 5: ProductCard + home page

**Files:**
- Create: `src/components/storefront/product-card.tsx`, `src/components/storefront/price.tsx`
- Modify: `src/app/[locale]/(storefront)/page.tsx` (replace placeholder hero), `messages/fr.json`, `messages/ar.json`

**Interfaces:**
- `<Price priceMillimes discountPct massDiscountPct currencyLabel />` (server-compatible, no hooks): renders effective price via `effectivePriceMillimes` + `formatMillimes`, struck-through original + `-N%` badge (`dir="ltr"` on the badge) when a discount applies.
- `<ProductCard product={ProductCardData} massDiscountPct currencyLabel />` (server component): image (plain `<img>`, `aspect-square object-cover rounded-lg`, first image or `/placeholder-product.svg`), locale-aware name (server: accept a `locale` prop or use `getLocale` — keep it a sync server component receiving `locale` as prop), `<Price/>`, out-of-stock badge when qty 0, whole card wrapped in `Link href={{pathname: '/products/[slug]', params: {slug}}}`… next-intl `Link` with dynamic pathname: simplest is `Link href={\`/products/\${product.slug}\`}` (pathnames config not used — plain paths are valid).
- Home page: fetches `getHomeSections(parameters.lastChanceThreshold)`, `getParameters`, `getMassDiscountPct` in parallel; hero section (title/subtitle from existing `home.*` keys + a CTA Link to `/products` with new key `home.cta`); four sections, each rendered only when non-empty, heading keys `home.sections.newest|featured|lastChance|mostSearched`, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.

**i18n additions (both catalogs, FR/AR):** `home.cta` ("Voir tous les produits" / "عرض جميع المنتجات"), `home.sections.newest` ("Nouveautés" / "وصل حديثاً"), `featured` ("En vedette" / "مميزة"), `lastChance` ("Dernière chance" / "فرصة أخيرة"), `mostSearched` ("Les plus recherchés" / "الأكثر بحثاً"), `storefront.outOfStock` ("Rupture de stock" / "نفد المخزون"), `storefront.from`? — not needed; keep minimal.

- [ ] Implement; HTTP-verify `/fr` and `/ar` (sections render with seeded products, discounted product shows struck price, out-of-stock product absent from lastChance, RTL mirrors). Gates; commit `feat: add storefront home with product sections`.

---

### Task 6: Catalog listing page with filters

**Files:**
- Create: `src/app/[locale]/(storefront)/products/page.tsx`, `src/app/[locale]/(storefront)/products/filters.tsx` (client), `src/app/[locale]/(storefront)/products/pagination.tsx` (client or server links)
- Modify: `src/components/storefront/site-header.tsx` (nav gains a `/products` link using existing `nav.products` key), catalogs

**Interfaces:**
- URL-driven state (searchParams): `q, cat (category slug), sub (subcategory slug), min, max (dinars strings), stock ('1'), sort ('new'|'priceAsc'|'priceDesc'), page`. Page size 12.
- Server page: parses params (dinars → millimes via `parseDinarsToMillimes`, invalid → ignored), fetches `listStorefrontProducts` + `listVisibleCategoryTree` + `getParameters` + `getMassDiscountPct`, renders `ProductCard` grid, result count, empty state, `<Filters/>` (aside on lg, collapsible on mobile via a simple `<details>` element — no new deps), `<Pagination/>` (prev/next + page numbers as `Link`s preserving all params).
- `<Filters/>` client component: category tree (root links; children indented; clicking sets `cat`/`sub` and resets `page`), price min/max inputs (`dir="ltr"`) + apply button, in-stock Switch, sort Select (Base UI items pattern), all writing to the URL via `useRouter().replace` with merged `URLSearchParams`; a "clear filters" link when any filter active.

**i18n additions:** `catalog.title` ("Tous les produits" / "جميع المنتجات"), `catalog.results` ("{count} produit(s)" / "{count} منتج(ات)") — use next-intl interpolation, `catalog.filters` ("Filtres" / "تصفية"), `catalog.categories` ("Catégories" / "الفئات"), `catalog.allCategories` ("Toutes" / "الكل"), `catalog.price` ("Prix (DT)" / "السعر (د.ت)"), `catalog.min` ("Min" / "الأدنى"), `catalog.max` ("Max" / "الأقصى"), `catalog.apply` ("Appliquer" / "تطبيق"), `catalog.inStockOnly` ("En stock uniquement" / "المتوفر فقط"), `catalog.sort` ("Trier" / "ترتيب"), `catalog.sortNew` ("Nouveautés" / "الأحدث"), `catalog.sortPriceAsc` ("Prix croissant" / "السعر تصاعدياً"), `catalog.sortPriceDesc` ("Prix décroissant" / "السعر تنازلياً"), `catalog.clear` ("Effacer les filtres" / "مسح التصفية"), `catalog.empty` ("Aucun produit ne correspond." / "لا توجد منتجات مطابقة."), `catalog.prev` ("Précédent" / "السابق"), `catalog.next` ("Suivant" / "التالي").

- [ ] Implement; HTTP-verify: `/fr/products` grid of seeded products with count; `?cat=<root slug>` narrows; `?sub=<child slug>` narrows further; `?min=50&max=200` narrows by price; `?stock=1` hides the out-of-stock product; `?sort=priceAsc` order check via first card; `?page=2` when >12 products… seed has ~8 — pagination verified structurally (page-1 renders, next disabled/absent). `/ar` RTL + Arabic filter labels. Language switcher on a filtered URL keeps the query (Task 1 change — assert). Gates; commit `feat: add filtered storefront catalog`.

---

### Task 7: Search box with suggestions

**Files:**
- Create: `src/components/storefront/search-box.tsx`
- Modify: `src/components/storefront/site-header.tsx` (mount between nav and controls), catalogs

**Interfaces:**
- Client component: input (`aria-label` from `common.search` — key exists), 250ms debounce, fetches `/api/search-suggestions`, renders a dropdown listbox (absolute panel under the input, `start-0 end-0`, keyboard: ArrowUp/Down + Enter + Escape, `role="listbox"/"option"`); each suggestion shows thumb + locale name + effective price (client-side compute needs massDiscountPct: accept it as a prop from the server header along with currencyLabel); click/Enter → `POST /api/search-hits` fire-and-forget (`navigator.sendBeacon` or `fetch(…, {keepalive: true})`) then `router.push` to the product page; Enter with no selection → `/products?q=…`; blur/Escape closes; empty state row `search.noResults` when q ≥ 2 and zero suggestions.
- Header becomes: logo, nav, SearchBox (grows, `hidden md:block` + a mobile-visible variant below header on small screens is NOT required this phase — md+ only, documented), controls.

**i18n additions:** `search.noResults` ("Aucun résultat" / "لا نتائج").

- [ ] Implement; verification: suggestions endpoint already HTTP-verified; the box's markup renders in the header (`/fr` HTML contains the input with aria-label); interactive behavior covered by Task 11 e2e. Gates; commit `feat: add header search with suggestions`.

---

### Task 8: Cart provider + header badge (TDD reducer)

**Files:**
- Create: `src/lib/cart.ts` (pure reducer + types), `src/lib/cart.test.ts`, `src/components/cart/cart-provider.tsx`, `src/components/cart/cart-badge.tsx`
- Modify: `src/app/[locale]/(storefront)/layout.tsx` (wrap in provider), `src/components/storefront/site-header.tsx` (replace the placeholder cart span with `<CartBadge/>` linking to `/cart`)

**Interfaces:**
- `@/lib/cart` (pure, TDD): `type CartItem = {productId: string; slug: string; nameFr: string; nameAr: string; unitPriceMillimes: number; imageUrl: string | null; qty: number}`; `type CartState = {items: CartItem[]}`; `cartReducer(state, action)` with actions `{type:'add', item, qty}` (merges by productId, sums qty, caps qty at 99), `{type:'setQty', productId, qty}` (qty ≤ 0 removes; caps 99), `{type:'remove', productId}`, `{type:'clear'}`; `cartCount(state)` (Σ qty); `cartSubtotal(state)` (Σ unitPrice×qty). Tests: add-new, add-merge, cap, setQty to zero removes, remove, clear, count/subtotal.
- `CartProvider` (client): `useReducer` + hydrate from `localStorage('cart-v1')` on mount (guarded JSON.parse; invalid → empty), persist on change; context exposes `{state, hydrated, add, setQty, remove, clear}`. Note: `unitPriceMillimes` stored client-side is DISPLAY ONLY — checkout re-prices server-side (comment this).
- `CartBadge` (client): count bubble (hidden until hydrated to avoid mismatch), `Link` to `/cart`, `aria-label` common.cart.

- [ ] TDD the reducer; implement provider/badge; wrap layout (`<CartProvider>` inside the storefront layout around header+main+footer). HTTP-verify `/fr` still renders (badge markup present). Gates; commit `feat: add client cart with persistent state`.

---

### Task 9: Product detail page + add to cart

**Files:**
- Create: `src/app/[locale]/(storefront)/products/[slug]/page.tsx`, `src/app/[locale]/(storefront)/products/[slug]/gallery.tsx` (client), `src/app/[locale]/(storefront)/products/[slug]/add-to-cart.tsx` (client)
- Modify: catalogs

**Interfaces:**
- Page (server): `getStorefrontProduct(slug)` → `notFound()` when null; breadcrumb (home / category / [subcategory]); `<Gallery images/>` (main image + thumb strip, client-side selected index); name (locale), description (locale, `whitespace-pre-line`), `<Price/>` large, stock line (in stock / low stock with count when ≤ threshold / out of stock), `<AddToCart/>` (qty stepper 1..min(99, quantity), disabled when qty 0, on click `add(...)` + `toast.success(t('addedToCart'))`), related products section via `getRelatedProducts`.
- `generateMetadata`: title = locale name, description = first 160 chars of locale description (first real per-page SEO — cheap and allowed).

**i18n additions:** `product.inStock` ("En stock" / "متوفر"), `product.lowStock` ("Plus que {count} en stock !" / "لم يتبق سوى {count} في المخزون!"), `product.outOfStock` ("Rupture de stock" / "نفد المخزون"), `product.addToCart` ("Ajouter au panier" / "أضف إلى السلة"), `product.addedToCart` ("Ajouté au panier." / "تمت الإضافة إلى السلة."), `product.related` ("Produits similaires" / "منتجات مشابهة"), `product.quantity` ("Quantité" / "الكمية"), `breadcrumb.home` ("Accueil" / "الرئيسية").

- [ ] Implement; HTTP-verify a seeded slug on `/fr` + `/ar` (name, price, breadcrumb, related grid, add-to-cart button markup; unknown slug → 404; archived-category product → 404 — verify by checking a slug that stays visible only). Gates; commit `feat: add product detail page with gallery and add to cart`.

---

### Task 10: Cart page, checkout, order creation, confirmation

**Files:**
- Create: `src/app/[locale]/(storefront)/cart/page.tsx` (server shell) + `cart-view.tsx` (client), `src/app/[locale]/(storefront)/checkout/page.tsx` + `checkout-form.tsx` (client), `src/app/[locale]/(storefront)/checkout/actions.ts`, `src/app/[locale]/(storefront)/order-confirmation/[id]/page.tsx`, `src/lib/schemas/checkout.ts` (+test)
- Modify: catalogs

**Interfaces:**
- `checkoutSchema` (`@/lib/schemas/checkout`, TDD): `{name: min 2, phone: /^[0-9+ ]{8,15}$/, address: min 5, city: min 2, notes: optional ≤ 500, promoCode: optional}` — **every constraint carries a message KEY** (`'required'`, `'invalidPhone'`, `'tooShort'`, `'tooLong'`) via zod `{message: 'key'}`; the client translates `t(\`errors.\${key}\`)`. Test: keys (not English text) surface in `fieldErrorsFromZod` output.
- `placeOrder(payload: {items: Array<{productId: string; qty: number}>; customer: FormData-shaped fields; promoCode?: string}) → ActionResult<{orderId: string}>` — the phase's critical action. Signature: `placeOrder(formData: FormData)` where `items` is a JSON hidden field like the product form. Steps, in order, ALL server-side:
  1. Parse items JSON (guarded; each `{productId: non-empty string, qty: int 1..99}`; 1..40 lines; duplicates merged); parse customer via `checkoutSchema`.
  2. Load the products by id **with the VISIBLE filter**; every requested id must resolve → else `failure('cartChanged')`.
  3. Stock check: `qty ≤ product.quantity` per line → else `failure('validation', {items: 'insufficientStock'})` plus per-product detail in `data`? Keep simple: `failure('insufficientStock')` and the client re-syncs cart quantities against a returned refreshed snapshot — SIMPLER binding: on any stock/visibility failure return `failure('cartChanged')`; the cart page tells the user to review (toast + reload of prices happens naturally since display is client-side). Documented.
  4. Server-side pricing: `effectivePriceMillimes(product.priceMillimes, product.discountPct, massDiscountPct)` per line (client prices IGNORED).
  5. Promo: when provided, `validatePromoCode` → invalid → `failure('validation', {promoCode: 'invalidPromo'})`.
  6. `computeCartTotals` with parameters; `totalMillimes > MAX_MILLIMES` → `failure('cartChanged')` (absurd).
  7. Session (optional): `auth()` → `clientId = session?.user.id ?? null` (any role may order; staff placing an order is harmless).
  8. Transaction: `order.create` (PENDING, customer fields, `promoCode` string or null, all money fields, `clientId`, items `createMany` with `nameSnapshot = nameFr` + `unitPriceMillimes` + `qty` + `lineTotalMillimes`) + `notification.create({type: 'NEW_ORDER', payload: {orderId, number, totalMillimes}})`. NO stock decrement (spec: CONFIRMED does that in Phase 4).
  9. `success({orderId: order.id})`.
- Cart page (client view): line items (thumb, locale name → link, unit price, qty stepper via `setQty`, line total, remove), promo input + apply (server action `checkPromo(code)` in the same actions.ts calling `validatePromoCode`, returns percentOff; applied code stored in cart-page state and passed to checkout via query `?promo=CODE`), totals panel computed with `computeCartTotals` (client import of the pure lib + parameters passed down from the server page incl. massDiscountPct + currency), free-delivery hint (`cart.freeDeliveryHint` with remaining amount when below threshold), CTA `Link` to `/checkout?promo=…`; empty-cart state with CTA to `/products`.
- Checkout page (server): reads `getParameters` + `getMassDiscountPct` + `auth()`; prefills name/phone/address/city from the session user when present; renders `checkout-form.tsx` with a read-only order summary (client-computed from cart + a server-priced… — display only; the action re-prices). On `placeOrder` success: `clear()` the cart, `router.push('/order-confirmation/' + orderId)`.
- Confirmation page (server): loads order by **id** (cuid; scalar-guard; `findUnique` + items); renders number (`#{number}`), items snapshot, totals, `confirmation.codNote`; unknown id → `notFound()`. No auth required (unguessable id; shows what the orderer just entered — acceptable; noted).

**i18n additions (both catalogs):** `cart.title` ("Panier" / "السلة"), `cart.empty` ("Votre panier est vide." / "سلتك فارغة."), `cart.browse` ("Voir les produits" / "تصفح المنتجات"), `cart.unitPrice` ("Prix" / "السعر"), `cart.lineTotal` ("Total" / "المجموع"), `cart.remove` ("Retirer" / "إزالة"), `cart.promoLabel` ("Code promo" / "كود التخفيض"), `cart.promoApply` ("Appliquer" / "تطبيق"), `cart.promoApplied` ("Code {code} appliqué (−{pct}%)." / "تم تطبيق الكود {code} (−{pct}%)."), `cart.promoInvalid` ("Code promo invalide." / "كود غير صالح."), `cart.subtotal` ("Sous-total" / "المجموع الفرعي"), `cart.promoDiscount` ("Remise" / "التخفيض"), `cart.delivery` ("Livraison" / "التوصيل"), `cart.deliveryFree` ("Gratuite" / "مجاني"), `cart.freeDeliveryHint` ("Plus que {amount} {currency} pour la livraison gratuite !" / "أضف {amount} {currency} للحصول على توصيل مجاني!"), `cart.total` ("Total" / "المجموع الكلي"), `cart.checkout` ("Passer la commande" / "إتمام الطلب"), `checkout.title` ("Commande" / "إتمام الطلب"), `checkout.name` ("Nom complet" / "الاسم الكامل"), `checkout.phone` ("Téléphone" / "الهاتف"), `checkout.address` ("Adresse" / "العنوان"), `checkout.city` ("Ville" / "المدينة"), `checkout.notes` ("Remarques (optionnel)" / "ملاحظات (اختياري)"), `checkout.payOnDelivery` ("Paiement à la livraison" / "الدفع عند الاستلام"), `checkout.placeOrder` ("Confirmer la commande" / "تأكيد الطلب"), `checkout.summary` ("Récapitulatif" / "ملخص الطلب"), `checkout.errors.required` ("Champ requis." / "حقل مطلوب."), `checkout.errors.invalidPhone` ("Numéro de téléphone invalide." / "رقم هاتف غير صالح."), `checkout.errors.tooShort` ("Trop court." / "قصير جداً."), `checkout.errors.tooLong` ("Trop long." / "طويل جداً."), `checkout.errors.invalidPromo` ("Code promo invalide." / "كود غير صالح."), `checkout.errors.cartChanged` ("Votre panier a changé (stock ou produits). Vérifiez-le puis réessayez." / "تغيّرت سلتك (المخزون أو المنتجات). راجعها ثم أعد المحاولة."), `checkout.errors.validation` ("Veuillez corriger les champs en rouge." / "يرجى تصحيح الحقول المحددة بالأحمر."), `confirmation.title` ("Merci pour votre commande !" / "شكراً لطلبك!"), `confirmation.number` ("Commande n° {number}" / "طلب رقم {number}"), `confirmation.codNote` ("Vous paierez à la livraison. Nous vous contacterons pour confirmer." / "ستدفع عند الاستلام. سنتصل بك للتأكيد."), `confirmation.backHome` ("Retour à l'accueil" / "العودة إلى الرئيسية").

- [ ] TDD the schema keys; implement action + pages; verify with a throwaway HTTP-less integration script for `placeOrder` internals is NOT possible (server action needs request context for auth()) — instead: (a) unit-test totals already done; (b) live verification via curl is impractical for actions → the click-path is Task 11's e2e; (c) statically verify + `npm run build`; (d) verify the confirmation page over HTTP with a fixture order created via a throwaway prisma script (customerName 'E2E TMP', hard-deleted after). Gates; commit `feat: add cart, checkout with server-side order creation, and confirmation`.

---

### Task 11: Storefront e2e + phase gates

**Files:**
- Create: `e2e/storefront.spec.ts`
- Modify: `e2e/cleanup.ts` (also delete Orders/OrderItems with `customerName` starting `E2E ` and Notifications whose payload references them — simplest: delete notifications where `type='NEW_ORDER'` AND the joined order is an E2E fixture; delete order items via order relation)

**Spec (serial, reusing the login helper and idioms):**
1. Guest browses: home shows ≥1 section with cards → click a card → product page → add to cart ×2 → badge shows 2.
2. Search: type a seed product prefix in the header search → suggestion appears → click → product page (and searchHits incremented is NOT asserted — heuristic).
3. Cart: `/fr/cart` shows lines; set qty; apply promo `BIENVENUE10` → applied message with −10%; totals visible; free-delivery hint behavior sanity (any of hint/free line visible).
4. Checkout: fill guest form (name 'E2E Client', phone '21612345678', address, city) → place order → confirmation page shows an order number; cart badge back to 0.
5. Post-check via UI only; DB fixture cleanup handled by cleanup.ts (E2E orders).
Run twice consecutively (repeatability). Then the full phase gates: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run test:e2e` (BOTH spec files green), `npx prisma migrate status`.

- [ ] Implement; run twice; gates; commit `test: add storefront e2e journey`.

---

## Phase 3 exit criteria

- Home renders the four spec sections from live data in both locales; search suggestions work with locale-aware names; catalog filters (category/subcategory, price range, availability), sort, and pagination are URL-driven and RTL-correct; product pages show gallery, discount pricing (mass-discount-aware), stock state, and related products.
- Cart persists across reloads, supports qty/remove/promo; checkout creates a PENDING order with server-side re-pricing, stock validation, promo triple-check (archived+active+expiry), bounded totals, snapshot items, optional clientId, and a NEW_ORDER notification row — stock is NOT decremented.
- Confirmation page addressable only by order cuid. Language switcher preserves query strings. Seed images are real webp served by `/api/uploads/…`.
- All gates green: unit suites, tsc, build, both e2e specs (admin + storefront) twice, migrations up to date.
