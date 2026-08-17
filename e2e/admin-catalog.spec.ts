import path from 'node:path';
import {expect, test} from '@playwright/test';
import {login} from './helpers';

test.describe.configure({mode: 'serial'});

test('admin creates a category with a subcategory', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/categories');

  // Root category.
  await page.getByRole('button', {name: 'Ajouter une catégorie'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nom (français)').fill('E2E Maison');
  await dialog.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByText('Catégorie enregistrée.').first()).toBeVisible();
  await expect(page.getByRole('cell', {name: 'E2E Maison'})).toBeVisible();

  // Subcategory under it. The parent Select is a Base UI combobox whose label
  // is not programmatically associated — target the dialog's only combobox.
  await page.getByRole('button', {name: 'Ajouter une catégorie'}).click();
  await dialog.getByLabel('Nom (français)').fill('E2E Salon');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', {name: 'E2E Maison'}).click();
  await dialog.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByRole('cell', {name: 'E2E Salon'})).toBeVisible();
});

test('admin creates a product with an uploaded image', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/products/new');

  await page.getByLabel('Référence').fill('E2E-PROD-1');
  await page.getByLabel('Nom (français)').fill('E2E Lampe');
  await page.getByLabel('Description (français)').fill('Lampe de test e2e.');
  await page.getByLabel('Prix (DT)').fill('45.500');
  // exact: the product form also has 'Quantité minimale (gros)', which the
  // default substring match would tie with.
  await page.getByLabel('Quantité', {exact: true}).fill('7');
  // Wholesale: 45.500 retail, 30.000 from 3 units. Set here so the admin form
  // -> database -> storefront chain is covered, not just the pricing maths.
  await page.getByLabel('Prix de gros (optionnel)').fill('30.000');
  await page.getByLabel('Quantité minimale (gros)').fill('3');

  // The category Select trigger renders empty until a value is picked and its
  // label is not associated; the form renders exactly two comboboxes in DOM
  // order: category first, sub-category second.
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', {name: 'E2E Maison'}).click();

  await page.setInputFiles('input[type="file"]', path.join(__dirname, 'fixtures', 'product.png'));
  await expect(page.locator('img[src^="/api/uploads/products/"]')).toBeVisible();

  await page.getByRole('button', {name: 'Enregistrer'}).click();
  await page.waitForURL('**/fr/admin/products');
  const row = page.getByRole('row', {name: /E2E-PROD-1/});
  await expect(row.getByRole('cell', {name: 'E2E-PROD-1'})).toBeVisible();
  await expect(row.getByText('45.500')).toBeVisible();
});

test('the wholesale price is announced and charged from the threshold', async ({page}) => {
  // The storefront view of the product the previous test created.
  await page.goto('/fr/products');
  await page.getByRole('link', {name: /E2E Lampe/}).first().click();
  await page.waitForURL(/\/fr\/products\/[a-z0-9-]+$/);

  // Announced BEFORE the stepper: nobody chooses to buy three for a price they
  // were never told about.
  await expect(page.getByText('À partir de 3 unités')).toBeVisible();

  const addToCart = page.getByRole('button', {name: 'Ajouter au panier'});
  const drawer = page.getByRole('dialog', {name: 'Votre panier'});

  // Two units: still retail.
  for (let i = 0; i < 2; i += 1) {
    await addToCart.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  }
  await page.goto('/fr/cart');
  await expect(page.getByText('45.500 TND ×2')).toBeVisible();

  // The third flips the WHOLE line to the gros price, not just the extra unit.
  await page.goBack();
  await addToCart.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/fr/cart');
  await expect(page.getByText('30.000 TND ×3')).toBeVisible();
  await expect(page.getByText('90.000 TND').first()).toBeVisible();
});

test('sub-admin can only edit quantity', async ({page}) => {
  await login(page, 'subadmin@local.test', 'subadmin123!');
  await page.goto('/fr/admin/products?q=E2E-PROD-1');

  const row = page.getByRole('row', {name: /E2E-PROD-1/});
  await expect(row.getByRole('cell', {name: 'E2E-PROD-1'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Ajouter un produit'})).toHaveCount(0);

  await row.getByLabel('Quantité').fill('9');
  await row.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByText('Quantité mise à jour.')).toBeVisible();
});

test('admin archives the e2e product', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/products?q=E2E-PROD-1');

  const row = page.getByRole('row', {name: /E2E-PROD-1/});
  const actions = row.getByRole('button', {name: 'Actions'});
  const archiveItem = page.getByRole('menuitem', {name: 'Archiver'});
  // Admin routes compile on demand, so under full-suite load this click can
  // land before the Base UI trigger hydrates and open nothing. Retry
  // idempotently — click only while the menu is closed, never toggling an
  // open one shut. Same idiom as the notification-bell test.
  await expect(async () => {
    if (!(await archiveItem.isVisible())) await actions.click();
    await expect(archiveItem).toBeVisible({timeout: 1500});
  }).toPass({timeout: 20_000});
  await archiveItem.click();
  await page.getByRole('alertdialog').getByRole('button', {name: 'Archiver'}).click();
  await expect(page.getByText('Produit archivé.')).toBeVisible();
  await expect(page.getByRole('cell', {name: 'E2E-PROD-1'})).toHaveCount(0);
});
