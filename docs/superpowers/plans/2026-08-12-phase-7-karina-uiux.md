# Phase 7: Karina-inspired UI/UX Enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Implemented idioms authoritative. User directive (2026-08-12): "inspire from https://karina.tn and enhance UI/UX: cards, menu, hero section, product details carousel, add sliders, make the 'panier' as side menu — analyse and execute."

**Goal:** Elevate the storefront UI/UX with the design language of karina.tn (Tunisian cosmetics brand): airy white/cream surfaces, generous whitespace, rounded-soft imagery and cards, pastel/warm accents, subtle uppercase micro-labels, and carousels as the primary browsing gesture — while keeping every existing feature, locator, and constraint intact.

## Design language extracted from karina.tn (2026-08-12 analysis)

- Palette: white/cream backgrounds, black primary text, warm gold accent flourishes (✦), pastel product-imagery tones. Map onto the EXISTING theme tokens (do not hardcode hex; tune tokens only if needed and keep dark mode coherent).
- Generous section whitespace; rounded (rounded-2xl-ish) imagery and cards; soft shadows; mix of regular + uppercase micro-labels.
- Announcement bar above the header; logo left; category nav with dropdowns; mobile bottom navbar (Accueil / Recherche / Shop / Compte).
- Homepage = a rhythm of full-bleed hero carousel → CTA pair → themed product carousels → tiered free-shipping banner → newsletter-ish closing → rich footer.
- Cart opens as a side drawer (standard for this genre; explicit user ask: "panier as side menu").

## Global Constraints (carried from Phases 1–6 — all binding)

- Docker Postgres is the only DB; reuse the dev server on :3000; `touch next.config.ts` after i18n/config edits. Seeds + manual order #1 never mutated. e2e fixtures E2E-/e2e- prefixed only.
- FR default + AR RTL: every new key in BOTH catalogs (parity test), real Arabic. Logical CSS properties only. Carousels must support RTL (embla `direction: 'rtl'` wired from locale).
- Money = integer millimes via existing helpers. Theme tokens only (dark-mode safe). No fake affordances: NO ratings, wishlist/favoris, compare, share, testimonials with invented numbers, or newsletter form without a backend — reuse honest content only (trust badges, real categories, real products, real parameters).
- Allowed new deps: `embla-carousel-react` + `embla-carousel-autoplay` (the shadcn-standard carousel engine) — nothing else without strong justification.
- Every task: tsc + npm test + build + FULL e2e green before its single conventional commit (+ Claude trailer). e2e locator changes only in the same commit, justified.
- The /cart page and /checkout flow MUST keep working (the drawer complements, not replaces, the cart page).

### Task 1: Header/menu enhancement + announcement bar + cart side-drawer (panier)

- Announcement bar above the header: honest static i18n message (e.g. livraison partout en Tunisie / paiement à la livraison) — no invented thresholds unless read from real parameters.
- Desktop nav: categories dropdown menus (roots + subcategories from `listVisibleCategoryTree()`) linking to `/products?cat=&sub=`; refined logo/actions row; keep search + locale/theme switches + auth links working.
- Mobile: improved menu; OPTIONAL karina-style bottom navbar (Accueil / Recherche / Panier / Compte — real destinations only, no Favoris since wishlist doesn't exist).
- CART SIDE-DRAWER: clicking the header cart icon opens a slide-over panel (Base UI Dialog styled as a sheet, from the inline-end side, RTL-aware) with line items (thumb, name, qty stepper, remove), subtotal (millimes), and CTAs "Voir le panier" (/cart) + "Commander" (/checkout). Adding to cart opens the drawer (feedback loop). The /cart page remains the full-cart + promo surface. Update e2e in the SAME commit where the journey changes (e.g. storefront spec now: add-to-cart → drawer → "Voir le panier" → /cart continues unchanged).
- Commit `feat: header menu, announcement bar and cart drawer`.

### Task 2: Home hero slider + section sliders + product-card restyle

- HERO: embla autoplay carousel (2–4 slides built from real featured/newest products + honest promo copy), dots + arrows, RTL direction, reduced-motion respected, karina-esque airy composition with big type + CTA per slide.
- SECTION SLIDERS: convert the four home product sections (Nouveautés / Vedettes / Dernière chance / Les plus recherchés) into horizontal embla carousels with nav arrows (grid fallback fine at large widths if cleaner) — cards remain real links; 'Nouveautés' heading + first-card locator must keep resolving for e2e.
- PRODUCT CARDS: karina-soft restyle — rounded-2xl, soft shadow/hover lift, pastel image backdrop (token-based), refined price + existing discount badge, uppercase micro-category label if cheap. No wishlist/rating additions.
- Keep trust badges + category tiles sections; adjust rhythm/whitespace toward karina's airy feel.
- Commit `feat: hero slider, section carousels and card restyle`.

### Task 3: Product-details gallery carousel + related-products slider + polish

- GALLERY: embla-powered main-image carousel with swipe + synced thumb strip (only when >1 real image; single image stays static), rounded-soft frame, RTL-aware arrows.
- RELATED PRODUCTS: horizontal slider using the restyled cards.
- Polish: qty + add-to-cart row (add-to-cart now also opens the drawer), Description section rhythm, breadcrumb spacing — keep all Task-5(P6) a11y labels and locators (add-to-cart text, stepper +/−, h1 title).
- Commit `feat: product gallery carousel and related slider`.

### Task 4: Final verification + merge

- Full gates: tsc, unit suite, build, e2e ×2 both green; parity; migrate status clean (no schema changes expected).
- Whole-branch review (no secrets, no locator/authz/money regressions, no fake affordances, RTL/dark verified) → merge `phase-7-karina-uiux` → main → push.

## Exit criteria

Announcement bar + dropdown category menu + (optional) mobile bottom nav; cart drawer as the panier surface with /cart intact; autoplay hero carousel; section + related sliders; karina-soft cards and gallery carousel; RTL + dark + i18n parity hold; all e2e green ×2; merged + pushed.
