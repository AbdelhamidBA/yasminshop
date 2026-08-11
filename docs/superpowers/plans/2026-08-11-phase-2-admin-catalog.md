# Phase 2: Admin Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin can fully manage the catalog: categories (with subcategories), products (multi-image upload, discount, archive), promo codes, and global parameters — with sub-admin restricted server-side to quantity-only edits.

**Architecture:** Server Components fetch via `src/server/*` data-access modules; mutations are Server Actions in per-feature `actions.ts` files returning a typed `ActionResult`; every page and every action repeats its own role check (carry-forward: layout guards don't gate page execution). Images upload through an ADMIN-only API route (sharp → webp on disk under `uploads/`) and are served by a sanitized streaming GET route. UI is shadcn primitives (RTL-audited) + dialog forms with `useActionState`.

**Tech Stack:** Existing Phase 1 stack + `sharp` (image processing), `sonner` (toasts), new shadcn components (table, dialog, alert-dialog, select, textarea, switch, badge), Playwright e2e (already a devDependency).

## Global Constraints

- Everything from the Phase 1 plan's Global Constraints still binds: money = integer millimes (fields end `Millimes`); `fr`/`ar` catalogs stay key-identical with non-empty leaves (test-enforced); only Tailwind logical utilities in project-authored code; soft delete via `archivedAt` (never `.delete()` in app features; e2e fixture cleanup is the sole exception); conventional commits ending with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; version-drift rule (adapt to installed majors per official docs, never downgrade).
- **Carry-forward (spec §6b), binding here:** every data-bearing admin page calls `requirePageStaff()`/role check itself; every server action and API route does its own `requireRole` — the admin layout and middleware are never the only guard. The first migration of this phase adds the FK indexes. Before using new shadcn components in AR-facing UI, rewrite their physical direction classes to logical ones (audit is Task 1).
- **Sub-admin rule (spec):** SUB_ADMIN can view everything but mutate ONLY product quantity (this phase) — enforced in the actions, not just hidden in the UI.
- Roles come from `@/lib/authz` (Task 2) — no ad-hoc `session?.user.role` checks in new code (the Phase 1 sub-admins page may stay as-is).
- Uploaded files live in `<repo>/uploads/` (git-ignored), served only via the sanitized GET route — never from `public/`.
- Environment (unchanged): Windows 10, Node 22, Docker Postgres running (`docker compose up -d`), seeded users (`admin@local.test`/`admin123!`, `subadmin@local.test`/`subadmin123!`). Dev server on port 3000; kill orphaned node processes when done.
- Every task: after implementation run `npx tsc --noEmit` and `npm test` (all suites must stay green) before committing; UI tasks also verify over HTTP with role-scoped session jars (the Phase 1 curl flow: GET `/api/auth/csrf` → POST `/api/auth/callback/credentials` with cookie jar).

---

### Task 1: FK-index migration + RTL-ready shadcn additions + toasts

**Files:**
- Modify: `prisma/schema.prisma` (add `@@index` lines), `src/app/[locale]/layout.tsx` (mount Toaster), `src/components/ui/dropdown-menu.tsx` + `src/components/ui/button.tsx` (logical-class rewrite)
- Create (via shadcn CLI): `src/components/ui/{table,dialog,alert-dialog,select,textarea,switch,badge,checkbox,sonner}.tsx` (file set may differ slightly by CLI version — accept what it generates)
- Create: `prisma/migrations/<ts>_add_fk_indexes/` (generated)

**Interfaces:**
- Consumes: Phase 1 schema and layout.
- Produces: indexed FKs; RTL-safe shadcn primitives; global `<Toaster />` so any client component can `import {toast} from 'sonner'`.

- [ ] **Step 1: Add FK indexes to the schema**

Append inside the matching models in `prisma/schema.prisma` (before each model's closing brace):

```prisma
// in model Category
  @@index([parentId])

// in model Product
  @@index([categoryId])
  @@index([subCategoryId])

// in model ProductImage
  @@index([productId])

// in model Order
  @@index([clientId])

// in model OrderItem
  @@index([orderId])
  @@index([productId])

// in model PushSubscription
  @@index([userId])
```

Run: `npx prisma migrate dev --name add_fk_indexes`
Expected: migration applied; `npx prisma migrate status` → up to date. The generated SQL must contain 8 `CREATE INDEX` statements.

- [ ] **Step 2: Add shadcn components and sonner**

```powershell
npx shadcn@latest add table dialog alert-dialog select textarea switch badge checkbox sonner
```

If `sonner` is delivered as a component wrapper, keep it; also ensure the `sonner` npm package landed in dependencies.

- [ ] **Step 3: RTL audit — rewrite physical classes to logical in ALL of `src/components/ui/`**

In every file under `src/components/ui/` (including the pre-existing `dropdown-menu.tsx` and `button.tsx`), replace Tailwind physical direction utilities with logical equivalents, including variants/arbitrary forms:
`pl-` → `ps-`, `pr-` → `pe-`, `ml-` → `ms-`, `mr-` → `me-`, `left-` → `start-`, `right-` → `end-`, `text-left` → `text-start`, `text-right` → `text-end`, `rounded-l` → `rounded-s`, `rounded-r` → `rounded-e`.
Careful: only class tokens (e.g. `data-[inset]:pl-8` → `data-[inset]:ps-8`, `absolute right-2` → `absolute end-2`); do not touch non-class code.

Verify with: `grep -rnE '(^|[^a-zA-Z-])(pl-|pr-|ml-|mr-|left-|right-|text-left|text-right|rounded-l-|rounded-r-)' src/components src/app --include='*.tsx' --include='*.ts'`
Expected: zero matches (or only matches that are provably not Tailwind class tokens — justify each in the report).

- [ ] **Step 4: Mount the toaster (dir-aware)**

In `src/app/[locale]/layout.tsx`, import the Toaster from the shadcn sonner wrapper (`@/components/ui/sonner`) and render it inside `<ThemeProvider>` after `{children}`'s provider block:

```tsx
<NextIntlClientProvider messages={messages}>
  {children}
  <Toaster dir={locale === 'ar' ? 'rtl' : 'ltr'} position="bottom-center" />
</NextIntlClientProvider>
```

(If the generated wrapper doesn't accept `dir`, pass it through to the underlying sonner `<Sonner />` — edit the wrapper.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` (clean), `npm test` (13/13), `npm run build` (succeeds).

```powershell
git add -A
git commit -m "feat: add fk indexes, rtl-safe shadcn crud components, and toasts"
```

---

### Task 2: Authorization helpers (TDD)

**Files:**
- Create: `src/lib/authz.ts` (pure — unit-testable, NO imports of `@/auth`/prisma/server-only), `src/server/authz.ts` (server wrappers)
- Test: `src/lib/authz.test.ts`

**Interfaces:**
- `@/lib/authz` (pure) produces: `type Role`, `class AuthzError extends Error`, `assertRole(session, ...allowed)` — throws `AuthzError` when session is null or role not allowed.
- `@/server/authz` (server-side; imports `auth` from `@/auth`, `redirect` from `@/i18n/navigation`, `getLocale` from `next-intl/server`) produces:
  - `requireRole(...allowed): Promise<Session>` — for server actions and API routes (throws `AuthzError`)
  - `requireAdmin()` / `requireStaff()` — shorthands for `requireRole('ADMIN')` / `requireRole('ADMIN','SUB_ADMIN')`
  - `requirePageStaff(): Promise<Session>` — for pages: redirects to `/login` (locale-aware) instead of throwing
- **Why the split (binding):** the pure module keeps vitest free of the `@/auth` → prisma → `server-only` import chain (importing `server-only` under plain Node throws). Later tasks import `AuthzError` from `@/lib/authz` and the `require*` helpers from `@/server/authz`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/authz.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import type {Session} from 'next-auth';
import {assertRole, AuthzError} from './authz';

function fakeSession(role: 'ADMIN' | 'SUB_ADMIN' | 'CLIENT'): Session {
  return {
    user: {id: 'u1', role, name: 'T', email: 't@t.t'},
    expires: '2099-01-01T00:00:00.000Z'
  } as Session;
}

describe('assertRole', () => {
  test('passes when the role is allowed', () => {
    expect(() => assertRole(fakeSession('ADMIN'), 'ADMIN')).not.toThrow();
  });

  test('passes when any of several roles matches', () => {
    expect(() => assertRole(fakeSession('SUB_ADMIN'), 'ADMIN', 'SUB_ADMIN')).not.toThrow();
  });

  test('throws AuthzError for a disallowed role', () => {
    expect(() => assertRole(fakeSession('CLIENT'), 'ADMIN', 'SUB_ADMIN')).toThrow(AuthzError);
  });

  test('throws AuthzError for a null session', () => {
    expect(() => assertRole(null, 'ADMIN')).toThrow(AuthzError);
  });
});
```

Run: `npm test` — expected FAIL (`./authz` unresolved).

- [ ] **Step 2: Implement**

Create `src/lib/authz.ts` (pure):

```ts
import type {Session} from 'next-auth';

export type Role = 'ADMIN' | 'SUB_ADMIN' | 'CLIENT';

export class AuthzError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthzError';
  }
}

export function assertRole(
  session: Session | null,
  ...allowed: Role[]
): asserts session is Session {
  if (!session || !allowed.includes(session.user.role)) {
    throw new AuthzError();
  }
}
```

Create `src/server/authz.ts`:

```ts
import 'server-only';
import {getLocale} from 'next-intl/server';
import type {Session} from 'next-auth';
import {auth} from '@/auth';
import {redirect} from '@/i18n/navigation';
import {assertRole, type Role} from '@/lib/authz';

export async function requireRole(...allowed: Role[]): Promise<Session> {
  const session = await auth();
  assertRole(session, ...allowed);
  return session;
}

export const requireAdmin = () => requireRole('ADMIN');
export const requireStaff = () => requireRole('ADMIN', 'SUB_ADMIN');

export async function requirePageStaff(): Promise<Session> {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUB_ADMIN')) {
    redirect({href: '/login', locale: await getLocale()});
  }
  return session as Session;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test` — expected: prior suites + 4 new tests all pass.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/authz.ts src/lib/authz.test.ts src/server/authz.ts
git commit -m "feat: add role assertion and require helpers for admin authz"
```

---

### Task 3: ActionResult type + zod field-error mapping (TDD)

**Files:**
- Create: `src/lib/action-result.ts`
- Test: `src/lib/action-result.test.ts`

**Interfaces:**
- Consumes: `zod` (v4, already installed).
- Produces (exact names): `type ActionResult<T = void> = {ok: true; data: T} | {ok: false; error: string; fieldErrors?: Record<string, string>}`; `fieldErrorsFromZod(error: ZodError): Record<string, string>` (first message per dotted path, `'_'` for empty path); `failure(error: string, fieldErrors?): ActionResult<never>`; `success<T>(data: T): ActionResult<T>`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/action-result.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {z} from 'zod';
import {failure, fieldErrorsFromZod, success} from './action-result';

describe('fieldErrorsFromZod', () => {
  test('maps the first message per field path', () => {
    const schema = z.object({name: z.string().min(2), qty: z.number().int().min(0)});
    const parsed = schema.safeParse({name: '', qty: -1});
    if (parsed.success) throw new Error('expected failure');
    const errors = fieldErrorsFromZod(parsed.error);
    expect(Object.keys(errors).sort()).toEqual(['name', 'qty']);
    expect(typeof errors.name).toBe('string');
  });

  test('joins nested paths with dots', () => {
    const schema = z.object({social: z.object({facebook: z.string().min(1)})});
    const parsed = schema.safeParse({social: {facebook: ''}});
    if (parsed.success) throw new Error('expected failure');
    expect(Object.keys(fieldErrorsFromZod(parsed.error))).toEqual(['social.facebook']);
  });

  test('uses "_" for issues without a path', () => {
    const schema = z.string().refine(() => false, {message: 'nope'});
    const parsed = schema.safeParse('x');
    if (parsed.success) throw new Error('expected failure');
    expect(fieldErrorsFromZod(parsed.error)).toEqual({_: 'nope'});
  });
});

describe('result constructors', () => {
  test('success wraps data', () => {
    expect(success(42)).toEqual({ok: true, data: 42});
  });

  test('failure carries error and fieldErrors', () => {
    expect(failure('invalid', {a: 'b'})).toEqual({ok: false, error: 'invalid', fieldErrors: {a: 'b'}});
  });
});
```

Run: `npm test` — expected FAIL (module unresolved).

- [ ] **Step 2: Implement**

Create `src/lib/action-result.ts`:

```ts
import type {ZodError} from 'zod';

export type ActionResult<T = void> =
  | {ok: true; data: T}
  | {ok: false; error: string; fieldErrors?: Record<string, string>};

export function success<T>(data: T): ActionResult<T> {
  return {ok: true, data};
}

export function failure(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return fieldErrors ? {ok: false, error, fieldErrors} : {ok: false, error};
}

export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test` — all green.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/action-result.ts src/lib/action-result.test.ts
git commit -m "feat: add typed action results with zod field-error mapping"
```

---

### Task 4: Slug, money parsing, and catalog schemas (TDD)

**Files:**
- Create: `src/lib/slugify.ts`, `src/lib/schemas/catalog.ts`
- Modify: `src/lib/money.ts` (add `parseDinarsToMillimes`, `millimesToInput`)
- Test: `src/lib/slugify.test.ts`, `src/lib/money.test.ts` (extend), `src/lib/schemas/catalog.test.ts`

**Interfaces:**
- Produces (exact names):
  - `slugify(input: string): string` (ASCII-only kebab; accents stripped; may return `''` e.g. for pure-Arabic input — callers pass a fallback)
  - `ensureUniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string>` (appends `-2`, `-3`, … ; `'item'` when base is empty)
  - `parseDinarsToMillimes(input: string): number | null` (accepts `12`, `12.5`, `12,500`; max 3 decimals; rejects negatives/garbage)
  - `millimesToInput(millimes: number): string` (e.g. `89000` → `"89.000"` — plain, no thousands grouping, for form defaults)
  - zod schemas: `categorySchema` (`nameFr`, `nameAr` non-empty trimmed; `parentId` optional string → `null` when empty), `promoCodeSchema` (`code` 3–32 chars `[A-Za-z0-9_-]` uppercased, `percentOff` int 1–100, `active` boolean, `expiresAt` `Date | null`), `productSchema` (`reference` 1–64 trimmed, four non-empty text fields, `priceMillimes` int ≥ 0, `discountPct` int 0–100, `quantity` int ≥ 0, `featured` boolean, `categoryId` non-empty, `subCategoryId` optional → `null`, `images` array of `{url, sortOrder}` **min 1**), `parametersSchema` (`deliveryCostMillimes` int ≥ 0, `freeDeliveryThresholdMillimes` int ≥ 0, `currency` 1–8 trimmed, `lastChanceThreshold` int ≥ 0, `copyright`/`siteDescription`/`keywords` strings, `socialLinks` object of `facebook`/`instagram`/`tiktok` strings)
  - `quantitySchema` (`quantity` int ≥ 0) — the sub-admin path.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/slugify.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {ensureUniqueSlug, slugify} from './slugify';

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Casque Sans Fil')).toBe('casque-sans-fil');
  });
  test('strips French accents', () => {
    expect(slugify('Électronique & Té1é')).toBe('electronique-te1e');
  });
  test('returns empty string for pure Arabic input', () => {
    expect(slugify('إلكترونيات')).toBe('');
  });
  test('trims leading/trailing hyphens', () => {
    expect(slugify('--Promo!--')).toBe('promo');
  });
});

