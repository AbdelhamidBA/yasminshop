import {expect, test} from '@playwright/test';
import {E2E_PRODUCTS} from './fixture-data';
import {login, placeOrder} from './helpers';

// Phase 5 journey: dashboard + notifications + sub-admins + mass discount.
// Serial — later tests consume the order number the first one captures, and the
// notification/mass-discount state is global server state exercised in sequence.
// Every fixture this spec creates is cleaned by e2e/cleanup.ts: the guest order
// (customerName prefix 'E2E '), the created sub-admin (email prefix
// 'e2e-subadmin'), and — critically — the massDiscountPct Setting is reset to
// null so a left-on discount can never corrupt another spec's price assertions.
// The mass-discount test additionally removes the discount in a finally block so
// the same run's later spec files are protected too.
test.describe.configure({mode: 'serial'});

// Fixture product (e2e/fixture-data.ts) with discountPct 0 and a clean base
// price, used only for reads:
// 249.000 TND → 224.100 TND at −10% (Math.round(249000 * 0.9)). Not ordered by
// any spec, so its price line is stable.
const DISCOUNT_PRODUCT = {
  slug: E2E_PRODUCTS.montre.slug,
  basePrice: '249.000 TND',
  discountedPrice: '224.100 TND'
};

// Fresh sub-admin the admin creates; e2e/cleanup.ts deletes the 'e2e-subadmin'
// prefix at the start of every run, keeping re-creation deterministic.
const NEW_SUB_ADMIN = {
  name: 'E2E Sous-admin',
  email: 'e2e-subadmin@local.test',
  password: 'E2eSub123!'
};

let orderNumber = '';

// Placed as a guest (PENDING → no stock effect) so the dashboard has data in the
// current window and the admin bell has an unread NEW_ORDER notification.
test('guest places an order that feeds the dashboard and the bell', async ({page}) => {
  orderNumber = await placeOrder(page, {
    slug: E2E_PRODUCTS.cafetiere.slug,
    qty: 1,
    customerName: 'E2E Dashboard'
  });
});

test('admin dashboard shows a stat tile, a chart, and range switching', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin');

  // Hero proves the dashboard rendered for the admin.
  await expect(page.getByRole('heading', {name: /Bienvenue/})).toBeVisible();

  // A stat tile renders a formatted money value. 'Chiffre d'affaires' (Revenue)
  // is a unique label; its sibling span holds the millimes-formatted value.
  const revenueLabel = page.getByText("Chiffre d'affaires", {exact: true});
  await expect(revenueLabel).toBeVisible();
  await expect(revenueLabel.locator('xpath=following-sibling::span')).toContainText(/\d\.\d{3}/);

  // At least one recharts chart drew its SVG (the fresh order guarantees the
  // week-range series + status donut have data). recharts emits svg.recharts-surface.
  await expect(page.locator('svg.recharts-surface').first()).toBeVisible();

  // Range switch changes the ?range query (server re-reads it per request).
  await page
    .getByRole('navigation', {name: 'Période'})
    .getByRole('link', {name: 'Mensuel'})
    .click();
  await page.waitForURL(/\/admin\?range=month/);
  await expect(page.getByRole('heading', {name: /Bienvenue/})).toBeVisible();
});

test('admin notification bell surfaces the order and mark-all-read clears the badge', async ({
  page
}) => {
  await login(page, 'admin@local.test', 'admin123!');
  // A non-dashboard admin page: no '#number' order links to collide with the
  // popover's notification text, but the global header bell is still present.
  await page.goto('/fr/admin/products');

  const bell = page.getByRole('button', {name: 'Ouvrir les notifications'});
  // The badge span renders only while unreadCount > 0 (aria-hidden decoration).
  const badge = bell.locator('span[aria-hidden="true"]');
  await expect(badge).toBeVisible();

  // The "mark all read" button lives only inside the open popover, so it is our
  // "is the popover open?" signal. The heavy dashboard route can hydrate slowly
  // under full-suite load, so a single bell.click() may land before the Base UI
  // trigger is interactive and open nothing. Retry idempotently: click only
  // while the popover is closed (never toggling an already-open one shut), until
  // the freshly placed order surfaces in the feed. \b guards against a longer
  // number (#12 must not match #123).
  const markAllRead = page.getByRole('button', {name: 'Tout marquer comme lu'});
  const orderNotice = page.getByText(new RegExp(`Nouvelle commande #${orderNumber}\\b`));
  await expect(async () => {
    if (!(await markAllRead.isVisible())) await bell.click();
    await expect(orderNotice).toBeVisible({timeout: 1500});
  }).toPass({timeout: 20_000});

  await markAllRead.click();
  await expect(
    page.getByText('Toutes les notifications ont été marquées comme lues.')
  ).toBeVisible();
  // unreadCount → 0 removes the badge span entirely.
  await expect(badge).toHaveCount(0);
});

