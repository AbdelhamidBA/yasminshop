import {expect, test, type Page} from '@playwright/test';
import {E2E_PRODUCTS, E2E_PROMO} from './fixture-data';

// The storefront journey is ONE continuous guest session: the cart lives in
// localStorage, so the four serial tests share a single page/context — the
// default per-test isolation would empty the cart between steps. All flows
// use the suite-owned FIXTURES only (e2e/fixture-data.ts) — never the owner's
// catalog; the order placed in the last test is the DB fixture, deleted by
// e2e/cleanup.ts (customerName prefix 'E2E ').
test.describe.configure({mode: 'serial'});

const CASQUE = E2E_PRODUCTS.casque;

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

test('guest browses home to a fixture product and adds it to the cart twice', async () => {
  await page.goto('/fr');
  // Owner-curation-independent home assertions: the hero (always rendered)
  // and the 'Meilleures ventes' NAV link (always in the header). The
  // 'Meilleures ventes' SECTION itself is honestly data-dependent (real
  // sales topped up with owner-flagged featured products) and hides when
  // empty — its presence is deliberately NOT asserted.
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  await expect(
    page
      .getByRole('navigation', {name: 'Navigation principale'})
      .getByRole('link', {name: 'Meilleures ventes'})
  ).toBeVisible();

  // 'Nouveaux produits' is createdAt-desc and always populated while ANY
  // active product exists; the fixtures were created at suite start, so they
  // are the newest products and are guaranteed inside this grid (8 slots).
  // Scope every product locator to the section (role=region via aria-label)
  // — the same card may also appear in other sections.
  const newest = page.getByRole('region', {name: 'Nouveaux produits'});
  await expect(newest.getByRole('heading', {name: 'Nouveaux produits'})).toBeVisible();

  // Card quick-add is present (aria-label interpolates the product name, so
  // it can never collide with the product page's exact 'Ajouter au panier').
  await expect(
    newest.getByRole('button', {name: `Ajouter ${CASQUE.nameFr} au panier`})
  ).toBeVisible();

  // Navigate from the fixture's card (a card link's accessible name includes
  // the product name).
  await newest.getByRole('link', {name: CASQUE.nameFr}).first().click();
  await page.waitForURL(`**/fr/products/${CASQUE.slug}`);
  await expect(page.getByRole('heading', {name: CASQUE.nameFr})).toBeVisible();

  // Two clicks with the stepper at 1 → the reducer merges into one line, qty 2.
  // Since Phase 7 every add opens the cart drawer as feedback; it is modal, so
  // dismiss it (Escape) before the second click can reach the button.
  const addToCart = page.getByRole('button', {name: 'Ajouter au panier'});
  const drawer = page.getByRole('dialog', {name: 'Votre panier'});
  await addToCart.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(CASQUE.nameFr)).toBeVisible();
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
  // 'E2E Casque' can only match the fixture (owner products never carry the
  // 'E2E ' name prefix), keeping the suggestion unambiguous.
  await searchInput.fill('E2E Casque');
  // Debounced fetch → listbox option; clicking records a search hit
  // (fire-and-forget, NOT asserted — heuristic) and navigates.
  await page.getByRole('option', {name: CASQUE.nameFr}).click();
  await page.waitForURL(`**/fr/products/${CASQUE.slug}`);
  await expect(page.getByRole('heading', {name: CASQUE.nameFr})).toBeVisible();
});

test(`cart supports quantity changes and the ${E2E_PROMO.code} promo`, async () => {
  await page.goto('/fr/cart');
  const line = page.getByRole('listitem').filter({hasText: CASQUE.nameFr});
  await expect(line).toBeVisible();
  await expect(line.getByText('2', {exact: true})).toBeVisible();

  // Stepper: 2 → 3; the badge follows.
  await line.getByRole('button', {name: '+', exact: true}).click();
  await expect(line.getByText('3', {exact: true})).toBeVisible();
  await expect(cartBadge()).toHaveText('3');

  // Suite-owned promo fixture (10%), created by e2e/fixtures.ts — the seed
  // BIENVENUE10 is owner data the suite no longer depends on.
  await page.getByLabel('Code promo').fill(E2E_PROMO.code);
  await page.getByRole('button', {name: 'Appliquer'}).click();
  await expect(page.getByText(`Code ${E2E_PROMO.code} appliqué (−10%).`)).toBeVisible();

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
  await page.waitForURL(`**/fr/checkout?promo=${E2E_PROMO.code}`);
  await expect(page.getByText(`(${E2E_PROMO.code})`)).toBeVisible();

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
  await expect(page.getByText(new RegExp(`${CASQUE.nameFr}\\s*×3`))).toBeVisible();

  // Money-value gate (spec §6d): the total row shows the exact frozen figure —
  // 129.000 ×3 = 387.000, −10% (E2E10) = 348.300, delivery free above
  // the 100 DT threshold. Guards the server-side pricing math end to end.
  const totalRow = page
    .locator('dl > div')
    .filter({has: page.getByText('Total', {exact: true})});
  await expect(totalRow).toContainText('348.300 TND');

  await expect(cartBadge()).toHaveText('');
});
