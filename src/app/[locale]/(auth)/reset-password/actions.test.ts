import {beforeEach, describe, expect, test, vi} from 'vitest';

// resetPasswordWithOtp touches Prisma directly; a fake `prisma` and a stub
// hasher let the test prove the ACTION's behaviour — single-use burn, session
// revocation, attempt accounting and the uniform failure answer — without a
// database or bcrypt.

const h = vi.hoisted(() => ({
  allowRequests: true,
  user: null as unknown,
  row: null as unknown,
  spendCount: 1,
  updateManyCalls: [] as {where: Record<string, unknown>; data: Record<string, unknown>}[],
  deleteManyCalls: [] as {where: Record<string, unknown>}[],
  userUpdateCalls: [] as {where: Record<string, unknown>; data: Record<string, unknown>}[]
}));

vi.mock('@/lib/password', () => ({hashPassword: vi.fn(async () => 'HASHED')}));
vi.mock('next/headers', () => ({headers: vi.fn(async () => new Headers())}));
// The action module imports the mailer at load time, and the mailer is marked
// `server-only` — which throws outside a server component. Stubbed rather than
// unmarked: that marker is what keeps SMTP credentials out of a client bundle.
vi.mock('@/lib/mailer', () => ({
  sendMail: vi.fn(async () => true),
  mailerConfigured: vi.fn(() => true)
}));
// The limiter is process-global and real: without this, the tests in this file
// would exhaust the 10-per-minute budget between them and every later case
// would assert against 'rateLimited' instead of the behaviour it names. The
// limiter has its own tests; `h.allowRequests` lets one case here still prove
// the action consults it.
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    clientIpFromHeaders: vi.fn(() => 'test-ip'),
    enforceRateLimit: vi.fn(() => ({allowed: h.allowRequests, retryAfterMs: 0}))
  };
});

vi.mock('@/lib/db', () => {
  const passwordResetToken = {
    findUnique: vi.fn(async () => h.row),
    updateMany: vi.fn(async (args: {where: Record<string, unknown>; data: Record<string, unknown>}) => {
      h.updateManyCalls.push(args);
      return {count: 'id' in args.where ? h.spendCount : 1};
    }),
    deleteMany: vi.fn(async (args: {where: Record<string, unknown>}) => {
      h.deleteManyCalls.push(args);
      return {count: 1};
    })
  };
  const user = {
    findUnique: vi.fn(async () => h.user),
    update: vi.fn(async (args: {where: Record<string, unknown>; data: Record<string, unknown>}) => {
      h.userUpdateCalls.push(args);
      return {};
    })
  };
  const prisma = {
    passwordResetToken,
    user,
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({passwordResetToken, user})
    )
  };
  return {prisma};
});

import {MAX_OTP_ATTEMPTS, hashOtp} from '@/lib/otp';
import {resetPasswordWithOtp} from './actions';

const EMAIL = 'someone@example.com';
const CODE = '123456';

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', EMAIL);
  fd.set('code', CODE);
  fd.set('password', 'password123');
  fd.set('confirmPassword', 'password123');
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

function liveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tok-current',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 600_000),
    usedAt: null,
    attempts: 0,
    ...overrides
  };
}

beforeEach(() => {
  h.allowRequests = true;
  h.updateManyCalls = [];
  h.deleteManyCalls = [];
  h.userUpdateCalls = [];
  h.spendCount = 1;
  h.user = {id: 'user-1', archivedAt: null};
  h.row = liveRow();
});

