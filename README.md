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
