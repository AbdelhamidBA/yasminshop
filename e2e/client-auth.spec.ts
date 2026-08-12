import {expect, test, type Page} from '@playwright/test';
import {E2E_PRODUCTS} from './fixture-data';
import {openAccountMenu, placeOrder} from './helpers';

// Client account journey: register → lands signed in → places an order under
// the session → My Orders lists it → logout. ONE continuous session (the
// registration cookie and the cart must survive between steps), so the serial
// tests share a single page — the storefront.spec.ts idiom. The fixture user
// e2e-client@local.test and their orders are deleted by e2e/cleanup.ts at the
// start of every run, keeping re-registration deterministic.
test.describe.configure({mode: 'serial'});

const EMAIL = 'e2e-client@local.test';
const PASSWORD = 'E2eClient123!';

let page: Page;
let orderNumber = '';

test.beforeAll(async ({browser}) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test('registration creates the account and lands signed in', async () => {
  await page.goto('/fr/register');
  await page.getByLabel('Nom').fill('E2E Client 3');
  await page.getByLabel('E-mail').fill(EMAIL);
  // 'Mot de passe' is a substring of 'Confirmer le mot de passe' — exact.
  await page.getByLabel('Mot de passe', {exact: true}).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', {name: 'Créer mon compte'}).click();

  // registerClient signs the fresh CLIENT in server-side and redirects home;
  // the authenticated header account menu ('Compte') is the signed-in proof:
  // it holds 'Mes commandes' and 'Se déconnecter'.
  await page.waitForURL((url) => !url.pathname.endsWith('/register'));
  await openAccountMenu(page, 'Se déconnecter');
  await expect(page.getByRole('menuitem', {name: 'Mes commandes'})).toBeVisible();
  // Close the menu so the next test starts from a clean page state.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', {name: 'Se déconnecter'})).toHaveCount(0);
});

test('the signed-in client places an order', async () => {
  // The session pins clientId on the order; the customerName keeps the
  // 'E2E ' cleanup prefix (fill() overwrites the profile prefill).
  orderNumber = await placeOrder(page, {
    slug: E2E_PRODUCTS.tshirt.slug,
    qty: 1,
    customerName: 'E2E Client 3'
  });
});

test('my orders lists the new order', async () => {
  await page.goto('/fr/account/orders');
  await expect(page.getByRole('heading', {name: 'Mes commandes'})).toBeVisible();

  // The order card: number, PENDING badge, the snapshot line, and the frozen
  // total — 9.900 (fixture t-shirt) + 7.000 delivery (under the 100 DT free
  // threshold) = 16.900.
  const card = page.getByRole('listitem').filter({hasText: `#${orderNumber}`});
  await expect(card).toBeVisible();
  await expect(card.getByText('En attente')).toBeVisible();
  await expect(card.getByText(new RegExp(`${E2E_PRODUCTS.tshirt.nameFr}\\s*×1`))).toBeVisible();
  await expect(card.getByText('16.900 TND')).toBeVisible();
});

test('logout returns the header to the anonymous state', async () => {
  // 'Se déconnecter' is a submit-button menu item inside the account menu.
  await openAccountMenu(page, 'Se déconnecter');
  await page.getByRole('menuitem', {name: 'Se déconnecter'}).click();
  // The sign-out action redirects home; the anonymous account menu now offers
  // 'Se connecter' instead, and the logout entry is gone.
  await openAccountMenu(page, 'Se connecter');
  await expect(page.getByRole('menuitem', {name: 'Se déconnecter'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', {name: 'Se connecter'})).toHaveCount(0);
});