describe('ensureUniqueSlug', () => {
  test('returns the base when free', async () => {
    expect(await ensureUniqueSlug('audio', async () => false)).toBe('audio');
  });
  test('appends -2 then -3 while taken', async () => {
    const taken = new Set(['audio', 'audio-2']);
    expect(await ensureUniqueSlug('audio', async (s) => taken.has(s))).toBe('audio-3');
  });
  test('falls back to "item" for an empty base', async () => {
    expect(await ensureUniqueSlug('', async () => false)).toBe('item');
  });
});
```

Append to `src/lib/money.test.ts`:

```ts
describe('parseDinarsToMillimes', () => {
  test('parses whole dinars', () => {
    expect(parseDinarsToMillimes('12')).toBe(12_000);
  });
  test('parses dot decimals up to 3 places', () => {
    expect(parseDinarsToMillimes('12.5')).toBe(12_500);
    expect(parseDinarsToMillimes('0.05')).toBe(50);
    expect(parseDinarsToMillimes('89.000')).toBe(89_000);
  });
  test('accepts comma as decimal separator', () => {
    expect(parseDinarsToMillimes('7,250')).toBe(7_250);
  });
  test('rejects more than 3 decimals, negatives, and garbage', () => {
    expect(parseDinarsToMillimes('1.2345')).toBeNull();
    expect(parseDinarsToMillimes('-1')).toBeNull();
    expect(parseDinarsToMillimes('abc')).toBeNull();
    expect(parseDinarsToMillimes('')).toBeNull();
  });
});

describe('millimesToInput', () => {
  test('renders plain 3-decimal form values', () => {
    expect(millimesToInput(89_000)).toBe('89.000');
    expect(millimesToInput(50)).toBe('0.050');
  });
});
```

(Import the two new functions in that file's import line.)

Create `src/lib/schemas/catalog.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {categorySchema, productSchema, promoCodeSchema} from './catalog';

describe('categorySchema', () => {
  test('empty parentId becomes null', () => {
    const parsed = categorySchema.parse({nameFr: 'Audio', nameAr: 'صوتيات', parentId: ''});
    expect(parsed.parentId).toBeNull();
  });
  test('rejects blank names', () => {
    expect(categorySchema.safeParse({nameFr: ' ', nameAr: 'x'}).success).toBe(false);
  });
});

describe('promoCodeSchema', () => {
  test('uppercases the code', () => {
    const parsed = promoCodeSchema.parse({code: 'ete-2026', percentOff: 10, active: true, expiresAt: null});
    expect(parsed.code).toBe('ETE-2026');
  });
  test('rejects percentOff outside 1..100', () => {
    expect(promoCodeSchema.safeParse({code: 'ABC', percentOff: 0, active: true, expiresAt: null}).success).toBe(false);
    expect(promoCodeSchema.safeParse({code: 'ABC', percentOff: 101, active: true, expiresAt: null}).success).toBe(false);
  });
});

describe('productSchema', () => {
  const valid = {
    reference: 'REF-1',
    nameFr: 'Casque',
    nameAr: 'سماعات',
    descriptionFr: 'Desc',
    descriptionAr: 'وصف',
    priceMillimes: 89_000,
    discountPct: 0,
    quantity: 5,
    featured: false,
    categoryId: 'c1',
    subCategoryId: '',
    images: [{url: '/api/uploads/products/x.webp', sortOrder: 0}]
  };
  test('accepts a valid product and nulls empty subCategoryId', () => {
    const parsed = productSchema.parse(valid);
    expect(parsed.subCategoryId).toBeNull();
  });
  test('requires at least one image', () => {
    expect(productSchema.safeParse({...valid, images: []}).success).toBe(false);
  });
  test('rejects discount above 100', () => {
    expect(productSchema.safeParse({...valid, discountPct: 101}).success).toBe(false);
  });
});
```

Run: `npm test` — expected FAIL (unresolved modules / missing exports).

- [ ] **Step 2: Implement**

Create `src/lib/slugify.ts`:

```ts
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function ensureUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = base || 'item';
  let candidate = root;
  for (let i = 2; await isTaken(candidate); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}
```

Note: the first `.replace` character class is the literal combining-mark range U+0300–U+036F; writing it as `/[̀-ͯ]/g` is equivalent and preferred if your editor mangles the literal form — the accent test catches either mistake.

Append to `src/lib/money.ts`:

```ts
export function parseDinarsToMillimes(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const [dinars, decimals = ''] = trimmed.split('.');
  return parseInt(dinars, 10) * 1000 + parseInt((decimals + '000').slice(0, 3), 10);
}

export function millimesToInput(millimes: number): string {
  const dinars = Math.trunc(millimes / 1000);
  const rest = (millimes % 1000).toString().padStart(3, '0');
  return `${dinars}.${rest}`;
}
```

Create `src/lib/schemas/catalog.ts`:

```ts
import {z} from 'zod';

const optionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : null));

export const categorySchema = z.object({
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  parentId: optionalId
});
export type CategoryInput = z.output<typeof categorySchema>;

export const promoCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((v) => v.toUpperCase()),
  percentOff: z.number().int().min(1).max(100),
  active: z.boolean(),
  expiresAt: z.date().nullable()
});
export type PromoCodeInput = z.output<typeof promoCodeSchema>;

export const productImageSchema = z.object({
  url: z.string().min(1),
  sortOrder: z.number().int().min(0)
});

export const productSchema = z.object({
  reference: z.string().trim().min(1).max(64),
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  descriptionFr: z.string().trim().min(1),
  descriptionAr: z.string().trim().min(1),
  priceMillimes: z.number().int().min(0),
  discountPct: z.number().int().min(0).max(100),
  quantity: z.number().int().min(0),
  featured: z.boolean(),
  categoryId: z.string().min(1),
  subCategoryId: optionalId,
  images: z.array(productImageSchema).min(1)
});
export type ProductInput = z.output<typeof productSchema>;

export const quantitySchema = z.object({
  quantity: z.number().int().min(0)
});

export const parametersSchema = z.object({
  deliveryCostMillimes: z.number().int().min(0),
  freeDeliveryThresholdMillimes: z.number().int().min(0),
  currency: z.string().trim().min(1).max(8),
  lastChanceThreshold: z.number().int().min(0),
  copyright: z.string().trim(),
  siteDescription: z.string().trim(),
  keywords: z.string().trim(),
  socialLinks: z.object({
    facebook: z.string().trim(),
    instagram: z.string().trim(),
    tiktok: z.string().trim()
  })
});
export type ParametersInput = z.output<typeof parametersSchema>;
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test` — all suites green (old + new).

- [ ] **Step 4: Commit**

```powershell
git add src/lib/slugify.ts src/lib/slugify.test.ts src/lib/money.ts src/lib/money.test.ts src/lib/schemas
git commit -m "feat: add slug, dinars parsing, and catalog validation schemas"
```

---

### Task 5: Categories data-access + server actions

**Files:**
- Create: `src/server/categories.ts`, `src/app/[locale]/admin/categories/actions.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `requireAdmin`/`AuthzError` (`@/lib/authz`), `categorySchema`, `slugify`/`ensureUniqueSlug`, `ActionResult` helpers.
- Produces:
  - `listRootCategories(includeArchived: boolean)` — roots ordered by `nameFr`, each with `children` (same archived filter, ordered) and `_count.products`; children include `_count.products`. Return type is the inferred Prisma payload; export it as `type CategoryRow = Awaited<ReturnType<typeof listRootCategories>>[number]`.
  - `listParentOptions()` — non-archived roots `{id, nameFr, nameAr}` for the parent `<select>`.
  - Actions (all return `Promise<ActionResult>`): `createCategory(formData: FormData)`, `updateCategory(id: string, formData: FormData)`, `archiveCategory(id: string)`, `restoreCategory(id: string)`.

