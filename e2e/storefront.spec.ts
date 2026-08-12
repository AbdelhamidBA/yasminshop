import {expect, test, type Page} from '@playwright/test';

// The storefront journey is ONE continuous guest session: the cart lives in
// localStorage, so the four serial tests share a single page/context — the
// default per-test isolation would empty the cart between steps. All flows
// use SEED data only; the order placed in the last test is the DB fixture,
// deleted by e2e/cleanup.ts (customerName prefix 'E2E ').
test.describe.configure({mode: 'serial'});

let page: Page;

test.beforeAll(async ({browser}) => {
  // In @playwright/test this inherits the config's context options (baseURL,
  // locale) — relative goto() paths below resolve against localhost:3000.
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

// Header cart BUTTON (aria-label common.cart) — a drawer trigger since Phase
// 7, no longer a /cart link. Its only text content is the count bubble, so
// toHaveText asserts the badge count ('' when empty). exact:true keeps the
// locator unambiguous while the drawer (aria-label 'Votre panier') is open.
const cartBadge = () => page.getByLabel('Panier', {exact: true});

test('guest browses home to a product and adds it to the cart twice', async () => {
  await page.goto('/fr');
  // Phase 8 grid sections: "Meilleures ventes" (real best-sellers, topped up
  // with featured products while the seed DB has few sales) leads, then
  // "Nouveaux produits" (renamed from "Nouveautés"). Titles are uppercased by
  // CSS only — getByRole name matching is case-insensitive.
  await expect(page.getByRole('heading', {name: 'Meilleures ventes'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Nouveaux produits'})).toBeVisible();

  // Card quick-add is present (aria-label interpolates the product name, so
  // it can never collide with the product page's exact 'Ajouter au panier').
  await expect(
    page.getByRole('button', {name: 'Ajouter Casque sans fil au panier'}).first()
  ).toBeVisible();

  // All seed products appear in "Nouveaux produits"; pick a known IN-STOCK
  // one by name (a card link's accessible name includes the product name).
  // It may also sit in other sections — first() stays stable.
  await page.getByRole('link', {name: 'Casque sans fil'}).first().click();
  await page.waitForURL('**/fr/products/casque-sans-fil');
  await expect(page.getByRole('heading', {name: 'Casque sans fil'})).toBeVisible();

  // Two clicks with the stepper at 1 → the reducer merges into one line, qty 2.
  // Since Phase 7 every add opens the cart drawer as feedback; it is modal, so
  // dismiss it (Escape) before the second click can reach the button.
  const addToCart = page.getByRole('button', {name: 'Ajouter au panier'});
  const drawer = page.getByRole('dialog', {name: 'Votre panier'});
  await addToCart.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Casque sans fil')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await addToCart.click();
  await expect(drawer).toBeVisible();

  // The drawer's "Voir le panier" CTA is the journey's new path to /cart (the
  // header cart control opens the drawer instead of linking there).
  await drawer.getByRole('link', {name: 'Voir le panier'}).click();
  await page.waitForURL('**/fr/cart');
  await expect(cartBadge()).toHaveText('2');
});

test('header search suggestion navigates to the product page', async () => {
  await page.goto('/fr');
  // The search box lives inside a popover behind the header's icon-only
  // search button. Retry the click idempotently (only while the combobox is
  // not visible): a click landing before the Base UI trigger hydrates opens
  // nothing, and an open popover must never be toggled shut.
  const searchInput = page.getByRole('combobox', {name: 'Rechercher'});
  await expect(async () => {
    if (!(await searchInput.isVisible())) {
      await page.getByRole('button', {name: 'Rechercher'}).click();
    }
    await expect(searchInput).toBeVisible({timeout: 1500});
  }).toPass({timeout: 20_000});
  await searchInput.fill('casque');
  // Debounced fetch → listbox option; clicking records a search hit
  // (fire-and-forget, NOT asserted — heuristic) and navigates.
  await page.getByRole('option', {name: 'Casque sans fil'}).click();
  await page.waitForURL('**/fr/products/casque-sans-fil');
  await expect(page.getByRole('heading', {name: 'Casque sans fil'})).toBeVisible();
});

test('cart supports quantity changes and the BIENVENUE10 promo', async () => {
  await page.goto('/fr/cart');
  const line = page.getByRole('listitem').filter({hasText: 'Casque sans fil'});
  await expect(line).toBeVisible();
  await expect(line.getByText('2', {exact: true})).toBeVisible();

  // Stepper: 2 → 3; the badge follows.
  await line.getByRole('button', {name: '+', exact: true}).click();
  await expect(line.getByText('3', {exact: true})).toBeVisible();
  await expect(cartBadge()).toHaveText('3');

  await page.getByLabel('Code promo').fill('BIENVENUE10');
  await page.getByRole('button', {name: 'Appliquer'}).click();
  await expect(page.getByText('Code BIENVENUE10 appliqué (−10%).')).toBeVisible();

  // Totals panel: subtotal, the −10% promo line, delivery, and the
  // free-delivery sanity — exactly one of the free label or the
  // remaining-amount hint shows, depending on the discounted subtotal.
  const totals = page.locator('aside');
  await expect(totals.getByText('Sous-total')).toBeVisible();
  await expect(totals.getByText('Remise')).toBeVisible();
  await expect(totals.getByText('Livraison')).toBeVisible();
  await expect(
    totals.getByText('Gratuite').or(totals.getByText(/livraison gratuite/))
  ).toBeVisible();
});

test('guest checkout places the order and empties the cart', async () => {
  // Continues straight from the cart page: the applied promo is client state
  // that the CTA link carries to checkout as ?promo=… (a reload would drop it).
  await page.getByRole('link', {name: 'Passer la commande'}).click();
  await page.waitForURL('**/fr/checkout?promo=BIENVENUE10');
  await expect(page.getByText('(BIENVENUE10)')).toBeVisible();

  await page.getByLabel('Nom complet').fill('E2E Client');
  await page.getByLabel('Téléphone').fill('21612345678');
  await page.getByLabel('Adresse').fill('12 rue des Tests');
  await page.getByLabel('Ville').fill('Tunis');
  await page.getByRole('button', {name: 'Confirmer la commande'}).click();

  // placeOrder → PENDING order + snapshot items + notification, then the
  // client redirects to the cuid-addressed confirmation and clears the cart.
  await page.waitForURL(/\/fr\/order-confirmation\/[a-z0-9-]+/i);
  await expect(
    page.getByRole('heading', {name: 'Merci pour votre commande !'})
  ).toBeVisible();
  await expect(page.getByText(/Commande n° \d+/)).toBeVisible();
  await expect(page.getByText(/Casque sans fil\s*×3/)).toBeVisible();

  // Money-value gate (spec §6d): the total row shows the exact frozen figure —
  // 89.000 ×3 = 267.000, −10% (BIENVENUE10) = 240.300, delivery free above
  // the 100 DT threshold. Guards the server-side pricing math end to end.
  const totalRow = page
    .locator('dl > div')
    .filter({has: page.getByText('Total', {exact: true})});
  await expect(totalRow).toContainText('240.300 TND');

  await expect(cartBadge()).toHaveText('');
});
