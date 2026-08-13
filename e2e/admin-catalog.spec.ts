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
  await dialog.getByLabel('Nom (arabe)').fill('E2E منزل');
  await dialog.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByText('Catégorie enregistrée.').first()).toBeVisible();
  await expect(page.getByRole('cell', {name: 'E2E Maison'})).toBeVisible();

  // Subcategory under it. The parent Select is a Base UI combobox whose label
  // is not programmatically associated — target the dialog's only combobox.
  await page.getByRole('button', {name: 'Ajouter une catégorie'}).click();
  await dialog.getByLabel('Nom (français)').fill('E2E Salon');
  await dialog.getByLabel('Nom (arabe)').fill('E2E صالون');
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
  await page.getByLabel('Nom (arabe)').fill('E2E مصباح');
  await page.getByLabel('Description (français)').fill('Lampe de test e2e.');
  await page.getByLabel('Description (arabe)').fill('مصباح اختبار.');
  await page.getByLabel('Prix (DT)').fill('45.500');
  await page.getByLabel('Quantité').fill('7');

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
