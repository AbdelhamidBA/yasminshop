# E-Commerce Platform

Bilingual (FR/AR + RTL) e-commerce platform — Next.js App Router, Prisma + PostgreSQL, Auth.js.
Spec: `docs/superpowers/specs/2026-08-11-ecommerce-platform-design.md`.

## Prerequisites

- Node 20.9+ and npm
- Docker Desktop (for the dev database)

## Quickstart

```powershell
npm install
docker compose up -d          # PostgreSQL 17 on localhost:5432
copy .env.example .env        # then fill AUTH_SECRET — generate with `openssl rand -base64 33` (Git Bash)
                              # or PowerShell-native: [Convert]::ToBase64String((1..33 | ForEach-Object {Get-Random -Maximum 256}) -as [byte[]])
npx prisma migrate dev        # apply schema
npx prisma db seed            # seed users, settings, demo catalog
npm run dev                   # http://localhost:3000
```

Prisma 7 note: the seed command is registered in `prisma.config.ts`, and the client connects through the `pg` driver adapter (`@prisma/adapter-pg`).

## Seeded accounts (dev only)

| Role      | Email               | Password     |
| --------- | ------------------- | ------------ |
| Admin     | admin@local.test    | admin123!    |
| Sub-admin | subadmin@local.test | subadmin123! |
| Client    | client@local.test   | client123!   |

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm test` — unit tests (Vitest)
- `npm run build` — production build
- `npx prisma studio` — browse the database

## Conventions

- Money is integer **millimes** (1 TND = 1000); fields end in `Millimes`.
- All UI strings live in `messages/fr.json` + `messages/ar.json` (keys must match — enforced by test).
- Tailwind **logical** utilities only (`ms-`, `me-`, `ps-`, `pe-`) in project-authored code so RTL works (vendored shadcn primitives excepted).
- Soft delete via `archivedAt` — no hard deletes.

## Known limitations / deferred

Conscious scope boundaries for the single-instance VPS target — none are correctness bugs; each is safe as-is and noted for a future hardening pass:

- **Password-reset emails need SMTP.** `requestPasswordReset` currently `console.log`s the reset URL instead of sending mail — wire an SMTP/provider transport before relying on self-service reset in production.
- **Rate limiter is single-instance (in-memory).** The fixed-window limiter on public writes (register / password-reset / login / place-order / promo-check / search-hits) keeps counters in process memory. Correct for one Node process behind one reverse proxy; a multi-instance / load-balanced deployment needs a shared store (Redis or a DB table). The client-IP key assumes a **single trusted proxy** and reads the rightmost `x-forwarded-for` hop (un-spoofable in that topology) — a multi-proxy chain must widen `clientIpFromHeaders` to skip its own proxy hops.
- **Login throttling is generous by design.** `login` is capped at 30/min per IP as basic brute-force defence-in-depth; production should add stricter proxy-level throttling (e.g. fail2ban) or a per-account failed-attempt counter.
- **Web-push is browser-manual, fire-and-forget.** Staff opt in per-device from the admin header; new-order alerts are best-effort (`sendPushToAllStaff`, never awaited) and a delivery failure never blocks order creation. There is no automated retry/fan-out beyond that — the in-app notification bell is the reliable channel.
- **Link-styled buttons keep their dev-only console warning.** Navigational `<Button render={<Link>}>` sites emit a Base UI `nativeButton` dev-overlay warning. The documented `nativeButton={false}` fix makes Base UI stamp `role="button"` on the anchor, which is wrong for a link and breaks the `getByRole('link')` e2e locators; the correct fix (converting each site to `<Link className={buttonVariants(...)}>`) is a broad refactor deferred out of the final hardening commit. The warning is guarded by `NODE_ENV !== 'production'` — zero impact on build, tests, or the shipped bundle.
- **Long-list & My-Orders pagination windowing deferred.** `AdminPagination` renders every page number (no windowing) and the storefront "My Orders" list shows all of a client's orders un-paginated — both fine at this shop's data scale; revisit if lists grow large.
- **Lint: `react-hooks/set-state-in-effect` accepted.** 12 occurrences (dialog error-reset, theme/mount guards, search-box debounce, cart hydration) are a deliberate, reviewed idiom left in place; `@next/next/no-img-element` warnings are the intentional same-origin `<img>` for `/api/uploads` assets.
