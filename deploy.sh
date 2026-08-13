#!/usr/bin/env bash
# Production deploy for the VPS (run from /opt/yasmine-shop as root).
#
#   ./deploy.sh
#
# The build and the running process must share one NEXT_DEPLOYMENT_ID: it is
# what lets Next detect a browser still holding the previous build's JavaScript
# and recover, instead of failing the next server action with "Server Reference
# ID did not match" and leaving the user to refresh by hand.
set -euo pipefail

cd "$(dirname "$0")"

git pull --ff-only

# devDependencies are required: `next build` needs the toolchain.
NODE_ENV=development npm ci --include=dev --no-audit --no-fund

npx prisma generate
npx prisma migrate deploy

export NEXT_DEPLOYMENT_ID="$(git rev-parse --short HEAD)"
echo "Building deployment ${NEXT_DEPLOYMENT_ID}"
npm run build

# --update-env so the restarted process inherits the same deployment id.
NEXT_DEPLOYMENT_ID="${NEXT_DEPLOYMENT_ID}" PORT=3002 NODE_ENV=production \
  pm2 restart yasmine-shop --update-env
pm2 save

echo "Deployed ${NEXT_DEPLOYMENT_ID}"
