import {beforeEach, describe, expect, test, vi} from 'vitest';

// The reset-password action touches Prisma directly; we inject a fake `prisma`
// and a stub hasher so the test proves the ACTION's behaviour (single-use token
// burn + sibling invalidation) without a database or argon2.

const h = vi.hoisted(() => ({
  row: null as unknown,
  updateManyCalls: [] as {where: Record<string, unknown>; data: Record<string, unknown>}[],
  userUpdateCalls: [] as {where: Record<string, unknown>; data: Record<string, unknown>}[]
}));

vi.mock('@/lib/password', () => ({hashPassword: vi.fn(async () => 'HASHED')}));

vi.mock('@/lib/db', () => {
  const passwordResetToken = {
    findUnique: vi.fn(async () => h.row),
    updateMany: vi.fn(async (args: {where: Record<string, unknown>; data: Record<string, unknown>}) => {
      h.updateManyCalls.push(args);
      // The used-token burn (where has an `id`) must report count 1 so the tx
      // proceeds; the sibling sweep's count is irrelevant to the action.
      return {count: 'id' in args.where ? 1 : 2};
    })
  };
  const user = {
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

import {resetPassword} from './actions';

const VALID_TOKEN = 'a'.repeat(64);

function pwForm(): FormData {
  const fd = new FormData();
  fd.set('password', 'password123');
  fd.set('confirmPassword', 'password123');
  return fd;
}

describe('resetPassword — sibling token invalidation', () => {
  beforeEach(() => {
    h.updateManyCalls = [];
    h.userUpdateCalls = [];
    h.row = {
      id: 'tok-current',
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      user: {id: 'user-1', archivedAt: null}
    };
  });

  test('burns the used token AND invalidates the user’s other outstanding tokens', async () => {
    const result = await resetPassword(VALID_TOKEN, pwForm());
    expect(result.ok).toBe(true);

    // Two updateMany calls: the single-token burn, then the sibling sweep.
    expect(h.updateManyCalls).toHaveLength(2);

    const burn = h.updateManyCalls.find((c) => c.where.id === 'tok-current');
    expect(burn).toBeDefined();
    expect(burn!.data.usedAt).toBeInstanceOf(Date);

    // The sibling sweep targets the user's still-unused tokens (no `id` filter)
    // and stamps them used — this is the OWASP invalidation rider.
    const sweep = h.updateManyCalls.find((c) => !('id' in c.where));
    expect(sweep).toBeDefined();
    expect(sweep!.where.userId).toBe('user-1');
    expect(sweep!.where.usedAt).toBeNull();
    expect(sweep!.data.usedAt).toBeInstanceOf(Date);

    // The password was actually rotated for the right user.
    expect(h.userUpdateCalls).toHaveLength(1);
    expect(h.userUpdateCalls[0].where.id).toBe('user-1');
    expect(h.userUpdateCalls[0].data.passwordHash).toBe('HASHED');
  });
});
