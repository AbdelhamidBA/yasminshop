import {execSync} from 'node:child_process';

export default async function globalSetup() {
  execSync('npx tsx e2e/cleanup.ts', {stdio: 'inherit'});
  // Warm the dev server's on-demand compilation for the routes every test
  // hits before authentication (login page, storefront home) so the first
  // test does not pay the cold-compile cost inside its own timeout.
  for (const route of ['/fr/login', '/fr/register', '/fr']) {
    await fetch(`http://localhost:3000${route}`).catch(() => {});
  }
}
