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
