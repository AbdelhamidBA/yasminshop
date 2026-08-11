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
