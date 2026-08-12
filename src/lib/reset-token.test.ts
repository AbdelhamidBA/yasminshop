import {describe, expect, test} from 'vitest';
import {
  RESET_TOKEN_PATTERN,
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken
} from './reset-token';

describe('reset-token helpers', () => {
  test('generateResetToken returns a 64-char lowercase hex token', () => {
    const {token} = generateResetToken();
    expect(token).toMatch(RESET_TOKEN_PATTERN);
    expect(token).toHaveLength(64);
  });

  test('tokenHash is the sha256 hex of the raw token', () => {
    const {token, tokenHash} = generateResetToken();
    expect(tokenHash).toBe(hashResetToken(token));
    expect(tokenHash).toMatch(RESET_TOKEN_PATTERN); // sha256 hex is also 64 hex chars
    expect(tokenHash).not.toBe(token);
  });

  test('hashResetToken matches a known sha256 vector', () => {
    // sha256("abc") — FIPS 180-2 appendix B.1
    expect(hashResetToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  test('successive tokens are distinct', () => {
    expect(generateResetToken().token).not.toBe(generateResetToken().token);
  });

  test('the scalar guard rejects near-miss shapes', () => {
    const {token} = generateResetToken();
    expect(RESET_TOKEN_PATTERN.test(token.slice(0, 63))).toBe(false); // too short
    expect(RESET_TOKEN_PATTERN.test(token + 'a')).toBe(false); // too long
    expect(RESET_TOKEN_PATTERN.test(token.slice(0, 63) + 'G')).toBe(false); // non-hex
    expect(RESET_TOKEN_PATTERN.test(token.toUpperCase())).toBe(false); // uppercase
    expect(RESET_TOKEN_PATTERN.test('')).toBe(false);
  });

  test('TTL is one hour', () => {
    expect(RESET_TOKEN_TTL_MS).toBe(3_600_000);
  });
});
