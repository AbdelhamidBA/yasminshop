import {execSync} from 'node:child_process';

// Remove the suite's fixtures when the run ends. global-setup already wipes
// them before creating fresh ones (so a crashed run cannot poison the next),
// but without this teardown the fixture catalog SURVIVES the run and shows up
// on the live storefront — an "E2E Fixtures" pill in the category row and five
// test products in the grids, visible to real customers. Cleanup is
// idempotent and prefix-scoped, so running it at both ends is safe.
export default async function globalTeardown() {
  execSync('npx tsx e2e/cleanup.ts', {stdio: 'inherit'});
}
