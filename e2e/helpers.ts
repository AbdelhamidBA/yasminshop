import {expect, type Page} from '@playwright/test';

// Shared FR-locale journey helpers. The admin specs sign in through the real
// login form; the order helper drives the fixture-catalog storefront flow
// (product page → cart → checkout, see e2e/fixture-data.ts) like
// e2e/storefront.spec.ts, minus the promo detour. Fixture orders MUST use a
// customerName starting with 'E2E ' — e2e/cleanup.ts deletes checkout
// fixtures by that prefix.

export async function login(page: Page, email: string, password: string) {
  await page.goto('/fr/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', {name: 'Se connecter'}).click();
  // Sign-in is role-aware: staff land on /admin, everyone else on '/' (whose
  // client-side RSC fetch follows the locale redirect internally, so the
  // committed URL can stay '/'). Wait for having left /login, then assert the
  // authenticated shell that actually belongs to where we landed.
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  if (new URL(page.url()).pathname.includes('/admin')) {
    // The dashboard hero only renders for an authenticated staff session.
    await expect(page.getByRole('heading', {name: /Bienvenue/})).toBeVisible({
      timeout: 30_000
    });
    return;
  }
  // Storefront: 'Se déconnecter' lives inside the header account menu.
  await openAccountMenu(page, 'Se déconnecter');
  // Close the menu again so the page state stays clean for the caller.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', {name: 'Se déconnecter'})).toHaveCount(0);
}

// Opens the header account menu ('Compte') until the expected menu item is
// visible. The click is retried idempotently (only while the item is not
// visible): a click landing before the Base UI trigger hydrates opens
// nothing, and an already-open menu must never be toggled shut.
export async function openAccountMenu(page: Page, itemName: string) {
  const item = page.getByRole('menuitem', {name: itemName});
  await expect(async () => {
    if (!(await item.isVisible())) {
      await page.getByRole('button', {name: 'Compte'}).click();
    }
    await expect(item).toBeVisible({timeout: 1500});
  }).toPass({timeout: 30_000});
}

// Places a COD order for ONE fixture product and returns its sequential order
// number (the figure behind the '#N' the admin list and My Orders show).
// Assumes the page context's cart starts empty; leaves it empty again (the
// checkout clears it after placeOrder succeeds).
export async function placeOrder(
  page: Page,
  {slug, qty, customerName}: {slug: string; qty: number; customerName: string}
): Promise<string> {
  await page.goto(`/fr/products/${slug}`);
  const addToCart = page.getByRole('button', {name: 'Ajouter au panier'});
  const drawer = page.getByRole('dialog', {name: 'Votre panier'});
  for (let i = 0; i < qty; i += 1) {
    // Stepper stays at 1: repeated clicks merge into one line of qty n. Every
    // add opens the modal cart drawer as feedback (Phase 7) — dismiss it so
    // the next click (and the badge assertion) isn't behind the overlay.
    await addToCart.click();
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  }
  // exact:true — the header badge, not the drawer's 'Votre panier' label.
  await expect(page.getByLabel('Panier', {exact: true})).toHaveText(String(qty));

  await page.goto('/fr/checkout');
  // fill() replaces any session-prefilled values, so the helper works for
  // guests and signed-in clients alike.
  await page.getByLabel('Nom complet').fill(customerName);
  await page.getByLabel('Téléphone').fill('21698765432');
  await page.getByLabel('Adresse').fill('7 avenue des Fixtures');
  await page.getByLabel('Ville').fill('Sfax');
  await page.getByRole('button', {name: 'Confirmer la commande'}).click();

  await page.waitForURL(/\/fr\/order-confirmation\/[a-z0-9-]+/i);
  const numberLine = await page.getByText(/Commande n° \d+/).textContent();
  const number = numberLine?.match(/\d+/)?.[0];
  expect(number, 'confirmation page shows the order number').toBeTruthy();
  return number as string;
}

// Reads a product's stock exactly as the admin products page shows it: the
// quantity cell input's VALUE is the live stock figure (aria-label
// admin.products.quantity = 'Quantité'). Works for ADMIN and SUB_ADMIN.
export async function readStock(page: Page, reference: string): Promise<number> {
  await page.goto(`/fr/admin/products?q=${reference}`);
  const input = page.getByRole('row', {name: new RegExp(reference)}).getByLabel('Quantité');
  await expect(input).toBeVisible();
  return Number.parseInt(await input.inputValue(), 10);
}
