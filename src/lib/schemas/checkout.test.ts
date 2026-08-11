import {describe, expect, test} from 'vitest';
import {fieldErrorsFromZod} from '../action-result';
import {checkoutSchema} from './checkout';

// The schema is client-facing: every constraint must surface a MESSAGE KEY
// (translated by the UI via t(`errors.${key}`)) — never zod's default English
// text. These tests assert the exact keys through fieldErrorsFromZod, the same
// helper the server action uses.
const KNOWN_KEYS = ['required', 'invalidPhone', 'tooShort', 'tooLong'];

const VALID = {
  name: 'Foulen Ben Foulen',
  phone: '21612345678',
  address: '12 rue de Marseille, Lafayette',
  city: 'Tunis',
  notes: '',
  promoCode: ''
};

function errorsFor(overrides: Partial<typeof VALID>): Record<string, string> {
  const result = checkoutSchema.safeParse({...VALID, ...overrides});
  if (result.success) return {};
  return fieldErrorsFromZod(result.error);
}

describe('checkoutSchema', () => {
  test('accepts a valid guest payload (values trimmed)', () => {
    const result = checkoutSchema.safeParse({...VALID, name: '  Foulen Ben Foulen  '});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Foulen Ben Foulen');
      expect(result.data.phone).toBe('21612345678');
    }
  });

  test('phone accepts + and spaces within 8..15 chars', () => {
    expect(errorsFor({phone: '+216 12 345 678'})).toEqual({});
  });

  test('empty required fields surface the "required" key', () => {
    expect(errorsFor({name: ''})).toEqual({name: 'required'});
    expect(errorsFor({phone: '   '})).toEqual({phone: 'required'});
    expect(errorsFor({address: ''})).toEqual({address: 'required'});
    expect(errorsFor({city: ''})).toEqual({city: 'required'});
  });

  test('too-short values surface the "tooShort" key', () => {
    expect(errorsFor({name: 'A'})).toEqual({name: 'tooShort'});
    expect(errorsFor({address: 'abc'})).toEqual({address: 'tooShort'});
    expect(errorsFor({city: 'T'})).toEqual({city: 'tooShort'});
  });

  test('malformed phones surface the "invalidPhone" key', () => {
    expect(errorsFor({phone: 'abcdefghij'})).toEqual({phone: 'invalidPhone'});
    expect(errorsFor({phone: '1234567'})).toEqual({phone: 'invalidPhone'}); // 7 chars < 8
    expect(errorsFor({phone: '1234567890123456'})).toEqual({phone: 'invalidPhone'}); // 16 > 15
  });

  test('notes are optional but capped at 500 chars with the "tooLong" key', () => {
    expect(errorsFor({notes: 'x'.repeat(500)})).toEqual({});
    expect(errorsFor({notes: 'x'.repeat(501)})).toEqual({notes: 'tooLong'});
    const withoutNotes = checkoutSchema.safeParse({...VALID, notes: undefined});
    expect(withoutNotes.success).toBe(true);
  });

  test('promoCode is optional', () => {
    expect(errorsFor({promoCode: 'BIENVENUE10'})).toEqual({});
    const withoutPromo = checkoutSchema.safeParse({...VALID, promoCode: undefined});
    expect(withoutPromo.success).toBe(true);
  });

  test('every surfaced message is a known key, never English prose', () => {
    const surfaced = [
      errorsFor({name: ''}),
      errorsFor({name: 'A'}),
      errorsFor({phone: 'nope'}),
      errorsFor({address: ''}),
      errorsFor({city: 'T'}),
      errorsFor({notes: 'x'.repeat(501)})
    ].flatMap((fieldErrors) => Object.values(fieldErrors));
    expect(surfaced.length).toBeGreaterThan(0);
    for (const message of surfaced) {
      expect(KNOWN_KEYS).toContain(message);
      // A key, not a sentence: no spaces, no trailing period.
      expect(message).toMatch(/^[a-zA-Z]+$/);
    }
  });
});
