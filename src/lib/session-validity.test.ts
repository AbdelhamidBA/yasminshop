import {describe, expect, test} from 'vitest';
import {sessionStillValid} from './session-validity';

// Pure decision at the heart of JWT session revocation: a session is still
// valid iff the tokenVersion embedded in its JWT matches the user's current
// tokenVersion in the DB. Any bump (password reset, archive, role/credential
// change) increments the DB version, leaving older tokens behind → invalid.
describe('sessionStillValid', () => {
  test('valid when the token version matches the DB version', () => {
    expect(sessionStillValid(0, 0)).toBe(true);
    expect(sessionStillValid(3, 3)).toBe(true);
  });

  test('invalid when the DB version has moved ahead (a bump happened)', () => {
    expect(sessionStillValid(0, 1)).toBe(false);
    expect(sessionStillValid(2, 5)).toBe(false);
  });

  test('invalid when the token version is somehow ahead of the DB (defensive)', () => {
    expect(sessionStillValid(4, 2)).toBe(false);
  });
});