**Business rules (binding):** two levels max — a parent must be a non-archived root; a category that has children cannot itself be given a parent; a category cannot be its own parent. Archiving a root archives its children in the same transaction; restoring a root restores its children. Slug is generated from `nameFr` on create only (`ensureUniqueSlug(slugify(nameFr) || 'categorie', …)`); updates never change the slug.

- [ ] **Step 1: Implement the data-access module**

Create `src/server/categories.ts`:

```ts
import 'server-only';
import {prisma} from '@/lib/db';

export async function listRootCategories(includeArchived: boolean) {
  const archivedFilter = includeArchived ? {} : {archivedAt: null};
  return prisma.category.findMany({
    where: {parentId: null, ...archivedFilter},
    orderBy: {nameFr: 'asc'},
    include: {
      children: {
        where: archivedFilter,
        orderBy: {nameFr: 'asc'},
        include: {_count: {select: {products: true}}}
      },
      _count: {select: {products: true}}
    }
  });
}

export type CategoryRow = Awaited<ReturnType<typeof listRootCategories>>[number];

export async function listParentOptions() {
  return prisma.category.findMany({
    where: {parentId: null, archivedAt: null},
    orderBy: {nameFr: 'asc'},
    select: {id: true, nameFr: true, nameAr: true}
  });
}

export async function listCategoryTree() {
  return prisma.category.findMany({
    where: {parentId: null, archivedAt: null},
    orderBy: {nameFr: 'asc'},
    select: {
      id: true,
      nameFr: true,
      nameAr: true,
      children: {
        where: {archivedAt: null},
        orderBy: {nameFr: 'asc'},
        select: {id: true, nameFr: true, nameAr: true}
      }
    }
  });
}

export type CategoryTreeNode = Awaited<ReturnType<typeof listCategoryTree>>[number];
```

(`listCategoryTree` is consumed by the product form in Task 11.)

- [ ] **Step 2: Implement the actions**

Create `src/app/[locale]/admin/categories/actions.ts`:

```ts
'use server';

import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {prisma} from '@/lib/db';
import {categorySchema} from '@/lib/schemas/catalog';
import {ensureUniqueSlug, slugify} from '@/lib/slugify';

const PATH = '/[locale]/admin/categories';

function formToInput(formData: FormData) {
  return {
    nameFr: String(formData.get('nameFr') ?? ''),
    nameAr: String(formData.get('nameAr') ?? ''),
    parentId: String(formData.get('parentId') ?? '')
  };
}

async function validateParent(parentId: string | null, selfId?: string): Promise<string | null> {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return 'invalidParent';
  const parent = await prisma.category.findUnique({where: {id: parentId}});
  if (!parent || parent.archivedAt || parent.parentId !== null) return 'invalidParent';
  if (selfId) {
    const childCount = await prisma.category.count({where: {parentId: selfId}});
    if (childCount > 0) return 'hasChildren';
  }
  return null;
}

export async function createCategory(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(formToInput(formData));
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    const parentError = await validateParent(parsed.data.parentId);
    if (parentError) return failure(parentError);

    const slug = await ensureUniqueSlug(
      slugify(parsed.data.nameFr) || 'categorie',
      async (s) => (await prisma.category.count({where: {slug: s}})) > 0
    );
    await prisma.category.create({
      data: {nameFr: parsed.data.nameFr, nameAr: parsed.data.nameAr, parentId: parsed.data.parentId, slug}
    });
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse(formToInput(formData));
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    const existing = await prisma.category.findUnique({where: {id}});
    if (!existing) return failure('notFound');
    const parentError = await validateParent(parsed.data.parentId, id);
    if (parentError) return failure(parentError);

    await prisma.category.update({
      where: {id},
      data: {nameFr: parsed.data.nameFr, nameAr: parsed.data.nameAr, parentId: parsed.data.parentId}
    });
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const now = new Date();
    await prisma.$transaction([
      prisma.category.update({where: {id}, data: {archivedAt: now}}),
      prisma.category.updateMany({where: {parentId: id}, data: {archivedAt: now}})
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.$transaction([
      prisma.category.update({where: {id}, data: {archivedAt: null}}),
      prisma.category.updateMany({where: {parentId: id}, data: {archivedAt: null}})
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
```

- [ ] **Step 3: Verify with a throwaway integration script**

Write a throwaway tsx script under `.superpowers/` (not committed) that imports `prisma` directly and exercises: create root, create child under it, reject grandchild (child as parent → `invalidParent` path can be simulated by calling `validateParent` logic via the action with a child parentId — actions need a session, so instead verify the DATA rules directly with prisma: attempt the same checks the action makes). Minimum to prove: slug uniqueness (`categorie`, `categorie-2`) via two creates with the same French name through `ensureUniqueSlug`, and cascade archive/restore via the same two `$transaction` calls. Clean up the created test rows by hard delete in the script (fixtures only). Run `npx tsc --noEmit` and `npm test`.

- [ ] **Step 4: Commit**

```powershell
git add src/server/categories.ts "src/app/[locale]/admin/categories/actions.ts"
git commit -m "feat: add categories data-access and admin server actions"
```

---

### Task 6: Categories UI

**Files:**
- Modify: `src/app/[locale]/admin/categories/page.tsx` (replace placeholder), `messages/fr.json`, `messages/ar.json`
- Create: `src/app/[locale]/admin/categories/categories-table.tsx`, `src/app/[locale]/admin/categories/category-form-dialog.tsx`

**Interfaces:**
- Consumes: `listRootCategories`/`listParentOptions`/`CategoryRow` (Task 5), actions (Task 5), `requirePageStaff` (Task 2), shadcn `Table/Dialog/AlertDialog/Select/Badge/Button/Input/Label/DropdownMenu`, `toast` from `sonner`, `useLocale`/`useTranslations`.
- Produces: working `/admin/categories` for both roles (ADMIN mutates; SUB_ADMIN read-only — mutation controls not rendered).

- [ ] **Step 1: Add the i18n keys (both catalogs — keep key sets identical)**

Add under `admin` in `messages/fr.json`:

```json
"categories": {
  "title": "Catégories",
  "add": "Ajouter une catégorie",
  "edit": "Modifier la catégorie",
  "nameFr": "Nom (français)",
  "nameAr": "Nom (arabe)",
  "parent": "Catégorie parente",
  "noParent": "Aucune (catégorie racine)",
  "slug": "Slug",
  "products": "Produits",
  "actions": "Actions",
  "archive": "Archiver",
  "restore": "Restaurer",
  "archived": "Archivée",
  "showArchived": "Afficher les archivées",
  "confirmArchiveTitle": "Archiver cette catégorie ?",
  "confirmArchiveBody": "La catégorie et ses sous-catégories seront masquées de la boutique.",
  "cancel": "Annuler",
  "save": "Enregistrer",
  "saved": "Catégorie enregistrée.",
  "archivedToast": "Catégorie archivée.",
  "restoredToast": "Catégorie restaurée.",
  "empty": "Aucune catégorie pour le moment.",
  "errors": {
    "validation": "Veuillez corriger les champs en rouge.",
    "invalidParent": "Catégorie parente invalide.",
    "hasChildren": "Une catégorie avec des sous-catégories ne peut pas avoir de parent.",
    "notFound": "Catégorie introuvable.",
    "forbidden": "Action non autorisée."
  }
}
```

And the Arabic equivalents under `admin.categories` in `messages/ar.json`:

```json
"categories": {
  "title": "الفئات",
  "add": "إضافة فئة",
  "edit": "تعديل الفئة",
  "nameFr": "الاسم (بالفرنسية)",
  "nameAr": "الاسم (بالعربية)",
  "parent": "الفئة الأم",
  "noParent": "بدون (فئة رئيسية)",
  "slug": "المعرّف",
  "products": "المنتجات",
  "actions": "إجراءات",
  "archive": "أرشفة",
  "restore": "استعادة",
  "archived": "مؤرشفة",
  "showArchived": "عرض المؤرشفة",
  "confirmArchiveTitle": "أرشفة هذه الفئة؟",
  "confirmArchiveBody": "سيتم إخفاء الفئة وفئاتها الفرعية من المتجر.",
  "cancel": "إلغاء",
  "save": "حفظ",
  "saved": "تم حفظ الفئة.",
  "archivedToast": "تمت أرشفة الفئة.",
  "restoredToast": "تمت استعادة الفئة.",
  "empty": "لا توجد فئات بعد.",
  "errors": {
    "validation": "يرجى تصحيح الحقول المحددة بالأحمر.",
    "invalidParent": "الفئة الأم غير صالحة.",
    "hasChildren": "فئة تحتوي على فئات فرعية لا يمكن أن تكون لها فئة أم.",
    "notFound": "الفئة غير موجودة.",
    "forbidden": "إجراء غير مسموح به."
  }
}
```

Run `npm test` — the parity suite must stay green.

- [ ] **Step 2: Replace the page**

Replace `src/app/[locale]/admin/categories/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {listParentOptions, listRootCategories} from '@/server/categories';
import {CategoriesTable} from './categories-table';

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{archived?: string}>;
}) {
  const session = await requirePageStaff();
  const {archived} = await searchParams;
  const includeArchived = archived === '1';
  const t = await getTranslations('admin.categories');
  const [categories, parentOptions] = await Promise.all([
    listRootCategories(includeArchived),
    listParentOptions()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <CategoriesTable
        categories={categories}
        parentOptions={parentOptions}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the table component**

Create `src/app/[locale]/admin/categories/categories-table.tsx` — a client component. Requirements (write clean code following the admin-sidebar's idioms):

```tsx
'use client';

import {useState, useTransition} from 'react';
import {MoreHorizontal, Plus} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {Link} from '@/i18n/navigation';
import type {CategoryRow} from '@/server/categories';
import {archiveCategory, restoreCategory} from './actions';
import {CategoryFormDialog, type EditableCategory} from './category-form-dialog';

type ParentOption = {id: string; nameFr: string; nameAr: string};

