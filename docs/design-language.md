# YasmineShop storefront design language

The reference implementation is the product page
(`src/app/[locale]/(storefront)/products/[slug]/page.tsx`) and the primitives
in `src/components/storefront/brand.tsx`. Read both before designing a new
surface.

## The idea

YasmineShop is not a luxury brand — it is a **trust** business. Customers hand
cash to a stranger at their door for goods they have only seen on a screen.
The visual language therefore comes from the physical artifacts of
cash-on-delivery commerce: **the delivery note, the dotted receipt line, and
the shop's stamp (cachet)** — the marks that say *this is a real shop*.

## Fixed by the owner's brief — do not change

- Palette: cream `#F6F1E7`, white surfaces, soft beige `#E9DFCA`, gold
  `#C5A052`, deep gold `#A6843C` (hover/ring), deep brown `#6E5A3A`
  (`--brand-brown`, prices), ink `#33302B`, muted `#8E877A`. Always via
  tokens, never raw hex in components.
- Gold stays a 5–10% accent: CTAs, hover, active state, badges, cart count.
- Typefaces: Baloo 2 everywhere (`.theme-yasmine` scope); Betterlett is the
  header wordmark only.
- Corners: `rounded-lg`. Circles only for count bubbles and status dots.

## Type roles

Baloo 2 carries all three; the roles are what make it read as designed rather
than defaulted.

| Role | Setting | Used for |
| --- | --- | --- |
| Display | `font-extrabold`, tight leading (`leading-none` / `leading-[1.1]`) | Page titles, prices, slip totals |
| Body | `font-normal`, `leading-[1.75]`, max `68ch` | Descriptions, prose |
| Utility | `Eyebrow`: 11px, medium, uppercase, `tracking-[0.18em]` | Section headings, meta, stock, slip labels |

Prices are the hero data of a shop: set them in the display role, in
`--brand-brown`, with `tabular-nums`.

**Letter-spacing breaks joined Arabic.** Every tracked/uppercase treatment is
gated: `tracked={!isAr}` on the primitives, `!isAr && 'uppercase tracking-…'`
inline.

## Primitives (`@/components/storefront/brand`)

- `Eyebrow` — the utility face. Section headings are an `Eyebrow` inside the
  `<h2>`, followed by a hairline: `<span className="h-px flex-1 bg-border" />`.
- `Stamp` — the cachet. Rotated `-3.5deg`, double-ruled, brown. Carries the
  pay-on-delivery promise as **readable text**. At most one per surface, only
  where hesitation peaks.
- `Slip` + `SlipRow` — the delivery note. `Slip` has a torn bottom edge
  (`.y-slip` in `globals.css`); `SlipRow` sets a label, a dotted leader and a
  value the way a printed receipt does. Use for order/cart totals.

## Layout

- Container `max-w-6xl px-4`. Section rhythm `mt-16` between major blocks.
- Prefer asymmetry to a 50/50 split: the product page runs a 7/5 grid with a
  `lg:sticky lg:top-24` decision panel.
- One decisive full-width CTA beats a CTA sitting inline beside a control.

## Honesty rules (binding, from earlier phases)

No star ratings, no wishlist, no invented delivery times, no fabricated stock
urgency, no fake testimonials — none of these have a data model. Stock claims
come from the real `quantity` against the owner's `lastChanceThreshold`. The
homepage lifecycle band shows the three real `OrderStatus` stages.

## Quality floor

Responsive to 360px with no horizontal page overflow; RTL via logical
properties (`ms-/me-/ps-/pe-/start-/end-`); dark mode via tokens; visible
keyboard focus; `prefers-reduced-motion` respected; every string in both
`messages/fr.json` and `messages/ar.json` (parity is test-enforced).
