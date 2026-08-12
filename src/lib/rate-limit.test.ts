import {describe, expect, test} from 'vitest';
import {checkRateLimit, clientIpFromHeaders, type RateLimitStore} from './rate-limit';

describe('checkRateLimit — fixed window', () => {
  const LIMIT = 3;
  const WINDOW = 1000;

  test('allows the first N requests then blocks the (N+1)th', () => {
    const store: RateLimitStore = new Map();
    // First LIMIT calls are allowed.
    for (let i = 0; i < LIMIT; i++) {
      expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 0)).toEqual({
        allowed: true,
        retryAfterMs: 0
      });
    }
    // The next one is blocked and reports the remaining window.
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 0)).toEqual({
      allowed: false,
      retryAfterMs: 1000
    });
  });

  test('retryAfterMs shrinks as the window elapses', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < LIMIT; i++) checkRateLimit(store, 'ip', LIMIT, WINDOW, 0);
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 400)).toEqual({
      allowed: false,
      retryAfterMs: 600
    });
  });

  test('the window resets: once it elapses the counter starts fresh', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < LIMIT; i++) checkRateLimit(store, 'ip', LIMIT, WINDOW, 0);
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 0).allowed).toBe(false);
    // At now === resetAt the window has rolled over — a full fresh allowance.
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 1000)).toEqual({
      allowed: true,
      retryAfterMs: 0
    });
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 1000).allowed).toBe(true);
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 1000).allowed).toBe(true);
    expect(checkRateLimit(store, 'ip', LIMIT, WINDOW, 1000).allowed).toBe(false);
  });

  test('keys are independent — one IP being blocked never affects another', () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < LIMIT; i++) checkRateLimit(store, 'a', LIMIT, WINDOW, 0);
    expect(checkRateLimit(store, 'a', LIMIT, WINDOW, 0).allowed).toBe(false);
    expect(checkRateLimit(store, 'b', LIMIT, WINDOW, 0).allowed).toBe(true);
  });
});

describe('clientIpFromHeaders', () => {
  const h = (init: Record<string, string>) => new Headers(init);

  test('takes the first entry of x-forwarded-for', () => {
    expect(clientIpFromHeaders(h({'x-forwarded-for': '203.0.113.7, 10.0.0.1'}))).toBe('203.0.113.7');
  });

  test('falls back to x-real-ip when no forwarded-for', () => {
    expect(clientIpFromHeaders(h({'x-real-ip': '198.51.100.9'}))).toBe('198.51.100.9');
  });

  test('falls back to a constant when neither header is present', () => {
    expect(clientIpFromHeaders(h({}))).toBe('unknown');
  });

  test('ignores a blank x-forwarded-for and empty leading entry', () => {
    expect(clientIpFromHeaders(h({'x-forwarded-for': '   '}))).toBe('unknown');
    expect(clientIpFromHeaders(h({'x-forwarded-for': ', 10.0.0.1'}))).toBe('10.0.0.1');
  });
});