describe('resetPasswordWithOtp — the rate limit is real', () => {
  test('an over-limit submit is refused before any database work', async () => {
    const {prisma} = await import('@/lib/db');
    vi.mocked(prisma.user.findUnique).mockClear();
    h.allowRequests = false;
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'rateLimited'});
    // Refused BEFORE the lookup: guessing must not even cost a query.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('resetPasswordWithOtp — the happy path', () => {
  test('spends the code, rotates the password and revokes live sessions', async () => {
    const result = await resetPasswordWithOtp(form());
    expect(result.ok).toBe(true);

    // The code is burned by id, with every precondition restated in the WHERE
    // so a concurrent use makes the count 0 instead of letting both through.
    const burn = h.updateManyCalls.find((c) => c.where.id === 'tok-current');
    expect(burn).toBeDefined();
    expect(burn!.where.usedAt).toBeNull();
    expect(burn!.data.usedAt).toBeInstanceOf(Date);

    // Password rotated for the right user, tokenVersion bumped in the SAME
    // update — a live JWT dies on its next protected access.
    expect(h.userUpdateCalls).toHaveLength(1);
    expect(h.userUpdateCalls[0].where.id).toBe('user-1');
    expect(h.userUpdateCalls[0].data.passwordHash).toBe('HASHED');
    expect(h.userUpdateCalls[0].data.tokenVersion).toEqual({increment: 1});

    // Nothing outstanding survives a completed reset.
    expect(h.deleteManyCalls.some((c) => c.where.userId === 'user-1')).toBe(true);
  });

  test('looks the code up by hash(userId + code), never by the code alone', async () => {
    const {prisma} = await import('@/lib/db');
    await resetPasswordWithOtp(form());
    const lookup = vi.mocked(prisma.passwordResetToken.findUnique).mock.calls.at(-1)![0];
    expect(lookup.where.tokenHash).toBe(hashOtp('user-1', CODE));
    expect(JSON.stringify(lookup)).not.toContain(CODE);
  });
});

describe('resetPasswordWithOtp — every refusal looks the same', () => {
  // Any of these leaking a distinct answer would turn the form into an oracle
  // for account state.
  test('unknown address', async () => {
    h.user = null;
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('archived account', async () => {
    h.user = {id: 'user-1', archivedAt: new Date()};
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('wrong code', async () => {
    h.row = null;
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('expired code', async () => {
    h.row = liveRow({expiresAt: new Date(Date.now() - 1000)});
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('already spent code', async () => {
    h.row = liveRow({usedAt: new Date()});
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('attempts exhausted', async () => {
    h.row = liveRow({attempts: MAX_OTP_ATTEMPTS});
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('lost the race to spend it', async () => {
    h.spendCount = 0;
    expect(await resetPasswordWithOtp(form())).toEqual({ok: false, error: 'invalidCode'});
  });

  test('none of them rotate the password', async () => {
    for (const setup of [
      () => (h.user = null),
      () => (h.row = null),
      () => (h.row = liveRow({expiresAt: new Date(Date.now() - 1000)})),
      () => (h.row = liveRow({attempts: MAX_OTP_ATTEMPTS}))
    ]) {
      h.userUpdateCalls = [];
      h.user = {id: 'user-1', archivedAt: null};
      h.row = liveRow();
      setup();
      await resetPasswordWithOtp(form());
      expect(h.userUpdateCalls).toHaveLength(0);
    }
  });
});

describe('resetPasswordWithOtp — attempt accounting', () => {
  test('a wrong code costs an attempt on the outstanding one', async () => {
    // Without this, the cap would be trivially bypassed: guessing wrong is
    // exactly what an attacker does, so a wrong guess has to be what it counts.
    h.row = null;
    await resetPasswordWithOtp(form());
    const bump = h.updateManyCalls.find((c) => c.data.attempts !== undefined);
    expect(bump).toBeDefined();
    expect(bump!.where.userId).toBe('user-1');
    expect(bump!.where.usedAt).toBeNull();
    expect(bump!.data.attempts).toEqual({increment: 1});
  });

  test('a code that has run out of attempts is deleted, not left to linger', async () => {
    h.row = null;
    await resetPasswordWithOtp(form());
    const sweep = h.deleteManyCalls.find((c) => c.where.attempts !== undefined);
    expect(sweep).toBeDefined();
    expect(sweep!.where.attempts).toEqual({gte: MAX_OTP_ATTEMPTS});
  });
});

describe('resetPasswordWithOtp — shape validation', () => {
  test('a malformed code is a FIELD error, and never reaches the database', async () => {
    const {prisma} = await import('@/lib/db');
    vi.mocked(prisma.user.findUnique).mockClear();
    const result = await resetPasswordWithOtp(form({code: '12ab'}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.code).toBe('invalidCodeFormat');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test('a mismatched confirmation is a field error too', async () => {
    const result = await resetPasswordWithOtp(form({confirmPassword: 'something-else'}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.confirmPassword).toBe('passwordMismatch');
  });

  test('a short password never reaches the database', async () => {
    const {prisma} = await import('@/lib/db');
    vi.mocked(prisma.user.findUnique).mockClear();
    const result = await resetPasswordWithOtp(form({password: 'short', confirmPassword: 'short'}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.password).toBe('passwordTooShort');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