test('sub-admin sees the dashboard but sub-admins management 404s', async ({page}) => {
  await login(page, 'subadmin@local.test', 'subadmin123!');

  // requirePageStaff → the sub-admin sees the dashboard.
  await page.goto('/fr/admin');
  await expect(page.getByRole('heading', {name: /Bienvenue/})).toBeVisible();

  // /admin/sub-admins is ADMIN-only: the page notFound()s for a sub-admin, which
  // returns a 404 document and never renders the management UI.
  const response = await page.goto('/fr/admin/sub-admins');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('button', {name: 'Ajouter un sous-admin'})).toHaveCount(0);
});

test('admin creates a sub-admin', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/sub-admins');

  await page.getByRole('button', {name: 'Ajouter un sous-admin'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom').fill(NEW_SUB_ADMIN.name);
  await dialog.getByLabel('E-mail').fill(NEW_SUB_ADMIN.email);
  await dialog.getByLabel('Mot de passe').fill(NEW_SUB_ADMIN.password);
  await dialog.getByRole('button', {name: 'Créer'}).click();

  await expect(page.getByText('Sous-admin créé.')).toBeVisible();
  await expect(page.getByRole('cell', {name: NEW_SUB_ADMIN.email})).toBeVisible();
});

test('the created sub-admin can log in', async ({page}) => {
  // login() asserts the authenticated header ('Se déconnecter'), so a successful
  // sign-in proves the account persisted with the given credentials.
  await login(page, NEW_SUB_ADMIN.email, NEW_SUB_ADMIN.password);
});

test('mass discount applies a reduced storefront price and removing it restores', async ({
  page
}) => {
  await login(page, 'admin@local.test', 'admin123!');

  // Baseline: no global discount (cleanup reset it), so only the base price shows.
  await page.goto(`/fr/products/${DISCOUNT_PRODUCT.slug}`);
  await expect(page.getByText(DISCOUNT_PRODUCT.basePrice)).toBeVisible();
  await expect(page.getByText(DISCOUNT_PRODUCT.discountedPrice)).toHaveCount(0);

  // Apply 10% via the ADMIN-only Parameters control.
  await page.goto('/fr/admin/parameters');
  await page.locator('#massDiscountPct').fill('10');
  await page.getByRole('button', {name: 'Appliquer à tout'}).click();
  await expect(page.getByText('Remise globale appliquée.')).toBeVisible();

  try {
    // Storefront product page now shows the reduced effective price alongside
    // the struck-through original (both figures are unique to this product page).
    await page.goto(`/fr/products/${DISCOUNT_PRODUCT.slug}`);
    await expect(page.getByText(DISCOUNT_PRODUCT.discountedPrice)).toBeVisible();
    await expect(page.getByText(DISCOUNT_PRODUCT.basePrice)).toBeVisible();
  } finally {
    // Always remove — even if the assertions above failed — so a residual
    // discount can never leak into another spec (cleanup.ts is the cross-run net).
    await page.goto('/fr/admin/parameters');
    await page.getByRole('button', {name: 'Retirer de tout'}).click();
    await expect(page.getByText('Remise globale retirée.')).toBeVisible();
  }

  // Restored: base price back, no discounted figure.
  await page.goto(`/fr/products/${DISCOUNT_PRODUCT.slug}`);
  await expect(page.getByText(DISCOUNT_PRODUCT.basePrice)).toBeVisible();
  await expect(page.getByText(DISCOUNT_PRODUCT.discountedPrice)).toHaveCount(0);
});
