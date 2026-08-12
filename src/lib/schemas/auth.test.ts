import {describe, expect, test} from 'vitest';
import {fieldErrorsFromZod} from '../action-result';
import {newPasswordSchema, registerSchema} from './auth';

// Same contract as checkoutSchema tests: every surfaced message must be a
// translation KEY (consumed via t(`authPages.errors.${key}`)), never prose.
const KNOWN_KEYS = ['required', 'tooShort', 'tooLong', 'invalidEmail', 'passwordTooShort', 'passwordMismatch'];

const VALID_REGISTER = {
  name: 'Foulen Ben Foulen',
  email: 'foulen@example.com',
  password: 'hunter2hunter2',
  confirmPassword: 'hunter2hunter2'
};

function registerErrors(overrides: Partial<typeof VALID_REGISTER>): Record<string, string> {
  const result = registerSchema.safeParse({...VALID_REGISTER, ...overrides});
  return result.success ? {} : fieldErrorsFromZod(result.error);
}

describe('registerSchema', () => {
  test('accepts a valid payload (name/email trimmed, password untouched)', () => {
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      name: '  Foulen Ben Foulen  ',
      email: '  foulen@example.com  '
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Foulen Ben Foulen');
      expect(result.data.email).toBe('foulen@example.com');
      expect(result.data.password).toBe('hunter2hunter2');
    }
  });

  test('passwords keep leading/trailing whitespace (bcrypt compares verbatim)', () => {
    const padded = ' spaced pass ';
    const result = registerSchema.safeParse({
      ...VALID_REGISTER,
      password: padded,
      confirmPassword: padded
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBe(padded);
  });

  test('empty required fields surface the "required" key', () => {
    expect(registerErrors({name: ''})).toEqual({name: 'required'});
    expect(registerErrors({email: '   '})).toEqual({email: 'required'});
    expect(registerErrors({password: ''})).toEqual({password: 'required'});
    expect(registerErrors({confirmPassword: ''})).toEqual({confirmPassword: 'required'});
  });

  test('malformed emails surface the "invalidEmail" key', () => {
    expect(registerErrors({email: 'nope'})).toEqual({email: 'invalidEmail'});
    expect(registerErrors({email: 'nope@'})).toEqual({email: 'invalidEmail'});
    expect(registerErrors({email: '@nope.com'})).toEqual({email: 'invalidEmail'});
  });

  test('short passwords surface the "passwordTooShort" key (min 8)', () => {
    expect(registerErrors({password: '1234567', confirmPassword: '1234567'})).toEqual({
      password: 'passwordTooShort'
    });
    expect(registerErrors({password: '12345678', confirmPassword: '12345678'})).toEqual({});
  });

  test('mismatched confirm surfaces "passwordMismatch" on confirmPassword', () => {
    expect(registerErrors({confirmPassword: 'different-pass'})).toEqual({
      confirmPassword: 'passwordMismatch'
    });
  });

  test('overlong values surface the "tooLong" key', () => {
    expect(registerErrors({name: 'x'.repeat(121)})).toEqual({name: 'tooLong'});
    const longPass = 'x'.repeat(201);
    expect(registerErrors({password: longPass, confirmPassword: longPass})).toEqual({
      password: 'tooLong'
    });
  });

  test('every surfaced message is a known key, never English prose', () => {
    const surfaced = [
      registerErrors({name: ''}),
      registerErrors({name: 'A'}),
      registerErrors({email: 'nope'}),
      registerErrors({password: 'short', confirmPassword: 'short'}),
      registerErrors({confirmPassword: 'other-password'})
    ].flatMap((fieldErrors) => Object.values(fieldErrors));
    expect(surfaced.length).toBeGreaterThan(0);
    for (const message of surfaced) {
      expect(KNOWN_KEYS).toContain(message);
      expect(message).toMatch(/^[a-zA-Z]+$/);
    }
  });
});

describe('newPasswordSchema', () => {
  test('accepts a valid matching pair', () => {
    const result = newPasswordSchema.safeParse({
      password: 'fresh-password',
      confirmPassword: 'fresh-password'
    });
    expect(result.success).toBe(true);
  });

  test('surfaces the same keys as registration', () => {
    const errorsFor = (input: {password: string; confirmPassword: string}) => {
      const result = newPasswordSchema.safeParse(input);
      return result.success ? {} : fieldErrorsFromZod(result.error);
    };
    expect(errorsFor({password: '', confirmPassword: ''})).toEqual({
      password: 'required',
      confirmPassword: 'required'
    });
    expect(errorsFor({password: 'short', confirmPassword: 'short'})).toEqual({
      password: 'passwordTooShort'
    });
    expect(errorsFor({password: 'long-enough', confirmPassword: 'long-enuff'})).toEqual({
      confirmPassword: 'passwordMismatch'
    });
  });
});