export function CategoriesTable({
  categories,
  parentOptions,
  isAdmin,
  includeArchived
}: {
  categories: CategoryRow[];
  parentOptions: ParentOption[];
  isAdmin: boolean;
  includeArchived: boolean;
}) {
  const t = useTranslations('admin.categories');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const name = (row: {nameFr: string; nameAr: string}) => (locale === 'ar' ? row.nameAr : row.nameFr);

  function runArchive(id: string) {
    startTransition(async () => {
      const result = await archiveCategory(id);
      if (result.ok) toast.success(t('archivedToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function runRestore(id: string) {
    startTransition(async () => {
      const result = await restoreCategory(id);
      if (result.ok) toast.success(t('restoredToast'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  function renderRow(row: CategoryRow | CategoryRow['children'][number], isChild: boolean) {
    const archived = row.archivedAt !== null;
    return (
      <TableRow key={row.id}>
        <TableCell className={isChild ? 'ps-8' : 'font-medium'}>
          {name(row)}
          {archived && <Badge variant="outline" className="ms-2">{t('archived')}</Badge>}
        </TableCell>
        <TableCell dir="ltr" className="text-muted-foreground">{row.slug}</TableCell>
        <TableCell>{row._count.products}</TableCell>
        {isAdmin && (
          <TableCell className="text-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('actions')} disabled={pending}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    setEditing({
                      id: row.id,
                      nameFr: row.nameFr,
                      nameAr: row.nameAr,
                      parentId: 'parentId' in row ? row.parentId : null
                    })
                  }
                >
                  {t('edit')}
                </DropdownMenuItem>
                {archived ? (
                  <DropdownMenuItem onSelect={() => runRestore(row.id)}>{t('restore')}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setConfirmArchiveId(row.id)}>{t('archive')}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {t('add')}
          </Button>
        )}
        <Link
          href={includeArchived ? '/admin/categories' : '/admin/categories?archived=1'}
          className="ms-auto text-sm underline-offset-4 hover:underline"
        >
          {t('showArchived')}
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('title')}</TableHead>
                <TableHead>{t('slug')}</TableHead>
                <TableHead>{t('products')}</TableHead>
                {isAdmin && <TableHead className="text-end">{t('actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.flatMap((root) => [
                renderRow(root, false),
                ...root.children.map((child) => renderRow(child, true))
              ])}
            </TableBody>
          </Table>
        </div>
      )}

      {isAdmin && (
        <>
          <CategoryFormDialog
            open={creating}
            onOpenChange={setCreating}
            parentOptions={parentOptions}
            category={null}
          />
          <CategoryFormDialog
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            parentOptions={parentOptions.filter((p) => p.id !== editing?.id)}
            category={editing}
          />
          <AlertDialog open={confirmArchiveId !== null} onOpenChange={(open) => !open && setConfirmArchiveId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmArchiveTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('confirmArchiveBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (confirmArchiveId) runArchive(confirmArchiveId);
                    setConfirmArchiveId(null);
                  }}
                >
                  {t('archive')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the form dialog**

Create `src/app/[locale]/admin/categories/category-form-dialog.tsx`:

```tsx
'use client';

import {useEffect, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {createCategory, updateCategory} from './actions';

export type EditableCategory = {
  id: string;
  nameFr: string;
  nameAr: string;
  parentId: string | null;
};

const NO_PARENT = 'none';

export function CategoryFormDialog({
  open,
  onOpenChange,
  parentOptions,
  category
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOptions: Array<{id: string; nameFr: string; nameAr: string}>;
  category: EditableCategory | null;
}) {
  const t = useTranslations('admin.categories');
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [parentId, setParentId] = useState<string>(NO_PARENT);

  useEffect(() => {
    if (open) {
      setFieldErrors({});
      setParentId(category?.parentId ?? NO_PARENT);
    }
  }, [open, category]);

  function submit(formData: FormData) {
    formData.set('parentId', parentId === NO_PARENT ? '' : parentId);
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, formData)
        : await createCategory(formData);
      if (result.ok) {
        toast.success(t('saved'));
        onOpenChange(false);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(t(`errors.${result.error}` as never));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t('edit') : t('add')}</DialogTitle>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nameFr">{t('nameFr')}</Label>
            <Input id="nameFr" name="nameFr" defaultValue={category?.nameFr ?? ''} required />
            {fieldErrors.nameFr && <p className="text-sm text-destructive">{fieldErrors.nameFr}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nameAr">{t('nameAr')}</Label>
            <Input id="nameAr" name="nameAr" dir="rtl" defaultValue={category?.nameAr ?? ''} required />
            {fieldErrors.nameAr && <p className="text-sm text-destructive">{fieldErrors.nameAr}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('parent')}</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>{t('noParent')}</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nameFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Verify over HTTP + gates**

Dev server up; with an ADMIN jar: GET `/fr/admin/categories` → 200 containing the seeded "Électronique" root and indented "Audio" child, the add button, and the actions column. With a SUB_ADMIN jar: 200, no add button, no actions column. `/ar/admin/categories` → RTL with Arabic names shown. `?archived=1` renders too. (Dialog interactions are exercised in Task 13's Playwright spec — don't hand-verify clicks here.) `npx tsc --noEmit`, `npm test`, `npm run build` all clean. Kill the server.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: add categories management ui with role-aware controls"
```

---

### Task 7: Image upload infrastructure (TDD for pure parts)

**Files:**
- Create: `src/lib/uploads.ts`, `src/app/api/uploads/route.ts`, `src/app/api/uploads/[...path]/route.ts`
- Test: `src/lib/uploads.test.ts`
- Modify: `.gitignore` (add `uploads/`), `package.json` (sharp)

**Interfaces:**
- Consumes: `requireRole`/`AuthzError` (Task 2), `sharp`.
- Produces:
  - `ALLOWED_IMAGE_TYPES: ReadonlySet<string>` = `image/jpeg`, `image/png`, `image/webp`, `image/avif`
  - `MAX_UPLOAD_BYTES = 8 * 1024 * 1024`
  - `isSafeUploadPath(segments: string[]): boolean` — every segment matches `/^[a-z0-9][a-z0-9._-]*$/i`, none contains `..`
  - `POST /api/uploads` (ADMIN only): multipart field `file` → processed to webp (max 1600×1600, `fit: 'inside'`, `withoutEnlargement`, quality 82, `.rotate()` for EXIF) → saved as `uploads/products/<randomUUID>.webp` → `200 {url: "/api/uploads/products/<name>.webp"}`; `401/403` unauthenticated/unauthorized, `400` bad type/size (`{error}`)
  - `GET /api/uploads/[...path]`: streams the file with `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`; `400` unsafe path; `404` missing.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/uploads.test.ts`:

```ts
import {describe, expect, test} from 'vitest';
import {ALLOWED_IMAGE_TYPES, isSafeUploadPath, MAX_UPLOAD_BYTES} from './uploads';

describe('isSafeUploadPath', () => {
  test('accepts a normal nested path', () => {
    expect(isSafeUploadPath(['products', 'abc-123.webp'])).toBe(true);
  });
  test('rejects traversal segments', () => {
    expect(isSafeUploadPath(['..', 'secret'])).toBe(false);
    expect(isSafeUploadPath(['products', '..%2f..'])).toBe(false);
  });
  test('rejects empty and hidden segments', () => {
    expect(isSafeUploadPath([''])).toBe(false);
    expect(isSafeUploadPath(['.hidden'])).toBe(false);
  });
  test('rejects backslashes and separators inside segments', () => {
    expect(isSafeUploadPath(['a\\b.webp'])).toBe(false);
    expect(isSafeUploadPath(['a/b.webp'])).toBe(false);
  });
});

describe('constants', () => {
  test('allows the four image mime types', () => {
    expect([...ALLOWED_IMAGE_TYPES].sort()).toEqual([
      'image/avif', 'image/jpeg', 'image/png', 'image/webp'
    ]);
  });
  test('caps uploads at 8MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });
});
```

Run: `npm test` — expected FAIL.

- [ ] **Step 2: Implement the pure module**

Create `src/lib/uploads.ts`:

```ts
export const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif'
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/i;

export function isSafeUploadPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  return segments.every(
    (segment) =>
      SEGMENT_RE.test(segment) &&
      !segment.includes('..') &&
      !segment.includes('/') &&
      !segment.includes('\\')
  );
}
```

Run: `npm test` — green.

- [ ] **Step 3: Install sharp and implement the routes**

```powershell
npm i sharp
```

Create `src/app/api/uploads/route.ts`:

```ts
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import sharp from 'sharp';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES} from '@/lib/uploads';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'products');

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({error: 'forbidden'}, {status: 403});
    }
    throw error;
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({error: 'missingFile'}, {status: 400});
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({error: 'unsupportedType'}, {status: 400});
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({error: 'tooLarge'}, {status: 400});
  }

  const source = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await sharp(source)
      .rotate()
      .resize({width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true})
      .webp({quality: 82})
      .toBuffer();
  } catch {
    return NextResponse.json({error: 'invalidImage'}, {status: 400});
  }

  const name = `${randomUUID()}.webp`;
  await mkdir(UPLOAD_DIR, {recursive: true});
  await writeFile(path.join(UPLOAD_DIR, name), processed);

  return NextResponse.json({url: `/api/uploads/products/${name}`});
}
```

Create `src/app/api/uploads/[...path]/route.ts`:

```ts
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {isSafeUploadPath} from '@/lib/uploads';

const ROOT = path.join(process.cwd(), 'uploads');

export async function GET(
  _request: Request,
  {params}: {params: Promise<{path: string[]}>}
) {
  const {path: segments} = await params;
  if (!isSafeUploadPath(segments)) {
    return NextResponse.json({error: 'badPath'}, {status: 400});
  }
  try {
    const file = await readFile(path.join(ROOT, ...segments));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return NextResponse.json({error: 'notFound'}, {status: 404});
  }
}
```

Append to `.gitignore`:

```
# runtime image uploads (served via /api/uploads)
uploads/
```

- [ ] **Step 4: Verify over HTTP**

Dev server up. Generate a small PNG on the fly (e.g. tsx one-liner with sharp: `sharp({create:{width:10,height:10,channels:3,background:{r:200,g:0,b:0}}}).png().toFile('.superpowers/test.png')`). Then:
- No session: `curl -F "file=@.superpowers/test.png" http://localhost:3000/api/uploads` → 403.
- ADMIN jar: same POST → 200 with a `/api/uploads/products/*.webp` url; GET that url → 200, `content-type: image/webp`.
- GET `/api/uploads/../prisma/schema.prisma` and `/api/uploads/products/..%2f..%2f.env` → 400/404 (never file contents).
- SUB_ADMIN jar: POST → 403.
Gates: `npx tsc --noEmit`, `npm test`, `npm run build`. Kill the server; delete the throwaway png.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/uploads.ts src/lib/uploads.test.ts src/app/api/uploads .gitignore package.json package-lock.json
git commit -m "feat: add admin image upload pipeline with sharp and safe serving route"
```

---

### Task 8: Settings data-access + Parameters screen

**Files:**
- Create: `src/server/settings.ts`, `src/app/[locale]/admin/parameters/actions.ts`, `src/app/[locale]/admin/parameters/parameters-form.tsx`
- Modify: `src/app/[locale]/admin/parameters/page.tsx` (replace placeholder), `messages/fr.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `prisma`, authz, `parametersSchema`, `parseDinarsToMillimes`/`millimesToInput`, shadcn form primitives, `toast`.
- Produces:
  - `type Parameters = z.output<typeof parametersSchema>` re-exported as `AppParameters` from `@/server/settings`
  - `getParameters(): Promise<AppParameters>` — reads all Setting rows, merges over `DEFAULT_PARAMETERS` (exported; matches the seed values), tolerant of missing keys
  - `saveParameters(input: AppParameters): Promise<void>` — upserts each key in a transaction (`massDiscountPct` untouched — Phase 5 owns it)
  - Action `updateParameters(formData: FormData): Promise<ActionResult>` (ADMIN only; parses dinars fields with `parseDinarsToMillimes`, returns `fieldErrors` keyed `deliveryCost`/`freeDeliveryThreshold` when parsing fails)
  - `/admin/parameters` page: ADMIN gets the editable form; SUB_ADMIN gets the same data rendered read-only (`fieldset disabled` + no submit).

- [ ] **Step 1: Implement `src/server/settings.ts`**

```ts
import 'server-only';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/db';
import {parametersSchema, type ParametersInput} from '@/lib/schemas/catalog';

export type AppParameters = ParametersInput;

export const DEFAULT_PARAMETERS: AppParameters = {
  deliveryCostMillimes: 7000,
  freeDeliveryThresholdMillimes: 100_000,
  currency: 'TND',
  lastChanceThreshold: 5,
  copyright: '© 2026 Ma Boutique',
  siteDescription: '',
  keywords: '',
  socialLinks: {facebook: '', instagram: '', tiktok: ''}
};

export async function getParameters(): Promise<AppParameters> {
  const rows = await prisma.setting.findMany();
  const raw: Record<string, unknown> = {...DEFAULT_PARAMETERS};
  for (const row of rows) {
    if (row.key in DEFAULT_PARAMETERS) raw[row.key] = row.value;
  }
  const parsed = parametersSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PARAMETERS;
}

export async function saveParameters(input: AppParameters): Promise<void> {
  const entries = Object.entries(input) as Array<[string, unknown]>;
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: {key},
        update: {value: value as Prisma.InputJsonValue},
        create: {key, value: value as Prisma.InputJsonValue}
      })
    )
  );
}
```

- [ ] **Step 2: Implement the action**

Create `src/app/[locale]/admin/parameters/actions.ts`:

```ts
'use server';

import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin} from '@/server/authz';
import {parseDinarsToMillimes} from '@/lib/money';
import {parametersSchema} from '@/lib/schemas/catalog';
import {saveParameters} from '@/server/settings';

export async function updateParameters(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();

    const deliveryCostMillimes = parseDinarsToMillimes(String(formData.get('deliveryCost') ?? ''));
    const freeDeliveryThresholdMillimes = parseDinarsToMillimes(
      String(formData.get('freeDeliveryThreshold') ?? '')
    );
    const dinarErrors: Record<string, string> = {};
    if (deliveryCostMillimes === null) dinarErrors.deliveryCost = 'invalidAmount';
    if (freeDeliveryThresholdMillimes === null) dinarErrors.freeDeliveryThreshold = 'invalidAmount';
    if (Object.keys(dinarErrors).length > 0) return failure('validation', dinarErrors);

    const lastChance = Number.parseInt(String(formData.get('lastChanceThreshold') ?? ''), 10);
    const parsed = parametersSchema.safeParse({
      deliveryCostMillimes,
      freeDeliveryThresholdMillimes,
      currency: String(formData.get('currency') ?? ''),
      lastChanceThreshold: Number.isNaN(lastChance) ? -1 : lastChance,
      copyright: String(formData.get('copyright') ?? ''),
      siteDescription: String(formData.get('siteDescription') ?? ''),
      keywords: String(formData.get('keywords') ?? ''),
      socialLinks: {
        facebook: String(formData.get('facebook') ?? ''),
        instagram: String(formData.get('instagram') ?? ''),
        tiktok: String(formData.get('tiktok') ?? '')
      }
    });
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));

    await saveParameters(parsed.data);
    revalidatePath('/[locale]/admin/parameters', 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
```

- [ ] **Step 3: i18n keys**

Add under `admin` in both catalogs (French / Arabic values respectively — same key set):

`parameters`: `title` ("Paramètres généraux" / "الإعدادات العامة"), `delivery` ("Livraison" / "التوصيل"), `deliveryCost` ("Coût de livraison (DT)" / "تكلفة التوصيل (د.ت)"), `freeDeliveryThreshold` ("Livraison gratuite à partir de (DT)" / "توصيل مجاني ابتداءً من (د.ت)"), `currency` ("Devise" / "العملة"), `lastChanceThreshold` ("Seuil dernière chance (stock)" / "حد فرصة أخيرة (المخزون)"), `site` ("Site" / "الموقع"), `copyright` ("Copyright" / "حقوق النشر"), `siteDescription` ("Description du site" / "وصف الموقع"), `keywords` ("Mots-clés" / "كلمات مفتاحية"), `social` ("Réseaux sociaux" / "شبكات التواصل"), `facebook` ("Facebook" / "فيسبوك"), `instagram` ("Instagram" / "إنستغرام"), `tiktok` ("TikTok" / "تيك توك"), `save` ("Enregistrer" / "حفظ"), `saved` ("Paramètres enregistrés." / "تم حفظ الإعدادات."), `readOnly` ("Lecture seule — seul l'administrateur peut modifier." / "للعرض فقط — يمكن للمدير فقط التعديل."), `errors.validation` ("Veuillez corriger les champs en rouge." / "يرجى تصحيح الحقول المحددة بالأحمر."), `errors.invalidAmount` ("Montant invalide (ex. 7.500)." / "مبلغ غير صالح (مثال 7.500)."), `errors.forbidden` ("Action non autorisée." / "إجراء غير مسموح به.")

Parity test must stay green.

- [ ] **Step 4: Page + form**

Replace `src/app/[locale]/admin/parameters/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {getParameters} from '@/server/settings';
import {ParametersForm} from './parameters-form';

export default async function ParametersPage() {
  const session = await requirePageStaff();
  const t = await getTranslations('admin.parameters');
  const parameters = await getParameters();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {session.user.role !== 'ADMIN' && (
        <p className="text-sm text-muted-foreground">{t('readOnly')}</p>
      )}
      <ParametersForm parameters={parameters} readOnly={session.user.role !== 'ADMIN'} />
    </div>
  );
}
```

Create `src/app/[locale]/admin/parameters/parameters-form.tsx` — client component: one `<form action={submit}>` inside `<fieldset disabled={readOnly || pending}>`, sections `delivery` / `site` / `social` with `<h2>` from the keys above; inputs (all with `Label` + error line pattern from Task 6's dialog):
- `deliveryCost` (`dir="ltr"`, `defaultValue={millimesToInput(parameters.deliveryCostMillimes)}`), `freeDeliveryThreshold` (same pattern), `currency`, `lastChanceThreshold` (`type="number" min={0}`), `copyright`, `siteDescription` (`Textarea`), `keywords`, `facebook`/`instagram`/`tiktok` (`dir="ltr"`).
- `submit(formData)` uses `startTransition` + `updateParameters(formData)`; on ok `toast.success(t('saved'))`, else set `fieldErrors` and `toast.error(t('errors.validation'))` — map `invalidAmount` field errors through `t('errors.invalidAmount')`.
- No submit button when `readOnly`.

- [ ] **Step 5: Verify over HTTP + gates**

ADMIN jar: GET `/fr/admin/parameters` → 200 with `value="7.000"` present (seeded delivery cost) and a submit button. SUB_ADMIN jar: 200 with the read-only notice and no submit button. `/ar/admin/parameters` renders RTL. Gates: tsc/test/build. Kill server.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: add global parameters screen with admin-only editing"
```

---

### Task 9: Products data-access + server actions

**Files:**
- Create: `src/server/products.ts`, `src/app/[locale]/admin/products/actions.ts`

**Interfaces:**
- Consumes: `prisma`, authz (`requireAdmin`, `requireStaff`, `AuthzError`), `productSchema`/`quantitySchema`, `parseDinarsToMillimes`, ActionResult helpers.
- Produces:
  - `listProducts({search, includeArchived}: {search?: string; includeArchived: boolean})` — filters `archivedAt` unless included; `search` matches `reference`, `nameFr`, `nameAr` (`contains`, `mode: 'insensitive'`); includes `images` (ordered by `sortOrder`), `category` and `subCategory` (`{id, nameFr, nameAr}` selects); ordered `createdAt desc`. Export `type ProductRow = Awaited<ReturnType<typeof listProducts>>[number]`.
  - `getProduct(id)` — full product with ordered images; null when missing.
  - Actions: `createProduct(formData): Promise<ActionResult<{id: string}>>`, `updateProduct(id, formData): Promise<ActionResult>`, `updateProductQuantity(id: string, quantity: number): Promise<ActionResult>` (**the only SUB_ADMIN-writable action**), `archiveProduct(id)`, `restoreProduct(id)`.

**Business rules (binding):** `price` arrives as a dinars string form field, parsed with `parseDinarsToMillimes` (null → fieldError `price: 'invalidAmount'`). `images` arrives as a JSON string field (array of `{url, sortOrder}`) — `JSON.parse` guarded, then `productSchema` enforces min 1 and each url must start with `/api/uploads/`. `categoryId` must reference a non-archived **root** category; `subCategoryId` (when set) must be a non-archived **child of that exact category**. Unique `reference` violations (Prisma `P2002`) → fieldError `reference: 'referenceTaken'`. `updateProduct` replaces images atomically (transaction: update fields, `deleteMany` images, `createMany` new — ProductImage rows are owned attachments, not archivable records). `updateProductQuantity` allows ADMIN and SUB_ADMIN, validates via `quantitySchema`, touches ONLY `quantity`.

- [ ] **Step 1: Implement `src/server/products.ts`**

```ts
import 'server-only';
import {prisma} from '@/lib/db';

const CATEGORY_SELECT = {select: {id: true, nameFr: true, nameAr: true}} as const;

export async function listProducts({
  search,
  includeArchived
}: {
  search?: string;
  includeArchived: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(includeArchived ? {} : {archivedAt: null}),
      ...(search
        ? {
            OR: [
              {reference: {contains: search, mode: 'insensitive'}},
              {nameFr: {contains: search, mode: 'insensitive'}},
              {nameAr: {contains: search, mode: 'insensitive'}}
            ]
          }
        : {})
    },
    orderBy: {createdAt: 'desc'},
    include: {
      images: {orderBy: {sortOrder: 'asc'}},
      category: CATEGORY_SELECT,
      subCategory: CATEGORY_SELECT
    }
  });
}

export type ProductRow = Awaited<ReturnType<typeof listProducts>>[number];

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: {id},
    include: {
      images: {orderBy: {sortOrder: 'asc'}},
      category: CATEGORY_SELECT,
      subCategory: CATEGORY_SELECT
    }
  });
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
```

- [ ] **Step 2: Implement the actions**

Create `src/app/[locale]/admin/products/actions.ts`:

```ts
'use server';

import {Prisma} from '@prisma/client';
import {revalidatePath} from 'next/cache';
import {failure, fieldErrorsFromZod, success, type ActionResult} from '@/lib/action-result';
import {AuthzError} from '@/lib/authz';
import {requireAdmin, requireStaff} from '@/server/authz';
import {prisma} from '@/lib/db';
import {parseDinarsToMillimes} from '@/lib/money';
import {productSchema, quantitySchema} from '@/lib/schemas/catalog';

const PATH = '/[locale]/admin/products';

type RawImages = Array<{url: string; sortOrder: number}>;

function parseImages(formData: FormData): RawImages | null {
  try {
    const parsed = JSON.parse(String(formData.get('images') ?? '[]'));
    return Array.isArray(parsed) ? (parsed as RawImages) : null;
  } catch {
    return null;
  }
}

function formToInput(formData: FormData) {
  const priceMillimes = parseDinarsToMillimes(String(formData.get('price') ?? ''));
  const images = parseImages(formData);
  return {
    priceInvalid: priceMillimes === null,
    imagesInvalid: images === null,
    input: {
      reference: String(formData.get('reference') ?? ''),
      nameFr: String(formData.get('nameFr') ?? ''),
      nameAr: String(formData.get('nameAr') ?? ''),
      descriptionFr: String(formData.get('descriptionFr') ?? ''),
      descriptionAr: String(formData.get('descriptionAr') ?? ''),
      priceMillimes: priceMillimes ?? 0,
      discountPct: Number.parseInt(String(formData.get('discountPct') ?? '0'), 10) || 0,
      quantity: Number.parseInt(String(formData.get('quantity') ?? '0'), 10) || 0,
      featured: formData.get('featured') === 'on',
      categoryId: String(formData.get('categoryId') ?? ''),
      subCategoryId: String(formData.get('subCategoryId') ?? ''),
      images: images ?? []
    }
  };
}

async function validateCategoryPair(
  categoryId: string,
  subCategoryId: string | null
): Promise<string | null> {
  const category = await prisma.category.findUnique({where: {id: categoryId}});
  if (!category || category.archivedAt || category.parentId !== null) return 'invalidCategory';
  if (subCategoryId) {
    const sub = await prisma.category.findUnique({where: {id: subCategoryId}});
    if (!sub || sub.archivedAt || sub.parentId !== categoryId) return 'invalidSubCategory';
  }
  return null;
}

function validateImageUrls(images: RawImages): boolean {
  return images.every((image) => image.url.startsWith('/api/uploads/'));
}

export async function createProduct(formData: FormData): Promise<ActionResult<{id: string}>> {
  try {
    await requireAdmin();
    const {priceInvalid, imagesInvalid, input} = formToInput(formData);
    if (priceInvalid) return failure('validation', {price: 'invalidAmount'});
    if (imagesInvalid) return failure('validation', {images: 'imagesRequired'});
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    if (!validateImageUrls(parsed.data.images)) return failure('validation', {images: 'imagesRequired'});
    const categoryError = await validateCategoryPair(parsed.data.categoryId, parsed.data.subCategoryId);
    if (categoryError) return failure(categoryError);

    const {images, ...fields} = parsed.data;
    const created = await prisma.product.create({
      data: {...fields, images: {create: images}}
    });
    revalidatePath(PATH, 'page');
    return success({id: created.id});
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {reference: 'referenceTaken'});
    }
    throw error;
  }
}

