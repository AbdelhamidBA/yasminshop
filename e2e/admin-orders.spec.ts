import {expect, test} from '@playwright/test';
import {E2E_PRODUCTS} from './fixture-data';
import {login, placeOrder, readStock} from './helpers';

// Order status flow with REAL stock effects, end to end:
//   1. guest places an order (E2E Client 2, cleaned up by customerName prefix)
//   2. admin CONFIRMs it → products page shows the stock decremented
//   3. guest places a second order
//   4. sub-admin (status-only role) cancels it from PENDING — no stock change —
//      and sees NO admin-only controls on the way
//   5. admin cancels the CONFIRMED order → stock restored to the baseline
//      (exit criteria: confirm decrements, cancel restores), which also leaves
//      the fixture product's quantity unchanged for consecutive runs.
// Serial: later tests consume the order numbers and the stock baseline the
// earlier ones captured.
test.describe.configure({mode: 'serial'});

// Fixture product (e2e/fixture-data.ts): in stock (qty 50), and NOT the one
// the storefront journey orders, so the two specs never dispute the same
// quantity row.
const PRODUCT = E2E_PRODUCTS.cafetiere;

let firstOrder = '';
let secondOrder = '';
let baselineStock = 0;

test('guest places an order for the fixture cafetière', async ({page}) => {
  firstOrder = await placeOrder(page, {
    slug: PRODUCT.slug,
    qty: 2,
    customerName: 'E2E Client 2'
  });
});

test('admin confirms the order and the product stock decrements', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  // PENDING orders hold no stock — the pre-confirm figure is the baseline.
  baselineStock = await readStock(page, PRODUCT.reference);
  expect(baselineStock).toBeGreaterThanOrEqual(2);

  // List → search by number → detail (the search input submits to ?q=).
  await page.goto('/fr/admin/orders');
  const search = page.getByLabel('Rechercher par n°, nom ou téléphone...');
  await search.fill(firstOrder);
  await search.press('Enter');
  await page.waitForURL(`**/fr/admin/orders?q=${firstOrder}`);
  await page.getByRole('link', {name: `#${firstOrder}`}).click();
  await page.waitForURL(/\/fr\/admin\/orders\/[a-z0-9]+$/i);
  await expect(page.getByText('En attente').first()).toBeVisible();

  await page.getByRole('button', {name: 'Confirmer la commande'}).click();
  await expect(page.getByText('Statut mis à jour.').first()).toBeVisible();
  await expect(page.getByText('Confirmée').first()).toBeVisible();

  expect(await readStock(page, PRODUCT.reference)).toBe(baselineStock - 2);
});

test('guest places a second order', async ({page}) => {
  secondOrder = await placeOrder(page, {
    slug: PRODUCT.slug,
    qty: 1,
    customerName: 'E2E Client 2'
  });
});

test('sub-admin cancels the pending order without stock change and sees no admin controls', async ({
  page
}) => {
  await login(page, 'subadmin@local.test', 'subadmin123!');
  await page.goto(`/fr/admin/orders?q=${secondOrder}`);
  await expect(page.getByRole('link', {name: `#${secondOrder}`})).toBeVisible();
  // ADMIN-only list affordance (manual creation) is absent for SUB_ADMIN.
  await expect(page.getByRole('link', {name: 'Nouvelle commande'})).toHaveCount(0);

  await page.getByRole('link', {name: `#${secondOrder}`}).click();
  await page.waitForURL(/\/fr\/admin\/orders\/[a-z0-9]+$/i);

  // Status transitions are staff-visible (requireStaff)…
  await expect(page.getByRole('button', {name: 'Confirmer la commande'})).toBeVisible();
  const cancelButton = page.getByRole('button', {name: 'Annuler la commande'});
  await expect(cancelButton).toBeVisible();
  // …but the ADMIN-only affordances are not. Asserted only after the status
  // buttons proved the detail rendered — no vacuous zero-counts.
  await expect(page.getByRole('button', {name: 'Modifier le client'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Archiver'})).toHaveCount(0);

  // PENDING → CANCELED goes through the AlertDialog confirm; a never-confirmed
  // order never touched stock, so the figure must not move.
  await cancelButton.click();
  await page.getByRole('alertdialog').getByRole('button', {name: 'Annuler la commande'}).click();
  await expect(page.getByText('Statut mis à jour.').first()).toBeVisible();
  await expect(page.getByText('Annulée').first()).toBeVisible();

  expect(await readStock(page, PRODUCT.reference)).toBe(baselineStock - 2);
});

test('admin cancels the confirmed order and the stock is restored', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto(`/fr/admin/orders?q=${firstOrder}`);
  await page.getByRole('link', {name: `#${firstOrder}`}).click();
  await page.waitForURL(/\/fr\/admin\/orders\/[a-z0-9]+$/i);
  await expect(page.getByText('Confirmée').first()).toBeVisible();

  await page.getByRole('button', {name: 'Annuler la commande'}).click();
  await page.getByRole('alertdialog').getByRole('button', {name: 'Annuler la commande'}).click();
  await expect(page.getByText('Statut mis à jour.').first()).toBeVisible();
  await expect(page.getByText('Annulée').first()).toBeVisible();

  // CONFIRMED → CANCELED restocks: back to the pre-suite baseline.
  expect(await readStock(page, PRODUCT.reference)).toBe(baselineStock);
});
