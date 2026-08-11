# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js app skeleton: FR/AR i18n with RTL, dark mode, PostgreSQL + Prisma schema + seed, Auth.js with three roles, and the base storefront + admin layouts — everything later phases build on.

**Architecture:** Next.js App Router monolith under `src/`, all pages inside `app/[locale]/` (next-intl), Server Actions for mutations, Prisma → Dockerized PostgreSQL. Auth.js v5 (JWT sessions, credentials provider) with role claims; middleware composes next-intl routing with an `/admin` role guard. See spec: `docs/superpowers/specs/2026-08-11-ecommerce-platform-design.md`.

**Tech Stack:** Next.js 15+ (create-next-app latest, TypeScript, Tailwind v4, Turbopack), shadcn/ui, next-intl v4, next-themes, Prisma + PostgreSQL 17 (Docker), next-auth@beta (Auth.js v5), bcryptjs, zod, Vitest, tsx.

## Global Constraints

- **Environment (verified 2026-08-11):** Windows 10, Node v22.14.0, npm 10.9.2, Docker 28.5.1 available, no local Postgres → DB runs in Docker. Shell commands below are PowerShell-compatible.
- **Money is integer millimes everywhere** (1 TND = 1000 millimes; e.g. 7.500 DT = `7500`). Never floats, never Decimal. Field names end in `Millimes`.
- **Locales:** `fr` (default) and `ar` (RTL). Every user-facing string goes through next-intl messages; `messages/fr.json` and `messages/ar.json` must stay key-identical (a test enforces this).
- **RTL rule:** only Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `border-e`) — never `ml-/mr-/pl-/pr-/left-/right-`.
- **Roles:** `ADMIN | SUB_ADMIN | CLIENT`. Authorization is enforced server-side (middleware + layout/page checks), never only in UI.
- **Soft delete:** every archivable model has `archivedAt DateTime?`; no hard deletes.
- **Version drift:** if a library's current API differs from a snippet here (majors move fast), consult that library's official docs and adapt — do not downgrade majors to force a snippet to compile. Snippets were written against Next 15+/next-intl 4/Auth.js v5 beta/Tailwind 4/Prisma 6.
- Commit after every task with a conventional-commit message ending in the Claude co-author trailer.
- Run all commands from the repo root: `c:\Project\E com Platrome`.

---

### Task 1: Repo prep + Next.js scaffold + shadcn/ui

**Files:**
- Move: `ECommWebsite.md` → `docs/ECommWebsite.md`; `ecomm-*.jpg` → `docs/reference-images/`
- Create (via scaffold): `package.json`, `src/app/*`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `src/app/globals.css`
- Create (via shadcn): `components.json`, `src/lib/utils.ts`, `src/components/ui/*`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: runnable Next.js app; `cn(...classes)` helper at `src/lib/utils.ts`; shadcn components `Button`, `Input`, `Label`, `Card`, `DropdownMenu`, `Separator`, `Avatar` under `src/components/ui/`.

- [ ] **Step 1: Move non-code assets into `docs/`** (create-next-app refuses unknown files in the target dir; `docs/` is on its allowlist)

```powershell
New-Item -ItemType Directory -Force docs\reference-images
git mv ECommWebsite.md docs\ECommWebsite.md
git mv ecomm-admin-example.jpg docs\reference-images\
git mv ecomm-client-mainpage.jpg docs\reference-images\
git mv ecomm-client-productpage.jpg docs\reference-images\
git commit -m "chore: move spec assets into docs/ to unblock scaffold"
```

- [ ] **Step 2: Scaffold Next.js in place**

```powershell
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm
```

Accept defaults for any remaining prompts.

- [ ] **Step 3: Verify dev server renders**

Run: `npm run dev` (background), then GET `http://localhost:3000` → expect HTTP 200 and the Next.js starter page. Stop the server.

- [ ] **Step 4: Initialize shadcn/ui and add base components**

```powershell
npx shadcn@latest init -d
npx shadcn@latest add button input label card dropdown-menu separator avatar
```

Verify `src/lib/utils.ts` exports `cn` and `src/app/globals.css` now contains shadcn theme variables plus a `@custom-variant dark` line (Tailwind v4 dark mode via class).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind and shadcn/ui"
```

---

### Task 2: Vitest + money helpers (TDD)

**Files:**
- Create: `vitest.config.ts`, `src/lib/money.ts`
- Test: `src/lib/money.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nothing.
- Produces: `effectivePriceMillimes(priceMillimes: number, discountPct: number, massDiscountPct: number | null): number` and `formatMillimes(millimes: number): string` from `@/lib/money`. `formatMillimes` returns e.g. `"1 234.567"` (space thousands separator, always 3 decimals); the currency label (DT / د.ت) is appended by callers from i18n messages. Amounts are assumed non-negative.

- [ ] **Step 1: Install and configure Vitest**

```powershell
npm i -D vitest
```

Create `vitest.config.ts`:

```ts
import path from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  },
  resolve: {
    alias: {'@': path.resolve(__dirname, 'src')}
  }
});
```

Add to `package.json` scripts: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/money.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {effectivePriceMillimes, formatMillimes} from './money';

