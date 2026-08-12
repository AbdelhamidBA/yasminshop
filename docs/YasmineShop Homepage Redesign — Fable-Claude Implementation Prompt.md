# YasmineShop Homepage Redesign

## Objective

Redesign the existing YasmineShop ecommerce homepage to match the provided visual reference and the YasmineShop brand identity.

The design direction is:

- Elegant
- Premium but approachable
- Warm
- Minimal
- Modern ecommerce
- Inspired by the provided beige/cream fashion ecommerce reference
- Strong use of the YasmineShop champagne-gold branding
- Product-focused rather than overly decorative

**IMPORTANT:** This is an existing ecommerce project. Do NOT rebuild the application from scratch.

First inspect the existing project structure, components, styling system, data models, product system, routing, and existing homepage implementation.

Modify and extend the existing architecture wherever possible.

Do not break existing functionality.

---

# 1. Brand Color System

Use the following palette consistently throughout the homepage.

### Primary Colors

```text
Background:
#F6F1E7

White Surface:
#FFFFFF

Soft Beige:
#E9DFCA

Warm Beige:
#DCC7A1

Primary Gold:
#C5A052

Deep Gold:
#A6843C

Deep Brown:
#6E5A3A

Primary Text:
#33302B

Secondary Text:
#8E877A
```

### Color philosophy

Do NOT make the entire website gold.

The hierarchy should approximately feel like:

- 70–80% cream / white
- 15–20% beige
- 5–10% gold/brown accents

Gold should be used for:

- Primary CTA buttons
- Hover states
- Prices where appropriate
- Active navigation indicators
- Wishlist icons on hover/active
- Small decorative accents
- Section links
- Important ecommerce indicators
- Badges
- Cart quantity indicator

The website should feel sophisticated and warm rather than flashy.

---

# 2. YasmineShop Logo

Use the existing YasmineShop logo asset from the project from here : https://github.com/AbdelhamidBA/yasminshop/blob/main/YasmineShopLogo.png

The logo contains:

- A golden shopping bag
- Rope handles
- White/gold "y" symbol
- YASMINE SHOP branding

Do not redesign the logo.

The logo should be displayed prominently in the desktop navbar.

On mobile, use an appropriate responsive version while maintaining the same brand identity.

---

# 3. Overall Homepage Structure

The homepage should follow this structure:

```text
Announcement / Service Bar
        ↓
Navbar
        ↓
Static Hero Section
        ↓
Categories Navigation
        ↓
MEILLEURES VENTES
        ↓
NOUVEAUX PRODUITS
        ↓
DERNIÈRE CHANCE
        ↓
LE PLUS RECHERCHÉ
        ↓
Footer
```

There should NOT be an additional promotional service section between the product sections and footer.

---

# 4. CHANGE 1 — HERO SECTION

## Remove carousel behavior

The hero section must NOT be a carousel.

Remove:

- Previous arrow
- Next arrow
- Carousel controls
- Slide indicators
- Automatic slide transitions
- Any carousel-specific interaction

The hero should be a single static promotional section.

Keep the overall visual style of the current design.

### Hero visual direction

Use:

- Warm cream/beige background
- Elegant ecommerce imagery
- YasmineShop shopping bag / imported-product visual identity
- Large editorial typography
- Gold CTA
- Lots of whitespace
- Premium photography

Suggested content:

### Heading

```text
Des produits uniques
venus du monde entier
```

### Description

```text
Découvrez une sélection soigneusement
choisie pour votre quotidien.
```

### CTA

```text
DÉCOUVRIR LA BOUTIQUE
```

The CTA should use:

```text
background: #C5A052
color: #FFFFFF
```

Hover:

```text
background: #A6843C
```

The hero should feel visually rich without becoming cluttered.

---

# 5. CHANGE 2 — SMART CATEGORY NAVIGATION

Remove the illustrated category icons.

Do NOT create placeholder icons.

Do NOT assume what categories the store owner will eventually use.

The category system needs to be **data-driven and dynamic**.

## Category design

Create a clean category navigation area below the hero.

Example visual:

```text
PARCOURIR PAR CATÉGORIES

[ Toutes ] [ Beauté ] [ Maison ] [ Électronique ] [ Mode ] [ ... ]
```

However, the actual categories must come from the application's category data.

Do NOT hardcode:

```text
Beauté
Maison
Électronique
Mode
Enfants
Sport
```

Those are only visual examples.

If the database/API already contains categories, use those.

If there are currently no categories, the component should gracefully handle that state.

### Desktop

Display categories horizontally as elegant text-based pills/tabs.

Example:

```text
Toutes
Électronique
Maison
Beauté
Mode
Accessoires
...
```

Use:

- Cream/white background
- Thin subtle borders
- Gold active state
- Dark brown text

Active category:

```text
background: #C5A052
color: #FFFFFF
```

Inactive category:

```text
background: #E9DFCA
color: #33302B
```

### Mobile

The category navigation should become horizontally scrollable.

Do NOT create a huge vertical list.

Example:

```text
← Toutes | Maison | Beauté | Mode | ...
```

The horizontal scrolling should feel smooth and intentional.

