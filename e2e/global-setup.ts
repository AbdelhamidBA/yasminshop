import {execSync} from 'node:child_process';
import {E2E_PRODUCTS} from './fixture-data';

export default async function globalSetup() {
  // Wipe last run's fixtures, then recreate the suite-owned catalog (see
  // e2e/fixture-data.ts) — the specs never depend on the owner's products.
  execSync('npx tsx e2e/cleanup.ts', {stdio: 'inherit'});
  execSync('npx tsx e2e/fixtures.ts', {stdio: 'inherit'});
  // Warm the dev server's on-demand compilation for the routes every test
  // hits before authentication (login page, storefront home, product page)
  // so the first test does not pay the cold-compile cost inside its own
  // timeout.
  for (const route of [
    '/fr/login',
    '/fr/register',
    '/fr',
    `/fr/products/${E2E_PRODUCTS.casque.slug}`
  ]) {
    await fetch(`http://localhost:3000${route}`).catch(() => {});
  }
}
