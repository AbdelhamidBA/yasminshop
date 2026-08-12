import {expect, test, type Page} from '@playwright/test';
import {placeOrder} from './helpers';

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
  // the authenticated storefront header is the signed-in proof.
  await page.waitForURL((url) => !url.pathname.endsWith('/register'));
  await expect(page.getByRole('button', {name: 'Se déconnecter'})).toBeVisible({timeout: 30_000});
  await expect(page.getByRole('link', {name: 'Mes commandes'})).toBeVisible();
});

test('the signed-in client places an order', async () => {
  // The session pins clientId on the order; the customerName keeps the
  // 'E2E ' cleanup prefix (fill() overwrites the profile prefill).
  orderNumber = await placeOrder(page, {
    slug: 't-shirt-coton-bio',
    qty: 1,
    customerName: 'E2E Client 3'
  });
});

test('my orders lists the new order', async () => {
  await page.goto('/fr/account/orders');
  await expect(page.getByRole('heading', {name: 'Mes commandes'})).toBeVisible();

  // The order card: number, PENDING badge, the snapshot line, and the frozen
  // total — 9.900 (seed t-shirt) + 7.000 delivery (under the 100 DT free
  // threshold) = 16.900.
  const card = page.getByRole('listitem').filter({hasText: `#${orderNumber}`});
  await expect(card).toBeVisible();
  await expect(card.getByText('En attente')).toBeVisible();
  await expect(card.getByText(/T-shirt coton bio\s*×1/)).toBeVisible();
  await expect(card.getByText('16.900 TND')).toBeVisible();
});

test('logout returns the header to the anonymous state', async () => {
  await page.getByRole('button', {name: 'Se déconnecter'}).click();
  await expect(page.getByRole('link', {name: 'Se connecter'})).toBeVisible({timeout: 30_000});
  await expect(page.getByRole('button', {name: 'Se déconnecter'})).toHaveCount(0);
});