---

# 6. CHANGE 3 — MEILLEURES VENTES

Remove the left-side:

```text
NOUVELLE COLLECTION
```

promotional poster completely.

There should no longer be a split layout.

Instead, the "MEILLEURES VENTES" section should occupy the **entire available content width**.

### Layout

Use a clean product grid.

Desktop:

```text
MEILLEURES VENTES                         Voir tout

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Product │ │ Product │ │ Product │ │ Product │
│   IMG   │ │   IMG   │ │   IMG   │ │   IMG   │
│         │ │         │ │         │ │         │
│ Name    │ │ Name    │ │ Name    │ │ Name    │
│ Price   │ │ Price   │ │ Price   │ │ Price   │
│ Rating  │ │ Rating  │ │ Rating  │ │ Rating  │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

The grid should use the full container width.

Do not introduce a promotional poster beside the products.

---

# 7. CHANGE 4 — REPLACE THE FINAL SERVICE SECTION

Remove the entire existing section containing:

```text
SERVICE CLIENT
OFFRE SPÉCIALE
PAIEMENT À LA LIVRAISON
LIVRAISON RAPIDE
```

Do not keep those four cards on the homepage.

Replace that entire area with three additional product sections.

---

# 8. SECTION — NOUVEAUX PRODUITS

Create a full-width product section:

```text
NOUVEAUX PRODUITS                         Voir tout
```

Use the same product-card design as "MEILLEURES VENTES".

This section should display products determined by the application's product data.

Do not create a completely separate product-card implementation.

Reuse the same reusable product-card component.

---

# 9. SECTION — DERNIÈRE CHANCE

Create:

```text
DERNIÈRE CHANCE                         Voir tout
```

This section should represent products that are:

- On sale
- Low stock
- Limited availability
- Near the end of their promotion

Use whatever existing product fields/data are available.

IMPORTANT:

Do not invent a new database system just for this section if the current project already has suitable product fields.

Inspect the existing schema first.

If the existing data model supports sale/stock information, use it.

If there is no suitable field, create the smallest clean abstraction necessary.

---

# 10. SECTION — LE PLUS RECHERCHÉ

Create:

```text
LE PLUS RECHERCHÉ                         Voir tout
```

This section should represent popular / frequently viewed / frequently searched products.

Use existing analytics/popularity information if the application already has it.

If no popularity data exists yet, create a clean fallback based on existing product information rather than introducing unnecessary complexity.

The section must still look correct when real data is eventually connected.

---

# 11. PRODUCT CARD DESIGN

All four sections should use the same reusable product-card component.

The card should contain:

```text
Product Image
Wishlist Button
Optional Badge
Product Name
Price
Optional Previous Price
Rating
```

Example:

```text
┌───────────────────────────┐
│                           │
│                           │
│       PRODUCT IMAGE       │
│                           │
├───────────────────────────┤
│ Product Name              │
│ 89,900 DT                 │
│ CTA │ add to cart         |
└───────────────────────────┘
```

### Card style

Background:

```text
#FFFFFF
```

Image background:

```text
#F6F1E7
```

Primary text:

```text
#33302B
```

Price:

```text
#6E5A3A
```

Stars/accent:

```text
#C5A052
```

Wishlist:

```text
#A6843C
```

Use subtle borders/shadows.

Avoid heavy shadows.

The overall product cards should feel clean and premium.

---

# 12. SECTION HEADER DESIGN

Every product section should use the same reusable section-header component.

Example:

```text
MEILLEURES VENTES                              Voir tout
────────────────────────────────────────────────────────
```

The title should be uppercase or strong editorial typography.

The "Voir tout" link should be gold.

On hover:

```text
color: #A6843C
```

Add a subtle underline animation if appropriate.

Do not make the headers visually oversized.

---

# 13. RESPONSIVE DESIGN

The design must work beautifully on:

- Desktop
- Laptop
- Tablet
- Mobile

### Desktop

Product grid:

```text
4 products per row
```

### Tablet

Approximately:

```text
2–3 products per row
```

depending on available width.

### Mobile

Use:

```text
2 products per row
```

if the existing design supports it comfortably.

Otherwise use a clean single-column or horizontal product layout depending on the existing ecommerce architecture.

The hero must resize naturally.

The navbar must become a proper mobile navigation.

Categories should become horizontally scrollable.

Do not allow horizontal page overflow.

---

# 14. SPACING AND VISUAL STYLE

The reference design has generous spacing.

Use:

- Large section spacing
- Generous horizontal padding
- Clean product grids
- Subtle separators
- Rounded corners only where appropriate
- Minimal shadows
- Editorial typography

Do NOT make the interface look like a generic dashboard.

This is a consumer ecommerce storefront.

Avoid:

- Excessive cards
- Excessive borders
- Strong gradients
- Neon colors
- Excessive rounded UI
- Excessive animations
- Excessive gold
- Decorative icons that don't have a purpose

---

# 15. ANIMATIONS

Keep animations subtle.

Recommended:

### Product cards

On hover:

- Slight image scale
- Very subtle elevation
- Wishlist transition

### Buttons

Small color transition.

### Section links

Subtle underline transition.

### Hero

No carousel animation.

No automatic movement.

The hero is completely static.

Animations must never interfere with shopping or usability.

---

# 16. DATA / COMPONENT ARCHITECTURE

Keep the implementation modular.

Do not duplicate product-card markup four times.

Prefer something conceptually similar to:

```text
Homepage
 ├── AnnouncementBar
 ├── Navbar
 ├── HeroSection
 ├── CategoryNavigation
 ├── ProductSection
 │    └── ProductCard
 ├── ProductSection
 │    └── ProductCard
 ├── ProductSection
 │    └── ProductCard
 ├── ProductSection
 │    └── ProductCard
 └── Footer
