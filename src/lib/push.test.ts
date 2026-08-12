import {describe, expect, test, vi} from 'vitest';
import {
  classifyPushError,
  sendToSubscriptions,
  type PushDeliveryDeps,
  type SendableSubscription
} from './push';

describe('classifyPushError', () => {
  test.each([
    ['404 Not Found', 404, 'prune'],
    ['410 Gone', 410, 'prune']
  ])('prunes on %s', (_label, code, expected) => {
    expect(classifyPushError(code as number)).toBe(expected);
  });

  test.each([
    ['500 transient server error', 500],
    ['429 rate limited', 429],
    ['400 bad request', 400],
    ['401 unauthorized (bad VAPID)', 401],
    ['200 (defensive)', 200],
    ['undefined (network/throw, no status)', undefined]
  ])('keeps on %s', (_label, code) => {
    expect(classifyPushError(code as number | undefined)).toBe('keep');
  });
});

describe('sendToSubscriptions', () => {
  const sub = (endpoint: string): SendableSubscription => ({
    endpoint,
    keysJson: {p256dh: 'p', auth: 'a'}
  });

  // A WebPushError-shaped rejection (web-push rejects with an object exposing a
  // numeric statusCode).
  const pushError = (statusCode: number) => Object.assign(new Error('push failed'), {statusCode});

  test('sends to every subscription when all succeed; never prunes', async () => {
    const deps: PushDeliveryDeps = {
      send: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined)
    };
    const summary = await sendToSubscriptions([sub('a'), sub('b')], '{}', deps);
    expect(summary).toEqual({sent: 2, pruned: 0, kept: 0});
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.remove).not.toHaveBeenCalled();
  });

  test('prunes exactly the subscription that returns 410 Gone', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const deps: PushDeliveryDeps = {
      send: vi.fn().mockRejectedValue(pushError(410)),
      remove
    };
    const summary = await sendToSubscriptions([sub('dead-endpoint')], '{}', deps);
    expect(summary).toEqual({sent: 0, pruned: 1, kept: 0});
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('dead-endpoint');
  });

  test('keeps (does not prune) a subscription that returns 500', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const deps: PushDeliveryDeps = {
      send: vi.fn().mockRejectedValue(pushError(500)),
      remove
    };
    const summary = await sendToSubscriptions([sub('flaky-endpoint')], '{}', deps);
    expect(summary).toEqual({sent: 0, pruned: 0, kept: 1});
    expect(remove).not.toHaveBeenCalled();
  });

  test('handles a mix: one sent, one pruned (410), one kept (500)', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined) // a → ok
      .mockRejectedValueOnce(pushError(410)) // b → prune
      .mockRejectedValueOnce(pushError(500)); // c → keep
    const summary = await sendToSubscriptions([sub('a'), sub('b'), sub('c')], '{}', {send, remove});
    expect(summary).toEqual({sent: 1, pruned: 1, kept: 1});
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('b');
  });

  test('a thrown error with no statusCode is kept, not pruned', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const deps: PushDeliveryDeps = {
      send: vi.fn().mockRejectedValue(new Error('network down')),
      remove
    };
    const summary = await sendToSubscriptions([sub('x')], '{}', deps);
    expect(summary).toEqual({sent: 0, pruned: 0, kept: 1});
    expect(remove).not.toHaveBeenCalled();
  });

  test('a failing prune is non-fatal: the loop continues and still sends the rest', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(pushError(410)) // first → prune, but remove throws
      .mockResolvedValueOnce(undefined); // second → still gets sent
    const remove = vi.fn().mockRejectedValue(new Error('row already gone'));
    const summary = await sendToSubscriptions([sub('dead'), sub('live')], '{}', {send, remove});
    expect(summary).toEqual({sent: 1, pruned: 1, kept: 0});
    expect(send).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith('dead');
  });

  test('empty subscription list resolves to an all-zero summary', async () => {
    const deps: PushDeliveryDeps = {send: vi.fn(), remove: vi.fn()};
    const summary = await sendToSubscriptions([], '{}', deps);
    expect(summary).toEqual({sent: 0, pruned: 0, kept: 0});
    expect(deps.send).not.toHaveBeenCalled();
  });
});