export async function updateProduct(id: string, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const existing = await prisma.product.findUnique({where: {id}});
    if (!existing) return failure('notFound');
    const {priceInvalid, imagesInvalid, input} = formToInput(formData);
    if (priceInvalid) return failure('validation', {price: 'invalidAmount'});
    if (imagesInvalid) return failure('validation', {images: 'imagesRequired'});
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return failure('validation', fieldErrorsFromZod(parsed.error));
    if (!validateImageUrls(parsed.data.images)) return failure('validation', {images: 'imagesRequired'});
    const categoryError = await validateCategoryPair(parsed.data.categoryId, parsed.data.subCategoryId);
    if (categoryError) return failure(categoryError);

    const {images, ...fields} = parsed.data;
    await prisma.$transaction([
      prisma.product.update({where: {id}, data: fields}),
      prisma.productImage.deleteMany({where: {productId: id}}),
      prisma.productImage.createMany({
        data: images.map((image) => ({...image, productId: id}))
      })
    ]);
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return failure('validation', {reference: 'referenceTaken'});
    }
    throw error;
  }
}

export async function updateProductQuantity(id: string, quantity: number): Promise<ActionResult> {
  try {
    await requireStaff();
    const parsed = quantitySchema.safeParse({quantity});
    if (!parsed.success) return failure('validation', {quantity: 'invalidQuantity'});
    const updated = await prisma.product.updateMany({
      where: {id},
      data: {quantity: parsed.data.quantity}
    });
    if (updated.count === 0) return failure('notFound');
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.product.update({where: {id}, data: {archivedAt: new Date()}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}

export async function restoreProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await prisma.product.update({where: {id}, data: {archivedAt: null}});
    revalidatePath(PATH, 'page');
    return success(undefined);
  } catch (error) {
    if (error instanceof AuthzError) return failure('forbidden');
    throw error;
  }
}
```

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit`, `npm test` (all green — Prisma `mode: 'insensitive'` compiles against postgres provider). Throwaway prisma script check (not committed): `listProducts({search: 'casque', includeArchived: false})` finds the seeded DEMO-001; `listProducts({search: 'سماعات', includeArchived: false})` finds it too.

```powershell
git add src/server/products.ts "src/app/[locale]/admin/products/actions.ts"
git commit -m "feat: add products data-access and role-enforced server actions"
```

---

### Task 10: Products list UI

**Files:**
- Modify: `src/app/[locale]/admin/products/page.tsx` (replace placeholder), `messages/fr.json`, `messages/ar.json`
- Create: `src/app/[locale]/admin/products/products-table.tsx`, `src/app/[locale]/admin/products/quantity-cell.tsx`, `src/app/[locale]/admin/products/search-input.tsx`

**Interfaces:**
- Consumes: `listProducts`/`ProductRow` (Task 9), quantity/archive/restore actions (Task 9), `getParameters` (Task 8, for `lastChanceThreshold` + `currency`), `requirePageStaff`, `effectivePriceMillimes`/`formatMillimes` (`@/lib/money`), shadcn table primitives, `Link` from `@/i18n/navigation`.
- Produces: `/admin/products` list with search, archived filter, thumbnails, price + struck-through original when discounted, low-stock badge, inline quantity editor (both roles), row actions (ADMIN only), "new product" button (ADMIN only). Edit links point to `/admin/products/{id}/edit` (Task 11 creates those routes — links may 404 until then; acceptable within this task).

- [ ] **Step 1: i18n keys**

Add under `admin.products` in both catalogs (FR / AR values; same key set):
`title` ("Produits" / "المنتجات"), `add` ("Ajouter un produit" / "إضافة منتج"), `search` ("Rechercher par nom ou référence..." / "ابحث بالاسم أو المرجع..."), `reference` ("Référence" / "المرجع"), `name` ("Nom" / "الاسم"), `category` ("Catégorie" / "الفئة"), `price` ("Prix" / "السعر"), `discount` ("Remise" / "التخفيض"), `quantity` ("Quantité" / "الكمية"), `featured` ("En vedette" / "مميز"), `lowStock` ("Stock bas" / "مخزون منخفض"), `outOfStock` ("Rupture" / "نفد المخزون"), `archived` ("Archivé" / "مؤرشف"), `showArchived` ("Afficher les archivés" / "عرض المؤرشفة"), `actions` ("Actions" / "إجراءات"), `edit` ("Modifier" / "تعديل"), `archive` ("Archiver" / "أرشفة"), `restore` ("Restaurer" / "استعادة"), `save` ("Enregistrer" / "حفظ"), `quantitySaved` ("Quantité mise à jour." / "تم تحديث الكمية."), `archivedToast` ("Produit archivé." / "تمت أرشفة المنتج."), `restoredToast` ("Produit restauré." / "تمت استعادة المنتج."), `empty` ("Aucun produit trouvé." / "لا توجد منتجات."), `confirmArchiveTitle` ("Archiver ce produit ?" / "أرشفة هذا المنتج؟"), `confirmArchiveBody` ("Le produit sera masqué de la boutique." / "سيتم إخفاء المنتج من المتجر."), `cancel` ("Annuler" / "إلغاء"), `errors.validation` ("Veuillez corriger les champs en rouge." / "يرجى تصحيح الحقول المحددة بالأحمر."), `errors.invalidQuantity` ("Quantité invalide." / "كمية غير صالحة."), `errors.notFound` ("Produit introuvable." / "المنتج غير موجود."), `errors.forbidden` ("Action non autorisée." / "إجراء غير مسموح به."), `errors.invalidCategory` ("Catégorie invalide." / "فئة غير صالحة."), `errors.invalidSubCategory` ("Sous-catégorie invalide." / "فئة فرعية غير صالحة.")

- [ ] **Step 2: Replace the page**

`src/app/[locale]/admin/products/page.tsx`:

```tsx
import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {listProducts} from '@/server/products';
import {getParameters} from '@/server/settings';
import {ProductsTable} from './products-table';
import {SearchInput} from './search-input';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{q?: string; archived?: string}>;
}) {
  const session = await requirePageStaff();
  const {q, archived} = await searchParams;
  const includeArchived = archived === '1';
  const t = await getTranslations('admin.products');
  const [products, parameters] = await Promise.all([
    listProducts({search: q?.trim() || undefined, includeArchived}),
    getParameters()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <SearchInput initialValue={q ?? ''} includeArchived={includeArchived} />
      <ProductsTable
        products={products}
        isAdmin={session.user.role === 'ADMIN'}
        includeArchived={includeArchived}
        lowStockThreshold={parameters.lastChanceThreshold}
        currencyLabel={parameters.currency}
      />
    </div>
  );
}
```

- [ ] **Step 3: Search input (URL-driven)**

`src/app/[locale]/admin/products/search-input.tsx`:

```tsx
'use client';

import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Input} from '@/components/ui/input';

export function SearchInput({
  initialValue,
  includeArchived
}: {
  initialValue: string;
  includeArchived: boolean;
}) {
  const t = useTranslations('admin.products');
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = new FormData(event.currentTarget).get('q');
        const params = new URLSearchParams();
        if (q && String(q).trim()) params.set('q', String(q).trim());
        if (includeArchived) params.set('archived', '1');
        router.replace(`/admin/products${params.size ? `?${params}` : ''}`);
      }}
      className="max-w-sm"
    >
      <Input name="q" defaultValue={initialValue} placeholder={t('search')} aria-label={t('search')} />
    </form>
  );
}
```

- [ ] **Step 4: Quantity cell (the sub-admin surface)**

`src/app/[locale]/admin/products/quantity-cell.tsx`:

```tsx
'use client';

import {useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {updateProductQuantity} from './actions';

export function QuantityCell({productId, quantity}: {productId: string; quantity: number}) {
  const t = useTranslations('admin.products');
  const [value, setValue] = useState(String(quantity));
  const [pending, startTransition] = useTransition();
  const dirty = value !== String(quantity);

  function save() {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error(t('errors.invalidQuantity'));
      return;
    }
    startTransition(async () => {
      const result = await updateProductQuantity(productId, parsed);
      if (result.ok) toast.success(t('quantitySaved'));
      else toast.error(t(`errors.${result.error}` as never));
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-20"
        dir="ltr"
        aria-label={t('quantity')}
      />
      {dirty && (
        <Button size="sm" variant="outline" onClick={save} disabled={pending}>
          {t('save')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Products table**

`src/app/[locale]/admin/products/products-table.tsx` — client component following Task 6's table idioms exactly (imports, `useLocale` name helper, `useTransition`, AlertDialog confirm, DropdownMenu row actions). Columns and cells:
- Thumbnail: `<img src={product.images[0]?.url} alt="" className="size-10 rounded-md object-cover" />` (plain `img` — the serving route is same-origin).
- `reference` (`dir="ltr"`, muted), name (locale-aware), category (+ ` / ` + subcategory name when present).
- Price: when `discountPct > 0` render `<span className="line-through text-muted-foreground me-2">{formatMillimes(product.priceMillimes)}</span>` then the effective price `formatMillimes(effectivePriceMillimes(product.priceMillimes, product.discountPct, null))` + ` {currencyLabel}` and a `Badge` `-{discountPct}%`; otherwise just the price + currency.
- Quantity: `<QuantityCell productId={product.id} quantity={product.quantity} />` plus `Badge variant="destructive"` `outOfStock` when 0, else `Badge variant="outline"` `lowStock` when `quantity <= lowStockThreshold`.
- `featured`: check icon (lucide `Check`) or em dash.
- Archived badge when `archivedAt !== null`.
- ADMIN-only header button `add` → `Link href="/admin/products/new"`; ADMIN-only actions column: `edit` → `Link href={`/admin/products/${product.id}/edit`}`, archive (with confirm) / restore via Task 9 actions with toasts, same pattern as categories.
- Top bar also has the `showArchived` link (preserving `q` in the query string).
- Empty state `empty` when no rows.

- [ ] **Step 6: Verify over HTTP + gates**

ADMIN jar: `/fr/admin/products` → 200, DEMO-001 row with thumbnail url `/api/uploads/...`? — no: seeded image is `/placeholder-product.svg`, so the `<img>` renders that path; verify the row shows reference DEMO-001, price `89.000 TND`, quantity input `25`. Search `?q=casque` → 1 row; `?q=zzz` → empty state. SUB_ADMIN jar: no add button, no actions column, quantity input PRESENT. `/ar/admin/products?q=سماعات` → finds the row, RTL layout. Gates: tsc/test/build. Kill server.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: add products list with search, badges, and inline quantity editing"
```

---

### Task 11: Product create/edit form

**Files:**
- Create: `src/app/[locale]/admin/products/product-form.tsx`, `src/app/[locale]/admin/products/image-uploader.tsx`, `src/app/[locale]/admin/products/new/page.tsx`, `src/app/[locale]/admin/products/[id]/edit/page.tsx`
- Modify: `messages/fr.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `createProduct`/`updateProduct` (Task 9), `getProduct`/`ProductDetail` (Task 9), `listCategoryTree`/`CategoryTreeNode` (Task 5), `millimesToInput`, `requirePageStaff`, upload POST route (Task 7), shadcn primitives, `useRouter` from `@/i18n/navigation`.
- Produces: `/admin/products/new` (ADMIN; SUB_ADMIN is redirected to the list) and `/admin/products/[id]/edit` (ADMIN edits; SUB_ADMIN sees the form read-only — server actions enforce regardless).

- [ ] **Step 1: i18n keys**

Add under `admin.productForm` in both catalogs (FR / AR; same key set):
`createTitle` ("Nouveau produit" / "منتج جديد"), `editTitle` ("Modifier le produit" / "تعديل المنتج"), `reference` ("Référence" / "المرجع"), `nameFr` ("Nom (français)" / "الاسم (بالفرنسية)"), `nameAr` ("Nom (arabe)" / "الاسم (بالعربية)"), `descriptionFr` ("Description (français)" / "الوصف (بالفرنسية)"), `descriptionAr` ("Description (arabe)" / "الوصف (بالعربية)"), `price` ("Prix (DT)" / "السعر (د.ت)"), `discountPct` ("Remise (%)" / "التخفيض (%)"), `quantity` ("Quantité" / "الكمية"), `featured` ("Produit en vedette" / "منتج مميز"), `category` ("Catégorie" / "الفئة"), `subCategory` ("Sous-catégorie" / "الفئة الفرعية"), `noSubCategory` ("Aucune" / "بدون"), `images` ("Images" / "الصور"), `addImage` ("Ajouter une image" / "إضافة صورة"), `removeImage` ("Retirer" / "إزالة"), `moveUp` ("Monter" / "تقديم"), `moveDown` ("Descendre" / "تأخير"), `uploading` ("Téléversement..." / "جارٍ الرفع..."), `uploadFailed` ("Échec du téléversement." / "فشل رفع الصورة."), `minOneImage` ("Ajoutez au moins une image." / "أضف صورة واحدة على الأقل."), `save` ("Enregistrer" / "حفظ"), `cancel` ("Annuler" / "إلغاء"), `saved` ("Produit enregistré." / "تم حفظ المنتج."), `readOnly` ("Lecture seule — vous pouvez uniquement modifier la quantité depuis la liste." / "للعرض فقط — يمكنك تعديل الكمية فقط من القائمة."), `errors.invalidAmount` ("Prix invalide (ex. 89.000)." / "سعر غير صالح (مثال 89.000)."), `errors.referenceTaken` ("Cette référence existe déjà." / "هذا المرجع مستعمل من قبل."), `errors.imagesRequired` ("Au moins une image valide est requise." / "مطلوب صورة صالحة واحدة على الأقل.")

(Reuse `admin.products.errors.*` for `validation`/`forbidden`/`notFound`/`invalidCategory`/`invalidSubCategory` — the form maps error codes through BOTH namespaces: try `admin.productForm.errors.*` first, fall back to `admin.products.errors.*`. Implement that mapping as a tiny helper inside the form file.)

- [ ] **Step 2: Image uploader component**

`src/app/[locale]/admin/products/image-uploader.tsx`:

```tsx
'use client';

import {useRef, useState} from 'react';
import {ArrowDown, ArrowUp, ImagePlus, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';

export type FormImage = {url: string; sortOrder: number};

export function ImageUploader({
  images,
  onChange,
  disabled
}: {
  images: FormImage[];
  onChange: (images: FormImage[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.productForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const renumber = (list: FormImage[]) => list.map((image, index) => ({...image, sortOrder: index}));

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/uploads', {method: 'POST', body});
      if (!response.ok) throw new Error('upload');
      const {url} = (await response.json()) as {url: string};
      onChange(renumber([...images, {url, sortOrder: images.length}]));
    } catch {
      toast.error(t('uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <li key={image.url} className="relative rounded-md border p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="size-24 rounded object-cover" />
            {!disabled && (
              <div className="mt-1 flex justify-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label={t('moveUp')}
                  onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="size-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('moveDown')}
                  onClick={() => move(index, 1)} disabled={index === images.length - 1}>
                  <ArrowDown className="size-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('removeImage')}
                  onClick={() => onChange(renumber(images.filter((_, i) => i !== index)))}>
                  <X className="size-3" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="outline" disabled={uploading}
            onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" /> {uploading ? t('uploading') : t('addImage')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Product form component**

`src/app/[locale]/admin/products/product-form.tsx` — client component. Structure (follow the established form idioms; full file, no elisions):
- Props: `{product: ProductDetail | null; categories: CategoryTreeNode[]; readOnly: boolean}`.
- State: `images: FormImage[]` (init from `product?.images` mapped to `{url, sortOrder}` — or `[]`), `categoryId` (init `product?.categoryId ?? ''`), `subCategoryId` (init `product?.subCategoryId ?? 'none'`), `fieldErrors`, `pending` via `useTransition`.
- The subcategory `<Select>` lists `categories.find(c => c.id === categoryId)?.children ?? []` plus a `noSubCategory` item (value `'none'`); changing category resets subcategory to `'none'`.
- `submit(formData)`: client-side guard `if (images.length === 0) { setFieldErrors({images: 'minOneImage'}); toast.error(t('minOneImage')); return; }`; `formData.set('images', JSON.stringify(images))`; `formData.set('categoryId', categoryId)`; `formData.set('subCategoryId', subCategoryId === 'none' ? '' : subCategoryId)`; then `startTransition` → `product ? updateProduct(product.id, formData) : createProduct(formData)`; on ok → `toast.success(t('saved'))` + `router.push('/admin/products')` (`useRouter` from `@/i18n/navigation`); on failure set `fieldErrors` and toast the mapped error.
- Error-code mapping helper `errorText(code)`: try `admin.productForm.errors.${code}`, fall back to `admin.products.errors.${code}` (use `useTranslations('admin')` and `t.has(...)` — next-intl v4 exposes `t.has`; if unavailable in the installed version, maintain an explicit `const FORM_ERRORS = new Set(['invalidAmount','referenceTaken','imagesRequired'])` and branch on membership).
- Fields (each `Label` + control + error line): `reference` (Input, `dir="ltr"`), `nameFr` (Input), `nameAr` (Input `dir="rtl"`), `descriptionFr` (Textarea), `descriptionAr` (Textarea `dir="rtl"`), `price` (Input `dir="ltr"`, `defaultValue={product ? millimesToInput(product.priceMillimes) : ''}`), `discountPct` (Input `type="number"` min 0 max 100, default `product?.discountPct ?? 0`), `quantity` (Input `type="number"` min 0, default `product?.quantity ?? 0`), `featured` (shadcn `Switch` + hidden input trick: `<input type="hidden" name="featured" value={featured ? 'on' : ''} />` with a `featured` boolean state), category/subcategory Selects, `<ImageUploader images={images} onChange={setImages} disabled={readOnly} />`.
- Whole form wrapped in `<fieldset disabled={readOnly || pending} className="contents">`; when `readOnly`, render the `readOnly` notice instead of the submit/cancel buttons. Layout: `grid gap-4 md:grid-cols-2` with full-width rows (`md:col-span-2`) for descriptions and images.

- [ ] **Step 4: The two pages**

`src/app/[locale]/admin/products/new/page.tsx`:

```tsx
import {getLocale, getTranslations} from 'next-intl/server';
import {redirect} from '@/i18n/navigation';
import {requirePageStaff} from '@/server/authz';
import {listCategoryTree} from '@/server/categories';
import {ProductForm} from '../product-form';

export default async function NewProductPage() {
  const session = await requirePageStaff();
  if (session.user.role !== 'ADMIN') {
    redirect({href: '/admin/products', locale: await getLocale()});
  }
  const t = await getTranslations('admin.productForm');
  const categories = await listCategoryTree();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('createTitle')}</h1>
      <ProductForm product={null} categories={categories} readOnly={false} />
    </div>
  );
}
```

`src/app/[locale]/admin/products/[id]/edit/page.tsx`:

```tsx
import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {requirePageStaff} from '@/server/authz';
import {listCategoryTree} from '@/server/categories';
import {getProduct} from '@/server/products';
import {ProductForm} from '../../product-form';

export default async function EditProductPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const session = await requirePageStaff();
  const {id} = await params;
  const t = await getTranslations('admin.productForm');
  const [product, categories] = await Promise.all([getProduct(id), listCategoryTree()]);
  if (!product) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('editTitle')}</h1>
      <ProductForm
        product={product}
        categories={categories}
        readOnly={session.user.role !== 'ADMIN'}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify over HTTP + gates**

ADMIN jar: `/fr/admin/products/new` → 200 with the form; `/fr/admin/products/<DEMO-001 id>/edit` → 200 with `value="89.000"` and the seeded names prefilled (get the id via a throwaway prisma one-liner). SUB_ADMIN jar: `/fr/admin/products/new` → 307 to `/fr/admin/products`; edit page → 200 containing the `readOnly` notice and a disabled fieldset. `/ar/...` renders RTL. Full click-through (upload → create → edit) is covered by Task 13's Playwright spec. Gates: tsc/test/build. Kill server.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: add product create and edit form with image management"
```

---

### Task 12: Promo codes management

**Files:**
- Create: `src/server/promo-codes.ts`, `src/app/[locale]/admin/promo-codes/actions.ts`, `src/app/[locale]/admin/promo-codes/promo-codes-table.tsx`, `src/app/[locale]/admin/promo-codes/promo-code-form-dialog.tsx`
- Modify: `src/app/[locale]/admin/promo-codes/page.tsx` (replace placeholder), `messages/fr.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `prisma`, authz, `promoCodeSchema`, ActionResult helpers, shadcn primitives (incl. `Switch`), `toast`.
- Produces:
  - `listPromoCodes(includeArchived: boolean)` ordered `code asc`; `type PromoCodeRow = Awaited<ReturnType<typeof listPromoCodes>>[number]`
  - Actions (ADMIN only, same try/catch shape as Task 5): `createPromoCode(formData)`, `updatePromoCode(id, formData)`, `togglePromoCode(id, active: boolean)` (flips `active` only), `archivePromoCode(id)`, `restorePromoCode(id)`. Duplicate code (`P2002`) → fieldError `code: 'codeTaken'`. `expiresAt` comes from a `<input type="date">` field: empty string → `null`, else `new Date(value + 'T23:59:59')` (end of day, local); invalid date → fieldError `expiresAt: 'invalidDate'`.
  - Page: staff view; ADMIN gets add/edit/toggle/archive; SUB_ADMIN read-only table (Switch rendered `disabled`).

**Actions form parsing (exact):**

```ts
function formToInput(formData: FormData): {invalidDate: boolean; input: unknown} {
  const rawDate = String(formData.get('expiresAt') ?? '').trim();
  let expiresAt: Date | null = null;
  let invalidDate = false;
  if (rawDate) {
    const parsed = new Date(`${rawDate}T23:59:59`);
    if (Number.isNaN(parsed.getTime())) invalidDate = true;
    else expiresAt = parsed;
  }
  return {
    invalidDate,
    input: {
      code: String(formData.get('code') ?? ''),
      percentOff: Number.parseInt(String(formData.get('percentOff') ?? ''), 10) || 0,
      active: formData.get('active') === 'on',
      expiresAt
    }
  };
}
```

- [ ] **Step 1: i18n keys** — add under `admin.promoCodesPage` in both catalogs (FR / AR; same key set):
`title` ("Codes promo" / "أكواد التخفيض"), `add` ("Ajouter un code" / "إضافة كود"), `edit` ("Modifier le code" / "تعديل الكود"), `code` ("Code" / "الكود"), `percentOff` ("Remise (%)" / "التخفيض (%)"), `active` ("Actif" / "مفعّل"), `expiresAt` ("Expire le" / "ينتهي في"), `noExpiry` ("Sans expiration" / "بدون انتهاء"), `archived` ("Archivé" / "مؤرشف"), `showArchived` ("Afficher les archivés" / "عرض المؤرشفة"), `actions` ("Actions" / "إجراءات"), `archive` ("Archiver" / "أرشفة"), `restore` ("Restaurer" / "استعادة"), `cancel` ("Annuler" / "إلغاء"), `save` ("Enregistrer" / "حفظ"), `saved` ("Code promo enregistré." / "تم حفظ الكود."), `toggledOn` ("Code activé." / "تم تفعيل الكود."), `toggledOff` ("Code désactivé." / "تم تعطيل الكود."), `archivedToast` ("Code archivé." / "تمت أرشفة الكود."), `restoredToast` ("Code restauré." / "تمت استعادة الكود."), `empty` ("Aucun code promo." / "لا توجد أكواد."), `confirmArchiveTitle` ("Archiver ce code ?" / "أرشفة هذا الكود؟"), `confirmArchiveBody` ("Le code ne pourra plus être utilisé au panier." / "لن يعود بالإمكان استعمال هذا الكود في السلة."), `errors.validation` ("Veuillez corriger les champs en rouge." / "يرجى تصحيح الحقول المحددة بالأحمر."), `errors.codeTaken` ("Ce code existe déjà." / "هذا الكود موجود من قبل."), `errors.invalidDate` ("Date invalide." / "تاريخ غير صالح."), `errors.forbidden` ("Action non autorisée." / "إجراء غير مسموح به."), `errors.notFound` ("Code introuvable." / "الكود غير موجود.")

- [ ] **Step 2: Data-access + actions** — `src/server/promo-codes.ts` (`listPromoCodes` with `where: includeArchived ? {} : {archivedAt: null}`, `orderBy: {code: 'asc'}`) and `actions.ts` per the interfaces above, structurally identical to Task 5's actions (requireAdmin → parse → mutate → `revalidatePath('/[locale]/admin/promo-codes', 'page')` → ActionResult; P2002 catch for create/update).

- [ ] **Step 3: Page + table + dialog** — same structure as categories: page (`requirePageStaff`, `searchParams` archived flag, staff-aware props); table columns code (`dir="ltr"` font-mono), percentOff (`-{n}%`), active (`Switch` checked, ADMIN: `onCheckedChange` → `togglePromoCode` with toasts; SUB_ADMIN: `disabled`), expiresAt (format with `new Intl.DateTimeFormat(locale === 'ar' ? 'ar-TN' : 'fr-TN', {dateStyle: 'medium'})`, or `noExpiry`), archived badge, ADMIN actions dropdown (edit/archive/restore + AlertDialog confirm); dialog form fields code (Input `dir="ltr"`), percentOff (number 1–100), active (Switch + hidden input like Task 11), expiresAt (`<Input type="date" dir="ltr" />`, default from existing value formatted `YYYY-MM-DD`).

- [ ] **Step 4: Verify over HTTP + gates** — ADMIN jar: page 200 with add button (empty state initially). SUB_ADMIN: 200 read-only. `/ar` RTL. Gates: tsc/test/build. Kill server.

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat: add promo codes management"
```

---

### Task 13: Playwright e2e for the admin catalog + phase gates

**Files:**
- Create: `playwright.config.ts`, `e2e/admin-catalog.spec.ts`, `e2e/cleanup.ts`, `e2e/fixtures/product.png` (tiny generated PNG, committed)
- Modify: `package.json` (scripts: `"test:e2e": "playwright test"`), `.gitignore` (add `playwright-report/`, `test-results/`)

**Interfaces:**
- Consumes: the whole phase; seeded admin + subadmin accounts; running Docker DB.
- Produces: a repeatable e2e suite (`npm run test:e2e`) covering the critical admin-catalog journeys.

**Conventions:** all e2e fixtures use the prefixes `E2E-` (references), `e2e-` (slugs), names starting `E2E `. `e2e/cleanup.ts` hard-deletes ONLY rows matching those prefixes (fixture cleanup — the sole sanctioned hard delete) and runs from Playwright's `globalSetup` via `npx tsx e2e/cleanup.ts`.

- [ ] **Step 1: Config + fixture + cleanup**

`playwright.config.ts`:

```ts
import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'fr-FR'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/fr',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
```

`e2e/global-setup.ts`:

```ts
import {execSync} from 'node:child_process';

export default function globalSetup() {
  execSync('npx tsx e2e/cleanup.ts', {stdio: 'inherit'});
}
```

`e2e/cleanup.ts`:

```ts
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})
});

async function main() {
  await prisma.productImage.deleteMany({where: {product: {reference: {startsWith: 'E2E-'}}}});
  await prisma.product.deleteMany({where: {reference: {startsWith: 'E2E-'}}});
  await prisma.category.deleteMany({where: {slug: {startsWith: 'e2e-'}}});
  await prisma.promoCode.deleteMany({where: {code: {startsWith: 'E2E'}}});
  console.log('e2e fixtures cleaned');
}

main().finally(() => prisma.$disconnect());
```

Generate the fixture image once (throwaway command, file is committed): `npx tsx -e "import sharp from 'sharp'; sharp({create:{width:64,height:64,channels:3,background:{r:180,g:40,b:40}}}).png().toFile('e2e/fixtures/product.png')"`

Add `@playwright/test` if missing: `npm i -D @playwright/test` (the `playwright` package is already present; keep versions aligned) and `npx playwright install chromium` if the browser is absent.

- [ ] **Step 2: The spec**

`e2e/admin-catalog.spec.ts`:

```ts
import {expect, test, type Page} from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/fr/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', {name: 'Se connecter'}).click();
  await page.waitForURL('**/fr');
}

test.describe.configure({mode: 'serial'});

test('admin creates a category with a subcategory', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/categories');

  await page.getByRole('button', {name: 'Ajouter une catégorie'}).click();
  await page.getByLabel('Nom (français)').fill('E2E Maison');
  await page.getByLabel('Nom (arabe)').fill('E2E منزل');
  await page.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByText('Catégorie enregistrée.')).toBeVisible();
  await expect(page.getByRole('cell', {name: 'E2E Maison'})).toBeVisible();
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

  await page.getByText('Catégorie', {exact: true}).locator('..').getByRole('combobox').click();
  await page.getByRole('option', {name: 'E2E Maison'}).click();

  await page.setInputFiles('input[type="file"]', 'e2e/fixtures/product.png');
  await expect(page.locator('img[src^="/api/uploads/products/"]')).toBeVisible();

  await page.getByRole('button', {name: 'Enregistrer'}).click();
  await page.waitForURL('**/fr/admin/products');
  await expect(page.getByRole('cell', {name: 'E2E-PROD-1'})).toBeVisible();
  await expect(page.getByText('45.500')).toBeVisible();
});

test('sub-admin can only edit quantity', async ({page}) => {
  await login(page, 'subadmin@local.test', 'subadmin123!');
  await page.goto('/fr/admin/products?q=E2E-PROD-1');

  await expect(page.getByRole('link', {name: 'Ajouter un produit'})).toHaveCount(0);

  const quantityInput = page.getByRole('row', {name: /E2E-PROD-1/}).getByLabel('Quantité');
  await quantityInput.fill('9');
  await page.getByRole('button', {name: 'Enregistrer'}).click();
  await expect(page.getByText('Quantité mise à jour.')).toBeVisible();
});

test('admin archives the e2e product', async ({page}) => {
  await login(page, 'admin@local.test', 'admin123!');
  await page.goto('/fr/admin/products?q=E2E-PROD-1');

  await page.getByRole('row', {name: /E2E-PROD-1/}).getByRole('button', {name: 'Actions'}).click();
  await page.getByRole('menuitem', {name: 'Archiver'}).click();
  await page.getByRole('button', {name: 'Archiver'}).click();
  await expect(page.getByText('Produit archivé.')).toBeVisible();
  await expect(page.getByRole('cell', {name: 'E2E-PROD-1'})).toHaveCount(0);
});
```

(If a locator does not match the built UI exactly, fix the LOCATOR to match the implemented markup — the UI text comes from the catalogs and is authoritative; add `aria-label` attributes to the implementation only when a control is genuinely unlabelled.)

- [ ] **Step 3: Run the suite**

Run: `npm run test:e2e` (Docker DB up; the config starts/reuses the dev server).
Expected: 4/4 pass. Re-run once more to prove the cleanup makes it repeatable.

- [ ] **Step 4: Phase gates**

- `npm test` → all unit suites green.
- `npx tsc --noEmit` → clean.
- `npm run build` → succeeds.
- `npx prisma migrate status` → up to date.

- [ ] **Step 5: Commit**

```powershell
git add playwright.config.ts e2e package.json package-lock.json .gitignore
git commit -m "test: add admin catalog e2e suite with repeatable fixtures"
```

---

## Phase 2 exit criteria

- All four admin sections work end-to-end for ADMIN: categories (2-level tree, archive cascade, unique slugs), products (search, multi-image upload → webp on disk, discount display, archive/restore), parameters (persisted to Setting rows), promo codes (toggle, expiry, archive).
- SUB_ADMIN: sees every section read-only; the ONLY mutation that succeeds server-side is product quantity (verified by the e2e spec + action code review).
- Uploads: ADMIN-only POST, sanitized GET, files under git-ignored `uploads/`, path traversal rejected.
- FK indexes migrated; `src/components/ui/` free of physical direction classes; every new UI string exists in both catalogs (parity suite green).
- `npm test`, `npm run test:e2e`, `npm run build`, `npx tsc --noEmit`, `npx prisma migrate status` all green.