describe('effectivePriceMillimes', () => {
  test('no discount returns price unchanged', () => {
    expect(effectivePriceMillimes(10_000, 0, null)).toBe(10_000);
  });

  test('applies per-product discount', () => {
    expect(effectivePriceMillimes(10_000, 20, null)).toBe(8_000);
  });

  test('mass discount overrides per-product discount', () => {
    expect(effectivePriceMillimes(10_000, 20, 50)).toBe(5_000);
  });

  test('mass discount of 0 is an active override (cancels product discounts)', () => {
    expect(effectivePriceMillimes(10_000, 20, 0)).toBe(10_000);
  });

  test('rounds to the nearest millime', () => {
    // 9990 * 0.67 = 6693.3
    expect(effectivePriceMillimes(9_990, 33, null)).toBe(6_693);
  });
});

describe('formatMillimes', () => {
  test('formats dinars and millimes with 3 decimals', () => {
    expect(formatMillimes(7_500)).toBe('7.500');
  });

  test('groups thousands with spaces', () => {
    expect(formatMillimes(1_234_567)).toBe('1 234.567');
  });

  test('formats zero', () => {
    expect(formatMillimes(0)).toBe('0.000');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/money.ts`:

```ts
// All monetary amounts in this codebase are integer millimes (1 TND = 1000 millimes).
// Amounts are non-negative.

export function effectivePriceMillimes(
  priceMillimes: number,
  discountPct: number,
  massDiscountPct: number | null
): number {
  const pct = massDiscountPct ?? discountPct;
  return Math.round((priceMillimes * (100 - pct)) / 100);
}

export function formatMillimes(millimes: number): string {
  const dinars = Math.trunc(millimes / 1000);
  const rest = (millimes % 1000).toString().padStart(3, '0');
  const grouped = dinars.toLocaleString('en-US').replaceAll(',', ' ');
  return `${grouped}.${rest}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```powershell
git add vitest.config.ts src/lib/money.ts src/lib/money.test.ts package.json package-lock.json
git commit -m "feat: add millimes money helpers with vitest setup"
```

---

### Task 3: next-intl — FR/AR routing, messages, RTL

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`, `messages/fr.json`, `messages/ar.json`, `src/middleware.ts`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/components/language-switcher.tsx`
- Delete: `src/app/layout.tsx`, `src/app/page.tsx` (replaced by `[locale]` versions)
- Modify: `next.config.ts`
- Test: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: scaffold from Task 1.
- Produces: `routing` (locales `['fr','ar']`, default `'fr'`) from `@/i18n/routing`; locale-aware `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation`; message catalogs; `<LanguageSwitcher />` client component. `src/middleware.ts` here is intl-only — Task 9 replaces it with the auth-composed version.

- [ ] **Step 1: Install next-intl and wire the plugin**

```powershell
npm i next-intl
```

Replace `next.config.ts`:

```ts
import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 2: Create routing, navigation, and request config**

Create `src/i18n/routing.ts`:

```ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'ar'],
  defaultLocale: 'fr'
});
```

Create `src/i18n/navigation.ts`:

```ts
import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
```

Create `src/i18n/request.ts`:

```ts
import {hasLocale} from 'next-intl';
import {getRequestConfig} from 'next-intl/server';
import {routing} from './routing';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

- [ ] **Step 3: Create the message catalogs**

Create `messages/fr.json`:

```json
{
  "common": {
    "siteName": "Ma Boutique",
    "currency": "DT",
    "cart": "Panier",
    "login": "Se connecter",
    "logout": "Se déconnecter",
    "welcome": "Bienvenue",
    "theme": {
      "toggle": "Changer le thème"
    }
  },
  "nav": {
    "home": "Accueil",
    "products": "Produits",
    "categories": "Catégories"
  },
  "home": {
    "heroTitle": "Découvrez des produits que vous allez adorer",
    "heroSubtitle": "Produits locaux et importés, livrés chez vous."
  },
  "footer": {
    "copyright": "Tous droits réservés."
  },
  "auth": {
    "email": "E-mail",
    "password": "Mot de passe",
    "signIn": "Se connecter",
    "invalidCredentials": "E-mail ou mot de passe incorrect."
  },
  "admin": {
    "blocks": {
      "dashboard": "Tableau de bord",
      "settings": "Paramètres"
    },
    "nav": {
      "overview": "Vue d'ensemble",
      "clients": "Clients",
      "products": "Produits",
      "orders": "Commandes",
      "categories": "Catégories",
      "promoCodes": "Codes promo",
      "subAdmins": "Sous-admins",
      "parameters": "Paramètres généraux"
    },
    "collapse": "Réduire le menu",
    "notifications": "Notifications"
  }
}
```

Create `messages/ar.json`:

```json
{
  "common": {
    "siteName": "متجري",
    "currency": "د.ت",
    "cart": "السلة",
    "login": "تسجيل الدخول",
    "logout": "تسجيل الخروج",
    "welcome": "مرحبا",
    "theme": {
      "toggle": "تغيير المظهر"
    }
  },
  "nav": {
    "home": "الرئيسية",
    "products": "المنتجات",
    "categories": "الفئات"
  },
  "home": {
    "heroTitle": "اكتشف منتجات ستحبها",
    "heroSubtitle": "منتجات محلية ومستوردة تصل إلى باب منزلك."
  },
  "footer": {
    "copyright": "جميع الحقوق محفوظة."
  },
  "auth": {
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "signIn": "تسجيل الدخول",
    "invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة."
  },
  "admin": {
    "blocks": {
      "dashboard": "لوحة التحكم",
      "settings": "الإعدادات"
    },
    "nav": {
      "overview": "نظرة عامة",
      "clients": "العملاء",
      "products": "المنتجات",
      "orders": "الطلبات",
      "categories": "الفئات",
      "promoCodes": "أكواد التخفيض",
      "subAdmins": "المشرفون الفرعيون",
      "parameters": "الإعدادات العامة"
    },
    "collapse": "طي القائمة",
    "notifications": "الإشعارات"
  }
}
```

- [ ] **Step 4: Write the failing catalog-parity test**

Create `src/i18n/messages.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import ar from '../../messages/ar.json';
import fr from '../../messages/fr.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('message catalogs', () => {
  test('ar.json has exactly the same keys as fr.json', () => {
    expect(flattenKeys(ar).sort()).toEqual(flattenKeys(fr).sort());
  });

  test('no empty translations', () => {
    const empties = (catalog: Record<string, unknown>) =>
      flattenKeys(catalog).length > 0;
    expect(empties(fr)).toBe(true);
    expect(empties(ar)).toBe(true);
  });
});
```

Run: `npm test` — expected: PASS if both files were written correctly (this test exists to catch future drift; if it fails now, fix the catalogs).

- [ ] **Step 5: Restructure the app under `[locale]` with RTL**

Delete `src/app/layout.tsx` and `src/app/page.tsx`.

Create `src/app/[locale]/layout.tsx` (this becomes the root layout — html/body live here):

```tsx
import type {ReactNode} from 'react';
import {notFound} from 'next/navigation';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Create `src/app/[locale]/page.tsx`:

```tsx
import {getTranslations, setRequestLocale} from 'next-intl/server';

export default async function HomePage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold">{t('heroTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('heroSubtitle')}</p>
    </main>
  );
}
```

Create `src/middleware.ts` (intl-only for now; Task 9 replaces it):

```ts
import createMiddleware from 'next-intl/middleware';
import {routing} from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

- [ ] **Step 6: Create the language switcher**

Create `src/components/language-switcher.tsx`:

```tsx
'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter} from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const other = locale === 'fr' ? 'ar' : 'fr';

  return (
    <button
      type="button"
      className="rounded-md border px-2 py-1 text-sm font-medium hover:bg-accent"
      onClick={() => router.replace(pathname, {locale: other})}
    >
      {other === 'ar' ? 'العربية' : 'Français'}
    </button>
  );
}
```

- [ ] **Step 7: Verify manually**

Run `npm run dev`. Check:
- `http://localhost:3000` redirects to `/fr` and shows the French hero.
- `http://localhost:3000/ar` shows Arabic text and `<html dir="rtl">` (inspect response HTML).
Stop the server. Run `npm test` — all green.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "feat: add FR/AR i18n with next-intl, RTL, and catalog parity test"
```

---

### Task 4: Dark mode

**Files:**
- Create: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`
- Modify: `src/app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `[locale]` layout from Task 3; shadcn `@custom-variant dark` CSS from Task 1.
- Produces: `<ThemeProvider>` wrapper and `<ThemeToggle />` client component (used by both shells in Tasks 10–11).

- [ ] **Step 1: Install next-themes and create the provider**

```powershell
npm i next-themes
```

Create `src/components/theme-provider.tsx`:

```tsx
'use client';

import type {ReactNode} from 'react';
import {ThemeProvider as NextThemesProvider} from 'next-themes';

export function ThemeProvider({children}: {children: ReactNode}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Create the toggle**

Create `src/components/theme-toggle.tsx`:

```tsx
'use client';

import {useEffect, useState} from 'react';
import {Moon, Sun} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useTheme} from 'next-themes';

export function ThemeToggle() {
  const {resolvedTheme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations('common.theme');

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label={t('toggle')}
      className="flex size-9 items-center justify-center rounded-md border hover:bg-accent"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {mounted && (resolvedTheme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />)}
    </button>
  );
}
```

- [ ] **Step 3: Wrap the layout**

In `src/app/[locale]/layout.tsx`, import `ThemeProvider` and wrap the provider around the intl provider inside `<body>`:

```tsx
<body className="antialiased">
  <ThemeProvider>
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  </ThemeProvider>
</body>
```

Temporarily add `<ThemeToggle />` next to the hero in `src/app/[locale]/page.tsx` to verify (it moves into the header in Task 10 — leave it on the page until then).

- [ ] **Step 4: Verify manually**

`npm run dev` → toggle switches light/dark (background/foreground colors flip via the `.dark` class on `<html>`), persists across reload, works on `/ar` too. Stop server.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: add dark mode with next-themes"
```

---

### Task 5: PostgreSQL (Docker) + Prisma schema + migration

**Files:**
- Create: `docker-compose.yml`, `prisma/schema.prisma`, `src/lib/db.ts`, `.env.example`
- Modify: `.env` (created by `prisma init`; never committed), `.gitignore` (ensure `.env` ignored)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: running Postgres at `localhost:5432`; full DB schema (all models for every later phase); `prisma` singleton (`PrismaClient`) exported from `@/lib/db`; generated types `Role`, `OrderStatus` from `@prisma/client`.

- [ ] **Step 1: Create and start the database container**

Create `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: ecom_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ecom
      POSTGRES_PASSWORD: ecom_dev_password
      POSTGRES_DB: ecom
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

Run: `docker compose up -d` (if the Docker daemon isn't running, start Docker Desktop first).
Verify: `docker compose exec db pg_isready -U ecom` → `accepting connections`.

- [ ] **Step 2: Install Prisma and init**

```powershell
npm i @prisma/client
npm i -D prisma
npx prisma init
```

Set in `.env`:

```
DATABASE_URL="postgresql://ecom:ecom_dev_password@localhost:5432/ecom?schema=public"
```

Create `.env.example` with the same `DATABASE_URL` line (plus a placeholder `AUTH_SECRET=` line for Task 8). Check `.gitignore` covers `.env` (create-next-app's default ignores `.env*`; if not, add `.env`).

- [ ] **Step 3: Write the full schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  SUB_ADMIN
  CLIENT
}

enum OrderStatus {
  PENDING
  CONFIRMED
  DELIVERED
  CANCELED
}

model User {
  id                String             @id @default(cuid())
  name              String
  email             String             @unique
  phone             String?
  passwordHash      String
  role              Role               @default(CLIENT)
  address           String?
  city              String?
  archivedAt        DateTime?
  createdAt         DateTime           @default(now())
  orders            Order[]
  pushSubscriptions PushSubscription[]
}

model Category {
  id          String     @id @default(cuid())
  nameFr      String
  nameAr      String
  slug        String     @unique
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  archivedAt  DateTime?
  products    Product[]  @relation("ProductCategory")
  subProducts Product[]  @relation("ProductSubCategory")
}

model Product {
  id            String         @id @default(cuid())
  reference     String         @unique
  nameFr        String
  nameAr        String
  descriptionFr String
  descriptionAr String
  priceMillimes Int
  discountPct   Int            @default(0)
  quantity      Int            @default(0)
  featured      Boolean        @default(false)
  searchHits    Int            @default(0)
  categoryId    String
  category      Category       @relation("ProductCategory", fields: [categoryId], references: [id])
  subCategoryId String?
  subCategory   Category?      @relation("ProductSubCategory", fields: [subCategoryId], references: [id])
  images        ProductImage[]
  orderItems    OrderItem[]
  archivedAt    DateTime?
  createdAt     DateTime       @default(now())
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  sortOrder Int     @default(0)
}

model Order {
  id                    String      @id @default(cuid())
  number                Int         @unique @default(autoincrement())
  clientId              String?
  client                User?       @relation(fields: [clientId], references: [id])
  customerName          String
  customerPhone         String
  customerAddress       String
  status                OrderStatus @default(PENDING)
  subtotalMillimes      Int
  promoCode             String?
  promoDiscountMillimes Int         @default(0)
  deliveryCostMillimes  Int
  totalMillimes         Int
  notes                 String?
  archivedAt            DateTime?
  createdAt             DateTime    @default(now())
  items                 OrderItem[]
}

model OrderItem {
  id                String  @id @default(cuid())
  orderId           String
  order             Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId         String
  product           Product @relation(fields: [productId], references: [id])
  nameSnapshot      String
  unitPriceMillimes Int
  qty               Int
  lineTotalMillimes Int
}

model PromoCode {
  id         String    @id @default(cuid())
  code       String    @unique
  percentOff Int
  active     Boolean   @default(true)
  expiresAt  DateTime?
  archivedAt DateTime?
}

model Setting {
  key   String @id
  value Json
}

model Notification {
  id        String    @id @default(cuid())
  type      String
  payload   Json
  readAt    DateTime?
  createdAt DateTime  @default(now())
}

model PushSubscription {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint String @unique
  keysJson Json
}
```

- [ ] **Step 4: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: migration applied, Prisma Client generated. Then `npx prisma migrate status` → `Database schema is up to date!`

- [ ] **Step 5: Create the Prisma singleton**

Create `src/lib/db.ts`:

```ts
import {PrismaClient} from '@prisma/client';

const globalForPrisma = globalThis as unknown as {prisma?: PrismaClient};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Commit**

```powershell
git add docker-compose.yml prisma .env.example src/lib/db.ts package.json package-lock.json .gitignore
git commit -m "feat: add dockerized postgres and full prisma schema"
```

---

### Task 6: Password helpers (TDD)

**Files:**
- Create: `src/lib/password.ts`
- Test: `src/lib/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>` from `@/lib/password` (used by seed in Task 7 and Auth.js in Task 8).

- [ ] **Step 1: Install bcryptjs**

```powershell
npm i bcryptjs
```

(bcryptjs v3 ships its own TypeScript types; if the editor complains about missing types, also run `npm i -D @types/bcryptjs`.)

- [ ] **Step 2: Write the failing tests**

Create `src/lib/password.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {hashPassword, verifyPassword} from './password';

describe('password hashing', () => {
  test('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('s3cret!', hash)).toBe(true);
  });

  test('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret!');
    expect(await verifyPassword('nope', hash)).toBe(false);
  });

  test('produces salted, non-deterministic hashes', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `./password`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/password.ts`:

```ts
import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/password.ts src/lib/password.test.ts package.json package-lock.json
git commit -m "feat: add bcrypt password helpers"
```

---

### Task 7: Seed script

**Files:**
- Create: `prisma/seed.ts`, `public/placeholder-product.svg`
- Modify: `package.json` (prisma seed hook)

**Interfaces:**
- Consumes: schema + `DATABASE_URL` (Task 5), `hashPassword` (Task 6).
- Produces: idempotent seed with three users — `admin@local.test` / `admin123!` (ADMIN), `subadmin@local.test` / `subadmin123!` (SUB_ADMIN), `client@local.test` / `client123!` (CLIENT) — default settings keys (`deliveryCostMillimes`, `freeDeliveryThresholdMillimes`, `currency`, `lastChanceThreshold`, `massDiscountPct`, `socialLinks`, `copyright`, `siteDescription`, `keywords`), one category tree, one demo product.

- [ ] **Step 1: Install tsx and register the seed hook**

```powershell
npm i -D tsx
```

Add to `package.json` (top level, not inside scripts):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 2: Create the placeholder product image**

Create `public/placeholder-product.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#e5e7eb"/>
  <text x="200" y="205" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#6b7280">Produit</text>
</svg>
```

- [ ] **Step 3: Write the seed script**

Create `prisma/seed.ts`:

```ts
import {Prisma, PrismaClient} from '@prisma/client';
import {hashPassword} from '../src/lib/password';

const prisma = new PrismaClient();

const SETTINGS: Record<string, unknown> = {
  deliveryCostMillimes: 7000,
  freeDeliveryThresholdMillimes: 100_000,
  currency: 'TND',
  lastChanceThreshold: 5,
  massDiscountPct: null,
  socialLinks: {facebook: '', instagram: '', tiktok: ''},
  copyright: '© 2026 Ma Boutique',
  siteDescription: '',
  keywords: ''
};

const USERS = [
  {name: 'Admin', email: 'admin@local.test', password: 'admin123!', role: 'ADMIN'},
  {name: 'Sous Admin', email: 'subadmin@local.test', password: 'subadmin123!', role: 'SUB_ADMIN'},
  {name: 'Client Démo', email: 'client@local.test', password: 'client123!', role: 'CLIENT'}
] as const;

async function main() {
  for (const u of USERS) {
    await prisma.user.upsert({
      where: {email: u.email},
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash: await hashPassword(u.password),
        role: u.role
      }
    });
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: {key},
      update: {},
      create: {
        key,
        value: value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue)
      }
    });
  }

  const electronics = await prisma.category.upsert({
    where: {slug: 'electronique'},
    update: {},
    create: {nameFr: 'Électronique', nameAr: 'إلكترونيات', slug: 'electronique'}
  });

  const audio = await prisma.category.upsert({
    where: {slug: 'audio'},
    update: {},
    create: {nameFr: 'Audio', nameAr: 'صوتيات', slug: 'audio', parentId: electronics.id}
  });

  await prisma.product.upsert({
    where: {reference: 'DEMO-001'},
    update: {},
    create: {
      reference: 'DEMO-001',
      nameFr: 'Casque sans fil',
      nameAr: 'سماعات لاسلكية',
      descriptionFr: 'Casque Bluetooth avec réduction de bruit.',
      descriptionAr: 'سماعات بلوتوث مع خاصية عزل الضوضاء.',
      priceMillimes: 89_000,
      quantity: 25,
      featured: true,
      categoryId: electronics.id,
      subCategoryId: audio.id,
      images: {create: [{url: '/placeholder-product.svg', sortOrder: 0}]}
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run and verify idempotency**

Run: `npx prisma db seed` → `Seed complete.`
Run it a second time → same output, no unique-constraint errors.
Verify data: `npx tsx -e "import {PrismaClient} from '@prisma/client'; const p = new PrismaClient(); p.user.count().then(c => {console.log('users:', c); return p.$disconnect();})"` → `users: 3`.

- [ ] **Step 5: Commit**

```powershell
git add prisma/seed.ts public/placeholder-product.svg package.json package-lock.json
git commit -m "feat: add idempotent seed with users, settings, and demo catalog"
```

---

### Task 8: Auth.js core + login page

**Files:**
- Create: `src/auth.config.ts`, `src/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/login/login-form.tsx`, `src/app/[locale]/(auth)/login/actions.ts`
- Modify: `.env` (add `AUTH_SECRET`), `.env.example`

**Interfaces:**
- Consumes: `prisma` (Task 5), `verifyPassword` (Task 6), seeded users (Task 7), messages `auth.*` (Task 3), shadcn `Button`/`Input`/`Label` (Task 1).
- Produces: `auth()`, `signIn`, `signOut`, `handlers` from `@/auth`; edge-safe `authConfig` from `@/auth.config` (used by middleware in Task 9); `session.user` typed as `{id: string; role: 'ADMIN' | 'SUB_ADMIN' | 'CLIENT'} & DefaultSession['user']`; working `/login` page.

- [ ] **Step 1: Install and generate the secret**

```powershell
npm i next-auth@beta zod
npx auth secret
```

`npx auth secret` writes `AUTH_SECRET` to `.env.local`. Move that line into `.env` (keeping secrets in one file) and ensure `.env.example` documents `AUTH_SECRET=`.

- [ ] **Step 2: Create the edge-safe auth config**

Create `src/auth.config.ts` (no Prisma imports — this file must be importable from middleware):

```ts
import type {NextAuthConfig} from 'next-auth';

export const authConfig = {
  providers: [],
  session: {strategy: 'jwt'},
  pages: {signIn: '/login'},
  callbacks: {
    jwt({token, user}) {
      if (user) token.role = (user as {role?: 'ADMIN' | 'SUB_ADMIN' | 'CLIENT'}).role;
      return token;
    },
    session({session, token}) {
      if (session.user) {
        session.user.role = (token.role ?? 'CLIENT') as 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';
        session.user.id = token.sub ?? '';
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
```

- [ ] **Step 3: Create the full auth setup**

Create `src/auth.ts`:

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {verifyPassword} from '@/lib/password';
import {authConfig} from './auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const {handlers, auth, signIn, signOut} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {email: {}, password: {}},
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: {email: parsed.data.email}
        });
        if (!user || user.archivedAt) return null;
        if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;

        return {id: user.id, name: user.name, email: user.email, role: user.role};
      }
    })
  ]
});
```

Create `src/types/next-auth.d.ts`:

```ts
import type {DefaultSession} from 'next-auth';

type AppRole = 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {id: string; role: AppRole};
  }
  interface User {
    role: AppRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole;
  }
}
```

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import {handlers} from '@/auth';

export const {GET, POST} = handlers;
```

- [ ] **Step 4: Create the login page**

Create `src/app/[locale]/(auth)/login/actions.ts`:

```ts
'use server';

import {AuthError} from 'next-auth';
import {signIn} from '@/auth';

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/'
    });
  } catch (error) {
    if (error instanceof AuthError) return 'invalid';
    throw error; // NEXT_REDIRECT on success must propagate
  }
}
```

Create `src/app/[locale]/(auth)/login/login-form.tsx`:

```tsx
'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {authenticate} from './actions';

export function LoginForm() {
  const t = useTranslations('auth');
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </div>
      {error && <p className="text-sm text-destructive">{t('invalidCredentials')}</p>}
      <Button type="submit" disabled={pending}>
        {t('signIn')}
      </Button>
    </form>
  );
}
```

Create `src/app/[locale]/(auth)/login/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {LoginForm} from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{t('signIn')}</h1>
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 5: Verify manually**

`npm run dev`:
- `/fr/login` renders the form.
- Wrong password → French error message shown.
- `admin@local.test` / `admin123!` → redirected to `/fr`.
- `/ar/login` renders RTL with Arabic labels.
Stop server. Run `npm test` — still green.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: add credentials auth with role-aware JWT sessions and login page"
```

---

### Task 9: Middleware — intl routing + admin role guard

**Files:**
- Modify: `src/middleware.ts` (replace Task 3's intl-only version)

**Interfaces:**
- Consumes: `authConfig` (Task 8), `routing` (Task 3).
- Produces: every non-asset request goes through auth → intl; `/admin` (any locale) requires role `ADMIN` or `SUB_ADMIN`, otherwise redirects to `/{locale}/login`.

- [ ] **Step 1: Replace the middleware**

Replace `src/middleware.ts`:

```ts
import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import {authConfig} from '@/auth.config';
import {routing} from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const {auth} = NextAuth(authConfig);

const ADMIN_PATH = /^\/(?:(?:fr|ar)\/)?admin(?:\/|$)/;

export default auth((req) => {
  const {nextUrl} = req;
  const role = req.auth?.user?.role;

  if (ADMIN_PATH.test(nextUrl.pathname) && role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    const locale = nextUrl.pathname.startsWith('/ar') ? 'ar' : 'fr';
    return Response.redirect(new URL(`/${locale}/login`, nextUrl));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

- [ ] **Step 2: Verify the guard**

`npm run dev`, then without being logged in:
- GET `http://localhost:3000/fr/admin` → 307 redirect to `/fr/login` (check with `curl.exe -I http://localhost:3000/fr/admin` or browser network tab).
- GET `http://localhost:3000/ar/admin` → redirect to `/ar/login`.
- Log in as `admin@local.test`, visit `/fr/admin` → 404 for now (page comes in Task 11) — the point is it no longer redirects.
- Log in as `client@local.test`, visit `/fr/admin` → redirected to login.
Stop server.

- [ ] **Step 3: Commit**

```powershell
git add src/middleware.ts
git commit -m "feat: guard admin routes by role in composed middleware"
```

---

### Task 10: Storefront shell

**Files:**
- Create: `src/app/[locale]/(storefront)/layout.tsx`, `src/components/storefront/site-header.tsx`, `src/components/storefront/site-footer.tsx`, `src/components/logout-button.tsx`
- Move: `src/app/[locale]/page.tsx` → `src/app/[locale]/(storefront)/page.tsx`
- Modify: the moved `page.tsx` (remove the temporary `<ThemeToggle />` from Task 4)

**Interfaces:**
- Consumes: `Link` from `@/i18n/navigation`, `auth`/`signOut` (Task 8), `LanguageSwitcher` (Task 3), `ThemeToggle` (Task 4), messages (Task 3).
- Produces: storefront route group with sticky header (logo, nav, language/theme controls, cart icon placeholder, login/logout) and footer. Later storefront pages (products, cart, checkout) mount inside this group.

- [ ] **Step 1: Create the layout and move the home page**

Create `src/app/[locale]/(storefront)/layout.tsx`:

```tsx
import type {ReactNode} from 'react';
import {SiteFooter} from '@/components/storefront/site-footer';
import {SiteHeader} from '@/components/storefront/site-header';

export default function StorefrontLayout({children}: {children: ReactNode}) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
```

Move `src/app/[locale]/page.tsx` to `src/app/[locale]/(storefront)/page.tsx` and remove the temporary `<ThemeToggle />` import/usage added in Task 4.

- [ ] **Step 2: Create the header, footer, and logout button**

Create `src/components/logout-button.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {signOut} from '@/auth';

export async function LogoutButton() {
  const t = await getTranslations('common');

  return (
    <form
      action={async () => {
        'use server';
        await signOut({redirectTo: '/'});
      }}
    >
      <button type="submit" className="text-sm font-medium hover:underline">
        {t('logout')}
      </button>
    </form>
  );
}
```

Create `src/components/storefront/site-header.tsx`:

```tsx
import {ShoppingCart} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';
import {Link} from '@/i18n/navigation';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';

export async function SiteHeader() {
  const t = await getTranslations();
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold">
          {t('common.siteName')}
        </Link>
        <nav className="ms-6 hidden items-center gap-6 text-sm md:flex">
          <Link href="/" className="hover:underline">
            {t('nav.home')}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <span
            aria-label={t('common.cart')}
            className="flex size-9 items-center justify-center rounded-md border"
          >
            <ShoppingCart className="size-4" />
          </span>
          {session ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="text-sm font-medium hover:underline">
              {t('common.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

Create `src/components/storefront/site-footer.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations();

  return (
    <footer className="border-t py-8">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
        {t('common.siteName')} — {t('footer.copyright')}
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify manually**

`npm run dev`:
- `/fr` shows header (logo start side, controls end side), hero, footer.
- `/ar` mirrors the layout (logo on the right, controls on the left) — confirms logical properties work.
- Logged out: "Se connecter" link → `/fr/login`; after login the header shows "Se déconnecter"; clicking it logs out and returns home.
Stop server. `npm test` green.

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "feat: add storefront shell with header, footer, and session controls"
```

---

### Task 11: Admin shell — sidebar with two blocks + collapse

**Files:**
- Create: `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/admin/page.tsx`, `src/components/admin/admin-sidebar.tsx`, `src/components/admin/admin-header.tsx`
- Create placeholder pages: `src/app/[locale]/admin/clients/page.tsx`, `src/app/[locale]/admin/products/page.tsx`, `src/app/[locale]/admin/orders/page.tsx`, `src/app/[locale]/admin/categories/page.tsx`, `src/app/[locale]/admin/promo-codes/page.tsx`, `src/app/[locale]/admin/sub-admins/page.tsx`, `src/app/[locale]/admin/parameters/page.tsx`

**Interfaces:**
- Consumes: `auth` (Task 8), `Link`/`usePathname`/`redirect` from `@/i18n/navigation` (Task 3), `cn` (Task 1), `LanguageSwitcher`, `ThemeToggle`, `LogoutButton`, messages `admin.*`.
- Produces: `/admin` area layout that later phases fill in: sidebar (Dashboard block: overview/clients/products/orders/categories/promo-codes; Settings block: sub-admins [ADMIN only]/parameters), collapse state persisted in localStorage, header with notification-bell placeholder and session controls. Placeholder page per section.

- [ ] **Step 1: Create the admin layout with server-side guard**

Create `src/app/[locale]/admin/layout.tsx` (defense in depth — middleware already guards, this re-checks):

```tsx
import type {ReactNode} from 'react';
import {getLocale} from 'next-intl/server';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {AdminHeader} from '@/components/admin/admin-header';
import {AdminSidebar} from '@/components/admin/admin-sidebar';

export default async function AdminLayout({children}: {children: ReactNode}) {
  const session = await auth();
  const locale = await getLocale();
  const role = session?.user.role;

  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    redirect({href: '/login', locale});
  }

  return (
    <div className="flex min-h-svh">
      <AdminSidebar isAdmin={role === 'ADMIN'} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader userName={session?.user.name ?? ''} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the sidebar**

Create `src/components/admin/admin-sidebar.tsx`:

```tsx
'use client';

import {useEffect, useState} from 'react';
import {
  FolderTree,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShoppingBag,
  TicketPercent,
  Users
} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

const STORAGE_KEY = 'admin-sidebar-collapsed';

type NavItem = {
  href: string;
  labelKey: 'overview' | 'clients' | 'products' | 'orders' | 'categories' | 'promoCodes' | 'subAdmins' | 'parameters';
  icon: typeof Users;
};

const DASHBOARD_ITEMS: NavItem[] = [
  {href: '/admin', labelKey: 'overview', icon: LayoutDashboard},
  {href: '/admin/clients', labelKey: 'clients', icon: Users},
  {href: '/admin/products', labelKey: 'products', icon: Package},
  {href: '/admin/orders', labelKey: 'orders', icon: ShoppingBag},
  {href: '/admin/categories', labelKey: 'categories', icon: FolderTree},
  {href: '/admin/promo-codes', labelKey: 'promoCodes', icon: TicketPercent}
];

export function AdminSidebar({isAdmin}: {isAdmin: boolean}) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((current) => {
      localStorage.setItem(STORAGE_KEY, current ? '0' : '1');
      return !current;
    });
  }

  const settingsItems: NavItem[] = [
    ...(isAdmin ? ([{href: '/admin/sub-admins', labelKey: 'subAdmins', icon: Shield}] as NavItem[]) : []),
    {href: '/admin/parameters', labelKey: 'parameters', icon: Settings}
  ];

  function renderBlock(title: string, items: NavItem[]) {
    return (
      <div className="px-2 py-3">
        {!collapsed && (
          <p className="px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground">
            {title}
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={t(`nav.${item.labelKey}`)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent',
                    active && 'bg-accent font-medium',
                    collapsed && 'justify-center'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{t(`nav.${item.labelKey}`)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-e bg-background transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          aria-label={t('collapse')}
          onClick={toggle}
          className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      {renderBlock(t('blocks.dashboard'), DASHBOARD_ITEMS)}
      {renderBlock(t('blocks.settings'), settingsItems)}
    </aside>
  );
}
```

- [ ] **Step 3: Create the admin header**

Create `src/components/admin/admin-header.tsx`:

```tsx
import {Bell} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {LanguageSwitcher} from '@/components/language-switcher';
import {LogoutButton} from '@/components/logout-button';
import {ThemeToggle} from '@/components/theme-toggle';

export async function AdminHeader({userName}: {userName: string}) {
  const t = await getTranslations('admin');

  return (
    <header className="flex h-16 items-center gap-2 border-b px-6">
      <div className="ms-auto flex items-center gap-2">
        <span
          aria-label={t('notifications')}
          className="flex size-9 items-center justify-center rounded-md border"
        >
          <Bell className="size-4" />
        </span>
        <LanguageSwitcher />
        <ThemeToggle />
        <span className="ms-2 text-sm font-medium">{userName}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create the overview + placeholder pages**

Create `src/app/[locale]/admin/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';

export default async function AdminOverviewPage() {
  const t = await getTranslations();
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {t('common.welcome')}, {session?.user.name}
      </h1>
      <p className="mt-2 text-muted-foreground">{t('admin.nav.overview')}</p>
    </div>
  );
}
```

Create one placeholder page per section. Each file is identical except for its message key. For `src/app/[locale]/admin/clients/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';

export default async function ClientsPage() {
  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('clients')}</h1>;
}
```

Repeat with the matching key and component name for: `products/page.tsx` (`products`, `ProductsPage`), `orders/page.tsx` (`orders`, `OrdersPage`), `categories/page.tsx` (`categories`, `CategoriesPage`), `promo-codes/page.tsx` (`promoCodes`, `PromoCodesPage`), `parameters/page.tsx` (`parameters`, `ParametersPage`).

`sub-admins/page.tsx` additionally enforces ADMIN-only server-side:

```tsx
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {auth} from '@/auth';

export default async function SubAdminsPage() {
  const session = await auth();
  if (session?.user.role !== 'ADMIN') notFound();

  const t = await getTranslations('admin.nav');

  return <h1 className="text-2xl font-semibold">{t('subAdmins')}</h1>;
}
```

- [ ] **Step 5: Verify manually**

`npm run dev`:
- As `admin@local.test`: `/fr/admin` shows welcome hero, both sidebar blocks including "Sous-admins"; every nav item routes to its placeholder; collapse button shrinks the sidebar to icons and the state survives a reload; `/ar/admin` renders mirrored (sidebar on the right).
- As `subadmin@local.test`: sidebar hides "Sous-admins"; navigating directly to `/fr/admin/sub-admins` → 404.
- As `client@local.test` or logged out: `/fr/admin` redirects to login.
Stop server. `npm test` green.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: add admin shell with two-block collapsible sidebar and role gates"
```

---

### Task 12: README + final verification

**Files:**
- Create/Replace: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: quickstart doc; verified green build.

- [ ] **Step 1: Write the README**

Replace `README.md`:

```markdown
# E-Commerce Platform

Bilingual (FR/AR + RTL) e-commerce platform — Next.js App Router, Prisma + PostgreSQL, Auth.js.
Spec: `docs/superpowers/specs/2026-08-11-ecommerce-platform-design.md`.

## Prerequisites

- Node 20+ and npm
- Docker Desktop (for the dev database)

## Quickstart

```powershell
npm install
docker compose up -d          # PostgreSQL 17 on localhost:5432
copy .env.example .env        # then fill AUTH_SECRET (npx auth secret)
npx prisma migrate dev        # apply schema
npx prisma db seed            # seed users, settings, demo catalog
npm run dev                   # http://localhost:3000
```

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
- Tailwind **logical** utilities only (`ms-`, `me-`, `ps-`, `pe-`) so RTL works.
- Soft delete via `archivedAt` — no hard deletes.
```

- [ ] **Step 2: Full verification**

- Run: `npm test` → all suites pass (money, password, message parity).
- Run: `npm run build` → completes without errors.
- Run: `npx prisma migrate status` → up to date.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: add project README with quickstart"
```

---

## Phase 1 exit criteria

- `npm test` and `npm run build` pass.
- `/fr` and `/ar` render the storefront shell with correct direction; language switcher and dark-mode toggle work on every page.
- Login works for all three seeded roles; `/admin` is reachable only by ADMIN/SUB_ADMIN; sub-admins cannot see or open Sub Admins.
- Sidebar has Dashboard + Settings blocks and a persisted collapsed state.
- Database schema covers all models needed by phases 2–5 (products, categories, orders, promo codes, settings, notifications, push subscriptions).