```

The `ProductSection` should accept:

```text
title
products
viewAllLink
```

or the equivalent structure appropriate for the existing codebase.

Example conceptual usage:

```text
<ProductSection
    title="MEILLEURES VENTES"
    products={bestSellingProducts}
/>

<ProductSection
    title="NOUVEAUX PRODUITS"
    products={newProducts}
/>

<ProductSection
    title="DERNIÈRE CHANCE"
    products={lastChanceProducts}
/>

<ProductSection
    title="LE PLUS RECHERCHÉ"
    products={mostSearchedProducts}
/>
```

Do not necessarily use these exact component names if the existing architecture already has an equivalent system.

Reuse existing architecture whenever possible.

---

# 17. IMPORTANT — DO NOT BREAK EXISTING FUNCTIONALITY

Before changing anything:

1. Inspect the existing homepage.
2. Inspect product fetching.
3. Inspect category fetching.
4. Inspect authentication-dependent functionality.
5. Inspect cart functionality.
6. Inspect wishlist functionality.
7. Inspect product routing.
8. Inspect existing responsive behavior.
9. Inspect the existing design system/components.
10. Inspect the existing database schema if relevant.

Then implement the redesign using the existing architecture.

Do NOT:

- Remove existing ecommerce functionality.
- Replace the database.
- Replace the authentication system.
- Rewrite product logic unnecessarily.
- Create fake API systems.
- Hardcode product data when real product data already exists.
- Hardcode categories.
- Remove cart functionality.
- Remove wishlist functionality.
- Remove existing product links.

---

# 18. Empty / Missing Data States

The homepage must remain visually stable if a section has fewer products.

For example, if:

```text
NOUVEAUX PRODUITS
```

has only 2 products, do not create fake products.

Display the available products cleanly.

If a section has no products at all, either:

- hide the section, or
- display an elegant empty state,

depending on what best fits the existing application architecture.

Do not display fake placeholder products in production.

---

# 19. Final Visual Target

The final homepage should visually communicate:

```text
YasmineShop
        ↓
Imported products
        ↓
Premium but affordable
        ↓
Warm / trustworthy
        ↓
Clean ecommerce experience
```

The visual relationship should be:

```text
CREAM / WHITE
       ↓
BEIGE
       ↓
GOLD
       ↓
BROWN
```

The YasmineShop logo should feel naturally integrated into the interface.

The website should look like a **real premium ecommerce store**, not a UI template.

---

# 20. Final Homepage Layout

The final result should approximately look like:

```text
┌───────────────────────────────────────────────────────┐
│              ANNOUNCEMENT / SERVICE BAR               │
├───────────────────────────────────────────────────────┤
│ LOGO       Accueil Boutique Nouveautés ...    🛒      │
├───────────────────────────────────────────────────────┤
│                                                       │
│                  HERO SECTION                         │
│                                                       │
│       Des produits uniques                            │
│       venus du monde entier                           │
│                                                       │
│       [ DÉCOUVRIR LA BOUTIQUE ]                       │
│                                                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│              PARCOURIR PAR CATÉGORIES                 │
│                                                       │
│ [Toutes] [Category] [Category] [Category] [...]      │
│                                                       │
├───────────────────────────────────────────────────────┤
│ MEILLEURES VENTES                         Voir tout   │
│                                                       │
│ [Product] [Product] [Product] [Product]               │
│                                                       │
├───────────────────────────────────────────────────────┤
│ NOUVEAUX PRODUITS                         Voir tout   │
│                                                       │
│ [Product] [Product] [Product] [Product]               │
│                                                       │
├───────────────────────────────────────────────────────┤
│ DERNIÈRE CHANCE                           Voir tout   │
│                                                       │
│ [Product] [Product] [Product] [Product]               │
│                                                       │
├───────────────────────────────────────────────────────┤
│ LE PLUS RECHERCHÉ                         Voir tout   │
│                                                       │
│ [Product] [Product] [Product] [Product]               │
│                                                       │
├───────────────────────────────────────────────────────┤
│                         FOOTER                        │
└───────────────────────────────────────────────────────┘
```

## Final instruction

Implement the redesign directly in the existing project.

Prioritize:

1. Visual consistency
2. Reusability
3. Responsive behavior
4. Existing functionality
5. Data-driven categories/products
6. Clean ecommerce UX

Do not stop at creating a static visual mockup.

The final implementation must be functional with the project's existing product, category, cart, wishlist, and routing systems.